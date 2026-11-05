// ✨ GitHub Pages 版才有的功能（GAS 框架裡做不到的）
(function () {
  // ---------- 🎤 語音點歌 ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var btn = document.getElementById('voice-btn');
  if (SR && btn) {
    btn.style.display = '';
    var listening = false, rec = null;

    window.voiceSearch = function () {
      if (listening && rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = 'zh-TW';
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      var input = document.getElementById('search-input');
      var finalText = '';

      rec.onstart = function () {
        listening = true;
        btn.innerText = '⏹️';
        btn.style.background = '#E91E63';
        input.placeholder = '請說歌名或歌手…';
      };
      rec.onresult = function (e) {
        var text = '';
        for (var i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        input.value = text;
        if (e.results[e.results.length - 1].isFinal) finalText = text;
      };
      rec.onerror = function (e) {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('⚠️ 請允許使用麥克風');
        else if (e.error === 'no-speech') toast('沒有聽到聲音，再試一次');
        else toast('⚠️ 語音辨識失敗：' + e.error);
      };
      rec.onend = function () {
        listening = false;
        btn.innerText = '🎤';
        btn.style.background = '';
        input.placeholder = '輸入歌名，例如：鄧麗君、老歌...';
        // 說「播放 / 我要聽 / 點歌」這類開頭會自動去掉
        var q = (finalText || input.value || '').replace(/^(請)?(幫我)?(播放|我要聽|我想聽|點歌|放)\s*/, '').replace(/[。，！？]$/, '').trim();
        if (q) { input.value = q; executeSearch(); }
      };
      rec.start();
    };
  }

  // ---------- 🔆 播放時螢幕不自動關閉 ----------
  var wakeLock = null;
  function keepAwake(on) {
    if (!('wakeLock' in navigator)) return;
    if (on && !wakeLock) {
      navigator.wakeLock.request('screen').then(function (w) {
        wakeLock = w;
        w.addEventListener('release', function () { wakeLock = null; });
      }).catch(function () {});
    } else if (!on && wakeLock) {
      wakeLock.release().catch(function () {});
      wakeLock = null;
    }
  }
  // 播放器建立後掛上監聽：播放中保持螢幕亮著，暫停或結束就恢復
  var hookTimer = setInterval(function () {
    if (typeof ytPlayer !== 'undefined' && ytPlayer && typeof ytPlayer.addEventListener === 'function' && window.YT && YT.PlayerState) {
      clearInterval(hookTimer);
      ytPlayer.addEventListener('onStateChange', function (event) {
        keepAwake(event.data === YT.PlayerState.PLAYING);
      });
    }
  }, 500);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && typeof ytPlayer !== 'undefined' && ytPlayer && ytPlayer.getPlayerState &&
        window.YT && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) keepAwake(true);
  });

  // ---------- 🔄 回到畫面時自動更新歌單（多台裝置同步） ----------
  var lastSync = Date.now();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || typeof currentUser === 'undefined' || !currentUser) return;
    if (Date.now() - lastSync < 30000) return;   // 30 秒內不重複抓
    lastSync = Date.now();
    google.script.run.withSuccessHandler(updatePlaylistsData).getUserData(currentUser.id);
  });

  // ---------- 📱 PWA：可加到主畫面 ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
