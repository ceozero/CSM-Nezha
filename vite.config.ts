import { execSync } from "node:child_process";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Get git commit hash
const getGitHash = () => {
	try {
		return execSync("git rev-parse --short HEAD", { stdio: "ignore" })
			.toString()
			.trim();
	} catch {
		// 首次构建、未初始化 Git 历史时仍应能生成可发布主题。
		return "unknown";
	}
};

const getVendorChunkName = (moduleId: string) => {
	const normalizedId = moduleId.replace(/\\/g, "/");

	if (!normalizedId.includes("/node_modules/")) {
		return null;
	}

	const packagePath = normalizedId.split("/node_modules/").pop();
	if (!packagePath) {
		return null;
	}

	const packageName = packagePath.split("/")[0];
	return packageName || null;
};

// https://vite.dev/config/
export default defineConfig({
	// CFSM 会从 GitHub 主题目录代理 index.html 与 assets/，因此构建产物必须自包含。
	base: "./",
	publicDir: false,
	define: {
		"import.meta.env.VITE_GIT_HASH": JSON.stringify(getGitHash()),
	},
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		headers: {
			"Cache-Control": "no-store",
			Pragma: "no-cache",
		},
	},
	test: {
		environment: "jsdom",
		environmentOptions: {
			jsdom: {
				url: "https://localhost/",
			},
		},
		globals: true,
		setupFiles: ["./src/test/setup.ts"],
		css: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			reportsDirectory: "./coverage",
			thresholds: {
				statements: 86,
				branches: 74,
				functions: 86,
				lines: 86,
			},
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/**/*.test.{ts,tsx}",
				"src/**/*.spec.{ts,tsx}",
				"src/test/**",
				"src/types/**",
				"src/main.tsx",
				"src/i18n.js",
				"src/vite-env.d.ts",
			],
		},
	},
	build: {
		outDir: "theme",
		emptyOutDir: true,
		// Target older Safari versions (iOS 15/16) explicitly, since Vite's
		// default "widely-available browsers" target only covers the latest
		// two major Safari releases and would otherwise emit syntax that
		// crashes on older WebKit engines (white screen on load).
		target: ["es2020", "safari15"],
		cssTarget: ["safari15"],
		rolldownOptions: {
			output: {
				entryFileNames: `assets/[name].[hash].js`,
				chunkFileNames: `assets/[name].[hash].js`,
				assetFileNames: `assets/[name].[hash].[ext]`,
				codeSplitting: {
					groups: [
						{
							name: getVendorChunkName,
							test: /[\\/]node_modules[\\/]/,
						},
					],
				},
			},
		},
		chunkSizeWarningLimit: 1500,
	},
});
