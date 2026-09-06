import { MonitorCog } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { GetOsName, getOsIconSlug } from "@/lib/logo-class";

const SIMPLE_ICONS_CDN = "https://cdn.simpleicons.org";

/** 按 CFSM 返回的系统名称展示对应发行版图标，加载失败时保留通用系统图标。 */
export default function OperatingSystemIcon({
	platform,
	className,
}: {
	platform: string;
	className?: string;
}) {
	const [failed, setFailed] = useState(false);
	const osName = GetOsName(platform);

	if (failed) {
		return <MonitorCog aria-hidden="true" className={cn("size-3 text-rose-500", className)} />;
	}

	return (
		<img
			alt={`${osName} 系统图标`}
			className={cn("size-3 shrink-0", className)}
			height="12"
			onError={() => setFailed(true)}
			src={`${SIMPLE_ICONS_CDN}/${getOsIconSlug(platform)}`}
			width="12"
		/>
	);
}
