// 🌐 API 轉接層：讓原本 google.script.run 的寫法，改成用 fetch 呼叫 GAS 的 doPost
// 用法完全不變：google.script.run.withSuccessHandler(fn).withFailureHandler(fn).函式名(參數...)
(function () {
  var API_URL = 'https://script.google.com/macros/s/AKfycbw6i3rsYXwtd0WzBGyiOMxvMTiXPHWX36Rd_kE6NSlAkrZI8nBnPkVcuVNTfVBd-_Xvfg/exec';

  function call(fn, args) {
    // 送 text/plain（不是 application/json），瀏覽器就不會先發預檢請求，GAS 才收得到
    return fetch(API_URL, { method: 'POST', body: JSON.stringify({ fn: fn, args: args }) })
      .then(function (r) {
        if (!r.ok) throw new Error('伺服器回應 ' + r.status);
        return r.json();
      })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || '未知錯誤');
        return res.data;
      });
  }

  function runner(onOk, onFail) {
    return new Proxy({}, {
      get: function (_, name) {
        if (name === 'withSuccessHandler') return function (f) { return runner(f, onFail); };
        if (name === 'withFailureHandler') return function (f) { return runner(onOk, f); };
        if (name === 'withUserObject') return function () { return runner(onOk, onFail); };
        return function () {
          var args = Array.prototype.slice.call(arguments);
          call(String(name), args)
            .then(function (data) { if (onOk) onOk(data); })
            .catch(function (err) {
              if (onFail) onFail(err);
              else console.error('[API] ' + String(name) + ' 失敗：', err);
            });
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = { run: runner(null, null) };
})();
