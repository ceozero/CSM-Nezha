import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import type { CfsmConfig } from "@/cfsm/types";

const appMocks = vi.hoisted(() => ({ getConfig: vi.fn() }));

vi.mock("../cfsm/api", () => ({ getConfig: appMocks.getConfig }));
vi.mock("../components/ErrorBoundary", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../components/Header", () => ({ default: () => <header>原主题页头</header>, RefreshToast: () => null }));
vi.mock("../components/Footer", () => ({ default: () => <footer>Powered by CF-Server-Monitor</footer> }));
vi.mock("../components/DashCommand", () => ({ DashCommand: () => <div>原主题命令面板</div> }));
vi.mock("../hooks/use-background", () => ({ useBackground: () => ({ backgroundImage: undefined }) }));
vi.mock("../pages/Server", () => ({ default: () => <p>原主题首页</p> }));
vi.mock("../pages/ServerDetail", () => ({ default: () => <p>原主题详情页</p> }));
vi.mock("../pages/NotFound", () => ({ default: () => <p>原主题未找到页</p> }));

function config(overrides: Partial<CfsmConfig> = {}): CfsmConfig {
	return {
		version: "2.8.0", is_public: true, authorization: false,
		turnstile_enabled: false, turnstile_site_key: "", turnstile_verified: null,
		site_title: "CFSM 状态面板", frontend_ws_timeout_minutes: 0,
		long_history_points: 120, theme_options: {}, ...overrides,
	};
}

function renderApp(hash = "#/") {
	window.location.hash = hash;
	return render(<App />);
}

describe("CFSM 原主题入口", () => {
	beforeEach(() => {
		appMocks.getConfig.mockReset();
		appMocks.getConfig.mockResolvedValue(config());
	});

	it("读取 CFSM 配置后保留原主题首页组件树", async () => {
		renderApp();
		expect(await screen.findByText("原主题首页")).toBeInTheDocument();
		expect(screen.getByText("原主题页头")).toBeInTheDocument();
		expect(screen.getByText("原主题命令面板")).toBeInTheDocument();
		expect(screen.getByText("Powered by CF-Server-Monitor")).toBeInTheDocument();
		await waitFor(() => expect(document.title).toBe("CFSM 状态面板"));
	});

	it("配置请求尚未完成时显示连接状态", () => {
		appMocks.getConfig.mockImplementation(() => new Promise(() => undefined));
		renderApp();
		expect(screen.getByText("正在连接 CF-Server-Monitor…")).toBeInTheDocument();
	});

	it("配置读取失败时显示 CFSM 错误", async () => {
		appMocks.getConfig.mockRejectedValue(new Error("配置不可用"));
		renderApp();
		expect(await screen.findByText(/无法连接 CF-Server-Monitor：配置不可用/)).toBeInTheDocument();
	});

	it("使用 Hash 路由打开原主题详情页", async () => {
		renderApp("#/server/node-1");
		expect(await screen.findByText("原主题详情页")).toBeInTheDocument();
	});

	it("开启 Turnstile 且未验证时先显示验证页", async () => {
		appMocks.getConfig.mockResolvedValue(config({ turnstile_enabled: true }));
		renderApp();
		expect(await screen.findByText("请先完成安全验证")).toBeInTheDocument();
	});
});
