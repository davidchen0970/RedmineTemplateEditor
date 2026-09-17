import { test, expect } from "@playwright/test";

// Lifecycle selectors (each grounded in src):
//   #sections .section / [data-more-toggle] / [data-more] [data-add]
//     -> opens the add-block dialog (same path as e2e/blocks.spec.js).
//   dialog#abDialog, #abTypes, #abMain textarea, #abForm button[type=submit]
//     -> seed a block (add-block-dialog.js). This is intentionally a plainText
//        block: implementation wraps content in <pre><code>, but a plainText
//        block emits its content on its own line (generator.js:220-222), so a
//        "!image.png!" marker becomes a real <img> in #preview.
//   #sections [data-cont-index]
//     -> the block content <textarea> image-drop writes into (block-view.js:146).
//   #out
//     -> the Textile <textarea>; assert with toHaveValue (output-view.js:10).
//   #previewbtn / #preview
//     -> preview view; only then #preview.innerHTML fills (output-view.js:13-16).
//   #preview img.preview-image[data-preview-name] / .preview-image-pick
//     -> the broken image the image-replace-picker makes clickable
//        (preview-inline.js:16, image-replace-picker.js:22-30).

function seedImageBlock(page, section, marker) {
	return (async () => {
		await section.locator("[data-more-toggle]").first().click();
		await section.locator("[data-more]").first().locator("[data-add]").click();
		const dialog = page.locator("dialog#abDialog");
		await expect(dialog).toBeVisible();
		// A plainText block has no real <pre>/<code> wrapper, so the image
		// marker stays on its own top-level line and becomes an <img>.
		await dialog.locator("#abTypes").getByText("純文字", { exact: true }).click();
		await dialog.locator("#abMain textarea").fill(marker);
		await dialog.locator("#abForm button[type=submit]").click();
		await expect(dialog).toBeHidden();
		// Porting sections default disabled, so generator.js:135 drops their blocks
		// from #out and from the preview. Enable the seeded section first.
		await page.locator("#sections .section").first().locator("[data-se]").first().check();
	})();
}

test("image drop writes an image marker into the block content", async ({ page }) => {
	const imageName = `e2e-drop-${Date.now()}.png`;
	await test.step("open the editor and seed an empty plainText block", async () => {
		await page.goto("/");
		await seedImageBlock(page, page.locator("#sections .section").first(), "");
	});
	await test.step("drop an image file onto the block content", async () => {
		// The drop listener (app/image-drop.js) interprets any "drop" event with
		// image/* files whose target is inside [data-cont-index]. We synthesize
		// a real DataTransfer + File in page scope: supported by both Chromium
		// and Firefox, and needs no navigator.clipboard.
		const target = page.locator("#sections [data-cont-index]").first();
		await expect(target).toBeVisible();
		await target.evaluate((el, name) => {
			const dt = new DataTransfer();
			const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
			dt.items.add(new File([bytes], name, { type: "image/png" }));
			const drop = new Event("drop", { bubbles: true, cancelable: true });
			Object.defineProperty(drop, "dataTransfer", { value: dt });
			el.dispatchEvent(drop);
		}, imageName);
	});
	await test.step("the Textile output echoes the image marker", async () => {
		// readFileAsDataUrl is async, so the marker lands a moment later in
		// #out (block-renderer.js:154 -> changed() -> renderer.renderOut()).
		await expect(page.locator("#out")).toHaveValue(new RegExp(`!${imageName}!(?!\\S)`));
	});
	await test.step("preview view surfaces the registered image", async () => {
		await page.click("#previewbtn");
		await expect(page.locator("#preview img.preview-image")).toBeVisible();
	});
});

test("broken images open the image-replace picker", async ({ page }) => {
	const brokenName = `e2e-broken-${Date.now()}.png`;
	await test.step("seed a plainText block holding a missing image", async () => {
		await page.goto("/");
		// The name is never registered as a data URL, so its relative src 404s
		// and the image "loads" -> error -> "preview-image-pick".
		await seedImageBlock(page, page.locator("#sections .section").first(), `!${brokenName}!`);
	});
	await test.step("switch to preview and wait for the broken image", async () => {
		await page.click("#previewbtn");
		const img = page.locator("#preview img.preview-image");
		await expect(img).toBeVisible();
		// image-replace-picker.js:22 flags the failed image as clickable.
		await expect(img).toHaveClass(/preview-image-pick/);
	});
	await test.step("click the image, pick a replacement, and re-confirm", async () => {
		// The click handler calls the hidden body>input[type=file].click()
		// (image-replace-picker.js:35). Playwright maps that to a filechooser
		// event that we fulfil with setFiles.
		const img = page.locator("#preview img.preview-image");
		const chooserPromise = page.waitForEvent("filechooser");
		await img.click();
		const chooser = await chooserPromise;
		await chooser.setFiles({
			name: "replacement.png",
			mimeType: "image/png",
			buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		});
	});
	await test.step("the image marker survives the replacement", async () => {
		// The replacement only registers a new data URL; it must not touch the
		// Textile content.
		await expect(page.locator("#out")).toHaveValue(new RegExp(`!${brokenName}!`));
		await expect(page.locator("#preview img.preview-image")).toBeVisible();
	});
});
