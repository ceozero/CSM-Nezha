import { createContext } from "react";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";

export interface SiteDisplayConfig {
	showPrice: boolean;
	showExpire: boolean;
	showTraffic: boolean;
	showThreeNetDetails: boolean;
	displayMode?: string;
}

export const defaultSiteDisplayConfig: SiteDisplayConfig = {
	showPrice: true,
	showExpire: true,
	showTraffic: true,
	showThreeNetDetails: true,
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
