import type {
	CfsmServer,
	HistoryRow,
} from "./types";
import type {
	MetricDataPoint,
	MetricType,
	NezhaServer,
	ServerGroup,
} from "@/types/nezha-api";

const MEBIBYTE = 1024 * 1024;

function numberValue(value: unknown) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function megabytesToBytes(value: unknown) {
	return numberValue(value) * MEBIBYTE;
}

function toNetworkProbe(delay: unknown, loss: unknown) {
	if (typeof delay !== "number" || !Number.isFinite(delay) || delay < 0) {
		return undefined;
	}

	const lossValue = typeof loss === "number" ? loss : Number.NaN;
	return {
		delay,
		...(Number.isFinite(lossValue) && lossValue >= 0 ? { loss: lossValue } : {}),
	};
}

/** CFSM 套餐流量以 GB 数值保存；原主题徽标需要可读的套餐文案。 */
function formatTrafficLimit(value: unknown) {
	const trafficLimit = String(value ?? "").trim();
	if (!trafficLimit) return "";
	if (!/^\d+(?:\.\d+)?$/.test(trafficLimit)) return trafficLimit;

	const numericValue = Number(trafficLimit);
	if (numericValue >= 1024) {
		const tebibytes = (numericValue / 1024).toFixed(2).replace(/\.00$/, "");
		return `${tebibytes}TB/月`;
	}

	return `${numericValue}GB/月`;
}

function trafficLimitInGiB(value: unknown) {
	const trafficLimit = Number.parseFloat(String(value ?? ""));
	return Number.isFinite(trafficLimit) && trafficLimit > 0 ? trafficLimit : 0;
}

function trafficCalcType(value: unknown): "total" | "ul" | "dl" | "max" {
	return value === "ul" || value === "dl" || value === "max" ? value : "total";
}

function parseGpuNames(value: CfsmServer["gpu_info"]) {
	if (Array.isArray(value)) return value.map((gpu) => gpu.name).filter(Boolean);
	if (typeof value !== "string") return [];
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed)
			? parsed
					.filter(
						(item): item is { name?: unknown } =>
							!!item && typeof item === "object",
					)
					.map((item) => String(item.name || ""))
					.filter(Boolean)
			: [];
	} catch {
		return [];
	}
}

function parseGpuUsage(value: CfsmServer["gpu_info"]) {
	const parsed = typeof value === "string" ? (() => {
		try {
			return JSON.parse(value) as unknown;
		} catch {
			return [] as unknown[];
		}
	})() : value;
	if (!Array.isArray(parsed)) return [];
	return parsed.map((gpu) => {
		if (!gpu || typeof gpu !== "object") return 0;
		return numberValue((gpu as { info?: unknown }).info);
	});
}

/**
 * 保留原 nezha-dash-v2 组件树，同时把 CFSM 字段转换为其既有视图模型。
 * 容量字段在 CFSM 中是 MiB，而原主题的 formatBytes 以字节为单位显示。
 */
