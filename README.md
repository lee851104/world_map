# 地圖記事 Atlas Notes

繁體中文靜態網站，提供世界／台灣 22 縣市地圖、搜尋、自由上色、事件 CRUD 與 JSON 備份。

執行 `npm start` 後開啟 http://127.0.0.1:4173 。測試：`npm test`。重新準備圖資：`node scripts/prepare-data.mjs`（需網路）。網站入口為 `dist/index.html`，必須經 HTTP 伺服器開啟。

資料以 `world-notes:v1` 儲存在 localStorage，只在同一瀏覽器／網站來源保留。匯入會先驗證並確認，所有紀錄以純文字呈現。來源與授權見 `dist/credits.html`。
