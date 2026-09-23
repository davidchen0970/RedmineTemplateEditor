# UI e2e 覆蓋對照

Playwright 在 GitHub Actions 的 `e2e` job 分 chromium + firefox + webkit(Safari) 各跑一輪；`playwright-report/`
會上傳成 CI artifacts，開 HTML 可以按類別直接跳。

資料夾就是「類別」，list 報表第一眼就看得到。

## editor/  — 編輯器與文件核心

| 檔 | 蓋到 |
|---|---|
| `app.smoke.spec.js` | app shell 載入 editor |
| `editor.spec.js` | 標題 → Textile、Textile/預覽/JSON 三視圖、主題切換、加 implementation block、plainText 停用標題欄、diff block 上傳欄位 |
| `form.spec.js` | summary 標題→結論 bullet、狀態/修改/ref、執行狀態 |
| `export.spec.js` | 下載 `.textile`、匯出狀態成 JSON |
| `storage.spec.js` | 新增文件進 picker 並切換 |
| `collapse-reset.spec.js` | section 摺疊 reload 持久化、`#reset` 回預設 |
| `layout.spec.js` | 分隔條拖曳改變側欄寬、段落標題/說明 → `#out` |
| `visual.spec.js` | 深/淺色整頁 screenshots |

## sections/  — 段落與區塊

| 檔 | 蓋到 |
|---|---|
| `sections.spec.js` | 段落複製、上下移、改標題 → `h3.`、有序/無序 `#`/`*` 切換 |
| `blocks.spec.js` | 段落新增、block 複製、刪除(confirm) |
| `blocks-ops.spec.js` | block 上/下移、type 切換、新增內容多 § |
| `blocks-collapse.spec.js` | 「全部收闔區塊」、單 block 摺疊 reload 保留 |
| `blocks-env.spec.js` | block 層級上限被夾到前塊+1、`#envEnabled` 開關環境清單 |
| `images.spec.js` | 拖圖進 block → `!name.png!` → 預覽 `<img>`、broken 圖開 replace picker |

## import/  — 匯入與快捷鍵

| 檔 | 蓋到 |
|---|---|
| `import.spec.js` | patch 匯入轉成 implementation blocks、JSON 匯入取代狀態 |
| `shortcuts.spec.js` | 快捷鍵 help dialog、`Ctrl+Shift+C` 複製、`#copy` 下載 JSON |

## 測試注意事項

- 預設 preset 段落 `enabled:false`，generator 只輸出 enabled 段落；要在 `#out` 看到 block/段落內容，先 `[data-se]` 勾起來。
- `#out` 是 readonly textarea，只可用 `toHaveValue(string|RegExp)`，**不要**用 `toContainText`/function。
- seed block 一律走 `dialog#abDialog`（`[data-more]` → `[data-add]`）慣例。
- 開闔一律以 `[data-block-toggle]`/`[data-collapse-target]` 的 `aria-expanded` 判定，不賭 root class。
- `serve.mjs` 是 `webServer` 用，留在 `e2e/` 根、不吃進任何類別。