export function toNezhaServer(server: CfsmServer): NezhaServer {
	const updatedAt = numberValue(server.last_updated || server.timestamp) || Date.now();
	const online =
		typeof server.is_online === "boolean"
			? server.is_online
			: Date.now() - updatedAt <= 300_000;
	const bootTimeMs = numberValue(server.boot_time);
	const bootTimeSeconds = bootTimeMs > 10_000_000_000 ? bootTimeMs / 1000 : bootTimeMs;
	const uptime = bootTimeSeconds > 0 ? Math.max(0, Math.floor(Date.now() / 1000 - bootTimeSeconds)) : 0;
	const price = server.price === undefined || server.price === null ? "" : String(server.price);
	const currency = typeof server.currency === "string" ? server.currency : "";
	const trafficLimit = formatTrafficLimit(server.traffic_limit);
	// 即使 CFSM 没有套餐价格，也要保留其真实的 IP 能力和标签，
	// 否则原主题的 IPv4/IPv6 与线路徽标会被错误地省略。
	const hasPlanInfo =
		price ||
		trafficLimit ||
		server.expire_date ||
		server.tags ||
		String(server.ip_v4 || "") === "1" ||
		String(server.ip_v6 || "") === "1";
	const publicNote =
		hasPlanInfo
			? JSON.stringify({
					billingDataMod: {
						startDate: "",
						endDate: String(server.expire_date || ""),
						autoRenewal: String(server.auto_renewal || "0"),
						cycle: String(server.billing_cycle || ""),
						amount: price,
						currency,
					},
					planDataMod: {
						bandwidth: "",
						trafficVol: trafficLimit,
						trafficType: String(server.traffic_calc_type || ""),
						IPv4: String(server.ip_v4 || ""),
						IPv6: String(server.ip_v6 || ""),
						networkRoute: String(server.tags || ""),
						extra: "",
					},
				})
			: "";

	return {
		id: server.id,
		name: server.name || server.id,
		public_note: publicNote,
		// 原主题以 30 秒阈值判断在线；在桥接层映射为“当前在线即刚刚活动”。
		last_active: online ? new Date().toISOString() : "0001-01-01T00:00:00.000Z",
		country_code: String(server.region || ""),
		host: {
			platform: String(server.os || ""),
			platform_version: String(server.kernel_version || ""),
			cpu: server.cpu_info ? [String(server.cpu_info)] : [],
			gpu: parseGpuNames(server.gpu_info),
			mem_total: megabytesToBytes(server.ram_total),
			disk_total: megabytesToBytes(server.disk_total),
			swap_total: megabytesToBytes(server.swap_total),
			arch: String(server.arch || ""),
			boot_time: bootTimeSeconds,
			version: String(server.agent_version || ""),
		},
		state: {
			cpu: numberValue(server.cpu),
			mem_used: megabytesToBytes(server.ram_used),
			swap_used: megabytesToBytes(server.swap_used),
			disk_used: megabytesToBytes(server.disk_used),
			net_in_transfer: numberValue(server.net_rx),
			net_out_transfer: numberValue(server.net_tx),
			net_in_monthly_transfer: numberValue(server.net_rx_monthly),
			net_out_monthly_transfer: numberValue(server.net_tx_monthly),
			traffic_limit: trafficLimitInGiB(server.traffic_limit),
			traffic_calc_type: trafficCalcType(server.traffic_calc_type),
			traffic_reset_day: numberValue(server.reset_day),
			net_in_speed: numberValue(server.net_in_speed),
			net_out_speed: numberValue(server.net_out_speed),
			uptime,
			load_1: Number(String(server.load_avg || "").split(/\s+/)[0]) || 0,
			load_5: Number(String(server.load_avg || "").split(/\s+/)[1]) || 0,
			load_15: Number(String(server.load_avg || "").split(/\s+/)[2]) || 0,
			tcp_conn_count: numberValue(server.tcp_conn),
			udp_conn_count: numberValue(server.udp_conn),
			process_count: numberValue(server.processes),
			network_latency: {
				ct: toNetworkProbe(server.ping_ct, server.loss_ct),
				cu: toNetworkProbe(server.ping_cu, server.loss_cu),
				cm: toNetworkProbe(server.ping_cm, server.loss_cm),
				bd: toNetworkProbe(server.ping_bd, server.loss_bd),
			},
			temperatures: [],
			gpu: parseGpuUsage(server.gpu_info),
			disk_io: {
				read_bps: numberValue(server.disk?.read_bps),
				write_bps: numberValue(server.disk?.write_bps),
				read_iops: numberValue(server.disk?.read_iops),
				write_iops: numberValue(server.disk?.write_iops),
				await_ms: numberValue(server.disk?.await_ms),
				util: numberValue(server.disk?.util),
			},
		},
	};
}

export function toServerGroups(servers: CfsmServer[]): ServerGroup[] {
	const grouped = new Map<string, string[]>();
	for (const server of servers) {
		const group = String(server.server_group || "未分组");
		grouped.set(group, [...(grouped.get(group) || []), server.id]);
	}
	return [...grouped.entries()].map(([name, ids], index) => ({
		group: { id: index + 1, created_at: "", updated_at: "", name },
		servers: ids,
	}));
}

const HISTORY_FIELDS: Record<MetricType, keyof HistoryRow | "memory"> = {
	cpu: "cpu",
	memory: "memory",
	swap: "swap_used",
	disk: "disk_used",
	net_in_speed: "net_in_speed",
	net_out_speed: "net_out_speed",
	net_in_transfer: "net_rx",
	net_out_transfer: "net_tx",
	load1: "load_avg",
	load5: "load_avg",
	load15: "load_avg",
	tcp_conn: "tcp_conn",
	udp_conn: "udp_conn",
	process_count: "processes",
	temperature: "cpu",
	uptime: "timestamp",
	gpu: "gpu_info",
};

export function toMetricPoints(rows: HistoryRow[], metric: MetricType): MetricDataPoint[] {
	const field = HISTORY_FIELDS[metric];
	return rows.map((row) => {
		let value = 0;
		if (field === "memory") value = megabytesToBytes(row.ram_used);
		else if (field === "swap_used" || field === "disk_used") value = megabytesToBytes(row[field]);
		else if (metric === "load1" || metric === "load5" || metric === "load15") {
			const index = metric === "load1" ? 0 : metric === "load5" ? 1 : 2;
			value = Number(String(row.load_avg || "").split(/\s+/)[index]) || 0;
		} else if (metric === "gpu") {
			const values = parseGpuUsage(row.gpu_info);
			// 多 GPU 主机以平均利用率绘制单张概览图，避免遗漏任意一张显卡。
			value = values.length > 0
				? values.reduce((sum, item) => sum + item, 0) / values.length
				: 0;
		} else if (field === "uptime") value = 0;
		else value = numberValue(row[field]);
		return { ts: numberValue(row.timestamp), value };
	});
}
