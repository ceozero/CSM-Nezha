import { useCallback, useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { getConfig } from "./cfsm/api";
import { CfsmDataProvider } from "./cfsm/data-provider";
import { DashboardPage } from "./cfsm/dashboard-page";
import { Shell } from "./cfsm/layout";
import { ServerDetailPage } from "./cfsm/server-detail-page";
import { TurnstileGate } from "./cfsm/turnstile-gate";
import type { CfsmConfig } from "./cfsm/types";

function Bootstrap() {
	const [config, setConfig] = useState<CfsmConfig | null>(null);
	const [error, setError] = useState("");
	const loadConfig = useCallback(async (token?: string) => {
		try {
			setError("");
			setConfig(await getConfig(token));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "无法读取站点配置");
		}
	}, []);

	useEffect(() => { void loadConfig(); }, [loadConfig]);
	useEffect(() => {
		if (!config) return;
		document.title = config.site_title || "CF Server Monitor";
		if (localStorage.getItem("cfsm-theme")) return;
		if (config.preferred_theme === "dark" || config.preferred_theme === "light") {
			document.documentElement.classList.toggle("dark", config.preferred_theme === "dark");
		}
	}, [config]);
	if (error) return <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6 dark:bg-stone-950"><section className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-sm text-rose-700 dark:border-rose-900 dark:bg-stone-900 dark:text-rose-300">无法连接 CF-Server-Monitor：{error}<button type="button" onClick={() => void loadConfig()} className="mt-4 block rounded-full bg-rose-700 px-4 py-2 text-white">重试</button></section></main>;
	if (!config) return <main className="flex min-h-screen items-center justify-center bg-stone-50 text-sm text-stone-500 dark:bg-stone-950">正在连接 CF-Server-Monitor…</main>;
	if (config.turnstile_enabled && !config.turnstile_verified) return <TurnstileGate config={config} onVerified={loadConfig} />;
	return <CfsmDataProvider config={config}><Shell config={config}><Routes><Route path="/" element={<DashboardPage />} /><Route path="/server/:id" element={<ServerDetailPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></Shell></CfsmDataProvider>;
}

export default function App() {
	return <HashRouter><Bootstrap /></HashRouter>;
}
