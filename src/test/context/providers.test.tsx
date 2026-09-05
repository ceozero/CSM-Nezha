import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandProvider } from "@/context/command-provider";
import { SortProvider } from "@/context/sort-provider";
import { StatusProvider } from "@/context/status-provider";
import { TooltipProvider } from "@/context/tooltip-provider";
import { WebSocketProvider } from "@/context/websocket-provider";
import { useCommand } from "@/hooks/use-command";
import { useSort } from "@/hooks/use-sort";
import { useStatus } from "@/hooks/use-status";
import { useTooltip } from "@/hooks/use-tooltip";
import { useWebSocketContext } from "@/hooks/use-websocket-context";

const cfsmMocks = vi.hoisted(() => ({
	getAdminToken: vi.fn(),
	getConfig: vi.fn(),
	getServers: vi.fn(),
}));

vi.mock("@/cfsm/api", () => cfsmMocks);

class FakeWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;
	static instances: FakeWebSocket[] = [];

	readonly url: string;
	readyState = FakeWebSocket.CONNECTING;
	onopen: ((event: Event) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onmessage: ((event: MessageEvent<string>) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	send = vi.fn();

	constructor(url: string) {
		this.url = url;
		FakeWebSocket.instances.push(this);
	}

	open() {
		this.readyState = FakeWebSocket.OPEN;
		this.onopen?.(new Event("open"));
	}

	message(data: string) {
		this.onmessage?.(new MessageEvent("message", { data }));
	}

	close() {
		this.readyState = FakeWebSocket.CLOSED;
		this.onclose?.(new CloseEvent("close"));
	}
}

function CommandProbe() {
	const { closeCommand, isOpen, openCommand, toggleCommand } = useCommand();

	return (
		<div>
			<p data-testid="command-state">{isOpen ? "open" : "closed"}</p>
			<button type="button" onClick={openCommand}>
				open
			</button>
			<button type="button" onClick={closeCommand}>
				close
			</button>
			<button type="button" onClick={toggleCommand}>
				toggle
			</button>
		</div>
	);
}

function SortProbe() {
	const { setSortOrder, setSortType, sortOrder, sortType } = useSort();

	return (
		<div>
			<p>{`${sortType}:${sortOrder}`}</p>
			<button type="button" onClick={() => setSortType("cpu")}>
				cpu
			</button>
			<button type="button" onClick={() => setSortOrder("asc")}>
				asc
			</button>
		</div>
	);
}

function StatusProbe() {
	const { setStatus, status } = useStatus();

	return (
		<div>
			<p data-testid="status-state">{status}</p>
			<button type="button" onClick={() => setStatus("online")}>
				online
			</button>
		</div>
	);
}

function TooltipProbe() {
	const { setTooltipData, tooltipData } = useTooltip();

	return (
		<div>
			<p>{tooltipData?.country ?? "empty"}</p>
			<button
				type="button"
				onClick={() =>
					setTooltipData({
						centroid: [10, 20],
						country: "China",
						count: 1,
						servers: [{ id: 1, name: "edge", status: true }],
					})
				}
			>
				show
			</button>
		</div>
	);
}

function WebSocketProbe() {
	const {
		connected,
		lastData,
		messageHistory,
		needReconnect,
		setNeedReconnect,
		siteDisplayConfig,
	} = useWebSocketContext();

	return (
		<div>
			<p>{connected ? "connected" : "disconnected"}</p>
			<p>{lastData?.servers[0]?.name ?? "none"}</p>
			<p data-testid="latest-ct-latency">
				{lastData?.servers[0]?.state.network_latency.ct?.delay ?? "none"}
			</p>
			<p data-testid="message-count">{messageHistory.length}</p>
			<p data-testid="display-config">
				{`${siteDisplayConfig.showPrice}:${siteDisplayConfig.showExpire}:${siteDisplayConfig.showTraffic}:${siteDisplayConfig.showThreeNetDetails}`}
			</p>
			<p data-testid="history-server-count">
				{messageHistory.reduce((total, item) => total + item.servers.length, 0)}
			</p>
			<p>{needReconnect ? "needs-reconnect" : "stable"}</p>
			<button type="button" onClick={() => setNeedReconnect(true)}>
				mark
			</button>
		</div>
	);
}

describe("state providers", () => {
	it("manages command palette open state", async () => {
		const user = userEvent.setup();
		render(
			<CommandProvider>
				<CommandProbe />
			</CommandProvider>,
		);

		expect(screen.getByTestId("command-state")).toHaveTextContent("closed");
		await user.click(screen.getByRole("button", { name: "open" }));
		expect(screen.getByTestId("command-state")).toHaveTextContent("open");
		await user.click(screen.getByRole("button", { name: "toggle" }));
		expect(screen.getByTestId("command-state")).toHaveTextContent("closed");
		await user.click(screen.getByRole("button", { name: "open" }));
		await user.click(screen.getByRole("button", { name: "close" }));
		expect(screen.getByTestId("command-state")).toHaveTextContent("closed");
	});

	it("uses forced sort globals when valid and still allows local updates", async () => {
		window.ForceSortType = "mem";
		window.ForceSortOrder = "asc";
		const user = userEvent.setup();
		render(
			<SortProvider>
				<SortProbe />
			</SortProvider>,
		);

		expect(screen.getByText("mem:asc")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "cpu" }));
		expect(screen.getByText("cpu:asc")).toBeInTheDocument();
	});

	it("falls back to default sort values for invalid forced globals", () => {
		window.ForceSortType = "invalid";
		window.ForceSortOrder = "up";

		render(
			<SortProvider>
				<SortProbe />
			</SortProvider>,
		);

		expect(screen.getByText("default:desc")).toBeInTheDocument();
	});

	it("manages server status filters", async () => {
		const user = userEvent.setup();
		render(
			<StatusProvider>
				<StatusProbe />
			</StatusProvider>,
		);

		expect(screen.getByTestId("status-state")).toHaveTextContent("all");
		await user.click(screen.getByRole("button", { name: "online" }));
		expect(screen.getByTestId("status-state")).toHaveTextContent("online");
	});

	it("stores map tooltip data", async () => {
		const user = userEvent.setup();
		render(
			<TooltipProvider>
				<TooltipProbe />
			</TooltipProvider>,
		);

		expect(screen.getByText("empty")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "show" }));
		expect(screen.getByText("China")).toBeInTheDocument();
	});
});

