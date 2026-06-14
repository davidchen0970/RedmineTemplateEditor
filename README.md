# Redmine Textile 輸出器

Redmine Textile 輸出器是一個以 Redmine 筆記輸出為核心的前端工具。  
它提供表單化編輯、模板套用、段落管理、區塊編排、即時預覽、匯入匯出與本機儲存功能，協助快速整理測試紀錄、修改說明、Debug note、Porting note 與硬體檢查紀錄。

## 主要功能

### Redmine Textile 內容產生

使用者可以透過表單輸入標題、執行狀態、簡要說明、修改目標、結論補充與測試環境資訊，系統會自動轉成 Redmine 可用的 Textile 格式。

支援的輸出內容包含：

- `h2.` 標題
- `h3.` 段落標題
- 結論與執行狀態
- 測試環境資訊
- 條列式補充說明
- 程式區塊
- Command / Diff / Log 區塊
- Collapse 摺疊區塊
- Mermaid 圖表區塊
- Image 圖片語法
- 純文字段落

## 模板系統

內建多種常用模板，可快速建立不同用途的筆記架構：

- Hardware Check
- Porting
- Debug

每個模板會自動帶入對應的預設標題、狀態、修改目標與常用段落，方便快速開始撰寫 Redmine note。

## 段落與區塊管理

工具支援彈性的段落與區塊編排，適合整理較長或結構較複雜的技術紀錄。

可用功能包含：

- 新增段落
- 啟用或停用段落
- 修改段落標題
- 填寫段落說明
- 上移 / 下移段落
- 複製段落
- 刪除段落
- 在段落內新增多種區塊
- 上移 / 下移區塊
- 複製區塊
- 刪除區塊
- 調整區塊所在層級
- 同一區塊內新增多筆 content

## 支援的區塊類型

目前支援以下區塊類型：

- Implementation Unit
- Text / Textile
- 純文字
- Command Block
- Diff Block
- Log Block
- Mermaid Block
- Image
- Collapse

其中 Implementation Unit 可額外記錄：

- 檔案或單元名稱
- work path
- work path 標題
- 主要內容語言
- Description
- 多筆內容區塊

## 即時輸出與預覽

工具提供三種檢視模式：

- Textile
- 預覽
- JSON

使用者可以直接查看產生後的 Redmine Textile，也可以切換成預覽模式確認大致排版，或切換 JSON 模式查看目前表單狀態。

預覽模式支援：

- 標題
- 段落
- 條列內容
- 表格
- 程式區塊
- Collapse
- Mermaid 圖表
- 圖片占位預覽

## 複製與下載

可將產生的 Redmine Textile 直接複製到剪貼簿，也可以下載成 `.textile` 檔案。

另外也支援將目前內容匯出成 JSON，方便備份、版本保存或移到其他環境繼續編輯。

## JSON 匯入與匯出

使用者可以將目前編輯狀態匯出為 JSON，之後再透過匯入功能讀回。

適合以下情境：

- 保存尚未完成的筆記
- 分享筆記模板給其他人
- 在不同瀏覽器或電腦間轉移資料
- 建立多份不同 issue / task 的撰寫內容

## Patch 匯入

工具支援匯入 `.patch` 或 `.diff` 內容，並自動解析 `diff --git` 區塊。

匯入後會依照 patch 中的檔案路徑建立對應的 Implementation Unit，方便將修改內容快速整理成 Redmine note。

## 快速片段

內建常用驗證片段，可快速加入結果驗證內容：

- `journalctl`
- `systemctl`
- `i2c`

這些片段會自動加入到結果驗證段落，適合整理 BMC、service 狀態或硬體通訊相關測試紀錄。

## 本機自動儲存

工具會將目前編輯內容自動儲存在瀏覽器 localStorage 中，降低重新整理頁面後內容遺失的風險。

目前支援：

- 自動儲存目前表單狀態
- 依不同網頁路徑分開儲存
- 同一網頁內建立多份儲存
- 為每份儲存設定名稱
- 從下拉選單讀取指定儲存
- 重新命名儲存
- 刪除指定儲存
- 重設目前儲存內容

這讓不同頁面、不同任務或不同 Redmine issue 可以各自保存編輯進度。

## 版面與使用體驗

工具採用左右工作區設計：

- 側邊區域負責表單、模板與段落設定
- 主要區域負責 Textile 輸出、預覽與 JSON 檢視

其他使用體驗功能包含：

- 深色模式 / 淺色模式切換
- 工作區寬度調整
- 手機與窄螢幕下的頁首收合
- 自動顯示儲存狀態
- 顯示輸出字元數與行數
- Toast 提示訊息

## 適合使用情境

此工具適合用於：

- Redmine issue 回覆整理
- Porting note 撰寫
- Debug 過程記錄
- 硬體線路檢查紀錄
- BMC / BIOS / CPLD 測試紀錄
- Patch 修改內容整理
- 測試結果驗證紀錄
- 技術分析與結論彙整

## 基本使用流程

1. 選擇合適的模板。
2. 填寫標題、狀態、修改目標與測試環境。
3. 啟用需要的段落。
4. 在段落內加入 Implementation Unit、Command、Diff、Log 或其他區塊。
5. 切換預覽確認內容。
6. 複製 Redmine Textile 或下載 `.textile` 檔案。
7. 如需備份，可匯出 JSON。
8. 如需保留多份內容，可使用 localStorage 命名儲存功能。

## 資料保存說明

資料主要保存在瀏覽器 localStorage 中。  
localStorage 屬於瀏覽器本機資料，不會自動同步到其他瀏覽器或裝置。

建議在以下情況額外匯出 JSON 備份：

- 更換電腦
- 更換瀏覽器
- 清除瀏覽器資料前
- 內容較重要或尚未貼到 Redmine 前
- 需要與其他人共享目前編輯狀態時

## 注意事項

- Redmine Textile 預覽僅用於輔助檢查，實際顯示仍以 Redmine 平台解析結果為準。
- Mermaid 圖表需瀏覽器可載入對應資源才會正常顯示。
- localStorage 資料可能因瀏覽器清除資料、隱私模式或站台資料重設而消失。
- 若內容非常重要，建議同時使用 JSON 匯出備份。

## 專案目標

