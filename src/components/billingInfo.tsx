import { useTranslation } from "react-i18next";
import {
	cn,
	getDaysBetweenDatesWithAutoRenewal,
	type PublicNoteData,
} from "@/lib/utils";

import RemainPercentBar from "./RemainPercentBar";

export default function BillingInfo({
	parsedData,
	showPrice = true,
	showExpire = true,
}: {
	parsedData: PublicNoteData;
	showPrice?: boolean;
	showExpire?: boolean;
}) {
	const { t } = useTranslation();
	if (!parsedData?.billingDataMod) {
		return null;
	}

	const amount = parsedData.billingDataMod.amount.trim();
	const isFree = amount !== "" && Number(amount) === 0;
	const isUsageBased = amount === "-1";
	// CFSM 在每台服务器的 currency 字段返回货币符号；旧接口缺失时兼容美元。
	const currency = String(parsedData.billingDataMod.currency || "").trim() || "$";
	const displayAmount = amount.startsWith(currency) ? amount : `${currency}${amount}`;
	const hasExpiryDate = Boolean(parsedData.billingDataMod.endDate);
	// 免费套餐未配置到期日时视为永久；配置了到期日则仍显示实际剩余天数。
	let isNeverExpire = isFree && !hasExpiryDate;
	let daysLeftObject = {
		days: 0,
		cycleLabel: "",
		remainingPercentage: 0,
	};
	if (parsedData?.billingDataMod?.endDate) {
		if (parsedData.billingDataMod.endDate.startsWith("0000-00-00")) {
			isNeverExpire = true;
		} else {
			try {
				daysLeftObject = getDaysBetweenDatesWithAutoRenewal(
					parsedData.billingDataMod,
				);
			} catch (error) {
				console.error(error);
				return (
					<div className={cn("text-[10px] text-muted-foreground text-red-600")}>
						{t("billingInfo.remaining")}: {t("billingInfo.error")}
					</div>
				);
			}
		}
	}

	const priceInfo = showPrice
		? amount && !isFree && !isUsageBased ? (
			<p className={cn("text-[10px] text-muted-foreground ")}>
				{t("billingInfo.price")}: {displayAmount}/{parsedData.billingDataMod.cycle}
			</p>
		) : isFree ? (
			<p className={cn("text-[10px] text-green-600 ")}>{t("billingInfo.free")}</p>
		) : isUsageBased ? (
			<p className={cn("text-[10px] text-pink-600 ")}>
				{t("billingInfo.usage-baseed")}
			</p>
		) : null
		: null;

	return daysLeftObject.days >= 0 ? (
		<>
			{priceInfo}
			{showExpire && (hasExpiryDate || isFree) && (
				<div className={cn("text-[10px] text-muted-foreground")}>
					{t("billingInfo.remaining")}:{" "}
					{isNeverExpire
						? t("billingInfo.indefinite")
						: `${daysLeftObject.days} ${t("billingInfo.days")}`}
				</div>
			)}
			{showExpire && hasExpiryDate && !isNeverExpire && (
				<RemainPercentBar
					className="mt-0.5"
					value={daysLeftObject.remainingPercentage * 100}
				/>
			)}
		</>
	) : (
		<>
			{priceInfo}
			{showExpire && <p className={cn("text-[10px] text-muted-foreground text-red-600")}>
				{t("billingInfo.expired")}: {daysLeftObject.days * -1}{" "}
				{t("billingInfo.days")}
			</p>}
		</>
	);
}
