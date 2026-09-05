import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { monthlyTrafficUsage } from "@/components/ServerTrafficUsage";
import { formatBytes } from "@/lib/format";
import type { NezhaServer } from "@/types/nezha-api";

const GIBIBYTE = 1024 ** 3;

type TrafficStatus = "normal" | "attention" | "critical" | "exceeded";

function trafficStatus(percent: number): TrafficStatus {
	if (percent >= 100) return "exceeded";
	if (percent >= 90) return "critical";
	if (percent >= 70) return "attention";
	return "normal";
}

function statusClassName(status: TrafficStatus) {
	if (status === "exceeded") return "bg-rose-600";
	if (status === "critical") return "bg-rose-500";
	if (status === "attention") return "bg-amber-400";
	return "bg-emerald-500";
}

function statusTextClassName(status: TrafficStatus) {
	if (status === "exceeded" || status === "critical") {
		return "text-rose-600 dark:text-rose-400";
	}
	if (status === "attention") return "text-amber-600 dark:text-amber-400";
	return "text-emerald-600 dark:text-emerald-400";
}

function resetDate(year: number, month: number, resetDay: number) {
	const lastDay = new Date(year, month + 1, 0).getDate();
	return new Date(year, month, Math.min(resetDay, lastDay));
}

function trafficCycle(resetDay: number, now: Date) {
	if (resetDay < 1 || resetDay > 31) return null;

	const currentReset = resetDate(now.getFullYear(), now.getMonth(), resetDay);
	if (now >= currentReset) {
		return {
			from: currentReset,
			to: resetDate(now.getFullYear(), now.getMonth() + 1, resetDay),
		};
	}

	return {
		from: resetDate(now.getFullYear(), now.getMonth() - 1, resetDay),
		to: currentReset,
	};
}

function formatDate(value: Date) {
	return new Intl.DateTimeFormat("zh-CN", {
		year: "numeric",
		month: "numeric",
		day: "numeric",
	}).format(value);
}

function formatResetDate(value: Date) {
	return new Intl.DateTimeFormat("zh-CN", {
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(value);
}

function calcTypeLabel(
	calcType: NezhaServer["state"]["traffic_calc_type"],
	t: ReturnType<typeof useTranslation>["t"],
) {
	if (calcType === "ul") return t("trafficQuota.upload", "仅上行");
	if (calcType === "dl") return t("trafficQuota.download", "仅下行");
	if (calcType === "max") return t("trafficQuota.max", "峰值计费");
	return t("trafficQuota.total", "合计");
}

/**
 * CFSM 未提供哪吒的 cycle_transfer_stats 接口，因此以每台服务器的月流量
 * 累计、限额、计费方式与重置日重建同类看板。
 */
export default function TrafficQuotaBoard({
	serverList,
}: {
	serverList: NezhaServer[];
}) {
	const { t } = useTranslation();
	const quotaServers = useMemo(
		() => serverList.filter((server) => server.state.traffic_limit > 0),
		[serverList],
	);

	if (quotaServers.length === 0) return null;

	const now = new Date();

	return (
		<section
			data-testid="traffic-quota-board"
			aria-label={t("trafficQuota.title", "月流量看板")}
			className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"
		>
			{quotaServers.map((server) => {
				const { state } = server;
				const limit = state.traffic_limit * GIBIBYTE;
				const used = monthlyTrafficUsage(
					state.net_in_monthly_transfer,
					state.net_out_monthly_transfer,
					state.traffic_calc_type,
				);
				const percent = (used / limit) * 100;
				const status = trafficStatus(percent);
				const cycle = trafficCycle(state.traffic_reset_day, now);
				const statusLabel = t(`trafficQuota.${status}`, {
					defaultValue: {
						normal: "正常",
						attention: "注意",
						critical: "即将超额",
						exceeded: "已超额",
					}[status],
				});

				return (
					<article
						key={server.id}
						className="rounded-lg border border-border bg-card px-4 py-3 shadow-xs transition-shadow hover:shadow-sm"
					>
						<div className="flex items-center justify-between gap-2">
							<h2 className="truncate text-sm font-medium">{server.name}</h2>
							<span
								className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-medium ${statusTextClassName(status)} bg-muted/70`}
							>
								{formatBytes(limit)}/月 · {calcTypeLabel(state.traffic_calc_type, t)} · {statusLabel}
							</span>
						</div>

						<div className="mt-3 flex items-baseline justify-between gap-2 tabular-nums">
							<p className="text-sm font-medium">
								{formatBytes(used)} <span className="text-muted-foreground">/ {formatBytes(limit)}</span>
							</p>
							<p className={`text-xs font-semibold ${statusTextClassName(status)}`}>
								{percent.toFixed(1)}%
							</p>
						</div>

						<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
							<div
								aria-label={`${server.name} ${t("serverCard.monthlyTrafficProgress", "本月流量进度")}`}
								className={`h-full rounded-full transition-[width] duration-300 ${statusClassName(status)}`}
								style={{ width: `${Math.min(percent, 100)}%` }}
							/>
						</div>

						<div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
							<span className="tabular-nums">
								↑ {formatBytes(state.net_out_monthly_transfer)}　↓ {formatBytes(state.net_in_monthly_transfer)}
							</span>
							{cycle ? (
								<span className="text-right tabular-nums">
									{t("trafficQuota.cycle", "本周期")} {formatDate(cycle.from)} - {formatDate(cycle.to)}　{t("trafficQuota.nextReset", "下次重置")} {formatResetDate(cycle.to)}
								</span>
							) : (
								<span>{t("trafficQuota.noAutoReset", "不自动重置")}</span>
							)}
						</div>
					</article>
				);
			})}
		</section>
	);
}
