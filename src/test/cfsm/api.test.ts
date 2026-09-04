import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHistory } from "@/cfsm/api";

describe("CFSM HTTP 请求", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("转发管理后台保存的 JWT，以读取超过一天的历史数据", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify([]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		localStorage.setItem("jwt_token", "admin-jwt");

		await expect(getHistory("server-1", 168)).resolves.toEqual([]);

		const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(new Headers(options.headers).get("Authorization")).toBe(
			"Bearer admin-jwt",
		);
	});

	it("未登录时不伪造认证请求头", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify([]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await getHistory("server-1", 24);

		const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(new Headers(options.headers).has("Authorization")).toBe(false);
	});
});
