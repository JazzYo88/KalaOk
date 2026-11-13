

// --- 7. ☁️ 雲端硬碟音樂 ---
// 第一次使用前：在編輯器選 authDrive 按「執行」，同意「查看雲端硬碟檔案」的權限
function authDrive() {
  Logger.log('雲端硬碟權限 OK：' + DriveApp.getRootFolder().getName());
}

// 貼上資料夾或歌曲的分享連結（可多個，用空白隔開），把音樂檔加進歌單
// playlistName 空白 = 建立新的雲端歌單（用資料夾名稱命名）
function addDriveLinks(userId, playlistName, text) {
  var links = parseDriveLinks_(text);
  if (!links.length) throw new Error('找不到雲端硬碟連結，請貼上資料夾或歌曲的「分享連結」');

  var files = [], errors = [], folderName = '';
  links.forEach(function (x) {
    try {
      if (x.type !== 'file') {
        try {
          var folder = DriveApp.getFolderById(x.id);
          if (!folderName) folderName = folder.getName();
          var list = [], it = folder.getFiles();
          while (it.hasNext()) { var f = it.next(); if (isAudioFile_(f)) list.push(f); }
          list.sort(function (a, b) { return a.getName().localeCompare(b.getName(), 'zh-Hant', { numeric: true }); });
          if (!list.length) errors.push('資料夾「' + folder.getName() + '」裡沒有找到音樂檔');
          files = files.concat(list);
          return;
        } catch (notFolder) {
          if (x.type === 'folder') throw notFolder;   // 明確是資料夾連結卻打不開
        }
      }
      var file = DriveApp.getFileById(x.id);
      if (!isAudioFile_(file)) { errors.push('「' + file.getName() + '」不是音樂檔'); return; }
      files.push(file);
    } catch (e) {
      errors.push('有一個連結打不開，請確認連結正確、而且這個 Google 帳號看得到');
    }
  });

  return withLock_(function () {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Playlists');
    var data = sheet.getDataRange().getValues();
    var target = String(playlistName || '').trim();
    // 雲端音樂獨立成歌單：目標歌單裡已經有 YouTube 歌，就改建新的雲端歌單
    if (target && data.some(function (r, i) { return i > 0 && r[0] == userId && r[1] == target && r[2] && String(r[2]).indexOf('gd:') !== 0; })) target = '';
    if (!target) target = '☁️ ' + (folderName || '雲端音樂');

    var existing = {};
    for (var i = 1; i < data.length; i++) if (data[i][0] == userId && data[i][1] == target && data[i][2]) existing[data[i][2]] = true;

    var rows = [], skipped = 0, notPublic = 0;
    files.forEach(function (file) {
      var id = 'gd:' + file.getId();
      if (existing[id]) { skipped++; return; }
      existing[id] = true;
      try {
        var acc = file.getSharingAccess();
        if (acc !== DriveApp.Access.ANYONE && acc !== DriveApp.Access.ANYONE_WITH_LINK) notPublic++;
      } catch (e) {}
      rows.push([userId, target, id, cleanSongName_(file.getName()), '']);
    });
    if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);

    return { playlists: getUserData(userId), playlistName: target, added: rows.length, skipped: skipped, notPublic: notPublic, errors: errors };
  });
}

function parseDriveLinks_(text) {
  var out = [], seen = {};
  String(text || '').split(/[\s,，]+/).forEach(function (s) {
    var m, item = null;
    if ((m = s.match(/\/folders\/([a-zA-Z0-9_-]{10,})/))) item = { type: 'folder', id: m[1] };
    else if ((m = s.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/))) item = { type: 'file', id: m[1] };
    else if ((m = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/))) item = { type: 'unknown', id: m[1] };
    if (item && !seen[item.id]) { seen[item.id] = true; out.push(item); }
  });
  return out;
}

function isAudioFile_(file) {
  var mime = String(file.getMimeType() || ''), name = String(file.getName() || '');
  if (/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i.test(name)) return true;
  return mime.indexOf('audio/') === 0 && !/x-ms-wma/i.test(mime);
}

// 檔名當歌名：去掉副檔名和開頭的曲目編號（01、01.、01-）
function cleanSongName_(name) {
  return String(name).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/^\s*\d{1,3}\s*[-._、)]\s*/, '').replace(/^\s*\d{1,3}\s+/, '').trim() || String(name);
}

// ☁️ 伺服器代載：手機直接向雲端硬碟要檔案被擋下時，由點唱機伺服器分段下載再交給手機播放
// 安全限制：只代載「點唱機歌單裡有的」而且「有公開分享」的檔案，避免變成任何人都能下載整個雲端硬碟
var DRIVE_CHUNK_ = 4 * 1024 * 1024;
function getDriveAudioChunk(fileId, part) {
  fileId = String(fileId || '').replace(/[^\w-]/g, '');
  part = Math.max(0, parseInt(part, 10) || 0);
  if (!fileId) throw new Error('缺少檔案');

  var cache = CacheService.getScriptCache(), key = 'gdmeta_' + fileId;
  var meta = cache.get(key);
  if (meta) meta = JSON.parse(meta);
  else {
    var ids = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Playlists').getRange('C:C').getValues();
    var inList = ids.some(function (r) { return r[0] === 'gd:' + fileId; });
    if (!inList) throw new Error('這首不在點唱機的歌單裡');
    var f = DriveApp.getFileById(fileId), acc = f.getSharingAccess();
    if (acc !== DriveApp.Access.ANYONE && acc !== DriveApp.Access.ANYONE_WITH_LINK) throw new Error('這個檔案沒有公開分享');
    meta = { mime: f.getMimeType(), size: f.getSize() };
    if (meta.size > 60 * 1024 * 1024) throw new Error('檔案超過 60MB，太大了');
    cache.put(key, JSON.stringify(meta), 3600);
  }

  var parts = Math.max(1, Math.ceil(meta.size / DRIVE_CHUNK_));
  if (part >= parts) throw new Error('段落超出範圍');
  var start = part * DRIVE_CHUNK_, end = Math.min(meta.size, start + DRIVE_CHUNK_) - 1;
  var res = UrlFetchApp.fetch('https://drive.usercontent.google.com/download?id=' + fileId + '&export=download',
    { headers: { Range: 'bytes=' + start + '-' + end }, muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code !== 206 && !(code === 200 && parts === 1)) throw new Error('雲端硬碟回應 ' + code);
  return { mime: meta.mime, size: meta.size, parts: parts, part: part, data: Utilities.base64Encode(res.getContent()) };
}
