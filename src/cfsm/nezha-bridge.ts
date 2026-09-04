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
	const trafficLimit = server.traffic_limit === undefined || server.traffic_limit === null ? "" : String(server.traffic_limit);
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
			net_in_speed: numberValue(server.net_in_speed),
			net_out_speed: numberValue(server.net_out_speed),
			uptime,
			load_1: Number(String(server.load_avg || "").split(/\s+/)[0]) || 0,
			load_5: Number(String(server.load_avg || "").split(/\s+/)[1]) || 0,
			load_15: Number(String(server.load_avg || "").split(/\s+/)[2]) || 0,
			tcp_conn_count: numberValue(server.tcp_conn),
			udp_conn_count: numberValue(server.udp_conn),
			process_count: numberValue(server.processes),
			temperatures: [],
			gpu: [],
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
	gpu: "cpu",
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
		} else if (field === "uptime") value = 0;
		else value = numberValue(row[field]);
		return { ts: numberValue(row.timestamp), value };
	});
}