describe("context hooks", () => {
	it("throws helpful errors when strict hooks miss their providers", () => {
		expect(() => renderHook(() => useCommand())).toThrow(
			"useCommand must be used within a CommandProvider",
		);
		expect(() => renderHook(() => useSort())).toThrow(
			"useStatus must be used within a SortProvider",
		);
		expect(() => renderHook(() => useStatus())).toThrow(
			"useStatus must be used within a StatusProvider",
		);
		expect(() => renderHook(() => useTooltip())).toThrow(
			"useTooltip must be used within a TooltipProvider",
		);
	});
});

describe("WebSocketProvider", () => {
	beforeEach(() => {
		FakeWebSocket.instances = [];
		vi.stubGlobal("WebSocket", FakeWebSocket);
		cfsmMocks.getConfig.mockReset();
		cfsmMocks.getAdminToken.mockReset();
		cfsmMocks.getServers.mockReset();
		cfsmMocks.getAdminToken.mockReturnValue("");
		cfsmMocks.getConfig.mockResolvedValue({ frontend_ws_timeout_minutes: 0 });
		cfsmMocks.getServers.mockResolvedValue({
			servers: [{
				id: "node-1",
				name: "初始节点",
				ram_total: 1024,
				disk_total: 1024,
				last_updated: Date.now(),
			}],
		});
	});

	function renderWebSocketProvider(children: ReactNode) {
		return render(<WebSocketProvider>{children}</WebSocketProvider>);
	}

	function websocketPayload(serverName: string, pingCt?: number) {
		return JSON.stringify({
			type: "batchUpdate",
			updates: [{
				serverId: "node-1",
				samples: [{ ts: Date.parse("2025-01-01T00:00:20.000Z"), data: { name: serverName, cpu: 50, ...(pingCt === undefined ? {} : { ping_ct: pingCt, loss_ct: 0 }) } }],
			}],
		});
	}

	it("连接 CFSM WebSocket、订阅初始服务器并记录增量快照", async () => {
		renderWebSocketProvider(<WebSocketProbe />);
		await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		const socket = FakeWebSocket.instances[0];
		expect(socket.url).toBe("wss://localhost/api/ws?subscribe=all");

		act(() => {
			socket.open();
		});
		expect(screen.getByText("connected")).toBeInTheDocument();
		expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: "subscribe", scope: "all", ids: ["node-1"] }));

		act(() => {
			socket.message(websocketPayload("first"));
			socket.message(websocketPayload("second"));
		});

		expect(screen.getByText("second")).toBeInTheDocument();
		expect(screen.getByTestId("message-count")).toHaveTextContent("3");
	});

	it("将 JWT 带入私有站点 WebSocket，并应用后台显示开关", async () => {
		cfsmMocks.getAdminToken.mockReturnValue("private-jwt");
		cfsmMocks.getServers.mockResolvedValue({
			servers: [{
				id: "private-node",
				name: "私有节点",
				ram_total: 1024,
				disk_total: 1024,
				last_updated: Date.now(),
			}],
			sysConfig: {
				show_price: "false",
				show_expire: "0",
				show_tf: false,
				show_three_net_details: "1",
			},
		});

		renderWebSocketProvider(<WebSocketProbe />);

		await vi.waitFor(() =>
			expect(screen.getByTestId("display-config")).toHaveTextContent(
				"false:false:false:true",
			),
		);
		await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		expect(FakeWebSocket.instances[0].url).toBe(
			"wss://localhost/api/ws?subscribe=all&token=private-jwt",
		);
	});

	it("merges latest three-network values from CFSM WebSocket updates", async () => {
		renderWebSocketProvider(<WebSocketProbe />);
		await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		const socket = FakeWebSocket.instances[0];

		act(() => {
			socket.open();
			socket.message(websocketPayload("latency-update", 184));
		});

		expect(screen.getByTestId("latest-ct-latency")).toHaveTextContent("184");
	});

	it("忽略损坏或非 batchUpdate 推送，同时保留上一次快照", async () => {
		renderWebSocketProvider(<WebSocketProbe />);
		await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		const socket = FakeWebSocket.instances[0];

		act(() => {
			socket.open();
			socket.message("not-json");
			socket.message(JSON.stringify({ type: "hello" }));
		});

		expect(screen.getByText("初始节点")).toBeInTheDocument();
		expect(screen.getByTestId("message-count")).toHaveTextContent("1");
	});

	it("最多保留 60 个由 CFSM 增量合成的实时快照", async () => {
		renderWebSocketProvider(<WebSocketProbe />);
		await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		const socket = FakeWebSocket.instances[0];

		act(() => {
			socket.open();
			for (let index = 0; index < 61; index += 1) {
				socket.message(websocketPayload(`message-${index}`));
			}
		});

		expect(screen.getByText("message-60")).toBeInTheDocument();
		expect(screen.getByTestId("message-count")).toHaveTextContent("60");
	});

	it("切换标签页时保持现有 WebSocket，不触发重新连接或数据刷新", async () => {
		renderWebSocketProvider(<WebSocketProbe />);
		await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
		const socket = FakeWebSocket.instances[0];

		act(() => socket.open());
		Object.defineProperty(document, "hidden", {
			configurable: true,
			value: true,
		});
		act(() => document.dispatchEvent(new Event("visibilitychange")));
		Object.defineProperty(document, "hidden", {
			configurable: true,
			value: false,
		});
		act(() => document.dispatchEvent(new Event("visibilitychange")));

		expect(FakeWebSocket.instances).toHaveLength(1);
		expect(screen.getByText("connected")).toBeInTheDocument();
		expect(cfsmMocks.getServers).toHaveBeenCalledTimes(1);
	});

	it("exposes manual reconnect state separately from socket state", async () => {
		const user = userEvent.setup();
		renderWebSocketProvider(<WebSocketProbe />);

		expect(screen.getByText("stable")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "mark" }));
		expect(screen.getByText("needs-reconnect")).toBeInTheDocument();
	});
});
