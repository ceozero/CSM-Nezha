/**
 * 根据 CFSM 采集的架构和 CPU 型号生成简短徽标。
 * 架构仅能区分 ARM/x86，AMD、Intel 必须以 CPU 型号为准。
 */
export function getCpuArchitectureBadge(
	arch: string | undefined,
	cpuInfo: string | string[] | undefined,
) {
	const normalizedArch = String(arch || "").toLowerCase();
	const normalizedCpu = (Array.isArray(cpuInfo) ? cpuInfo.join(" ") : String(cpuInfo || "")).toLowerCase();

	if (
		/(aarch64|arm64|armv[5-9]|\barm\b)/.test(normalizedArch) ||
		/\b(arm|ampere|graviton|neoverse)\b/.test(normalizedCpu)
	) {
		return "ARM64";
	}
	if (/\b(amd|epyc|ryzen|athlon|threadripper)\b/.test(normalizedCpu)) {
		return "AMD64";
	}
	if (/\b(intel|xeon)\b|core\s*(tm)?\s*i[3-9]/.test(normalizedCpu)) {
		return "Intel x86_64";
	}
	if (/(x86_64|amd64|\bx64\b|i[3-6]86)/.test(normalizedArch)) {
		return "x86_64";
	}

	return null;
}
