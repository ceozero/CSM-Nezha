/**
 * 兼容层：保留 nezha-dash-v2 组件调用形状，实际请求全部转至 CFSM 公开 API。
 * 文件名暂不改动，避免视觉组件的大面积重写。
 */
import { getConfig, getHistory, getServers } from "@/cfsm/api";
import type { CfsmLatencyPoint, HistoryRow } from "@/cfsm/types";
import { toMetricPoints, toServerGroups } from "@/cfsm/nezha-bridge";
import type {
	LoginUserResponse,
	MetricPeriod,
	MetricType,
	MonitorResponse,
	ServerGroupResponse,
	ServerMetricsResponse,
	ServiceResponse,
	SettingResponse,
} from "@/types/nezha-api";

export type MonitorPeriod = "realtime" | MetricPeriod;

const HISTORY_HOURS: Record<MetricPeriod, number> = {
	"10m": 0.167,
	"30m": 0.5,
	"1h": 1,
	"6h": 6,
	"1d": 24,
	// CFSM 不接受 72 小时请求；96 小时是后端支持的最小相邻窗口。
	"3d": 96,
	"7d": 168,
};

const inFlightHistoryRequests = new Map<string, Promise<HistoryRow[]>>();

/**
 * 详情页的多个图表来自同一份 CFSM 历史响应。合并同一服务器、同一时间段的
 * 并发请求，避免首次切换 3/7 天时同时发出十余个相同的 D1 查询。
 */
function getSharedHistory(serverId: string, period: MetricPeriod) {
	const hours = HISTORY_HOURS[period];
	const key = `${serverId}:${hours}`;
	const existing = inFlightHistoryRequests.get(key);
	if (existing) return existing;

	const request = getHistory(serverId, hours);
	inFlightHistoryRequests.set(key, request);
	request.then(
		() => inFlightHistoryRequests.delete(key),
		() => inFlightHistoryRequests.delete(key),
	);
	return request;
}

function trimRowsForPeriod(rows: HistoryRow[], period: MetricPeriod) {
	if (period !== "3d") return rows;
	const startAt = Date.now() - 72 * 60 * 60 * 1000;
	return rows.filter((row) => Number(row.timestamp) >= startAt);
}

export const fetchServerGroup = async (): Promise<ServerGroupResponse> => {
	const { servers } = await getServers();
	return { success: true, data: toServerGroups(servers) };
};

export const fetchLoginUser = async (): Promise<LoginUserResponse> => {
	const config = await getConfig();
	return {
		success: true,
		data: config.authorization
			? { id: 1, username: "cfsm", password: "", created_at: "", updated_at: "" }
			: { id: 0, username: "", password: "", created_at: "", updated_at: "" },
	};
};

const LATENCY_ROUTES = [
	["ct", "电信"],
	["cu", "联通"],
	["cm", "移动"],
	// CFSM 的第四条探测线路字段固定为 bd；主题按当前站点约定展示为 BGP。
	["bd", "BGP"],
] as const;

function numberAt(point: object | undefined, key: string) {
	const value = point && (point as Record<string, unknown>)[key];
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * 原主题的 Network 页按“监控器”组织折线；CFSM 列表提供四线路的真实 ping/loss
 * 窗口。这里仅转换数据形状，图表、卡片和交互仍完全复用原主题组件。
 */
function toMonitorResponse(
	serverId: string,
	serverName: string,
	ping: CfsmLatencyPoint[],
	loss: CfsmLatencyPoint[],
): MonitorResponse {
	const lossByTimestamp = new Map(loss.map((point) => [Number(point.ts), point]));
	const data = LATENCY_ROUTES.flatMap(([key, monitor_name], index) => {
		// CFSM 以 false/null 表示该线路未启用，不能误画成 0ms 曲线。
		if (!ping.some((point) => typeof point[key] === "number")) return [];
		return [{
			monitor_id: index + 1,
			monitor_name,
			display_index: index + 1,
			server_id: serverId,
			server_name: serverName,
			created_at: ping.map((point) => Number(point.ts)).filter(Number.isFinite),
			avg_delay: ping.map((point) => numberAt(point, key) ?? 0),
			packet_loss: ping.map(
				(point) => numberAt(lossByTimestamp.get(Number(point.ts)), key) ?? 0,
			),
		}];
	});

	return { success: true, data };
}

/**
 * 实时延迟取 CFSM 当前服务器窗口；历史延迟必须读取 /api/history/all，
 * 不能再错误复用首页的实时窗口。
 */
export const fetchMonitor = async (
	serverId: string,
	period: MonitorPeriod = "realtime",
): Promise<MonitorResponse> => {
	const { servers } = await getServers();
	const server = servers.find((item) => item.id === serverId);
	if (!server) return { success: true, data: [] };

	if (period === "realtime") {
		return toMonitorResponse(
			server.id,
			server.name,
			Array.isArray(server.ping) ? server.ping : [],
			Array.isArray(server.loss) ? server.loss : [],
		);
	}

	const rows = trimRowsForPeriod(
		await getSharedHistory(serverId, period),
		period,
	);
	const ping = rows.map((row) => ({
		ts: Number(row.timestamp),
		ct: row.ping_ct,
		cu: row.ping_cu,
		cm: row.ping_cm,
		bd: row.ping_bd,
	}));
	const loss = rows.map((row) => ({
		ts: Number(row.timestamp),
		ct: row.loss_ct,
		cu: row.loss_cu,
		cm: row.loss_cm,
		bd: row.loss_bd,
	}));

	return toMonitorResponse(server.id, server.name, ping, loss);
};

export const fetchService = async (): Promise<ServiceResponse> => ({
	success: true,
	data: { services: {}, cycle_transfer_stats: {} },
});

export const fetchSetting = async (): Promise<SettingResponse> => {
	const config = await getConfig();
	return {
		success: true,
		data: {
			config: {
				debug: false,
				language: config.default_language === "en" ? "en-US" : "zh-CN",
				site_name: config.site_title,
				user_template: "",
				admin_template: "",
				custom_code: "",
			},
			version: config.version,
		},
	};
};

export const fetchServerMetrics = async (
	serverId: string,
	metric: MetricType,
	period: MetricPeriod = "1d",
): Promise<ServerMetricsResponse> => {
	const rows = trimRowsForPeriod(
		await getSharedHistory(serverId, period),
		period,
	);
	return {
		success: true,
		data: {
			server_id: serverId,
			server_name: "",
			metric,
			data_points: toMetricPoints(rows, metric),
		},
	};
};
