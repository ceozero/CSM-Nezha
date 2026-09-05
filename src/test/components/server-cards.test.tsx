import { fireEvent, screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ServerCard from "@/components/ServerCard";
import ServerCardInline from "@/components/ServerCardInline";
import { createServer } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";

const publicNote = JSON.stringify({
	billingDataMod: {
		startDate: "2025-01-01T00:00:00.000Z",
		endDate: "2025-01-31T00:00:00.000Z",
		autoRenewal: "0",
		cycle: "monthly",
		amount: "10",
	},
	planDataMod: {
		bandwidth: "1Gbps",
		trafficVol: "2TB",
		trafficType: "monthly",
		IPv4: "1",
		IPv6: "1",
		networkRoute: "CN2,CMI",
		extra: "Premium",
	},
});

function LocationProbe() {
	const location = useLocation();
	return <p>{location.pathname}</p>;
}

describe("ServerCard", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2025-01-15T00:00:00.000Z"));
		Object.assign(window, {
			ForceUseSvgFlag: true,
			FixedTopServerName: true,
			ShowNetTransfer: true,
		});
	});

	it("uses the full original layout when CFSM does not inject theme switches", () => {
		Reflect.deleteProperty(window, "FixedTopServerName");
		Reflect.deleteProperty(window, "ShowNetTransfer");
		const server = createServer({
			name: "edge-default-layout",
			public_note: publicNote,
			host: { platform: "Debian" },
		});

		renderWithProviders(
			<ServerCard
				now={Date.parse("2025-01-01T00:00:20.000Z")}
				serverInfo={server}
			/>,
		);

		expect(screen.getByText("serverCard.system")).toBeInTheDocument();
		expect(screen.getAllByText("↑ 2.00 GiB")).toHaveLength(2);
		expect(screen.getAllByText("↓ 1.00 GiB")).toHaveLength(2);
	});

	it("allows a theme author to explicitly use the compact layout", () => {
		Object.assign(window, {
			FixedTopServerName: false,
			ShowNetTransfer: false,
		});
		const server = createServer({ name: "edge-compact-layout" });

		renderWithProviders(
			<ServerCard
				now={Date.parse("2025-01-01T00:00:20.000Z")}
				serverInfo={server}
			/>,
		);

		expect(screen.queryByText("serverCard.system")).not.toBeInTheDocument();
		expect(screen.queryByText("↑ 2.00 GiB")).not.toBeInTheDocument();
	});

	it("renders online server metrics, billing, plan data, and navigates on click", async () => {
		const server = createServer({
			id: 7,
			name: "edge-online",
			public_note: publicNote,
			host: { platform: "Windows Server" },
		});

		renderWithProviders(
			<>
				<ServerCard
					now={Date.parse("2025-01-01T00:00:20.000Z")}
					serverInfo={server}
				/>
				<LocationProbe />
			</>,
		);

		expect(screen.getByText("edge-online")).toBeInTheDocument();
		expect(screen.getByText("Windows")).toBeInTheDocument();
		expect(screen.getByText("12.00%")).toBeInTheDocument();
		expect(screen.getAllByText("25.00%")).toHaveLength(2);
		expect(screen.getAllByText("↑ 2.00 GiB")).toHaveLength(2);
		expect(screen.getAllByText("↓ 1.00 GiB")).toHaveLength(2);
		expect(screen.getByText("1Gbps")).toBeInTheDocument();
		expect(
			screen.getAllByText(/billingInfo.remaining: 16/).length,
		).toBeGreaterThan(0);

		Object.defineProperty(window, "scrollY", {
			configurable: true,
			value: 432,
		});
		fireEvent.click(screen.getByText("edge-online"));

		expect(sessionStorage.getItem("fromMainPage")).toBe("true");
		expect(sessionStorage.getItem("scrollPosition")).toBe("432");
		expect(screen.getByText("/server/7")).toBeInTheDocument();
	});

	it("shows the newest available network latency with loss severity colors", () => {
		const server = createServer({
			name: "edge-latency",
			state: {
				network_latency: {
					ct: { delay: 125, loss: 10 },
					cu: { delay: 127, loss: 3 },
					cm: { delay: 84, loss: 1 },
					bd: { delay: 51, loss: 0 },
				},
			},
		});

		renderWithProviders(
			<ServerCard now={Date.parse("2025-01-01T00:00:20.000Z")} serverInfo={server} />,
		);

		const latency = screen.getByLabelText("最新线路延迟");
		expect(latency).toHaveTextContent("电信125ms丢 10%");
		expect(latency).toHaveTextContent("联通127ms丢 3%");
		expect(latency).toHaveTextContent("移动84ms丢 1%");
		expect(latency).toHaveTextContent("BGP51ms丢 0%");
		expect(screen.getByText("丢 10%")).toHaveClass("font-bold", "text-rose-500");
		expect(screen.getByText("丢 3%")).toHaveClass("text-orange-500");
		expect(screen.getByText("丢 1%")).toHaveClass("text-amber-500");
		expect(screen.getByText("丢 0%")).toHaveClass("text-emerald-600");
	});

	it("uses the left transfer box for the monthly quota and the right one for total traffic", () => {
		const server = createServer({
			name: "edge-monthly-traffic",
			state: {
				net_in_transfer: 1024 ** 3,
				net_out_transfer: 2 * 1024 ** 3,
				net_in_monthly_transfer: 3 * 1024 ** 3,
				net_out_monthly_transfer: 2 * 1024 ** 3,
				traffic_limit: 10,
				traffic_calc_type: "total",
			},
		});

		renderWithProviders(
			<ServerCard now={Date.parse("2025-01-01T00:00:20.000Z")} serverInfo={server} />,
		);

		const monthlyTraffic = screen.getByLabelText("serverCard.monthlyTraffic");
		expect(monthlyTraffic).toHaveTextContent("5.00 GiB / 10.00 GiB");
		expect(monthlyTraffic).toHaveTextContent("50.0%");
		expect(screen.getByText("serverCard.total")).toBeInTheDocument();
		expect(screen.getByText("↑ 2.00 GiB")).toBeInTheDocument();
		expect(screen.getByText("↓ 1.00 GiB")).toBeInTheDocument();
	});

	it("keeps monthly upload and download visible when no quota is configured", () => {
		const server = createServer({
			name: "edge-unlimited-monthly-traffic",
			state: {
				net_in_monthly_transfer: 3 * 1024 ** 3,
				net_out_monthly_transfer: 2 * 1024 ** 3,
				traffic_limit: 0,
			},
		});

		renderWithProviders(
			<ServerCard now={Date.parse("2025-01-01T00:00:20.000Z")} serverInfo={server} />,
		);

		const monthlyTraffic = screen.getByLabelText("serverCard.monthlyTraffic");
		expect(monthlyTraffic).toHaveTextContent("↑ 2.00 GiB");
		expect(monthlyTraffic).toHaveTextContent("↓ 3.00 GiB");
		expect(
			screen.queryByLabelText("serverCard.monthlyTrafficProgress"),
		).not.toBeInTheDocument();
	});

	it("renders a compact offline card without live metric blocks", () => {
		const server = createServer({
			id: 8,
			name: "edge-offline",
			public_note: publicNote,
			last_active: "2024-12-31T23:00:00.000Z",
		});

		renderWithProviders(
			<ServerCard
				now={Date.parse("2025-01-01T00:00:20.000Z")}
				serverInfo={server}
			/>,
		);

		expect(screen.getByText("edge-offline")).toBeInTheDocument();
		expect(screen.getByText("1Gbps")).toBeInTheDocument();
		expect(screen.queryByText("CPU")).not.toBeInTheDocument();
	});
});

