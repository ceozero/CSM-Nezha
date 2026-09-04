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

	it("将 CFSM 三网窗口桥接为原主题的网络图表数据", async () => {
		apiMocks.getServers.mockResolvedValue({
			servers: [{
				...server,
				ping: [{ ts: 1000, ct: 21, cu: 25, cm: 30, bd: 35 }],
				loss: [{ ts: 1000, ct: 0, cu: 1, cm: 0, bd: 2 }],
			}],
		});
		const monitor = await fetchMonitor("node-1", "7d");
		expect(monitor.success).toBe(true);
		expect(monitor.data).toEqual(expect.arrayContaining([
			expect.objectContaining({ monitor_name: "电信", server_id: "node-1", avg_delay: [21], packet_loss: [0] }),
			expect.objectContaining({ monitor_name: "联通", avg_delay: [25], packet_loss: [1] }),
		]));
	});

	it("将 CFSM 未提供的服务监控降级为空数据而非伪造结果", async () => {
		await expect(fetchService()).resolves.toEqual({ success: true, data: { services: {}, cycle_transfer_stats: {} } });
	});
});
