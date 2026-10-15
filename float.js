// 持仓看板 · 网页浮窗版（content script）
// 注入到任意网页右下角，读取扩展 localStorage 持仓，走 bg.js 中转联网拉实时净值/行情。
// 用 Shadow DOM 隔离样式，避免被页面 CSS 污染；可拖拽 / 收起 / 关闭。
(function () {
  'use strict';
  if (document.getElementById('__fundFloatHost')) return; // 防重复注入

  var HOST_ID = '__fundFloatHost';
  var STORE_HIDDEN = 'float_hidden';
  // 与 dashboard 镜像 / bg 数据桥一致的持仓键（chrome.storage.local 里存的是 JSON 字符串）
  var STORE_KEYS = ['fund_board_holdings_v2', 'fund_board_holdings_v1', 'fund_board_stocks_v1', 'fund_board_fx_v1', 'float_hidden', 'float_privacy'];

  // 从 chrome.storage.local 原始对象（值均为字符串）解析出浮窗所需数据
  function buildInitFromStorage(o) {
    function rd(k) { var s = o[k]; if (s === null || s === undefined) return null; try { return JSON.parse(s); } catch (e) { return null; } }
    return {
      holdings: rd('fund_board_holdings_v2') || rd('fund_board_holdings_v1'),
      stocks: rd('fund_board_stocks_v1'),
      fx: rd('fund_board_fx_v1'),
      hidden: o.float_hidden === '1'
    };
  }
  // 从 bg.js floatInit 回传（值已解析为对象）解析
  function buildInitFromBg(data) {
    return {
      holdings: data.holdings || null,
      stocks: data.stocks || null,
      fx: data.fx || null,
      hidden: !!data.hidden
    };
  }

  // ---- 浮层状态 ----
  var S = {
    init: null,        // bg 回传的持仓等原始数据
    fundInfo: {},      // code -> {gsz,dwjz,gszzl,estType,name}
    estTime: '',       // 最新估值时间（新浪估算末点，如 "10-14 10:20"）
    stockInfo: {},     // code -> {price,pct,name,cur}
    fx: { USD: 7.0, HKD: 0.90 }, // 兜底常数（仅无缓存且无网络时）
    fxSrc: '',         // 汇率来源说明
    collapsed: false,
    hidden: false,
    privacy: false,    // 隐私模式：隐藏金额（保留涨跌幅）
    theme: 'dark',     // 主题：dark / light（跟随全局，经 chrome.storage.local 联动）
    opacity: 1,        // 浮窗透明度：0.3~1（chrome.storage.local 持久化）
    loading: false
  };

  // ============ 工具 ============
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
  function upDown(n) { return n > 0 ? 'up' : (n < 0 ? 'down' : ''); }
  function curOf(code) {
    if (/^hk/i.test(code)) return 'HKD';
    if (/^us/i.test(code)) return 'USD';
    return 'CNY';
  }
  function fxRate(cur) { return cur === 'CNY' ? 1 : (S.fx[cur] || 1); }

  // 走 bg 中转的 fetch（content script 自身受 CORS 限制，统一委托 SW）
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

  // ============ 解析：东财 fundmobapi（基金最新净值） ============
  function parseFundMobapi(body, codes) {
    var map = {};
    try {
      var j = JSON.parse(body);
      var arr = (j && (j.Datas || j.datas)) || [];
      arr.forEach(function (it) {
        if (!it || !it.FCODE) return;
        var nav = parseFloat(it.NAV), chg = parseFloat(it.NAVCHGRT);
        var today = new Date();
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

  // ============ 解析：腾讯 qt.gtimg.cn（股票/汇率，GBK） ============
  function parseQt(body, wantFx) {
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

  // ============ 新浪今日分时估算（与看板同源） ============
  // networth 序列末点 = 当前实时估算；pre_date 为今日才采信（盘前/隔夜旧序列不覆盖）
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
             不再要求 pre_date===今天——盘前拒掉会让浮窗回退官方 NAVCHGRT 口径、与看板表格两套数字 */
          if (isNaN(prevNav) || isNaN(pct)) return resolve(null);
          /* 🔴 新浪 pre_nav 实为「今日估算净值」= 官方昨收×(1+pct/100)，不是昨收！
             gsz 取 pre_nav；官方昨收反推 = pre_nav/(1+pct/100)——与看板表格同口径 */
          resolve({
            gsz: +prevNav.toFixed(4),                        // 今日估算净值（=新浪 pre_nav 本义）
            dwjz: pct ? +(prevNav / (1 + pct / 100)).toFixed(4) : prevNav,   // 官方昨收（反推）
            gszzl: pct,
            gztime: String(lp.pre_date || '').slice(5) + ' ' + String(lp.min_time || '').slice(0, 5)
          });
        } catch (e) { resolve(null); }
      }, function () { resolve(null); });
    });
  }

  // ============ 计算单条 + 汇总 ============
  function calcFund(h) {
    var info = S.fundInfo[h.code] || null;
    var r = { mv: null, pnl: null, cum: null };
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
    }
    return r;
  }
  function calcStock(s) {
    var info = S.stockInfo[s.code] || null;
    var r = { mv: null, pnl: null, cum: null, cur: curOf(s.code) };
    if (!info || info.price == null || !s.shares) return r;
    r.mv = s.shares * info.price;
    if (info.prevClose) r.pnl = s.shares * (info.price - info.prevClose);
    if (s.cost) r.cum = s.shares * (info.price - s.cost);
    return r;
  }

  // ============ 渲染 ============
  var root, shadow, elSummary, elList, elStatus;

  function render() {
    if (!S.init) return;
    var holdings = S.init.holdings || [];
    var stocks = S.init.stocks || [];

    // 汇总
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
      if (!_snapFresh) {
        if (r.mv != null) { totMv += r.mv * fxRate(r.cur); hasMv = true; }
        if (r.pnl != null) { totPnl += r.pnl * fxRate(r.cur); hasPnl = true; }
        if (r.cum != null) { totCum += r.cum * fxRate(r.cur); hasCum = true; }
      }
    });

    var priv = S.privacy;
    elSummary.innerHTML =
      '<div class="ff-tl">总市值（元）</div>' +
      '<div class="ff-tv">' + (hasMv ? (priv ? '****' : '¥' + fmtNum(totMv)) : '--') + '</div>' +
      '<div class="ff-duo">' +
      '  <div class="ff-dcell"><span>今日盈亏</span><b class="' + upDown(totPnl) + '">' + (hasPnl ? (priv ? '****' : (totPnl >= 0 ? '+' : '-') + '¥' + fmtNum(Math.abs(totPnl))) : '--') + '</b></div>' +
      '  <div class="ff-dcell"><span>累计盈亏</span><b class="' + upDown(totCum) + '">' + (hasCum ? (priv ? '****' : (totCum >= 0 ? '+' : '-') + '¥' + fmtNum(Math.abs(totCum))) : '--') + '</b></div>' +
      '</div>';

    // 列表：基金 / 股票分组；有实时名称时显示名称（悬停看「全名（代码）」）
    var rows = '';
    if (holdings.length) {
      rows += '<div class="ff-grp">基金 · ' + holdings.length + '</div>';
      holdings.forEach(function (h) {
        var info = S.fundInfo[h.code] || null;
        var r = calcFund(h);
        var sub = (r.mv != null ? (priv ? '****' : '¥' + fmtNum(r.mv)) : '--');
        var pct = info ? info.gszzl : null;
        var tip = (info && info.name) ? info.name : '';
        rows += item((info && info.name) || h.name || h.code, sub, pct, h.code, tip);
      });
    }
    if (stocks.length) {
      rows += '<div class="ff-grp">股票 · ' + stocks.length + '</div>';
      stocks.forEach(function (s) {
        var info = S.stockInfo[s.code] || null;
        var r = calcStock(s);
        var sub = (r.mv != null ? (priv ? '****' : fmtNum(r.mv * fxRate(r.cur))) : '--') + (r.cur !== 'CNY' ? ' ' + r.cur : '');
        var pct = info ? info.pct : null;
        var tip = (info && info.name) ? info.name : '';
        rows += item((info && info.name) || s.name || s.code, sub, pct, s.code, tip);
      });
    }
    elList.innerHTML = rows || '<div class="ff-empty">暂无持仓，去扩展里添加</div>';

    var tag = [];
    if (S.loading) tag.push('刷新中…');
    else if (S.snapTs && snapFresh(S.snapTs)) tag.push('看板同步 ' + new Date(S.snapTs).toTimeString().slice(0, 8));
    else if (S.estTime) tag.push('估算 ' + S.estTime);
    else if (S.fxSrc) tag.push('汇率:' + S.fxSrc);
    elStatus.textContent = tag.join(' · ') || ('已载入 ' + (holdings.length + stocks.length) + ' 项');
    // 角标由 bg.js 单一负责（SW 始终在线重算快照时统一设置，含隐私模式清空），此处不再推。
  }
  function item(name, sub, pct, code, tip) {
    var cls = (pct == null || isNaN(pct)) ? 'flat' : upDown(pct);
    var pctTxt = (pct == null || isNaN(pct)) ? '--' : fmtPct(pct);
    var title = tip ? (tip + '（' + code + '）') : code;
    return '<div class="ff-item" title="' + esc(title) + '">' +
      '<div class="ff-nm">' + esc(name) + '</div>' +
      '<div class="ff-sub">' + esc(sub) + '</div>' +
      '<div class="ff-pct ' + cls + '">' + esc(pctTxt) + '</div></div>';
  }

  // ============ 看板计算结果快照（三处一致的关键） ============
  // 看板每次刷新把「基金/股票/汇率」的最终计算结果写入 chrome.storage.local 的 fund_board_calc；
  // 浮窗优先直接读这份快照显示，保证与看板 / popup 数字完全一致；看板未开时再回退独立取数。
  function readCalcSnapshot() {
    return new Promise(function (resolve) {
      if (!(chrome && chrome.storage && chrome.storage.local)) return resolve(null);
      chrome.storage.local.get('fund_board_calc', function (o) {
        var s = o && o.fund_board_calc;
        resolve(s && s.fundInfo ? s : null);
      });
    });
  }
  function snapFresh(ts) { return ts && (Date.now() - ts) < 5 * 60 * 1000; } // 5 分钟内视为新鲜
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
      S.fxSrc = '看板同步';
    }
    S.snapTs = snap.ts;
    S.snapTot = { mv: snap.totMv, pnl: snap.totPnl, cum: snap.totCum };
    return true;
  }

  // ============ 刷新 ============
  // 优先复用看板快照（实时一致）；看板未开 / 快照过期才独立取数（回退口径）
  function done() { S.loading = false; render(); }
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
        if (r.ok) S.fundInfo = parseFundMobapi(r.body, fundCodes);
      }));
      // 新浪今日分时估算：有今日估算 → 覆盖为盘中实时口径；失败/无估算回退净值口径
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
            dwjz: est.dwjz,                // 已含昨收净值
            gszzl: est.gszzl,
            estType: 'est',
            name: (cur && cur.name) || code
          };
          S.estTime = est.gztime;
        });
      }));
    }
    var allQt = stockCodes.concat(needFx ? fxCodes : []);
    if (allQt.length) {
      tasks.push(xfetch('https://qt.gtimg.cn/q=' + allQt.join(',')).then(function (r) {
        if (r.ok) {
          var parsed = parseQt(r.body, needFx);
          S.stockInfo = parsed.stocks;
          if (needFx && parsed.fx.USDCNY) { S.fx.USD = parsed.fx.USDCNY; S.fxSrc = '腾讯实时'; }
          if (needFx && parsed.fx.HKDCNY) { S.fx.HKD = parsed.fx.HKDCNY; }
        }
      }));
    }
    Promise.all(tasks).then(function () {
      S.loading = false; render();
    });
  }

  // ============ 拖拽 / 收起 / 关闭 ============
  function makeDraggable(header) {
    var sx, sy, ox, oy, dragging = false;
    header.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      dragging = true;
      var rect = root.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = rect.left; oy = rect.top;
      header.setPointerCapture(e.pointerId);
    });
    header.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var nx = ox + (e.clientX - sx), ny = oy + (e.clientY - sy);
      nx = Math.max(4, Math.min(window.innerWidth - 40, nx));
      ny = Math.max(4, Math.min(window.innerHeight - 40, ny));
      root.style.left = nx + 'px'; root.style.top = ny + 'px';
      root.style.right = 'auto'; root.style.bottom = 'auto';
    });
    header.addEventListener('pointerup', function (e) { dragging = false; });
  }

  function toggleCollapse() {
    S.collapsed = !S.collapsed;
    shadow.getElementById('ffCard').classList.toggle('ff-collapsed', S.collapsed);
  }

  // ============ 隐私模式（隐藏金额，保留涨跌幅） ============
  var EYE_OPEN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  function paintEye() {
    var b = shadow.getElementById('ffEye');
    if (b) b.innerHTML = S.privacy ? EYE_OFF : EYE_OPEN;
  }
  function togglePrivacy() {
    S.privacy = !S.privacy;
    paintEye();
    render();
    try { chrome.storage.local.set({ float_privacy: S.privacy ? '1' : '0' }); } catch (e) {}
  }
  // ============ 主题（浮窗外观跟随全局主题，仅经 storage 联动，无本地按钮） ============
  // content script 读不到扩展页 localStorage，故 chrome.storage.local 的 fund_board_theme 为三端共享源；
  // 看板 / popup 切换时写同一键，这里经 storage.onChanged 实时跟随（只切换 .light 类）。
  var THEME_KEY = 'fund_board_theme';
  function applyTheme(t) {
    S.theme = (t === 'light') ? 'light' : 'dark';
    if (root) root.classList.toggle('light', S.theme === 'light');
  }

  // ============ 透明度（浮窗专属设置，本地可调，持久化进 chrome.storage.local） ============
  var OPACITY_KEY = 'float_opacity';
  // 半透明圆盘图标（CSS 会强制 fill:currentColor，故用半圆填充路径即可表征「半透明」）
  var ICON_OPACITY = '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9z"/></svg>';
  function paintOpacityBtn() {
    if (!shadow) return;
    var b = shadow.getElementById('ffOpacity');
    if (!b) return;
    b.innerHTML = ICON_OPACITY;
    b.title = '透明度 ' + Math.round(S.opacity * 100) + '%（点击调节）';
  }
  function applyOpacity(v) {
    S.opacity = (typeof v === 'number' && v >= 0.3 && v <= 1) ? v : 1;
    var card = shadow && shadow.getElementById('ffCard');
    if (card) card.style.opacity = String(S.opacity);
    paintOpacityBtn();
  }
  function setOpacity(v) {
    applyOpacity(v);
    try { chrome.storage.local.set({ float_opacity: String(S.opacity) }); } catch (e) {}
  }
  var opacityPanelOpen = false;
  function toggleOpacityPanel() {
    var panel = shadow && shadow.getElementById('ffOpacityPanel');
    if (!panel) return;
    opacityPanelOpen = !opacityPanelOpen;
    panel.classList.toggle('show', opacityPanelOpen);
    if (opacityPanelOpen) setTimeout(function () { document.addEventListener('click', onDocClickAway, true); }, 0);
    else document.removeEventListener('click', onDocClickAway, true);
  }
  function onDocClickAway(e) {
    var panel = shadow && shadow.getElementById('ffOpacityPanel');
    if (!panel || !panel.classList.contains('show')) return;
    if (e.target && (panel.contains(e.target) || (shadow.getElementById('ffHead') && shadow.getElementById('ffHead').contains(e.target)))) return;
    opacityPanelOpen = false;
    panel.classList.remove('show');
    document.removeEventListener('click', onDocClickAway, true);
  }
  function setupOpacityPanel() {
    var panel = shadow && shadow.getElementById('ffOpacityPanel');
    var range = shadow && shadow.getElementById('ffOpacityRange');
    var val = shadow && shadow.getElementById('ffOpacityVal');
    if (!panel || !range || !val) return;
    range.value = String(Math.round(S.opacity * 100));
    val.textContent = Math.round(S.opacity * 100) + '%';
    range.addEventListener('input', function () {
      var v = parseInt(range.value, 10);
      val.textContent = (isNaN(v) ? 100 : v) + '%';
      if (!isNaN(v)) setOpacity(v / 100);
    });
    panel.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  }
  function doClose() {
    S.hidden = true; root.style.display = 'none';
    if (!window.__FLOAT_NO_PERSIST) {
      try { chrome.runtime.sendMessage({ type: 'floatStore', key: STORE_HIDDEN, val: '1' }); } catch (e) {}
    }
  }
  function reopen() {
    S.hidden = false; root.style.display = '';
    if (!window.__FLOAT_NO_PERSIST) {
      try { chrome.runtime.sendMessage({ type: 'floatStore', key: STORE_HIDDEN, val: '0' }); } catch (e) {}
    }
    refresh(); // 重新打开立即拉一次实时
  }

  // ============ 装配 DOM（Shadow） ============
  function build() {
    root = document.createElement('div');
    root.id = HOST_ID;
    root.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:320px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;';
    document.documentElement.appendChild(root);
    shadow = root.attachShadow({ mode: 'open' });
    shadow.innerHTML =
      '<style>' +
      ':host{all:initial;}' +
      '*{box-sizing:border-box;}' +
      /* 主题变量：:host 深色（默认）；:host.light 浅色（与看板/popup 浅色同色系） */ +
      ':host{' +
      '  --ff-bg:#171c28;--ff-text:#e6e9ef;--ff-border:#2a3244;--ff-head-a:#2b3550;--ff-head-b:#232b3e;' +
      '  --ff-title:#d7e3ff;--ff-btn:rgba(255,255,255,.07);--ff-btn-h:rgba(255,255,255,.16);--ff-btn-t:#c3cde0;' +
      '  --ff-label:#8fa0bf;--ff-total:#f4f7ff;--ff-panel:#1e2534;--ff-panel-bd:#262f42;' +
      '  --ff-nm:#dde4f2;--ff-sub:#b7c1d4;--ff-grp:#6d7a92;--ff-muted:#7c879b;--ff-foot:#1b2130;--ff-link:#7fb0ff;' +
      '  --ff-up:#ff5d5d;--ff-down:#2ecc8f;--ff-up-bg:rgba(240,69,69,.13);--ff-down-bg:rgba(35,181,115,.13);' +
      '  --ff-flat-bg:rgba(255,255,255,.06);--ff-row-hover:rgba(255,255,255,.05);' +
      '}' +
      ':host.light{' +
      '  --ff-bg:#eef1f6;--ff-text:#1f2937;--ff-border:#d8dfea;--ff-head-a:#ffffff;--ff-head-b:#f6f8fc;' +
      '  --ff-title:#1f2937;--ff-btn:#dde4ee;--ff-btn-h:#cbd5e3;--ff-btn-t:#3c4a63;' +
      '  --ff-label:#647085;--ff-total:#111827;--ff-panel:#ffffff;--ff-panel-bd:#d8dfea;' +
      '  --ff-nm:#1f2937;--ff-sub:#5a6478;--ff-grp:#9aa7ba;--ff-muted:#647085;--ff-foot:#f6f8fc;--ff-link:#2f6fe0;' +
      '  --ff-up:#e03131;--ff-down:#0d8a52;--ff-up-bg:rgba(224,49,49,.10);--ff-down-bg:rgba(13,138,82,.12);' +
      '  --ff-flat-bg:rgba(127,127,127,.10);--ff-row-hover:rgba(127,127,127,.10);' +
      '}' +
      '.ff-card{background:var(--ff-bg);color:var(--ff-text);border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.28);overflow:hidden;border:1px solid var(--ff-border);}' +
      '.ff-card.ff-collapsed{width:170px;}' +
      '.ff-head{display:flex;align-items:center;gap:6px;padding:9px 12px;background:linear-gradient(180deg,var(--ff-head-a),var(--ff-head-b));cursor:grab;user-select:none;border-bottom:1px solid var(--ff-border);}' +
      '.ff-title{font-size:13px;font-weight:700;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ff-title);letter-spacing:.5px;}' +
      '.ff-head button{background:var(--ff-btn);border:none;color:var(--ff-btn-t);width:24px;height:24px;border-radius:7px;cursor:pointer;font-size:13px;line-height:1;transition:background .15s;display:inline-flex;align-items:center;justify-content:center;}' +
      '.ff-head button:hover{background:var(--ff-btn-h);}' +
      '.ff-head button svg{width:14px;height:14px;fill:currentColor;}' +
      '.ff-body{padding:10px 12px 6px;}' +
      '.ff-collapsed .ff-body{display:none;}' +
      '.ff-tl{font-size:11px;color:var(--ff-label);letter-spacing:1px;}' +
      '.ff-tv{font-size:22px;font-weight:800;color:var(--ff-total);margin:2px 0 9px;font-variant-numeric:tabular-nums;letter-spacing:.3px;}' +
      '.ff-duo{display:flex;gap:8px;}' +
      '.ff-dcell{flex:1;background:var(--ff-panel);border:1px solid var(--ff-panel-bd);border-radius:9px;padding:6px 9px;min-width:0;}' +
      '.ff-dcell span{display:block;font-size:10px;color:var(--ff-label);margin-bottom:2px;}' +
      '.ff-dcell b{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;}' +
      '.up{color:var(--ff-up);}.down{color:var(--ff-down);}' +
      '.ff-list{margin-top:9px;max-height:250px;overflow:auto;}' +
      '.ff-grp{font-size:10px;color:var(--ff-grp);letter-spacing:2px;margin:6px 0 2px;}' +
      '.ff-item{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:5px 5px;border-radius:7px;}' +
      '.ff-item:hover{background:var(--ff-row-hover);}' +
      '.ff-nm{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ff-nm);}' +
      '.ff-sub{font-size:12px;color:var(--ff-sub);font-variant-numeric:tabular-nums;white-space:nowrap;}' +
      '.ff-pct{font-size:11px;font-weight:700;padding:1px 7px;border-radius:9px;white-space:nowrap;}' +
      '.ff-pct.up{color:var(--ff-up);background:var(--ff-up-bg);}' +
      '.ff-pct.down{color:var(--ff-down);background:var(--ff-down-bg);}' +
      '.ff-pct.flat{color:var(--ff-label);background:var(--ff-flat-bg);}' +
      '.ff-empty{font-size:12px;color:var(--ff-muted);padding:12px 0;text-align:center;}' +
      '.ff-foot{display:flex;justify-content:space-between;align-items:center;padding:6px 12px;border-top:1px solid var(--ff-border);font-size:11px;color:var(--ff-muted);background:var(--ff-foot);}' +
      '.ff-foot a{color:var(--ff-link);cursor:pointer;text-decoration:none;font-weight:600;}' +
      '.ff-foot a:hover{text-decoration:underline;}' +
      '.ff-status{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.ff-opx{position:absolute;top:46px;right:8px;display:none;align-items:center;gap:8px;background:var(--ff-head-b);border:1px solid var(--ff-border);border-radius:9px;padding:8px 10px;box-shadow:0 8px 24px rgba(0,0,0,.3);z-index:5;}' +
      '.ff-opx.show{display:flex;}' +
      '.ff-opx span{font-size:11px;color:var(--ff-label);}' +
      '.ff-opx #ffOpacityVal{color:var(--ff-text);min-width:34px;text-align:right;font-variant-numeric:tabular-nums;}' +
      '.ff-opx input[type=range]{width:120px;accent-color:#6ea8ff;}' +
      '</style>' +
      '<div class="ff-card" id="ffCard">' +
      '  <div class="ff-head" id="ffHead">' +
      '    <span class="ff-title">持仓浮窗</span>' +
      '    <button id="ffOpacity" title="透明度"></button>' +
      '    <button id="ffEye" title="隐藏/显示金额"></button>' +
      '    <button id="ffRefresh" title="刷新">⟳</button>' +
      '    <button id="ffMin" title="收起/展开">－</button>' +
      '    <button id="ffClose" title="关闭">✕</button>' +
      '  </div>' +
      '  <div class="ff-body">' +
      '    <div id="ffSummary"></div>' +
      '    <div class="ff-list" id="ffList"></div>' +
      '  </div>' +
      '  <div class="ff-foot">' +
      '    <span class="ff-status" id="ffStatus">载入中…</span>' +
      '    <a id="ffOpen">全屏看板</a>' +
      '  </div>' +
      '  <div class="ff-opx" id="ffOpacityPanel">' +
      '    <span>透明度</span>' +
      '    <input type="range" id="ffOpacityRange" min="30" max="100" step="5" />' +
      '    <span id="ffOpacityVal">100%</span>' +
      '  </div>' +
      '</div>';

    elSummary = shadow.getElementById('ffSummary');
    elList = shadow.getElementById('ffList');
    elStatus = shadow.getElementById('ffStatus');

    makeDraggable(shadow.getElementById('ffHead'));
    applyTheme(S.theme);
    applyOpacity(S.opacity);
    setupOpacityPanel();
    shadow.getElementById('ffOpacity').addEventListener('click', toggleOpacityPanel);
    shadow.getElementById('ffEye').addEventListener('click', togglePrivacy);
    shadow.getElementById('ffRefresh').addEventListener('click', refresh);
    shadow.getElementById('ffMin').addEventListener('click', toggleCollapse);
    shadow.getElementById('ffClose').addEventListener('click', doClose);
    shadow.getElementById('ffOpen').addEventListener('click', function () {
      try { chrome.runtime.sendMessage({ type: 'openDashboard' }); } catch (e) {}
    });
  }

  // ============ 启动 ============
  function boot() {
    try { build(); } catch (e) {}
    paintEye();
    // 默认关闭：仅当用户此前「打开过」(float_hidden==='0') 才自动显示
    // 浮窗小窗页面（__FLOAT_FORCE_SHOW）始终强制显示，不受该状态影响
    if (window.__FLOAT_FORCE_SHOW) {
      S.hidden = false; root.style.display = '';
      loadData();
      return;
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['float_privacy', 'float_hidden', 'fund_board_theme', 'float_opacity'], function (o) {
        S.privacy = !!(o && o.float_privacy === '1');
        S.hidden = !(o && o.float_hidden === '0');
        applyTheme(o && o.fund_board_theme === 'light' ? 'light' : 'dark');
        var op = parseFloat(o && o.float_opacity);
        applyOpacity(isNaN(op) ? 1 : op);
        paintEye();
        root.style.display = S.hidden ? 'none' : '';
        loadData();
      });
    } else {
      S.hidden = true;
      root.style.display = 'none';
      loadData();
    }
  }
  function loadData() {
    // content script 可直接读 chrome.storage.local（与看板同源共享），优先直读（免去 SW 异步往返）
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(STORE_KEYS, function (o) {
        var has = o && (o.fund_board_holdings_v2 || o.fund_board_holdings_v1 || o.fund_board_stocks_v1);
        if (has) {
          var init = buildInitFromStorage(o);
          S.init = { holdings: init.holdings || [], stocks: init.stocks || [] };
          applyFx(init.fx);
          render(); refresh();
          return;
        }
        // 没有缓存 → 回退经 bg.js floatInit
        fallbackInit();
      });
    } else {
      fallbackInit();
    }
  }
  function applyFx(fx) {
    if (!fx) return;
    if (fx.USD && fx.USD.rate) { S.fx.USD = fx.USD.rate; S.fxSrc = '缓存'; }
    if (fx.HKD && fx.HKD.rate) { S.fx.HKD = fx.HKD.rate; }
  }
  function fallbackInit() {
    if (S.hidden) { root.style.display = 'none'; return; }
    try {
      chrome.runtime.sendMessage({ type: 'floatInit' }, function (data) {
        if (!data || !data.ok) { elStatus.textContent = '无法读取持仓（请先在扩展看板里打开一次）'; return; }
        var init = buildInitFromBg(data);
        S.init = { holdings: init.holdings || [], stocks: init.stocks || [] };
        applyFx(init.fx);
        render();
        refresh(); // 自动拉一次实时
      });
    } catch (e) { elStatus.textContent = '扩展未连接'; }
  }

  // 主题三端联动：看板 / popup 改动 chrome.storage.local 的 fund_board_theme 时实时跟随
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes) return;
      if (changes.fund_board_theme) {
        applyTheme(changes.fund_board_theme.newValue === 'light' ? 'light' : 'dark');
      }
      if (changes.fund_board_calc) {
        var snap = changes.fund_board_calc.newValue;
        if (snap && snapUsable(snap)) { applyCalcSnapshot(snap); render(); }
      }
    });
  } catch (e) {}

  // ============ 自动刷新（每 60 秒） ============
  // 仅页面可见且浮窗打开时刷新；页面从后台切回前台时立即补刷一次。
  var autoTimer = null;
  function autoTick() {
    if (document.hidden || S.hidden) return;
    refresh();
  }
  function startAuto() {
    if (autoTimer) return;
    autoTimer = setInterval(autoTick, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !S.hidden && S.init) refresh();
    });
  }
  startAuto();

  // 工具栏图标点击 → 由 bg 转发 floatToggle；这里响应显隐
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg) return;
    if (msg.type === 'floatToggle') {
      if (S.hidden) reopen();
      else if (S.collapsed) reopen();
      else doClose();
      try { sendResponse({ ok: true }); } catch (e) {}
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