describe("ServerCardInline", () => {
	beforeEach(() => {
		Object.assign(window, { ForceUseSvgFlag: true });
	});

	it("renders online inline server detail columns", () => {
		const server = createServer({
			id: 9,
			name: "edge-inline",
			public_note: publicNote,
			state: { uptime: 2 * 86_400 },
		});

		renderWithProviders(
			<ServerCardInline
				now={Date.parse("2025-01-01T00:00:20.000Z")}
				serverInfo={server}
			/>,
		);

		expect(screen.getByText("edge-inline")).toBeInTheDocument();
		expect(screen.getByText("serverCard.system")).toBeInTheDocument();
		expect(screen.getByText("2 serverCard.days")).toBeInTheDocument();
		expect(screen.getByText("2.00 GiB")).toBeInTheDocument();
		expect(screen.getByText("1.00 GiB")).toBeInTheDocument();
	});

	it("renders offline inline server cards with saved plan data", () => {
		const server = createServer({
			id: 10,
			name: "edge-inline-offline",
			public_note: publicNote,
			last_active: "2024-12-31T23:00:00.000Z",
		});

		renderWithProviders(
			<ServerCardInline
				now={Date.parse("2025-01-01T00:00:20.000Z")}
				serverInfo={server}
			/>,
		);

		expect(screen.getByText("edge-inline-offline")).toBeInTheDocument();
		expect(screen.getByText("1Gbps")).toBeInTheDocument();
		expect(screen.queryByText("serverCard.system")).not.toBeInTheDocument();
	});
});
