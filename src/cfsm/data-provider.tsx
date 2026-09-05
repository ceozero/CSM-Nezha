import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useLocation } from "react-router-dom";
import { mergeServer, toDashboardServer, toRealtimePoint } from "./adapter";
import { getAdminToken, getServer, getServers } from "./api";
import type { CfsmConfig, CfsmServer, DashboardServer, RealtimePoint } from "./types";

type DataState = {
	servers: DashboardServer[];
	realtime: Record<string, RealtimePoint[]>;
	loading: boolean;
	error: Error | null;
	connected: boolean;
	timedOut: boolean;
};

type CfsmDataContextValue = DataState & {
	reload: () => Promise<void>;
	resumeLive: () => void;
};

const CfsmDataContext = createContext<CfsmDataContextValue | null>(null);

const initialState: DataState = {
	servers: [],
	realtime: {},
	loading: true,
	error: null,
	connected: false,
	timedOut: false,
};

function getRouteServerId(pathname: string) {
	const match = pathname.match(/^\/server\/([^/]+)$/);
	return match ? decodeURIComponent(match[1]) : "";
}

function buildWebSocketUrl(subscribe: string) {
	const url = new URL("/api/ws", window.location.origin);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	url.searchParams.set("subscribe", subscribe);
	const token = getAdminToken();
	if (token) url.searchParams.set("token", token);
	return url;
}

export function CfsmDataProvider({
	config,
	children,
}: {
	config: CfsmConfig;
	children: ReactNode;
}) {
	const location = useLocation();
	const routeServerId = getRouteServerId(location.pathname);
	const [state, setState] = useState<DataState>(initialState);
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectRef = useRef<number | null>(null);
	const timeoutRef = useRef<number | null>(null);
	const connectionGenerationRef = useRef(0);
	const shouldReconnectRef = useRef(true);
	const currentIdsRef = useRef<string[]>([]);

	const closeSocket = useCallback(() => {
		// 每次主动断开都使旧连接的回调失效，避免路由切换后旧订阅重新连上。
		connectionGenerationRef.current += 1;
		if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
		if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
		reconnectRef.current = null;
		timeoutRef.current = null;
		const ws = wsRef.current;
		if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
			ws.onopen = null;
			ws.onmessage = null;
			ws.onclose = null;
			ws.onerror = null;
			ws.close();
		}
		wsRef.current = null;
		setState((current) => ({ ...current, connected: false }));
	}, []);

	const reload = useCallback(async () => {
		setState((current) => ({ ...current, loading: true, error: null }));
		try {
			const rawServers = routeServerId
				? [await getServer(routeServerId)]
				: (await getServers()).servers;
			currentIdsRef.current = rawServers.map((server) => server.id);
			setState((current) => ({
				...current,
				servers: rawServers.map(toDashboardServer),
				loading: false,
				error: null,
			}));
		} catch (error) {
			setState((current) => ({
				...current,
				loading: false,
				error: error instanceof Error ? error : new Error(String(error)),
			}));
		}
	}, [routeServerId]);

	const connect = useCallback(() => {
		if (!shouldReconnectRef.current || document.hidden || currentIdsRef.current.length === 0) return;
		closeSocket();
		const generation = ++connectionGenerationRef.current;
		const subscribe = routeServerId || "all";
		const ws = new WebSocket(buildWebSocketUrl(subscribe));
		wsRef.current = ws;
		ws.onopen = () => {
			if (connectionGenerationRef.current !== generation) return;
			setState((current) => ({ ...current, connected: true }));
			if (!routeServerId) {
				ws.send(
					JSON.stringify({ type: "subscribe", scope: "all", ids: currentIdsRef.current }),
				);
			}
			if (config.frontend_ws_timeout_minutes > 0) {
				timeoutRef.current = window.setTimeout(
					() => {
						shouldReconnectRef.current = false;
						setState((current) => ({ ...current, timedOut: true, connected: false }));
						ws.close();
					},
					config.frontend_ws_timeout_minutes * 60 * 1000,
				);
			}
		};
		ws.onmessage = (event) => {
			if (connectionGenerationRef.current !== generation) return;
			try {
				const message: unknown = JSON.parse(String(event.data));
				if (!message || typeof message !== "object" || !("type" in message) || message.type !== "batchUpdate") return;
				const updates = "updates" in message && Array.isArray(message.updates) ? message.updates : [];
				setState((current) => {
					const nextServers = [...current.servers];
					const nextRealtime = { ...current.realtime };
					for (const update of updates) {
						if (!update || typeof update !== "object" || !("serverId" in update)) continue;
						const id = String(update.serverId);
						const samples = "samples" in update && Array.isArray(update.samples) ? update.samples : [];
						for (const sample of samples) {
							if (!sample || typeof sample !== "object") continue;
							const source =
								("data" in sample && sample.data) ||
								("payload" in sample && sample.payload) ||
								("metrics" in sample && sample.metrics);
							if (!source || typeof source !== "object") continue;
							const index = nextServers.findIndex((server) => server.id === id);
							if (index < 0) continue;
							const raw = mergeServer(nextServers[index].raw, source as Partial<CfsmServer>);
							const server = toDashboardServer(raw);
							nextServers[index] = server;
							const timestamp = "ts" in sample ? Number(sample.ts) || Date.now() : Date.now();
							nextRealtime[id] = [...(nextRealtime[id] || []), toRealtimePoint(server, timestamp)].slice(-60);
						}
					}
					return { ...current, servers: nextServers, realtime: nextRealtime };
				});
			} catch {
				// 非法推送不影响现有状态。
			}
		};
		ws.onclose = () => {
			if (connectionGenerationRef.current !== generation) return;
			if (wsRef.current === ws) wsRef.current = null;
			setState((current) => ({ ...current, connected: false }));
			if (shouldReconnectRef.current && !document.hidden) {
				reconnectRef.current = window.setTimeout(() => {
					if (connectionGenerationRef.current === generation) connect();
				}, 3000);
			}
		};
	}, [closeSocket, config.frontend_ws_timeout_minutes, routeServerId]);

	useEffect(() => {
		shouldReconnectRef.current = true;
		setState((current) => ({ ...current, timedOut: false }));
		void reload();
		return closeSocket;
	}, [closeSocket, reload]);

	useEffect(() => {
		if (!state.loading && !state.error && state.servers.length > 0) connect();
	}, [connect, state.error, state.loading, state.servers.length]);

	useEffect(() => {
		const onVisibilityChange = () => {
			if (document.hidden) {
				closeSocket();
				return;
			}
			if (shouldReconnectRef.current) {
				void reload().then(connect);
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => document.removeEventListener("visibilitychange", onVisibilityChange);
	}, [closeSocket, connect, reload]);

	const resumeLive = useCallback(() => {
		shouldReconnectRef.current = true;
		setState((current) => ({ ...current, timedOut: false }));
		void reload().then(connect);
	}, [connect, reload]);

	const value = useMemo<CfsmDataContextValue>(
		() => ({ ...state, reload, resumeLive }),
		[reload, resumeLive, state],
	);

	return <CfsmDataContext.Provider value={value}>{children}</CfsmDataContext.Provider>;
}

export function useCfsmData() {
	const value = useContext(CfsmDataContext);
	if (!value) throw new Error("useCfsmData 必须在 CfsmDataProvider 内使用");
	return value;
}
