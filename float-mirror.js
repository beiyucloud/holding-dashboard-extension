// 浮窗版镜像：把完整看板的持仓/股票/汇率同步进 chrome.storage.local，供 content script 浮窗读取。
// 背景：MV3 后台(service worker)没有 localStorage，浮窗数据只能走 chrome.storage.local；
// 而看板本体把持仓写在 localStorage，故需把 localStorage 的持仓键镜像到 chrome.storage.local。
//
// 为何独立成文件：dashboard.html 的 inline <script> 会被 MV3 默认 CSP（script-src 'self'）拦截，
// 不执行 → chrome.storage.local 永远为空 → 浮窗读不到持仓。外链脚本(src)不受该限制，故抽成本文件。
//
// 本文件需在 dashboard.js 之前加载：
//   1) 加载时先快照一次既有 localStorage 持仓；
//   2) 包装 Storage.prototype.setItem，此后看板每次保存持仓都实时镜像。
// 另：主题键 fund_board_theme 也从这里进 chrome.storage.local（copy-if-absent），
// 作为网页浮窗 / popup / 看板三端主题联动的共享源。
(function () {
  try {
    var KEYS = ['fund_board_holdings_v2', 'fund_board_holdings_v1', 'fund_board_stocks_v1', 'fund_board_fx_v1'];
    var THEME_KEY = 'fund_board_theme';
    var snap = {};
    KEYS.forEach(function (k) { var v = localStorage.getItem(k); if (v !== null) snap[k] = v; });
    if (Object.keys(snap).length) chrome.storage.local.set(snap);

    // 主题：仅当 storage 尚无主题时，才把 localStorage 里的旧主题搬过去（避免覆盖浮窗刚选的主题）；
    // 看板 toggleTheme 也会直接写 storage，这里兜底迁移 + setItem 监听双保险。
    chrome.storage.local.get([THEME_KEY], function (o) {
      if (o && o[THEME_KEY] !== undefined) return;
      var v = null;
      try { v = localStorage.getItem(THEME_KEY); } catch (e) {}
      if (v === 'light' || v === 'dark') { var t = {}; t[THEME_KEY] = v; try { chrome.storage.local.set(t); } catch (e) {} }
    });

    var origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      var r = origSet.apply(this, arguments);
      if ((KEYS.indexOf(k) !== -1 || k === THEME_KEY) && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        var o = {}; o[k] = v; try { chrome.storage.local.set(o); } catch (e) {}
      }
      return r;
    };
  } catch (e) {}
})();
