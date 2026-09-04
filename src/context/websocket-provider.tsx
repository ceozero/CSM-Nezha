import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { mergeServer } from "@/cfsm/adapter";
import { getConfig, getServers } from "@/cfsm/api";
import { toNezhaServer } from "@/cfsm/nezha-bridge";
import type { CfsmServer } from "@/cfsm/types";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";
import {
	WebSocketContext,
	type WebSocketContextType,
} from "./websocket-context";

interface WebSocketProviderProps {
	children: React.ReactNode;
}

// 短暂切换标签页时，保留最近的快照并只恢复 WebSocket；
// 停留较久后才重新请求完整列表，避免返回页面出现不必要的闪动。
const BACKGROUND_REVALIDATE_MS = 30_000;

function webSocketUrl() {
	const url = new URL("/api/ws", window.location.origin);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	url.searchParams.set("subscribe", "all");
	return url.toString();
}

/**
 * 用 CFSM 的 REST + batchUpdate WebSocket 驱动原 nezha-dash-v2 组件。
 * 组件仍接收 Nezha 的视图模型，因此其样式、动画和布局保持不变。
 */
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
	const [lastData, setLastData] = useState<NezhaWebsocketResponse | null>(null);
	const [messageHistory, setMessageHistory] = useState<NezhaWebsocketResponse[]>([]);
	const [connected, setConnected] = useState(false);
	const [needReconnect, setNeedReconnect] = useState(false);
	const rawServersRef = useRef<CfsmServer[]>([]);
	const socketRef = useRef<WebSocket | null>(null);
	const retryRef = useRef<number | null>(null);
	const timeoutRef = useRef<number | null>(null);
	const generationRef = useRef(0);
	const activeRef = useRef(true);
	const timeoutMinutesRef = useRef(0);
	const hiddenAtRef = useRef<number | null>(null);

	const publish = useCallback((rawServers: CfsmServer[], now = Date.now()) => {
		const snapshot: NezhaWebsocketResponse = {
			now,
			online: rawServers.filter((server) => {
				if (typeof server.is_online === "boolean") return server.is_online;
				const updated = Number(server.last_updated || server.timestamp || 0);
				return updated > 0 && now - updated <= 300_000;
			}).length,
			servers: rawServers.map(toNezhaServer),
		};
		setLastData(snapshot);
		setMessageHistory((previous) => [snapshot, ...previous].slice(0, 60));
	}, []);

	const close = useCallback(() => {
		generationRef.current += 1;
		if (retryRef.current !== null) window.clearTimeout(retryRef.current);
		if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
		retryRef.current = null;
		timeoutRef.current = null;
		const socket = socketRef.current;
		if (socket) {
			socket.onopen = null;
			socket.onclose = null;
			socket.onmessage = null;
			socket.onerror = null;
			if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
		}
		socketRef.current = null;
		setConnected(false);
	}, []);

	const refresh = useCallback(async () => {
		const [serversResponse, config] = await Promise.all([getServers(), getConfig()]);
		rawServersRef.current = serversResponse.servers;
		timeoutMinutesRef.current = Number(config.frontend_ws_timeout_minutes) || 0;
		publish(rawServersRef.current);
	}, [publish]);

	const connect = useCallback(() => {
		if (!activeRef.current || document.hidden || rawServersRef.current.length === 0) return;
		close();
		const generation = ++generationRef.current;
		const socket = new WebSocket(webSocketUrl());
		socketRef.current = socket;
		socket.onopen = () => {
			if (generationRef.current !== generation) return;
			setConnected(true);
			socket.send(JSON.stringify({ type: "subscribe", scope: "all", ids: rawServersRef.current.map((server) => server.id) }));
			if (timeoutMinutesRef.current > 0) {
				timeoutRef.current = window.setTimeout(() => {
					if (generationRef.current !== generation) return;
					activeRef.current = false;
					setNeedReconnect(true);
					socket.close();
				}, timeoutMinutesRef.current * 60_000);
			}
		};
		socket.onmessage = ({ data }) => {
			if (generationRef.current !== generation) return;
			try {
				const message: unknown = JSON.parse(String(data));
				if (!message || typeof message !== "object" || !("type" in message) || message.type !== "batchUpdate") return;
				const updates = "updates" in message && Array.isArray(message.updates) ? message.updates : [];
				let changed = false;
				let timestamp = Date.now();
				const next = rawServersRef.current.map((server) => ({ ...server }));
				for (const update of updates) {
					if (!update || typeof update !== "object" || !("serverId" in update)) continue;
					const index = next.findIndex((server) => server.id === String(update.serverId));
					if (index < 0) continue;
					const samples = "samples" in update && Array.isArray(update.samples) ? update.samples : [];
					for (const sample of samples) {
						if (!sample || typeof sample !== "object") continue;
						const data = ("data" in sample && sample.data) || ("payload" in sample && sample.payload) || ("metrics" in sample && sample.metrics);
						if (!data || typeof data !== "object") continue;
						timestamp = "ts" in sample ? Number(sample.ts) || timestamp : timestamp;
						next[index] = mergeServer(next[index], { ...(data as Partial<CfsmServer>), timestamp });
						changed = true;
					}
				}
				if (changed) {
					rawServersRef.current = next;
					publish(next, timestamp);
				}
			} catch {
				// 忽略损坏消息，保留上一帧数据。
			}
		};
		socket.onclose = () => {
			if (generationRef.current !== generation) return;
			setConnected(false);
			socketRef.current = null;
			if (activeRef.current && !document.hidden) {
				retryRef.current = window.setTimeout(() => connect(), 3000);
			}
		};
	}, [close, publish]);

	const reconnect = useCallback(() => {
		activeRef.current = true;
		setNeedReconnect(false);
		void refresh().then(connect).catch(() => setConnected(false));
	}, [connect, refresh]);

	useEffect(() => {
		activeRef.current = true;
		void refresh().then(connect).catch(() => setConnected(false));
		return close;
	}, [close, connect, refresh]);

	useEffect(() => {
		const onVisibility = () => {
			if (document.hidden) {
				hiddenAtRef.current = Date.now();
				close();
				return;
			}

			const hiddenAt = hiddenAtRef.current;
			hiddenAtRef.current = null;
			if (!activeRef.current) return;

			if (
				rawServersRef.current.length === 0 ||
				(hiddenAt !== null && Date.now() - hiddenAt >= BACKGROUND_REVALIDATE_MS)
			) {
				void refresh().then(connect).catch(() => setConnected(false));
				return;
			}

			connect();
		};
		document.addEventListener("visibilitychange", onVisibility);
		return () => document.removeEventListener("visibilitychange", onVisibility);
	}, [close, connect, refresh]);

	const value: WebSocketContextType = {
		lastData,
		connected,
		messageHistory,
		reconnect,
		needReconnect,
		setNeedReconnect,
	};

	return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};
