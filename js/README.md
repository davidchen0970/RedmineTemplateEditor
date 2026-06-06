# Redmine Template Editor

Redmine Template Editor 是一個用來快速整理 Redmine note / issue comment 的前端小工具。它提供表單化編輯、範本切換、區塊化內容管理、Textile 輸出與 Preview，適合用來撰寫 Porting、Debug、Hardware Check 等工作紀錄。

## 功能特色

- 提供多種預設範本：`Hardware Check`、`Porting`、`Debug`
- 支援 Redmine Textile 格式輸出
- 支援 Raw / Preview / JSON 狀態檢視
- 自動儲存編輯狀態到 `localStorage`
- 支援匯出狀態與輸出內容
- 支援段落啟用 / 停用、上移 / 下移、刪除
- 支援區塊新增、複製、刪除、排序
- 支援多個 content 區塊，方便拆分多段 log 或驗證結果
- Preview 支援常用 Textile 元素，例如標題、清單、表格、圖片、collapse、Mermaid 與 code block

## 專案結構

```text
.
├── renderer.js   # UI render 與事件綁定
├── state.js      # 狀態結構、預設範本與 localStorage 存取
├── textile.js    # Textile 產生器與 Preview HTML parser
└── README.md
```

## 主要檔案說明

### `state.js`

負責定義資料模型與預設範本。

主要內容：

- `KEY`：localStorage 使用的 key
- `envKeys`：測試環境欄位定義
- `block()`：建立一般區塊
- `impl()`：建立 implementation 區塊
- `sec()`：建立段落
- `presets`：內建範本
- `makeState()`：依照範本建立初始 state
- `loadState()` / `saveState()`：讀寫 localStorage
- `safe()`：產生安全檔名

目前內建範本包含：

- `hardware`：Hardware Check / Schematic / 線路檢查
- `porting`：功能移植 / 設定修改
- `debug`：問題排查 / FAILED note

### `renderer.js`

負責畫面更新與使用者事件處理。

主要內容：

- `createRenderer(ctx)`：建立 renderer
- `render()`：重新繪製整個畫面
- `renderFields()`：繪製標題、狀態、summary、修改內容、相關參考與測試環境
- `renderSections()`：繪製各段落與段落中的 blocks
- `renderBlock()`：繪製單一 block
- `renderOut()`：依照目前 view 顯示 Raw Textile、Preview 或 JSON
- `addVerificationSnippet()`：快速加入常用驗證指令片段

支援的 block type：

- `implementation`
- `text`
- `command`
- `diff`
- `log`
- `mermaid`
- `image`
- `collapse`

### `textile.js`

負責把 state 轉成 Redmine Textile，並提供 Preview HTML parser。

主要內容：

- `ensureBlockContents()`：確保 block 內有 `contents` 陣列
- `textile(state)`：把整份 state 轉成 Textile 字串
- `renderInlineTextile()`：處理 inline Textile 顯示
- `textileToPreviewHtml(text)`：把 Textile 轉成 Preview HTML

輸出內容大致包含：

1. `h2.` 標題
2. 相關參考
3. 結論與執行狀態
4. Summary 條列
5. 修改目標
6. 測試環境
7. 啟用中的 sections 與 blocks

## State 結構概念

簡化後的 state 結構如下：

```json
{
  "noteType": "porting",
  "title": "Porting SOL function",
  "status": "PASS",
  "summary": "",
  "changeContent": "",
  "relatedRef": "",
  "environment": {
    "systemModel": "",
    "bios": "",
    "bmcVersion": "",
    "cpldVersion": "",
    "cpuInformation": "",
    "osKernel": "N/A",
    "others": "N/A"
  },
  "sections": [],
  "updatedAt": "2026-06-06T00:00:00.000Z"
}
```

## Block type 用法

### `implementation`

適合紀錄修改檔案、work path、修改內容與補充說明。

Textile 輸出會包含：

- `# api.c` 這類 ordered list 標題
- 可選的 `work path` collapse
- description
- code block

### `command` / `diff` / `log`

適合放 shell command、diff 或測試 log。內容會以 pre/code 類型輸出，方便保留原始排版。

### `text`

適合直接輸入 Textile 文字，例如：

```textile
# 先 Porting PSU0 的結果
{{collapse(more info)
<pre><code class="shell">
root@intel-obmc:~# ipmitool sensor
...
</code></pre>
}}
```

### `collapse`

適合收合長 log 或補充資訊。

```textile
{{collapse(more info)
<pre><code class="shell">
...
</code></pre>
}}
```

### `mermaid`

適合放流程圖或關係圖內容。

```textile
{{mermaid
graph TD
  A --> B
}}
```

### `image`

適合放 Redmine attachment image 名稱。輸出格式會接近：

```textile
!image.png!
```

## Preview list / code block 注意事項

Textile ordered list 搭配 block-level 內容時，需要讓後續的 `collapse`、`pre/code`、一般段落維持在目前的 list item 內。

預期效果：

```textile
# 先 Porting PSU0 的結果
{{collapse(more info)
<pre><code class="shell">
...
</code></pre>
}}

# PSU0 / PSU1
<pre><code class="shell">
...
</code></pre>
```

Preview 應顯示為：

```text
1. 先 Porting PSU0 的結果
   [more info]
   [code block]

2. PSU0 / PSU1
   [code block]
```

如果 `collapse` 或 `pre/code` 在 preview 中沒有縮在 `1.` / `2.` 底下，通常是 parser 在處理 block 結束時提早關閉 list。相關邏輯可從 `textileToPreviewHtml()` 中的 list stack、collapse、pre 與 close flow handling 開始檢查。

## 開發筆記

### 新增一種 block type

1. 在 `renderer.js` 的 `label()` 補上顯示名稱
2. 在 `renderBlock()` 的 `options` 補上新 type
3. 在 `textile.js` 的 `push()` 補上輸出格式
4. 如果 Preview 需要特殊顯示，在 `textileToPreviewHtml()` 補上 parser

### 新增一個預設範本

在 `state.js` 的 `presets` 加入新的 key，例如：

```js
newType: {
  label: "New Template",
  desc: "用途說明",
  title: "預設標題",
  status: "PASS",
  change: "",
  sections: [
    sec("實作流程", false),
    sec("結果驗證", false),
    sec("參考資料", false),
  ],
}
```

## Commit message 建議

若修改的是 Textile preview list / code block 縮排，可使用：

```text
fix(textile): preserve list indentation for collapse and code blocks
```

若修改的是新的 block type 或範本，可使用：

```text
feat(template): add xxx note template
```

## 已知限制

- Preview parser 是輕量版 parser，目標是協助檢查輸出內容，不等同完整 Redmine Textile renderer。
- 若 Redmine Textile 語法有特殊擴充，建議以 Redmine 實際顯示結果為準。
- 長 log 建議放在 `collapse` 或 `command` / `log` block 中，避免 Raw 輸出過長而不易閱讀。
