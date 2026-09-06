import { describe, expect, it } from "vitest";
import { getCpuArchitectureBadge } from "@/lib/cpu-architecture";

describe("getCpuArchitectureBadge", () => {
	it("优先按 ARM 架构识别", () => {
		expect(getCpuArchitectureBadge("aarch64", "Ampere Altra")).toBe("ARM64");
	});

	it("按 CPU 型号区分 AMD 和 Intel", () => {
		expect(getCpuArchitectureBadge("x86_64", "AMD EPYC 7B13")).toBe("AMD64");
		expect(getCpuArchitectureBadge("x86_64", "Intel Xeon Gold")).toBe("Intel x86_64");
	});

	it("型号缺失时仅显示通用 x86 架构", () => {
		expect(getCpuArchitectureBadge("amd64", "")).toBe("x86_64");
		expect(getCpuArchitectureBadge("", "")).toBeNull();
	});
});
