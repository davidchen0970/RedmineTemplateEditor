import { test, expect } from "@playwright/test";

test("dragging the workspace resize splitter widens the side column", async ({ page }) => {
	const readSideCol = () =>
		page.evaluate(() => {
			const value = document.getElementById("workspace").style.getPropertyValue("--side-col");
			return Number.parseFloat(value) || 0;
		});

	await test.step("open the editor", () => page.goto("/"));
	await test.step("focus the resize separator", async () => {
		await expect(page.locator("#workspaceResizer")).toHaveAttribute("role", "separator");
		await expect(page.locator("#workspaceResizer")).toHaveAttribute("aria-orientation", "vertical");
	});

	await test.step("drag the splitter right and expect the side column to grow", async () => {
		const before = await readSideCol();
		const box = await page.locator("#workspaceResizer").boundingBox();
		expect(box, "workspace resizer should have a visible box").not.toBeNull();
		const startX = box.x + box.width / 2;
		const startY = box.y + box.height / 2;
		await page.mouse.move(startX, startY);
		await page.mouse.down();
		await expect(page.locator("#workspaceResizer")).toHaveClass(/is-dragging/);
		await page.mouse.move(startX + 120, startY, { steps: 6 });
		await page.mouse.up();
		const after = await readSideCol();
		await expect(page.locator("#workspaceResizer")).not.toHaveClass(/is-dragging/);
		expect(after).toBeGreaterThan(before);
	});

	await test.step("the chosen width is persisted for reload", async () => {
		await expect(page.locator("#workspace")).toHaveAttribute("style", /--side-col\s*:/);
	});
});

test("enabled section title and description oninput flow into #out", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const section = page.locator("#sections .section").first();

	await test.step("enable the first (porting) section", async () => {
		await section.locator("[data-se]").first().check();
		await expect(section.locator("[data-se]")).toBeChecked();
	});

	await test.step("type a section title and expect h3. in the output", async () => {
		const heading = `端到端-h3-${Date.now()}`;
		await section.locator("[data-title]").fill(heading);
		await expect(page.locator("#out")).toHaveValue(new RegExp(`h3\\. ${heading}`));
	});

	await test.step("type a section description and expect it in the output", async () => {
		const desc = `段落說明-${Date.now()}`;
		await section.locator("[data-description]").fill(desc);
		await expect(page.locator("#out")).toHaveValue(new RegExp(desc));
	});
});
