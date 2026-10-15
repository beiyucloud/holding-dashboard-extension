/* popup.js —— 工具栏图标弹出面板（popup.html）的数据与渲染
   与网页浮窗（float.js）共用同一套数据源与口径：
   持仓来自 chrome.storage.local（由完整看板 float-mirror.js 镜像写入），
   实时数据经 bg.js xfetch 中转（基金走东财 FundMNewApi/FundMNFInfo，股票/汇率走腾讯 qt.gtimg.cn）。 */
(function () {
  var STORE_KEYS = ['fund_board_holdings_v2', 'fund_board_holdings_v1', 'fund_board_stocks_v1', 'fund_board_fx_v1', 'float_privacy'];
  var S = {
    init: null,
    fundInfo: {},
    stockInfo: {},
    fx: { USD: 7.0, HKD: 0.90 },
    privacy: false,
    loading: false
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtNum(n, d) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  }
  function fmtPct(n) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return (n > 0 ? '+' : '') + Number(n).toFixed(2) + '%';
  }
  function upDown(n) { return n > 0 ? 'up' : (n < 0 ? 'down' : 'flat'); }
  function curOf(code) {
    if (/^hk/i.test(code)) return 'HKD';
    if (/^us/i.test(code)) return 'USD';
    return 'CNY';
  }
  function fxRate(cur) { return cur === 'CNY' ? 1 : (S.fx[cur] || 1); }
  // popup 与看板同扩展源，可直读看板 localStorage；作为 chrome.storage.local 镜像的兜底，确保镜像为空时也能拿到持仓
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function xfetch(url) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage({ type: 'xfetch', url: url }, function (r) {
          if (r && r.ok) resolve({ ok: true, body: r.body });
          else resolve({ ok: false, error: (r && r.error) || 'no-response' });
        });
      } catch (e) { resolve({ ok: false, error: String(e) }); }
    });
  }

  /* ---- 解析：东财 fundmobapi（基金最新净值，字段与 float.js 一致） ---- */
  function parseFundMobapi(body) {
    var map = {};
    try {
      var j = JSON.parse(body);
      var arr = (j && (j.Datas || j.datas)) || [];
      var today = new Date();
      arr.forEach(function (it) {
        if (!it || !it.FCODE) return;
        var nav = parseFloat(it.NAV), chg = parseFloat(it.NAVCHGRT);
        var pd = (it.PDATE || '').replace(/\//g, '-');
        var y = pd.slice(0, 4), m = pd.slice(5, 7), d = pd.slice(8, 10);
        var isToday = (y == today.getFullYear() && m == (today.getMonth() + 1) && d == today.getDate());
        /* 与看板表格同源：盘中优先东财官方盘中估值（GSZ 日期=今天且 09:15-15:05 才认） */
        var gz = parseFloat(it.GSZ), gzzl = (it.GSZZL !== null && it.GSZZL !== undefined && it.GSZZL !== '') ? parseFloat(it.GSZZL) : NaN;
        var gzDate = ((it.GZTIME || '') + '').slice(0, 10).replace(/\//g, '-');
        var nowMin = today.getHours() * 60 + today.getMinutes();
        var gzToday = gzDate === (today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2));
        if (!isNaN(gz) && !isNaN(gzzl) && gzToday && nowMin >= 555 && nowMin <= 905) {
          map[it.FCODE] = { gsz: gz, dwjz: isNaN(nav) ? gz : nav, gszzl: gzzl, estType: 'official', name: it.SHORTNAME || it.FCODE };
        } else {
          map[it.FCODE] = {
            gsz: isNaN(nav) ? null : nav,
            dwjz: isNaN(nav) ? null : nav,
            gszzl: isNaN(chg) ? null : chg,
            estType: isToday ? 'nav' : 'yNav',
            name: it.SHORTNAME || it.FCODE
          };
        }
      });
    } catch (e) {}
    return map;
  }
  /* ---- 解析：腾讯 qt.gtimg.cn（股票/汇率，bg 侧已按 GBK 解码） ---- */
  function parseQt(body) {
    var stocks = {}, fx = {};
    var re = /v_([A-Za-z0-9_.]+)="([^"]*)"/g, m;
    while ((m = re.exec(body))) {
      var code = m[1], raw = m[2];
      if (!raw) continue;
      var p = raw.split('~');
      if (/^fx/i.test(code)) {
        var rate = parseFloat(p[3]);
        if (!isNaN(rate)) fx[code.replace(/^fx/, '').toUpperCase()] = rate;
        continue;
      }
      var price = parseFloat(p[3]), prev = parseFloat(p[4]);
      var pct = (price && prev) ? (price - prev) / prev * 100 : null;
      stocks[code] = { price: price, prevClose: prev, pct: pct, name: p[1] || code };
    }
    return { stocks: stocks, fx: fx };
  }

  /* ---- 新浪今日分时估算（与看板/浮窗同源）：末点 pre_date 为今日才采信 ---- */
  function sinaToday() {
    var t = new Date();
    return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  }
  function fetchSinaEst(code) {
    return new Promise(function (resolve) {
      xfetch('https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/FdFundService.getEstimateNetworthPic?symbol=' + code).then(function (r) {
        if (!r || !r.ok) return resolve(null);
        try {
          var d = JSON.parse(r.body);
          d = (d && d.result && d.result.data) || {};
          var arr = d.networth || [];
          if (!arr.length) return resolve(null);
          var lp = arr[arr.length - 1];
          var prevNav = parseFloat(lp.pre_nav), pct = parseFloat(lp.nav_pct);
          /* 与看板表格同源同口径：直接采信序列末点（盘中=今日实时估算；盘前/周末=上一交易日收盘估算），
             不再要求 pre_date===今天——盘前拒掉会让 popup 回退官方 NAVCHGRT 口径、与看板表格两套数字 */
          if (isNaN(prevNav) || isNaN(pct)) return resolve(null);
          /* 🔴 新浪 pre_nav 实为「今日估算净值」= 官方昨收×(1+pct/100)，不是昨收！
             gsz 取 pre_nav；官方昨收反推 = pre_nav/(1+pct/100)——与看板表格同口径 */
          resolve({
            gsz: +prevNav.toFixed(4),                        // 今日估算净值（=新浪 pre_nav 本义）
            dwjz: pct ? +(prevNav / (1 + pct / 100)).toFixed(4) : prevNav,   // 官方昨收（反推）
            gszzl: pct
          });
        } catch (e) { resolve(null); }
      }, function () { resolve(null); });
    });
  }

  function calcFund(h) {
    var info = S.fundInfo[h.code] || null;
    var r = { mv: null, pnl: null, cum: null, cumPct: null };
    if (!info || !(info.gsz != null || info.dwjz != null) || !h.shares) return r;
    var mv = h.shares * (info.gsz != null ? info.gsz : info.dwjz);
    r.mv = mv;
    if (info.estType === 'nav' && info.gszzl != null) {
      r.pnl = mv * info.gszzl / 100;
    } else if (info.estType === 'yNav' && info.gszzl != null) {
      r.pnl = mv * info.gszzl / 100;
    } else if (info.gsz != null && info.dwjz != null) {
      r.pnl = h.shares * (info.gsz - info.dwjz);
    } else if (info.gszzl != null) {
      r.pnl = mv * info.gszzl / 100;
    }
    if (h.cost != null && info.dwjz != null) {
      var cb = h.shares * h.cost;
      r.cum = h.shares * info.dwjz - cb;
      r.cumPct = cb ? r.cum / cb * 100 : null;
    }
    return r;
  }
  function calcStock(s) {
    var info = S.stockInfo[s.code] || null;
    var r = { mv: null, pnl: null, cum: null, cumPct: null, cur: curOf(s.code) };
    if (!info || info.price == null || !s.shares) return r;
    r.mv = s.shares * info.price;
    if (info.prevClose) r.pnl = s.shares * (info.price - info.prevClose);
    if (s.cost) {
      r.cum = s.shares * (info.price - s.cost);
      var costMv = s.shares * s.cost;
      r.cumPct = costMv ? r.cum / costMv * 100 : null;
    }
    return r;
  }

  /* ---- 渲染 ---- */
  function render() {
    if (!S.init) return;
    var holdings = S.init.holdings || [];
    var stocks = S.init.stocks || [];
    var totMv = 0, totPnl = 0, totCum = 0, hasMv = false, hasPnl = false, hasCum = false;
    /* 顶部汇总优先用 SW 算好的合计（单一数据源），与看板/角标零偏差；仅当快照过期才回退独立逐只算 */
    var _snapFresh = S.snapTot && S.snapTs && (Date.now() - S.snapTs) < 5 * 60 * 1000;
    if (_snapFresh) {
      totMv = (S.snapTot.mv != null) ? S.snapTot.mv : totMv; hasMv = (S.snapTot.mv != null);
      totPnl = (S.snapTot.pnl != null) ? S.snapTot.pnl : totPnl; hasPnl = (S.snapTot.pnl != null);
      totCum = (S.snapTot.cum != null) ? S.snapTot.cum : totCum; hasCum = (S.snapTot.cum != null);
    }
    /* 关键：快照新鲜时，汇总已用上面的快照合计；下面逐项循环只负责渲染行，
       绝不能再累加到 tot*，否则会变成「快照合计 + 逐项」= 翻倍（此前 -20,916 即看板 -10,458 的两倍）。
       仅当快照过期（无新鲜快照）时才走逐项累加兜底。 */
    holdings.forEach(function (h) {
      var r = calcFund(h);
      if (!_snapFresh) {
        if (r.mv != null) { totMv += r.mv; hasMv = true; }
        if (r.pnl != null) { totPnl += r.pnl; hasPnl = true; }
        if (r.cum != null) { totCum += r.cum; hasCum = true; }
      }
    });
    stocks.forEach(function (s) {
      var r = calcStock(s);
      var f = fxRate(r.cur);
      if (!_snapFresh) {
        if (r.mv != null) { totMv += r.mv * f; hasMv = true; }
        if (r.pnl != null) { totPnl += r.pnl * f; hasPnl = true; }
        if (r.cum != null) { totCum += r.cum * f; hasCum = true; }
      }
    });
    var priv = S.privacy;
    $('ppTotal').textContent = hasMv ? (priv ? '****' : '¥' + fmtNum(totMv)) : '--';
    $('ppPnl').textContent = hasPnl ? (priv ? '****' : (totPnl >= 0 ? '+' : '-') + '¥' + fmtNum(Math.abs(totPnl))) : '--';
    $('ppPnl').className = upDown(totPnl);
    $('ppCum').textContent = hasCum ? (priv ? '****' : (totCum >= 0 ? '+' : '-') + '¥' + fmtNum(Math.abs(totCum))) : '--';
    $('ppCum').className = upDown(totCum);

    /* 角标由 bg.js 单一负责（SW 始终在线重算快照时统一设置，含隐私模式清空），
       此处不再推，避免多端写角标互相覆盖造成不一致。 */

    var rows = '';
    if (holdings.length) {
      rows += '<div class="pp-grp">基金 · ' + holdings.length + '</div>';
      holdings.forEach(function (h) {
        var info = S.fundInfo[h.code] || null;
        var r = calcFund(h);
        rows += row((info && info.name) || h.name || h.code, r.cum, r.cumPct, info ? info.gszzl : null, h.code, info && info.name);
      });
    }
    if (stocks.length) {
      rows += '<div class="pp-grp">股票 · ' + stocks.length + '</div>';
      stocks.forEach(function (s) {
        var info = S.stockInfo[s.code] || null;
        var r = calcStock(s);
        var cumCny = r.cum != null ? r.cum * fxRate(r.cur) : null;
        rows += row((info && info.name) || s.name || s.code, cumCny, r.cumPct, info ? info.pct : null, s.code, info && info.name);
      });
    }
    $('ppList').innerHTML = rows || '<div class="pp-empty">暂无持仓，去扩展看板里添加</div>';

    var tag = [];
    if (S.loading) tag.push('刷新中…');
    else if (S.upd) tag.push('更新 ' + S.upd);
    $('ppStatus').textContent = tag.join(' · ') || ('已载入 ' + (holdings.length + stocks.length) + ' 项');
  }
  function row(name, cum, cumPct, dayPct, code, tip) {
    var cumTxt = (cum == null || isNaN(cum)) ? '--' : (S.privacy ? '****' : (cum >= 0 ? '+' : '-') + '¥' + fmtNum(Math.abs(cum)));
    var pctTxt = (cumPct == null || isNaN(cumPct)) ? '--' : (S.privacy ? '****' : fmtPct(cumPct));
    var dayTxt = (dayPct == null || isNaN(dayPct)) ? '--' : fmtPct(dayPct);
    var title = tip ? (tip + '（' + code + '）') : code;
    return '<div class="pp-row" title="' + esc(title) + '">' +
      '<div class="pp-nm">' + esc(name) + '</div>' +
      '<div class="pp-num ' + upDown(cum) + '">' + esc(cumTxt) + '</div>' +
      '<div class="pp-num ' + upDown(cumPct) + '">' + esc(pctTxt) + '</div>' +
      '<div class="pp-pct ' + ((dayPct == null || isNaN(dayPct)) ? 'flat' : upDown(dayPct)) + '">' + esc(dayTxt) + '</div></div>';
  }

  // ============ 看板计算结果快照（三处一致的关键） ============
  function readCalcSnapshot() {
    return new Promise(function (resolve) {
      if (!(chrome && chrome.storage && chrome.storage.local)) return resolve(null);
      chrome.storage.local.get('fund_board_calc', function (o) {
        var s = o && o.fund_board_calc;
        resolve(s && s.fundInfo ? s : null);
      });
    });
  }
  function snapFresh(ts) { return ts && (Date.now() - ts) < 5 * 60 * 1000; }
  /* 一致性的关键：看板是单一数据源，popup/浮窗统一镜像看板发布的 fund_board_calc 快照。
     原 5 分钟 gate 在看板标签页隐藏/关闭（自动刷新暂停）后会让快照过期，
     导致 popup/浮窗改走独立取数、与冻结的看板数字脱节。
     改为「同一天内即采信」，保证四处数字始终跟随看板（含盘前/周末的昨日盈亏口径）；
     跨天或从无快照时才回退独立取数。 */
  function snapUsable(snap) {
    if (!snap || !snap.fundInfo || !snap.ts) return false;
    var d1 = new Date(snap.ts), d2 = new Date();
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  }
  function applyCalcSnapshot(snap) {
    if (!snap || !snap.fundInfo) return false;
    S.fundInfo = snap.fundInfo;
    if (snap.stockInfo) S.stockInfo = snap.stockInfo;
    if (snap.fx) {
      if (snap.fx.USD) S.fx.USD = snap.fx.USD;
      if (snap.fx.HKD) S.fx.HKD = snap.fx.HKD;
    }
    S.snapTs = snap.ts;
    S.snapTot = { mv: snap.totMv, pnl: snap.totPnl, cum: snap.totCum };
    return true;
  }

  // ============ 刷新（优先复用看板快照保持三处一致；看板未开才独立取数） ============
  function done() {
    S.loading = false;
    var d = new Date();
    S.upd = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
    render();
  }
  function refresh() {
    if (S.loading || !S.init) return;
    S.loading = true; render();
    readCalcSnapshot().then(function (snap) {
      if (snap && snapUsable(snap) && applyCalcSnapshot(snap)) { done(); return; }
      // 看板未开时由 SW 始终在线重算快照——保证四处数字一致，无需打开全屏看板
      try {
        chrome.runtime.sendMessage({ type: 'ensureSnapshot' }, function () {
          readCalcSnapshot().then(function (snap2) {
            if (snap2 && snapUsable(snap2) && applyCalcSnapshot(snap2)) { done(); }
            else doFetch(); // SW 不可用时的兜底
          });
        });
      } catch (e) { doFetch(); }
    });
  }
  function doFetch() {
    var holdings = S.init.holdings || [];
    var stocks = S.init.stocks || [];
    var fundCodes = holdings.map(function (h) { return h.code; }).filter(Boolean);
    var stockCodes = stocks.map(function (s) { return s.code; }).filter(Boolean);
    var needFx = stocks.some(function (s) { return curOf(s.code) !== 'CNY'; });
    var fxCodes = ['fxUSDCNY', 'fxHKDCNY'];
    var tasks = [];
    if (fundCodes.length) {
      tasks.push(xfetch('https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=200&plat=Android&appType=ttjj&product=EFund&Version=1&deviceid=fundboard&Fcodes=' + fundCodes.join(',')).then(function (r) {
        if (r.ok) S.fundInfo = parseFundMobapi(r.body);
      }));
      tasks.push(Promise.all(fundCodes.map(function (code) {
        return fetchSinaEst(code).then(function (est) { return [code, est]; });
      })).then(function (list) {
        list.forEach(function (pair) {
          var code = pair[0], est = pair[1];
          if (!est) return;
          var cur = S.fundInfo[code] || {};
          if (cur.estType === 'nav' || cur.estType === 'official') return; /* 官方净值已公布或已有东财盘中估值（与看板同源） → 不被新浪估算覆盖 */
          S.fundInfo[code] = {
            gsz: est.gsz,
            dwjz: est.dwjz,
            gszzl: est.gszzl,
            estType: 'est',
            name: (cur && cur.name) || code
          };
        });
      }));
    }
    var allQt = stockCodes.concat(needFx ? fxCodes : []);
    if (allQt.length) {
      tasks.push(xfetch('https://qt.gtimg.cn/q=' + allQt.join(',')).then(function (r) {
        if (r.ok) {
          var parsed = parseQt(r.body);
          S.stockInfo = parsed.stocks;
          if (needFx && parsed.fx.USDCNY) S.fx.USD = parsed.fx.USDCNY;
          if (needFx && parsed.fx.HKDCNY) S.fx.HKD = parsed.fx.HKDCNY;
        }
      }));
    }
    Promise.all(tasks).then(function () {
      S.loading = false;
      var d = new Date();
      S.upd = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
      render();
    });
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'pp-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  /* ---- 主题：chrome.storage.local 为网页浮窗 / popup / 看板三端共享源（content script 读不到 localStorage），
         localStorage 仅作兼容兜底；boot 时以 storage 为先，浮窗改动经 onChanged 实时跟随 ---- */
  var THEME_KEY = 'fund_board_theme';
  var themeEarly = null; // boot 前 storage 已回填的主题（有则优先于 localStorage 旧值）
  var ICON_SUN = '<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>';
  var ICON_MOON = '<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>';
  function paintThemeBtn(t) {
    var b = $('ppTheme');
    if (!b) return;
    b.innerHTML = (t === 'light') ? ICON_SUN : ICON_MOON;
    b.title = (t === 'light') ? '当前浅色，点击切深色' : '当前深色，点击切浅色';
  }
  function applyTheme() {
    var t = themeEarly || 'dark';
    if (!themeEarly) {
      try { var s = localStorage.getItem(THEME_KEY); if (s === 'light' || s === 'dark') t = s; } catch (e) {}
    }
    document.documentElement.setAttribute('data-theme', t);
    paintThemeBtn(t);
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var next = cur === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    themeEarly = next;
    try { chrome.storage.local.set({ fund_board_theme: next }); } catch (e) {}
    document.documentElement.setAttribute('data-theme', next);
    paintThemeBtn(next);
  }
  /* 浮窗 / 看板改动共享主题键时实时跟随 */
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && changes) {
        if (changes[THEME_KEY]) {
          themeEarly = changes[THEME_KEY].newValue === 'light' ? 'light' : 'dark';
          applyTheme();
        }
        if (changes.fund_board_calc) {
          var snap = changes.fund_board_calc.newValue;
          if (snap && snapUsable(snap)) { applyCalcSnapshot(snap); render(); }
        }
      }
    });
  } catch (e) {}

  /* ---- 启动：先定主题（storage 优先，避免浮窗改过的主题被 localStorage 旧值闪一下）→ 读镜像持仓 → 渲染 → 拉实时 ---- */
  function boot() {
    paintEye();
    if (!(window.chrome && chrome.storage && chrome.storage.local)) {
      applyTheme();
      $('ppStatus').textContent = '扩展存储不可用';
      return;
    }
    chrome.storage.local.get([THEME_KEY], function (o) {
      var s = o && o[THEME_KEY];
      if (s === 'light' || s === 'dark') {
        themeEarly = s;
        try { if (localStorage.getItem(THEME_KEY) !== s) localStorage.setItem(THEME_KEY, s); } catch (e) {}
      }
      applyTheme();
      bootData();
    });
  }
  function bootData() {
    chrome.storage.local.get(STORE_KEYS, function (o) {
      S.privacy = !!(o && o.float_privacy === '1');
      paintEye();
      var h2 = o && o.fund_board_holdings_v2, h1 = o && o.fund_board_holdings_v1;
      if (!h2 && !h1) { var dl2 = lsGet('fund_board_holdings_v2'); if (dl2) h2 = dl2; else { var dl1 = lsGet('fund_board_holdings_v1'); if (dl1) h1 = dl1; } }
      var dStk = o && o.fund_board_stocks_v1;
      if (!dStk) dStk = lsGet('fund_board_stocks_v1');
      var holdings = null, stocks = null;
      try { holdings = h2 ? JSON.parse(h2) : (h1 ? JSON.parse(h1) : null); } catch (e) {}
      try { stocks = dStk ? JSON.parse(dStk) : null; } catch (e) {}
      S.init = { holdings: holdings || [], stocks: stocks || [] };
      render();
      refresh();
    });
  }
  function paintEye() {
    var b = $('ppEye');
    if (!b) return;
    b.textContent = S.privacy ? '🙈' : '👁';
    b.title = S.privacy ? '显示金额' : '隐藏金额';
  }

  $('ppEye').addEventListener('click', function () {
    S.privacy = !S.privacy;
    try { chrome.storage.local.set({ float_privacy: S.privacy ? '1' : '0' }); } catch (e) {}
    paintEye(); render();
  });
  $('ppRefresh').addEventListener('click', refresh);
  $('ppTheme').addEventListener('click', toggleTheme);
  /* 网页浮窗：向当前标签发 floatToggle（该页无 content script 时会失败 → 提示） */
  $('ppFloat').addEventListener('click', function () {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (!tabs || !tabs[0]) { toast('找不到当前标签页'); return; }
        var tabId = tabs[0].id, tries = 0;
        /* 「接收端不存在」可能是页面加载早期 float.js(document_idle) 尚未就绪，
           属瞬时状态 → 按 300ms/800ms/1500ms 退避自动重试（共 3 次），
           覆盖慢页面的注入延迟；全部失败才判定为不支持的页面 */
        function sendFloat() {
          chrome.tabs.sendMessage(tabId, { type: 'floatToggle' }, function () {
            if (chrome.runtime.lastError) {
              var m = chrome.runtime.lastError.message || '';
              if (/Receiving end does not exist|establish connection/i.test(m)) {
                var wait = [300, 800, 1500][tries];
                if (wait !== undefined) { tries++; setTimeout(sendFloat, wait); return; }
                toast('浮窗未就绪：请刷新页面后重试（普通网页才支持）');
              }
            }
          });
        }
        sendFloat();
      });
    } catch (e) { toast('浮窗未就绪：请刷新页面后重试（普通网页才支持）'); }
  });
  $('ppOpen').addEventListener('click', function () {
    try { chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }); } catch (e) {}
  });

  boot();
})();
