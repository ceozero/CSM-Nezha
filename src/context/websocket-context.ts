import { createContext } from "react";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";

/** 后端 2.8.5 Beta4 支持四条传统线路和四个自定义 Ping 节点。 */
export type LatencyRouteKey =
	| "ct"
	| "cu"
	| "cm"
	| "bd"
	| "node_1"
	| "node_2"
	| "node_3"
	| "node_4";

export type LatencyLabels = Record<LatencyRouteKey, string>;

export const defaultLatencyLabels: LatencyLabels = {
	ct: "电信",
	cu: "联通",
	cm: "移动",
	bd: "BGP",
	node_1: "Node 1",
	node_2: "Node 2",
	node_3: "Node 3",
	node_4: "Node 4",
};

export interface SiteDisplayConfig {
	showPrice: boolean;
	showExpire: boolean;
	showTraffic: boolean;
	showThreeNetDetails: boolean;
	displayMode?: string;
	latencyLabels: LatencyLabels;
}

export const defaultSiteDisplayConfig: SiteDisplayConfig = {
	showPrice: true,
	showExpire: true,
	showTraffic: true,
	showThreeNetDetails: true,
	latencyLabels: defaultLatencyLabels,
};

export interface WebSocketContextType {
	lastData: NezhaWebsocketResponse | null;
	connected: boolean;
	messageHistory: NezhaWebsocketResponse[];
	reconnect: () => void;
	needReconnect: boolean;
	setNeedReconnect: (needReconnect: boolean) => void;
	siteDisplayConfig: SiteDisplayConfig;
}

export const WebSocketContext = createContext<WebSocketContextType>({
	lastData: null,
	connected: false,
	messageHistory: [],
	reconnect: () => {},
	needReconnect: false,
	setNeedReconnect: () => {},
	siteDisplayConfig: defaultSiteDisplayConfig,
});
