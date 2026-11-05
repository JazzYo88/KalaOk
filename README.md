# 魔法點唱機（GitHub Pages 版）

家用點唱機的前端，後端仍是原本的 Google Apps Script 與 Google 試算表。

- 網址：`https://jazzyo88.github.io/KalaOk/?group=我家`
- 前端呼叫 GAS 網頁應用程式的 `doPost`（見 `api.js`），只開放點唱機原本使用的函式
- 這個版本多了：🎤 語音點歌、播放時螢幕不自動關、回到畫面自動同步歌單、可加到手機主畫面

`index.html` 由 Apps Script 專案的 Index / Stylesheet / JavaScript 三個檔案合併而成，
修改功能時兩邊要一起更新。
