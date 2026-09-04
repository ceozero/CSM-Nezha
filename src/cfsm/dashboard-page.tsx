import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatBytes, formatRate, percent } from "./adapter";
import { useCfsmData } from "./data-provider";
import { Summary } from "./layout";
import type { DashboardServer } from "./types";

function UsageBar({ value, color = "bg-sky-500" }: { value: number; color?: string }) {
	return <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800"><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} /></div>;
}

function ServerCard({ server }: { server: DashboardServer }) {
	const cpu = percent(server.cpu, 100);
	const memory = percent(server.ramUsed, server.ramTotal);
	const disk = percent(server.diskUsed, server.diskTotal);
	return (
		<Link to={`/server/${encodeURIComponent(server.id)}`} className="group rounded-3xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${server.online ? "bg-emerald-500" : "bg-rose-500"}`} /><p className="truncate font-semibold">{server.name}</p></div>
					<p className="mt-1 truncate text-xs text-stone-500">{[server.group, server.region, server.os].filter(Boolean).join(" · ")}</p>
				</div>
				<p className="shrink-0 text-xs text-stone-500">{server.online ? "在线" : "离线"}</p>
			</div>
			<div className="mt-5 grid grid-cols-3 gap-3 text-xs">
				<div><p className="text-stone-500">CPU</p><p className="mt-1 font-medium tabular-nums">{cpu.toFixed(1)}%</p><UsageBar value={cpu} /></div>
				<div><p className="text-stone-500">内存</p><p className="mt-1 font-medium tabular-nums">{memory.toFixed(1)}%</p><UsageBar value={memory} color="bg-violet-500" /></div>
				<div><p className="text-stone-500">磁盘</p><p className="mt-1 font-medium tabular-nums">{disk.toFixed(1)}%</p><UsageBar value={disk} color="bg-amber-500" /></div>
			</div>
			<div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4 text-xs text-stone-500 dark:border-stone-800"><span>↑ {formatRate(server.netOutSpeed)}</span><span>↓ {formatRate(server.netInSpeed)}</span><span>流量 {formatBytes(server.netTx + server.netRx)}</span></div>
		</Link>
	);
}

export function DashboardPage() {
	const { servers, loading, error } = useCfsmData();
	const [query, setQuery] = useState("");
	const [group, setGroup] = useState("全部");
	const [status, setStatus] = useState<"all" | "online" | "offline">("all");
	const groups = useMemo(() => ["全部", ...new Set(servers.map((server) => server.group).filter(Boolean))], [servers]);
	const filtered = useMemo(() => servers.filter((server) => {
		const matchesQuery = `${server.name} ${server.group} ${server.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase());
		const matchesGroup = group === "全部" || server.group === group;
		const matchesStatus = status === "all" || (status === "online" ? server.online : !server.online);
		return matchesQuery && matchesGroup && matchesStatus;
	}), [group, query, servers, status]);
	const online = servers.filter((server) => server.online).length;
	const upload = servers.reduce((sum, server) => sum + server.netOutSpeed, 0);
	const download = servers.reduce((sum, server) => sum + server.netInSpeed, 0);
	const transfer = servers.reduce((sum, server) => sum + server.netTx + server.netRx, 0);

	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
			<div className="mb-8"><p className="text-sm font-medium text-sky-600 dark:text-sky-400">服务器状态</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">一览你的基础设施</h1><p className="mt-2 text-sm text-stone-500">实时数据由 CF-Server-Monitor 提供。</p></div>
			<Summary total={servers.length} online={online} upload={upload} download={download} transfer={transfer} />
			<div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div className="flex gap-2 overflow-x-auto pb-1">{groups.map((item) => <button type="button" key={item} onClick={() => setGroup(item)} className={`shrink-0 rounded-full px-4 py-2 text-sm ${group === item ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900" : "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-300"}`}>{item}</button>)}</div>
				<div className="flex items-center gap-2"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-stone-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索服务器或标签" className="h-9 rounded-full border border-stone-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-sky-500 dark:border-stone-700 dark:bg-stone-900" /></div><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-9 rounded-full border border-stone-200 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"><option value="all">全部</option><option value="online">在线</option><option value="offline">离线</option></select></div>
			</div>
			{loading && <p className="py-20 text-center text-sm text-stone-500">正在加载服务器…</p>}
			{error && <p className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">加载失败：{error.message}</p>}
			{!loading && !error && <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">{filtered.map((server) => <ServerCard key={server.id} server={server} />)}</section>}
			{!loading && !error && filtered.length === 0 && <p className="py-20 text-center text-sm text-stone-500">没有符合条件的服务器。</p>}
		</main>
	);
}
