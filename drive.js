  // =========================================
  // ☁️ 雲端硬碟音樂（自己雲端硬碟裡的音樂檔）
  // 歌單裡的 id 用「gd:檔案ID」表示；雲端音樂獨立成歌單，不跟 YouTube 歌曲混在一起
  // =========================================
  const DRIVE_PREFIX = 'gd:';
  function isDriveId(id) { return typeof id === 'string' && id.indexOf(DRIVE_PREFIX) === 0; }
  function isDrivePlaylist(name) { const l = allPlaylists[name] || []; return l.length > 0 && l.every(v => isDriveId(v.id)); }
  function hasYouTubeSongs(name) { return (allPlaylists[name] || []).some(v => !isDriveId(v.id)); }
  const DRIVE_THUMB = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#1B0B3B"/><stop offset="1" stop-color="#0B1B3D"/></linearGradient></defs>' +
    '<rect width="160" height="90" fill="url(#g)"/><text x="80" y="58" font-size="38" text-anchor="middle">☁️🎵</text></svg>');
  function thumbOf(v) { return isDriveId(v.id) ? DRIVE_THUMB : v.thumbnail; }

  (function addDriveStyle() {
    const st = document.createElement('style');
    st.textContent = `
      #drive-player { width: 100%; aspect-ratio: 16/9; border-radius: 15px; background: linear-gradient(135deg, #1B0B3B, #0B1B3D);
        box-shadow: 0 10px 30px rgba(0,0,0,0.8); display: flex; flex-direction: column; justify-content: center; align-items: center;
        gap: 8px; padding: 12px 14px; text-align: center; font-size: 17px; border: 1px solid rgba(255,223,0,0.25); }
      #drive-player .dp-icon { font-size: 2.2em; line-height: 1; }
      #drive-player .dp-title { font-weight: bold; color: #FFDF00; word-break: break-word; display: -webkit-box;
        -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      #drive-player .dp-sub { font-size: 13px; color: #aaa; }
      #drive-audio { width: 100%; max-width: 520px; }
      #drive-player .dp-ctrl { display: flex; gap: 8px; }
      #drive-player .dp-ctrl button { margin: 0; padding: 6px 14px; font-size: 15px; }`;
    document.head.appendChild(st);
  })();

  // 雲端硬碟的直接播放網址（第一個失敗就換下一個）
  function driveUrls(fileId) {
    return [
      'https://drive.google.com/uc?export=download&id=' + fileId,
      'https://drive.usercontent.google.com/download?id=' + fileId + '&export=download',
      'https://docs.google.com/uc?export=open&id=' + fileId
    ];
  }

  let driveCurrentId = '', driveUrlIdx = 0, driveGoodIdx = 0;   // 記住哪個網址能播，下一首直接用（鎖屏自動換歌比較不會卡）

  function driveAudioEl() {
    const a = document.getElementById('drive-audio');
    if (a && !a._jkHooked) {
      a._jkHooked = true;
      a.addEventListener('ended', () => driveStep(1, true));
      a.addEventListener('error', () => {
        if (!driveCurrentId || !a.getAttribute('src')) return;
        const urls = driveUrls(driveCurrentId.slice(DRIVE_PREFIX.length));
        a._jkTried = (a._jkTried || 0) + 1;
        driveUrlIdx = (driveUrlIdx + 1) % urls.length;
        if (a._jkTried < urls.length) { a.src = urls[driveUrlIdx]; a.play().catch(() => {}); return; }
        driveToast('⚠️ 這首無法播放\n請確認雲端硬碟的檔案已設為「知道連結的任何人都能查看」', 6000);
      });
      a.addEventListener('playing', () => { driveGoodIdx = driveUrlIdx; driveSub(''); setMediaPlaying(true); });
      a.addEventListener('pause', () => setMediaPlaying(false));
      a.addEventListener('waiting', () => driveSub('⏳ 載入中…'));
    }
    return a;
  }

  function driveSub(text) { const s = document.getElementById('drive-sub'); if (s) s.innerText = text; }

  function driveToast(msg, ms) {
    toast(msg);
    const el = document.getElementById('jk-toast');
    if (el) { clearTimeout(el._t); el._t = setTimeout(() => el.style.opacity = '0', ms || 4000); }
  }

  function playDriveAudio(id) {
    const a = driveAudioEl();
    if (!a) return;
    const item = (allPlaylists[playingListName] || []).find(v => v.id === id) || {};
    try { if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); } catch (e) {}
    document.getElementById('player-container').style.display = 'none';
    document.getElementById('drive-player').style.display = '';
    document.getElementById('drive-title').innerText = item.title || '雲端音樂';
    driveSub('⏳ 載入中…');
    driveCurrentId = id; driveUrlIdx = driveGoodIdx; a._jkTried = 0;
    a.src = driveUrls(id.slice(DRIVE_PREFIX.length))[driveUrlIdx];
    const p = a.play();
    if (p && p.catch) p.catch(err => { if (err && err.name === 'NotAllowedError') driveSub('請按 ▶ 開始播放'); });
    updateMediaSession(item.title);
    // 雲端音樂暫時不顯示字幕
    if (typeof lyricsOn !== 'undefined' && lyricsOn) {
      stopLyricsTick(); lyricsVideoId = ''; lyricsLines = []; lyricsCurrent = null; updatePinButton();
      setLyricLines('', '☁️ 雲端音樂暫不顯示字幕', '');
      setLyricsInfo('☁️ 雲端音樂');
    }
  }

  function stopDriveAudio() {
    const a = document.getElementById('drive-audio');
    if (a && a.getAttribute('src')) { a.pause(); a.removeAttribute('src'); a.load(); }
    driveCurrentId = '';
    const dp = document.getElementById('drive-player'), pc = document.getElementById('player-container');
    if (dp) dp.style.display = 'none';
    if (pc) pc.style.display = '';
  }

  // 上一首 / 下一首（auto = 播完自動換下一首）
  function driveStep(step, auto) {
    const a = document.getElementById('drive-audio');
    const list = allPlaylists[playingListName] || [];
    if (auto && loopMode === 'single' && a) { a.currentTime = 0; a.play().catch(() => {}); return; }
    if (!list.length) return;
    let i = currentPlayIndex < 0 ? 0 : (currentPlayIndex + step + list.length) % list.length;
    playVideo(list[i].id, i, playingListName);
  }

  // 鎖定畫面 / 通知列的播放控制
  let mediaHandlersSet = false;
  function updateMediaSession(title) {
    if (!('mediaSession' in navigator)) return;
    try {
      const art = window.JK_ARTWORK ? [{ src: window.JK_ARTWORK, sizes: '512x512', type: 'image/png' }] : [];
      navigator.mediaSession.metadata = new MediaMetadata({ title: title || '雲端音樂', artist: '魔法點唱機', album: playingListName || '', artwork: art });
      if (!mediaHandlersSet) {
        mediaHandlersSet = true;
        const a = () => document.getElementById('drive-audio');
        navigator.mediaSession.setActionHandler('play', () => a() && a().play());
        navigator.mediaSession.setActionHandler('pause', () => a() && a().pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => driveStep(-1));
        navigator.mediaSession.setActionHandler('nexttrack', () => driveStep(1));
        try { navigator.mediaSession.setActionHandler('seekto', d => { if (a() && d.seekTime != null) a().currentTime = d.seekTime; }); } catch (e) {}
      }
    } catch (e) {}
  }
  function setMediaPlaying(on) {
    if ('mediaSession' in navigator && driveCurrentId) { try { navigator.mediaSession.playbackState = on ? 'playing' : 'paused'; } catch (e) {} }
  }

  // ☁️ 加入雲端音樂：貼資料夾連結（整批匯入）或歌曲連結（可一次貼多個）
  function openDriveImportPrompt() {
    if (!currentUser) return;
    promptMode = 'driveImport';
    const toNew = !activePlaylistName || hasYouTubeSongs(activePlaylistName);
    document.getElementById('custom-prompt-title').innerText = toNew
      ? '貼上雲端硬碟「資料夾」或「歌曲」的分享連結\n（會建立新的雲端歌單）'
      : `貼上雲端硬碟「資料夾」或「歌曲」的分享連結\n加入 [${activePlaylistName}]`;
    const input = document.getElementById('custom-prompt-input');
    input.value = '';
    input.placeholder = 'https://drive.google.com/…（多個連結用空白隔開）';
    document.getElementById('custom-prompt-overlay').style.display = 'flex';
    input.focus();
  }

  function importDriveLinks(text) {
    const target = (!activePlaylistName || hasYouTubeSongs(activePlaylistName)) ? '' : activePlaylistName;
    document.getElementById('custom-prompt-input').placeholder = '';
    document.getElementById('playlist-list').innerHTML = '☁️ 讀取雲端硬碟中…（歌曲多的資料夾要等一下）';
    google.script.run
      .withSuccessHandler(res => {
        if (res.playlistName && (res.playlists || {})[res.playlistName]) activePlaylistName = res.playlistName;
        updatePlaylistsData(res.playlists);
        let msg = `☁️ 加入 ${res.added} 首` + (res.playlistName ? ` 到 [${res.playlistName}]` : '');
        if (res.skipped) msg += `，${res.skipped} 首已經在歌單裡`;
        if (res.notPublic) msg += `\n⚠️ 有 ${res.notPublic} 首沒有設定「知道連結的任何人都能查看」，可能無法播放`;
        if (res.errors && res.errors.length) msg += '\n' + res.errors.slice(0, 2).join('\n');
        driveToast(msg, 7000);
      })
      .withFailureHandler(err => {
        updatePlaylistsData(allPlaylists);
        driveToast('⚠️ ' + err.message, 6000);
      })
      .addDriveLinks(currentUser.id, target, text);
  }
