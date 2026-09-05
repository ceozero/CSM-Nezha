import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { TooltipProvider } from "@/components/ui/tooltip";
import { hasAdminToken } from "@/cfsm/api";
import { useActiveIndicator } from "@/hooks/use-active-indicator";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { formatBytes } from "@/lib/format";
import { fetchDiskIoMetrics, fetchServerMetrics } from "@/lib/nezha-api";
import {
	cn,
	formatNezhaInfo,
	formatRelativeTime,
	formatTime,
} from "@/lib/utils";
import type {
	MetricPeriod,
	NezhaServer,
	NezhaWebsocketResponse,
} from "@/types/nezha-api";

import ChartSkeleton from "./loading/ChartSkeleton";
import { ServerDetailChartLoading } from "./loading/ServerDetailLoading";
import AnimatedCircularProgressBar from "./ui/animated-circular-progress-bar";

type ChartPeriod = "realtime" | MetricPeriod;

type gpuChartData = {
	timeStamp: string;
	gpu: number;
};

type cpuChartData = {
	timeStamp: string;
	cpu: number;
};

type processChartData = {
	timeStamp: string;
	process: number;
};

type diskChartData = {
	timeStamp: string;
	disk: number;
};

type memChartData = {
	timeStamp: string;
	mem: number;
	swap: number;
};

type networkChartData = {
	timeStamp: string;
	upload: number;
	download: number;
};

type connectChartData = {
	timeStamp: string;
	tcp: number;
	udp: number;
};

type loadChartData = {
	timeStamp: string;
	load1: number;
	load5: number;
	load15: number;
};

type diskIoChartData = {
	timeStamp: string;
	read: number;
	write: number;
	await: number;
	util: number;
};

const MIN_HISTORY_LOADING_MS = 300;
const sleep = (ms: number) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});

