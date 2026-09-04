import type { CfsmServer, DashboardServer, RealtimePoint } from "./types";

const asNumber = (value: unknown) => {
	const number = Number(value);
	return Number.isFinite(number) ? number : 0;
};

function parseGpus(value: CfsmServer["gpu_info"]): DashboardServer["gpus"] {
	if (Array.isArray(value)) return value;
	if (typeof value !== "string") return [];
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed)
			? parsed.filter(
				(item): item is { id: string; name: string; info: number | null } =>
					!!item && typeof item === "object" && "name" in item,
			)
			: [];
	} catch {
		return [];
	}
}

export function isOnline(server: CfsmServer, now = Date.now()) {
	if (typeof server.is_online === "boolean") return server.is_online;
	const updatedAt = asNumber(server.last_updated || server.timestamp);
	return updatedAt > 0 && now - updatedAt <= 5 * 60 * 1000;
}

export function toDashboardServer(server: CfsmServer): DashboardServer {
	return {
		id: server.id,
		name: server.name || server.id,
		group: String(server.server_group || "未分组"),
		tags: String(server.tags || "")
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean),
		online: isOnline(server),
		cpu: asNumber(server.cpu),
		ramTotal: asNumber(server.ram_total),
		ramUsed: asNumber(server.ram_used),
		swapTotal: asNumber(server.swap_total),
		swapUsed: asNumber(server.swap_used),
		diskTotal: asNumber(server.disk_total),
		diskUsed: asNumber(server.disk_used),
		netInSpeed: asNumber(server.net_in_speed),
		netOutSpeed: asNumber(server.net_out_speed),
		netRx: asNumber(server.net_rx),
		netTx: asNumber(server.net_tx),
		processes: asNumber(server.processes),
		tcpConnections: asNumber(server.tcp_conn),
		udpConnections: asNumber(server.udp_conn),
		os: String(server.os || "未知系统"),
		kernel: String(server.kernel_version || ""),
		arch: String(server.arch || ""),
		cpuInfo: String(server.cpu_info || ""),
		gpus: parseGpus(server.gpu_info),
		region: String(server.region || ""),
		bootTime: asNumber(server.boot_time),
		lastUpdated: asNumber(server.last_updated || server.timestamp),
		raw: server,
	};
}

export function mergeServer(
	current: CfsmServer,
	delta: Partial<CfsmServer>,
): CfsmServer {
	return { ...current, ...delta, id: current.id };
}

export function toRealtimePoint(server: DashboardServer, timestamp: number): RealtimePoint {
	return {
		timestamp,
		cpu: server.cpu,
		ramUsed: server.ramUsed,
		ramTotal: server.ramTotal,
		diskUsed: server.diskUsed,
		diskTotal: server.diskTotal,
		netInSpeed: server.netInSpeed,
		netOutSpeed: server.netOutSpeed,
	};
}

export const percent = (used: number, total: number) =>
	total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;

export const formatBytes = (value: number) => {
	if (!Number.isFinite(value) || value <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB", "PB"];
	const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
	return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export const formatRate = (value: number) => `${formatBytes(value)}/s`;
