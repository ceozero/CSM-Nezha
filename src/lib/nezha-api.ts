/**
 * 兼容层：保留 nezha-dash-v2 组件调用形状，实际请求全部转至 CFSM 公开 API。
 * 文件名暂不改动，避免视觉组件的大面积重写。
 */
import { getConfig, getHistory, getServers } from "@/cfsm/api";
import type { CfsmLatencyPoint } from "@/cfsm/types";
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

export type MonitorPeriod = "1d" | "7d" | "30d";

const HISTORY_HOURS: Record<MetricPeriod, number> = {
	"1d": 24,
	"7d": 168,
	"30d": 168,
};

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
	["bd", "百度"],
] as const;

function numberAt(point: CfsmLatencyPoint | undefined, key: keyof CfsmLatencyPoint) {
	const value = point?.[key];
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * 原主题的 Network 页按“监控器”组织折线；CFSM 列表提供四线路的真实 ping/loss
 * 窗口。这里仅转换数据形状，图表、卡片和交互仍完全复用原主题组件。
 */
export const fetchMonitor = async (serverId: string, _period?: MonitorPeriod): Promise<MonitorResponse> => {
	const { servers } = await getServers();
	const server = servers.find((item) => item.id === serverId);
	if (!server) return { success: true, data: [] };

	const ping = Array.isArray(server.ping) ? server.ping : [];
	const lossByTimestamp = new Map(
		(Array.isArray(server.loss) ? server.loss : []).map((point) => [Number(point.ts), point]),
	);
	const data = LATENCY_ROUTES.flatMap(([key, monitor_name], index) => {
		// CFSM 以 false/null 表示该线路未启用，不能误画成 0ms 曲线。
		if (!ping.some((point) => typeof point[key] === "number")) return [];
		return [{
			monitor_id: index + 1,
			monitor_name,
			display_index: index + 1,
			server_id: server.id,
			server_name: server.name,
			created_at: ping.map((point) => Number(point.ts)).filter(Number.isFinite),
			avg_delay: ping.map((point) => numberAt(point, key)),
			packet_loss: ping.map((point) => numberAt(lossByTimestamp.get(Number(point.ts)), key)),
		}];
	});

	return { success: true, data };
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
	const rows = await getHistory(serverId, HISTORY_HOURS[period]);
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
