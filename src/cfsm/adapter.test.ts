import { describe, expect, it } from "vitest";
import { isOnline, mergeServer, percent, toDashboardServer } from "./adapter";
import type { CfsmServer } from "./types";

const server: CfsmServer = {
	id: "edge-hk-01",
	name: "HK Edge 01",
	server_group: "香港",
	tags: "prod, edge",
	cpu: 25,
	ram_total: 8192,
	ram_used: 2048,
	disk_total: 102400,
	disk_used: 51200,
	net_in_speed: 1024,
	net_out_speed: 2048,
	net_rx: 4096,
	net_tx: 8192,
	os: "Ubuntu 24.04",
	last_updated: 1_700_000_000_000,
	gpu_info: '[{"id":"0","name":"NVIDIA A10","info":42}]',
};

describe("CFSM 数据适配", () => {
	it("将 CFSM 服务器字段转换为主题视图模型", () => {
		const dashboard = toDashboardServer(server);
		expect(dashboard.id).toBe("edge-hk-01");
		expect(dashboard.tags).toEqual(["prod", "edge"]);
		expect(dashboard.ramUsed).toBe(2048);
		expect(dashboard.gpus).toEqual([{ id: "0", name: "NVIDIA A10", info: 42 }]);
	});

	it("实时增量合并不会丢失未推送字段", () => {
		const merged = mergeServer(server, { cpu: 61, net_in_speed: 333 });
		expect(merged.id).toBe(server.id);
		expect(merged.cpu).toBe(61);
		expect(merged.net_in_speed).toBe(333);
		expect(merged.disk_total).toBe(102400);
		expect(merged.gpu_info).toBe(server.gpu_info);
	});

	it("优先使用 API 在线状态，否则按五分钟时间窗口回退", () => {
		expect(isOnline({ ...server, is_online: false }, 1_700_000_000_100)).toBe(false);
		expect(isOnline(server, 1_700_000_120_000)).toBe(true);
		expect(isOnline(server, 1_700_000_301_000)).toBe(false);
		expect(percent(80, 100)).toBe(80);
	});
});
