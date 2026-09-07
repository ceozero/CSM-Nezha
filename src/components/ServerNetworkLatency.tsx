import { cn } from "@/lib/utils";
import type { NezhaNetworkLatency } from "@/types/nezha-api";
import {
	defaultLatencyLabels,
	type LatencyLabels,
} from "@/context/websocket-context";

const ROUTES = [
	{ key: "ct" },
	{ key: "cu" },
	{ key: "cm" },
	{ key: "bd" },
	{ key: "node_1" },
	{ key: "node_2" },
	{ key: "node_3" },
	{ key: "node_4" },
] as const;

function latencyTone(delay: number, loss?: number) {
	if ((loss ?? 0) > 0 || delay >= 200) return "text-rose-500 dark:text-rose-400";
	if (delay >= 100) return "text-amber-500 dark:text-amber-400";
	return "text-emerald-600 dark:text-emerald-400";
}

/** 丢包独立分级，避免被延迟颜色覆盖。 */
function lossTone(loss: number) {
	if (loss >= 10) return "font-bold text-rose-500 dark:text-rose-400";
	if (loss >= 3) return "font-medium text-orange-500 dark:text-orange-400";
	if (loss > 0) return "font-medium text-amber-500 dark:text-amber-400";
	return "font-medium text-emerald-600 dark:text-emerald-400";
}

/** 在首页卡片展示 CFSM 当前采样的线路延迟，不额外请求历史数据。 */
export default function ServerNetworkLatency({
	latency,
	labels = defaultLatencyLabels,
	className,
}: {
	latency?: NezhaNetworkLatency;
	labels?: LatencyLabels;
	className?: string;
}) {
	const routes = ROUTES.flatMap((route) => {
		const probe = latency?.[route.key];
		return probe ? [{ ...route, label: labels[route.key], ...probe }] : [];
	});

	if (routes.length === 0) return null;

	return (
		<section
			aria-label="最新线路延迟"
			className={cn("flex w-full flex-wrap items-center gap-1.5", className)}
		>
			{routes.map((route) => (
				<span
					key={route.key}
					className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/45 px-1.5 py-0.5 text-[10px] leading-none"
				>
					<span className="text-muted-foreground">{route.label}</span>
					<span className={cn("font-semibold tabular-nums", latencyTone(route.delay, route.loss))}>
						{Math.round(route.delay)}ms
					</span>
					{route.loss !== undefined && (
						<span className={cn(lossTone(route.loss), "tabular-nums")}>
							丢 {Math.round(route.loss)}%
						</span>
					)}
				</span>
			))}
		</section>
	);
}
