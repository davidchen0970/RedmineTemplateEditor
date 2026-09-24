import { test, expect } from "@playwright/test";

// Markup facts (read from source, not guessed):
//  - Section title toggle: section-renderer.js:140-144 emits
//        <button class="section-title-btn" data-collapse-target="section-body-<id>"
//                data-collapse-scope="sections" data-collapse-key="<id>"
//                aria-expanded="true|false">
//    along with  .section-body id="section-body-<id>" (:147) whose class carries "collapsed".
//  - default isCollapsed(...,"sections",<id>,true) -> new porting doc has no stored ui so
//    sections START COLLAPSED (aria-expanded="false", body has "collapsed" class).
//  - main.js:80-95 toggles on `[data-collapse-target]`: flips aria-expanded on the button,
//    toggles "collapsed" on the body, then writes state.ui.collapsed.sections[key] + changed()
//    (changed -> save -> localStorage via storage.js:112-117, storage.getDocumentStateKey).
//    Because SAVED state overrides the default on reload, a non-default toggle surviving
//    page.reload() is the actual proof of persistence. Default is collapsed, so I toggle
//    to EXPANDED in test 1 and to COLLAPSED in test 2.

test("section expanded state survives reload", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const section = page.locator("#sections .section").first();
	const toggle = section.locator("[data-collapse-target]");
	const body = section.locator(".section-body");

	await test.step("sections default to collapsed", async () => {
		await expect(toggle).toHaveAttribute("aria-expanded", "false");
		await expect(body).toHaveClass(/collapsed/);
	});

	await test.step("click the title to expand the section", async () => {
		await toggle.click();
		await expect(toggle).toHaveAttribute("aria-expanded", "true");
		await expect(body).not.toHaveClass(/collapsed/);
	});

	await test.step("reload and expect the section still expanded", async () => {
		await page.reload();
		const afterToggle = page.locator("#sections .section").first().locator("[data-collapse-target]");
		const afterBody = page.locator("#sections .section").first().locator(".section-body");
		// Expanded state was persisted to localStorage; if it weren't, reload would
		// restore the collapsed default.
		await expect(afterToggle).toHaveAttribute("aria-expanded", "true");
		await expect(afterBody).not.toHaveClass(/collapsed/);
	});
});

test("section collapse state survives reload", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const section = page.locator("#sections .section").first();
	const toggle = section.locator("[data-collapse-target]");
	const body = section.locator(".section-body");

	await test.step("expand then collapse the section to a known collapsed state", async () => {
		await toggle.click();
		await expect(toggle).toHaveAttribute("aria-expanded", "true");
		await toggle.click();
		await expect(toggle).toHaveAttribute("aria-expanded", "false");
		await expect(body).toHaveClass(/collapsed/);
	});

	// Persistence of the ui.collapsed.sections entry is confirmed by the reload
	// assertion below (state was saved via main.js changed()/save() -> localStorage);
	// grepping #out would be wrong here because raw view renders Textile, not the ui JSON.
	await test.step("reload and expect the section still collapsed", async () => {
		await page.reload();
		const afterToggle = page.locator("#sections .section").first().locator("[data-collapse-target]");
		const afterBody = page.locator("#sections .section").first().locator(".section-body");
		await expect(afterToggle).toHaveAttribute("aria-expanded", "false");
		await expect(afterBody).toHaveClass(/collapsed/);
	});
});

test("reset clears the active document back to the preset default", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	// Default porting preset title: model.js:121-125 \u2026 makeState() -> title "Porting SOL function".
	await expect(page.locator("#title")).toHaveValue("Porting SOL function");

	await test.step("change the title so reset has something to undo", async () => {
		await page.locator("#title").fill(`reset-e2e-${Date.now()}`);
		await expect(page.locator("#title")).not.toHaveValue("Porting SOL function");
	});

	await test.step("confirm the reset dialog (window.confirm)", async () => {
		// import-actions.js:103-109 uses window.confirm(...); Playwright surfaces it
		// as a page dialog. Accepting makes confirm() return true and proceeds with reset.
		page.once("dialog", (dialog) => dialog.accept());
		await page.locator('[data-header-action-group="more"] .header-action-group-toggle').click();
		await page.locator("#reset").click();
	});

	await test.step("expect the title back to the preset default", async () => {
		await expect(page.locator("#title")).toHaveValue("Porting SOL function");
	});
});
