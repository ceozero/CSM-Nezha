export interface DiskIoMetrics {
	read_bps?: number;
	write_bps?: number;
	read_iops?: number;
	write_iops?: number;
	await_ms?: number;
	util?: number;
}

/** CFSM 三网/百度线路的真实延迟或丢包采样点。 */
export interface CfsmLatencyPoint {
	ts: number;
	ct?: number | false;
	cu?: number | false;
	cm?: number | false;
	bd?: number | false;
}

export interface CfsmServer {
	id: string;
	name: string;
	server_group?: string;
	tags?: string;
	cpu?: number;
	load_avg?: string;
	net_in_speed?: number;
	net_out_speed?: number;
	net_rx?: number;
	net_tx?: number;
	net_rx_monthly?: number;
	net_tx_monthly?: number;
	processes?: number;
	tcp_conn?: number;
	udp_conn?: number;
	ram_total?: number;
	ram_used?: number;
	swap_total?: number;
	swap_used?: number;
	disk_total?: number;
	disk_used?: number;
	disk?: DiskIoMetrics;
	cpu_cores?: number;
	cpu_info?: string;
	gpu_info?: Array<{ id: string; name: string; info: number | null }> | string;
	arch?: string;
	os?: string;
	kernel_version?: string;
	region?: string;
	boot_time?: string;
	last_updated?: number;
	timestamp?: number;
	is_online?: boolean;
	agent_version?: string;
	/** 仅在后台开启三网详情时由 /api/servers 返回。 */
	ping?: CfsmLatencyPoint[];
	loss?: CfsmLatencyPoint[];
	[key: string]: unknown;
}

export interface HistoryRow extends Partial<CfsmServer> {
	timestamp: number;
	/** 历史接口返回的四线路延迟与丢包数据。false 表示该线路未启用。 */
	ping_ct?: number | false;
	ping_cu?: number | false;
	ping_cm?: number | false;
	ping_bd?: number | false;
	loss_ct?: number | false;
	loss_cu?: number | false;
	loss_cm?: number | false;
	loss_bd?: number | false;
	disk_read_bps?: number;
	disk_write_bps?: number;
	disk_read_iops?: number;
	disk_write_iops?: number;
	disk_await_ms?: number;
	disk_util?: number;
}

export interface CfsmConfig {
	version: string;
	is_public: boolean;
	authorization: boolean;
	turnstile_enabled: boolean;
	turnstile_site_key: string;
	turnstile_verified: string | null;
	site_title: string;
	preferred_theme?: "auto" | "dark" | "light";
	default_language?: "auto" | "zh" | "en";
	frontend_ws_timeout_minutes: number;
	long_history_points: number;
	theme_options: Record<string, unknown>;
}

export interface ServersResponse {
	servers: CfsmServer[];
	stats?: {
		total: number;
		online: number;
		offline: number;
		globalSpeedIn: number;
		globalSpeedOut: number;
		globalNetTx: number;
		globalNetRx: number;
	};
}

export interface DashboardServer {
	id: string;
	name: string;
	group: string;
	tags: string[];
	online: boolean;
	cpu: number;
	ramTotal: number;
	ramUsed: number;
	swapTotal: number;
	swapUsed: number;
	diskTotal: number;
	diskUsed: number;
	netInSpeed: number;
	netOutSpeed: number;
	netRx: number;
	netTx: number;
	processes: number;
	tcpConnections: number;
	udpConnections: number;
	os: string;
	kernel: string;
	arch: string;
	cpuInfo: string;
	gpus: Array<{ id: string; name: string; info: number | null }>;
	region: string;
	bootTime: number;
	lastUpdated: number;
	raw: CfsmServer;
}

export interface RealtimePoint {
	timestamp: number;
	cpu: number;
	ramUsed: number;
	ramTotal: number;
	diskUsed: number;
	diskTotal: number;
	netInSpeed: number;
	netOutSpeed: number;
}
