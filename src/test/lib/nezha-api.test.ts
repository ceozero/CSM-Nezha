import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	fetchLoginUser,
	fetchMonitor,
	fetchServerGroup,
	fetchServerMetrics,
	fetchService,
	fetchSetting,
} from "@/lib/nezha-api";

const apiMocks = vi.hoisted(() => ({
	getConfig: vi.fn(),
	getHistory: vi.fn(),
	getServers: vi.fn(),
}));

vi.mock("@/cfsm/api", () => apiMocks);

const config = {
	version: "2.8.0", is_public: true, authorization: true,
	turnstile_enabled: false, turnstile_site_key: "", turnstile_verified: null,
	site_title: "CFSM 监控", default_language: "en" as const,
	frontend_ws_timeout_minutes: 0, long_history_points: 120, theme_options: {},
};

const server = {
	id: "node-1", name: "节点一", server_group: "香港", ram_total: 1024,
	ram_used: 512, disk_total: 2048, disk_used: 256,
};

describe("Nezha 视图兼容 API", () => {
	beforeEach(() => {
		apiMocks.getConfig.mockReset();
		apiMocks.getHistory.mockReset();
		apiMocks.getServers.mockReset();
		apiMocks.getConfig.mockResolvedValue(config);
		apiMocks.getServers.mockResolvedValue({ servers: [server] });
		apiMocks.getHistory.mockResolvedValue([{ timestamp: 1000, cpu: 25, ram_used: 512, ram_total: 1024 }]);
	});

	it("将 CFSM 站点配置映射为原主题的设置模型", async () => {
		await expect(fetchSetting()).resolves.toMatchObject({
			success: true,
			data: { config: { language: "en-US", site_name: "CFSM 监控" }, version: "2.8.0" },
		});
	});

	it("从 CFSM 服务器列表生成原主题分组", async () => {
		await expect(fetchServerGroup()).resolves.toEqual({
			success: true,
			data: [{ group: { id: 1, created_at: "", updated_at: "", name: "香港" }, servers: ["node-1"] }],
		});
	});

	it("将认证状态和 CFSM 历史指标桥接给原组件", async () => {
		await expect(fetchLoginUser()).resolves.toMatchObject({ success: true, data: { id: 1, username: "cfsm" } });
		await expect(fetchServerMetrics("node-1", "memory", "7d")).resolves.toMatchObject({
			success: true,
			data: { server_id: "node-1", metric: "memory", data_points: [{ ts: 1000, value: 512 * 1024 * 1024 }] },
		});
		expect(apiMocks.getHistory).toHaveBeenCalledWith("node-1", 168);
	});

	it("合并同一服务器和时间段的并发历史请求", async () => {
		let resolveHistory: (rows: Array<{ timestamp: number; cpu: number }>) => void;
		apiMocks.getHistory.mockImplementation(
			() =>
				new Promise<Array<{ timestamp: number; cpu: number }>>((resolve) => {
					resolveHistory = resolve;
				}),
		);

		const cpuRequest = fetchServerMetrics("node-1", "cpu", "7d");
		const memoryRequest = fetchServerMetrics("node-1", "memory", "7d");
		expect(apiMocks.getHistory).toHaveBeenCalledTimes(1);
		resolveHistory!([{ timestamp: 1000, cpu: 25 }]);

		await expect(Promise.all([cpuRequest, memoryRequest])).resolves.toHaveLength(2);
	});

	it("将 CFSM 三网窗口桥接为原主题的网络图表数据", async () => {
		apiMocks.getServers.mockResolvedValue({
			servers: [{
				...server,
				ping: [{ ts: 1000, ct: 21, cu: 25, cm: 30, bd: 35 }],
				loss: [{ ts: 1000, ct: 0, cu: 1, cm: 0, bd: 2 }],
			}],
		});
		const monitor = await fetchMonitor("node-1", "realtime");
		expect(monitor.success).toBe(true);
		expect(monitor.data).toEqual(expect.arrayContaining([
			expect.objectContaining({ monitor_name: "电信", server_id: "node-1", avg_delay: [21], packet_loss: [0] }),
			expect.objectContaining({ monitor_name: "联通", avg_delay: [25], packet_loss: [1] }),
		]));
	});

	it("历史网络数据按所选时间段请求，3 天仅保留最近 72 小时", async () => {
		const now = Date.parse("2025-01-10T00:00:00.000Z");
		const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
		apiMocks.getHistory.mockResolvedValue([
			{ timestamp: now - 73 * 60 * 60 * 1000, ping_ct: 99, loss_ct: 0 },
			{ timestamp: now - 3 * 60 * 60 * 1000, ping_ct: 22, loss_ct: 1 },
		]);

		try {
			const monitor = await fetchMonitor("node-1", "3d");
			expect(apiMocks.getHistory).toHaveBeenCalledWith("node-1", 96);
			expect(monitor.data).toEqual(expect.arrayContaining([
				expect.objectContaining({
					monitor_name: "电信",
					avg_delay: [22],
					packet_loss: [1],
				}),
			]));
		} finally {
			nowSpy.mockRestore();
		}
	});

	it("3 天资源指标请求 96 小时窗口并裁切为最近 72 小时", async () => {
		const now = Date.parse("2025-01-10T00:00:00.000Z");
		const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
		apiMocks.getHistory.mockResolvedValue([
			{ timestamp: now - 73 * 60 * 60 * 1000, cpu: 99 },
			{ timestamp: now - 3 * 60 * 60 * 1000, cpu: 22 },
		]);

		try {
			await expect(fetchServerMetrics("node-1", "cpu", "3d")).resolves.toMatchObject({
				data: { data_points: [{ ts: now - 3 * 60 * 60 * 1000, value: 22 }] },
			});
			expect(apiMocks.getHistory).toHaveBeenCalledWith("node-1", 96);
		} finally {
			nowSpy.mockRestore();
		}
	});

	it("将 CFSM 未提供的服务监控降级为空数据而非伪造结果", async () => {
		await expect(fetchService()).resolves.toEqual({ success: true, data: { services: {}, cycle_transfer_stats: {} } });
	});
});
