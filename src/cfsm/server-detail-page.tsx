import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBytes, formatRate, percent } from "./adapter";
import { getHistory } from "./api";
import { useCfsmData } from "./data-provider";
import { Metric } from "./layout";
import type { HistoryRow, RealtimePoint } from "./types";

type Period = { label: string; hours: number | "live" };
const periods: Period[] = [
	{ label: "实时", hours: "live" },
	{ label: "1 小时", hours: 1 },
	{ label: "6 小时", hours: 6 },
	{ label: "24 小时", hours: 24 },
	{ label: "7 天", hours: 168 },
];

const toNumber = (value: unknown) => {
	const number = Number(value);
	return Number.isFinite(number) ? number : 0;
};

const timeLabel = (timestamp: number) => new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", month: "numeric", day: "numeric" }).format(new Date(timestamp));

function ChartFrame({ title, children }: { title: string; children: React.ReactNode }) {
	return <section className="rounded-3xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"><h2 className="text-sm font-semibold">{title}</h2><div className="mt-5 h-56">{children}</div></section>;
}

function OverviewBar({ label, value, color }: { label: string; value: number; color: string }) {
	return <div><div className="flex justify-between text-sm"><span>{label}</span><span className="tabular-nums text-stone-500">{value.toFixed(1)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800"><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} /></div></div>;
}

function convertHistory(rows: HistoryRow[]) {
	return rows.map((row) => ({ timestamp: row.timestamp, cpu: toNumber(row.cpu), memory: percent(toNumber(row.ram_used), toNumber(row.ram_total)), disk: percent(toNumber(row.disk_used), toNumber(row.disk_total)), upload: toNumber(row.net_out_speed), download: toNumber(row.net_in_speed) }));
}

function convertRealtime(rows: RealtimePoint[]) {
	return rows.map((row) => ({ timestamp: row.timestamp, cpu: row.cpu, memory: percent(row.ramUsed, row.ramTotal), disk: percent(row.diskUsed, row.diskTotal), upload: row.netOutSpeed, download: row.netInSpeed }));
}

export function ServerDetailPage() {
	const { id = "" } = useParams();
	const { servers, realtime } = useCfsmData();
	const [period, setPeriod] = useState<Period>(periods[0]);
	const [history, setHistory] = useState<HistoryRow[]>([]);
	const [historyError, setHistoryError] = useState("");
	const [historyLoading, setHistoryLoading] = useState(false);
	const server = servers.find((item) => item.id === id);

	useEffect(() => {
		let cancelled = false;
		if (period.hours === "live" || !id) { setHistory([]); setHistoryError(""); return; }
		setHistoryLoading(true); setHistoryError("");
		void getHistory(id, period.hours)
			.then((rows) => { if (!cancelled) setHistory(rows); })
			.catch((error: unknown) => { if (!cancelled) setHistoryError(error instanceof Error ? error.message : "历史数据加载失败"); })
			.finally(() => { if (!cancelled) setHistoryLoading(false); });
		return () => { cancelled = true; };
	}, [id, period]);

	const chartData = useMemo(() => period.hours === "live" ? convertRealtime(realtime[id] || []) : convertHistory(history), [history, id, period.hours, realtime]);
	if (!id) return <Navigate to="/" replace />;
	if (!server) return <main className="mx-auto max-w-6xl px-4 py-20 text-center text-sm text-stone-500">正在加载服务器详情…</main>;

	const cpu = percent(server.cpu, 100);
	const memory = percent(server.ramUsed, server.ramTotal);
	const disk = percent(server.diskUsed, server.diskTotal);
	const chartFallback = chartData.length === 0 ? [{ timestamp: Date.now(), cpu, memory, disk, upload: server.netOutSpeed, download: server.netInSpeed }] : chartData;

	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
			<Link to="/" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 dark:hover:text-white"><ArrowLeft className="size-4" /> 返回服务器列表</Link>
			<section className="mt-6 rounded-3xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900 md:p-8"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-start"><div><div className="flex items-center gap-2"><span className={`size-2.5 rounded-full ${server.online ? "bg-emerald-500" : "bg-rose-500"}`} /><h1 className="text-2xl font-semibold">{server.name}</h1></div><p className="mt-2 text-sm text-stone-500">{[server.group, server.region, server.os, server.arch].filter(Boolean).join(" · ")}</p></div><div className="flex flex-wrap gap-2">{server.tags.map((tag) => <span key={tag} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">{tag}</span>)}</div></div><div className="mt-8 grid gap-5 md:grid-cols-3"><OverviewBar label="CPU" value={cpu} color="bg-sky-500" /><OverviewBar label="内存" value={memory} color="bg-violet-500" /><OverviewBar label="磁盘" value={disk} color="bg-amber-500" /></div></section>
			<section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="上传速率" value={formatRate(server.netOutSpeed)} /><Metric label="下载速率" value={formatRate(server.netInSpeed)} /><Metric label="累计上传" value={formatBytes(server.netTx)} /><Metric label="累计下载" value={formatBytes(server.netRx)} /></section>
			<section className="mt-8 flex flex-wrap gap-2">{periods.map((item) => <button type="button" key={item.label} onClick={() => setPeriod(item)} className={`rounded-full px-4 py-2 text-sm ${period.label === item.label ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900" : "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-300"}`}>{item.label}</button>)}</section>
			{historyError && <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">历史数据加载失败：{historyError}</p>}
			{historyLoading && <p className="mt-4 text-sm text-stone-500">正在加载历史指标…</p>}
			<section className="mt-5 grid gap-4 lg:grid-cols-2"><ChartFrame title="资源使用率"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartFallback}><CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} /><XAxis dataKey="timestamp" tickFormatter={timeLabel} minTickGap={36} fontSize={11} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} fontSize={11} /><Tooltip labelFormatter={(value) => timeLabel(Number(value))} formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name === "cpu" ? "CPU" : name === "memory" ? "内存" : "磁盘"]} /><Legend formatter={(value) => value === "cpu" ? "CPU" : value === "memory" ? "内存" : "磁盘"} /><Area type="monotone" dataKey="cpu" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.12} strokeWidth={2} /><Area type="monotone" dataKey="memory" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} strokeWidth={2} /><Area type="monotone" dataKey="disk" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.08} strokeWidth={2} /></AreaChart></ResponsiveContainer></ChartFrame><ChartFrame title="网络速率"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartFallback}><CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} /><XAxis dataKey="timestamp" tickFormatter={timeLabel} minTickGap={36} fontSize={11} /><YAxis tickFormatter={(value) => formatBytes(Number(value))} fontSize={11} /><Tooltip labelFormatter={(value) => timeLabel(Number(value))} formatter={(value, name) => [formatRate(Number(value)), name === "upload" ? "上传" : "下载"]} /><Legend formatter={(value) => value === "upload" ? "上传" : "下载"} /><Line type="monotone" dataKey="upload" stroke="#0ea5e9" dot={false} strokeWidth={2} /><Line type="monotone" dataKey="download" stroke="#10b981" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></ChartFrame></section>
			<section className="mt-5 grid gap-3 md:grid-cols-3"><Metric label="进程数" value={String(server.processes)} subvalue="当前采样" /><Metric label="TCP / UDP" value={`${server.tcpConnections} / ${server.udpConnections}`} subvalue="当前连接" /><Metric label="启动时间" value={server.bootTime ? new Date(server.bootTime).toLocaleString("zh-CN") : "未知"} subvalue={server.cpuInfo || "硬件信息未上报"} /></section>
			{server.gpus.length > 0 && <section className="mt-5 rounded-3xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"><h2 className="text-sm font-semibold">GPU</h2><div className="mt-3 grid gap-2 md:grid-cols-2">{server.gpus.map((gpu) => <p key={gpu.id} className="rounded-2xl bg-stone-50 p-3 text-sm dark:bg-stone-800">{gpu.name}{gpu.info !== null ? ` · ${gpu.info}%` : ""}</p>)}</div></section>}
			<section className="mt-5 grid gap-3 md:grid-cols-3"><Metric label="系统" value={server.os} subvalue={server.kernel || "内核信息未上报"} /><Metric label="CPU" value={server.cpuInfo || "未知 CPU"} subvalue={server.raw.cpu_cores ? `${server.raw.cpu_cores} 核` : undefined} /><Metric label="存储" value={`${formatBytes(server.diskUsed)} / ${formatBytes(server.diskTotal)}`} subvalue={`Swap ${formatBytes(server.swapUsed)} / ${formatBytes(server.swapTotal)}`} /></section>
		</main>
	);
}
