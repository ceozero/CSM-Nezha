export interface NezhaWebsocketResponse {
	now: number;
	online?: number;
	servers: NezhaServer[];
}

export interface NezhaServer {
	// CFSM 使用 UUID/字符串 ID；保留 Nezha 的对象外形，仅放宽 ID 类型。
	id: string;
	name: string;
	public_note: string;
	last_active: string;
	country_code: string;
	host: NezhaServerHost;
	state: NezhaServerStatus;
}

export interface NezhaServerHost {
	platform: string;
	platform_version: string;
	cpu: string[];
	gpu: string[];
	mem_total: number;
	disk_total: number;
	swap_total: number;
	arch: string;
	boot_time: number;
	version: string;
}

export interface NezhaServerStatus {
	cpu: number;
	mem_used: number;
	swap_used: number;
	disk_used: number;
	net_in_transfer: number;
	net_out_transfer: number;
	/** CFSM 当月下行、上行累计字节数。 */
	net_in_monthly_transfer: number;
	net_out_monthly_transfer: number;
	/** CFSM 流量上限使用 GiB 数值保存，0 表示未设置上限。 */
	traffic_limit: number;
	traffic_calc_type: "total" | "ul" | "dl" | "max";
	/** CFSM 月流量重置日；0 表示不自动重置。 */
	traffic_reset_day: number;
	net_in_speed: number;
	net_out_speed: number;
	uptime: number;
	load_1: number;
	load_5: number;
	load_15: number;
	tcp_conn_count: number;
	udp_conn_count: number;
	process_count: number;
	/** CFSM 实时磁盘 I/O 指标，旧探针未上报时各项为 0。 */
	disk_io: {
		read_bps: number;
		write_bps: number;
		read_iops: number;
		write_iops: number;
		await_ms: number;
		util: number;
	};
	/** CFSM 当前三网延迟；仅映射已启用且有有效采样的线路。 */
	network_latency: NezhaNetworkLatency;
	temperatures: temperature[];
	gpu: number[];
}

export interface NezhaNetworkProbe {
	delay: number;
	loss?: number;
}

export interface NezhaNetworkLatency {
	ct?: NezhaNetworkProbe;
	cu?: NezhaNetworkProbe;
	cm?: NezhaNetworkProbe;
	/** CFSM 的第四探测线路；主题中按用户习惯显示为 BGP。 */
	bd?: NezhaNetworkProbe;
}

interface temperature {
	Name: string;
	Temperature: number;
}

export interface ServerGroupResponse {
	success: boolean;
	data: ServerGroup[];
}

export interface ServerGroup {
	group: {
		id: number;
		created_at: string;
		updated_at: string;
		name: string;
	};
	servers: string[];
}

export interface LoginUserResponse {
	success: boolean;
	data: {
		id: number;
		username: string;
		password: string;
		created_at: string;
		updated_at: string;
	};
}

export interface MonitorResponse {
	success: boolean;
	data: NezhaMonitor[];
}

export type ServerMonitorChart = {
	[key: string]: {
		created_at: number;
		avg_delay: number;
		packet_loss?: number;
	}[];
};

export interface NezhaMonitor {
	monitor_id: number;
	monitor_name: string;
	display_index?: number;
	server_id: string;
	server_name: string;
	created_at: number[];
	avg_delay: number[];
	packet_loss?: number[];
}

export interface ServiceResponse {
	success: boolean;
	data: {
		services: {
			[key: string]: ServiceData;
		};
		cycle_transfer_stats: CycleTransferStats;
	};
}

export interface ServiceData {
	service_name: string;
	current_up: number;
	current_down: number;
	total_up: number;
	total_down: number;
	delay: number[];
	up: number[];
	down: number[];
}

export interface CycleTransferStats {
	[key: string]: CycleTransferData;
}

export interface CycleTransferData {
	name: string;
	from: string | { [key: string]: string };
	to: string | { [key: string]: string };
	max: number | { [key: string]: number };
	min: number | { [key: string]: number };
	server_name: {
		[key: string]: string;
	};
	transfer: {
		[key: string]: number;
	};
	next_update: {
		[key: string]: string;
	};
}

type SettingConfig = {
	debug: boolean;
	language: string;
	site_name: string;
	user_template: string;
	admin_template: string;
	custom_code: string;
};

export interface SettingResponse {
	success: boolean;
	data: {
		config: SettingConfig;
		version: string;
		tsdb_enabled?: boolean;
	};
}

export type MetricType =
	| "cpu"
	| "memory"
	| "swap"
	| "disk"
	| "net_in_speed"
	| "net_out_speed"
	| "net_in_transfer"
	| "net_out_transfer"
	| "load1"
	| "load5"
	| "load15"
	| "tcp_conn"
	| "udp_conn"
	| "process_count"
	| "temperature"
	| "uptime"
	| "gpu";

/**
 * CFSM 的历史接口支持的展示区间。3 天由 96 小时数据在前端裁切而成，
 * 因为后端没有 72 小时这个查询参数。
 */
export type MetricPeriod = "10m" | "30m" | "1h" | "6h" | "1d" | "3d" | "7d";

export interface MetricDataPoint {
	ts: number;
	value: number;
}

export interface DiskIoDataPoint {
	ts: number;
	readBps: number;
	writeBps: number;
	readIops: number;
	writeIops: number;
	awaitMs: number;
	util: number;
}

export interface ServerMetricsData {
	server_id: string;
	server_name: string;
	metric: string;
	data_points: MetricDataPoint[];
}

export interface ServerMetricsResponse {
	success: boolean;
	data: ServerMetricsData;
}
