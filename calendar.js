/* ================= 多市场交易日历 / 开市判定 =================
 * 目标：让 A股/港股/美股 的「是否在交易」判定结合各自官方休市表，
 *       不再只看周几+时段（旧逻辑会在中秋等法定节假日误判为交易日、显示虚假估值）。
 *
 * - A股：优先联网拉取权威休市表（cdn.jsdelivr.net/gh/NateScarlet/holiday-cn，中国可直连、
 *        每年自动更新），覆盖内置规则；拉不到时回退内置的国务院放假调休表，保证离线也准确。
 * - 港股(HKEX) / 美股(NYSE·Nasdaq)：官方年度休市表内置（无可靠免费 JSON 接口）。
 *   美股额外处理冬令时/夏令时时差（北京时段跨午夜）。
 *
 * 暴露到 window.Calendar，供 dashboard.js 调用。
 */
(function (global) {
  'use strict';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /* ---------- 内置权威休市表（兜底，确保离线/拉取失败也准确） ---------- */
  // A股：国务院办公厅《2026/2027年部分节假日安排》+ 调休上班日(周末开市)
  var CN_HOLIDAY_GROUPS = {
    '2026': [
      { n: '元旦', d: ['2026-01-01', '2026-01-02', '2026-01-03'] },
      { n: '春节', d: ['2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23'] },
      { n: '清明', d: ['2026-04-04', '2026-04-05', '2026-04-06'] },
      { n: '劳动', d: ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05'] },
      { n: '端午', d: ['2026-06-19', '2026-06-20', '2026-06-21'] },
      { n: '中秋', d: ['2026-09-25', '2026-09-26', '2026-09-27'] },
      { n: '国庆', d: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'] }
    ],
    '2027': [
      { n: '元旦', d: ['2027-01-01', '2027-01-02', '2027-01-03'] },
      { n: '春节', d: ['2027-02-14', '2027-02-15', '2027-02-16', '2027-02-17', '2027-02-18', '2027-02-19', '2027-02-20', '2027-02-21', '2027-02-22'] },
      { n: '清明', d: ['2027-04-04', '2027-04-05', '2027-04-06'] },
      { n: '劳动', d: ['2027-05-01', '2027-05-02', '2027-05-03', '2027-05-04', '2027-05-05'] },
      { n: '端午', d: ['2027-06-19', '2027-06-20', '2027-06-21'] },
      { n: '中秋', d: ['2027-09-25', '2027-09-26', '2027-09-27'] },
      { n: '国庆', d: ['2027-10-01', '2027-10-02', '2027-10-03', '2027-10-04', '2027-10-05', '2027-10-06', '2027-10-07'] }
    ]
  };
  // 调休上班(周末开市)：2026 已知；2027 待次年国务院通知（联网接口/次年内置补）
  var CN_TRADING_WEEKEND = {
    '2026': ['2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10'],
    '2027': []
  };

  // 美股(NYSE/Nasdaq 同步)休市；提前收盘日单独标 ET 收盘分钟(0900=09:00 … 1300=13:00)
  var US_HOLIDAYS = {
    '2026': ['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25'],
    '2027': ['2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24']
  };
  var US_EARLY_CLOSE = {
    '2026': { '2026-11-27': 1300, '2026-12-24': 1300 },
    '2027': { '2027-11-26': 1300 }
  };

  // 港股(HKEX)休市(官方交易日誌及假期表)；半日市(上午开、约12:10收)
  var HK_HOLIDAYS = {
    '2026': ['2026-01-01', '2026-02-17', '2026-02-18', '2026-02-19', '2026-04-03', '2026-04-06', '2026-04-07', '2026-05-01', '2026-05-25', '2026-06-19', '2026-07-01', '2026-10-01', '2026-10-19', '2026-12-25', '2026-12-28'],
    '2027': ['2027-01-01', '2027-02-08', '2027-03-26', '2027-03-29', '2027-04-05', '2027-05-13', '2027-06-09', '2027-07-01', '2027-09-16', '2027-10-01', '2027-10-08', '2027-12-27']
  };
  var HK_HALFDAY = {
    '2026': { '2026-02-16': true, '2026-12-24': true, '2026-12-31': true },
    '2027': { '2027-02-05': true, '2027-12-24': true, '2027-12-31': true }
  };

  // 由分组构建日期集合 + 名称映射(用于状态标签显示"休市·中秋")
  var CN_HOLIDAY_SET = {}; var CN_HOLIDAY_NAME = {};
  Object.keys(CN_HOLIDAY_GROUPS).forEach(function (y) {
    CN_HOLIDAY_SET[y] = {};
    CN_HOLIDAY_GROUPS[y].forEach(function (g) {
      g.d.forEach(function (ds) { CN_HOLIDAY_SET[y][ds] = 1; CN_HOLIDAY_NAME[ds] = g.n; });
    });
  });

  /* ---------- A股交易日判定 ---------- */
  var _ashRemote = {};       // yyyy -> {set:{}, name:{}, tw:{}} 联网覆盖
  function cnHolidaySet(y) {
    var s = _ashRemote[y];
    if (s && s.set) return s.set;
    return CN_HOLIDAY_SET[y] || {};
  }
  function cnHolidayNameMap(y) {
    var s = _ashRemote[y];
    if (s && s.name) return s.name;
    return CN_HOLIDAY_NAME;
  }
  function cnTradingDay(d) {
    var y = '' + d.getFullYear();
    var ds = fmt(d);
    if (cnHolidaySet(y)[ds]) return false;            // 法定休市
    var day = d.getDay();
    if (day === 0 || day === 6) {                    // 周末
      var tw = (CN_TRADING_WEEKEND[y] || []);
      var rt = (_ashRemote[y] && _ashRemote[y].tw) || {};
      return tw.indexOf(ds) >= 0 || !!rt[ds];         // 仅调休上班日开市
    }
    return true;                                      // 普通工作日
  }
  function inAshareHours(d) {
    var m = d.getHours() * 60 + d.getMinutes();
    return (m >= 570 && m <= 690) || (m >= 780 && m <= 900);
  }
  function isAshareOpen(d) { return cnTradingDay(d) && inAshareHours(d); }

  /* ---------- 港股交易日判定（与北京同区，无时差） ---------- */
  function hkTradingDay(d) {
    var y = '' + d.getFullYear(); var ds = fmt(d);
    if ((HK_HOLIDAYS[y] || []).indexOf(ds) >= 0) return false;
    var day = d.getDay(); if (day === 0 || day === 6) return false;
    return true;
  }
  function inHKHours(d, half) {
    var m = d.getHours() * 60 + d.getMinutes();
    if (half) return m >= 570 && m <= 730;            // 半日市 9:30-12:10
    return (m >= 570 && m <= 720) || (m >= 780 && m <= 960); // 9:30-12:00 / 13:00-16:00
  }
  function isHKOpen(d) {
    var y = '' + d.getFullYear(); var ds = fmt(d);
    if (!hkTradingDay(d)) return false;
    var half = HK_HALFDAY[y] && HK_HALFDAY[y][ds];
    return inHKHours(d, half);
  }

  /* ---------- 美股交易日判定（北京时段跨午夜，需换算 ET + 冬夏令时） ---------- */
  function nthSunday(y, month0, n) {
    var f = new Date(Date.UTC(y, month0, 1)).getUTCDay();
    var first = 1 + ((7 - f) % 7);
    return first + (n - 1) * 7;
  }
  function usDSTActiveMs(ms) {
    var dt = new Date(ms); var y = dt.getUTCFullYear();
    var start = new Date(Date.UTC(y, 2, nthSunday(y, 2, 2), 2, 0, 0)).getTime();  // 3月第2周日 02:00
    var end = new Date(Date.UTC(y, 10, nthSunday(y, 10, 1), 2, 0, 0)).getTime();  // 11月第1周日 02:00
    return ms >= start && ms < end;
  }
  function etInfo(ms) {
    var dst = usDSTActiveMs(ms);
    var offH = dst ? -4 : -5;                         // ET 相对 UTC
    var u = new Date(ms);
    var h = u.getUTCHours() + offH; var mi = u.getUTCMinutes();
    var dOff = 0;
    if (h < 0) { h += 24; dOff = -1; }
    if (h >= 24) { h -= 24; dOff = 1; }
    var y = u.getUTCFullYear(), mo = u.getUTCMonth(), da = u.getUTCDate();
    var dt = new Date(Date.UTC(y, mo, da)); dt.setUTCDate(da + dOff);
    var ds = dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
    return { ds: ds, day: dt.getUTCDay(), min: h * 60 + mi };
  }
  function usTradingDayET(info) {
    var y = info.ds.slice(0, 4);
    if ((US_HOLIDAYS[y] || []).indexOf(info.ds) >= 0) return false;
    if (info.day === 0 || info.day === 6) return false;
    return true;
  }
  function isUSOpen(d) {
    var info = etInfo(d.getTime());
    if (!usTradingDayET(info)) return false;
    var y = info.ds.slice(0, 4);
    var ec = US_EARLY_CLOSE[y] && US_EARLY_CLOSE[y][info.ds];
    var close = ec || 960;                           // 16:00 ET（提前收盘日 13:00）
    return info.min >= 570 && info.min <= close;     // 9:30 ET 起
  }

  /* ---------- 联网拉取 A股休市表（覆盖内置；失败回退） ---------- */
  function ensureAshare(year, cb) {
    year = year || new Date().getFullYear();
    var y = '' + year;
    if (_ashRemote[y]) { cb && cb(true); return; }
    // 本地缓存(7天)
    try {
      var raw = localStorage.getItem('ashCal_' + y);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && o.t && (Date.now() - o.t < 7 * 864e5) && o.set) {
          _ashRemote[y] = { set: o.set, name: o.name || {}, tw: o.tw || {} };
          cb && cb(true); return;
        }
      }
    } catch (e) {}
    var url = 'https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/' + y + '.json';
    function fail() { cb && cb(false); }
    if (!global.chrome || !global.chrome.runtime || !global.chrome.runtime.sendMessage) { fail(); return; }
    global.chrome.runtime.sendMessage({ type: 'xfetch', url: url }, function (res) {
      try {
        if (!res || !res.ok) { fail(); return; }
        var j = JSON.parse(res.body);
        if (!j || !j.days || !j.days.length) { fail(); return; }
        var set = {}, name = {}, tw = {};
        j.days.forEach(function (x) {
          if (!x || !x.date) return;
          if (x.isOffDay === true) { set[x.date] = 1; name[x.date] = x.name || ''; }
          else if (x.isOffDay === false) { tw[x.date] = 1; } // 调休上班(周末开市)
        });
        if (!Object.keys(set).length) { fail(); return; }
        _ashRemote[y] = { set: set, name: name, tw: tw };
        try {
          localStorage.setItem('ashCal_' + y, JSON.stringify({ t: Date.now(), set: set, name: name, tw: tw }));
        } catch (e) {}
        cb && cb(true);
      } catch (e) { fail(); }
    });
  }

  /* ---------- 状态计算（供 marketStatus 生成标签） ---------- */
  function cnHolidayName(ds) { return (cnHolidayNameMap(ds.slice(0, 4)) || {})[ds] || ''; }
  function ashState(d) {
    var day = cnTradingDay(d);
    var m = d.getHours() * 60 + d.getMinutes();
    var open = day && ((m >= 570 && m <= 690) || (m >= 780 && m <= 900));
    var phase = !day ? 'holiday' : (open ? 'open' : (m < 570 ? 'pre' : 'post'));
    return { open: open, phase: phase, holiday: day ? '' : cnHolidayName(fmt(d)) };
  }
  function hkState(d) {
    var day = hkTradingDay(d);
    var y = '' + d.getFullYear(), ds = fmt(d);
    var half = HK_HALFDAY[y] && HK_HALFDAY[y][ds];
    var m = d.getHours() * 60 + d.getMinutes();
    var open = day && (half ? (m >= 570 && m <= 730) : ((m >= 570 && m <= 720) || (m >= 780 && m <= 960)));
    var phase = !day ? 'holiday' : (open ? 'open' : (m < 570 ? 'pre' : 'post'));
    return { open: open, phase: phase, holiday: '' };
  }
  function usState(d) {
    var info = etInfo(d.getTime());
    var day = usTradingDayET(info);
    var y = info.ds.slice(0, 4);
    var ec = US_EARLY_CLOSE[y] && US_EARLY_CLOSE[y][info.ds];
    var close = ec || 960;
    var open = day && info.min >= 570 && info.min <= close;
    var phase = !day ? 'holiday' : (open ? 'open' : (info.min < 570 ? 'pre' : 'post'));
    return { open: open, phase: phase, holiday: '' };
  }

  global.Calendar = {
    cnTradingDay: cnTradingDay,
    isAshareOpen: isAshareOpen,
    isHKOpen: isHKOpen,
    isUSOpen: isUSOpen,
    usTradingDay: function (d) { return usTradingDayET(etInfo(d.getTime())); },
    ensureAshare: ensureAshare,
    cnHolidayName: cnHolidayName,
    marketStates: function (d) {
      d = d || new Date();
      return { ash: ashState(d), hk: hkState(d), us: usState(d) };
    }
  };
})(typeof window !== 'undefined' ? window : this);
