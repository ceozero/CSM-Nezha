import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const savedTheme = localStorage.getItem("cfsm-theme");
if (
	savedTheme === "dark" ||
	(savedTheme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
	document.documentElement.classList.add("dark");
}

const root = document.getElementById("root");
if (!root) throw new Error("找不到根节点");
ReactDOM.createRoot(root).render(<App />);
