import { test, expect } from "@playwright/test";

test("patch import turns diff chunks into implementation blocks", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const patch = [
		"diff --git a/api.c b/api.c",
		"index 1111111..2222222 100644",
		"--- a/api.c",
		"+++ b/api.c",
		"@@ -0,0 +1,3 @@",
		"+int x;",
		"+return 0;",
		"",
	].join("\n");
	await test.step("feed the hidden patch input", async () => {
		await page.setInputFiles("#patchFile", {
			name: "ci.patch",
			mimeType: "text/plain",
			buffer: Buffer.from(patch),
		});
	});
	await test.step("expect an imported implementation block", async () => {
		await expect(page.locator("#toast")).toContainText("已匯入 1 個程式碼單元");
		await expect(page.locator("#sections")).toContainText("api.c");
	});
});

test("JSON import replaces the state and re-renders", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const title = `imported-${Date.now()}`;
	const json = JSON.stringify({
		title,
		status: "PASS",
		changeContent: "",
		summary: "",
		relatedRef: "",
		environmentEnabled: true,
		environment: [
			{ id: "e1", label: "OS / Kernel", value: "ubuntu", enabled: true, custom: false },
		],
		sections: [
			{ id: "s1", title: "驗證結果", enabled: true, description: "", blocks: [] },
		],
		ui: { collapsed: { sections: {}, blocks: {} } },
	});
	await test.step("feed the hidden JSON input", async () => {
		await page.setInputFiles("#file", {
			name: "state.json",
			mimeType: "application/json",
			buffer: Buffer.from(json),
		});
	});
	await test.step("expect the imported title in the Textile output", async () => {
		await expect(page.locator("#toast")).toContainText("JSON 資料已匯入");
		await expect(page.locator("#out")).toHaveValue(new RegExp(`h2\\. ${title}`));
	});
});
