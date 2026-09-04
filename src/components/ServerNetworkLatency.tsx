import { cn } from "@/lib/utils";
import type { NezhaNetworkLatency } from "@/types/nezha-api";

const ROUTES = [
	{ key: "ct", label: "电信" },
	{ key: "cu", label: "联通" },
	{ key: "cm", label: "移动" },
] as const;

function latencyTone(delay: number, loss?: number) {
	if ((loss ?? 0) > 0 || delay >= 200) return "text-rose-500 dark:text-rose-400";
	if (delay >= 100) return "text-amber-500 dark:text-amber-400";
	return "text-emerald-600 dark:text-emerald-400";
}

/** 在首页卡片展示 CFSM 当前采样的三网延迟，不额外请求历史数据。 */
export default function ServerNetworkLatency({
	latency,
	className,
}: {
	latency?: NezhaNetworkLatency;
	className?: string;
}) {
	const routes = ROUTES.flatMap((route) => {
		const probe = latency?.[route.key];
		return probe ? [{ ...route, ...probe }] : [];
	});

	if (routes.length === 0) return null;

	return (
		<section
			aria-label="最新三网延迟"
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
					{route.loss !== undefined && route.loss > 0 && (
						<span className="font-medium text-rose-500 dark:text-rose-400">
							丢 {Math.round(route.loss)}%
						</span>
					)}
				</span>
			))}
		</section>
	);
}
