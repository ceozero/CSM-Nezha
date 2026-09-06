import { cn, type PublicNoteData } from "@/lib/utils";

const architectureBadgeColor: Record<string, string> = {
	ARM64: "bg-emerald-600 text-emerald-100 dark:bg-emerald-800 dark:text-emerald-200",
	AMD64: "bg-rose-600 text-rose-100 dark:bg-rose-800 dark:text-rose-200",
	"Intel x86_64": "bg-sky-600 text-sky-100 dark:bg-sky-800 dark:text-sky-200",
	x86_64: "bg-stone-600 text-stone-100 dark:bg-stone-800 dark:text-stone-200",
};

export default function PlanInfo({
	parsedData,
	architectureBadge,
	showTraffic = true,
}: {
	parsedData?: PublicNoteData | null;
	architectureBadge?: string | null;
	showTraffic?: boolean;
}) {
	const planData = parsedData?.planDataMod;
	if (!planData && !architectureBadge) {
		return null;
	}

	const extraList =
		planData?.extra.split(",").length && planData.extra.split(",").length > 1
			? planData.extra.split(",")
			: planData?.extra.split(",")[0] === ""
				? []
				: planData?.extra
					? [planData.extra]
					: [];
	const networkRoutes = planData?.networkRoute
		? planData.networkRoute.split(",")
		: [];
	const badgeColor = architectureBadge
		? architectureBadgeColor[architectureBadge] || architectureBadgeColor.x86_64
		: "";

	return (
		<section className="flex gap-1 items-center flex-wrap mt-0.5">
			{architectureBadge && (
				<p
					className={cn(
						"text-[9px] w-fit rounded-[5px] px-[3px] py-[1.5px]",
						badgeColor,
					)}
				>
					{architectureBadge}
				</p>
			)}
			{planData?.bandwidth && (
				<p
					className={cn(
						"text-[9px] bg-blue-600 dark:bg-blue-800 text-blue-200 dark:text-blue-300  w-fit rounded-[5px] px-[3px] py-[1.5px]",
					)}
				>
					{planData?.bandwidth}
				</p>
			)}
			{showTraffic && planData?.trafficVol && (
				<p
					className={cn(
						"text-[9px] bg-green-600 text-green-200 dark:bg-green-800 dark:text-green-300  w-fit rounded-[5px] px-[3px] py-[1.5px]",
					)}
				>
					{planData?.trafficVol}
				</p>
			)}
			{planData?.IPv4 === "1" && (
				<p
					className={cn(
						"text-[9px] bg-purple-600 text-purple-200 dark:bg-purple-800 dark:text-purple-300  w-fit rounded-[5px] px-[3px] py-[1.5px]",
					)}
				>
					IPv4
				</p>
			)}
			{planData?.IPv6 === "1" && (
				<p
					className={cn(
						"text-[9px] bg-pink-600 text-pink-200 dark:bg-pink-800 dark:text-pink-300  w-fit rounded-[5px] px-[3px] py-[1.5px]",
					)}
				>
					IPv6
				</p>
			)}
			{planData?.networkRoute && (
				<p
					className={cn(
						"text-[9px] bg-blue-600 text-blue-200 dark:bg-blue-800 dark:text-blue-300  w-fit rounded-[5px] px-[3px] py-[1.5px]",
					)}
				>
					{networkRoutes.map((route, index) => {
						return route + (index === networkRoutes.length - 1 ? "" : "｜");
					})}
				</p>
			)}
			{extraList.map((extra, index) => {
				return (
					<p
						key={index}
						className={cn(
							"text-[9px] bg-stone-600 text-stone-200 dark:bg-stone-800 dark:text-stone-300  w-fit rounded-[5px] px-[3px] py-[1.5px]",
						)}
					>
						{extra}
					</p>
				);
			})}
		</section>
	);
}
