import { Moon, RefreshCw, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatBytes, formatRate } from "./adapter";
import { useCfsmData } from "./data-provider";
import type { CfsmConfig } from "./types";

export function Shell({ config, children }: { config: CfsmConfig; children: ReactNode }) {
	const { servers, connected, timedOut, resumeLive } = useCfsmData();
	const online = servers.filter((server) => server.online).length;
	const toggleTheme = () => {
		document.documentElement.classList.toggle("dark");
		localStorage.setItem(
			"cfsm-theme",
			document.documentElement.classList.contains("dark") ? "dark" : "light",
		);
	};

	return (
		<div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
			<header className="border-b border-stone-200/80 bg-white/80 backdrop-blur dark:border-stone-800 dark:bg-stone-950/80">
				<div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-8">
					<Link to="/" className="min-w-0">
						<p className="truncate text-base font-semibold tracking-tight">{config.site_title || "CF Server Monitor"}</p>
						<p className="mt-0.5 text-xs text-stone-500">nezha-dash-v2 · CFSM 主题</p>
					</Link>
					<div className="flex items-center gap-2 text-sm">
						<span className="hidden rounded-full border border-stone-200 px-3 py-1.5 sm:inline-flex dark:border-stone-700">
							<span className={`mr-2 size-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
							{connected ? `${online}/${servers.length} 在线` : "实时连接中"}
						</span>
						<a href="/admin#admin" className="rounded-full px-3 py-1.5 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800">
							管理
						</a>
						<button type="button" onClick={toggleTheme} className="rounded-full p-2 hover:bg-stone-100 dark:hover:bg-stone-800" aria-label="切换深浅色">
							<Sun className="size-4 dark:hidden" />
							<Moon className="hidden size-4 dark:block" />
						</button>
					</div>
				</div>
			</header>
			{timedOut && (
				<div className="mx-auto mt-4 flex max-w-6xl items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
					<span>实时连接已按站点设置超时关闭，当前数据仍可查看。</span>
					<button type="button" onClick={resumeLive} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-900 px-3 py-1.5 text-white dark:bg-amber-200 dark:text-amber-950">
						<RefreshCw className="size-3.5" /> 继续连接
					</button>
				</div>
			)}
			{children}
			<footer className="mx-auto mt-12 max-w-6xl border-t border-stone-200 px-4 py-6 text-center text-xs text-stone-500 dark:border-stone-800 md:px-8">
				<a href="https://github.com/huilang-me/CF-Server-Monitor/" target="_blank" rel="noreferrer" className="hover:text-stone-900 dark:hover:text-white">
					Powered by CF-Server-Monitor {config.version}
				</a>
				<span className="mx-2">·</span>
				<a href="https://github.com/hamster1963/nezha-dash-v2" target="_blank" rel="noreferrer" className="hover:text-stone-900 dark:hover:text-white">
					视觉基于 nezha-dash-v2
				</a>
			</footer>
		</div>
	);
}

export function Metric({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
	return (
		<div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
			<p className="text-xs text-stone-500">{label}</p>
			<p className="mt-1 truncate text-lg font-semibold tabular-nums">{value}</p>
			{subvalue && <p className="mt-1 truncate text-xs text-stone-500">{subvalue}</p>}
		</div>
	);
}

export function Summary({ total, online, upload, download, transfer }: { total: number; online: number; upload: number; download: number; transfer: number }) {
	return (
		<section className="grid grid-cols-2 gap-3 md:grid-cols-4">
			<Metric label="服务器" value={String(total)} subvalue={`${online} 在线`} />
			<Metric label="在线率" value={total ? `${((online / total) * 100).toFixed(0)}%` : "0%"} subvalue={`${total - online} 离线`} />
			<Metric label="总上传速率" value={formatRate(upload)} />
			<Metric label="总下载速率" value={formatRate(download)} subvalue={`累计 ${formatBytes(transfer)}`} />
		</section>
	);
}
