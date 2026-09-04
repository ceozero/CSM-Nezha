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
});