function PeriodSelector({
	selectedPeriod,
	onPeriodChange,
}: {
	selectedPeriod: ChartPeriod;
	onPeriodChange: (period: ChartPeriod) => void;
}) {
	const { t } = useTranslation();

	const periods = useMemo<{ value: ChartPeriod; label: string }[]>(
		() => [
			{ value: "realtime", label: t("serverDetailChart.realtime") },
			{ value: "10m", label: t("serverDetailChart.period10m", "10 分") },
			{ value: "30m", label: t("serverDetailChart.period30m", "30 分") },
			{ value: "1h", label: t("serverDetailChart.period1h", "1 时") },
			{ value: "6h", label: t("serverDetailChart.period6h", "6 时") },
			{ value: "1d", label: t("serverDetailChart.period1d") },
			{ value: "3d", label: t("serverDetailChart.period3d", "3 天") },
			{ value: "7d", label: t("serverDetailChart.period7d") },
		],
		[t],
	);
	const periodValues = useMemo(
		() => periods.map((period) => period.value),
		[periods],
	);
	const { containerRef, enableIndicatorAnimation, indicator, setItemRef } =
		useActiveIndicator(periodValues, selectedPeriod);

	return (
		<TooltipProvider delayDuration={120}>
			<div
				ref={containerRef}
				className="relative mt-2 mb-3 flex w-fit flex-wrap gap-0.5 rounded-full border border-border/60 bg-muted p-0.5 dark:border-border dark:bg-muted/40"
			>
				{indicator && (
					<div
						className="active-indicator-fade-in absolute left-0 top-0 z-10 bg-white dark:bg-background rounded-full ring-1 ring-border/60 dark:ring-border/40"
						style={{
							height: indicator.height,
							transform: `translate(${indicator.x}px, ${indicator.y}px)`,
							transition: indicator.shouldAnimate
								? "transform 0.5s var(--timing), width 0.5s var(--timing), height 0.5s var(--timing)"
								: "none",
							width: indicator.width,
						}}
					/>
				)}
				{periods.map((period, index) => {
					const requiresLogin =
						period.value === "3d" || period.value === "7d";
					const isDisabled = requiresLogin && !hasAdminToken();
					return (
						<div key={period.value}
						ref={setItemRef(index)}
						onClick={() => {
							if (isDisabled) return;
							if (selectedPeriod !== period.value) {
									enableIndicatorAnimation();
								}
								onPeriodChange(period.value);
							}}
						className={cn(
							"relative cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-300",
							isDisabled
								? "cursor-not-allowed text-muted-foreground/40 opacity-60"
								: selectedPeriod === period.value
								? "text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						aria-disabled={isDisabled}
						title={
							isDisabled
								? t("serverDetailChart.loginRequired", "请登录后查看")
								: undefined
						}
						>
							<div className="relative z-20 flex items-center gap-1.5">
								{period.value === "realtime" && (
									<span className="inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 dark:bg-emerald-400"></span>
								)}
								{period.label}
							</div>
						</div>
					);
				})}
			</div>
		</TooltipProvider>
	);
}

export default function ServerDetailChart({
	server_id,
}: {
	server_id: string;
}) {
	const { lastData, connected, messageHistory } = useWebSocketContext();
	const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>("realtime");

	if (!connected && !lastData) {
		return <ServerDetailChartLoading />;
	}

	const nezhaWsData = lastData;

	if (!nezhaWsData) {
		return <ServerDetailChartLoading />;
	}

	const server = nezhaWsData.servers.find((s) => s.id === server_id);

	if (!server) {
		return <ServerDetailChartLoading />;
	}

	const gpuStats = server.state.gpu || [];
	const gpuList = server.host.gpu || [];

	return (
		<section className="flex flex-col">
			<PeriodSelector
				selectedPeriod={selectedPeriod}
				onPeriodChange={setSelectedPeriod}
			/>
			<section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 server-charts">
				<CpuChart
					now={nezhaWsData.now}
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
				<MemChart
					now={nezhaWsData.now}
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
				<LoadChart
					now={nezhaWsData.now}
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
				<GpuChart
					id={server.id}
					gpuStat={gpuStats.length > 0 ? gpuStats.reduce((sum, value) => sum + value, 0) / gpuStats.length : 0}
					gpuName={gpuList.length > 1 ? `平均 (${gpuList.length} 张)` : gpuList[0]}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
				<DiskChart
					now={nezhaWsData.now}
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
				<DiskIoChart
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
				<ProcessChart
					now={nezhaWsData.now}
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
				<NetworkChart
					now={nezhaWsData.now}
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
				<ConnectChart
					now={nezhaWsData.now}
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
			</section>
		</section>
	);
}

function useHistoricalData<T>(
	serverId: string,
	metricName: string,
	period: ChartPeriod,
	transformData: (timestamp: number, value: number) => T,
) {
	const [historicalData, setHistoricalData] = useState<T[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [displayData, setDisplayData] = useState<T[]>([]);
	const [loadedPeriod, setLoadedPeriod] = useState<ChartPeriod>("realtime");

	useEffect(() => {
		let cancelled = false;

		if (period === "realtime") {
			setHistoricalData([]);
			setDisplayData([]);
			setIsLoading(false);
			setLoadedPeriod("realtime");
			return () => {
				cancelled = true;
			};
		}

		const fetchData = async () => {
			const loadingStartedAt = Date.now();
			setIsLoading(true);

			try {
				const response = await fetchServerMetrics(
					serverId,
					metricName as Parameters<typeof fetchServerMetrics>[1],
					period as MetricPeriod,
				);
				if (response.success && response.data?.data_points) {
					const transformedData = response.data.data_points.map((point) =>
						transformData(point.ts, point.value),
					);
					if (!cancelled) {
						setHistoricalData(transformedData);
						setDisplayData(transformedData);
					}
				}
			} catch (error) {
				console.error(`Failed to fetch ${metricName} metrics:`, error);
			} finally {
				const elapsed = Date.now() - loadingStartedAt;
				if (elapsed < MIN_HISTORY_LOADING_MS) {
					await sleep(MIN_HISTORY_LOADING_MS - elapsed);
				}
				if (!cancelled) {
					setIsLoading(false);
					setLoadedPeriod(period);
				}
			}
		};

		fetchData();
		return () => {
			cancelled = true;
		};
	}, [serverId, metricName, period, transformData]);

	const isHistoricalLoading =
		period !== "realtime" && (isLoading || loadedPeriod !== period);

	return { historicalData, displayData, isLoading: isHistoricalLoading };
}

function GpuChart({
	id,
	gpuStat,
	gpuName,
	messageHistory,
	period,
}: {
	id: string;
	gpuStat: number;
	gpuName?: string;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const [gpuChartData, setGpuChartData] = useState<gpuChartData[]>([]);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const transformGpuData = useMemo(
		() => (timestamp: number, value: number) => ({
			timeStamp: timestamp.toString(),
			gpu: value,
		}),
		[],
	);

	const { displayData: gpuHistoricalData, isLoading } =
		useHistoricalData<gpuChartData>(id, "gpu", period, transformGpuData);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === id);
					if (!server) return null;
					const { gpu } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						gpu: gpu.length > 0
							? gpu.reduce((sum, value) => sum + value, 0) / gpu.length
							: 0,
					};
				})
				.filter((item): item is gpuChartData => item !== null)
				.reverse();

			setGpuChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, id, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	useEffect(() => {
		if (historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setGpuChartData((prevData) => {
				let newData = [] as gpuChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, gpu: gpuStat },
						{ timeStamp: timestamp, gpu: gpuStat },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, gpu: gpuStat }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [gpuStat, historyLoaded, period]);

	const chartConfig = {
		gpu: {
			label: "GPU",
		},
	} satisfies ChartConfig;

	const displayData = period === "realtime" ? gpuChartData : gpuHistoricalData;

	return (
		<Card
			className={cn({
				"bg-card/70": customBackgroundImage,
			})}
		>
			<CardContent className="px-6 py-3">
				<section className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<section className="flex flex-col items-center gap-2">
							{!gpuName && <p className="text-md font-medium">GPU</p>}
							{gpuName && <p className="text-xs mt-1 mb-1.5">GPU: {gpuName}</p>}
						</section>
						<section className="flex items-center gap-2">
							<p className="text-xs text-end w-10 font-medium">
								{gpuStat.toFixed(2)}%
							</p>
							<AnimatedCircularProgressBar
								className="size-3 text-[0px]"
								max={100}
								min={0}
								value={gpuStat}
								primaryColor="hsl(var(--chart-3))"
							/>
						</section>
					</div>
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isLoading ? (
							<ChartSkeleton />
						) : (
							<AreaChart
								syncId="serverDetailCharts"
								accessibilityLayer
								data={displayData}
								margin={{
									top: 12,
									left: 12,
									right: 12,
								}}
							>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="timeStamp"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={200}
									interval="preserveStartEnd"
									tickFormatter={(value) => formatRelativeTime(value)}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									mirror={true}
									tickMargin={-15}
									domain={[0, 100]}
									tickFormatter={(value) => `${value}%`}
								/>
								<ChartTooltip
									isAnimationActive={false}
									content={
										<ChartTooltipContent
											indicator="dot"
											labelFormatter={(_, payload) => {
												return formatTime(
													Number(payload[0]?.payload?.timeStamp),
												);
											}}
											formatter={(value) => (
												<div className="flex flex-1 items-center justify-between leading-none">
													<span className="text-muted-foreground">GPU</span>
													<span className="ml-2 font-medium text-foreground tabular-nums">
														{Number(value).toFixed(1)}%
													</span>
												</div>
											)}
										/>
									}
								/>
								<Area
									isAnimationActive={false}
									dataKey="gpu"
									type="step"
									fill="hsl(var(--chart-3))"
									fillOpacity={0.3}
									stroke="hsl(var(--chart-3))"
								/>
							</AreaChart>
						)}
					</ChartContainer>
				</section>
			</CardContent>
		</Card>
	);
}

function CpuChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const [cpuChartData, setCpuChartData] = useState<cpuChartData[]>([]);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const { cpu } = formatNezhaInfo(now, data);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const transformCpuData = useMemo(
		() => (timestamp: number, value: number) => ({
			timeStamp: timestamp.toString(),
			cpu: value,
		}),
		[],
	);

	const { displayData: cpuHistoricalData, isLoading } =
		useHistoricalData<cpuChartData>(data.id, "cpu", period, transformCpuData);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { cpu } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						cpu: cpu,
					};
				})
				.filter((item): item is cpuChartData => item !== null)
				.reverse();

			setCpuChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 更新实时数据
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setCpuChartData((prevData) => {
				let newData = [] as cpuChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, cpu: cpu },
						{ timeStamp: timestamp, cpu: cpu },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, cpu: cpu }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [data, historyLoaded, cpu, period]);

	const chartConfig = {
		cpu: {
			label: "CPU",
		},
	} satisfies ChartConfig;

	const displayData = period === "realtime" ? cpuChartData : cpuHistoricalData;

	return (
		<Card
			className={cn({
				"bg-card/70": customBackgroundImage,
			})}
		>
			<CardContent className="px-6 py-3">
				<section className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<p className="text-md font-medium">CPU</p>
						<section className="flex items-center gap-2">
							<p className="text-xs text-end w-10 font-medium">
								{cpu.toFixed(2)}%
							</p>
							<AnimatedCircularProgressBar
								className="size-3 text-[0px]"
								max={100}
								min={0}
								value={cpu}
								primaryColor="hsl(var(--chart-1))"
							/>
						</section>
					</div>
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isLoading ? (
							<ChartSkeleton />
						) : (
							<AreaChart
								syncId="serverDetailCharts"
								accessibilityLayer
								data={displayData}
								margin={{
									top: 12,
									left: 12,
									right: 12,
								}}
							>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="timeStamp"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={200}
									interval="preserveStartEnd"
									tickFormatter={(value) => formatRelativeTime(value)}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									mirror={true}
									tickMargin={-15}
									domain={[0, 100]}
									tickFormatter={(value) => `${value}%`}
								/>
								<ChartTooltip
									isAnimationActive={false}
									content={
										<ChartTooltipContent
											indicator="dot"
											labelFormatter={(_, payload) => {
												return formatTime(
													Number(payload[0]?.payload?.timeStamp),
												);
											}}
											formatter={(value) => (
												<div className="flex flex-1 items-center justify-between leading-none">
													<span className="text-muted-foreground">CPU</span>
													<span className="ml-2 font-medium text-foreground tabular-nums">
														{Number(value).toFixed(1)}%
													</span>
												</div>
											)}
										/>
									}
								/>
								<Area
									isAnimationActive={false}
									dataKey="cpu"
									type="step"
									fill="hsl(var(--chart-1))"
									fillOpacity={0.3}
									stroke="hsl(var(--chart-1))"
								/>
							</AreaChart>
						)}
					</ChartContainer>
				</section>
			</CardContent>
		</Card>
	);
}

function ProcessChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const { t } = useTranslation();
	const [processChartData, setProcessChartData] = useState(
		[] as processChartData[],
	);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const { process } = formatNezhaInfo(now, data);

	const transformProcessData = useMemo(
		() => (timestamp: number, value: number) => ({
			timeStamp: timestamp.toString(),
			process: value,
		}),
		[],
	);

	const { displayData: processHistoricalData, isLoading } =
		useHistoricalData<processChartData>(
			data.id,
			"process_count",
			period,
			transformProcessData,
		);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { process } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						process,
					};
				})
				.filter((item): item is processChartData => item !== null)
				.reverse();

			setProcessChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setProcessChartData((prevData) => {
				let newData = [] as processChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, process },
						{ timeStamp: timestamp, process },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, process }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [data, historyLoaded, process, period]);

	const chartConfig = {
		process: {
			label: "Process",
		},
	} satisfies ChartConfig;

	const displayData =
		period === "realtime" ? processChartData : processHistoricalData;

	return (
		<Card
			className={cn({
				"bg-card/70": customBackgroundImage,
			})}
		>
			<CardContent className="px-6 py-3">
				<section className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<p className="text-md font-medium">
							{t("serverDetailChart.process")}
						</p>
						<section className="flex items-center gap-2">
							<p className="text-xs text-end w-10 font-medium">{process}</p>
						</section>
					</div>
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isLoading ? (
							<ChartSkeleton />
						) : (
							<AreaChart
								syncId="serverDetailCharts"
								accessibilityLayer
								data={displayData}
								margin={{
									top: 12,
									left: 12,
									right: 12,
								}}
							>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="timeStamp"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={200}
									interval="preserveStartEnd"
									tickFormatter={(value) => formatRelativeTime(value)}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									mirror={true}
									tickMargin={-15}
								/>
								<ChartTooltip
									isAnimationActive={false}
									content={
										<ChartTooltipContent
											indicator={"dot"}
											labelFormatter={(_, payload) => {
												return formatTime(
													Number(payload[0]?.payload?.timeStamp),
												);
											}}
											formatter={(value) => (
												<div className="flex flex-1 items-center justify-between leading-none">
													<span className="text-muted-foreground">
														{t("serverDetailChart.process")}
													</span>
													<span className="ml-2 font-medium text-foreground tabular-nums">
														{Number(value).toFixed(0)}
													</span>
												</div>
											)}
										/>
									}
								/>
								<Area
									isAnimationActive={false}
									dataKey="process"
									type="step"
									fill="hsl(var(--chart-2))"
									fillOpacity={0.3}
									stroke="hsl(var(--chart-2))"
								/>
							</AreaChart>
						)}
					</ChartContainer>
				</section>
			</CardContent>
		</Card>
	);
}

function MemChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const { t } = useTranslation();
	const [memChartData, setMemChartData] = useState([] as memChartData[]);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const { mem, swap } = formatNezhaInfo(now, data);

	// For memory, we fetch memory and swap separately and combine them
	const [memHistoricalData, setMemHistoricalData] = useState<memChartData[]>(
		[],
	);
	const [isLoadingMem, setIsLoadingMem] = useState(false);
	const [loadedPeriodMem, setLoadedPeriodMem] =
		useState<ChartPeriod>("realtime");

	useEffect(() => {
		let cancelled = false;

		if (period === "realtime") {
			setMemHistoricalData([]);
			setIsLoadingMem(false);
			setLoadedPeriodMem("realtime");
			return () => {
				cancelled = true;
			};
		}

		const fetchMemData = async () => {
			const loadingStartedAt = Date.now();
			setIsLoadingMem(true);
			try {
				const [memResponse, swapResponse] = await Promise.all([
					fetchServerMetrics(data.id, "memory", period as MetricPeriod),
					fetchServerMetrics(data.id, "swap", period as MetricPeriod),
				]);

				if (memResponse.success && memResponse.data?.data_points) {
					const swapMap = new Map<number, number>();
					if (swapResponse.success && swapResponse.data?.data_points) {
						for (const point of swapResponse.data.data_points) {
							// Convert bytes to percentage
							const swapPercent =
								data.host.swap_total > 0
									? (point.value / data.host.swap_total) * 100
									: 0;
							swapMap.set(point.ts, swapPercent);
						}
					}

					const combinedData = memResponse.data.data_points.map((point) => {
						// Convert bytes to percentage
						const memPercent =
							data.host.mem_total > 0
								? (point.value / data.host.mem_total) * 100
								: 0;
						return {
							timeStamp: point.ts.toString(),
							mem: memPercent,
							swap: swapMap.get(point.ts) || 0,
						};
					});
					if (!cancelled) {
						setMemHistoricalData(combinedData);
					}
				}
			} catch (error) {
				console.error("Failed to fetch memory metrics:", error);
			} finally {
				const elapsed = Date.now() - loadingStartedAt;
				if (elapsed < MIN_HISTORY_LOADING_MS) {
					await sleep(MIN_HISTORY_LOADING_MS - elapsed);
				}
				if (!cancelled) {
					setIsLoadingMem(false);
					setLoadedPeriodMem(period);
				}
			}
		};

		fetchMemData();
		return () => {
			cancelled = true;
		};
	}, [data.id, period, data.host.mem_total, data.host.swap_total]);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { mem, swap } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						mem,
						swap,
					};
				})
				.filter((item): item is memChartData => item !== null)
				.reverse();

			setMemChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setMemChartData((prevData) => {
				let newData = [] as memChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, mem, swap },
						{ timeStamp: timestamp, mem, swap },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, mem, swap }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [data, historyLoaded, mem, swap, period]);

	const chartConfig = {
		mem: {
			label: "Mem",
		},
		swap: {
			label: "Swap",
		},
	} satisfies ChartConfig;

	const displayData = period === "realtime" ? memChartData : memHistoricalData;
	const isMemLoading =
		period !== "realtime" && (isLoadingMem || loadedPeriodMem !== period);

	return (
		<Card
			className={cn({
				"bg-card/70": customBackgroundImage,
			})}
		>
			<CardContent className="px-6 py-3">
				<section className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<section className="flex items-center gap-4">
							<div className="flex flex-col">
								<p className=" text-xs text-muted-foreground">
									{t("serverDetailChart.mem")}
								</p>
								<div className="flex items-center gap-2">
									<AnimatedCircularProgressBar
										className="size-3 text-[0px]"
										max={100}
										min={0}
										value={mem}
										primaryColor="hsl(var(--chart-8))"
									/>
									<p className="text-xs font-medium">{mem.toFixed(0)}%</p>
								</div>
							</div>
							<div className="flex flex-col">
								<p className=" text-xs text-muted-foreground">
									{t("serverDetailChart.swap")}
								</p>
								<div className="flex items-center gap-2">
									<AnimatedCircularProgressBar
										className="size-3 text-[0px]"
										max={100}
										min={0}
										value={swap}
										primaryColor="hsl(var(--chart-10))"
									/>
									<p className="text-xs font-medium">{swap.toFixed(0)}%</p>
								</div>
							</div>
						</section>
						<section className="flex flex-col items-end gap-0.5">
							<div className="flex text-[11px] font-medium items-center gap-2">
								{formatBytes(data.state.mem_used)} /{" "}
								{formatBytes(data.host.mem_total)}
							</div>
							<div className="flex text-[11px] font-medium items-center gap-2">
								{data.host.swap_total ? (
									<>
										swap: {formatBytes(data.state.swap_used)} /{" "}
										{formatBytes(data.host.swap_total)}
									</>
								) : (
									<>no swap</>
								)}
							</div>
						</section>
					</div>
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isMemLoading ? (
							<ChartSkeleton />
						) : (
							<AreaChart
								syncId="serverDetailCharts"
								accessibilityLayer
								data={displayData}
								margin={{
									top: 12,
									left: 12,
									right: 12,
								}}
							>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="timeStamp"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={200}
									interval="preserveStartEnd"
									tickFormatter={(value) => formatRelativeTime(value)}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									mirror={true}
									tickMargin={-15}
									domain={[0, 100]}
									tickFormatter={(value) => `${value}%`}
								/>
								<ChartTooltip
									isAnimationActive={false}
									content={
										<ChartTooltipContent
											indicator="dot"
											labelFormatter={(_, payload) => {
												return formatTime(
													Number(payload[0]?.payload?.timeStamp),
												);
											}}
											formatter={(value, name) => {
												const label =
													name === "mem"
														? t("serverDetailChart.mem")
														: t("serverDetailChart.swap");
												return (
													<div className="flex flex-1 items-center justify-between leading-none">
														<span className="text-muted-foreground">
															{label}
														</span>
														<span className="ml-2 font-medium text-foreground tabular-nums">
															{Number(value).toFixed(1)}%
														</span>
													</div>
												);
											}}
										/>
									}
								/>
								<Area
									isAnimationActive={false}
									dataKey="mem"
									type="step"
									fill="hsl(var(--chart-8))"
									fillOpacity={0.3}
									stroke="hsl(var(--chart-8))"
								/>
								<Area
									isAnimationActive={false}
									dataKey="swap"
									type="step"
									fill="hsl(var(--chart-10))"
									fillOpacity={0.3}
									stroke="hsl(var(--chart-10))"
								/>
							</AreaChart>
						)}
					</ChartContainer>
				</section>
			</CardContent>
		</Card>
	);
}

function DiskChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const { t } = useTranslation();
	const [diskChartData, setDiskChartData] = useState([] as diskChartData[]);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const { disk } = formatNezhaInfo(now, data);

	const transformDiskData = useMemo(
		() => (timestamp: number, value: number) => {
			// Convert bytes to percentage
			const diskPercent =
				data.host.disk_total > 0 ? (value / data.host.disk_total) * 100 : 0;
			return {
				timeStamp: timestamp.toString(),
				disk: diskPercent,
			};
		},
		[data.host.disk_total],
	);

	const { displayData: diskHistoricalData, isLoading } =
		useHistoricalData<diskChartData>(
			data.id,
			"disk",
			period,
			transformDiskData,
		);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { disk } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						disk,
					};
				})
				.filter((item): item is diskChartData => item !== null)
				.reverse();

			setDiskChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setDiskChartData((prevData) => {
				let newData = [] as diskChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, disk },
						{ timeStamp: timestamp, disk },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, disk }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [data, historyLoaded, disk, period]);

	const chartConfig = {
		disk: {
			label: "Disk",
		},
	} satisfies ChartConfig;

	const displayData =
		period === "realtime" ? diskChartData : diskHistoricalData;

	return (
		<Card
			className={cn({
				"bg-card/70": customBackgroundImage,
			})}
		>
			<CardContent className="px-6 py-3">
				<section className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<p className="text-md font-medium">{t("serverDetailChart.disk")}</p>
						<section className="flex flex-col items-end gap-0.5">
							<section className="flex items-center gap-2">
								<p className="text-xs text-end w-10 font-medium">
									{disk.toFixed(0)}%
								</p>
								<AnimatedCircularProgressBar
									className="size-3 text-[0px]"
									max={100}
									min={0}
									value={disk}
									primaryColor="hsl(var(--chart-5))"
								/>
							</section>
							<div className="flex text-[11px] font-medium items-center gap-2">
								{formatBytes(data.state.disk_used)} /{" "}
								{formatBytes(data.host.disk_total)}
							</div>
						</section>
					</div>
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isLoading ? (
							<ChartSkeleton />
						) : (
							<AreaChart
								syncId="serverDetailCharts"
								accessibilityLayer
								data={displayData}
								margin={{
									top: 12,
									left: 12,
									right: 12,
								}}
							>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="timeStamp"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={200}
									interval="preserveStartEnd"
									tickFormatter={(value) => formatRelativeTime(value)}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									mirror={true}
									tickMargin={-15}
									domain={[0, 100]}
									tickFormatter={(value) => `${value}%`}
								/>
								<ChartTooltip
									isAnimationActive={false}
									content={
										<ChartTooltipContent
											indicator="dot"
											labelFormatter={(_, payload) => {
												return formatTime(
													Number(payload[0]?.payload?.timeStamp),
												);
											}}
											formatter={(value) => (
												<div className="flex flex-1 items-center justify-between leading-none">
													<span className="text-muted-foreground">
														{t("serverDetailChart.disk")}
													</span>
													<span className="ml-2 font-medium text-foreground tabular-nums">
														{Number(value).toFixed(1)}%
													</span>
												</div>
											)}
										/>
									}
								/>
								<Area
									isAnimationActive={false}
									dataKey="disk"
									type="step"
									fill="hsl(var(--chart-5))"
									fillOpacity={0.3}
									stroke="hsl(var(--chart-5))"
								/>
							</AreaChart>
						)}
					</ChartContainer>
				</section>
			</CardContent>
		</Card>
	);
}

function NetworkChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const { t } = useTranslation();
	const [networkChartData, setNetworkChartData] = useState(
		[] as networkChartData[],
	);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const { up, down } = formatNezhaInfo(now, data);

	// For network, we fetch upload and download separately and combine them
	const [networkHistoricalData, setNetworkHistoricalData] = useState<
		networkChartData[]
	>([]);
	const [isLoadingNetwork, setIsLoadingNetwork] = useState(false);
	const [loadedPeriodNetwork, setLoadedPeriodNetwork] =
		useState<ChartPeriod>("realtime");

	useEffect(() => {
		let cancelled = false;

		if (period === "realtime") {
			setNetworkHistoricalData([]);
			setIsLoadingNetwork(false);
			setLoadedPeriodNetwork("realtime");
			return () => {
				cancelled = true;
			};
		}

		const fetchNetworkData = async () => {
			const loadingStartedAt = Date.now();
			setIsLoadingNetwork(true);
			try {
				const [uploadResponse, downloadResponse] = await Promise.all([
					fetchServerMetrics(data.id, "net_out_speed", period as MetricPeriod),
					fetchServerMetrics(data.id, "net_in_speed", period as MetricPeriod),
				]);

				if (uploadResponse.success && uploadResponse.data?.data_points) {
					const downloadMap = new Map<number, number>();
					if (downloadResponse.success && downloadResponse.data?.data_points) {
						for (const point of downloadResponse.data.data_points) {
							// Convert bytes to MB
							downloadMap.set(point.ts, point.value / 1024 / 1024);
						}
					}

					const combinedData = uploadResponse.data.data_points.map((point) => ({
						timeStamp: point.ts.toString(),
						upload: point.value / 1024 / 1024, // Convert bytes to MB
						download: downloadMap.get(point.ts) || 0,
					}));
					if (!cancelled) {
						setNetworkHistoricalData(combinedData);
					}
				}
			} catch (error) {
				console.error("Failed to fetch network metrics:", error);
			} finally {
				const elapsed = Date.now() - loadingStartedAt;
				if (elapsed < MIN_HISTORY_LOADING_MS) {
					await sleep(MIN_HISTORY_LOADING_MS - elapsed);
				}
				if (!cancelled) {
					setIsLoadingNetwork(false);
					setLoadedPeriodNetwork(period);
				}
			}
		};

		fetchNetworkData();
		return () => {
			cancelled = true;
		};
	}, [data.id, period]);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { up, down } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						upload: up,
						download: down,
					};
				})
				.filter((item): item is networkChartData => item !== null)
				.reverse();

			setNetworkChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setNetworkChartData((prevData) => {
				let newData = [] as networkChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, upload: up, download: down },
						{ timeStamp: timestamp, upload: up, download: down },
					];
				} else {
					newData = [
						...prevData,
						{ timeStamp: timestamp, upload: up, download: down },
					];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [data, historyLoaded, down, up, period]);

	const displayData =
		period === "realtime" ? networkChartData : networkHistoricalData;
	const isNetworkLoading =
		period !== "realtime" &&
		(isLoadingNetwork || loadedPeriodNetwork !== period);

	let maxDownload = Math.max(...displayData.map((item) => item.download));
	maxDownload = Math.ceil(maxDownload);
	if (maxDownload < 1) {
		maxDownload = 1;
	}

	const chartConfig = {
		upload: {
			label: "Upload",
		},
		download: {
			label: "Download",
		},
	} satisfies ChartConfig;

	return (
		<Card
			className={cn({
				"bg-card/70": customBackgroundImage,
			})}
		>
			<CardContent className="px-6 py-3">
				<section className="flex flex-col gap-1">
					<div className="flex items-center">
						<section className="flex items-center gap-4">
							<div className="flex flex-col w-20">
								<p className="text-xs text-muted-foreground">
									{t("serverDetailChart.upload")}
								</p>
								<div className="flex items-center gap-1">
									<span className="relative inline-flex  size-1.5 rounded-full bg-[hsl(var(--chart-1))]" />
									<p className="text-xs font-medium">
										{up >= 1024
											? `${(up / 1024).toFixed(2)}G/s`
											: up >= 1
												? `${up.toFixed(2)}M/s`
												: `${(up * 1024).toFixed(2)}K/s`}
									</p>
								</div>
							</div>
							<div className="flex flex-col w-20">
								<p className=" text-xs text-muted-foreground">
									{t("serverDetailChart.download")}
								</p>
								<div className="flex items-center gap-1">
									<span className="relative inline-flex  size-1.5 rounded-full bg-[hsl(var(--chart-4))]" />
									<p className="text-xs font-medium">
										{down >= 1024
											? `${(down / 1024).toFixed(2)}G/s`
											: down >= 1
												? `${down.toFixed(2)}M/s`
												: `${(down * 1024).toFixed(2)}K/s`}
									</p>
								</div>
							</div>
						</section>
					</div>
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isNetworkLoading ? (
							<ChartSkeleton />
						) : (
							<LineChart
								syncId="serverDetailCharts"
								accessibilityLayer
								data={displayData}
								margin={{
									top: 12,
									left: 12,
									right: 12,
								}}
							>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="timeStamp"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={200}
									interval="preserveStartEnd"
									tickFormatter={(value) => formatRelativeTime(value)}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									mirror={true}
									tickMargin={-15}
									type="number"
									minTickGap={50}
									interval="preserveStartEnd"
									domain={[1, maxDownload]}
									tickFormatter={(value) => `${value.toFixed(0)}M/s`}
								/>
								<ChartTooltip
									isAnimationActive={false}
									content={
										<ChartTooltipContent
											indicator="dot"
											labelFormatter={(_, payload) => {
												return formatTime(
													Number(payload[0]?.payload?.timeStamp),
												);
											}}
											formatter={(value, name) => {
												const label =
													name === "upload"
														? t("serverDetailChart.upload")
														: t("serverDetailChart.download");
												return (
													<div className="flex flex-1 items-center justify-between leading-none">
														<span className="text-muted-foreground">
															{label}
														</span>
														<span className="ml-2 font-medium text-foreground tabular-nums">
															{Number(value).toFixed(2)} MB/s
														</span>
													</div>
												);
											}}
										/>
									}
								/>
								<Line
									isAnimationActive={false}
									dataKey="upload"
									type="linear"
									stroke="hsl(var(--chart-1))"
									strokeWidth={1}
									dot={false}
								/>
								<Line
									isAnimationActive={false}
									dataKey="download"
									type="linear"
									stroke="hsl(var(--chart-4))"
									strokeWidth={1}
									dot={false}
								/>
							</LineChart>
						)}
					</ChartContainer>
				</section>
			</CardContent>
		</Card>
	);
}

function ConnectChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const [connectChartData, setConnectChartData] = useState(
		[] as connectChartData[],
	);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const { tcp, udp } = formatNezhaInfo(now, data);

	// For connections, we fetch TCP and UDP separately and combine them
	const [connectHistoricalData, setConnectHistoricalData] = useState<
		connectChartData[]
	>([]);
	const [isLoadingConnect, setIsLoadingConnect] = useState(false);
	const [loadedPeriodConnect, setLoadedPeriodConnect] =
		useState<ChartPeriod>("realtime");

	useEffect(() => {
		let cancelled = false;

		if (period === "realtime") {
			setConnectHistoricalData([]);
			setIsLoadingConnect(false);
			setLoadedPeriodConnect("realtime");
			return () => {
				cancelled = true;
			};
		}

		const fetchConnectData = async () => {
			const loadingStartedAt = Date.now();
			setIsLoadingConnect(true);
			try {
				const [tcpResponse, udpResponse] = await Promise.all([
					fetchServerMetrics(data.id, "tcp_conn", period as MetricPeriod),
					fetchServerMetrics(data.id, "udp_conn", period as MetricPeriod),
				]);

				if (tcpResponse.success && tcpResponse.data?.data_points) {
					const udpMap = new Map<number, number>();
					if (udpResponse.success && udpResponse.data?.data_points) {
						for (const point of udpResponse.data.data_points) {
							udpMap.set(point.ts, point.value);
						}
					}

					const combinedData = tcpResponse.data.data_points.map((point) => ({
						timeStamp: point.ts.toString(),
						tcp: point.value,
						udp: udpMap.get(point.ts) || 0,
					}));
					if (!cancelled) {
						setConnectHistoricalData(combinedData);
					}
				}
			} catch (error) {
				console.error("Failed to fetch connection metrics:", error);
			} finally {
				const elapsed = Date.now() - loadingStartedAt;
				if (elapsed < MIN_HISTORY_LOADING_MS) {
					await sleep(MIN_HISTORY_LOADING_MS - elapsed);
				}
				if (!cancelled) {
					setIsLoadingConnect(false);
					setLoadedPeriodConnect(period);
				}
			}
		};

		fetchConnectData();
		return () => {
			cancelled = true;
		};
	}, [data.id, period]);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { tcp, udp } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						tcp,
						udp,
					};
				})
				.filter((item): item is connectChartData => item !== null)
				.reverse();

			setConnectChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setConnectChartData((prevData) => {
				let newData = [] as connectChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, tcp, udp },
						{ timeStamp: timestamp, tcp, udp },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, tcp, udp }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [data, historyLoaded, tcp, udp, period]);

	const chartConfig = {
		tcp: {
			label: "TCP",
		},
		udp: {
			label: "UDP",
		},
	} satisfies ChartConfig;

	const displayData =
		period === "realtime" ? connectChartData : connectHistoricalData;
	const isConnectLoading =
		period !== "realtime" &&
		(isLoadingConnect || loadedPeriodConnect !== period);

	return (
		<Card
			className={cn({
				"bg-card/70": customBackgroundImage,
			})}
		>
			<CardContent className="px-6 py-3">
				<section className="flex flex-col gap-1">
					<div className="flex items-center">
						<section className="flex items-center gap-4">
							<div className="flex flex-col w-12">
								<p className="text-xs text-muted-foreground">TCP</p>
								<div className="flex items-center gap-1">
									<span className="relative inline-flex  size-1.5 rounded-full bg-[hsl(var(--chart-1))]" />
									<p className="text-xs font-medium">{tcp}</p>
								</div>
							</div>
							<div className="flex flex-col w-12">
								<p className=" text-xs text-muted-foreground">UDP</p>
								<div className="flex items-center gap-1">
									<span className="relative inline-flex  size-1.5 rounded-full bg-[hsl(var(--chart-4))]" />
									<p className="text-xs font-medium">{udp}</p>
								</div>
							</div>
						</section>
					</div>
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isConnectLoading ? (
							<ChartSkeleton />
						) : (
							<LineChart
								syncId="serverDetailCharts"
								accessibilityLayer
								data={displayData}
								margin={{
									top: 12,
									left: 12,
									right: 12,
								}}
							>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="timeStamp"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={200}
									interval="preserveStartEnd"
									tickFormatter={(value) => formatRelativeTime(value)}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									mirror={true}
									tickMargin={-15}
									type="number"
									interval="preserveStartEnd"
								/>
								<ChartTooltip
									isAnimationActive={false}
									content={
										<ChartTooltipContent
											indicator="dot"
											labelFormatter={(_, payload) => {
												return formatTime(
													Number(payload[0]?.payload?.timeStamp),
												);
											}}
											formatter={(value, name) => {
												const label = name === "tcp" ? "TCP" : "UDP";
												return (
													<div className="flex flex-1 items-center justify-between leading-none">
														<span className="text-muted-foreground">
															{label}
														</span>
														<span className="ml-2 font-medium text-foreground tabular-nums">
															{Number(value).toFixed(0)}
														</span>
													</div>
												);
											}}
										/>
									}
								/>
								<Line
									isAnimationActive={false}
									dataKey="tcp"
									type="linear"
									stroke="hsl(var(--chart-1))"
									strokeWidth={1}
									dot={false}
								/>
								<Line
									isAnimationActive={false}
									dataKey="udp"
									type="linear"
									stroke="hsl(var(--chart-4))"
									strokeWidth={1}
									dot={false}
								/>
							</LineChart>
						)}
					</ChartContainer>
				</section>
			</CardContent>
		</Card>
	);
}

/** 负载单独成图，三个窗口都来自 CFSM 的 load_avg 字段。 */
function LoadChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const [realtime, setRealtime] = useState<loadChartData[]>([]);
	const [history, setHistory] = useState<loadChartData[]>([]);
	const [loading, setLoading] = useState(false);
	// 旧探针或缓存快照可能还未包含负载字段，图表应以 0 安全降级。
	const load1 = Number(data.state.load_1) || 0;
	const load5 = Number(data.state.load_5) || 0;
	const load15 = Number(data.state.load_15) || 0;

	useEffect(() => {
		if (period === "realtime") {
			setHistory([]);
			setLoading(false);
			return;
		}
		let cancelled = false;
		setLoading(true);
		void Promise.all([
			fetchServerMetrics(data.id, "load1", period),
			fetchServerMetrics(data.id, "load5", period),
			fetchServerMetrics(data.id, "load15", period),
		]).then(([one, five, fifteen]) => {
			if (cancelled) return;
			const fiveByTime = new Map(five.data.data_points.map((point) => [point.ts, point.value]));
			const fifteenByTime = new Map(fifteen.data.data_points.map((point) => [point.ts, point.value]));
			setHistory(one.data.data_points.map((point) => ({
				timeStamp: String(point.ts),
				load1: point.value,
				load5: fiveByTime.get(point.ts) || 0,
				load15: fifteenByTime.get(point.ts) || 0,
			})));
		}).catch(() => {
			if (!cancelled) setHistory([]);
		}).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => { cancelled = true; };
	}, [data.id, period]);

	useEffect(() => {
		if (period !== "realtime") return;
		const initial = messageHistory.map((snapshot) => {
			const item = snapshot.servers.find((server) => server.id === data.id);
			return item ? {
				timeStamp: String(snapshot.now),
				load1: item.state.load_1,
				load5: item.state.load_5,
				load15: item.state.load_15,
			} : null;
		}).filter((item): item is loadChartData => item !== null).reverse();
		setRealtime(initial.slice(-30));
	}, [data.id, messageHistory, period]);

	useEffect(() => {
		if (period !== "realtime") return;
		setRealtime((previous) => [...previous, {
			timeStamp: String(now), load1, load5, load15,
		}].slice(-30));
	}, [load1, load5, load15, now, period]);

	const chartConfig = {
		load1: { label: "1 分" }, load5: { label: "5 分" }, load15: { label: "15 分" },
	} satisfies ChartConfig;
	const displayData = period === "realtime" ? realtime : history;
	return (
		<Card><CardContent className="px-6 py-3"><section className="flex flex-col gap-1">
			<div className="flex items-center gap-4 text-xs">
				<p className="font-medium">负载</p>
				<span className="text-muted-foreground">1分 <b className="text-foreground">{load1.toFixed(2)}</b></span>
				<span className="text-muted-foreground">5分 <b className="text-foreground">{load5.toFixed(2)}</b></span>
				<span className="text-muted-foreground">15分 <b className="text-foreground">{load15.toFixed(2)}</b></span>
			</div>
			<ChartContainer config={chartConfig} className="aspect-auto h-[130px] w-full">
				{loading ? <ChartSkeleton /> : <LineChart syncId="serverDetailCharts" accessibilityLayer data={displayData} margin={{ top: 12, left: 12, right: 12 }}>
					<CartesianGrid vertical={false} /><XAxis dataKey="timeStamp" tickLine={false} axisLine={false} tickMargin={8} minTickGap={200} tickFormatter={formatRelativeTime} />
					<YAxis tickLine={false} axisLine={false} mirror tickMargin={-15} />
					<ChartTooltip isAnimationActive={false} content={<ChartTooltipContent indicator="dot" labelFormatter={(_, payload) => formatTime(Number(payload[0]?.payload?.timeStamp))} formatter={(value, name) => <div className="flex flex-1 items-center justify-between"><span>{chartConfig[String(name) as keyof typeof chartConfig]?.label}</span><span className="font-medium">{Number(value).toFixed(2)}</span></div>} />} />
					<Line dataKey="load1" type="linear" stroke="hsl(var(--chart-1))" strokeWidth={1} dot={false} isAnimationActive={false} /><Line dataKey="load5" type="linear" stroke="hsl(var(--chart-4))" strokeWidth={1} dot={false} isAnimationActive={false} /><Line dataKey="load15" type="linear" stroke="hsl(var(--chart-5))" strokeWidth={1} dot={false} isAnimationActive={false} />
				</LineChart>}
			</ChartContainer>
		</section></CardContent></Card>
	);
}

