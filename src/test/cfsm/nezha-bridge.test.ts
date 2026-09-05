import { describe, expect, it } from "vitest";
import { toNezhaServer } from "@/cfsm/nezha-bridge";
import { parsePublicNote } from "@/lib/utils";

describe("toNezhaServer", () => {
	it("keeps CFSM IP and tag badges without inventing billing data", () => {
		const server = toNezhaServer({
			id: "edge-plan-badges",
			name: "edge-plan-badges",
			ip_v4: "1",
			ip_v6: "1",
			tags: "CN2,CMI",
		});
		const note = parsePublicNote(server.public_note);

		expect(note?.planDataMod).toMatchObject({
			IPv4: "1",
			IPv6: "1",
			networkRoute: "CN2,CMI",
			trafficVol: "",
		});
		expect(note?.billingDataMod?.amount).toBe("");
	});

	it("formats numeric CFSM traffic limits using GB or TB monthly plan badges", () => {
		const server = toNezhaServer({
			id: "edge-traffic-limit",
			name: "edge-traffic-limit",
			traffic_limit: "10000.0",
			traffic_calc_type: "max",
			reset_day: 15,
			net_rx_monthly: 2 * 1024 ** 3,
			net_tx_monthly: 3 * 1024 ** 3,
		});

		expect(parsePublicNote(server.public_note)?.planDataMod?.trafficVol).toBe(
			"9.77TB/月",
		);
		expect(server.state).toMatchObject({
			net_in_monthly_transfer: 2 * 1024 ** 3,
			net_out_monthly_transfer: 3 * 1024 ** 3,
			traffic_limit: 10000,
			traffic_calc_type: "max",
			traffic_reset_day: 15,
		});

		const smallerPlan = toNezhaServer({
			id: "edge-small-traffic-limit",
			name: "edge-small-traffic-limit",
			traffic_limit: "500",
		});
		expect(
			parsePublicNote(smallerPlan.public_note)?.planDataMod?.trafficVol,
		).toBe("500GB/月");
	});

	it("preserves each server's CFSM currency symbol for plan prices", () => {
		const server = toNezhaServer({
			id: "edge-currency",
			name: "edge-currency",
			price: "100.00",
			billing_cycle: "year",
			currency: "¥",
		});

		expect(parsePublicNote(server.public_note)?.billingDataMod).toMatchObject({
			amount: "100.00",
			currency: "¥",
		});
	});

	it("maps the latest CFSM network samples and hides disabled routes", () => {
		const server = toNezhaServer({
			id: "edge-latency",
			name: "edge-latency",
			ping_ct: 125,
			ping_cu: 127,
			ping_cm: 84,
			ping_bd: 51,
			loss_ct: 16,
			loss_cu: 0,
			loss_cm: 0,
			loss_bd: 0,
		});

		expect(server.state.network_latency).toEqual({
			ct: { delay: 125, loss: 16 },
			cu: { delay: 127, loss: 0 },
			cm: { delay: 84, loss: 0 },
			bd: { delay: 51, loss: 0 },
		});
	});
});
