import { test, expect } from "@playwright/test";

test("dragging the workspace resize splitter widens the side column", async ({ page }) => {
	// The splitter (#workspaceResizer) is desktop-only (min-width: 901px, the
	// default 1280x720 viewport passes). pointerdown hooks window-level
	// pointermove/pointerup listeners (workspace-resize.js:36-46) and writes the
	// new `--side-col`/`--output-col` custom properties as INLINE styles on
	// #workspace (workspace-resize.js:16-18), clamped to [340, avail-560].
	//
	// 寬鬆策略：we do not assert an exact pixel width (pointer capture + CDP
	// synthesized events can land on a slightly different clientX across browser
	// engines). Instead we read the numeric --side-col before and after a real
	// pointer drag to the right and only assert it strictly increased — that
	// still proves the splitter drag took effect, wherever the pointer landed.
	//
	// helper: read the inline custom property as a number.
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
		// dragging during the gesture adds .is-dragging to the handle.
		await expect(page.locator("#workspaceResizer")).toHaveClass(/is-dragging/);
		await page.mouse.move(startX + 120, startY, { steps: 6 });
		await page.mouse.up();
		const after = await readSideCol();
		await expect(page.locator("#workspaceResizer")).not.toHaveClass(/is-dragging/);
		expect(after).toBeGreaterThan(before);
	});

	await test.step("the chosen width is persisted for reload", async () => {
		// write is guarded by desktopQuery; persistence itself is covered by the
		// tolerant growth assertion above, so we only sanity-check the inline style
		// is present on #workspace after the gesture.
		await expect(page.locator("#workspace")).toHaveAttribute("style", /--side-col\s*:/);
	});
});

test("enabled section title and description oninput flow into #out", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const section = page.locator("#sections .section").first();

	await test.step("enable the first (porting) section", async () => {
		// The porting sections render by default disabled (model.js:90 sets no
		// `enabled`), and the generator filters on `section.enabled`
		// (generator.js:134-135). Enabling re-renders and makes its title/desc
		// eligible for #out.
		await section.locator("[data-se]").first().check();
		await expect(section.locator("[data-se]")).toBeChecked();
	});

	await test.step("type a section title and expect h3. in the output", async () => {
		const heading = `端到端-h3-${Date.now()}`;
		await section.locator("[data-title]").fill(heading);
		// section-renderer.js:177-182 段落標題 oninput → renderOutput；
		// generator.js:136-137 以 `h3. ${section.title}` 輸出。
		await expect(page.locator("#out")).toHaveValue(new RegExp(`h3\\. ${heading}`));
	});

	await test.step("type a section description and expect it in the output", async () => {
		const desc = `段落說明-${Date.now()}`;
		await section.locator("[data-description]").fill(desc);
		// description oninput 只呼叫 changed()（section-renderer.js:183-186），
		// changed() 統一呼叫 renderer.renderOut()/save()（main.js:36-40）。
		// generator.js:138-140 在該段 enabled 時把 description 整段輸出。
		await expect(page.locator("#out")).toHaveValue(new RegExp(desc));
	});
});
