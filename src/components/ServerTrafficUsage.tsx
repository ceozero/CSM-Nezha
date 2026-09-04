import { useTranslation } from "react-i18next";
import { formatBytes } from "@/lib/format";
import { Progress } from "./ui/progress";

const GIBIBYTE = 1024 ** 3;

type TrafficCalcType = "total" | "ul" | "dl" | "max";

export function monthlyTrafficUsage(
	down: number,
	up: number,
	calcType: TrafficCalcType,
) {
	if (calcType === "dl") return down;
	if (calcType === "ul") return up;
	if (calcType === "max") return Math.max(down, up);
	return down + up;
}

function usageTone(percent: number) {
	if (percent >= 90) return "bg-rose-500";
	if (percent >= 70) return "bg-amber-400";
	return "bg-emerald-500";
}

/** 按 CFSM 的流量计算类型显示本月已用配额；未设置上限时不渲染。 */
export default function ServerTrafficUsage({
	down,
	up,
	limitGiB,
	calcType,
}: {
	down: number;
	up: number;
	limitGiB: number;
	calcType: TrafficCalcType;
}) {
	const { t } = useTranslation();
	const hasLimit = limitGiB > 0;
	const used = monthlyTrafficUsage(down, up, calcType);
	const limit = limitGiB * GIBIBYTE;
	const percent = hasLimit ? (used / limit) * 100 : 0;
	const displayedPercent = Math.min(100, Math.max(0, percent));

	return (
		<section
			aria-label={t("serverCard.monthlyTraffic")}
			className="flex h-6 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-border/70 bg-muted/35 px-2 text-[10px]"
		>
			<span className="shrink-0 text-muted-foreground">
				{t("serverCard.monthlyTraffic")}
			</span>
			{hasLimit ? (
				<>
					<span className="shrink-0 font-semibold tabular-nums">
						{formatBytes(used)} / {formatBytes(limit)}
					</span>
					<Progress
						aria-label={t("serverCard.monthlyTrafficProgress")}
						className="h-1 min-w-6 flex-1"
						indicatorClassName={usageTone(percent)}
						value={displayedPercent}
					/>
					<span className="shrink-0 font-medium tabular-nums">
						{percent.toFixed(1)}%
					</span>
				</>
			) : (
				<>
					<span className="text-sky-600 dark:text-sky-400">
						↑ {formatBytes(up)}
					</span>
					<span className="text-violet-600 dark:text-violet-400">
						↓ {formatBytes(down)}
					</span>
				</>
			)}
		</section>
	);
}
