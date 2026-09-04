import { useEffect, useRef, useState } from "react";
import type { CfsmConfig } from "./types";

declare global {
	interface Window {
		turnstile?: {
			render: (
				container: HTMLElement,
				options: { sitekey: string; callback: (token: string) => void },
			) => string;
			reset: (widgetId?: string) => void;
		};
	}
}

function loadTurnstileScript() {
	return new Promise<void>((resolve, reject) => {
		if (window.turnstile) return resolve();
		const existing = document.querySelector<HTMLScriptElement>(
			'script[data-cfsm-turnstile="true"]',
		);
		if (existing) {
			existing.addEventListener("load", () => resolve(), { once: true });
			existing.addEventListener("error", () => reject(new Error("Turnstile 脚本加载失败")), {
				once: true,
			});
			return;
		}
		const script = document.createElement("script");
		script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
		script.async = true;
		script.defer = true;
		script.dataset.cfsmTurnstile = "true";
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Turnstile 脚本加载失败"));
		document.head.appendChild(script);
	});
}

export function TurnstileGate({
	config,
	onVerified,
}: {
	config: CfsmConfig;
	onVerified: (token: string) => Promise<void>;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [error, setError] = useState("");
	const [verifying, setVerifying] = useState(false);

	useEffect(() => {
		let disposed = false;
		void loadTurnstileScript()
			.then(() => {
				if (disposed || !containerRef.current || !window.turnstile) return;
				window.turnstile.render(containerRef.current, {
					sitekey: config.turnstile_site_key,
					callback: (token) => {
						setVerifying(true);
						setError("");
						void onVerified(token)
							.catch((reason: unknown) => {
								setError(reason instanceof Error ? reason.message : "验证失败，请重试");
							})
							.finally(() => setVerifying(false));
					},
				});
			})
			.catch((reason: unknown) => {
				if (!disposed) setError(reason instanceof Error ? reason.message : "验证组件无法加载");
			});
		return () => {
			disposed = true;
		};
	}, [config.turnstile_site_key, onVerified]);

	return (
		<main className="flex min-h-screen items-center justify-center bg-stone-50 p-6 dark:bg-stone-950">
			<section className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
				<p className="text-lg font-semibold">请先完成安全验证</p>
				<p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
					验证成功后将自动载入监控面板。
				</p>
				<div ref={containerRef} className="mt-6" />
				{verifying && <p className="mt-3 text-sm text-stone-500">正在验证…</p>}
				{error && <p className="mt-3 text-sm text-red-600">{error}</p>}
			</section>
		</main>
	);
}
