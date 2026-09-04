import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import type { CfsmConfig } from "@/cfsm/types";

const appMocks = vi.hoisted(() => ({
	getConfig: vi.fn(),
}));

vi.mock("../cfsm/api", () => ({
	getConfig: appMocks.getConfig,
}));

vi.mock("../cfsm/data-provider", () => ({
	CfsmDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../cfsm/layout", () => ({
	Shell: ({ config, children }: { config: CfsmConfig; children: React.ReactNode }) => (
		<div>
			<h1>{config.site_title}</h1>
			{children}
		</div>
	),
}));

vi.mock("../cfsm/dashboard-page", () => ({
	DashboardPage: () => <p>CFSM 首页</p>,
}));

vi.mock("../cfsm/server-detail-page", () => ({
	ServerDetailPage: () => <p>CFSM 详情页</p>,
}));

vi.mock("../cfsm/turnstile-gate", () => ({
	TurnstileGate: () => <p>Turnstile 验证页</p>,
}));

function config(overrides: Partial<CfsmConfig> = {}): CfsmConfig {
	return {
		version: "2.8.0",
		is_public: true,
		authorization: false,
		turnstile_enabled: false,
		turnstile_site_key: "",
		turnstile_verified: null,
		site_title: "CFSM 状态面板",
		frontend_ws_timeout_minutes: 0,
		long_history_points: 120,
		theme_options: {},
		...overrides,
	};
}

function renderApp(hash = "#/") {
	window.location.hash = hash;
	return render(<App />);
}

describe("CFSM 主题入口", () => {
	beforeEach(() => {
		appMocks.getConfig.mockReset();
		appMocks.getConfig.mockResolvedValue(config());
	});

	it("读取 CFSM 配置后渲染首页并应用站点标题", async () => {
		renderApp();

		expect(await screen.findByText("CFSM 首页")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "CFSM 状态面板" })).toBeInTheDocument();
		expect(document.title).toBe("CFSM 状态面板");
		expect(appMocks.getConfig).toHaveBeenCalledOnce();
	});

	it("配置请求尚未完成时显示连接状态", () => {
		appMocks.getConfig.mockImplementation(() => new Promise(() => undefined));
		renderApp();

		expect(screen.getByText("正在连接 CF-Server-Monitor…")).toBeInTheDocument();
	});

	it("配置读取失败时显示可重试错误", async () => {
		appMocks.getConfig.mockRejectedValue(new Error("配置不可用"));
		renderApp();

		expect(await screen.findByText(/无法连接 CF-Server-Monitor：配置不可用/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
	});

	it("使用 Hash 路由打开服务器详情", async () => {
		renderApp("#/server/node-1");

		expect(await screen.findByText("CFSM 详情页")).toBeInTheDocument();
	});

	it("开启 Turnstile 且未验证时先显示验证页", async () => {
		appMocks.getConfig.mockResolvedValue(config({ turnstile_enabled: true }));
		renderApp();

		expect(await screen.findByText("Turnstile 验证页")).toBeInTheDocument();
	});
});
