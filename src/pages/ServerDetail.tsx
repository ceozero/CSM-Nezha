import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import NetworkChartLoading from "@/components/NetworkChartLoading";
import ServerDetailChart, {
	type DetailChartPeriod,
} from "@/components/ServerDetailChart";
import ServerDetailOverview from "@/components/ServerDetailOverview";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useWebSocketContext } from "@/hooks/use-websocket-context";

const NetworkChart = lazy(() =>
	import("@/components/NetworkChart").then((module) => ({
		default: module.NetworkChart,
	})),
);

export default function ServerDetail() {
	const { siteDisplayConfig } = useWebSocketContext();
	const [period, setPeriod] = useState<DetailChartPeriod>("realtime");
	const [peakCutEnabled, setPeakCutEnabled] = useState(
		() => window.ForcePeakCutEnabled === true,
	);
	useEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
	}, []);

	const { id: server_id } = useParams();

	if (!server_id) {
		return <Navigate to="/404" replace />;
	}

	return (
		<div className="mx-auto w-full max-w-5xl px-0 flex flex-col gap-4 server-info">
			<ServerDetailOverview server_id={server_id} />
			<ServerDetailChart
				server_id={server_id}
				period={period}
				onPeriodChange={setPeriod}
				toolbarTrailing={
					<div className="flex items-center gap-2">
						<Switch
							id="detail-peak-cut"
							checked={peakCutEnabled}
							onCheckedChange={setPeakCutEnabled}
						/>
						<Label className="text-xs" htmlFor="detail-peak-cut">
							削峰
						</Label>
					</div>
				}
			/>
			{siteDisplayConfig.showThreeNetDetails && (
				<Suspense fallback={<NetworkChartLoading />}>
					{/* 网络探测是详情页的延续，不再要求用户在标签间切换。 */}
					<NetworkChart
						server_id={server_id}
						show={true}
						period={period}
						onPeriodChange={setPeriod}
						peakCutEnabled={peakCutEnabled}
						onPeakCutChange={setPeakCutEnabled}
						showToolbar={false}
					/>
				</Suspense>
			)}
		</div>
	);
}
