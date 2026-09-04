import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import { ThemeColorManager } from "./components/ThemeColorManager";
import { ThemeProvider } from "./components/ThemeProvider";
import { CommandProvider } from "./context/command-provider";
import { SortProvider } from "./context/sort-provider";
import { StatusProvider } from "./context/status-provider";
import { TooltipProvider } from "./context/tooltip-provider";
import { WebSocketProvider } from "./context/websocket-provider";
import "./i18n";
import "./index.css";

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false } },
});

const root = document.getElementById("root");
if (!root) throw new Error("找不到根节点");

ReactDOM.createRoot(root).render(
	<ThemeProvider storageKey="vite-ui-theme">
		<ThemeColorManager />
		<QueryClientProvider client={queryClient}>
			<WebSocketProvider>
				<CommandProvider>
					<StatusProvider>
						<SortProvider>
							<TooltipProvider>
								<App />
								<Toaster
									duration={1000}
									position="top-center"
									className="flex items-center justify-center"
									toastOptions={{
										classNames: {
											default:
												"w-fit rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1.5 shadow-none backdrop-blur-xl",
										},
									}}
								/>
							</TooltipProvider>
						</SortProvider>
					</StatusProvider>
				</CommandProvider>
			</WebSocketProvider>
		</QueryClientProvider>
	</ThemeProvider>,
);