/** 历史 API 一次返回六项 I/O 指标，图表用吞吐与利用率，悬浮提示保留其余指标。 */
function DiskIoChart({
	data,
	messageHistory,
	period,
}: {
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const [realtime, setRealtime] = useState<diskIoChartData[]>([]);
	const [history, setHistory] = useState<diskIoChartData[]>([]);
	const [loading, setLoading] = useState(false);
	// 磁盘 I/O 由较新的 CFSM Agent 上报；旧数据没有该对象时不阻塞详情页。
	const io = data.state.disk_io ?? {
		read_bps: 0,
		write_bps: 0,
		read_iops: 0,
		write_iops: 0,
		await_ms: 0,
		util: 0,
	};

	useEffect(() => {
		if (period === "realtime") { setHistory([]); setLoading(false); return; }
		let cancelled = false;
		setLoading(true);
		void fetchDiskIoMetrics(data.id, period).then((points) => {
			if (!cancelled) setHistory(points.map((point) => ({ timeStamp: String(point.ts), read: point.readBps / 1024 / 1024, write: point.writeBps / 1024 / 1024, await: point.awaitMs, util: point.util })));
		}).catch(() => { if (!cancelled) setHistory([]); }).finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [data.id, period]);

	useEffect(() => {
		if (period !== "realtime") return;
		setRealtime(messageHistory.map((snapshot) => {
			const item = snapshot.servers.find((server) => server.id === data.id);
			const snapshotIo = item?.state.disk_io;
			return item ? {
				timeStamp: String(snapshot.now),
				read: (snapshotIo?.read_bps ?? 0) / 1024 / 1024,
				write: (snapshotIo?.write_bps ?? 0) / 1024 / 1024,
				await: snapshotIo?.await_ms ?? 0,
				util: snapshotIo?.util ?? 0,
			} : null;
		}).filter((item): item is diskIoChartData => item !== null).reverse().slice(-30));
	}, [data.id, messageHistory, period]);

	useEffect(() => {
		if (period !== "realtime") return;
		setRealtime((previous) => [...previous, { timeStamp: String(Date.now()), read: io.read_bps / 1024 / 1024, write: io.write_bps / 1024 / 1024, await: io.await_ms, util: io.util }].slice(-30));
	}, [io, period]);

	const chartConfig = { read: { label: "读取" }, write: { label: "写入" }, util: { label: "利用率" } } satisfies ChartConfig;
	const displayData = period === "realtime" ? realtime : history;
	return (
		<Card><CardContent className="px-6 py-3"><section className="flex flex-col gap-1">
			<div className="flex items-center justify-between text-xs"><p className="font-medium">磁盘 I/O</p><span className="text-muted-foreground">读 {formatBytes(io.read_bps)}/s · 写 {formatBytes(io.write_bps)}/s · {io.util.toFixed(0)}%</span></div>
			<ChartContainer config={chartConfig} className="aspect-auto h-[130px] w-full">
				{loading ? <ChartSkeleton /> : <LineChart syncId="serverDetailCharts" accessibilityLayer data={displayData} margin={{ top: 12, left: 12, right: 12 }}>
					<CartesianGrid vertical={false} /><XAxis dataKey="timeStamp" tickLine={false} axisLine={false} tickMargin={8} minTickGap={200} tickFormatter={formatRelativeTime} /><YAxis yAxisId="speed" tickLine={false} axisLine={false} mirror tickMargin={-15} tickFormatter={(value) => `${value.toFixed(0)}M`} /><YAxis yAxisId="util" orientation="right" domain={[0, 100]} hide />
					<ChartTooltip isAnimationActive={false} content={<ChartTooltipContent indicator="dot" labelFormatter={(_, payload) => formatTime(Number(payload[0]?.payload?.timeStamp))} formatter={(value, name) => <div className="flex flex-1 items-center justify-between"><span>{chartConfig[String(name) as keyof typeof chartConfig]?.label}</span><span className="font-medium">{name === "util" ? `${Number(value).toFixed(1)}%` : `${Number(value).toFixed(2)} MiB/s`}</span></div>} />} />
					<Line yAxisId="speed" dataKey="read" type="linear" stroke="hsl(var(--chart-1))" strokeWidth={1} dot={false} isAnimationActive={false} /><Line yAxisId="speed" dataKey="write" type="linear" stroke="hsl(var(--chart-4))" strokeWidth={1} dot={false} isAnimationActive={false} /><Line yAxisId="util" dataKey="util" type="linear" stroke="hsl(var(--chart-5))" strokeWidth={1} dot={false} isAnimationActive={false} />
				</LineChart>}
			</ChartContainer>
		</section></CardContent></Card>
	);
}
