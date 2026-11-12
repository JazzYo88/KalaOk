// ✨ GitHub Pages 版才有的功能（GAS 框架裡做不到的）
(function () {
  window.JK_ARTWORK = new URL('icon-512.png', location.href).href;  // 鎖定畫面播放控制的封面圖
  // ---------- ⌨️ 打字時不要讓播放器擋住輸入框 ----------
  // 手機鍵盤打開後畫面只剩一小塊，頂端固定的「影片＋字幕」會把搜尋框整個蓋住
  var style = document.createElement('style');
  style.textContent =
    'body.typing #sticky-player-wrapper { position: relative !important; }' +
    '@media screen and (max-width: 849px) { body.typing #lyrics-box { display: none !important; } }' +
    'body.typing #custom-prompt-overlay { align-items: flex-start !important; padding-top: 8vh; }' +
    '#voice-btn.listening { background: #E91E63 !important; color: #fff; animation: jkPulse 1s infinite; }' +
    '@keyframes jkPulse { 50% { transform: scale(1.12); } }';
  document.head.appendChild(style);

  function isTextInput(el) {
    return !!el && ((el.tagName === 'INPUT' && /^(text|search|)$/i.test(el.type || '')) || el.tagName === 'TEXTAREA');
  }
  // 把正在打字的輸入框捲到畫面上方（iPhone 鍵盤蓋住下半部、Android 畫面會變矮，放上面最保險）
  function bringIntoView(el) {
    if (!el || el.closest('#custom-prompt-overlay') || el.closest('#lyrics-pick-overlay')) return;  // 對話框本身是固定在畫面上的
    var r = el.getBoundingClientRect();
    var vv = window.visualViewport;
    var vh = vv ? vv.height : window.innerHeight;
    var off = vv ? vv.offsetTop : 0;          // iPhone 鍵盤打開時，可見區域可能往下位移
    var top = r.top - off;
    if (top < 60 || top + r.height > vh - 20) window.scrollBy(0, top - 80);
  }
  document.addEventListener('focusin', function (e) {
    if (!isTextInput(e.target)) return;
    document.body.classList.add('typing');
    var el = e.target;
    setTimeout(function () { bringIntoView(el); }, 350);
  });
  function onViewportResize() {
    if (document.body.classList.contains('typing') && isTextInput(document.activeElement)) {
      setTimeout(function () { bringIntoView(document.activeElement); }, 100);
    }
  }
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onViewportResize);
  window.addEventListener('resize', onViewportResize);
  document.addEventListener('focusout', function () {
    setTimeout(function () {
      if (!isTextInput(document.activeElement)) document.body.classList.remove('typing');
    }, 150);
  });
  // 按鍵盤的「搜尋 / 前往」直接搜尋，並收起鍵盤
  var searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.setAttribute('enterkeyhint', 'search');
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); searchInput.blur(); executeSearch(); }
    });
  }

  function longToast(msg) {
    toast(msg);
    var el = document.getElementById('jk-toast');
    if (el) { clearTimeout(el._t); el._t = setTimeout(function () { el.style.opacity = '0'; }, 5000); }
  }

  // ---------- 🎤 語音點歌 ----------
  // iPhone 上只有 Safari 支援網頁語音辨識；Chrome、LINE 等 App 內的瀏覽器沒有，
  // 這時改成打開鍵盤，讓家人用鍵盤上的 🎤 聽寫，一樣可以用說的。
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var ua = navigator.userAgent;
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var iosNotSafari = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|Line\/|FBAN|FBAV|Instagram|GSA\//.test(ua);
  var canRecognize = !!SR && !iosNotSafari;
  var btn = document.getElementById('voice-btn');
  if (btn) btn.style.display = '';   // 每台手機都顯示，不支援的就用鍵盤聽寫

  function useKeyboardDictation(reason) {
    var input = document.getElementById('search-input');
    input.value = '';
    input.focus();
    longToast((reason ? reason + '\n' : '') + '請按鍵盤上的 🎤 麥克風說歌名，說完按「搜尋」');
  }

  var listening = false, rec = null, startTimer = null;
  window.voiceSearch = function () {
    if (!canRecognize) { useKeyboardDictation(isIOS ? '這個瀏覽器不支援網頁語音' : ''); return; }
    if (listening && rec) { try { rec.stop(); } catch (e) {} return; }

    var input = document.getElementById('search-input');
    var finalText = '', started = false, failed = false;
    try {
      rec = new SR();
      rec.lang = 'zh-TW';
      rec.interimResults = true;
      rec.maxAlternatives = 1;
    } catch (e) { canRecognize = false; useKeyboardDictation('語音功能無法啟動'); return; }

    rec.onstart = function () {
      started = true; listening = true;
      clearTimeout(startTimer);
      btn.innerText = '⏹️'; btn.classList.add('listening');
      input.value = ''; input.placeholder = '請說歌名或歌手…';
      toast('🎤 請說歌名…');
    };
    rec.onresult = function (e) {
      var text = '';
      for (var i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      input.value = text;
      if (e.results[e.results.length - 1].isFinal) finalText = text;
    };
    rec.onerror = function (e) {
      failed = true;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        canRecognize = false;
        useKeyboardDictation(isIOS ? '請到「設定 → Siri」開啟 Siri 與聽寫，或' : '麥克風沒有開放權限，');
      } else if (e.error === 'no-speech') toast('沒有聽到聲音，再按一次 🎤');
      else if (e.error !== 'aborted') toast('⚠️ 語音辨識失敗：' + e.error);
    };
    rec.onend = function () {
      listening = false; clearTimeout(startTimer);
      btn.innerText = '🎤'; btn.classList.remove('listening');
      input.placeholder = '輸入歌名，例如：鄧麗君、老歌...';
      if (failed) return;
      // 說「播放 / 我要聽 / 點歌」這類開頭會自動去掉
      var q = (finalText || input.value || '').replace(/^(請)?(幫我)?(播放|我要聽|我想聽|點歌|放)\s*/, '').replace(/[。，！？]$/, '').trim();
      if (q) { input.value = q; executeSearch(); }
    };

    // 有些手機按了完全沒反應（不報錯也不開始），3 秒內沒開始就改用鍵盤聽寫
    startTimer = setTimeout(function () {
      if (started) return;
      try { rec.abort(); } catch (e) {}
      canRecognize = false;
      useKeyboardDictation('語音沒有回應，改用鍵盤：');
    }, 3000);

    try { rec.start(); }
    catch (e) { clearTimeout(startTimer); canRecognize = false; useKeyboardDictation('語音功能無法啟動，'); }
  };

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
