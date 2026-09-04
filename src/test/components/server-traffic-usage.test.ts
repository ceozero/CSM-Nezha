import { describe, expect, it } from "vitest";
import { monthlyTrafficUsage } from "@/components/ServerTrafficUsage";

describe("monthlyTrafficUsage", () => {
	it("follows the CFSM traffic calculation type", () => {
		expect(monthlyTrafficUsage(2, 3, "total")).toBe(5);
		expect(monthlyTrafficUsage(2, 3, "dl")).toBe(2);
		expect(monthlyTrafficUsage(2, 3, "ul")).toBe(3);
		expect(monthlyTrafficUsage(2, 3, "max")).toBe(3);
	});
});
