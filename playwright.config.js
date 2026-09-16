import { defineConfig, devices } from "@playwright/test";

const BASE = "http://127.0.0.1:4173";

export default defineConfig({
	testDir: "./e2e",
	// Fail fast when an assertion is trying and getting it wrong: cap both the
	// whole-test run and the per-assertion retry window at 10s each.
	timeout: 10_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	workers: 1,
	retries: 2,
	reporter: [["list"]],
	use: {
		baseURL: BASE,
		headless: true,
		// The theme starts from prefers-color-scheme: dark unless we force light.
		// Pin it so the theme-toggle test and the light/dark screenshots are stable.
		colorScheme: "light",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		{ name: "firefox", use: { ...devices["Desktop Firefox"] } },
	],
	webServer: {
		command: "node e2e/serve.mjs",
		url: `${BASE}/`,
		reuseExistingServer: false,
		timeout: 60_000,
	},
});
