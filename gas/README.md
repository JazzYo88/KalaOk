# GAS 端的修改紀錄

GitHub Pages 版的後端是 Google Apps Script 專案「專屬點唱機」。這個資料夾放 GAS 那邊對應的修改，方便對照與備份。

- `drive-backend.gs`：雲端硬碟音樂的後端（`addDriveLinks`、`authDrive`），附加在 `程式碼.gs` 最後面
- `drive-patches.json`：前端共用的修改（`[原文, 新文, 次數]`），同樣套用在 GAS 的 `JavaScript.html` / `Index.html` 和這裡的 `index.html`
- 雲端音樂前端模組：GitHub 版是 `../drive.js`，GAS 版直接貼在 `JavaScript.html` 最後面
