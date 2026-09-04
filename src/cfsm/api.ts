import type { CfsmConfig, CfsmServer, HistoryRow, ServersResponse } from "./types";

const TURNSTILE_STORAGE_KEY = "cfsm_turnstile_verified";
const ADMIN_TOKEN_STORAGE_KEY = "jwt_token";

export function getTurnstileCredential() {
	return sessionStorage.getItem(TURNSTILE_STORAGE_KEY) || "";
}

export function setTurnstileCredential(value: string | null) {
	if (value) sessionStorage.setItem(TURNSTILE_STORAGE_KEY, value);
}

export function getAdminToken() {
	try {
		return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";
	} catch {
		// 某些隐私模式会拒绝存储访问；此时仍可访问公开接口。
		return "";
	}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers);
	const verified = getTurnstileCredential();
	if (verified) headers.set("X-Turnstile-Verified", verified);
	// CFSM 管理端登录后的 JWT 存在 localStorage.jwt_token。主题与站点同源时
	// 必须转发它，否则后端会拒绝超过 24 小时的历史查询。
	const token = getAdminToken();
	if (token && !headers.has("Authorization")) {
		headers.set("Authorization", `Bearer ${token}`);
	}
	const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
	const body: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		const message =
			body && typeof body === "object" && "error" in body
				? String(body.error)
				: `请求失败（${response.status}）`;
		throw new Error(message);
	}
	return body as T;
}

/**
 * 长历史仅向已登录管理员开放。后台登出时会删除 jwt_token，因此可作为
 * 时间范围控件的即时登录态；真正的权限仍由后端的 JWT 校验兜底。
 */
export function hasAdminToken() {
	return getAdminToken().length > 0;
}

export async function getConfig(turnstileToken?: string) {
	const headers = new Headers();
	if (turnstileToken) headers.set("X-Turnstile-Token", turnstileToken);
	const config = await request<CfsmConfig>("/api/config", { headers });
	setTurnstileCredential(config.turnstile_verified);
	return config;
}

export const getServers = () => request<ServersResponse>("/api/servers");

export const getServer = (id: string) =>
	request<CfsmServer>(`/api/server?id=${encodeURIComponent(id)}`);

export const getHistory = (id: string, hours: number) =>
	request<HistoryRow[]>(
		`/api/history/all?id=${encodeURIComponent(id)}&hours=${encodeURIComponent(hours)}`,
	);
