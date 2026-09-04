import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HashRouter, Route, Routes } from "react-router-dom";
import { DashCommand } from "./components/DashCommand";
import ErrorBoundary from "./components/ErrorBoundary";
import Footer from "./components/Footer";
import Header, { RefreshToast } from "./components/Header";
import { useBackground } from "./hooks/use-background";
import { useTheme } from "./hooks/use-theme";
import { cn } from "./lib/utils";
import ErrorPage from "./pages/ErrorPage";
import Servers from "./pages/Server";
import { getConfig } from "./cfsm/api";
import { TurnstileGate } from "./cfsm/turnstile-gate";
import type { CfsmConfig } from "./cfsm/types";

const NotFound = lazy(() => import("./pages/NotFound"));
const ServerDetail = lazy(() => import("./pages/ServerDetail"));

function NezhaDashShell() {
	const { backgroundImage } = useBackground();
	const customMobileBackgroundImage =
		window.CustomMobileBackgroundImage !== ""
			? window.CustomMobileBackgroundImage
			: undefined;
	return (
		<ErrorBoundary>
			{backgroundImage && (
				<div
					className={cn(
						"fixed inset-0 z-0 min-h-lvh bg-cover bg-center bg-no-repeat dark:brightness-75",
						{ "hidden sm:block": customMobileBackgroundImage },
					)}
					style={{ backgroundImage: `url(${backgroundImage})` }}
				/>
			)}
			{customMobileBackgroundImage && (
				<div
					className="fixed inset-0 z-0 min-h-lvh bg-cover bg-center bg-no-repeat dark:brightness-75 sm:hidden"
					style={{ backgroundImage: `url(${customMobileBackgroundImage})` }}
				/>
			)}
			<div className={cn("flex min-h-screen w-full flex-col", { "bg-background": !backgroundImage })}>
				<main className="z-20 flex min-h-[calc(100vh-calc(var(--spacing)*16))] flex-1 flex-col gap-4 p-4 md:p-10 md:pt-8">
					<RefreshToast />
					<Header />
					<DashCommand />
					<Routes>
						<Route path="/" element={<Servers />} />
						<Route path="/server/:id" element={<Suspense fallback={null}><ServerDetail /></Suspense>} />
						<Route path="/error" element={<ErrorPage />} />
						<Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
					</Routes>
					<Footer />
				</main>
			</div>
		</ErrorBoundary>
	);
}

function Bootstrap() {
	const { i18n } = useTranslation();
	const { setTheme } = useTheme();
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
		document.title = config.site_title || "CF-Server-Monitor";
		if (!localStorage.getItem("language") && config.default_language === "en") {
			void i18n.changeLanguage("en-US");
		}
	}, [config, i18n]);
	useEffect(() => {
		// 保留原主题的外观覆盖开关；CFSM 注入自定义脚本时仍可使用。
		// @ts-expect-error ForceTheme 是可选的主题运行时全局变量。
		const forceTheme = window.ForceTheme as string | undefined;
		if (forceTheme === "dark" || forceTheme === "light") setTheme(forceTheme);
	}, [setTheme]);

	if (error) {
		return <main className="flex min-h-screen items-center justify-center p-6 text-sm">无法连接 CF-Server-Monitor：{error}</main>;
	}
	if (!config) return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">正在连接 CF-Server-Monitor…</main>;
	if (config.turnstile_enabled && !config.turnstile_verified) return <TurnstileGate config={config} onVerified={loadConfig} />;
	return <NezhaDashShell />;
}

export default function App() {
	return <HashRouter><Bootstrap /></HashRouter>;
}
