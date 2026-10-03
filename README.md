# 繁體匯入

SillyTavern 前端擴充：在角色卡、聊天補全預設和世界書的原匯入按鈕旁加入「繁」按鈕，選檔後先以 OpenCC 轉為台灣正體，再交回 SillyTavern 原本的匯入流程。

## 功能

- 角色卡：支援 JSON 與 PNG，並轉換角色卡內嵌世界書。
- 聊天補全預設：支援 JSON／SETTINGS，轉換提示詞名稱與正文。
- 世界書：支援 JSON／LOREBOOK，轉換正文、備註與一般觸發詞。
- 保留 `{{...}}` 巨集、網址、程式碼區塊、HTML／XML 標記和正則觸發詞。
- 世界書一般觸發詞直接改成繁體，不保留簡體副本。
- 全程離線；原始檔不會被修改。

## 安裝

Git 安裝：在酒館「擴充 → 安裝擴充」輸入 `https://github.com/komika94in-alt/sillytavern-traditional-import.git`。維護者須先把新版檔案上傳到該儲存庫，酒館才抓得到更新。

將整個 `sillytavern-traditional-import` 資料夾複製到：

```text
SillyTavern/data/<使用者>/extensions/sillytavern-traditional-import
```

重新整理 SillyTavern。角色卡、聊天補全預設及世界書的原匯入按鈕旁會出現「繁」。

若你只拿到發行壓縮檔，請先解壓；不要把 ZIP 本身放進 extensions 資料夾。

## 使用

按「繁」並選擇檔案。擴充會建立記憶體中的繁體副本，再觸發酒館原本的匯入程序。同名覆寫確認、預設敏感欄位提示及匯入完成提示仍由酒館處理。

## 支援範圍

第一版以 SillyTavern 1.18.0 為相容目標。Regex Script JSON 不屬於角色卡、預設或世界書，請使用原本的 Regex 匯入入口。

1.0.1 加入模組載入時自動啟動，修正沒有 `activate` hook 的酒館版本安裝後不出現按鈕的問題。新版 hook 仍可使用，重複初始化不會建立重複按鈕。已做 DOM 啟動回歸測試；其他版本完整匯入流程仍需在實際酒館驗證。

## 開發

```text
npm install
npm test
npm run build
npm run package
```

`index.js` 是可直接由 SillyTavern 載入的瀏覽器 bundle。OpenCC 的第三方授權放在 `third-party/`。
