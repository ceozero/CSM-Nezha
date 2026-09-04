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
		});

		expect(parsePublicNote(server.public_note)?.planDataMod?.trafficVol).toBe(
			"9.77TB/月",
		);

		const smallerPlan = toNezhaServer({
			id: "edge-small-traffic-limit",
			name: "edge-small-traffic-limit",
			traffic_limit: "500",
		});
		expect(
			parsePublicNote(smallerPlan.public_note)?.planDataMod?.trafficVol,
		).toBe("500GB/月");
	});
});
