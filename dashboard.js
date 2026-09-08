
/* ================= MV3 事件委托根 ================= */
// CSP 不允许 inline handler；统一通过 data-act/data-evt/data-fns + 单根委托触发
(function bindMv3Delegation(){
  function fire(el, e){
    var fns = (el.getAttribute('data-fns')||'').split(';').filter(Boolean);
    fns.forEach(function(n){ if(typeof window[n]==='function') window[n](); });
    if(el.__mvFiring) return; // 防同事件二次冒泡
    var fnName = el.getAttribute('data-act');
    if(fnName && typeof window[fnName] === 'function'){
      var args = [];
      var raw = el.getAttribute('data-args');
      if(raw){
        try{
          var arr = JSON.parse(raw);
          args = arr.map(function(x){ return x==='event' ? e : x; });
        }catch(_){ args = [raw]; }
      }
      el.__mvFiring = true;
      try{ window[fnName].apply(null, args); }catch(err){ console.error('[ext] '+fnName, err); }
      el.__mvFiring = false;
    }
  }
  function onClick(e){
    var el = e.target && e.target.closest && e.target.closest('[data-act],[data-fns]');
    if(!el) return;
    // checkbox 使用 data-evt="change" 单独触发，避免 click 与 change 双重调用导致状态反转
    if(el.tagName === 'INPUT' && el.type === 'checkbox' && el.getAttribute('data-evt') === 'change') return;
    fire(el, e);
  }
  function onEvt(e){
    var el = e.target && e.target.closest && e.target.closest('[data-evt]');
    if(!el) return;
    var want = el.getAttribute('data-evt');
    var map = {input:'input', change:'change', submit:'submit',
               focus:'focusin', blur:'focusout', mouseover:'mouseover', mouseout:'mouseout'};
    if(map[want] !== e.type) return;
    fire(el, e);
  }
  document.addEventListener('click', onClick, true);
  ['input','change','submit','focusin','focusout','mouseover','mouseout'].forEach(function(t){
    document.addEventListener(t, onEvt, true);
  });
})();

/* ================= 工具 ================= */
var $ = function(s){ return document.querySelector(s); };
var LS_KEY = 'fund_board_holdings_v2';

/* ================= 主题（浅色 / 深色） ================= */
var THEME_KEY = 'fund_board_theme';
/* 主题切换图标（内联 SVG，图标表示「当前所处主题」：浅色=太阳，深色=月亮） */
var ICON_SUN  = '<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>';
var ICON_MOON = '<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>';
function setThemeButton(t){
  var btn = document.getElementById('themeToggle');
  if(!btn) return;
  btn.innerHTML = (t === 'light') ? ICON_SUN : ICON_MOON;
  btn.title = (t === 'light') ? '当前浅色，点击切深色' : '当前深色，点击切浅色';
  btn.setAttribute('aria-label', btn.title);
}
function applyTheme(){
  var t = 'dark';
  try{ var s = localStorage.getItem(THEME_KEY); if(s === 'light' || s === 'dark') t = s; }catch(e){}
  document.documentElement.setAttribute('data-theme', t);
  setThemeButton(t);
}
function toggleTheme(){
  var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  var next = cur === 'light' ? 'dark' : 'light';
  try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
  document.documentElement.setAttribute('data-theme', next);
  setThemeButton(next);
  refreshAll(); /* 重绘界面与 ECharts（主题色随之切换） */
}
/* 读取当前主题对应的图表颜色（ECharts 不支持 CSS 变量，需运行时取） */
function themeColors(){
  var cs = getComputedStyle(document.documentElement);
  function g(n, fb){ var v = (cs.getPropertyValue(n) || '').trim(); return v || fb; }
  return {
    text: g('--text', '#dbe4f5'), muted: g('--muted', '#7c8aa5'),
    red: g('--red', '#f04545'), green: g('--green', '#23b573'),
    blue: g('--blue', '#4dabf7'),
    chartBg: g('--chart-bg', '#182238'), chartBorder: g('--chart-border', '#1f2a44'),
    chartAxis: g('--chart-axis', '#2a3a5c'), chartSplit: g('--chart-split', '#1a2540')
  };
}

/* ================= JSONP 文本提取（MV3 兼容，禁 script 注入） =================
   MV3 CSP script-src 不允许 https:// 远程源；改用 fetch+字符串解析。
   支持两类返回：
     A) var xxx = [...];或 var xxx = {...};（含 fS_name / Data_netWorthTrend / _hs300k / _stkNk 等）
     B) callback({...});callback=[...];（东财 push2 / 新浪 jsonp 等） */

function matchBracket(s, start){
  // 从 start(指向 [ 或 {) 起配对找末尾。处理字符串/转义，跳过嵌套
  var depth = 0, inStr = false, esc = false, q = '';
  for(var i = start; i < s.length; i++){
    var c = s[i];
    if(inStr){
      if(esc){ esc = false; continue; }
      if(c === '\\'){ esc = true; continue; }
      if(c === q) inStr = false;
      continue;
    }
    if(c === '"' || c === '\''){ inStr = true; q = c; continue; }
    if(c === '[' || c === '{') depth++;
    else if(c === ']' || c === '}'){
      depth--;
      if(depth === 0) return i;
    }
  }
  return -1;
}

function looseJsonParse(body){
  // 把 {a:1, b:'x'} 类的 JS 字面量转为标准 JSON 再 parse（不 eval，MV3 兼容）
  // 假设数据中：单引号只用于字符串包裹、不会出现在字符串内部；冒号只在 key 后
  var s = body.replace(/'/g, '"').replace(/([,{]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":');
  try{ return JSON.parse(s); }catch(_){ return null; }
}

function extractAfterVar(txt, varname){
  // 找 var varname = [ 或 {（也支持无 var 前缀），返回解析结果
  // 兼容新浪 stock trend 接口的特殊包装：var _stk_xxx_k=([...]) —— = 后跟 ( 再 [ 再 ] 再 )
  var idx = txt.indexOf(varname);
  if(idx < 0) return null;
  var i = idx + varname.length;
  while(i < txt.length && (txt[i] === ' ' || txt[i] === '\t' || txt[i] === '\n' || txt[i] === '\r' || txt[i] === '=')) i++;
  /* 跳过新浪 =([...]) 包装的最外层 (  */
  if(txt[i] === '('){ i++; while(i < txt.length && /\s/.test(txt[i])) i++; }
  if(i >= txt.length) return null;
  if(txt[i] !== '[' && txt[i] !== '{') return null;
  var end = matchBracket(txt, i);
  if(end < 0) return null;
  return looseJsonParse(txt.substring(i, end + 1));
}

/* 统一远程文本获取：
   所有接口（含新浪系）一律走 SW 中转——SW 的 fetch 不受扩展页 connect-src CSP 约束，
   且能带正确 Referer / UA、内置 3 次 retry，对风控严格的东财/新浪都最稳。
   不再做「页面直连兜底」：实测东财 push2 系从这台机器被服务端风控掐断（直连必
   ERR_EMPTY_RESPONSE，纯噪音），新浪页面直连也是最初「无估值」的元凶。SW 是唯
   一可靠通道，失败就抛错由调用方 catch——各调用点已有降级（如涨跌家数→sinaAllA）。
   encoding 可选：null/'utf8'(默认)='按 r.text() 浏览器默认'、'gbk'='先取 ISO-8859-1
   字节再 TextDecoder(\"gbk\") 解码'（用于东财 pingzhongdata 等 Content-Type 不带 charset
   但实际是 GBK 编码的 JS 接口；ISO-8859-1 每个字符码 1:1 等于原字节值，可无损还原） */
function iso88591ToBytes(str){
  var bytes = new Uint8Array(str.length);
  for(var i=0; i<str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
  return bytes;
}
function getRemoteText(url, encoding){
  var useSW = !!(chrome && chrome.runtime && chrome.runtime.sendMessage);
  function afterText(txt){
    if(encoding === 'gbk'){ return new TextDecoder('gbk').decode(iso88591ToBytes(txt)); }
    return txt;
  }
  if(useSW){
    return new Promise(function(resolve, reject){
      chrome.runtime.sendMessage({type:'xfetch', url: url}, function(r){
        var e = chrome.runtime.lastError;
        if(e){ reject(new Error('SW: ' + (e.message || 'sendMessage fail'))); return; }
        if(r && r.ok){ resolve(afterText(r.body)); return; }
        reject(new Error('SW fail: ' + (r && r.error || 'unknown') + (r && r.retries ? ' (重试'+r.retries+'次后)' : '')));
      });
    });
  }
  /* 非扩展环境（如 file:// 桌面版）无 SW，退回页面直连 */
  return fetch(url, {credentials: 'omit'}).then(function(r){
    if(encoding === 'gbk') return r.arrayBuffer().then(function(ab){ return new TextDecoder('gbk').decode(ab); });
    return r.text();
  });
}

function fetchJsonpVar(url, varname){
  return getRemoteText(url).then(function(txt){
    var v = extractAfterVar(txt, varname);
    if(v === null) throw new Error('jsonp parse fail: ' + varname);
    return v;
  });
}

function fetchJsonpCallback(url){
  // callback({...}) 格式：取文本，在第一个 ( 后配对提取第一个 JSON
  return getRemoteText(url).then(function(txt){
    var i = txt.indexOf('(');
    if(i < 0) throw new Error('jsonp callback paren missing');
    var start = i + 1;
    while(start < txt.length && /\s/.test(txt[start])) start++;
    if(start >= txt.length) throw new Error('jsonp empty');
    if(txt[start] !== '[' && txt[start] !== '{' && txt[start] !== '"') throw new Error('jsonp non-json start');
    var end = matchBracket(txt, start);
    if(end < 0) throw new Error('jsonp unclosed');
    var v = looseJsonParse(txt.substring(start, end + 1));
    if(v === null) throw new Error('jsonp loose parse fail');
    return v;
  });
}

function fetchJSON(url, timeout){
  return Promise.race([
    getRemoteText(url).then(function(txt){ return JSON.parse(txt); }),
    new Promise(function(_, rej){ setTimeout(function(){ rej(new Error('fetch timeout')); }, timeout || 10000); })
  ]);
}

/* jsonp 兼容旧签名，但内部已切到 fetch+文本提取 */
var cbSeq = 0;
function jsonp(base, params, cbParam){
  return new Promise(function(resolve, reject){
    var cb = '__emcb' + (++cbSeq);
    var settled = false;
    var q = Object.keys(params).map(function(k){ return k + '=' + encodeURIComponent(params[k]); }).join('&');
    var url = base + (base.indexOf('?') >= 0 ? '&' : '?') + q + '&' + (cbParam || 'cb') + '=' + cb;
    // 先试 callback(...) 格式；否则试 var cb=... 格式
    fetchJsonpCallback(url).then(function(data){
      if(!settled){ settled = true; resolve(data); }
    }, function(err1){
      fetchJsonpVar(url, cb).then(function(data){
        if(!settled){ settled = true; resolve(data); }
      }, function(err2){
        if(!settled){ settled = true; reject(err1 || err2); }
      });
    });
    setTimeout(function(){ if(!settled){ settled = true; reject(new Error('jsonp timeout')); } }, 12000);
  });
}

function fmtNum(n, d){ if(n === null || n === undefined || isNaN(n)) return '--'; return Number(n).toLocaleString('zh-CN', {minimumFractionDigits: d===undefined?2:d, maximumFractionDigits: d===undefined?2:d}); }
function fmtPct(n){ if(n === null || n === undefined || isNaN(n)) return '--'; return (n > 0 ? '+' : '') + Number(n).toFixed(2) + '%'; }
function fmtSigned(n, d){ if(n === null || n === undefined || isNaN(n)) return '--'; return (n > 0 ? '+' : '') + fmtNum(n, d); }
function cls(n){ return n > 0 ? 'up' : (n < 0 ? 'down' : ''); }
function clsTxt(n){ return n > 0 ? 'var(--red)' : (n < 0 ? 'var(--green)' : 'var(--muted)'); }
/* HTML 转义：所有远端字符串（基金名/股票名/板块名/提醒消息）拼到 innerHTML 前必须先转义，
   防 & < > " ' 破坏 HTML 结构或注入脚本。null/undefined 返回空串。 */
function escHtml(s){
  if(s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ================= 持仓存储 ================= */
/* v1.1.0 字段兼容：旧持仓补 realized(累计已实现盈亏) / tCount(操作次数)，缺省 0 */
function normRealized(x){
  if(x && typeof x === 'object'){
    if(typeof x.realized !== 'number' || isNaN(x.realized)) x.realized = 0;
    if(typeof x.tCount !== 'number' || isNaN(x.tCount)) x.tCount = 0;
  }
  return x;
}
/* v1.1.0 分笔（lot）：记录每笔加仓的「买入日期 + 份额 + 净值」，
   赎回时按先进先出（FIFO）算持有天数，再按持有期分档取对应赎回费率。 */
function normLots(h){
  if(!h || typeof h !== 'object') return h;
  if(!Array.isArray(h.lots)) h.lots = [];
  /* 旧数据没有分笔：按当前份额补一条「日期未知」的分笔（赎回时会提示并按最长档估算） */
  if(!h.lots.length && (h.shares || 0) > 0) h.lots = [{d: null, s: h.shares, p: h.cost || 0}];
  return h;
}
function normHolding(x){ return normLots(normRealized(x)); }
function loadHoldings(){
  try{ var raw = localStorage.getItem(LS_KEY); if(raw !== null){ var h = JSON.parse(raw); if(Array.isArray(h)) return h.map(normHolding); } }catch(e){}
  try{ var oldRaw = localStorage.getItem('fund_board_holdings_v1'); if(oldRaw !== null){ var old = JSON.parse(oldRaw); if(Array.isArray(old)) return old.map(normHolding); } }catch(e){}
  return null;
}
function saveHoldings(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(holdings)); }catch(e){ console.error('[ext] saveHoldings 失败:', e && e.message || e); toast('持仓保存失败：存储已满或隐私模式'); } }
var holdings = loadHoldings();
if(!holdings){
  /* 初始安装为空仓状态，不再预置示例持仓；用户可点击顶栏「+」添加 */
  holdings = [];
  saveHoldings();
}
var fundInfo = {}; /* code -> {name, gszzl, gsz, dwjz, gztime, trend} */

/* ================= 数据接口 ================= */

/* 基金历史净值走势（pingzhongdata 同时含 fS_name 基金名称，可作估值接口的兜底）
   MV3 下用 fetchJsonpVar 替代 loadScript，避免动态注入远程 <script>
   注：服务端 Content-Type=application/javascript 无 charset 声明，浏览器 fetch 默认按 UTF-8 解码，
   SW 中转得到的 body 也是 UTF-8 JS 字符串。fS_name 是字符串字面量（不是数组），不能用
   fetchJsonpVar(extractAfterVar 检测 [ 或 {)——这里用正则直接提取字符串值 */
function fetchFundTrend(code){
  var url = 'https://fund.eastmoney.com/pingzhongdata/' + code + '.js?t=' + Date.now();
  return Promise.all([
    fetchJsonpVar(url, 'Data_netWorthTrend').catch(function(){ return []; }),
    getRemoteText(url).then(function(txt){
      var m = txt.match(/var\s+fS_name\s*=\s*"([^"]+)"/);
      return m ? m[1] : null;
    }).catch(function(){ return null; })
  ]).then(function(arr){
    var t = arr[0] || [];
    var name = arr[1];
    var trend = t.slice(-9).map(function(p){
      var d = new Date(p.x);
      var ds = d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2);
      return {date: ds, nav: p.y, ret: (p.equityReturn !== undefined && p.equityReturn !== null ? Number(p.equityReturn) : null)};
    });
    return {name: name, trend: trend};
  });
}

/* 东财 F10 历史净值（api.fund.eastmoney.com/f10/lsjz）—— 权威官方净值源。
   不受 fundmobapi/push2 风控影响（本机实测 200 正常返回），且对"接口更新滞后"的基金
   （如部分 ETF 联接基金 pingzhongdata 走势末点还停在 T-1）也能拿到 T 日官方净值。
   优先级高于 pingzhongdata 走势：只要 FSRQ===今日，就认定官方净值已公布并覆盖估算。 */
function fetchLsjz(code){
  var url = 'https://api.fund.eastmoney.com/f10/lsjz?fundCode=' + code + '&pageIndex=1&pageSize=2&_=' + Date.now();
  return fetchJSON(url).then(function(j){
    if(j && j.ErrCode && j.ErrCode !== 0){ console.log('[ext] ' + code + ' lsjz 接口错误 ErrCode=' + j.ErrCode + ' msg=' + (j.ErrMsg || '')); return null; }
    var list = j && j.Data && j.Data.LSJZList;
    if(!list || !list.length){ console.log('[ext] ' + code + ' lsjz 无 LSJZList:', JSON.stringify(j).slice(0, 200)); return null; }
    var latest = list[0];
    var prev = list[1] || null;
    return {
      date: latest.FSRQ,
      nav: parseFloat(latest.DWJZ),
      pct: (latest.JZZZL !== undefined && latest.JZZZL !== null && latest.JZZZL !== '') ? parseFloat(latest.JZZZL) : null,  /* 已是百分比数值,如 -1.35 */
      prevNav: prev ? parseFloat(prev.DWJZ) : null
    };
  });
}

/* 按指定日期查基金收盘净值（东财 F10 历史净值，带起止日期窗口）
   用于基金加仓 / 减仓：价 = 该交易日收盘净值（用户录入的是日期 + 金额 / 份额）。
   返回 {date, nav}；该日休市或净值未公布时返回 null，由调用方兜底。 */
function fetchNavByDate(code, date){
  var url = 'https://api.fund.eastmoney.com/f10/lsjz?fundCode=' + code
          + '&pageIndex=1&pageSize=1&startDate=' + encodeURIComponent(date)
          + '&endDate=' + encodeURIComponent(date) + '&_=' + Date.now();
  return fetchJSON(url).then(function(j){
    var list = j && j.Data && j.Data.LSJZList;
    if(!list || !list.length) return null;
    var r = list[0];
    var nav = parseFloat(r.DWJZ);
    if(isNaN(nav) || nav <= 0) return null;
    return {date: r.FSRQ || date, nav: nav};
  }).catch(function(e){ console.log('[ext] 按日期查净值失败:', e && e.message || e); return null; });
}

/* 个股历史日K（新浪，与沪深300 同一通道 CN_MarketDataService.getKLineData）
   返回 [{date:'2026-08-07', close:12.34}]，用于走势图把股票纳入组合加权。
   注：新浪该接口为不复权价，7 日短窗口内除权除息概率低，影响可忽略 */
function fetchStockTrend(code){
  var url = 'https://quotes.sina.cn/cn/api/jsonp_v2.php/var%20_stk_'
    + code + '_k=/CN_MarketDataService.getKLineData?symbol=' + code
    + '&scale=240&ma=no&datalen=10&_=' + Date.now();
  return fetchJsonpVar(url, '_stk_' + code + '_k').then(function(ks){
    ks = ks || [];
    return ks.map(function(o){
      return {date: o.day, close: parseFloat(o.close)};
    }).filter(function(p){ return !isNaN(p.close); });
  });
}

/* 腾讯行情（指数/个股通用，个股代码如 sh600519/sz000858）
   MV3 下改用 fetch+正则解析 v_xxx="~pb~..." 文本
   注：腾讯接口返回 GBK 编码（Content-Type: text/html; charset=GBK），必须 TextDecoder 解码 */
function fetchTencent(codes){
  var url = 'https://qt.gtimg.cn/q=' + codes.join(',');
  return fetch(url, {credentials: 'omit'}).then(function(r){ return r.arrayBuffer(); }).then(function(buf){
    var txt = new TextDecoder('gbk').decode(buf);
    var out = {};
    codes.forEach(function(c){
      var m = txt.match(new RegExp('v_' + c + '="([^"]*)"'));
      if(m){
        var p = m[1].split('~');
        var price = parseFloat(p[3]), prev = parseFloat(p[4]);
        if(!isNaN(price) && price > 0 && !isNaN(prev) && prev > 0){
          out[c] = {name: p[1], price: price, prevClose: prev, pct: (price - prev) / prev * 100, time: p[30] || ''};
        }
      }
    });
    return out;
  });
}

/* ================= 单行计算 ================= */
/* 份额模式：市值=份额×最新确认净值
   今日盈亏分三档：
     盘中（estType = official/sina/holding）：份额×(估算净值−昨日净值)
     盘后已结算（estType = nav）：持仓市值×今日实际涨跌幅（NAVCHGRT）
     否则不显示
   累计盈亏=市值−份额×成本价
   市值模式（无份额）：今日盈亏≈市值×估算涨幅，无累计盈亏 */
function calcRow(h, info){
  var pct = (info && info.gszzl !== null && !isNaN(info.gszzl)) ? Number(info.gszzl) : null;
  var r = {pct: pct, mv: null, prevMv: null, pnl: null, cumPnl: null, cumPct: null, precise: false, pnlSrc: null};
  if(h.shares && info && (info.dwjz || info.gsz)){
    r.precise = true;
    r.mv = h.shares * (info.gsz || info.dwjz); /* 市值 = 份额 × 最新净值（盘中用估算gsz=当前值，盘后用确认净值；dwjz是昨收） */
    /* 持有收益率 / 累计盈亏 用「已结算市值」：
       NAV 已公布(estType='nav') → 取今日确认净值；未公布(盘中/盘后估值) → 取最近一个已确认净值(dwjz=上一交易日)。
       这样盘中/盘后的实时估值不会晃动持有收益率，只在新净值公布后才更新（估值不显示这项） */
    var settledMv = null;
    if(info.estType === 'nav'){ settledMv = h.shares * info.gsz; }   /* 今日确认净值 */
    else if(info.dwjz){ settledMv = h.shares * info.dwjz; }         /* 最近已确认净值（上一交易日） */
    if(info.estType === 'nav' && pct !== null){
      /* 盘后已结算 → 今日盈亏 = 市值 × 实际涨跌幅 */
      r.pnl = r.mv * pct / 100;
      r.prevMv = r.mv - r.pnl;            /* 修正昨收市值（原代码置为 mv 导致画面无变化） */
      r.pnlSrc = 'nav';
    }else if(info.estType === 'yNav' && pct !== null){
      /* 盘前/周末 → 昨日盈亏 = 市值 × 昨日单日涨跌幅（navPct 已写入 gszzl） */
      r.pnl = r.mv * pct / 100;
      r.prevMv = r.mv - r.pnl;
      r.pnlSrc = 'yNav';
    }else if(info.gsz && info.dwjz){
      r.pnl = h.shares * (info.gsz - info.dwjz); /* 盘中估算盈亏 */
      r.prevMv = r.mv - r.pnl;
      r.pnlSrc = 'est';
    }else{
      r.prevMv = r.mv;
    }
    if(h.cost && settledMv !== null){
      var cb = h.shares * h.cost;
      r.cumPnl = settledMv - cb;
      r.cumPct = (settledMv / cb - 1) * 100;
    }
  }else{
    r.mv = h.amount || null;
    if(pct !== null && h.amount){ r.pnl = h.amount * pct / 100; r.pnlSrc = 'est'; }
    r.prevMv = (r.mv !== null && r.pnl !== null) ? r.mv - r.pnl : r.mv;
  }
  return r;
}

/* ================= 渲染：指数 ================= */
/* 指数候选池（含 A股 / 港股 / 美股 / 商品），首页卡片最多显示 7 个，用户自选 */
var IDX_ALL = [
  {code:'sh000001', label:'沪市主板', group:'A股', color:'#4f8cff'},
  {code:'sh000300', label:'沪深300', group:'A股', color:'#f04545'},
  {code:'sz399006', label:'创业板指', group:'A股', color:'#e8a13a'},
  {code:'sh000688', label:'科创50', group:'A股', color:'#a06bd4'},
  {code:'sh000905', label:'中证500', group:'A股', color:'#f6c453'},
  {code:'sz399001', label:'深证成指', group:'A股', color:'#2dd4bf'},
  {code:'sh000016', label:'上证50', group:'A股', color:'#4f8cff'},
  {code:'bj899050', label:'北证50', group:'A股', color:'#e85a78'},
  {code:'sh000852', label:'中证1000', group:'A股', color:'#a06bd4'},
  {code:'hkHSI', label:'恒生指数', group:'港股', color:'#2dd4bf'},
  {code:'hkHSTECH', label:'恒生科技', group:'港股', color:'#2dd4bf'},
  {code:'hkHSCEI', label:'国企指数', group:'港股', color:'#2dd4bf'},
  {code:'usINX', label:'标普500', group:'美股', color:'#e8c15a'},
  {code:'usDJI', label:'道琼斯', group:'美股', color:'#e8c15a'},
  {code:'usIXIC', label:'纳斯达克', group:'美股', color:'#e8c15a'},
  {code:'usNDX', label:'纳指100', group:'美股', color:'#e8c15a'},
  {code:'hf_GC', label:'国际金价', group:'商品', color:'#e8c15a', gold:true}
];
var DEFAULT_IDX = ['sh000001','sh000300','sz399006','sh000688','hkHSTECH','sh000905','hf_GC'];
var IDX_KEY = 'fund_board_idx_config_v1';

function loadIdxConfig(){
  try{
    var raw = localStorage.getItem(IDX_KEY);
    // raw 存在且能解析成数组时，尊重用户选择（包括主动清空后的空数组）
    if(raw !== null && raw !== undefined){
      var arr = JSON.parse(raw);
      if(Array.isArray(arr)){
        var valid = new Set(IDX_ALL.map(function(x){ return x.code; }));
        arr = arr.filter(function(c){ return valid.has(c); });
        // 去重并截断，防止历史脏数据/重复触发导致状态错乱
        var seen = new Set(), out = [];
        arr.forEach(function(c){ if(!seen.has(c)){ seen.add(c); out.push(c); } });
        return out.slice(0, 7);
      }
    }
  }catch(e){}
  return DEFAULT_IDX.slice();
}
function saveIdxConfig(arr){
  try{ localStorage.setItem(IDX_KEY, JSON.stringify(arr.slice(0,7))); }catch(e){}
}
function getIdxItem(code){ return IDX_ALL.find(function(x){ return x.code === code; }); }
function resetIdxConfig(){
  saveIdxConfig(DEFAULT_IDX.slice());
  openIdxConfig();
  refreshAll();
}
function selectNoneIdxConfig(){
  saveIdxConfig([]);
  openIdxConfig();
  refreshAll();
}

/* 新浪全 A 列表（jsonp_v2 返回 callback 形如 var _cb=([...])，本地按 changepercent 统计涨跌家数）
   MV3 下不能用 <script> 注入（被 CSP script-src 'self' 拦截），改用 fetch + 文本解析 callback 数组 */
function sinaAllA(){
  var cb = '__sa' + Date.now();
  var url = 'https://vip.stock.finance.sina.com.cn/quotes_service/api/jsonp_v2.php/var%20' + cb + '%3D/Market_Center.getHQNodeData?node=hs_a&num=5000&page=1&sort=symbol&asc=1&_s_r_a=page';
  return fetchJsonpCallback(url).then(function(d){ return d; });
}

function renderIndices(tq, gold){
  var cfg = loadIdxConfig();
  var row = $('#idxRow');
  if(row) row.style.display = cfg.length ? '' : 'none';
  var sub = $('#idxSubtitle');
  if(sub) sub.textContent = cfg.length ? cfg.map(function(c){ var it = getIdxItem(c); return it ? it.label : c; }).join(' / ') : '未选择任何指数';
  var html = '';
  cfg.forEach(function(code){
    var it = getIdxItem(code);
    if(!it) return;
    html += '<div class="idx-card"><div class="nm"><i style="background:' + it.color + '"></i>' + escHtml(it.label) + '</div>';
    if(it.gold){
      if(gold){
        html += '<div class="price">$' + fmtNum(gold.price) + '</div>'
              + '<div class="chg ' + cls(gold.pct) + '">' + fmtPct(gold.pct) + '</div>'
              + '<div class="src">COMEX黄金 · ' + (gold.src === 'tencent' ? '腾讯实时' : '东财实时') + '</div>';
      }else{
        html += '<div class="price muted">--</div><div class="chg muted">--</div><div class="src">暂无数据</div>';
      }
    }else{
      var q = tq[code];
      if(q){
        html += '<div class="price">' + fmtNum(q.price) + '</div>'
              + '<div class="chg ' + cls(q.pct) + '">' + fmtPct(q.pct) + '</div>'
              + '<div class="src">今日涨幅 · 腾讯实时</div>';
      }else{
        html += '<div class="price muted">--</div><div class="chg muted">--</div><div class="src">暂无数据</div>';
      }
    }
    html += '</div>';
  });
  $('#idxRow').innerHTML = html;
}

/* 指数自选配置弹窗 */
function openIdxConfig(){
  var cfg = loadIdxConfig();
  // 修复/去重后的配置落盘，覆盖可能因双重事件产生的脏数据
  saveIdxConfig(cfg);
  var groups = {};
  IDX_ALL.forEach(function(it){ (groups[it.group] = groups[it.group] || []).push(it); });
  var html = '';
  Object.keys(groups).forEach(function(g){
    html += '<div class="idx-group"><div class="idx-group-title">' + escHtml(g) + '</div><div class="idx-group-items">';
    groups[g].forEach(function(it){
      var isActive = cfg.indexOf(it.code) >= 0;
      var checked = isActive ? 'checked' : '';
      var activeCls = isActive ? ' active' : '';
      html += '<label class="idx-cb' + (it.gold ? ' gold' : '') + activeCls + '">'
            + '<input type="checkbox" data-evt="change" data-act="toggleIdx" data-args=\'["' + it.code + '","event"]\' ' + checked + '>'
            + '<span>' + escHtml(it.label) + '</span></label>';
    });
    html += '</div></div>';
  });
  var body = $('#idxConfigBody');
  if(body) body.innerHTML = html;
  var cnt = $('#idxConfigCount');
  if(cnt){ cnt.textContent = cfg.length; cnt.className = 'idx-count' + (cfg.length >= 7 ? ' warn' : ''); }
  var sub = $('#idxSubtitle');
  if(sub){
    var names = cfg.map(function(c){ var it = getIdxItem(c); return it ? it.label : c; }).join(' / ');
    sub.textContent = names || '未选择';
  }
  $('#maskIdxConfig').classList.add('show');
}
function toggleIdx(code, e){
  var cfg = loadIdxConfig();
  var el = e && e.target;
  var checked = el ? el.checked : false;
  var label = el && el.closest && el.closest('.idx-cb');
  var pos = cfg.indexOf(code);
  if(checked){
    if(pos < 0){
      if(cfg.length >= 7){
        if(el) el.checked = false;
        toast('最多选择 7 个指数');
        return;
      }
      cfg.push(code);
      saveIdxConfig(cfg);
      if(label) label.classList.add('active');
    }
  }else{
    if(pos >= 0){
      cfg.splice(pos, 1);
      saveIdxConfig(cfg);
      if(label) label.classList.remove('active');
    }
  }
  var cnt = $('#idxConfigCount');
  if(cnt){ cnt.textContent = cfg.length; cnt.className = 'idx-count' + (cfg.length >= 7 ? ' warn' : ''); }
  var sub = $('#idxSubtitle');
  if(sub){
    var names = cfg.map(function(c){ var it = getIdxItem(c); return it ? it.label : c; }).join(' / ');
    sub.textContent = names || '未选择';
  }
  refreshAll();
}
function closeIdxConfig(){ $('#maskIdxConfig').classList.remove('show'); }

/* ================= 渲染：涨跌家数 =================
   口径说明：东财 ulist.np 的 f104/f105/f106 是按「证券所属交易所」全量统计，
   而非该指数的成分股。传 1.000002(上证A指) = 沪市 A 股（不含沪 B），
   传 0.399107(深证A指) = 深市 A 股（不含深 B），0.899050(北证50) = 整个北交所（无 B 股）。
   三者相加 = 沪深京 A 股全市场（不含 B 股），实测比含B口径少约 60-90 只。 */
var ZD_MKT = {'000002':'沪', '399107':'深', '899050':'京'};
function renderZd(diff, src, host){
  var up = 0, down = 0, flat = 0;
  var parts = [];
  Object.keys(diff).forEach(function(k){
    var d = diff[k];
    var u = Number(d.f104) || 0, dn = Number(d.f105) || 0, f = Number(d.f106) || 0;
    up += u; down += dn; flat += f;
    var nm = ZD_MKT[d.f12] || d.f12;
    parts.push(nm + ' <span class="up">' + u + '</span>/<span class="down">' + dn + '</span>');
  });
  renderZdRaw(up, down, flat, src, host, parts);
}
function renderZdRaw(up, down, flat, src, host, parts){
  var tot = up + down;
  $('#upCnt').textContent = up.toLocaleString();
  $('#downCnt').textContent = down.toLocaleString();
  $('#flatCnt').textContent = '平盘 ' + flat.toLocaleString();
  if(tot <= 0) return;
  $('#barU').style.width = (up / tot * 100) + '%';
  $('#barD').style.width = (down / tot * 100) + '%';
  var now = new Date();
  var pad = function(x){ return String(x).padStart(2, '0'); };
  var time = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
  $('#zdSub').textContent = '上涨 ' + (up / tot * 100).toFixed(1) + '% · 下跌 ' + (down / tot * 100).toFixed(1) + '%'
    + ' · 更新 ' + time;
  /* 市场情绪温度：按上涨占比分档（冰点<25% / 偏冷25-40 / 中性40-60 / 偏暖60-75 / 过热>75%），纯本地计算 */
  var moodEl = $('#zdMood');
  if(moodEl){
    var pct = up / tot * 100, cls, txt;
    if(pct >= 75){ cls = 't-hot'; txt = '过热'; }
    else if(pct >= 60){ cls = 't-warm'; txt = '偏暖'; }
    else if(pct >= 40){ cls = ''; txt = '中性'; }
    else if(pct >= 25){ cls = 't-cool'; txt = '偏冷'; }
    else{ cls = 't-ice'; txt = '冰点'; }
    moodEl.className = 'mood-temp ' + cls;
    moodEl.textContent = '情绪·' + txt + ' ' + pct.toFixed(0) + '%';
  }
  var detail = '';
  if(parts && parts.length){
    detail = parts.join(' <span class="sub-dot">·</span> ')
           + '　共 ' + (up + down + flat).toLocaleString() + ' 只（A股）';
  }
  var el = $('#zdDetail');
  if(el) el.innerHTML = detail;
}

/* ================= 涨停/跌停家数（市场情绪行） =================
   数据源：东财 push2ex 涨停池/跌停池（问财 ztzt 同源），盘中实时、收盘后为当日终值。
   - getTopicZTPool / getTopicDTPool，pagesize=500 一次取全，pool.length 即家数。
   - 非交易日/当日无池：data 为空 → 显示 --（跌停 0 是有效信息，接口返回空池时 pool=[] → 显示 0）。
   - 失败静默显示 --，不影响其他卡片。 */
async function loadZtDt(){
  var now = new Date();
  var pad2 = function(x){ return String(x).padStart(2, '0'); };
  var ymd = now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate());
  var ut = '7eea3edcaed734bea9cbfc24409ed989';
  async function poolCnt(api, sort){
    var url = 'https://push2ex.eastmoney.com/getTopic' + api + 'Pool?ut=' + ut
      + '&dpt=wz.ztzt&Pageindex=0&pagesize=500&sort=' + encodeURIComponent(sort) + '&date=' + ymd;
    try{
      var j = await fetchJSON(url, 10000);
      if(j && j.data && j.data.pool) return j.data.pool.length;
      return null;
    }catch(e){
      /* SW 通道失败 → 页面直连兜底（rules.json id5/id6 已改写 Origin/Referer + 注入 ACAO，CSP 已放行该域） */
      try{
        var r = await fetch(url, {credentials:'omit'});
        var j2 = await r.json();
        if(j2 && j2.data && j2.data.pool) return j2.data.pool.length;
      }catch(e2){}
      return null;
    }
  }
  var zt = await poolCnt('ZT', 'fbt:asc');
  var dt = await poolCnt('DT', 'fund:asc');
  var elZ = $('#ztCnt'), elD = $('#dtCnt');
  if(elZ) elZ.textContent = (zt === null) ? '--' : String(zt);
  if(elD) elD.textContent = (dt === null) ? '--' : String(dt);
}

/* ================= 大盘实时资金流向图（涨跌家数卡下半部） =================
   数据源：push2 fflow/kline，klt=1 分时「累计净流入」，沪深两市 secid 前端相加。
   - https://push2.eastmoney.com/api/qt/stock/fflow/kline/get?lmt=0&klt=1&secid={1.000001|0.399001}
     &fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56&ut=b2884a393a59ad64002292a3e90d46a5
   - klines 每条 "2026-09-08 09:31,主力,小单,中单,大单,超大单"（单位元，收盘后全天 240 条）。
   - 口径校验：主力 = 大单 + 超大单；主力 + 中单 + 小单 ≈ 0（实测成立）。
   - 5 线配色对齐东财 zjlx 页：主力玫粉 / 超大单暗红 / 大单正红 / 中单橙黄 / 小单浅蓝。
   - 北交所资金量极小，沪深两市合计口径忽略（标题已注明）。 */
var zdFlowChart = null;
function zdFlowDispose(){
  if(zdFlowChart){ try{ zdFlowChart.dispose(); }catch(e){} zdFlowChart = null; }
}
async function loadMarketFlow(){
  var host = document.getElementById('zdFlow');
  if(!host) return;
  var mkUrl = function(secid){
    return 'https://push2.eastmoney.com/api/qt/stock/fflow/kline/get?lmt=0&klt=1&secid=' + secid
      + '&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56&ut=b2884a393a59ad64002292a3e90d46a5';
  };
  function parseKlines(j){
    var arr = (j && j.data && j.data.klines) || [];
    return arr.map(function(s){
      var p = s.split(',');
      return {t: p[0].slice(-5), zl: +p[1] || 0, xd: +p[2] || 0, zd: +p[3] || 0, dd: +p[4] || 0, cdd: +p[5] || 0};
    });
  }
  var rs = await Promise.all([
    fetchJSON(mkUrl('1.000001'), 12000).catch(function(){ return null; }),
    fetchJSON(mkUrl('0.399001'), 12000).catch(function(){ return null; })
  ]);
  var sh = parseKlines(rs[0]), sz = parseKlines(rs[1]);
  if(!sh.length && !sz.length){
    host.innerHTML = '<div class="muted" style="padding:14px 4px">资金流向图暂无数据（盘前/接口不可用）</div>';
    return;
  }
  /* 按分钟时间对齐相加（两市长度应一致 240 条；以沪市为基准，深市缺的分钟跳过） */
  var map = {};
  sz.forEach(function(r){ map[r.t] = r; });
  var rows = [];
  sh.forEach(function(r){
    var o = map[r.t];
    rows.push(o ? {t: r.t, zl: r.zl + o.zl, xd: r.xd + o.xd, zd: r.zd + o.zd, dd: r.dd + o.dd, cdd: r.cdd + o.cdd} : r);
  });
  if(!rows.length) rows = sz;
  renderMarketFlow(rows);
}
function renderMarketFlow(rows){
  var host = document.getElementById('zdFlow');
  if(!host || !rows.length) return;
  zdFlowDispose();
  if(!window.echarts){ host.innerHTML = '<div class="muted" style="padding:14px 4px">图表组件未加载</div>'; return; }
  host.innerHTML = '';
  var TC = themeColors();
  var Y = 1e8;
  var times = rows.map(function(r){ return r.t; });
  function mkLine(key, name, color){
    return {name: name, type: 'line', showSymbol: false, lineStyle: {width: 1.4, color: color},
      itemStyle: {color: color}, emphasis: {disabled: true},
      data: rows.map(function(r){ return +(r[key] / Y).toFixed(2); })};
  }
  zdFlowChart = echarts.init(host, null, {renderer: 'canvas'});
  zdFlowChart.setOption({
    animation: false,
    grid: {left: 46, right: 12, top: 10, bottom: 22},
    tooltip: {trigger: 'axis', backgroundColor: TC.chartBg, borderColor: TC.chartBorder,
      textStyle: {color: TC.text, fontSize: 11},
      valueFormatter: function(v){ return (v === null || v === undefined) ? '--' : (Number(v) > 0 ? '+' : '') + Number(v).toFixed(2) + ' 亿'; }},
    xAxis: {type: 'category', data: times, axisLine: {lineStyle: {color: TC.chartAxis}}, axisTick: {show: false},
      axisLabel: {color: TC.muted, fontSize: 10, interval: Math.max(1, Math.floor(times.length / 5))}},
    yAxis: {type: 'value', scale: true, splitLine: {lineStyle: {color: TC.chartSplit}}, axisLine: {show: false}, axisTick: {show: false},
      axisLabel: {color: TC.muted, fontSize: 10, formatter: function(v){ return v + '亿'; }}},
    series: [
      mkLine('zl', '主力', '#f2569c'),
      mkLine('cdd', '超大单', '#a02833'),
      mkLine('dd', '大单', '#f03434'),
      mkLine('zd', '中单', '#f5a623'),
      mkLine('xd', '小单', '#a8c6f0')
    ]
  }, true);
  if(!window.__zdFlowResizeBound){
    window.__zdFlowResizeBound = true;
    window.addEventListener('resize', function(){ if(zdFlowChart) zdFlowChart.resize(); });
  }
  /* 图例：5 线最新累计值（数值红正绿负，中国习惯；线色固定对齐东财） */
  var elLg = document.getElementById('zdFlowLegend');
  if(elLg){
    var last = rows[rows.length - 1];
    var items = [['zl', '主力', '#f2569c'], ['cdd', '超大单', '#a02833'], ['dd', '大单', '#f03434'], ['zd', '中单', '#f5a623'], ['xd', '小单', '#a8c6f0']];
    elLg.innerHTML = items.map(function(it){
      var v = last[it[0]] / Y;
      var vCls = v > 0 ? 'up' : (v < 0 ? 'down' : 'muted');
      return '<span class="flg"><i style="background:' + it[2] + '"></i>' + it[1]
        + ' <b class="' + vCls + '">' + (v > 0 ? '+' : '') + v.toFixed(2) + '亿</b></span>';
    }).join('');
  }
}

/* ================= 渲染：板块资金流（单卡 · ECharts 柱状图 · 手动查看） ================= */
/* 数据源：东财 dataapi/bkzj/getbkzj（hy.html 行业资金流同源），单位元。
   周期字段：今日=f62，5日=f164，10日=f174（该接口一次只能取一个 key，见 loadBkCards）。
   展示（对齐东财 el-tabs 板块资金流）：全量板块按净额降序从左到右；
        净流入红柱向上、净流出绿柱向下，零轴由 ECharts 按数值自适应；
        柱顶标数值（亿元，随柱色红/绿）、柱下竖排行业名（每字换行，避免旋转截断）。
   ★ 不做自动滚动（v133，用户明确要求）：窗口停在「流入最强」的前 N 个板块，
     需要看更后面的板块时，拖底部滑块或在图上滚轮/拖动即可。
   ★ ECharts 不认 CSS 变量——颜色统一走 themeColors() 运行时读取，切主题后 refreshAll 会自动重绘。 */
var bkChart = null;            /* ECharts 实例（每次重绘前 dispose，避免重复绑定与内存泄漏） */
var BK_WIN = 32;               /* 一屏显示几个板块（窗口宽度，可拖滑块改变可视区间；对齐东财默认密度） */
function bkDisposeChart(){
  if(bkChart){ try{ bkChart.dispose(); }catch(e){} bkChart = null; }
}
function renderBkFlow(list, field, emptyText){
  field = field || 'f62';
  var host = document.getElementById('bkFlow');
  if(!host) return;
  bkDisposeChart();
  if(!list || !list.length){
    host.innerHTML = '<div class="muted" style="padding:14px 4px">' + (emptyText || '暂无数据') + '</div>';
    return;
  }
  if(!window.echarts){
    host.innerHTML = '<div class="muted" style="padding:14px 4px">图表组件未加载</div>';
    return;
  }
  host.innerHTML = '';
  var TC = themeColors();
  var names = [], vals = [];
  list.forEach(function(b){
    names.push(b.f14 || '');
    var yi = (Number(b[field]) || 0) / 1e8;                       /* 元 → 亿元 */
    var c = yi > 0 ? TC.red : (yi < 0 ? TC.green : TC.muted);
    vals.push({value: +yi.toFixed(2), itemStyle:{color:c}, label:{color:c, position: yi > 0 ? 'top' : 'bottom'}});
  });
  var n = names.length;
  var win = Math.min(BK_WIN, n);
  bkChart = echarts.init(host, null, {renderer:'canvas'});
  bkChart.setOption({
    animation: false,                                             /* 128 柱 + 窗口移动，开动画反而抖 */
    grid:{left:54, right:16, top:14, bottom:118},
    tooltip:{trigger:'axis', axisPointer:{type:'shadow'}, backgroundColor:TC.chartBg, borderColor:TC.chartBorder,
      textStyle:{color:TC.text, fontSize:12},
      valueFormatter:function(v){ return (v === null || v === undefined) ? '--' : (Number(v) > 0 ? '+' : '') + Number(v).toFixed(2) + ' 亿'; }},
    xAxis:{type:'category', data:names, axisLine:{lineStyle:{color:TC.chartAxis}}, axisTick:{show:false},
      axisLabel:{color:TC.text, fontSize:11, fontWeight:500, interval:0, hideOverlap:false, align:'center', verticalAlign:'top', lineHeight:14,
        formatter:function(v){ return (v || '').split('').join('\n'); }}},
    axisPointer:{label:{show:false}},
    yAxis:{type:'value', scale:true, splitLine:{lineStyle:{color:TC.chartSplit}}, axisLine:{show:false}, axisTick:{show:false},
      axisLabel:{color:TC.muted, fontSize:10, formatter:function(v){ return v.toFixed(2) + '亿'; }}},
    dataZoom:[
      {type:'inside', startValue:0, endValue:win - 1, zoomLock:true, zoomOnMouseWheel:false, moveOnMouseWheel:true, moveOnMouseMove:true},
      {type:'slider', startValue:0, endValue:win - 1, zoomLock:true, height:24, bottom:8, showDetail:false, brushSelect:false,
       borderColor:'#e0e0e0', backgroundColor:'#f5f5f5', fillerColor:'rgba(34,139,230,.24)',
       handleStyle:{color:'#228be6', borderColor:'#228be6'}, handleSize:'120%', moveHandleSize:0,
       dataBackground:{lineStyle:{color:'#d9d9d9'}, areaStyle:{color:'#d9d9d9', opacity:.3}},
       selectedDataBackground:{lineStyle:{color:'#228be6'}, areaStyle:{color:'#228be6', opacity:.25}}}
    ],
    series:[{
      type:'bar', data:vals, barMaxWidth:18,
      label:{show:true, fontSize:9, lineHeight:11, formatter:function(p){ return p.value.toFixed(2) + '亿'; }},
      markLine:{silent:true, symbol:'none', animation:false, label:{show:false},
        lineStyle:{color:TC.chartAxis, width:1}, data:[{yAxis:0}]}
    }]
  }, true);
  /* 不自动滚动：窗口默认停在前 N 个（流入最强）板块，用户可拖底部滑块或图上滚轮/拖动查看其余板块 */
  if(!window.__bkResizeBound){
    window.__bkResizeBound = true;
    window.addEventListener('resize', function(){ if(bkChart) bkChart.resize(); });
  }
}

/* ===== 板块资金流单卡：今日 / 5日 / 10日 周期选项卡 ===== */
/* 单卡统一记忆选中周期；三周期数据各拉一次存缓存，切 tab 本地重排、零额外请求 */
var BK_PERIOD_FIELD = {today:'f62', d5:'f164', d10:'f174'};
var BK_PERIOD_LABEL = {today:'今日', d5:'5日', d10:'10日'};
var bkPeriod = {bk:'today'};
/* 板块类型：行业(hy)/概念(gn)/地域(dy)，各自独立拉取三周期数据缓存到 bkDataStore */
var BK_TYPES = [
  {key:'hy', label:'行业', code:'m:90+s:4'},
  {key:'gn', label:'概念', code:'m:90+t:3'},
  {key:'dy', label:'地域', code:'m:90+t:1'}
];
var bkSelType = 'hy';                   /* 当前选中板块类型（避免与 window.bkType 函数同名冲突） */
var bkDataStore = {};
BK_TYPES.forEach(function(t){ bkDataStore[t.key] = {today:null, d5:null, d10:null}; });
function setBkTab(cardKey, period){
  if(!BK_PERIOD_FIELD[period]) return;
  bkPeriod.bk = period;                 /* 单卡：忽略传入的 cardKey，统一用 'bk' */
  /* 高亮当前 tab（依赖按钮上的 data-bk-period 属性） */
  var btns = document.querySelectorAll('[data-bk-tabs] .bk-tab');
  for(var i = 0; i < btns.length; i++){
    var p = btns[i].getAttribute('data-bk-period');
    btns[i].className = 'bk-tab' + (p === period ? ' on' : '');
  }
  fillBkCard();
}
function bkType(typeKey){
  if(!bkDataStore[typeKey]) return;
  bkSelType = typeKey;
  var btns = document.querySelectorAll('[data-bk-types] .bk-type');
  for(var i = 0; i < btns.length; i++){
    var k = btns[i].getAttribute('data-bk-type');
    btns[i].className = 'bk-type' + (k === typeKey ? ' on' : '');
  }
  fillBkCard();
}
function fillBkCard(){
  var period = bkPeriod.bk || 'today';
  var store = bkDataStore[bkSelType] || {};
  var data = period === 'd5' ? store.d5 : (period === 'd10' ? store.d10 : store.today);
  if(!data || !data.length){
    /* 如果该周期还没数据，自动补拉一次（用户切换 5日/10日 时常见），避免显示"暂无数据" */
    var host = document.getElementById('bkFlow');
    if(host) host.innerHTML = '<div class="muted" style="padding:14px 4px">正在加载 ' + (BK_PERIOD_LABEL[period] || period) + ' 数据…</div>';
    loadBkPeriod(bkSelType, period).then(function(){ fillBkCard(); }).catch(function(){
      var host2 = document.getElementById('bkFlow');
      if(host2) host2.innerHTML = '<div class="muted" style="padding:14px 4px">' + (period === 'today' ? '今日暂无板块资金流（盘前/休市，可切 5日/10日）' : '暂无数据') + '</div>';
    });
    return;
  }
  var field = BK_PERIOD_FIELD[period] || 'f62';
  /* 单卡全量板块，按净额降序：流入最多在顶 → 流出最多在底 */
  var list = data.slice().sort(function(a, c){ return (Number(c[field]) || 0) - (Number(a[field]) || 0); });
  var emptyText = period === 'today' ? '今日暂无板块资金流（盘前/休市，可切 5日/10日）' : '暂无数据';
  renderBkFlow(list, field, emptyText);
}

/* ===== 板块资金流：按类型+周期补拉（单周期） ===== */
var bkFetching = {};   /* key:type+period，防止并发重复请求 */
async function loadBkPeriod(typeKey, period){
  if(!bkDataStore[typeKey] || !BK_PERIOD_FIELD[period]) return;
  var key = typeKey + '_' + period;
  if(bkFetching[key]) return bkFetching[key];
  var typeObj = null;
  for(var i = 0; i < BK_TYPES.length; i++){ if(BK_TYPES[i].key === typeKey){ typeObj = BK_TYPES[i]; break; } }
  if(!typeObj) return;
  bkFetching[key] = fetchJSON('https://data.eastmoney.com/dataapi/bkzj/getbkzj?key=' + BK_PERIOD_FIELD[period] + '&code=' + encodeURIComponent(typeObj.code), 12000)
    .then(function(r){
      bkDataStore[typeKey][period] = (r && r.data && r.data.diff) || [];
    }).catch(function(){
      /* 失败不覆盖旧数据，保留空数组或已有数据 */
    }).finally(function(){
      bkFetching[key] = null;
    });
  return bkFetching[key];
}

/* ===== 板块资金流：拉取三周期全量并填充单卡 ===== */
var bkRetryTimer = null;   /* 盘中「今日为空」自动补拉计时器（防呆：开着看板不点刷新，开盘后也能自愈） */
async function loadBkCards(){
  try{
    /* ★ 数据源（v127 定稿）：东财「行业资金流」页面 data.eastmoney.com/bkzj/hy.html 同源
         https://data.eastmoney.com/dataapi/bkzj/getbkzj?key=f62&code=m:90+s:4
       - code=m:90+s:4 → 128 个细分子行业（电池/半导体/消费电子/化学制药/通信设备…），与页面表格一一对应，
         金额即为页面那套大金额（实测电池 -19.05亿、通信设备 +39.43亿），不是 push2 的小金额快照版。
       - key：f62=今日主力净额 / f164=5日 / f174=10日。接口一次只认一个 key，故并发 3 个请求。
       - 返回纯 JSON（不支持 jsonp 的 cb 参数）。走 fetchJSON → getRemoteText → 后台 SW 代理（chrome.runtime
         sendMessage xfetch），SW 带 host_permissions 发出，不受页面 CORS 限制。
       - ⚠️ 只有 file:// 桌面版（无 SW，退化成页面直连）才会撞该域无 ACAO 头的 CORS 报错，
         已在 rules.json 加 id=4 响应头注入兜底。
       - 历史踩坑：v123 用 push2+m:90+t:2（496 混合板块）、v126 用 push2+m:90+s:2（31 个一级行业）
         都是为了绕开「误以为 dataapi 被 CORS 拒绝」而做的降级，现已回到页面同源的 128 行业。 */
    var bkzjBase = 'https://data.eastmoney.com/dataapi/bkzj/getbkzj';
    var keys = ['f62','f164','f174'], periods = ['today','d5','d10'];
    var tasks = [];
    BK_TYPES.forEach(function(t){
      keys.forEach(function(key, idx){
        var period = periods[idx];
        tasks.push(
          fetchJSON(bkzjBase + '?key=' + key + '&code=' + encodeURIComponent(t.code), 12000)
            .then(function(r){ bkDataStore[t.key][period] = (r && r.data && r.data.diff) || []; })
            /* 失败不覆盖已有数据：保留旧值或空数组，避免 d5/d10 单点失败把整张表清空 */
            .catch(function(){ if(!bkDataStore[t.key][period]) bkDataStore[t.key][period] = []; })
        );
      });
    });
    await Promise.all(tasks);
    fillBkCard();
    /* 自检：仅「行业」今日为空（盘前/开盘初）才排补拉；概念/地域不强制 */
    var hyToday = bkDataStore.hy.today || [];
    var anyToday = hyToday.some(function(b){ return Number(b.f62) || 0; });
    if(anyToday){
      if(bkRetryTimer){ clearTimeout(bkRetryTimer); bkRetryTimer = null; }   /* 今日已有值，取消待补拉 */
    }else{
      bkScheduleAutoRetry();   /* 接口通但今日 f62 全空（盘前/开盘初）→ 盘中定时补拉 */
    }
  }catch(e){ /* 网络失败不补拉：交给 refreshAll 下一轮自动刷新 */ }
}
function bkScheduleAutoRetry(){
  if(bkRetryTimer) return;
  if(!window.__fundIntraday) return;   /* 非 A 股交易时段（收盘/休市）不折腾 */
  if((bkDataStore.hy.today||[]).some(function(b){ return Number(b.f62) || 0; })) return;
  bkRetryTimer = setTimeout(function(){
    bkRetryTimer = null;
    loadBkCards().catch(function(){});
  }, 45000);   /* 45s 后静默补拉一次；仍空则 loadBkCards 内再次 schedule */
}

/* ================= 卡片折叠（涨跌家数 / 领涨 / 领跌） ================= */
// 注意：v2 起弃用 v1。v1 在 v107→v108→...→v114 反复折腾板块卡期间被冻结，
// 残留了 v107 时期的 bkUp/bkDown 折叠态以及 v109 合并期引入的 bk 键，
// 回滚 v107 后旧折叠态会误把 #bkUp/#bkDown 隐藏（用户报"不返回数据"）。
// v3（v127）：两张板块卡（bkUp/bkDown）合并为单卡 bk，升 v3 重置折叠态，保证默认展开。
var CARD_FOLD_KEY = 'fund_board_card_fold_v3';
var CARD_FOLD_KEYS = ['zd','bk'];
function loadCardFold(){
  try{
    var raw = localStorage.getItem(CARD_FOLD_KEY);
    if(raw){
      var obj = JSON.parse(raw);
      if(obj && typeof obj === 'object') return obj;
    }
  }catch(e){}
  return {};
}
function saveCardFold(obj){
  try{ localStorage.setItem(CARD_FOLD_KEY, JSON.stringify(obj)); }catch(e){}
}
function applyCardFold(key){
  var fold = loadCardFold();
  var collapsed = !!fold[key];
  var body = $('[data-fold-body="' + key + '"]');
  var btn = document.querySelector('[data-act="toggleCard"][data-args*=\'"' + key + '"\']');
  if(body) body.style.display = collapsed ? 'none' : '';
  if(btn) btn.textContent = collapsed ? '展示' : '收起';
  /* 展开后 ECharts 需重算尺寸：折叠时容器宽高为 0，不 resize 会画成空白/错位 */
  if(!collapsed){
    setTimeout(function(){
      try{ if(chartInstance) chartInstance.resize(); }catch(e){}
      try{ if(bkChart) bkChart.resize(); }catch(e){}
    }, 0);
  }
}
function applyAllCardFold(){
  CARD_FOLD_KEYS.forEach(function(k){ applyCardFold(k); });
}
function toggleCard(key){
  var fold = loadCardFold();
  fold[key] = !fold[key];
  saveCardFold(fold);
  applyCardFold(key);
}

/* ================= 渲染：持仓与汇总 ================= */
function renderHoldings(){
  var html = '', totalMv = 0, totalPnl = 0, totalCost = 0, hasCost = false, n = 0, realizedAll = 0, anyTime = '', noGzCount = 0, holdEstCount = 0, closeEstCount = 0, navTime = '';
  var prevMv = 0, cumAll = 0, ytdPnl = 0, ytdPrevMv = 0;
  holdings.forEach(function(h){
    var info = fundInfo[h.code];
    var c = calcRow(h, info);
    var name = info && info.name ? info.name : '加载中…';
    if(info && info.noGZ){ noGzCount++; }
    if(info && info.estType === 'holding'){ holdEstCount++; }
    if(info && info.estType === 'close'){ closeEstCount++; }
    if(info && info.gztime && !info.noGZ) anyTime = info.gztime;
    /* nav 已公布 → 采集发布时间：日期取权威源 info.navDate(YYYY-MM-DD)，时分从 info.gztime 抓 HH:MM */
    if(info && info.estType === 'nav' && info.navDate){
      var _md = (info.navDate.length >= 10 ? info.navDate.slice(5, 10) : '');   /* "08-26" */
      var _mm = /(\d{2}):(\d{2})/.exec(info.gztime || '');
      var _vt = _md ? (_mm ? (_md + ' ' + _mm[1] + ':' + _mm[2]) : (_md + ' 已公布')) : '';
      if(_vt && (!navTime || _vt > navTime)) navTime = _vt;
    }
    if(c.mv !== null) totalMv += c.mv;
    if(c.pnl !== null) totalPnl += c.pnl;
    if(c.prevMv !== null) prevMv += c.prevMv;
    if(c.cumPnl !== null){ totalCost += h.shares * h.cost; cumAll += c.cumPnl; hasCost = true; }
    if(h.realized) realizedAll += h.realized;
    n++;
    /* 昨日盈亏：市值 × 昨日单日涨跌幅(NAVCHGRT，mobapi 返回的"最新交易日涨跌幅"即昨日)。
       非盘中时段顶部卡会显示"昨日盈亏"而不是空洞的"今日盈亏=0" */
    if(info && info.navPct !== null && !isNaN(info.navPct) && c.mv !== null){
      ytdPnl += c.mv * info.navPct / 100;
      ytdPrevMv += c.mv;
    }
    /* 名称后缀：估算来源标识 */
    var suffix = '';
    if(info && info.estType === 'sina'){ suffix = ' <span style="font-size:11px;color:var(--blue)">(实时估算)</span>'; }
    else if(info && info.estType === 'holding'){ suffix = ' <span style="font-size:11px;color:#e8a13a">(重仓估算)</span>'; }
    else if(info && info.estType === 'nav'){ suffix = ' <span class="muted" style="font-size:11px">(净值已更新)</span>'; }
    else if(info && info.estType === 'close'){ suffix = ' <span class="muted" style="font-size:11px">(收盘估值)</span>'; }
    else if(info && info.estType === 'yNav'){ suffix = ' <span class="muted" style="font-size:11px">(昨日净值)</span>'; }
    else if(info && info.estType === 'cacheOld'){ suffix = ' <span class="muted" style="font-size:11px">(旧估值)</span>'; }
    else if(info && info.noGZ){ suffix = ' <span class="muted" style="font-size:11px">(无盘中估值)</span>'; }
    else if(!c.precise){ suffix = ' <span class="muted" style="font-size:11px">(市值估算)</span>'; }
    /* 涨幅列：有估值显示估算涨幅；无估值显示最近净值日涨幅并标日期 */
    var pctCell;
    if(c.pct !== null){
      pctCell = '<td class="' + cls(c.pct) + '">' + fmtPct(c.pct) + '</td>';
    }else if(info && info.noGZ && info.navPct !== null && info.navPct !== undefined){
      pctCell = '<td class="' + cls(info.navPct) + '">' + fmtPct(info.navPct)
              + '<div class="muted" style="font-size:11px">' + (info.gztime || '') + ' 净值</div></td>';
    }else{
      pctCell = '<td class="muted">--</td>';
    }
    html += '<tr><td title="' + escHtml(name) + '">' + escHtml(name) + suffix + '</td>'
          + '<td>' + h.code + '</td>'
          + '<td>' + fmtNum(c.mv) + '</td>'
          + '<td class="' + cls(c.pnl) + '">' + fmtSigned(c.pnl) + '</td>'
          + pctCell
          + '<td class="' + (c.cumPct !== null ? cls(c.cumPct) : 'muted') + '">' + (c.cumPct !== null ? fmtPct(c.cumPct) : '--') + '</td>'
          + '<td class="' + (c.cumPnl !== null ? cls(c.cumPnl) : 'muted') + '">' + (c.cumPnl !== null ? fmtSigned(c.cumPnl) : '--') + '</td>'
          + '<td class="' + (h.realized ? cls(h.realized) : 'muted') + '">' + (h.realized ? fmtSigned(h.realized) : '--') + '</td>'
          + `<td><span class="link" data-act="openTrade" data-args='["fund","${h.code}","add"]'>加仓</span><span class="link" data-act="openTrade" data-args='["fund","${h.code}","sell"]'>减仓</span><span class="link" data-act="openModal" data-args='["${h.code}"]'>编辑</span><span class="link" style="color:var(--red)" data-act="delFund" data-args='["${h.code}"]'>删除</span></td></tr>`;
  });
  var pctAll = prevMv > 0 ? totalPnl / prevMv * 100 : 0;
  var cumPctAll = (hasCost && totalCost > 0) ? (cumAll / totalCost) * 100 : null;
  /* 合计行（与股票合计样式一致：font-weight:700，跟随主题的 --row-total 底色）
     注：估算涨幅 / 持有收益率两列是百分比，加总无意义，留空 */
  if(n > 0){
    var cumAllCls = cumPctAll !== null ? (cumAll > 0 ? 'up' : (cumAll < 0 ? 'down' : 'muted')) : 'muted';
    html += '<tr class="total-row">'
          + '<td>合计</td>'
          + '<td></td>'
          + '<td>' + fmtNum(totalMv) + '</td>'
          + '<td class="' + cls(totalPnl) + '">' + (totalPnl !== 0 ? fmtSigned(totalPnl) : '--') + '</td>'
          + '<td></td>'
          + '<td></td>'
          + '<td class="' + cumAllCls + '">' + (hasCost ? fmtSigned(cumAll) : '--') + '</td>'
          + '<td class="' + (realizedAll > 0 ? 'up' : (realizedAll < 0 ? 'down' : 'muted')) + '">' + (realizedAll ? fmtSigned(realizedAll) : '--') + '</td>'
          + '<td></td></tr>';
  }
  $('#holdBody').innerHTML = html || '<tr><td colspan="9" class="muted" style="text-align:center;padding:20px">暂无基金持仓，点击顶部 <b>+</b> 按钮添加</td></tr>';

  /* 兼容 hasPnl 标志（原本是单独循环算的） */
  var hasPnl = false, latestNavDate = '';
  holdings.forEach(function(h){
    var c = calcRow(h, fundInfo[h.code]);
    if(c.pnl !== null) hasPnl = true;
    var nd = fundInfo[h.code] && fundInfo[h.code].navDate;
    if(nd && nd > latestNavDate) latestNavDate = nd;
  });
    /* 整段 section 显示控制：无任何基金持仓时连标题带表一起隐藏，
     避免页面出现一个空"暂无持仓"卡片挤占视觉空间 */
  $('#fundSection').style.display = holdings.length ? '' : 'none';
  return {
    totalMv: totalMv, totalPnl: totalPnl, prevMv: prevMv, pctAll: pctAll,
    fundCount: n, anyTime: anyTime, navTime: navTime, noGzCount: noGzCount, holdEstCount: holdEstCount, closeEstCount: closeEstCount,
    hasPnl: hasPnl, hasCost: hasCost, totalCost: totalCost, cumAll: cumAll, realizedAll: realizedAll,
    latestNavDate: latestNavDate,
    ytdPnl: ytdPnl, ytdPrevMv: ytdPrevMv, ytdPct: ytdPrevMv > 0 ? ytdPnl / ytdPrevMv * 100 : 0
  };
}

/* ================= 渲染：7日图表 ================= */
var chartInstance = null; /* 模块级复用，避免每次 refreshAll 重新 init 同一 DOM 并反复 addEventListener('resize') 造成内存泄漏 */
function renderChart(hsDates, hsCum, pfCum, todayPf, todayHs, wItems, yView){
  if(!window.echarts){ $('#chart').innerHTML = '<div class="err" style="padding-top:40px">图表组件加载失败（需联网加载 ECharts）</div>'; return; }
  var labels = hsDates.slice();
  var pfData = pfCum.slice();
  var hsData = hsCum.slice();
  if(todayPf !== null && todayHs !== null){
    labels.push('今日');
    pfData.push(+(((1 + (pfCum.length ? pfCum[pfCum.length-1] : 0)/100) * (1 + todayPf/100) - 1) * 100).toFixed(2));
    hsData.push(+(((1 + (hsCum.length ? hsCum[hsCum.length-1] : 0)/100) * (1 + todayHs/100) - 1) * 100).toFixed(2));
  }
  if(!chartInstance){
    chartInstance = echarts.init($('#chart'), null, {renderer:'canvas'});
    window.addEventListener('resize', function(){ if(chartInstance) chartInstance.resize(); });
  }
  /* 标记「今日」刻度位置，用于把 X 轴标签和曲线最后一点加粗变红 */
  var todayIdx = labels.length - 1;
  var TC = themeColors();
  var todayLabelColor = todayPf !== null ? TC.red : TC.muted;
  chartInstance.setOption({
    grid:{left:44, right:14, top:12, bottom:22},
    tooltip:{trigger:'axis', backgroundColor:TC.chartBg, borderColor:TC.chartBorder, textStyle:{color:TC.text, fontSize:12}, valueFormatter:function(v){ return v === null || v === undefined ? '--' : v + '%'; }},
    xAxis:{type:'category', data:labels, axisLine:{lineStyle:{color:TC.chartAxis}}, axisTick:{show:false},
      axisLabel:{color:function(v, i){ return i === todayIdx ? todayLabelColor : TC.muted; }, fontSize:11, fontWeight:function(v, i){ return i === todayIdx ? 'bold' : 'normal'; }, formatter:function(v, i){ return i === todayIdx && todayPf !== null ? v + ' ●' : v; }}},
    yAxis:{type:'value', scale:true, splitLine:{lineStyle:{color:TC.chartSplit}}, axisLabel:{color:TC.muted, fontSize:11, formatter:'{value}%'}},
    series:[
      {name:'组合', type:'line', data:pfData, smooth:true,
       symbol:function(v, i){ return i === todayIdx && todayPf !== null ? 'circle' : 'circle'; },
       symbolSize:function(v, i){ return i === todayIdx && todayPf !== null ? 9 : 5; },
       lineStyle:{color:TC.red, width:2}, itemStyle:{color:TC.red, borderColor:TC.chartBg, borderWidth:function(v, i){ return i === todayIdx && todayPf !== null ? 1.5 : 0; }},
       areaStyle:{color:{type:'linear', x:0, y:0, x2:0, y2:1, colorStops:[{offset:0, color:'rgba(240,69,69,.30)'},{offset:1, color:'rgba(240,69,69,0)'}]}}},
      {name:'沪深300', type:'line', data:hsData, smooth:true, symbol:'none',
       lineStyle:{color:TC.green, width:1.5, type:'dashed'}, itemStyle:{color:TC.green}}
    ]
  }, true);

  var pfLast = pfData.length ? pfData[pfData.length-1] : null;
  var hsLast = hsData.length ? hsData[hsData.length-1] : null;
  $('#tagPf').textContent = '组合 ' + fmtPct(pfLast);
  $('#tagHs').textContent = '沪深300 ' + fmtPct(hsLast);
  /* 今日/昨日徽章：直观对照顶部「今日盈亏/昨日盈亏」卡的当日收益率，避免与「近7日累计」混淆 */
  var lbl = yView ? '昨日' : '今日';
  if($('#tagToday')){
    $('#tagToday').textContent = todayPf === null ? (lbl + ' --') : (lbl + ' ' + fmtPct(todayPf));
  }
  if($('#ftToday')){
    var ftv0 = $('#ftToday').querySelector('.ftv');
    if(ftv0){ ftv0.innerHTML = todayPf === null ? '--' : '<span class="' + cls(todayPf) + '">' + fmtPct(todayPf) + '</span>'; }
    var lbl0 = $('#ftToday').querySelector('.ft-lbl');
    if(lbl0){ lbl0.textContent = lbl; }
    var hint0 = $('#ftToday').querySelector('.ft-hint');
    if(hint0){ hint0.textContent = yView ? '= 顶部昨日盈亏卡' : '= 顶部今日盈亏卡'; }
  }
  /* 组合构成说明：让用户知道曲线里含哪些资产、各自权重多少 */
  var mix = '';
  if(wItems && wItems.length){
    var wF = 0, wS = 0, nF = 0, nS = 0;
    wItems.forEach(function(it){
      if(!it.w) return;
      if(it.type === 'fund'){ wF += it.w; nF++; } else { wS += it.w; nS++; }
    });
    var tw = wF + wS;
    if(tw > 0){
      var seg = [];
      if(nF) seg.push(nF + '基 ' + (wF / tw * 100).toFixed(0) + '%');
      if(nS) seg.push(nS + '股 ' + (wS / tw * 100).toFixed(0) + '%');
      mix = seg.length ? seg.join(' · ') : '';
    }
  }
  if($('#ftMix')){ $('#ftMix').textContent = mix ? '(' + mix + ')' : ''; }
  if($('#ftPf')){ $('#ftPf').innerHTML = '<span class="' + cls(pfLast) + '">' + fmtPct(pfLast) + '</span>'; }
  if($('#ftHs')){ $('#ftHs').innerHTML = '<span class="' + cls(hsLast) + '">' + fmtPct(hsLast) + '</span>'; }
  if(pfLast !== null && hsLast !== null){
    var d = pfLast - hsLast;
    var dv = $('#ftDiff').querySelector('.ftv');
    if(dv) dv.innerHTML = '<span class="' + cls(d) + '">' + fmtPct(d) + '</span>';
  }
}

/* ================= 主流程 ================= */
/* 数据通道自检：footer 展示各源连通状态 */
var SRC = {};
function markSrc(k, ok){
  SRC[k] = ok;
  var el = $('#srcStatus');
  if(!el) return;
  var names = {mob:'天天基金净值', sina:'新浪估算', holding:'自建估算', push2:'东财行情', tencent:'腾讯指数', trend:'历史净值'};
  el.innerHTML = Object.keys(names).map(function(k2){
    var v = SRC[k2];
    var s = (v === undefined) ? '…' : (v ? '✓' : '✗');
    var c = (v === undefined) ? 'var(--muted)' : (v ? 'var(--green)' : 'var(--red)');
    return '<span style="color:' + c + '">' + names[k2] + ' ' + s + '</span>';
  }).join(' · ');
}

/* 9:30~11:30、13:00~15:00 = A 股场内盘中（含货币基金、双休、节假日都按 9:30~15:00 判断）；
   9:30 前/11:30~13:00/15:00 后/周末：fundIntraday=false → 不拉今日估值，强制用昨收 */
function isFundMktOpen(d){
  var x = d || new Date();
  var day = x.getDay(), m = x.getHours()*60 + x.getMinutes();
  return (day>=1 && day<=5) && ((m>=570 && m<=690) || (m>=780 && m<=900));
}

function marketStatus(navTime){
  var now = new Date();
  var open = isFundMktOpen(now);
  var nd = now.getDay();
  var hm = now.getHours()*60 + now.getMinutes();
  var afterClose = (nd>=1 && nd<=5) && hm > 900;
  var baseLabel = open ? '交易中 · 实时估值'
    : afterClose ? '收盘后 · 显示收盘估值（待净值公布）'
    : (nd===0||nd===6 ? '周末 · 显示昨日净值' : '盘前/午休 · 显示昨日净值');
  /* 收盘后真有基金 NAV 已公布 → 覆盖"待净值公布"标签，避免"永远待"的误读 */
  if(navTime && afterClose && baseLabel.indexOf('收盘后') === 0){
    baseLabel = '净值已公布 · ' + navTime;
  }
  $('#mktStatus').textContent = baseLabel;
  window.__fundIntraday = open;
}

var _refreshing = false;   /* refreshAll 并发锁：手动+定时器撞车时跳过第二次 */
async function refreshAll(){
  /* 并发锁：用户连点刷新或自动定时器撞手动刷新时直接跳过，避免接口被双倍调用（东财 push2 风控敏感） */
  if(_refreshing){ return; }
  _refreshing = true;
  /* loading 反馈：禁用按钮 + 图标按钮改为 spinner，让用户知道点了生效 */
  var _rBtn = document.querySelector('[data-act="refreshAll"]');
  var _rBtnHtml = _rBtn ? _rBtn.innerHTML : null;
  if(_rBtn){ _rBtn.disabled = true; _rBtn.innerHTML = '<svg class="spin" viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" opacity=".25"/><path d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8z"/></svg>'; }
  try{
  marketStatus();
  $('#chartTime').textContent = new Date().toTimeString().slice(0, 8) + ' 更新';

  /* 1. 基金净值/估值：天天基金移动端接口批量取（CORS 开放）；官方估值缺失时用前十大重仓股实时行情自建估算 */
  var now2 = new Date();
  var todayStr = now2.getFullYear() + '-' + ('0'+(now2.getMonth()+1)).slice(-2) + '-' + ('0'+now2.getDate()).slice(-2);
  var fundIntraday = window.__fundIntraday !== false;  /* marketStatus() 刚算过，复用；先按盘中处理 */
  /* 收盘估值缓存：盘中把最后一次估算（≈15:00 收盘估值）存进 localStorage，
     收盘后→净值公布前的空窗期回放，避免基金盈亏显示 0。键=今日日期_代码，隔日自动失效 */
  var gzCache = {};
  try { gzCache = JSON.parse(localStorage.getItem('fundGzCache') || '{}') || {}; } catch(e){ gzCache = {}; }
  var mob = {};
  try{
    var codes = holdings.map(function(h){ return h.code; }).join(',');
    if(codes){
      var url = 'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=200&plat=Android&appType=ttjj&product=EFund&Version=1&deviceid=fundboard&Fcodes=' + codes;
      var mf;
      try{
        if(chrome && chrome.runtime && chrome.runtime.sendMessage){
          var resp = await new Promise(function(resolve, reject){
            chrome.runtime.sendMessage({type:'xfetch', url: url}, function(r){ var e = chrome.runtime.lastError; if(e) reject(e); else resolve(r); });
          });
          if(resp && resp.ok){ mf = JSON.parse(resp.body); }
          else{ throw new Error(resp && resp.error || 'sw xfetch fail'); }
        }else{
          mf = await fetchJSON(url);
        }
      }catch(e1){
        console.warn('[ext] fundmobapi SW 失败，回退直连:', e1 && e1.message || e1);
        mf = await fetchJSON(url);
      }
      ((mf && mf.Datas) || []).forEach(function(v){ mob[v.FCODE] = v; });
      markSrc('mob', true);
    }
  }catch(e){ console.warn('[ext] fundmobapi 全失败:', e && e.message || e); markSrc('mob', false); }
  var sinaTried = false, sinaOk = false, holdTried = false, holdOk = false, trendOk = false;

  /* 持仓并行刷新：每只基金独立处理、限制并发 4 路避免东财/新浪接口瞬时打满；
     每只内部仍串行（新浪→持仓→ulist→趋势→lsjz），但各基金之间并行，整体耗时≈单只而非累加 */
  async function processHolding(h){
    var v = mob[h.code] || null;
    var info1 = {
      name: h.name || (v ? v.SHORTNAME : null),
      dwjz: v && v.NAV ? parseFloat(v.NAV) : null,
      navDate: v ? v.PDATE : null,
      gszzl: null, gsz: null, gztime: null, navPct: null,
      noGZ: true, estType: null
    };
    if(v){
      if(v.NAVCHGRT !== null && v.NAVCHGRT !== undefined && v.NAVCHGRT !== ''){ info1.navPct = parseFloat(v.NAVCHGRT); }
      if(fundIntraday && v.GSZ && v.GSZZL !== null && v.GSZZL !== undefined && v.GSZZL !== ''){
        /* 官方盘中估值（天天基金已普遍下线，保留兼容）—— 仅盘中拉取，盘前/盘后/周末不用 */
        info1.gsz = parseFloat(v.GSZ); info1.gszzl = parseFloat(v.GSZZL);
        info1.gztime = v.GZTIME; info1.noGZ = false; info1.estType = 'official';
      }else if(v.PDATE && v.PDATE === todayStr && v.NAV){
        /* 当日净值晚间已更新 → 确定涨跌（即便非盘中，净值公布时段也认这个分支） */
        info1.gsz = parseFloat(v.NAV); info1.gszzl = info1.navPct;
        info1.gztime = v.PDATE; info1.noGZ = false; info1.estType = 'nav';
      }
    }
    /* 收盘估值优先用新浪今日序列末点(见下方新浪块，盘后亦拉取)；仅当新浪/自建都失败时，
       才在循环末尾回放盘中缓存作最后兜底(标注为旧估值，避免误当精确收盘值)。 */
    fundInfo[h.code] = info1;

    /* 与 Sina 估值并行启动：提前发起 fetchFundTrend 拿 name + 净值序列，
       整体耗时 ≈ max(Sina, trend) 而非 sum；fS_name 是字符串字面量而非 JSONP 数组，
       fetchFundTrend 内部用正则提取，扩展页拿到 UTF-8 JS 字符串（浏览器 fetch 默认
       按 Content-Type=application/javascript 走 UTF-8） */
    var trendP = fetchFundTrend(h.code).catch(function(){ return {name: null, trend: []}; });
    /* 权威官方净值源（东财 F10 lsjz）改为「走势末点不是今日」才拉取：今日净值已由走势末点覆盖的基金
       不再发冗余请求，也避免在 CSP 未放行 api.fund.eastmoney.com 时刷出一堆被拦截的报错。*/

    /* 新浪持仓加权估算：盘中实时、盘后亦可拉到今日完整序列（末点 16:04 ≈ 截至收盘的加权估算净值），
       依据今日重仓股/债券真实涨跌加权；与打开页面时刻无关，故去掉 fundIntraday 限制 */
    if(info1.noGZ){
      try{
        sinaTried = true;
        var se = await jsonp('https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/FdFundService.getEstimateNetworthPic', {symbol: h.code}, 'callback');
        var sdata = se && se.result && se.result.data;
        if(!sdata){ console.error('[ext] 新浪 ' + h.code + ' 返回无 data 字段', se ? Object.keys(se) : se); }
        /* 接口同时返回两套：
           - networth[]：今日分钟级加权估算序列（末点 min_time≈16:04 = 截至收盘的加权估算净值），
             元素含 pre_nav（昨收净值）、nav_pct（今日涨跌幅,百分比数值）、pre_date。
             这是估值主源，与打开页面时刻无关（盘中末点=当前时刻,盘后末点=收盘估算）。✅ 优先用
           - worth / worth_rate / worth_date：简化版，worth_rate 为小数且常是昨日数据，不可靠，仅极端回退 */
        if(sdata && sdata.networth && sdata.networth.length){
          var lp = sdata.networth[sdata.networth.length - 1];
          var pct = parseFloat(lp.nav_pct);            // 今日涨跌幅，百分比数值（如 -1.27）
          var prevNav = parseFloat(lp.pre_nav);        // 昨收净值
          if(!isNaN(pct) && !isNaN(prevNav) && lp.min_time){
            info1.gszzl = pct;                          // 已是百分比，直接显示
            info1.gsz = prevNav * (1 + pct / 100);      // ✅ 加权估算净值 = 昨收 × (1+今日涨跌幅)
            info1.dwjz = prevNav;                       // ✅ 兜底：把 pre_nav 当昨收净值赋给 dwjz，
                                                          // 盘后空窗（东财 fundmobapi 没拿到今日 NAV 时 dwjz=null）
                                                          // calcRow 的 `info.gsz && info.dwjz` 分支照样能算出
                                                          // pnl = shares × (gsz - dwjz) = shares × pre_nav × (pct/100)
            info1.navDate = lp.pre_date;                // ✅ 同步 navDate（卡片「最新净值」用）
            var _pd = (typeof lp.pre_date === 'string' && lp.pre_date.length === 10) ? lp.pre_date.slice(5) : todayStr.slice(5);
            info1.gztime = _pd + ' ' + String(lp.min_time).slice(0, 5);   // 如 "08-14 16:04"
            info1.noGZ = false;
            info1.estType = fundIntraday ? 'sina' : 'close';
            sinaOk = true;
            info1.sinaPreNav = prevNav;                          /* ✅ 交叉验证用：新浪 pre_nav 字段，对比 trend.prev.nav 看是否已更新 */
            console.log('[ext] 新浪 ' + h.code + ' 估值成功: gsz=' + info1.gsz.toFixed(4) + ' gszzl=' + info1.gszzl + '% gztime=' + info1.gztime + ' dwjz=' + info1.dwjz.toFixed(4));
          }
        }else if(sdata && sdata.worth !== undefined && sdata.worth_rate !== undefined){
          /* 兜底：简化版（worth_rate 是小数，且常是昨日数据，极端情况下使用） */
          var wr = parseFloat(sdata.worth_rate);
          var wv = parseFloat(sdata.worth);
          if(!isNaN(wr) && !isNaN(wv)){
            info1.gszzl = wr * 100;                     // 小数→百分比
            info1.gsz = wv;
            info1.gztime = todayStr.slice(5) + (fundIntraday ? ' 估算' : ' 收盘估算');
            info1.noGZ = false;
            info1.estType = fundIntraday ? 'sina' : 'close';
            sinaOk = true;
          }
        }
      }catch(e){ console.error('[ext] 新浪 ' + h.code + ' 估算失败（走自建/缓存兜底）:', e && e.message || e); }
    }

    /* 自建估算（兜底）：前十大重仓股 × 当日行情加权，盘中与盘后空窗均可用 */
    if(info1.noGZ && info1.dwjz){
      try{
        holdTried = true;
        var pos = await fetchJSON('https://fundmobapi.eastmoney.com/FundMNewApi/FundMNInverstPosition?FCODE=' + h.code + '&deviceid=Wap&plat=Wap&product=EFund&version=2.0.0');
        var posStocks = (pos && pos.Datas && pos.Datas.fundStocks) || [];
        if(posStocks.length){
          var secids = posStocks.map(function(s){ return (s.TEXCH === '1' ? '1.' : '0.') + s.GPDM; }).join(',');
          var q = await jsonp('https://push2.eastmoney.com/api/qt/ulist.np/get', {fltt:2, invt:2, fields:'f2,f3,f12', secids:secids});
          var diff = (q && q.data && q.data.diff) || [];
          var arr = Array.isArray(diff) ? diff : Object.keys(diff).map(function(k){ return diff[k]; });
          var qmap = {};
          arr.forEach(function(d){ qmap[d.f12] = d; });
          var wsum = 0, psum = 0;
          posStocks.forEach(function(s){
            var qt = qmap[s.GPDM];
            var w = parseFloat(s.JZBL);
            var p = qt ? parseFloat(qt.f3) : NaN; /* 停牌返回 '-'，跳过 */
            if(!isNaN(w) && w > 0 && !isNaN(p)){ wsum += w; psum += w * p; }
          });
          if(wsum > 0){
            var estPct = psum / wsum;
            info1.gszzl = estPct;
            info1.gsz = info1.dwjz * (1 + estPct / 100);
            info1.gztime = new Date().toTimeString().slice(0, 8);
            info1.noGZ = false;
            info1.estType = 'holding';
            holdOk = true;
          }
        }
      }catch(e){ /* 自建估算失败则降级显示最近净值 */ }
    }

    /* 兜底：新浪/自建都不成功(如网络异常时) → 回放盘中缓存值，标注真实抓取时间，明确是旧估值 */
    if(info1.noGZ && !fundIntraday && v && v.PDATE !== todayStr){
      var _ck = gzCache[todayStr + '_' + h.code];
      if(_ck && _ck.gsz && !isNaN(_ck.gsz)){
        info1.gsz = _ck.gsz;
        info1.gszzl = _ck.gszzl;
        info1.gztime = (_ck.time || '') + ' 盘中缓存(旧)';
        info1.noGZ = false;
        info1.estType = 'cacheOld';
      }
    }

    /* 盘中成功取到估值 → 缓存今日最后估值，供收盘后空窗回放（非盘中时段不写，避免覆盖 close 占位） */
    if(fundIntraday && info1.gsz && !isNaN(info1.gsz)){
      gzCache[todayStr + '_' + h.code] = {gsz: info1.gsz, gszzl: info1.gszzl, time: info1.gztime || new Date().toTimeString().slice(0, 8)};
    }

    /* 净值走势：图表 + 名称兜底 + 【权威 NAV 末点覆盖 Sina/自建/缓存估算】
       关键：必须无条件判断"今日 NAV 是否已公布"（trend 末点 === todayStr），
       只要已公布就用权威 NAV 替换之前的加权估算；不要被 !noGZ 短路掉
       —— Sina/估算接口对盘后 NAV 已公布场景一无所知，仍只返回 16:04 加权估算。
       二次保险：trend 末点不等于 todayStr 但 Sina pre_nav === trend.prev.nav
       （说明新浪平台已经把 pre_nav 同步到"今日真实 NAV"），视作 NAV 已公布。 */
    var td = await trendP;
    var _trendLastDate = (td && td.trend && td.trend.length) ? td.trend[td.trend.length - 1].date : null;
    var _trendPrevDate = (td && td.trend && td.trend.length >= 2) ? td.trend[td.trend.length - 2].date : null;
    var _trendPrevNav = (td && td.trend && td.trend.length >= 2) ? td.trend[td.trend.length - 2].nav : null;
    console.log('[ext] trend ' + h.code + ' trendLen=' + (td && td.trend ? td.trend.length : 0) + ' lastDate=' + _trendLastDate + ' prevDate=' + _trendPrevDate + ' today=' + todayStr + ' match=' + (_trendLastDate === todayStr) + ' sinaPreNav=' + info1.sinaPreNav + ' trendPrevNav=' + _trendPrevNav);
    /* 权威净值源（东财 F10 lsjz）：仅当走势末点不是今日（trend 没拿到今日官方 NAV）时才真正拉取，
       今日净值已由走势末点覆盖的基金不再发冗余请求；拉到后无条件覆盖 Sina/走势估算。
       诊断日志：触发/返回/失败都打，便于排查 SW 中转在 api.fund.eastmoney.com 上是否真拿到 body */
    var _needLsjz = (_trendLastDate !== todayStr);
    if(_needLsjz){ console.log('[ext] ' + h.code + ' 走势末点(' + _trendLastDate + ')≠今日(' + todayStr + '), 触发 lsjz'); }
    var lsjzP = _needLsjz
      ? fetchLsjz(h.code).then(function(r){
          console.log('[ext] ' + h.code + ' lsjz 返回: ' + JSON.stringify(r));
          return r;
        }).catch(function(e){
          console.warn('[ext] ' + h.code + ' lsjz 失败: ' + (e && e.message || e));
          return null;
        })
      : Promise.resolve(null);
    var lsjz = await lsjzP;
    /* 权威净值源（东财 F10 lsjz）：只要 T 日官方净值已公布，无条件覆盖 Sina/走势估算 */
    if(lsjz && lsjz.date === todayStr && !isNaN(lsjz.nav)){
      var _wasEst0 = (info1.estType === 'sina' || info1.estType === 'close' || info1.estType === 'holding' || info1.estType === 'cacheOld');
      info1.gsz = lsjz.nav;                                                  /* 今日官方单位净值 */
      info1.dwjz = (lsjz.prevNav != null && !isNaN(lsjz.prevNav)) ? lsjz.prevNav : info1.dwjz;  /* 昨日官方净值(盈亏基准) */
      info1.gszzl = lsjz.pct;                                                /* JZZZL 已是百分比数值(如 -1.35) */
      info1.gztime = lsjz.date + ' 已更新';
      info1.navDate = lsjz.date;
      info1.noGZ = false;
      info1.estType = 'nav';
      console.log('[ext] ' + h.code + ' F10官方净值(' + lsjz.date + ')=' + lsjz.nav + ' 日涨跌=' + lsjz.pct + '% → 覆盖 ' + (info1.estType) + ' 估算' + (_wasEst0 ? '' : '(已是nav)'));
    }
    if(td && td.name && !info1.name){ info1.name = td.name; console.log('[ext] 名称兜底 ' + h.code + ' ← ' + td.name); }
    if(td && td.trend){ trendOk = true; info1.trend = td.trend; }
    if(td && td.trend && td.trend.length >= 2){
      var last = td.trend[td.trend.length - 1];
      var prev = td.trend[td.trend.length - 2];
      info1.navPct = (last.nav / prev.nav - 1) * 100;        /* 与 Sina nav_pct 同单位(百分比数值) */
      /* 默认（NAV 未公布时）用走势末点兜底 dwjz/gztime/navDate；若 LSJZ 已判定 NAV 公布则不覆盖 */
      if(info1.estType !== 'nav'){
        info1.dwjz = last.nav;                                /* 兜底：兜 ld.nav 当今日末点 */
        info1.gztime = last.date;
        info1.navDate = last.date;
      }
      var _navPublished = (last.date === todayStr);
      /* 二次保险：Sina pre_nav 已同步到 trend.prev.nav → 新浪平台实际已看到今日 NAV */
      if(!_navPublished && info1.sinaPreNav != null && _trendPrevNav != null && Math.abs(info1.sinaPreNav - _trendPrevNav) < 0.0001){
        _navPublished = true;
        console.log('[ext] ' + h.code + ' 二次保险 Sina pre_nav(' + info1.sinaPreNav + ')≈trend.prev.nav(' + _trendPrevNav + ') → 视作 NAV 已公布');
      }
      if(_navPublished && info1.estType !== 'nav'){
        /* 真实 NAV 已公布（走势末点=今日，且 LSJZ 未抢先覆盖）→ 覆盖 Sina 估算/自建估算/盘中缓存的不准确值 */
        var _wasEst = (info1.estType === 'sina' || info1.estType === 'close' || info1.estType === 'holding' || info1.estType === 'cacheOld');
        info1.gsz = last.nav;
        info1.dwjz = prev.nav;                                /* dwjz = 上一日真实 NAV（盘算盈亏的基准） */
        info1.gszzl = info1.navPct;
        info1.gztime = last.date + ' 已更新';                   /* 让摘要卡显示 “净值更新时间 2026-08-14 已更新” 而不是 “08-14 16:04” */
        info1.noGZ = false;
        info1.estType = 'nav';                                /* 标注为权威净值（不再算估算） */
        if(_wasEst){ console.log('[ext] ' + h.code + ' NAV已公布(' + last.date + ')→ 替换 ' + info1.estType + ' 估算, gsz=' + info1.gsz.toFixed(4) + ' gszzl=' + info1.gszzl.toFixed(4) + '%'); }
      }
    }
    /* 盘前/周末：明确显示「昨日实际净值」而非「收盘估值」—— 数值取昨收净值，涨跌幅取昨日单日涨跌幅 */
    if(!fundIntraday && showYesterdayView(new Date()) && info1.estType !== 'nav'){
      if(info1.dwjz && !isNaN(info1.dwjz)){ info1.gsz = info1.dwjz; }   /* 昨收净值 = 昨日实际净值 */
      if(info1.navPct !== null && !isNaN(info1.navPct)){ info1.gszzl = info1.navPct; }  /* 昨日涨跌幅 */
      info1.estType = 'yNav';
    }
    if(!info1.name) info1.name = h.code;
  }

  /* 并发执行所有持仓刷新（每批最多 4 只并行），全部完成后再继续后续汇总与渲染 */
  async function runHoldings(items, limit){
    for(var bi = 0; bi < items.length; bi += limit){
      var batch = items.slice(bi, bi + limit);
      await Promise.all(batch.map(function(x){ return processHolding(x); }));
    }
  }
  await runHoldings(holdings, 4);
  if(sinaTried) markSrc('sina', sinaOk);
  if(holdTried) markSrc('holding', holdOk);
  markSrc('trend', trendOk);
  /* 持久化收盘估值缓存（仅保留今/昨两日，防止无限膨胀） */
  try {
    var _ys = new Date(Date.now() - 86400000);
    var _yStr = _ys.getFullYear() + '-' + ('0'+(_ys.getMonth()+1)).slice(-2) + '-' + ('0'+_ys.getDate()).slice(-2);
    Object.keys(gzCache).forEach(function(k){ if(k.indexOf(todayStr + '_') !== 0 && k.indexOf(_yStr + '_') !== 0) delete gzCache[k]; });
    localStorage.setItem('fundGzCache', JSON.stringify(gzCache));
  } catch(e){}
  var sum = renderHoldings(); /* 返回值同时用于汇总卡片与图表 */

  /* 1.5 提醒检查：涨跌幅 + 公告 */
  checkPriceAlerts();
  checkNoticeAlerts('fund');
  checkNoticeAlerts('stock');

  /* 2. 指数（按用户自选配置拉取，最多 7 个） */
  var idxCfg = loadIdxConfig();
  var tqCodes = idxCfg.filter(function(c){ var it = getIdxItem(c); return it && !it.gold; });
  var showGold = idxCfg.indexOf('hf_GC') >= 0;
  var tq = {}, gold = null;
  try{ tq = tqCodes.length ? await fetchTencent(tqCodes) : {}; markSrc('tencent', Object.keys(tq).length > 0 || !tqCodes.length); }catch(e){ markSrc('tencent', false); }
  /* 国际金价：先东财，失败则降级腾讯 hf_GC（COMEX 黄金连续，美元/盎司） */
  if(showGold){
    try{
      var g = await jsonp('https://push2.eastmoney.com/api/qt/stock/get', {secid:'101.GC00Y', fltt:2, invt:2, fields:'f43,f58,f170'});
      if(g && g.data && g.data.f43 !== null && g.data.f43 !== undefined){ gold = {price: g.data.f43, pct: g.data.f170, src:'eastmoney'}; }
    }catch(e){}
    if(!gold){
      try{
        var gq = await fetchTencent(['hf_GC']);
        if(gq && gq['hf_GC'] && gq['hf_GC'].price){ gold = {price: gq['hf_GC'].price, pct: gq['hf_GC'].pct, src:'tencent'}; }
      }catch(e){}
    }
  }
  renderIndices(tq, gold);

  /* 2.5 股票行情（腾讯，真实成交价） */
  if(stocks.length){
    try{
      var sq = await fetchTencent(stocks.map(function(s){ return s.code; }));
      Object.keys(sq).forEach(function(k){ stockInfo[k] = sq[k]; });
    }catch(e){}
    /* 2.6 股票历史日K（新浪），供走势图组合加权使用；失败只影响曲线不影响行情 */
    for(var _si = 0; _si < stocks.length; _si++){
      var _sc = stocks[_si].code;
      try{
        var _st = await fetchStockTrend(_sc);
        if(_st && _st.length){
          if(!stockInfo[_sc]) stockInfo[_sc] = {};
          stockInfo[_sc].trend = _st;
        }
      }catch(e){}
    }
  }
  var sRes = renderStocks();
  var summ = updateSummary(sum, sRes);
  marketStatus(sum.navTime);  /* 用本次拉到的"今日 NAV 发布时间"刷新顶部状态，覆盖"待净值公布"的永远待 */

  /* 3. 涨跌家数：沪(1.000001)+深(0.399001)+京(0.899050) 三市全量
        注：这三个 secid 拿到的是各自交易所的全市场统计，不是指数成分股 */
  var zdOk = false;
  var zdFallback = ['https://push2his.eastmoney.com', 'https://push2.eastmoney.com'];
  for(var _hi=0; _hi<zdFallback.length && !zdOk; _hi++){
    try{
      var host = zdFallback[_hi];
      var zd = await jsonp(host + '/api/qt/ulist.np/get', {fltt:2, invt:2, fields:'f12,f104,f105,f106', secids:'1.000002,0.399107,0.899050'});
      if(zd && zd.data && zd.data.diff && Object.keys(zd.data.diff).length){
        renderZd(zd.data.diff, 'eastmoney', host); markSrc('push2', true); zdOk = true;
      }
    }catch(e){ markSrc('push2', false); }
  }
  if(!zdOk){
    /* 新浪全 A 列表降级（最近接口退化只返北交所样本，仅作占位提示） */
    try{
      var all = await sinaAllA();
      if(all && all.length){
        var up = 0, down = 0, flat = 0;
        all.forEach(function(s){
          var p = Number(s.changepercent);
          if(isNaN(p)) return;
          if(p > 0) up++; else if(p < 0) down++; else flat++;
        });
        renderZdRaw(up, down, flat, 'sina', null, null);
        markSrc('push2', true);
      }
    }catch(e2){}
  }
  /* 3.5 涨停/跌停家数 + 情绪温度（独立源 push2ex，失败静默不影响主卡片） */
  try{ loadZtDt(); }catch(e){}
  /* 3.6 大盘实时资金流向图（沪深两市合计 5 线，失败静默不影响主卡片） */
  try{ loadMarketFlow(); }catch(e){}

  /* 4. 行业资金流（单卡 · 128 个细分子行业 · 今日/5日/10日 周期可切）
     数据源：data.eastmoney.com/dataapi/bkzj/getbkzj?key={f62|f164|f174}&code=m:90+s:4，
     与 data.eastmoney.com/bkzj/hy.html「行业资金流」页面同源同口径（实测电池 -19亿 / 通信设备 +39亿 量级）。
     三周期各拉一次存缓存，切 tab 本地重排零额外请求；单卡按净额降序，双向条零轴居中。
     实现见 loadBkCards()，内含「盘中今日为空 → 45s 自动补拉」自愈逻辑。
     ⚠ 历史（勿回退）：v116/v122 push2+m:90+s:4 金额小一个量级；v123 push2+m:90+t:2 是 496 混合板块偏题；
        v126 push2+m:90+s:2 只有 31 个一级行业太粗；v125 用 dataapi 是对的，但当时误判为 CORS 失败而放弃
        ——实际 getRemoteText 走后台 SW 代理不受 CORS 限制，file:// 直连才会报错。v127 定稿为 dataapi+s:4。 */
  try{
    await loadBkCards();
  }catch(e){}

  /* 5. 近7日：沪深300 K线（新浪源，东财 push2his 不可用时兜底）+ 组合加权 */
  try{
    var pts = [];
    try{
      var hs300Url = 'https://quotes.sina.cn/cn/api/jsonp_v2.php/var%20_hs300k=/CN_MarketDataService.getKLineData?symbol=sh000300&scale=240&ma=no&datalen=10&_=' + Date.now();
      var ks = await fetchJsonpVar(hs300Url, '_hs300k').catch(function(){ return []; });
      pts = (ks || []).map(function(o){ return {date: o.day.slice(5), day: o.day, close: parseFloat(o.close)}; })
              .filter(function(p){ return p.day !== todayStr && !isNaN(p.close); }); /* 剔除当日未完结K线 */
    }catch(eK){}
    if(!pts.length){ /* 兜底：东财 K线 */
      var k = await jsonp('https://push2his.eastmoney.com/api/qt/stock/kline/get', {secid:'1.000300', klt:101, fqt:1, lmt:9, end:20500101, iscca:1, fields1:'f1,f2,f3,f7', fields2:'f51,f53'});
      var klines = (k.data && k.data.klines) || [];
      pts = klines.map(function(s){ var a = s.split(','); return {date: a[0].slice(5), close: parseFloat(a[1])}; });
    }
    pts = pts.slice(-8);
    var hsDates = [], hsCum = [], cum = 0;
    for(var j = 1; j < pts.length; j++){
      var r = (pts[j].close / pts[j-1].close - 1) * 100;
      cum = (1 + cum) * (1 + r/100) - 1;   /* cum 为小数形式，不可再 /100（旧版此处误写导致累乘失效） */
      hsDates.push(pts[j].date);
      hsCum.push(+(cum * 100).toFixed(2));
    }
    /* 组合：按市值加权「基金 + 股票」的每日收益率
       - 基金权重 = 份额×净值（无份额则用录入市值），日收益取 pingzhongdata 的 equityReturn
       - 股票权重 = 股数×现价，日收益由新浪日K相邻收盘价推算
       两类资产共用同一个 totalW 分母，权重之和恒为 1 */
    var pfCum = [];
    var wItems = [];  /* {w:权重, type:'fund'|'stock', ref:持仓对象} */
    holdings.forEach(function(h2){
      var c = calcRow(h2, fundInfo[h2.code]);
      wItems.push({w: c.mv || h2.amount || 0, type: 'fund', ref: h2});
    });
    stocks.forEach(function(s2){
      var q2 = stockInfo[s2.code];
      var mv2 = (q2 && q2.price && s2.shares) ? s2.shares * q2.price : 0;
      wItems.push({w: mv2, type: 'stock', ref: s2});
    });
    var totalW = wItems.reduce(function(a2, b2){ return a2 + b2.w; }, 0);
    if(totalW > 0){
      var pc = 0;
      hsDates.forEach(function(ds){
        var dayRet = 0;
        wItems.forEach(function(it){
          if(!it.w) return;
          var ret = null;
          if(it.type === 'fund'){
            var info = fundInfo[it.ref.code];
            if(info && info.trend){
              for(var t = 0; t < info.trend.length; t++){
                if(info.trend[t].date.slice(5) === ds){
                  ret = info.trend[t].ret;
                  if(ret === null && t > 0){ ret = (info.trend[t].nav / info.trend[t-1].nav - 1) * 100; }
                  break;
                }
              }
            }
          }else{
            var sInfo = stockInfo[it.ref.code];
            if(sInfo && sInfo.trend){
              for(var t2 = 1; t2 < sInfo.trend.length; t2++){
                if(sInfo.trend[t2].date.slice(5) === ds){
                  ret = (sInfo.trend[t2].close / sInfo.trend[t2-1].close - 1) * 100;
                  break;
                }
              }
            }
          }
          if(ret !== null && !isNaN(ret)){ dayRet += (it.w / totalW) * ret; }
        });
        pc = (1 + pc) * (1 + dayRet/100) - 1;   /* pc 为小数形式，不可再 /100（同上） */
        pfCum.push(+(pc * 100).toFixed(2));
      });
    }
    var todayHs = tq.sh000300 ? tq.sh000300.pct : null;
    /* 「今日」这一点用基金+股票合并收益率（与顶部今日盈亏括号里的百分比同口径）。
       盘前/周末 yView 时改用「昨日收益率」，使走势图 footer 与顶部昨日盈亏卡一致 */
    var todayPf = (summ && summ.yView)
      ? (summ.combYtdPct !== undefined && summ.combYtdPct !== null ? summ.combYtdPct : (summ.combYtdPrevMv > 0 ? summ.combYtdPnl / summ.combYtdPrevMv * 100 : null))
      : (summ && summ.combPct !== undefined && summ.combPct !== null ? summ.combPct : sum.pctAll);
    renderChart(hsDates, hsCum, pfCum, todayPf, todayHs, wItems, summ ? summ.yView : false);
  }catch(e){
    renderChart([], [], [], null, null);
  }
  } finally {
    /* 恢复按钮 + 清并发锁。无论 refreshAll 内部是否抛错都执行 */
    _refreshing = false;
    if(_rBtn){ _rBtn.disabled = false; _rBtn.innerHTML = _rBtnHtml || '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>'; }
    applyAllCardFold();
  }
}

/* ================= 持仓操作 ================= */
var editingCode = null;
function openModal(code){
  editingCode = code || null;
  var h = code ? holdings.find(function(x){ return x.code === code; }) : null;
  $('#modalTitle').textContent = h ? ('编辑基金 ' + code) : '添加基金';
  $('#inCode').value = h ? h.code : '';
  $('#inCode').disabled = !!h;
  $('#inName').value = h && h.name ? h.name : '';
  $('#inShares').value = h && h.shares ? h.shares : '';
  $('#inCost').value = h && h.cost ? h.cost : '';
  $('#inAmount').value = h && h.amount ? h.amount : '';
  _renderRealizedRow(h);
  $('#mask').classList.add('show');
  if(!h) $('#inCode').focus();
}
/* 编辑弹窗里显示该持仓的「已实现盈亏 / 操作次数」（新增持仓时整行隐藏） */
function _renderRealizedRow(h){
  var row = $('#realizedRow'); if(!row) return;
  if(!h){ row.style.display = 'none'; return; }
  row.style.display = '';
  var rv = $('#realizedVal'), tv = $('#tCountVal');
  var r = h.realized || 0, t = h.tCount || 0;
  if(rv){
    rv.textContent = r ? (r > 0 ? '+' : '') + r.toFixed(2) + ' 元' : '0.00 元';
    rv.className = 'val ' + (r > 0 ? 'up' : (r < 0 ? 'down' : ''));
  }
  if(tv) tv.textContent = t + ' 次';
}
/* 清零当前编辑基金的「已实现盈亏 / 操作次数」（清测试残留用；不动份额与成本价） */
function clearRealized(){
  if(!editingCode) return;
  var h = holdings.find(function(x){ return x.code === editingCode; });
  if(!h) return;
  if(!(h.realized || 0) && !(h.tCount || 0)){ toast('本来就是 0，无需清零'); return; }
  if(!confirm('把 ' + h.code + ' 的「已实现盈亏 ' + (h.realized || 0).toFixed(2) + ' 元 / 操作次数 '
              + (h.tCount || 0) + ' 次」清零？\n（份额与成本价不变）')) return;
  h.realized = 0; h.tCount = 0;
  saveHoldings(); _renderRealizedRow(h); refreshAll();
  toast('已清零 ' + h.code + ' 的已实现与操作次数');
}
/* 批量编辑里「清空已实现」：一键清掉所有基金 + 股票的 realized / tCount */
function clearAllRealized(){
  var f = holdings.filter(function(h){ return (h.realized || 0) || (h.tCount || 0); }).length;
  var s = stocks.filter(function(x){ return (x.realized || 0) || (x.tCount || 0); }).length;
  if(!f && !s){ toast('所有持仓的已实现与操作次数都已是 0'); return; }
  if(!confirm('将把 ' + f + ' 只基金、' + s + ' 只股票/场内品种的「已实现盈亏 / 操作次数」全部清零。\n份额、成本价、分笔记录均不变。\n确定继续？')) return;
  holdings.forEach(function(h){ h.realized = 0; h.tCount = 0; });
  stocks.forEach(function(x){ x.realized = 0; x.tCount = 0; });
  saveHoldings(); saveStocks(); refreshAll();
  toast('已清空全部已实现盈亏与操作次数');
}
function closeModal(){
  $('#mask').classList.remove('show');
  $('#inCode').value=''; $('#inCode').disabled=false;
  $('#inName').value='';
  $('#inShares').value=''; $('#inCost').value=''; $('#inAmount').value='';
  var _rr = $('#realizedRow'); if(_rr) _rr.style.display = 'none';
  editingCode = null;
}
function saveFund(){
  var code = editingCode || $('#inCode').value.trim();
  var shares = parseFloat($('#inShares').value);
  var cost = parseFloat($('#inCost').value);
  var amount = parseFloat($('#inAmount').value);
  var name = $('#inName').value.trim();
  if(!/^\d{6}$/.test(code)){ alert('请输入 6 位基金代码'); return; }
  var hasShares = !isNaN(shares) && shares > 0;
  if(!hasShares && (isNaN(amount) || amount <= 0)){ alert('请填写「持有份额」或「持有市值」至少一项'); return; }
  var oldH = holdings.find(function(h){ return h.code === code; });
  var entry = {
    code: code,
    name: name || undefined,
    shares: hasShares ? shares : null,
    cost: (hasShares && !isNaN(cost) && cost > 0) ? cost : null,
    amount: (!isNaN(amount) && amount > 0) ? amount : null,
    realized: oldH ? (oldH.realized || 0) : 0,
    tCount: oldH ? (oldH.tCount || 0) : 0
  };
  /* 分笔同步：份额没变就沿用原分笔（保住买入日期）；份额被改动则无法还原明细 → 重建为「日期未知」的一笔（赎回时会提示复核） */
  if(oldH && Array.isArray(oldH.lots) && oldH.lots.length && oldH.shares === entry.shares) entry.lots = oldH.lots;
  else entry.lots = (hasShares ? [{d: null, s: shares, p: entry.cost || 0}] : []);
  var idx = -1;
  holdings.forEach(function(h, i){ if(h.code === code) idx = i; });
  if(editingCode){
    if(idx < 0){ alert('未找到该基金'); return; }
    holdings[idx] = entry;
  }else{
    if(idx >= 0){ alert('该基金已在持仓中，请使用「编辑」'); return; }
    holdings.push(entry);
  }
  saveHoldings(); closeModal(); refreshAll();
}
function delFund(code){
  if(!confirm('确认删除基金 ' + code + '？')) return;
  holdings = holdings.filter(function(h){ return h.code !== code; });
  delete fundInfo[code];
  saveHoldings(); refreshAll();
}

/* ================= 加仓 / 减仓（v1.1.0） =================
   模型：移动加权平均 + 已实现/浮动拆分
   - 加仓：新均价 = (旧份额×旧均价 + 加仓份额×加仓价 + 手续费) / 新份额；已实现不变
   - 减仓：已实现 += (减仓价 − 旧均价) × 减仓份额 − 手续费；份额减少、均价不变；清仓均价置空
   T+1 等交易规则不在此约束，仅忠实记录用户操作 */
function _tradeFind(kind, code){
  return kind === 'stock'
    ? stocks.find(function(x){ return x.code === code; })
    : holdings.find(function(x){ return x.code === code; });
}
function _tradeSave(kind){
  if(kind === 'stock') saveStocks(); else saveHoldings();
}
function _applyAdd(h, shares, price, fee){
  var oldShares = h.shares || 0, oldCost = h.cost || 0;
  var newShares = oldShares + shares;
  var newCost = (oldShares * oldCost + shares * price + (fee || 0)) / newShares;
  h.shares = newShares;
  h.cost = +newCost.toFixed(4);
  h.tCount = (h.tCount || 0) + 1;
}
function _applySell(h, shares, price, fee){
  var oldShares = h.shares || 0, oldCost = h.cost || 0;
  if(shares > oldShares) return false; /* 减仓不得超持仓 */
  h.realized = (h.realized || 0) + (price - oldCost) * shares - (fee || 0);
  h.shares = oldShares - shares;
  h.cost = (h.shares === 0) ? null : oldCost; /* 清仓均价置空；否则均价不变 */
  h.tCount = (h.tCount || 0) + 1;
  return true;
}
function addPosition(kind, code, shares, price, fee, date){
  var h = _tradeFind(kind, code); if(!h) return;
  _applyAdd(h, shares, price, fee);
  if(kind === 'fund') _lotAdd(h, shares, price, date);   /* 记一笔买入日期，供赎回按持有期算费 */
  _tradeSave(kind); refreshAll();
}
function sellPosition(kind, code, shares, price, fee){
  var h = _tradeFind(kind, code); if(!h) return;
  if(!_applySell(h, shares, price, fee)){ alert('减仓份额超过当前持仓'); return; }
  if(kind === 'fund') _lotConsume(h, shares);            /* 先进先出销掉最早的分笔 */
  _tradeSave(kind); refreshAll();
}

/* 交易弹窗（加仓/减仓共用，由 openTrade 设定方向） */
/* ================= 基金费率（天天基金 f10 费率页） ================= */
/* 为什么抓页面而不是调接口：
   - fundmobapi 系列费率接口已被风控挡回 ErrCode 61136403「网络繁忙」（本机实测），不可用；
   - fundf10 费率页（fundf10.eastmoney.com/jjfl_xxxxxx.html）可正常访问，且一页同时给出
     「原费率 | 天天基金优惠费率」和「赎回费率（按持有期分档）」；
   - 支付宝（蚂蚁财富）无公开费率接口（需登录态与签名），故统一以天天基金优惠费率为准——
     它与支付宝同为一折价（实测 0.10%~0.15%），对支付宝用户基本适用。 */
var fundRateKey = 'fund_board_fundrate_v2';  /* v2: 赎回档改 HOLD_MAX(1e15) 哨兵 + 带 label，v1 cache 里的 Infinity→null/无label 条目全废 */
var RATE_TTL = 7 * 24 * 3600 * 1000;   /* 费率很少变，缓存 7 天 */
var fundRateCache = {};                /* code -> {sub:[...], redeem:[...], ts} */
try{ fundRateCache = JSON.parse(localStorage.getItem(fundRateKey)) || {}; }catch(e){ fundRateCache = {}; }
function saveFundRateCache(){ try{ localStorage.setItem(fundRateKey, JSON.stringify(fundRateCache)); }catch(e){} }

/* 金额区间文本 → {min,max}（元）。例："小于50万元"→{0,500000}、"大于等于50万元，小于100万元"→{500000,1000000} */
function _parseAmtRange(txt){
  var wan = function(s){ return parseFloat(String(s).replace(/,/g, '')) * 10000; };
  var min = 0, max = Infinity, m;
  if((m = txt.match(/大于等于\s*([\d.,]+)\s*万/))) min = wan(m[1]);
  else if((m = txt.match(/大于\s*([\d.,]+)\s*万/))) min = wan(m[1]);
  var mm;
  if((mm = txt.match(/小于等于\s*([\d.,]+)\s*万/))) max = wan(mm[1]);
  else if((mm = txt.match(/小于\s*([\d.,]+)\s*万/))) max = wan(mm[1]);
  return {min: min, max: max};
}
/* 持有期限文本 → {min,max}（天，上界按"不含"处理；"小于等于N天" 视同 "小于N+1天"）
   max 用 1e15 作"无上界"哨兵——Infinity 经 JSON.stringify 会变 null，从 cache 取回就废了 */
var HOLD_MAX = 1e15;
function _parseHoldRange(txt){
  var min = 0, max = HOLD_MAX, m;
  if((m = txt.match(/大于等于\s*(\d+)\s*天/))) min = parseInt(m[1], 10);
  else if((m = txt.match(/大于\s*(\d+)\s*天/))) min = parseInt(m[1], 10) + 1;
  else if((m = txt.match(/大于等于\s*(\d+)\s*个月/))) min = parseInt(m[1], 10) * 30;
  else if((m = txt.match(/大于\s*(\d+)\s*个月/))) min = parseInt(m[1], 10) * 30 + 1;
  else if((m = txt.match(/大于等于\s*(\d+)\s*年/))) min = parseInt(m[1], 10) * 365;
  else if((m = txt.match(/大于\s*(\d+)\s*年/))) min = parseInt(m[1], 10) * 365 + 1;
  var mm;
  if((mm = txt.match(/小于等于\s*(\d+)\s*天/))) max = parseInt(mm[1], 10) + 1;
  else if((mm = txt.match(/小于\s*(\d+)\s*天/))) max = parseInt(mm[1], 10);
  else if((mm = txt.match(/小于等于\s*(\d+)\s*个月/))) max = parseInt(mm[1], 10) * 30 + 1;
  else if((mm = txt.match(/小于\s*(\d+)\s*个月/))) max = parseInt(mm[1], 10) * 30;
  else if((mm = txt.match(/小于等于\s*(\d+)\s*年/))) max = parseInt(mm[1], 10) * 365 + 1;
  else if((mm = txt.match(/小于\s*(\d+)\s*年/))) max = parseInt(mm[1], 10) * 365;
  return {min: min, max: max};
}
/* 解析费率页：申购档 [{min,max,rate,fixed}] + 赎回档 [{min,max,rate}] */
function parseFundRate(html){
  var out = {sub: [], redeem: []};
  if(!html){ console.log('[ext] parseFundRate: empty html'); return out; }
  function rows(anchor, len){
    var i = html.indexOf(anchor);
    if(i < 0) return [];
    var tb = html.slice(i, i + len).match(/<tbody>([\s\S]*?)<\/tbody>/);
    if(!tb) return [];
    var rs = tb[1].match(/<tr>[\s\S]*?<\/tr>/g) || [];
    return rs.map(function(r){
      var tds = r.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
      return tds.map(function(td){
        return td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      });
    });
  }
  /* 申购单元格形如 "<strike>1.00%</strike> | 0.10%"（前为原费率，后为天天基金优惠费率）；大额档可能是"每笔1000元" */
  rows('申购费率', 3000).forEach(function(c){
    if(c.length < 2) return;
    var parts = c[1].split('|').map(function(s){ return s.trim(); });
    var disc = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    var mf = disc.match(/每笔\s*([\d.,]+)\s*元/);
    var mr = disc.match(/([\d.]+)\s*%/);
    var rg = _parseAmtRange(c[0]);
    if(!rg) return;
    if(mf) out.sub.push({min: rg.min, max: rg.max, rate: 0, fixed: parseFloat(mf[1].replace(/,/g, ''))});
    else if(mr) out.sub.push({min: rg.min, max: rg.max, rate: parseFloat(mr[1]) / 100, fixed: null});
  });
  /* 赎回单元格形如 "大于等于7天，小于365天" / "0.50%" */
  rows('赎回费率', 2500).forEach(function(c){
    if(c.length < 2) return;
    var mr = c[1].match(/([\d.]+)\s*%/);
    var rg = _parseHoldRange(c[0]);
    if(mr && rg) out.redeem.push({min: rg.min, max: rg.max, rate: parseFloat(mr[1]) / 100, label: c[0]});
  });
  console.log('[ext] parseFundRate: sub=' + out.sub.length + ' redeem=' + out.redeem.length + ' htmlLen=' + html.length);
  return out;
}
function pickSubRate(sub, amount){
  if(!sub || !sub.length) return null;
  for(var i = 0; i < sub.length; i++){
    var t = sub[i];
    if(amount >= t.min && amount < t.max) return t;
  }
  return sub[sub.length - 1];
}
function pickRedeemRate(redeem, days){
  if(!redeem || !redeem.length) return null;
  for(var i = 0; i < redeem.length; i++){
    var t = redeem[i];
    if(days >= t.min && days < t.max) return t.rate;
  }
  return redeem[redeem.length - 1].rate;
}
function fetchFundRate(code){
  /* MV3 SW 抓 fundf10.eastmoney.com 会被 CORS 拦（页面无 Access-Control-Allow-Origin 头）；
     改走扩展页直连（chrome-extension:// 是特权上下文，配 host_permissions 可绕过 CORS 直读）。
     manifest 的 connect-src 已加 https://fundf10.eastmoney.com。 */
  var url = 'https://fundf10.eastmoney.com/jjfl_' + code + '.html?_=' + Date.now();
  console.log('[ext] fetchFundRate (direct) start:', code);
  var delays = [0, 600, 1200];
  var lastErr = null;
  function attempt(i){
    if(i >= delays.length) return Promise.reject(lastErr || new Error('retry exhausted'));
    if(delays[i] > 0){
      return new Promise(function(r){ setTimeout(function(){ r(attempt(i+1)); }, delays[i]); });
    }
    return fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrer: 'https://fund.eastmoney.com/',
      referrerPolicy: 'unsafe-url'
    }).then(function(r){
      console.log('[ext] fetchFundRate direct status:', r.status);
      if(r.status < 200 || r.status >= 400) throw new Error('http ' + r.status);
      return r.text();
    }).catch(function(e){ lastErr = e; return attempt(i+1); });
  }
  return attempt(0).then(function(html){
    console.log('[ext] fetchFundRate got html:', code, 'len=' + (html && html.length), 'hasAnchor=' + (html && html.indexOf('申购费率') >= 0));
    var r = parseFundRate(html);
    /* 解析结果为空时不缓存（避免把失败/空表缓存 7 天） */
    if(r && (r.sub && r.sub.length || r.redeem && r.redeem.length)){
      r.ts = Date.now();
      fundRateCache[code] = r;
      saveFundRateCache();
    } else {
      console.log('[ext] fetchFundRate empty parse, skip cache:', code);
    }
    return r;
  }).catch(function(e){ console.log('[ext] 基金费率获取失败:', code, e && e.message || e); return null; });
}
/* 取费率（带 7 天缓存）；命中缓存或联网拿到都会回调 cb */
function ensureFundRate(code, cb){
  var c = fundRateCache[code];
  var hasData = c && ((c.sub && c.sub.length) || (c.redeem && c.redeem.length));
  if(c && c.ts && hasData && (Date.now() - c.ts < RATE_TTL)){ 
    console.log('[ext] ensureFundRate cache hit:', code);
    if(cb) cb(c); return Promise.resolve(c); 
  }
  console.log('[ext] ensureFundRate fetch:', code, 'cached=' + !!c, 'hasData=' + hasData);
  return fetchFundRate(code).then(function(r){ if(cb) cb(r || null); return r; });
}

/* ================= 分笔（lots） ================= */
function _lotAdd(h, shares, price, date){
  if(!Array.isArray(h.lots)) h.lots = [];
  h.lots.push({d: date || null, s: shares, p: price || 0});
}
function _lotConsume(h, shares){
  if(!Array.isArray(h.lots)) return;
  var remain = shares;
  for(var i = 0; i < h.lots.length && remain > 0; i++){
    var take = Math.min(h.lots[i].s || 0, remain);
    h.lots[i].s = (h.lots[i].s || 0) - take;
    remain -= take;
  }
  h.lots = h.lots.filter(function(l){ return (l.s || 0) > 1e-8; });
}
function _daysBetween(a, b){
  if(!a || !b) return null;
  var d1 = new Date(a + 'T00:00:00'), d2 = new Date(b + 'T00:00:00');
  if(isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
  return Math.round((d2 - d1) / 86400000);
}
/* 赎回费按先进先出：每笔按其持有天数取对应赎回费率，逐笔累加。
   取不到费率表 / 该笔买入日期未知 → 退到最长持有档（通常 0%）并置 warn 提示复核（手续费仍可手改）。 */
function _redeemFee(h, shares, nav, tradeDate, redeem){
  var r = {fee: 0, warn: false, rate: null, days: null};
  if(!Array.isArray(h.lots) || !h.lots.length){ r.warn = true; return r; }
  var remain = shares, weighted = 0, total = 0;
  for(var i = 0; i < h.lots.length && remain > 0; i++){
    var lot = h.lots[i];
    var take = Math.min(lot.s || 0, remain);
    if(take <= 0) continue;
    var rate = null, days = null;
    if(redeem && redeem.length && lot.d){
      days = _daysBetween(lot.d, tradeDate);
      if(days !== null) rate = pickRedeemRate(redeem, days);
    }
    if(rate === null || rate === undefined){
      rate = (redeem && redeem.length) ? redeem[redeem.length - 1].rate : 0;
      r.warn = true;
    }
    r.fee += take * nav * rate;
    weighted += rate * take; total += take;
    if(r.days === null && days !== null) r.days = days;
    remain -= take;
  }
  r.rate = total > 0 ? (weighted / total) : null;
  return r;
}

/* 交易弹窗（加仓 / 减仓共用，由 openTrade 设定方向与可见字段）
   基金：价 = 该日收盘净值（联网查东财 F10 历史净值），用户录入「日期 + 金额(加仓) / 份额(减仓)」。
   股票：成交价由用户自己决定，录入「份额 + 价格」。 */
var tradeState = null; /* {kind, code, dir:'add'|'sell', nav, navSrc, rate, rateState, rateWarn} */
var navFetchToken = 0; /* 切日期后丢弃过期请求结果，避免旧净值覆盖新净值 */
function todayStr(){ var d = new Date(); return d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2); }

function openTrade(kind, code, dir){
  var h = _tradeFind(kind, code); if(!h) return;
  tradeState = {kind: kind, code: code, dir: dir, nav: null, navSrc: '', rate: null, rateState: 'loading', rateWarn: false, redeemTier: null};
  var nm = (kind === 'stock'
    ? (stockInfo[h.code] && stockInfo[h.code].name)
    : (fundInfo[h.code] && fundInfo[h.code].name)) || h.code;
  $('#tradeTitleText').textContent = (dir === 'add' ? '加仓 ' : '减仓 ') + nm;
  $('#tradeCur').textContent = '当前份额 ' + (h.shares || 0) + ' · 当前均价 ' + (h.cost != null ? h.cost : '--');
  $('#tradeShares').value = ''; $('#tradeAmount').value = ''; $('#tradePrice').value = ''; $('#tradeFee').value = '';

  var isFund = (kind === 'fund');
  /* 交易成本折叠面板：股票弹窗只显示 佣金/起收/印花税，基金弹窗只显示 申购费率 */
  var cFold = $('#tradeCostFold');
  if(cFold){
    Array.prototype.forEach.call(cFold.querySelectorAll('[data-kind]'), function(el){
      var show = (el.getAttribute('data-kind') === 'fund') ? isFund : !isFund;
      el.style.display = show ? '' : 'none';
    });
  }
  /* 可见字段：基金=日期 +(加仓金额 | 减仓份额)；股票=份额 + 价格 */
  $('#tradeDateRow').style.display = isFund ? '' : 'none';
  $('#tradeNavLabel').style.display = isFund ? '' : 'none';
  $('#redeemTierRow').style.display = (isFund && dir === 'sell') ? '' : 'none';
  $('#tradeAmountRow').style.display = (isFund && dir === 'add') ? '' : 'none';
  /* tradeSharesRow: 基金加仓隐、其它全显；stock 用 tradePriceRow 控制价 */
  $('#tradeSharesRow').style.display = (isFund && dir === 'add') ? 'none' : '';
  $('#tradeSharesLabel').textContent = isFund
    ? (dir === 'add' ? '加仓份额（份）' : '减仓份额（份）')
    : (dir === 'add' ? '加仓份额（股）' : '减仓份额（股）');
  $('#tradeShares').placeholder = isFund
    ? (dir === 'sell' ? '本次最多可减仓 ' + (h.shares || 0) + ' 份' : '如 1000')
    : (dir === 'add' ? '如 1000' : '如 1000');
  /* 股票才需要价格、股票加仓隐价格？股票加仓成交价必填：保留显示。 */
  $('#tradePriceRow').style.display = isFund ? 'none' : '';
  $('#maskTrade').classList.add('show');

  /* 范围提示：基金提示日期约束；股票空（约束走 #tradeShares.max） */
  var rangeTip = $('#tradeRangeTip');
  if(isFund){
    rangeTip.style.display = '';
    rangeTip.textContent = '请选择准确日期';
    if(dir === 'sell'){
      /* 减仓份额框的 max 属性实时绑定到持仓（浏览器原生校验 + 上下箭头步进） */
      $('#tradeShares').max = (h.shares || 0);
    }
  } else {
    rangeTip.style.display = 'none';
    rangeTip.textContent = '';
    if(dir === 'sell'){
      $('#tradeShares').max = (h.shares || 0);
    }
  }
  if(dir === 'add'){
    $('#tradeShares').removeAttribute('max');
  }

  if(isFund){
    /* 默认日期：最近一个已公布净值的交易日（基金 T 日晚 20:00 才公布 T 日 NAV，白天未公布则不可选"今天"）。
       看板是事后录入，navDate 取自 fundInfo（refreshAll 时由 lsjz 同步写入）。 */
    var lastNavDate = (fundInfo[h.code] && fundInfo[h.code].navDate) || '';
    var defaultDate = lastNavDate || todayStr();
    $('#tradeDate').value = defaultDate;
    $('#tradeDate').max = defaultDate;            /* HTML5 原生约束：日期选择器禁用未来日期 */
    tradeState.maxNavDate = defaultDate;          /* confirmTrade 校验用 */
    var f = (dir === 'add') ? $('#tradeAmount') : $('#tradeShares');
    if(f && f.focus) f.focus();
    /* 费率（申购优惠费率 + 赎回分档）联网取一次并缓存，拿到后重算手续费 */
    tradeState.rateState = 'loading';
    _renderRedeemTiers();            /* 即使费率还没拿到，也先渲染空状态/加载提示 */
    ensureFundRate(code, function(r){
      if(!tradeState || tradeState.code !== code) return;
      tradeState.rate = r;
      tradeState.rateState = (r && r.sub && r.sub.length) ? 'ok' : 'fail';
      _renderRedeemTiers();
      calcTradeFee(); _renderFundNavLabel();
    });
    resolveFundNav();
  } else {
    if($('#tradeShares').focus) $('#tradeShares').focus();
  }
}
function closeTrade(){ $('#maskTrade').classList.remove('show'); tradeState = null; }

/* 按所选日期取基金收盘净值；取不到（休市 / 该日净值未公布）则用最新可用净值兜底并标注 */
function resolveFundNav(){
  if(!tradeState || tradeState.kind !== 'fund') return;
  var date = $('#tradeDate').value;
  if(!date) return;
  var myToken = ++navFetchToken;
  var info = fundInfo[tradeState.code] || {};
  var fallback = info.gsz || info.dwjz || null;
  tradeState.nav = null; tradeState.navSrc = '';
  _renderFundNavLabel('正在查询 ' + date + ' 净值…');
  fetchNavByDate(tradeState.code, date).then(function(r){
    if(myToken !== navFetchToken || !tradeState || tradeState.kind !== 'fund') return; /* 过期结果丢弃 */
    if(r && r.nav > 0){
      tradeState.nav = r.nav;
      tradeState.navSrc = (r.date === date) ? '净值 ' : '净值（' + (r.date || date) + '）';
    } else if(fallback){
      tradeState.nav = fallback;
      tradeState.navSrc = '该日净值未公布 · 暂用最新净值 ';
    }
    $('#tradePrice').value = tradeState.nav ? tradeState.nav.toFixed(4) : '';
    _renderFundNavLabel();
    calcTradeFee();
  });
}
/* 净值只读展示；加仓时顺带算出「约得份额」 */
function _renderFundNavLabel(loading){
  var lbl = $('#tradeNavLabel'); if(!lbl || !tradeState) return;
  lbl.classList.remove('warn');
  if(loading){ lbl.textContent = loading; return; }
  if(!tradeState.nav){ lbl.textContent = '未获取到净值，请换一个交易日或稍后再试'; lbl.classList.add('warn'); return; }
  var txt = (tradeState.navSrc || '净值 ') + tradeState.nav.toFixed(4);
  var amt = parseFloat($('#tradeAmount').value);
  if(tradeState.dir === 'add'){
    /* 份额按「金额 − 手续费」算，与 confirmTrade 保持一致 */
    var fee = parseFloat($('#tradeFee').value); if(isNaN(fee)) fee = 0;
    var dr = null, fixedFee = null, rateLabel = '', rateWarn = false;
    var t = (tradeState.rate && tradeState.rate.sub && !isNaN(amt)) ? pickSubRate(tradeState.rate.sub, amt) : null;
    if(t){ dr = t.rate; fixedFee = t.fixed; }
    if(!isNaN(amt) && amt > 0) txt += ' · 约得份额 ' + ((amt - fee) / tradeState.nav).toFixed(2);
    if(tradeState.rateState === 'loading'){
      rateLabel = ' · 正在获取天天基金费率…';
    } else if(tradeState.rateState === 'fail'){
      var defR = (Number(alerts.settings.fundRateW) || 0) / 10000;
      rateLabel = ' · 加仓费率 ' + (defR * 100).toFixed(2) + '%（默认，可改）';
      rateWarn = true;
    } else if(t == null && tradeState.rateState === 'ok'){
      /* 费率已拿到，但金额框为空/非数字，没法选档；给首档预览，避免默认 0.10% 被误当成解析结果 */
      var first = (tradeState.rate && tradeState.rate.sub && tradeState.rate.sub[0]) || null;
      if(first && first.fixed != null){
        rateLabel = ' · 加仓费 ' + first.fixed.toFixed(2) + '元/笔起（请输入金额）';
      } else if(first && first.rate != null){
        rateLabel = ' · 加仓费率 ' + (first.rate * 100).toFixed(2) + '%起（请输入金额）';
      } else {
        var defR2 = (Number(alerts.settings.fundRateW) || 0) / 10000;
        rateLabel = ' · 加仓费率 ' + (defR2 * 100).toFixed(2) + '%（默认，可改）';
        rateWarn = true;
      }
    } else if(fixedFee != null){
      rateLabel = ' · 加仓费 ' + fixedFee.toFixed(2) + '元/笔（天天基金优惠价）';
    } else {
      rateLabel = ' · 加仓费率 ' + ((dr != null ? dr : (Number(alerts.settings.fundRateW) || 0) / 10000) * 100).toFixed(2) + '%'
                + (dr != null ? '（天天基金优惠价）' : '（默认，可改）');
    }
    txt += rateLabel;
    if(rateWarn) lbl.classList.add('warn');
  } else {
    if(tradeState.redeemTier){
      txt += ' · 减仓费率 ' + (tradeState.redeemTier.rate * 100).toFixed(2) + '%（' + tradeState.redeemTier.label + '档·手动覆盖）';
    } else if(tradeState.redeemRate != null){
      txt += ' · 减仓费率 ' + (tradeState.redeemRate * 100).toFixed(2) + '%'
           + (tradeState.redeemDays != null ? '（持有约 ' + tradeState.redeemDays + ' 天）' : '');
      if(tradeState.rateWarn) txt += ' · 部分买入日期未知，按最长持有档估算，请手动选档或复核';
    }
  }
  if(tradeState.navSrc.indexOf('暂用最新净值') >= 0 || tradeState.rateWarn) lbl.classList.add('warn');
  lbl.textContent = txt;
}
/* 减仓赎回档位 chips：让用户从天天基金解析到的赎回分档里手动选一档（覆盖 FIFO 估算） */
function _renderRedeemTiers(){
  var list = $('#redeemTierList'); if(!list) return;
  list.innerHTML = '';
  if(!tradeState || tradeState.kind !== 'fund' || tradeState.dir !== 'sell'){
    $('#redeemTierRow').style.display = 'none';
    return;
  }
  var redeem = (tradeState.rate && tradeState.rate.redeem) || [];
  if(!redeem.length){
    $('#redeemTierRow').style.display = 'none';
    return;
  }
  $('#redeemTierRow').style.display = '';
  /* 「按买入日期自动算」默认选项 */
  var autoLbl = document.createElement('label'); autoLbl.className = 'redeem-tier';
  var autoRb = document.createElement('input');
  autoRb.type = 'radio'; autoRb.name = 'redeemTier'; autoRb.value = 'AUTO';
  autoRb.checked = (tradeState.redeemTier == null);
  autoLbl.appendChild(autoRb);
  var autoSpan = document.createElement('span'); autoSpan.textContent = '按买入日期自动算';
  autoLbl.appendChild(autoSpan);
  autoLbl.title = '按每笔买入日期与减仓日期的差套对应档（FIFO）';
  list.appendChild(autoLbl);
  autoLbl.addEventListener('click', function(ev){
    if(ev.target.tagName !== 'INPUT') autoRb.checked = true;
    if(autoRb.checked){ tradeState.redeemTier = null; _setActiveRedeemTier(autoLbl); calcTradeFee(); _renderFundNavLabel(); }
  });
  if(autoRb.checked) autoLbl.classList.add('active');
  /* 解析到的每一档 */
  redeem.forEach(function(t, idx){
    var lbl = document.createElement('label'); lbl.className = 'redeem-tier';
    var rb = document.createElement('input');
    rb.type = 'radio'; rb.name = 'redeemTier'; rb.value = String(idx);
    rb.checked = (tradeState.redeemTier && tradeState.redeemTier.idx === idx);
    lbl.appendChild(rb);
    var sp = document.createElement('span');
    sp.textContent = (t.label || _redeemTierLabel(t)) + ' ' + (t.rate * 100).toFixed(2) + '%';
    lbl.appendChild(sp);
    lbl.title = '该档费率 ' + (t.rate * 100).toFixed(2) + '%';
    list.appendChild(lbl);
    lbl.addEventListener('click', function(ev){
      if(ev.target.tagName !== 'INPUT') rb.checked = true;
      if(rb.checked){
        tradeState.redeemTier = {idx: idx, rate: t.rate, label: t.label || _redeemTierLabel(t)};
        _setActiveRedeemTier(lbl); calcTradeFee(); _renderFundNavLabel();
      }
    });
    if(rb.checked) lbl.classList.add('active');
  });
}
function _redeemTierLabel(t){
  function fmtDays(d){
    d = Number(d);
    if(!isFinite(d)) return '∞';
    if(d >= 365){ var y = d/365; return (y%1===0 ? y.toFixed(0) : y.toFixed(1)) + '年'; }
    if(d >= 30) return Math.round(d/30) + '个月';
    return d + '天';
  }
  /* 上界 ≥ HOLD_MAX (1e15) 视为无上界；同时兜底老 cache 里 Infinity→null 的情形 */
  var noMax = (t.max == null) || t.max >= HOLD_MAX || !isFinite(Number(t.max));
  if(t.min === 0 && noMax) return '任意持有期';
  if(t.min === 0 && !noMax) return '<' + fmtDays(t.max);
  if(noMax) return '≥' + fmtDays(t.min);
  return fmtDays(t.min) + '~' + fmtDays(t.max);
}
function _setActiveRedeemTier(activeLbl){
  var list = $('#redeemTierList'); if(!list) return;
  Array.prototype.forEach.call(list.querySelectorAll('.redeem-tier'), function(l){
    l.classList.toggle('active', l === activeLbl);
  });
}

function confirmTrade(){
  if(!tradeState) return;
  var fee = parseFloat($('#tradeFee').value); if(isNaN(fee)) fee = 0;
  if(fee < 0){ alert('手续费不能为负数'); return; }
  if(tradeState.kind === 'fund'){
    /* 看板事后按收盘净值记录，日期不能超过最新已公布净值日（HTML max 兜底 + JS 双保险） */
    var _tdate = $('#tradeDate').value;
    if(tradeState.maxNavDate && _tdate && _tdate > tradeState.maxNavDate){
      alert('只能选已公布净值的交易日（最新可交易日 ' + tradeState.maxNavDate + '）。本看板只计算盈亏，不实现交易。');
      return;
    }
    var nav = parseFloat($('#tradePrice').value);
    if(isNaN(nav) || nav <= 0){ alert('未获取到该日期的基金净值，请换一个已公布净值的交易日，或稍后再试。'); return; }
    if(tradeState.dir === 'add'){
      /* 加仓：按金额。外扣法 —— 净申购金额 = 金额/(1+费率)，申购费用 = 金额 − 净申购金额，份额 = 净申购金额 / 当日净值。
         这样喂给 _applyAdd(shares, nav, fee) 后，新增成本基数 = shares×nav + fee = 净申购金额 + 申购费用 = 实际付出金额。 */
      var amt = parseFloat($('#tradeAmount').value);
      if(isNaN(amt) || amt <= 0){ alert('请输入加仓金额'); return; }
      if(amt < 10){ alert('加仓金额过低（天天基金起购 10 元，A 类常见；少数基金 100/1000 元），请确认金额'); return; }
      if(fee >= amt){ alert('手续费不能超过加仓金额'); return; }
      /* 份额由「净申购金额 = 金额 − 手续费」反推，这样即使手改了手续费，
         喂给 _applyAdd 后仍有 shares×nav + fee = 实际付出金额，成本基数始终自洽。 */
      var shares = (amt - fee) / nav;
      if(!isFinite(shares) || shares <= 0){ alert('份额计算异常，请检查加仓金额与净值'); return; }
      addPosition(tradeState.kind, tradeState.code, shares, nav, fee, $('#tradeDate').value);
    } else {
      var sh = parseFloat($('#tradeShares').value);
      if(isNaN(sh) || sh <= 0){ alert('请输入减仓份额'); return; }
      if(sh < 1){ alert('最小减仓份额 1 份（天天基金规则），请调整'); return; }
      var _hs = _tradeFind(tradeState.kind, tradeState.code);
      var _remain = (_hs && _hs.shares || 0) - sh;
      if(_remain > 0 && _remain < 1){
        alert('减仓后剩余 ' + _remain.toFixed(2) + ' 份，不足最低保留 1 份（清仓除外）');
        return;
      }
      sellPosition(tradeState.kind, tradeState.code, sh, nav, fee);
    }
    closeTrade(); return;
  }
  var s = parseFloat($('#tradeShares').value);
  var p = parseFloat($('#tradePrice').value);
  if(isNaN(s) || s <= 0){ alert('请输入本次份额'); return; }
  if(isNaN(p) || p <= 0){ alert('请输入本次价格'); return; }
  /* A股/场内 交易单位软校验（提示 + 允许继续）：
     A股股票与场内基金 100 股/份整数倍（1手）；可转债 10 张整数倍（1手）；
     科创板(688)/北交所/港股/美股 不校验（规则各异或无序要求）。 */
  var lotUnit = stockLotUnit(tradeState.code);
  if(lotUnit && s % lotUnit !== 0){
    var stkRem = 0;
    if(tradeState.dir !== 'add'){
      var stkH = _tradeFind('stock', tradeState.code);
      stkRem = (stkH && stkH.shares || 0) - s;
    }
    if(tradeState.dir === 'add' || stkRem !== 0){
      var lotHint = (lotUnit === 10) ? '10 张整数倍' : '100 股整数倍';
      var ex = (lotUnit === 10) ? '10/20/50...' : '100/200/500...';
      var msg = (tradeState.dir === 'add')
        ? '加仓股数须为 ' + lotHint + '（1手，如 ' + ex + ' 股/份），当前 ' + s + ' 不符合 A 股/场内交易规则。\n（科创板/北交所/港美股可不受此限制）\n仍要按 ' + s + ' 记录吗？'
        : '减仓股数须为 ' + lotHint + '，或一次性全部清仓。当前 ' + s + ' 会留下零股（剩余 ' + stkRem + '），不符合 A 股/场内交易规则。\n仍要按 ' + s + ' 记录吗？';
      if(!confirm(msg)) return;
    }
  }
  var fn = tradeState.dir === 'add' ? addPosition : sellPosition;
  fn(tradeState.kind, tradeState.code, s, p, fee);
  closeTrade();
}
/* 实时估算手续费并预填（可手改）
   基金：加仓按「金额」用外扣法算申购费；减仓按「份额×净值」估算赎回费（赎回费与持有期有关，仅作估算）
   股票：按「份额×价格」算佣金（卡起收值）+ 卖出印花税 */
function calcTradeFee(){
  /* 负数防护：HTML min 不是强制的，用户可能粘贴或绕过；统一把负值清空 */
  ['#tradeAmount', '#tradeShares', '#tradePrice', '#tradeFee'].forEach(function(s){
    var el = $(s); if(!el || !el.value) return;
    if(parseFloat(el.value) < 0) el.value = '';
  });
  if(!tradeState) return;
  var S = alerts.settings;
  if(tradeState.kind === 'fund'){
    var nav = parseFloat($('#tradePrice').value);
    if(isNaN(nav) || nav <= 0) return; /* 净值还没取到，不预填 */
    if(tradeState.dir === 'add'){
      var amt = parseFloat($('#tradeAmount').value);
      _renderFundNavLabel();            /* 顺带刷新「约得份额 / 费率」 */
      if(isNaN(amt) || amt <= 0) return;
      /* 优先用该基金真实的天天基金优惠申购费率（按金额选档），取不到才退回设置里的默认费率 */
      var t = (tradeState.rate && tradeState.rate.sub) ? pickSubRate(tradeState.rate.sub, amt) : null;
      var fee;
      if(t && t.fixed != null){ fee = t.fixed; }               /* 大额档：每笔固定金额 */
      else {
        var r = (t && t.rate != null) ? t.rate : ((Number(S.fundRateW) || 0) / 10000);
        fee = amt - amt / (1 + r);                             /* 外扣法申购费用 */
      }
      tradeState.rateWarn = false;
      $('#tradeFee').value = fee > 0 ? fee.toFixed(2) : '0';
    } else {
      var sh = parseFloat($('#tradeShares').value);
      if(isNaN(sh) || sh <= 0){ _renderFundNavLabel(); return; }
      var h = _tradeFind(tradeState.kind, tradeState.code);
      var rf;
      if(tradeState.redeemTier){
        /* 用户在弹窗里手动选了某档 → 按平价算赎回费，跳过 FIFO */
        rf = {fee: sh * nav * tradeState.redeemTier.rate, rate: tradeState.redeemTier.rate, days: null, warn: false};
      } else {
        /* 默认：赎回费按先进先出逐笔算：每笔按其持有天数取对应赎回费率 */
        rf = _redeemFee(h, sh, nav, $('#tradeDate').value, tradeState.rate && tradeState.rate.redeem);
        if(!tradeState.rate || !tradeState.rate.redeem || !tradeState.rate.redeem.length){
          /* 费率表还没拿到（或该基金无赎回费表）→ 先用设置里的默认费率粗估，费率回来后会重算 */
          rf.fee = sh * nav * ((Number(S.fundRateW) || 0) / 10000);
          rf.warn = false;
        }
      }
      tradeState.rateWarn = rf.warn; tradeState.redeemRate = rf.rate; tradeState.redeemDays = rf.days;
      $('#tradeFee').value = rf.fee > 0 ? rf.fee.toFixed(2) : '0';
      _renderFundNavLabel();
    }
    return;
  }
  var shares = parseFloat($('#tradeShares').value);
  var price = parseFloat($('#tradePrice').value);
  if(isNaN(shares) || shares <= 0 || isNaN(price) || price <= 0) return; /* 份额/价格不全则不预填，保留用户手填 */
  var commRate = (Number(S.commRateW) || 0) / 10000;   /* 万分之 → 小数 */
  var minComm  = Number(S.minComm) || 0;               /* 最低佣金：免5账户填 0 */
  var stampTax = (Number(S.stampTaxW) || 0) / 10000;   /* 卖出印花税（仅股票卖出） */
  var notional2 = shares * price;
  var comm = notional2 * commRate;
  if(comm < minComm) comm = minComm;                   /* 卡最低佣金门槛；minComm=0 即免5 */
  var fee2 = comm + (tradeState.dir === 'sell' ? notional2 * stampTax : 0);
  $('#tradeFee').value = fee2 > 0 ? fee2.toFixed(2) : '0';
}

/* ================= 批量编辑 ================= */
function batchRowHtml(h){
  var info = h.code ? fundInfo[h.code] : null;
  var name = info && info.name ? info.name : (h.code ? '（保存后加载）' : '');
  return '<td><input class="code-in" data-f="code" maxlength="6" value="' + (h.code || '') + '" placeholder="6位代码"></td>'
       + '<td style="text-align:left" class="muted">' + escHtml(name) + '</td>'
       + '<td><input data-f="shares" type="number" value="' + (h.shares || '') + '" placeholder="选填"></td>'
       + '<td><input data-f="cost" type="number" step="0.0001" value="' + (h.cost || '') + '" placeholder="选填"></td>'
       + '<td><input data-f="amount" type="number" value="' + (h.amount || '') + '" placeholder="无份额时必填"></td>'
       + '<td><span class="row-del" data-act="rowDel" data-args=\'["event"]\'>删除</span></td>';
}
/* 股票批量编辑行：用户输 6 位数字，保存时 normStockCode 自动加 sh/sz 前缀 */
function stockBatchRowHtml(s){
  var info = s.code ? stockInfo[s.code] : null;
  var name = info && info.name ? info.name : (s.code ? '（保存后加载）' : '');
  var mv = (info && info.price && s.shares) ? fmtNum(s.shares * info.price) : '--';
  return '<td><input class="code-in" data-f="code" maxlength="12" value="' + (s.code || '') + '" placeholder="代码(如 600519 / hk00700 / 920799 / AAPL)"></td>'
       + '<td style="text-align:left" class="muted">' + escHtml(name) + '</td>'
       + '<td><input data-f="shares" type="number" step="1" value="' + (s.shares || '') + '" placeholder="必填"></td>'
       + '<td><input data-f="cost" type="number" step="0.001" value="' + (s.cost || '') + '" placeholder="选填"></td>'
       + '<td class="muted">' + mv + '</td>'
       + '<td><span class="row-del" data-act="rowDel" data-args=\'["event"]\'>删除</span></td>';
}
/* 当前批量编辑 tab：'fund' | 'stock'，影响 batchAddRow / saveBatch / 面板显隐 */
var _batchTab = 'fund';
function setBatchTab(tab){
  _batchTab = tab;
  var tabs = document.querySelectorAll('#maskBatch .batch-tab');
  tabs.forEach(function(b){
    var want = b.getAttribute('data-args');
    b.classList.toggle('active', want === '["' + tab + '"]');
  });
  $('#batchFundPanel').style.display  = (tab === 'fund')  ? '' : 'none';
  $('#batchStockPanel').style.display = (tab === 'stock') ? '' : 'none';
}
function batchTab(tab){
  setBatchTab(tab);
  /* 切换到股票 tab 时若还没渲染股票行，渲染当前股票持仓 */
  if(tab === 'stock' && !$('#batchStkBody').children.length){ renderStockBatchRows(); }
}
function renderStockBatchRows(){
  var tb = $('#batchStkBody');
  tb.innerHTML = '';
  stocks.forEach(function(s){
    var tr = document.createElement('tr');
    tr.innerHTML = stockBatchRowHtml(s);
    tb.appendChild(tr);
  });
  if(!stocks.length){
    var tr = document.createElement('tr');
    tr.innerHTML = stockBatchRowHtml({});
    tb.appendChild(tr);
  }
}
function openBatch(){
  var tb = $('#batchBody');
  tb.innerHTML = '';
  holdings.forEach(function(h){
    var tr = document.createElement('tr');
    tr.innerHTML = batchRowHtml(h);
    tb.appendChild(tr);
  });
  if(!holdings.length){ batchAddRow(); }
  /* 每次打开都重置为基金 tab，清空股票 tbody 待切换时按需渲染 */
  setBatchTab('fund');
  $('#batchStkBody').innerHTML = '';
  $('#maskBatch').classList.add('show');
}
function batchAddRow(){
  var tb = (_batchTab === 'stock') ? $('#batchStkBody') : $('#batchBody');
  var tr = document.createElement('tr');
  tr.innerHTML = (_batchTab === 'stock') ? stockBatchRowHtml({}) : batchRowHtml({});
  tb.appendChild(tr);
  var inp = tr.querySelector('input[data-f="code"]');
  if(inp) inp.focus();
}
function closeBatch(){ $('#maskBatch').classList.remove('show'); }
/* 批量编辑单行删除：移除当前 tr；保存时按剩余 tr 收集持仓，被删行自然不写入 */
function rowDel(e){
  var btn = (e && e.target && e.target.closest) ? e.target.closest('[data-act="rowDel"]') : null;
  if(!btn) return;
  var tr = btn.closest('tr');
  if(!tr) return;
  /* 如果删完一格都不剩，自动补一行空行方便继续编辑 */
  var tb = tr.parentElement;
  tr.remove();
  if(tb && !tb.children.length && typeof batchAddRow === 'function'){ batchAddRow(); }
}
function saveBatch(){
  if(_batchTab === 'stock'){ return saveStockBatch(); }
  var rows = document.querySelectorAll('#batchBody tr');
  var next = [], seen = {};
  for(var i = 0; i < rows.length; i++){
    var get = function(f){ var el = rows[i].querySelector('input[data-f="' + f + '"]'); return el ? el.value.trim() : ''; };
    var code = get('code');
    if(!code){ continue; } /* 空行跳过 */
    if(!/^\d{6}$/.test(code)){ alert('第 ' + (i+1) + ' 行代码「' + code + '」不是 6 位数字'); return; }
    if(seen[code]){ alert('代码 ' + code + ' 重复了，请合并为一行'); return; }
    seen[code] = true;
    var shares = parseFloat(get('shares'));
    var cost = parseFloat(get('cost'));
    var amount = parseFloat(get('amount'));
    var hasShares = !isNaN(shares) && shares > 0;
    if(!hasShares && (isNaN(amount) || amount <= 0)){
      alert('第 ' + (i+1) + ' 行（' + code + '）需填「持有份额」或「持有市值」至少一项'); return;
    }
    var oldH = holdings.find(function(h){ return h.code === code; });
    var e = {
      code: code,
      shares: hasShares ? shares : null,
      cost: (hasShares && !isNaN(cost) && cost > 0) ? cost : null,
      amount: (!isNaN(amount) && amount > 0) ? amount : null,
      realized: oldH ? (oldH.realized || 0) : 0,
      tCount: oldH ? (oldH.tCount || 0) : 0
    };
    /* 分笔同步：份额没变就沿用原分笔（保住买入日期）；变了则重建为「日期未知」的一笔 */
    if(oldH && Array.isArray(oldH.lots) && oldH.lots.length && oldH.shares === e.shares) e.lots = oldH.lots;
    else e.lots = (hasShares ? [{d: null, s: shares, p: e.cost || 0}] : []);
    next.push(e);
  }
  /* 清理已删除基金的缓存 */
  Object.keys(fundInfo).forEach(function(c){ if(!seen[c]) delete fundInfo[c]; });
  holdings = next;
  saveHoldings(); closeBatch(); refreshAll();
}
/* 保存股票批量编辑：用户输 6 位代码 → normStockCode 自动加 sh/sz 前缀；股数必填，成本选填
   v48 修复：补 type 字段（沿用原 type；改了代码或老数据无 type 时按新代码重分类）——
        否则 renderStocks 拿 undefined type 全部回退成"其他"标签 */
function saveStockBatch(){
  var rows = document.querySelectorAll('#batchStkBody tr');
  var next = [], seen = {}, prevTypeMap = {};
  /* 索引历史 type（code→原 type），代码未变时沿用、变了或缺失则重分类 */
  stocks.forEach(function(s){ if(s.code && s.type) prevTypeMap[s.code] = s.type; });
  /* v1.1.0：保留历史已实现盈亏（减仓落袋收益），避免批量编辑清空 */
  var prevRealizedMap = {};
  stocks.forEach(function(s){ if(s.code) prevRealizedMap[s.code] = {realized: s.realized || 0, tCount: s.tCount || 0}; });
  for(var i = 0; i < rows.length; i++){
    var get = function(f){ var el = rows[i].querySelector('input[data-f="' + f + '"]'); return el ? el.value.trim() : ''; };
    var raw = get('code');
    if(!raw){ continue; } /* 空行跳过 */
    var code = normStockCode(raw);
    if(!code){ alert('第 ' + (i+1) + ' 行代码「' + raw + '」无效（A股6位 / 港股 hk00000 / 北交所 920799 / 美股 AAPL）'); return; }
    if(seen[code]){ alert('代码 ' + code + ' 重复了，请合并为一行'); return; }
    seen[code] = true;
    var shares = parseFloat(get('shares'));
    if(isNaN(shares) || shares <= 0){ alert('第 ' + (i+1) + ' 行（' + raw + '）需填「持有股数」'); return; }
    var cost = parseFloat(get('cost'));
    next.push({
      code: code,
      shares: shares,
      cost: (!isNaN(cost) && cost > 0) ? cost : null,
      type: prevTypeMap[code] || classifyStockType(code).cls,   /* v48 补 type */
      realized: prevRealizedMap[code] ? prevRealizedMap[code].realized : 0,
      tCount: prevRealizedMap[code] ? prevRealizedMap[code].tCount : 0
    });
  }
  /* 清理已删除股票的缓存 */
  Object.keys(stockInfo).forEach(function(c){ if(!seen[c]) delete stockInfo[c]; });
  stocks = next;
  saveStocks(); closeBatch(); refreshAll();
}
/* ================= 股票持仓 ================= */
var STK_KEY = 'fund_board_stocks_v1';
var stocks = (function(){
  try{ var s = JSON.parse(localStorage.getItem(STK_KEY)); if(Array.isArray(s)) return s.map(normRealized); }catch(e){}
  return [];
})();
function saveStocks(){ try{ localStorage.setItem(STK_KEY, JSON.stringify(stocks)); }catch(e){ console.error('[ext] saveStocks 失败:', e && e.message || e); toast('股票保存失败：存储已满或隐私模式'); } }
/* v1.0.9 启动迁移：北交所旧代码 bj8xxxxx / bj43xxxx -> bj920xxx（后三位保留）。
   北交所 2025-10-09 起全部切换为 920 号段，旧 8xx/43xx 已停更，必须迁移到 920 才能取到实时行情。 */
(function(){
  var changed = false;
  stocks.forEach(function(s){
    if(s && s.code && /^bj(?:8\d{5}|43\d{4})$/.test(s.code)){
      s.code = 'bj920' + s.code.slice(-3);
      changed = true;
    }
  });
  if(changed){ try{ saveStocks(); }catch(e){} }
})();
var stockInfo = {}; /* code -> {name, price, prevClose, pct} */

/* 规范股票/场内基金代码：自动补 sh/sz 前缀。支持 ETF/LOF/可转债/REITs 等场内品种
   交易所映射（按前两位细分，因 1 开头既可能是沪市可转债 11，也可能是深市基金 15/16/18）：
     沪市 sh：6 股票 / 5 基金(ETF·LOF·REITs) / 9 B股 / 11 可转债
     深市 sz：0/3 股票(含创业板) / 2 B股 / 12 可转债 / 15 ETF / 16 LOF / 18 REITs / 10 国债(兜底) */
/* 规范化为腾讯行情代码（与 fetchTencent 直接喂的格式一致）。
   A股: sh/sz + 6位；港股: hk + 5位（00700.HK / hk00700）；美股: us + 字母（AAPL / AAPL.US / BRK.B / usBRK.B）；北交所: bj + 6位（bj920799 / 920799）。
   港股必须带 .HK 或 hk 前缀，避免与 A 股数字混淆；美股按字母识别（带点如 BRK.B 视为同一只）；
   北交所现行代码仅 920 开头（2025-10-09 起全部切换完成）；旧 8xx / 43xx 号段已停更，输入或历史持仓会自动迁移到 920 新号段（后三位保留），绝不落库为冻结代码。 */
function normStockCode(v){
  v = (v || '').trim().toLowerCase();
  var m;
  if((m = v.match(/^(?:hk)?(\d{4,5})\.hk$/)))   return 'hk' + m[1].replace(/^0+/, '').padStart(5, '0'); // 00700.HK
  if((m = v.match(/^hk(\d{4,5})$/)))            return 'hk' + m[1].replace(/^0+/, '').padStart(5, '0'); // 已规范 hk00700
  if((m = v.match(/^(?:bj)?(\d{6})\.bj$/))){   // 920799.BJ
    var _cb = m[1];
    if(/^920\d{3}$/.test(_cb)) return 'bj' + _cb;                    // 现行 920 号段
    if(/^(?:8[2387]|43)\d{4}$/.test(_cb)) return 'bj920' + _cb.slice(3); // 旧号段迁移到 920（后三位保留）
    return 'bj' + _cb;
  }
  if((m = v.match(/^bj(\d{6})$/))){             // 已规范 bj920799 / bj830799(旧)
    var _cj = m[1];
    if(/^920\d{3}$/.test(_cj)) return 'bj' + _cj;                    // 现行 920 号段
    if(/^(?:8[2387]|43)\d{4}$/.test(_cj)) return 'bj920' + _cj.slice(3); // 旧号段迁移到 920（后三位保留）
    return 'bj' + _cj;
  }
  if((m = v.match(/^(?:us)?([a-z]{1,6})(?:\.[a-z]{1,3})?\.us$/))) return 'us' + m[1].toUpperCase();     // AAPL.US
  if((m = v.match(/^us([a-z]{1,6})(?:\.[a-z]{1,3})?$/)))      return 'us' + m[1].toUpperCase();          // 已规范 usAAPL
  if((m = v.match(/^([a-z]{1,6})(?:\.[a-z]{1,3})?$/)))        return 'us' + m[1].toUpperCase();          // 纯字母 AAPL / BRK.B
  if(/^(sh|sz)\d{6}$/.test(v)) return v;
  if(/^\d{6}$/.test(v)){
    if(/^920\d{3}$/.test(v)) return 'bj' + v;                   // 北交所现行 920 号段（唯一有效）
    if(/^(?:8[2387]|43)\d{4}$/.test(v)) return 'bj920' + v.slice(3); // 旧 8xx/43xx 迁移到 920（后三位保留），已停更不落库
    var f2 = v.slice(0,2);
    if(v[0] === '6' || v[0] === '5' || v[0] === '9') return 'sh' + v;   // 沪市：股票 / 基金 / B股
    if(v[0] === '0' || v[0] === '3' || v[0] === '2') return 'sz' + v;   // 深市：股票 / 创业板 / B股
    if(f2 === '11') return 'sh' + v;                                    // 沪市可转债
    if(f2 === '12' || f2 === '15' || f2 === '16' || f2 === '18') return 'sz' + v; // 深市：可转债 / ETF / LOF / REITs
    if(f2 === '10') return 'sz' + v;                                    // 兜底：深市国债等少见品种
  }
  return null;
}

/* 识别场内品种类型（股票 / 科创板 / 创业板 / ETF / LOF / REITs / 可转债 / 场内基金）
   基于代码前缀规则粗分类；交易所由 normStockCode 统一判定，避免 1 开头混淆。
   深市 15/16 等边界品种若识别不准，用户可在弹窗手动修正。 */
function classifyStockType(rawCode){
  var nc = normStockCode(rawCode);
  if(!nc) return {cls:'other', label:'未知', exchName:''};
  if(/^hk/.test(nc)) return {cls:'hk', label:'港股', exchName:'港股'};
  if(/^us/.test(nc)) return {cls:'us', label:'美股', exchName:'美股'};
  if(/^bj/.test(nc)) return {cls:'bj', label:'北交所', exchName:'北交所'};
  var c = nc.replace(/^(sh|sz|hk|us|bj)/, '');
  var exch = nc.slice(0, 2);                                  // 'sh' | 'sz'
  var exchName = exch === 'sh' ? '沪市' : '深市';
  var f2 = c.slice(0,2), f3 = c.slice(0,3);
  if(c[0] === '6'){ if(f3==='688'||f3==='689') return {cls:'stock', label:'科创板', exchName:exchName}; return {cls:'stock', label:'股票', exchName:exchName}; }
  if(c[0] === '0') return {cls:'stock', label:'股票', exchName:exchName};
  if(c[0] === '3') return {cls:'stock', label:'创业板', exchName:exchName};
  if(exch==='sh' && f3==='508') return {cls:'reits', label:'REITs', exchName:exchName};
  if(exch==='sz' && f3==='180') return {cls:'reits', label:'REITs', exchName:exchName};
  if(exch==='sh' && (f3==='510'||f3==='511'||f3==='512'||f3==='513'||f3==='515'||f3==='516'||f3==='517'||f3==='518'||f3==='588'||f2==='56')) return {cls:'etf', label:'ETF', exchName:exchName};
  if(exch==='sz' && (f3==='159'||f2==='15')) return {cls:'etf', label:'ETF', exchName:exchName};
  if(exch==='sh' && (f3==='501'||f3==='502'||f2==='50')) return {cls:'lof', label:'LOF', exchName:exchName};
  if(exch==='sz' && (f3==='160'||f3==='161'||f3==='163'||f3==='164'||f3==='165'||f3==='166'||f3==='167'||f3==='168'||f2==='16')) return {cls:'lof', label:'LOF', exchName:exchName};
  if(exch==='sh' && f2==='11') return {cls:'bond', label:'可转债', exchName:exchName};
  if(exch==='sz' && f2==='12') return {cls:'bond', label:'可转债', exchName:exchName};
  if(exch==='sh' && c[0]==='5') return {cls:'fund', label:'场内基金', exchName:exchName};
  if(exch==='sz' && c[0]==='1') return {cls:'fund', label:'场内基金', exchName:exchName};
  return {cls:'other', label:'其他', exchName:exchName};
}

/* 交易单位（股/份/张）软校验用：返回最小申报单位，null = 不校验。
   A股股票/场内基金(ETF·LOF·REITs)：100 股/份 = 1 手；
   可转债：10 张 = 1 手；
   科创板(688/689)：200 起可按 1 股递增 → 不强制 100 整；
   北交所：100 起可按 1 股递增 → 不强制；港股/美股：无手数限制 → 不校验。 */
function stockLotUnit(code){
  if(!code) return null;
  if(/^(hk|us|bj)/.test(code)) return null;
  if(/^sh(688|689)/.test(code)) return null;     /* 科创板 */
  if(/^(sh11|sz12)/.test(code)) return 10;       /* 可转债 */
  if(/^sh\d{6}$/.test(code) || /^sz\d{6}$/.test(code)) return 100;  /* A股股票 / 场内基金 */
  return null;
}

function renderStocks(){
  var html = '', totMv = 0, totPnl = 0, totPrev = 0, totCum = 0, totCost = 0, totRealized = 0, hasCost = false, hasPnl = false, n = 0, ytdPnl = 0, ytdPrevMv = 0;
  stocks.forEach(function(s){
    var q = stockInfo[s.code];
    var price = q ? q.price : null, pct = q ? q.pct : null, prev = q ? q.prevClose : null;
    var mv = (price !== null && s.shares) ? s.shares * price : null;
    var pnl = (price !== null && prev !== null && s.shares) ? s.shares * (price - prev) : null;
    var prevMv = (prev !== null && s.shares) ? s.shares * prev : null;
    var cumPct = null, cumPnl = null;
    if(mv !== null && s.cost && s.shares){
      var costMv = s.shares * s.cost;
      cumPnl = mv - costMv;            /* 累计盈亏 = 市值 − 成本市值 */
      cumPct = (mv / costMv - 1) * 100;
    }
    if(mv !== null){
      totMv += mv; n++;
      /* 昨日盈亏：股数 ×(昨收 − 前收)。前收从新浪日K trend 倒数第2天取（非盘中也有数据）。
         非盘中时段顶部卡会显示"昨日盈亏"而不是空洞的"今日盈亏=0" */
      if(q && q.trend && q.trend.length >= 2 && s.shares){
        var _tl = q.trend.length;
        var _yC = q.trend[_tl - 1].close, _yP = q.trend[_tl - 2].close;
        if(!isNaN(_yC) && !isNaN(_yP) && _yP > 0){
          ytdPnl += s.shares * (_yC - _yP);
          ytdPrevMv += s.shares * _yP;
        }
      }
    }
    if(pnl !== null){ totPnl += pnl; hasPnl = true; }
    if(prevMv !== null) totPrev += prevMv;
    if(cumPnl !== null) totCum += cumPnl;
    if(s.cost && s.shares){ totCost += s.shares * s.cost; hasCost = true; }
    if(s.realized) totRealized += s.realized;
    var _stkNm = (q && q.name) ? q.name : '加载中…';
    /* v48 兜底：老数据 stocks 里可能没 type 字段（v47 之前的批量编辑保存会丢 type）。
       这里只用于渲染显示，不写回 storage；下次 saveStockBatch/saveStock 会被永久写入。 */
    var _stkType = s.type || classifyStockType(s.code).cls;
    html += '<tr><td title="' + escHtml(_stkNm) + '">' + escHtml(_stkNm) + '</td>'
          + '<td>' + typeTag(_stkType) + '</td>'
          + '<td>' + s.code.replace(/^(sh|sz|hk|us|bj)/, '') + '</td>'
          + '<td>' + fmtNum(price) + '</td>'
          + '<td>' + fmtNum(mv) + '</td>'
          + '<td>' + (s.shares ? Number(s.shares).toLocaleString() : '--') + '</td>'
          + '<td>' + (s.cost ? fmtNum(s.cost, 3) : '--') + '</td>'
          + '<td class="' + (pct !== null ? cls(pct) : 'muted') + '">' + (pct !== null ? fmtPct(pct) : '--') + '</td>'
          + '<td class="' + cls(pnl) + '">' + fmtSigned(pnl) + '</td>'
          + '<td class="' + (cumPct !== null ? cls(cumPct) : 'muted') + '">' + (cumPct !== null ? fmtPct(cumPct) : '--') + '</td>'
          + '<td class="' + (cumPnl !== null ? cls(cumPnl) : 'muted') + '">' + (cumPnl !== null ? fmtSigned(cumPnl) : '--') + '</td>'
          + '<td class="' + (s.realized ? cls(s.realized) : 'muted') + '">' + (s.realized ? fmtSigned(s.realized) : '--') + '</td>'
          + `<td><span class="link" data-act="openTrade" data-args='["stock","${s.code}","add"]'>加仓</span><span class="link" data-act="openTrade" data-args='["stock","${s.code}","sell"]'>减仓</span><span class="link" data-act="openStockModal" data-args='["${s.code}"]'>编辑</span><span class="link" style="color:var(--red)" data-act="delStock" data-args='["${s.code}"]'>删除</span></td></tr>`;
  });
  if(stocks.length){
    /* v47 合计：5 列市值在 totMv，8 列涨跌幅空（加总无意义），其余跟随新表头 */
    html += '<tr class="total-row"><td>合计</td><td></td><td></td><td></td>'
          + '<td>' + fmtNum(totMv) + '</td>'
          + '<td></td><td></td><td></td>'
          + '<td class="' + cls(totPnl) + '">' + (hasPnl ? fmtSigned(totPnl) : '--') + '</td>'
          + '<td></td>'
          + '<td class="' + cls(totCum) + '">' + (totCum !== 0 ? fmtSigned(totCum) : '--') + '</td>'
          + '<td class="' + (totRealized > 0 ? 'up' : (totRealized < 0 ? 'down' : 'muted')) + '">' + (totRealized ? fmtSigned(totRealized) : '--') + '</td>'
          + '<td></td></tr>';
  }
  $('#stockBody').innerHTML = html || '<tr><td colspan="12" class="muted" style="text-align:center;padding:20px">暂无股票持仓，点击顶部 <b>+</b> 按钮添加</td></tr>';
  /* 整段 section 显示控制：无任何股票持仓时连标题带表一起隐藏 */
  $('#stockSection').style.display = stocks.length ? '' : 'none';
  return {totalMv: totMv, totalPnl: totPnl, prevMv: totPrev, count: n, hasPnl: hasPnl, cum: totCum, totalCost: totCost, hasCost: hasCost, realized: totRealized,
    ytdPnl: ytdPnl, ytdPrevMv: ytdPrevMv, ytdPct: ytdPrevMv > 0 ? ytdPnl / ytdPrevMv * 100 : 0};
}

/* ================= 汇总卡片（基金+股票合并） ================= */
/* 是否处于连续竞价时段：用于"盘中实时估算 / 实际市值"标签切换
   9:30-11:30、13:00-15:00 为盘中；其余（含盘前盘后、周末）按"已结算"处理 */
function isMarketOpen(){
  var d = new Date(), day = d.getDay();
  if(day === 0 || day === 6) return false;                 // 周六日
  var t = d.getHours() * 60 + d.getMinutes();
  return (t >= 570 && t <= 690) || (t >= 780 && t <= 900); // 9:30-11:30, 13:00-15:00
}
/* 顶部"今日盈亏"卡是否改显示"昨日盈亏"：
   周末 + 工作日 9:30 盘前 → 显示昨日盈亏（此时还没有今日数据，显示今日会空洞=0）
   盘中 / 午休 / 盘后（净值已更新） → 仍显示今日盈亏 */
function showYesterdayView(d){
  var x = d || new Date(), day = x.getDay();
  if(day === 0 || day === 6) return true;
  var t = x.getHours() * 60 + x.getMinutes();
  return t < 570; // 9:30 之前（盘前）：显示昨日盈亏
}
function updateSummary(fRes, sRes){
  /* 「未持仓」分支：基金+股票都没添加时，三大信息区均显示占位提示，
     避免股价为 0 / 累计 -- 等空跑视觉噪音 */
  if(holdings.length === 0 && stocks.length === 0){
    $('#totalMv').textContent = '0';
    $('#holdCnt').textContent = '暂无持仓';
    $('#navDate').textContent = '添加持仓后显示最新净值';
    $('#estLabel').textContent = '盘中实时估算';
    $('#realMv').textContent = '--'; $('#estMv').textContent = '--'; $('#estDelta').textContent = '';
    $('#cumChip').style.background = ''; $('#cumChip').style.borderColor = '';
    $('#cumVal').textContent = '录入份额+成本价'; $('#cumVal').className = 'chip-val muted';
    $('#cumPct').textContent = '--'; $('#cumPct').className = 'chip-val muted';
    $('#cumRealized').textContent = '--'; $('#cumRealized').className = 'chip-val muted';
    $('#todayLabel').textContent = '今日盈亏（元）';
    $('#todayPnl').innerHTML = '<span class="big-red-main muted" style="font-size:30px;letter-spacing:2px">未持仓</span>';
    $('#pnlTime').textContent = '点击顶部「+」按钮添加持仓';
    $('#pnlFund').textContent = '未持仓'; $('#pnlFund').className = 'val muted';
    $('#pnlStock').textContent = '未持仓'; $('#pnlStock').className = 'val muted';
    var eg = $('#emptyGuide'); if(eg) eg.style.display = '';
    try{ chrome.runtime.sendMessage({type:'updateBadge', pnl: 0}); }catch(_){ /* SW 未运行也无妨 */ }
    return {combMv: 0, combPnl: 0, combPct: 0, hasPnl: false, combYtdPnl: 0, combYtdPrevMv: 0, combYtdPct: 0, yView: false};
  }
  var combMv = (fRes.totalMv || 0) + (sRes.totalMv || 0);
  var combPnl = (fRes.totalPnl || 0) + (sRes.totalPnl || 0);
  var combPrev = (fRes.prevMv || 0) + (sRes.prevMv || 0);
  var combPct = combPrev > 0 ? combPnl / combPrev * 100 : 0;
  var hasPnl = fRes.hasPnl || sRes.hasPnl;
  /* 昨日盈亏（盘前/周末显示用）：基金=市值×NAVCHGRT，股票=股数×(昨收−前收) */
  var combYtdPnl = (fRes.ytdPnl || 0) + (sRes.ytdPnl || 0);
  var combYtdPrev = (fRes.ytdPrevMv || 0) + (sRes.ytdPrevMv || 0);
  var combYtdPct = combYtdPrev > 0 ? combYtdPnl / combYtdPrev * 100 : 0;
  var yView = showYesterdayView();   // 盘前/周末 → 显示昨日盈亏

  /* 1. 主数字：持仓市值 */
  $('#totalMv').textContent = fmtNum(combMv, 0);

  /* 2. 持仓构成 + 净值基准日期（一行紧凑） */
  var fc = fRes.fundCount || 0, sc = sRes.count || 0;
  var parts = [];
  if(fc) parts.push(fc + ' 只基金');
  if(sc) parts.push(sc + ' 只股票');
  $('#holdCnt').textContent = parts.length ? parts.join(' · ') : '暂无持仓';
  $('#navDate').textContent = yView ? ('昨日净值 ' + (fRes.latestNavDate || '')) : (fRes.latestNavDate ? ('最新净值 ' + fRes.latestNavDate) : '实时估算中');
  var eg2 = $('#emptyGuide'); if(eg2) eg2.style.display = 'none';

  /* 3. 市值估算框：始终显示当前市值；盘中标注"实时估算"，收盘后标注"实际市值"
         combMv 现在是统一的"当前市值"（基金优先用 gsz，盘中是实时估算、盘后是确认净值；股票用现价）
         combPrev 是"昨收市值"，combPnl 是今日盈亏；不再用 hasPnl 门控，避免收盘无估值时整框变 -- */
  var open = isMarketOpen();
  $('#estLabel').textContent = open ? '盘中实时估算' : (yView ? '昨日市值' : '实际市值');
  if(combMv > 0){
    $('#realMv').textContent = fmtNum(combPrev, 0);   // 昨收市值（前收盘）
    $('#estMv').textContent  = fmtNum(combMv, 0);     // 当前市值（盘中=估算 / 收盘=实际）
    var deltaVal = yView ? combYtdPnl : combPnl;      // 副框与顶部卡同口径：盘前显示昨日盈亏
    if(deltaVal){
      $('#estDelta').textContent = fmtSigned(deltaVal, 0);   // 仅金额，百分比在今日盈亏卡
      $('#estDelta').style.color = clsTxt(deltaVal);
    }else{
      $('#estDelta').textContent = '';
      $('#estDelta').style.color = '';
    }
  }else{
    $('#realMv').textContent = '--';
    $('#estMv').textContent  = '--';
    $('#estDelta').textContent = '';
    $('#estDelta').style.color = '';
  }

  /* 3. 今日收益率 + 今日盈亏（合并到今日盈亏金额后括号显示，今日收益率不再有独立卡片）
        盘前/周末 yView=true 时切到"昨日盈亏"（避免空洞的今日=0） */
  var showPnl = yView ? combYtdPnl : combPnl;
  var showPct = yView ? combYtdPct : combPct;
  $('#todayLabel').textContent = yView ? '昨日盈亏（元）' : '今日盈亏（元）';
  var _bigCls = showPnl > 0 ? 'up' : (showPnl < 0 ? 'down' : '');
  $('#todayPnl').innerHTML =
    '<span class="big-red-main ' + _bigCls + '">' + fmtSigned(showPnl, 0) + '</span>' +
    '<span class="pct-tail" style="color:' + clsTxt(showPct) + '">(' + fmtPct(showPct) + ')</span>';
  /* 净值更新时间挪到 label 右侧（保留所有上下文，重仓估算/无估值数等） */
  var pnlNote = yView ? '盘前/周末显示昨日盈亏' : (fRes.anyTime ? ('净值更新时间 ' + fRes.anyTime) : '按实时估值计算');
  if(!yView && fRes.holdEstCount > 0){ pnlNote += ' · ' + fRes.holdEstCount + ' 只为重仓股估算'; }
  if(!yView && fRes.noGzCount > 0){ pnlNote += ' · ' + fRes.noGzCount + ' 只无盘中估值（晚间净值更新后计入）'; }
  if(!yView && fRes.closeEstCount > 0){ pnlNote += ' · ' + fRes.closeEstCount + ' 只显示收盘估值（净值公布后修正）'; }
  $('#pnlTime').textContent = pnlNote;
  /* 按品种拆分：基金 vs 股票（同口径随 yView 切昨日/今日）
     各自按"是否有持仓"独立判定：无持仓 → 「未持仓」灰色占位；有持仓 → 数值+颜色。
     之前 if/else 嵌套在 sRes.count 上，导致「有股票无基金」时基金那行回退成 fmtSigned(0)="0" */
  var fSplit = yView ? (fRes.ytdPnl || 0) : fRes.totalPnl;
  var sSplit = yView ? (sRes.ytdPnl || 0) : sRes.totalPnl;
  if(fRes.fundCount > 0){
    $('#pnlFund').textContent  = fmtSigned(fSplit, 0);
    $('#pnlFund').style.color  = clsTxt(fSplit);
    $('#pnlFund').className    = 'val';
  }else{
    $('#pnlFund').textContent  = '未持仓';
    $('#pnlFund').style.color  = '';
    $('#pnlFund').className    = 'val muted';
  }
  if(sRes.count > 0){
    $('#pnlStock').textContent = fmtSigned(sSplit, 0);
    $('#pnlStock').style.color = clsTxt(sSplit);
    $('#pnlStock').className   = 'val';
  }else{
    $('#pnlStock').textContent = '未持仓';
    $('#pnlStock').style.color = '';
    $('#pnlStock').className   = 'val muted';
  }
  /* 盘后基金无估值时，0 不直观 — 改为 muted "待净值" 提示 */
  if(!yView && !fRes.hasPnl && fRes.fundCount > 0 && fRes.noGzCount === fRes.fundCount && !isFundMktOpen()){
    $('#pnlFund').textContent = '—（待净值）';
    $('#pnlFund').style.color = 'var(--muted)';
    $('#pnlFund').title = fRes.noGzCount + ' 只无盘中估值，晚间净值公布后计入';
  }

  /* 5. 累计盈亏 chip（基金+股票合并口径） */
  var chip = $('#cumChip');
  var combinedCum  = (fRes.cumAll || 0) + (sRes.cum || 0);
  var combinedCost = (fRes.totalCost || 0) + (sRes.totalCost || 0);
  var hasAnyCost   = (fRes.hasCost || sRes.hasCost) && combinedCost > 0;
  if(hasAnyCost){
    var cumPctAll = (combinedCum / combinedCost) * 100;
    var cumCls = cls(combinedCum);
    if(cumCls === 'up'){
      chip.style.background = 'rgba(240,69,69,.12)';
      chip.style.borderColor = 'rgba(240,69,69,.40)';
    }else if(cumCls === 'down'){
      chip.style.background = 'rgba(47,168,120,.12)';
      chip.style.borderColor = 'rgba(47,168,120,.40)';
    }
    $('#cumVal').textContent = fmtSigned(combinedCum, 0);
    $('#cumVal').className = 'chip-val ' + cumCls;
    $('#cumPct').textContent = fmtPct(cumPctAll);
    $('#cumPct').className = 'chip-val ' + cls(cumPctAll);
  }else{
    chip.style.background = '';
    chip.style.borderColor = '';
    $('#cumVal').textContent = '录入份额+成本价';
    $('#cumVal').className = 'chip-val muted';
    $('#cumPct').textContent = '--';
    $('#cumPct').className = 'chip-val muted';
  }
  /* 已实现盈亏（落袋）：基金+股票合并，独立于 hasCost（无成本价也能记减仓收益） */
  var combinedRealized = (fRes.realizedAll || 0) + (sRes.realized || 0);
  $('#cumRealized').textContent = combinedRealized ? fmtSigned(combinedRealized, 0) : '--';
  $('#cumRealized').className = 'chip-val ' + (combinedRealized > 0 ? 'up' : (combinedRealized < 0 ? 'down' : 'muted'));
  /* 6. 角标：把今日盈亏金额推给 service worker，让工具栏图标右上角显示
        盘前/周末（yView=true）时推送昨日盈亏（顶部卡也是这个口径，避免角标=0 看着像崩了）
        SW 端 bg.js 会负责按中国股市惯例上色（红涨绿跌）和格式化（k/w） */
  try{
    var badgePnl = yView ? Math.round(combYtdPnl) : Math.round(combPnl);
    chrome.runtime.sendMessage({type:'updateBadge', pnl: badgePnl});
  }catch(_){ /* SW 未就绪/未运行也无妨，下次刷新会自动重推 */ }

  /* 回传合并口径给走势图，让「今日」那一点与顶部括号百分比一致 */
  return {combMv: combMv, combPnl: combPnl, combPct: combPct, hasPnl: hasPnl,
    combYtdPnl: combYtdPnl, combYtdPrevMv: combYtdPrev, combYtdPct: combYtdPct, yView: yView};
}

var editingStock = null;
function openStockModal(code){
  editingStock = code || null;
  var s = code ? stocks.find(function(x){ return x.code === code; }) : null;
  $('#stkModalTitle').textContent = s ? ('编辑 ' + (s.type ? classifyStockType(s.code).label + ' ' : '持仓 ') + code.replace(/^(sh|sz|hk|us)/, '')) : '添加股票 / 场内基金';
  $('#inStkCode').value = s ? s.code : '';
  $('#inStkCode').disabled = !!s;
  $('#inStkShares').value = s && s.shares ? s.shares : '';
  $('#inStkCost').value = s && s.cost ? s.cost : '';
  var sel = $('#inStkType');
  if(sel){ sel.value = (s && s.type) ? s.type : (s ? classifyStockType(s.code).cls : 'stock'); sel.dataset.touched = s ? '1' : ''; }
  $('#maskStock').classList.add('show');
  if(!s){ $('#inStkCode').focus(); }
  _renderStockRealizedRow(s);
  updateStkTypeHint();
}
/* 股票/场内品种编辑弹窗：显示「已实现盈亏 / 操作次数」（新增时整行隐藏） */
function _renderStockRealizedRow(s){
  var row = $('#realizedRowStk'); if(!row) return;
  if(!s){ row.style.display = 'none'; return; }
  row.style.display = '';
  var rv = $('#realizedValStk'), tv = $('#tCountValStk');
  var r = s.realized || 0, t = s.tCount || 0;
  if(rv){
    rv.textContent = r ? (r > 0 ? '+' : '') + r.toFixed(2) + ' 元' : '0.00 元';
    rv.className = 'val ' + (r > 0 ? 'up' : (r < 0 ? 'down' : ''));
  }
  if(tv) tv.textContent = t + ' 次';
}
/* 清零当前编辑股票/场内品种的「已实现盈亏 / 操作次数」（不动持股数与成本价） */
function clearRealizedStk(){
  if(!editingStock) return;
  var s = stocks.find(function(x){ return x.code === editingStock; });
  if(!s) return;
  if(!(s.realized || 0) && !(s.tCount || 0)){ toast('本来就是 0，无需清零'); return; }
  if(!confirm('把 ' + s.code + ' 的「已实现盈亏 ' + (s.realized || 0).toFixed(2) + ' 元 / 操作次数 '
              + (s.tCount || 0) + ' 次」清零？\n（持股数与成本价不变）')) return;
  s.realized = 0; s.tCount = 0;
  saveStocks(); _renderStockRealizedRow(s); refreshAll();
  toast('已清零 ' + s.code + ' 的已实现与操作次数');
}
function closeStockModal(){
  $('#maskStock').classList.remove('show');
  $('#inStkCode').value=''; $('#inStkCode').disabled=false;
  $('#inStkShares').value=''; $('#inStkCost').value='';
  var sel = $('#inStkType'); if(sel){ sel.value='stock'; sel.dataset.touched=''; }
  var hint = $('#stkTypeHint'); if(hint){ hint.innerHTML=''; hint.className='stk-type-hint'; }
  var _rrs = $('#realizedRowStk'); if(_rrs) _rrs.style.display = 'none';
  editingStock = null;
}
/* 输入代码实时识别品种，并更新类型下拉默认值（用户未手动改过时） */
function updateStkTypeHint(){
  var hint = $('#stkTypeHint'); if(!hint) return;
  var raw = ($('#inStkCode').value || '').trim();
  var sel = $('#inStkType');
  if(!raw){ hint.className='stk-type-hint'; hint.innerHTML=''; if(sel) sel.dataset.touched=''; return; }
  var nc = normStockCode(raw);
  if(!nc){ hint.className='stk-type-hint bad'; hint.innerHTML='⚠ 无法识别，请输入 A股6位 / 港股 00000.HK / 北交所 920799(旧8xx自动转920) / 美股 AAPL'; if(sel) sel.dataset.touched=''; return; }
  var t = classifyStockType(nc);
  hint.className='stk-type-hint ok';
  hint.innerHTML='识别为：<b>' + t.label + '</b>（' + t.exchName + '）';
  if(sel && !sel.dataset.touched){ sel.value = t.cls; }
}
/* 类型标签小胶囊（渲染表格用） */
function typeTag(cls){
  var map = {stock:'股票', etf:'ETF', lof:'LOF', reits:'REITs', bond:'可转债', fund:'基金', other:'其他', hk:'港股', us:'美股', bj:'北交所'};
  return '<span class="tag tag-' + (cls || 'other') + '">' + (map[cls] || '其他') + '</span>';
}
function saveStock(){
  var code = editingStock || normStockCode($('#inStkCode').value);
  if(!code){ alert('请输入 6 位代码（股票 / ETF / LOF / 可转债等场内品种均可）'); return; }
  var shares = parseFloat($('#inStkShares').value);
  var cost = parseFloat($('#inStkCost').value);
  if(isNaN(shares) || shares <= 0){ alert('请输入有效的持仓数量'); return; }
  var sel = $('#inStkType');
  var type = (sel && sel.value) ? sel.value : classifyStockType(code).cls;
  var oldS = stocks.find(function(s){ return s.code === code; });
  var entry = { code: code, shares: shares, cost: (!isNaN(cost) && cost > 0) ? cost : null, type: type,
    realized: oldS ? (oldS.realized || 0) : 0, tCount: oldS ? (oldS.tCount || 0) : 0 };
  var idx = -1;
  stocks.forEach(function(s, i){ if(s.code === code) idx = i; });
  if(editingStock){
    if(idx < 0){ alert('未找到该股票'); return; }
    stocks[idx] = entry;
  }else{
    if(idx >= 0){ alert('该股票已在持仓中，请使用「编辑」'); return; }
    stocks.push(entry);
  }
  saveStocks(); closeStockModal(); refreshAll();
}
function delStock(code){
  if(!confirm('确认删除股票 ' + code.replace(/^(sh|sz|hk|us)/, '') + '？')) return;
  stocks = stocks.filter(function(s){ return s.code !== code; });
  delete stockInfo[code];
  saveStocks(); refreshAll();
}

/* ================= 统一添加持仓（自动识别 场外基金 / 场内品种） ================= */
var addState = {status:'empty', fundName:null, stkKey:null, stkName:null, kind:null};
/* 异步确认该 6 位代码是否为场外基金（东财移动端接口）。返回名称或 null。
   设计：先走 SW（与主刷新同款、已验证可拿到 fundmobapi）→ SW 失败/超时 → 页面 fetch 直连兜底
   （fundmobapi ACAO: * 已验证可通）。全程打 [ext-ident] 日志供排查。 */
function fetchFundExists(code){
  var url = 'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=1&plat=Android&appType=ttjj&product=EFund&Version=1&deviceid=fundboard&Fcodes=' + code;
  function identLog(){
    var a = Array.prototype.slice.call(arguments);
    try{ console.log.apply(console, ['[ext-ident]'].concat(a)); }catch(_){}
  }
  function tryDirect(finish){
    try{
      var ctrl = new AbortController();
      var to = setTimeout(function(){ try{ ctrl.abort(); }catch(_){} }, 6000);
      fetch(url, {credentials:'omit', signal: ctrl.signal}).then(function(r){
        clearTimeout(to);
        if(!r.ok){ identLog('直连非2xx', r.status); finish(null); return; }
        return r.text();
      }).then(function(txt){
        if(!txt) return;
        try{
          var j = JSON.parse(txt), d = j && j.Datas && j.Datas[0];
          identLog('直连成功', d && d.SHORTNAME);
          finish(d && d.SHORTNAME ? d.SHORTNAME : null);
        }catch(e){ identLog('直连解析失败', e && e.message); finish(null); }
      }).catch(function(e){ identLog('直连异常', e && e.message); finish(null); });
    }catch(e){ identLog('直连不可用', e && e.message); finish(null); }
  }
  return new Promise(function(resolve){
    var done = false;
    var finish = function(n){ if(!done){ done = true; identLog('最终结果', n); resolve(n); } };
    if(chrome && chrome.runtime && chrome.runtime.sendMessage){
      var settled = false;
      var to = setTimeout(function(){ if(!settled){ settled = true; identLog('SW 超时→转直连'); tryDirect(finish); } }, 5000);
      try{
        chrome.runtime.sendMessage({type:'xfetch', url: url}, function(r){
          if(settled) return;
          settled = true; clearTimeout(to);
          var e = chrome.runtime.lastError;
          if(e){ identLog('SW lastError', e.message); tryDirect(finish); return; }
          if(!r || !r.ok){ identLog('SW 失败', r && r.error); tryDirect(finish); return; }
          try{
            var j = JSON.parse(r.body), d = j.Datas && j.Datas[0];
            identLog('SW 成功', d && d.SHORTNAME, '| UA=', r.ua);
            finish(d && d.SHORTNAME ? d.SHORTNAME : null);
          }catch(err){ identLog('SW 解析失败', err && err.message); tryDirect(finish); }
        });
      }catch(err){ clearTimeout(to); settled = true; tryDirect(finish); }
    }else{
      tryDirect(finish);
    }
    setTimeout(function(){ if(!done){ identLog('总超时'); finish(null); } }, 11000);
  });
}
/* 异步确认该代码是否为可交易品种，返回腾讯代码 + 名称。
   港股/美股（nc 以 hk/us 开头）直接探对应腾讯代码；A 股则双向探测 sh/sz 前缀。
   命中同时带回名字，供弹窗展示与入库。 */
function probeStock(raw){
  return new Promise(function(resolve){
    var nc = normStockCode(raw);
    var ks = (/^(hk|us|bj)/.test(nc || '')) ? [nc] : ['sh' + (raw || ''), 'sz' + (raw || '')];
    fetchTencent(ks).then(function(out){
      var hit = ks.filter(function(k){ return out[k]; })[0];
      resolve(hit ? {key: hit, name: out[hit].name || hit} : null);
    }).catch(function(){ resolve(null); });
  });
}
function onAddCodeInput(){
  var raw = ($('#inAddCode').value || '').trim();
  var box = $('#addIdentResult');
  function resetEmpty(){
    addState = {status:'empty', fundName:null, stkKey:null, stkName:null, kind:null};
    box.innerHTML = '';
    box.className = 'add-ident';
    $('#addFundFields').classList.remove('show');
    $('#addStkFields').classList.remove('show');
  }
  var nc = normStockCode(raw);
  if(!nc){ resetEmpty(); return; }
  box.className = 'add-ident';
  box.innerHTML = '<span class="ident-loading">识别中…</span>';
  $('#addFundFields').classList.remove('show');
  $('#addStkFields').classList.remove('show');
  /* 港股 / 美股 / 北交所：腾讯直接探，跳过东财基金库（基金库只收 A 股基金） */
  if(/^hk|^us|^bj/.test(nc)){
    probeStock(raw).then(function(stkRes){
      var stkKey = stkRes && stkRes.key ? stkRes.key : null;
      var stkName = stkRes && stkRes.name ? stkRes.name : null;
      addState.fundName = null; addState.stkKey = stkKey; addState.stkName = stkName;
      if(stkKey){
        addState.status = 'stock'; addState.kind = 'stock';
        var t = classifyStockType(stkKey);
        box.innerHTML = '<span class="ident-card"><span class="ident-type">'+escHtml(t.label)+' · '+escHtml(t.exchName)+'</span><span class="ident-name">'+escHtml(stkName || '—')+'</span></span>';
      }else{
        addState.status = 'none'; addState.kind = null;
        box.className = 'add-ident ident-bad';
        var _kind = nc[0]==='h' ? '港股' : (nc[0]==='u' ? '美股' : '北交所');
        box.innerHTML = '<span>未找到该'+_kind+'代码，请确认输入</span>';
      }
      setAddFields();
    }).catch(function(){
      addState.status = 'none'; addState.kind = null;
      box.className = 'add-ident ident-bad';
      box.innerHTML = '<span>识别服务暂时不可用，请稍后重试</span>';
    });
    return;
  }
  /* A 股：基金库 + 腾讯双向探测（原逻辑） */
  Promise.all([fetchFundExists(raw), probeStock(raw)]).then(function(res){
    var fName = res[0];
    var stkRes = res[1] || {};
    var stkKey = stkRes.key || null;
    var stkName = stkRes.name || null;
    // 东财基金库会把场内 ETF 也当「基金」收录（名字含 ETF），与腾讯识别的是同一只场内证券，
    // 不应再提供「场外基金」选项。仅当腾讯识别为 LOF / 场内基金（真双通道）时才保留双选。
    var stkCls = stkKey ? classifyStockType(stkKey).cls : null;
    if(fName && /ETF|交易型/i.test(fName) && stkCls && stkCls !== 'lof' && stkCls !== 'fund'){
      fName = null;
    }
    addState.fundName = fName; addState.stkKey = stkKey; addState.stkName = stkName;
    if(fName && stkKey){
      addState.status = 'both';
      if(addState.kind !== 'stock') addState.kind = 'fund';
      var stkLbl = classifyStockType(stkKey).label;
      box.innerHTML = '<span class="ident-hint">命中 2 项，请选择类型：</span>'
        + '<span class="seg-group">'
        +   '<span class="seg '+(addState.kind==='fund'?'active':'')+'" data-act="selectAddKind" data-args=\'["fund"]\'><span class="seg-type">场外基金</span><span class="seg-nm">'+(fName?escHtml(fName):'—')+'</span></span>'
        +   '<span class="seg '+(addState.kind==='stock'?'active':'')+'" data-act="selectAddKind" data-args=\'["stock"]\'><span class="seg-type">'+escHtml(stkLbl)+'</span><span class="seg-nm">'+(stkName?escHtml(stkName):'—')+'</span></span>'
        + '</span>';
    }else if(fName){
      addState.status = 'fund'; addState.kind = 'fund';
      box.innerHTML = '<span class="ident-card"><span class="ident-type">场外基金</span><span class="ident-name">'+escHtml(fName)+'</span></span>';
    }else if(stkKey){
      addState.status = 'stock'; addState.kind = 'stock';
      var t = classifyStockType(stkKey);
      box.innerHTML = '<span class="ident-card"><span class="ident-type">'+escHtml(t.label)+' · '+escHtml(t.exchName)+'</span><span class="ident-name">'+escHtml(stkName || '—')+'</span></span>';
    }else{
      addState.status = 'none'; addState.kind = null;
      box.className = 'add-ident ident-bad';
      box.innerHTML = '<span>未找到该代码，请确认输入的是 6 位场内 / 场外代码</span>';
    }
    setAddFields();
  }).catch(function(){
    addState.status = 'none'; addState.kind = null;
    box.className = 'add-ident ident-bad';
    box.innerHTML = '<span>识别服务暂时不可用，请稍后重试</span>';
  });
}
function setAddFields(){
  var fund = addState.kind === 'fund';
  $('#addFundFields').classList.toggle('show', fund);
  $('#addStkFields').classList.toggle('show', !fund);
  if(!fund && addState.stkKey){
    var sel = $('#inAddStkType'); if(sel) sel.value = classifyStockType(addState.stkKey).cls;
  }
}
function selectAddKind(kind){
  if(addState.status !== 'both') return;
  addState.kind = kind;
  // 同步 segmented pill 高亮
  var grp = document.querySelector('#addIdentResult .seg-group');
  if(grp){
    grp.querySelectorAll('.seg').forEach(function(s){
      var want = (s.getAttribute('data-args')||'').indexOf('"'+kind+'"') >= 0;
      s.classList.toggle('active', want);
    });
  }
  setAddFields();
}
function openAddModal(){
  $('#addTitle').firstElementChild.textContent = '添加持仓';
  $('#inAddCode').value = '';
  $('#inAddName').value = ''; $('#inAddShares').value = ''; $('#inAddCost').value = ''; $('#inAddAmount').value = '';
  $('#inAddStkShares').value = ''; $('#inAddStkCost').value = '';
  $('#inAddStkType').value = 'stock';
  addState = {status:'empty', fundName:null, stkKey:null, stkName:null, kind:null};
  var box = $('#addIdentResult'); box.className = 'add-ident'; box.innerHTML = '';
  $('#addFundFields').classList.remove('show');
  $('#addStkFields').classList.remove('show');
  $('#maskAdd').classList.add('show');
  setTimeout(function(){ $('#inAddCode').focus(); }, 30);
}
function closeAddModal(){
  $('#maskAdd').classList.remove('show');
}
function saveAdd(){
  var code = ($('#inAddCode').value || '').trim();
  if(!normStockCode(code)){ alert('请输入有效代码（A股6位 / 港股 00000.HK / 北交所 920799 / 美股 AAPL）'); return; }
  if(addState.status === 'empty' || addState.status === 'none'){ alert('未能识别该代码，请检查后重试'); return; }
  if(addState.status === 'both' && !addState.kind){ alert('请选择「场外基金」或「场内交易」'); return; }
  if(addState.kind === 'fund'){
    var shares = parseFloat($('#inAddShares').value);
    var cost = parseFloat($('#inAddCost').value);
    var amount = parseFloat($('#inAddAmount').value);
    var name = ($('#inAddName').value || '').trim() || addState.fundName || undefined;
    var hasShares = !isNaN(shares) && shares > 0;
    if(!hasShares && (isNaN(amount) || amount <= 0)){ alert('请填写「持有份额」或「持有市值」至少一项'); return; }
    var entry = {code: code, name: name,
      shares: hasShares ? shares : null,
      cost: (hasShares && !isNaN(cost) && cost > 0) ? cost : null,
      amount: (!isNaN(amount) && amount > 0) ? amount : null};
    var idx = -1; holdings.forEach(function(h, i){ if(h.code === code) idx = i; });
    if(idx >= 0){ alert('该基金已在持仓中，请使用「编辑」'); return; }
    holdings.push(entry); saveHoldings(); closeAddModal(); refreshAll();
  }else{
    var kc = addState.stkKey; if(!kc){ alert('未能识别为场内品种'); return; }
    var sShares = parseFloat($('#inAddStkShares').value);
    var sCost = parseFloat($('#inAddStkCost').value);
    if(isNaN(sShares) || sShares <= 0){ alert('请输入有效的持仓数量'); return; }
    var sel = $('#inAddStkType');
    var type = (sel && sel.value) ? sel.value : classifyStockType(kc).cls;
    // 名号优先取腾讯探测返回值（与 onAddCodeInput 同源，避免字段缺名）
    var stkName = addState.stkName || undefined;
    var entry2 = {code: kc, name: stkName, shares: sShares, cost: (!isNaN(sCost) && sCost > 0) ? sCost : null, type: type};
    var idx2 = -1; stocks.forEach(function(s, i){ if(s.code === kc) idx2 = i; });
    if(idx2 >= 0){ alert('该品种已在持仓中，请使用「编辑」'); return; }
    stocks.push(entry2); saveStocks(); closeAddModal(); refreshAll();
  }
}

/* ================= 提醒功能 ================= */
var ALERT_KEY = 'fund_board_alerts_v1';
var alerts = (function(){
  var defs = {pct:3, overrides:{}, stockOverrides:{}, notice:true, stockNotice:true, sound:true, notify:false, autoMin:0, stockMuted:{}, fundMuted:{},
              commRateW:2.5, minComm:5, stampTaxW:5, fundRateW:10};  /* 交易成本：佣金费率/最低佣金/卖出印花税/基金申购费率，单位均为「万分之」与「元」 */
  try{
    var a = JSON.parse(localStorage.getItem(ALERT_KEY));
    if(a && a.settings){
      /* 老设置缺新字段时补默认值，避免升级后 fundRateW 等变成 undefined → 0 */
      Object.keys(defs).forEach(function(k){
        if(a.settings[k] === undefined) a.settings[k] = defs[k];
      });
      return a;
    }
  }catch(e){}
  return {settings:defs, log:[], seenNotice:{}, seenStockNotice:{}, fired:{}};
})();
migrateAlertLog();   /* 启动即清理旧版本误存的时间戳记录（如 "71-11"） */
function saveAlerts(){ try{ localStorage.setItem(ALERT_KEY, JSON.stringify(alerts)); }catch(e){ console.error('[ext] saveAlerts 失败:', e && e.message || e); toast('提醒设置保存失败：存储已满或隐私模式'); } }

function updateAlertBadge(){
  var n = alerts.log.filter(function(x){ return !x.read; }).length;
  var b = $('#alertBadge');
  b.style.display = n > 0 ? '' : 'none';
  b.textContent = n > 99 ? '99+' : n;
}
function beep(){
  if(!alerts.settings.sound) return;
  try{
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var ctx = beep._ctx || (beep._ctx = new Ctx());
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.07;
    o.start(); setTimeout(function(){ o.stop(); }, 200);
  }catch(e){}
}
function pushNotify(title, body){
  if(!alerts.settings.notify) return;
  /* 扩展环境优先用原生 chrome.notifications：无需网页授权、标签页在后台也能弹、更可靠；
     manifest 已声明 notifications 权限。普通网页（file:// 等）回退到 Web Notification。 */
  try{
    if(typeof chrome !== 'undefined' && chrome.notifications && chrome.notifications.create){
      var nid = 'alert_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      var icon = (chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('icon48.png') : '';
      chrome.notifications.create(nid, {
        type: 'basic', iconUrl: icon, title: title, message: body, priority: 2
      }, function(){ if(chrome.runtime && chrome.runtime.lastError){ /* 忽略 */ } });
      return;
    }
  }catch(e){}
  /* 回退：网页 Notification API（file:// 下浏览器通常禁止授权，会静默失败） */
  if(!('Notification' in window)) return;
  if(Notification.permission !== 'granted') return;
  try{ new Notification(title, {body: body}); }catch(e){}
}
function fmtAlertTime(epoch){
  if(!epoch || isNaN(epoch)) return null;
  var d = new Date(epoch);
  if(isNaN(d.getTime())) return null;
  var p = function(n){ return ('0'+n).slice(-2); };
  return p(d.getMonth()+1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
/* 旧版本时间戳格式各异（如误存的 "71-11"），无 epoch 且格式非法则丢弃，避免显示乱码 */
function migrateAlertLog(){
  if(!alerts.log || !alerts.log.length) return;
  var valid = /^(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
  var keep = [], dropped = 0;
  alerts.log.forEach(function(x){
    if(x.epoch){ keep.push(x); return; }
    var m = x.time && x.time.match(valid);
    if(m){
      var MM=+m[1], DD=+m[2], HH=+m[3], MI=+m[4];
      if(MM>=1&&MM<=12&&DD>=1&&DD<=31&&HH<=23&&MI<=59){ keep.push(x); return; }
    }
    dropped++;
  });
  if(dropped){ alerts.log = keep; saveAlerts(); }
}
function addAlert(msg, silent, opts){
  var now = new Date();
  var epoch = now.getTime();
  var ts = ('0'+(now.getMonth()+1)).slice(-2) + '-' + ('0'+now.getDate()).slice(-2) + ' ' + now.toTimeString().slice(0,5);
  var entry = {time: ts, epoch: epoch, msg: msg, read: false};
  /* 公告类提醒携带 opts.notice = {code(artCode), title, pureCode, nm},
     渲染时整行变可点 → 弹窗查看详情。其它类型不传 opts,与原行为一致。 */
  if(opts && opts.kind === 'notice' && opts.notice){ entry.kind = 'notice'; entry.notice = opts.notice; }
  alerts.log.unshift(entry);
  if(alerts.log.length > 100) alerts.log.length = 100;
  saveAlerts(); updateAlertBadge();
  if(!silent){ beep(); pushNotify('持仓看板提醒', msg); }
}

/* 涨跌幅检查（refreshAll 渲染后调用） */
function checkPriceAlerts(){
  var S = alerts.settings;
  var today = new Date();
  var ds = today.getFullYear() + '-' + ('0'+(today.getMonth()+1)).slice(-2) + '-' + ('0'+today.getDate()).slice(-2);
  /* 今日数据白名单：盘中实时估算(official/sina/holding)、今日收盘估值(close)、今日 NAV 已公布(nav)。
     排除 yNav（昨日涨跌幅兜底）和 cacheOld（旧缓存估算）—— 这些都不是"今天的盘中变动"，
     在盘前/午休/收盘后/周末/凌晨未开盘时段会被写进来，跨日后再用就会误触发「涨跌幅超阈值」提醒。 */
  var FUND_LIVE_TYPES = {official:1, sina:1, holding:1, close:1, nav:1};
  var todayYmd = today.getFullYear() + ('0'+(today.getMonth()+1)).slice(-2) + ('0'+today.getDate()).slice(-2);
  holdings.forEach(function(h){
    if(alerts.settings.fundMuted && alerts.settings.fundMuted[h.code]) return;  /* 已停提醒的基金跳过 */
    var info = fundInfo[h.code];
    if(!info || info.gszzl === null || isNaN(info.gszzl)) return;
    /* 仅当数据来源是"今日实时"才参与提醒；yNav/cacheOld 等昨日涨跌幅兜底数据被排除 */
    if(!FUND_LIVE_TYPES[info.estType]) return;
    /* 进一步：nav 类型若 navDate 不是今天，说明是昨日 NAV（夜间/盘前跨日），同样视作陈旧跳过；
       避免凌晨 0:00-9:30、午休、跨日窗口里用"昨日 NAV 涨跌幅"反复触发提醒。 */
    if(info.estType === 'nav' && info.navDate && info.navDate !== ds) return;
    var th = (S.overrides[h.code] !== undefined && S.overrides[h.code] !== null) ? S.overrides[h.code] : S.pct;
    if(!th || th <= 0) return;
    var pct = Number(info.gszzl);
    if(Math.abs(pct) >= th){
      var dir = pct > 0 ? 'up' : 'down';
      var f = alerts.fired[h.code];
      if(!(f && f.date === ds && f.dir === dir)){ /* 同方向当天只提醒一次 */
        alerts.fired[h.code] = {date: ds, dir: dir};
        addAlert((info.name || h.code) + '（' + h.code + '）估算涨幅 ' + fmtPct(pct) + '，' + (pct > 0 ? '超过' : '跌破') + '阈值 ±' + th + '%');
      }
    }
  });
  /* 股票：实时涨幅超阈值同样提醒；优先用单股票阈值，否则用全局阈值。
     个股 pct 来自腾讯 qt.gtimg.cn 的 p[3]/p[4]，由 p[30] 时间戳判定数据日期。
     跨日（含凌晨）若仍显示昨日 pct，是接口陈旧残留，应跳过以避免"用昨日涨跌幅提醒"。 */
  stocks.forEach(function(s){
    if(alerts.settings.stockMuted && alerts.settings.stockMuted[s.code]) return;  /* 已停提醒的股票跳过 */
    var q = stockInfo[s.code];
    if(!q || q.pct === null || q.pct === undefined || isNaN(q.pct)) return;
    /* 个股不暴露 estType，用 q.time(Ymd8) 与 todayYmd 比对，过滤掉昨日残留 */
    var qYmd = (q.time && /^\d{8}/.test(''+q.time)) ? (''+q.time).slice(0, 8) : '';
    if(qYmd && qYmd !== todayYmd) return;
    var ov = (S.stockOverrides && S.stockOverrides[s.code] !== undefined && S.stockOverrides[s.code] !== null) ? S.stockOverrides[s.code] : S.pct;
    var th = ov;
    if(!th || th <= 0) return;
    var pct = Number(q.pct);
    if(Math.abs(pct) >= th){
      var dir = pct > 0 ? 'up' : 'down';
      var key = 'S_' + s.code;
      var f = alerts.fired[key];
      if(!(f && f.date === ds && f.dir === dir)){
        alerts.fired[key] = {date: ds, dir: dir};
        addAlert((q.name || s.code) + '（' + s.code.replace(/^(sh|sz|hk|us)/, '') + '）实时涨幅 ' + fmtPct(pct) + '，' + (pct > 0 ? '超过' : '跌破') + '阈值 ±' + th + '%');
      }
    }
  });
}

/* 公告检查（东财搜索 JSONP，无需 Referer）
   kind='fund'  遍历 holdings,    存 seenNotice / 允许全匹配 (沿用旧行为);
   kind='stock' 遍历 stocks,      存 seenStockNotice / 用 stockInfo.name 过滤 noise
                                    (搜索接口把股票代码当关键词可能命中"重仓股里包含该股"的基金公告，
                                     这种 noise 必须按 securityShortName 与股票简称严格比对剔除) */
async function checkNoticeAlerts(kind){
  var S = alerts.settings;
  if(kind === 'fund'){ if(!S.notice) return; }
  else if(kind === 'stock'){ if(!S.stockNotice) return; }
  else { return; }
  var today = new Date();
  var ds = today.getFullYear() + '-' + ('0'+(today.getMonth()+1)).slice(-2) + '-' + ('0'+today.getDate()).slice(-2);
  var items, getName;
  if(kind === 'fund'){
    items = holdings;
    getName = function(h){ return (fundInfo[h.code] && fundInfo[h.code].name) || h.code; };
  }else{
    items = stocks;
    getName = function(s){
      var q = stockInfo[s.code];
      return (q && q.name) || s.code.replace(/^(sh|sz|hk|us)/,'');
    };
  }
  var seenMap = (kind === 'fund') ? 'seenNotice' : 'seenStockNotice';
  if(!alerts[seenMap]) alerts[seenMap] = {};
  for(var i = 0; i < items.length; i++){
    var it = items[i];
    var code = it.code;
    if(/^(hk|us)/.test(code)) continue; // 港股/美股公告源未接入，本轮暂不触发公告提醒
    var pureCode = String(code).replace(/^(sh|sz|hk|us)/, '');
    try{
      var param = {uid:'', keyword:pureCode, type:['notice'], client:'web', clientVersion:'curr', clientType:'web',
                   param:{notice:{pageIndex:1, pageSize:5}}};
      var d = await jsonp('https://search-api-web.eastmoney.com/search/jsonp', {param: JSON.stringify(param)});
      var list = (d && d.result && d.result.notice) || [];
      var seen = alerts[seenMap][code] || [];
      var firstTime = !alerts[seenMap][code];
      var selfName = getName(it);
      var fresh = [];
      list.forEach(function(n){
        if(!n || !n.code || !n.title) return;
        /* 严格匹配过滤（股票 + 基金共用）：剔除"重仓股里出现该股 / 办公地址邮编含此基金代码 / 财报科目序号"等 noise。
           搜索接口按纯文本关键词搜，对基金代码同样会命中无关股票公告（公司办公地址邮编 110022、报表科目 110022 等），
           必须用 securityShortName 严格对齐持仓简称才放行。fundInfo[code].name 取自 fundmobapi SHORTNAME，
           与搜索 securityShortName 同一短名体系，可严格比对。 */
        if((kind === 'stock' || kind === 'fund') && selfName){
          var sn = String(n.securityShortName || '').trim();
          if(!sn || sn !== selfName) return;
        }
        var key = n.code + '|' + n.title; /* 公告内部ID+标题 去重 A/C 份额重复公告 */
        if(seen.indexOf(key) < 0){
          seen.push(key);
          if(!firstTime || String(n.date || '').slice(0,10) === ds){ fresh.push(n); }
        }
      });
      alerts[seenMap][code] = seen.slice(-50);
      fresh.forEach(function(n){
        var nm = getName(it);
        addAlert(nm + '（' + pureCode + '）发布新公告:《' + n.title + '》', false, {
          kind: 'notice',
          notice: {
            code: n.code,
            title: n.title,
            pureCode: pureCode,
            nm: nm,
            date: n.date || ''
          }
        });
      });
    }catch(e){ /* 公告源失败不影响其他功能 */ }
  }
  saveAlerts();
}

/* 自动刷新 */
var autoTimer = null;
function applyAuto(){
  if(autoTimer){ clearInterval(autoTimer); autoTimer = null; }
  var m = Number(alerts.settings.autoMin) || 0;
  if(m > 0){
    /* 即便标签页在后台（document.hidden）也照常刷新+检查：通知需要在标签页开着（哪怕最小化/后台）时触发；
       不再因隐藏而跳过，保证价格异动/公告提醒不漏。 */
    autoTimer = setInterval(function(){
      refreshAll();
    }, m * 60000);
  }
}
/* 后台切回前台：立即补刷一次（之前后台期间漏掉的数据一次性追回） */
document.addEventListener('visibilitychange', function(){
  if(!document.hidden && autoTimer){ refreshAll(); }
});

/* 提醒面板 */
function openAlerts(){
  $('#setPct').value = alerts.settings.pct;
  $('#setAuto').value = String(alerts.settings.autoMin || 0);
  $('#setNotice').checked = !!alerts.settings.notice;
  $('#setStockNotice').checked = alerts.settings.stockNotice !== false;  /* 默认 true，老用户升级启用 */
  $('#setSound').checked = !!alerts.settings.sound;
  $('#setNotify').checked = !!alerts.settings.notify;
  $('#setCommRateW').value = (alerts.settings.commRateW != null) ? alerts.settings.commRateW : 2.5;
  $('#setMinComm').value = (alerts.settings.minComm != null) ? alerts.settings.minComm : 5;
  $('#setStampTaxW').value = (alerts.settings.stampTaxW != null) ? alerts.settings.stampTaxW : 5;
  $('#setFundRateW').value = (alerts.settings.fundRateW != null) ? alerts.settings.fundRateW : 10;
  /* 单基金/股票阈值列表（合并了原顶部"仅停提醒"芯片：每行可直接 × 停提醒 / 停后变"恢复"） */
  $('#cntFund').textContent = holdings.length;
  $('#cntStock').textContent = stocks.length;
  renderAlertRows();
  /* 默认切回基金 tab（避免上次手动切到股票忘了切回去） */
  setAlertThTab('fund');
  renderAlertLog();
  updatePctHint();
  updateNotifyState();
  $('#maskAlert').classList.add('show');
  window._alertSnap = serializeAlertForm();
  updateSaveBtn();
  /* 打开面板即全部已读 */
  alerts.log.forEach(function(x){ x.read = true; });
  saveAlerts();
  setTimeout(updateAlertBadge, 300);
}
/* 单品种阈值 tab 切换：基金 <-> 股票 */
function setAlertThTab(kind){
  var tabs = document.querySelectorAll('#alertThTabs button');
  tabs.forEach(function(btn){ btn.classList.toggle('active', btn.getAttribute('data-args') === '["' + kind + '"]'); });
  document.getElementById('alertFundPanel').classList.toggle('active', kind === 'fund');
  document.getElementById('alertStockPanel').classList.toggle('active', kind === 'stock');
}
function renderAlertLog(){
  var html = '';
  alerts.log.forEach(function(x){
    var t = fmtAlertTime(x.epoch) || (x.time || '');
    var isOld = !x.epoch && x.time && !/^\d{2}-\d{2} \d{2}:\d{2}$/.test(x.time);
    var rowCls = 'alert-item' + (x.read ? '' : ' unread') + (isOld ? ' old' : '');
    var time = '<span class="t">' + escHtml(t) + '</span>';
    var body;
    if(x.kind === 'notice' && x.notice && x.notice.code){
      /* 新结构条目（带 artCode）→ 弹窗内联详情 */
      rowCls += ' notice';
      var argsJson = escHtml(JSON.stringify([x.notice.code, x.notice.title || '', x.notice.nm || '', x.notice.pureCode || '', x.notice.date || '']));
      body = time + escHtml(x.msg) + ' <span class="notice-tail">查看详情 ›</span>';
      html += '<div class="' + rowCls + '" data-act="openNotice" data-args=\'' + argsJson + '\'>' + body + '</div>';
    }else if(x.msg && /发布新公告/.test(x.msg)){
      /* 旧条目（v49 前只存了标题，无 artCode）→ 点击按标题到东财搜索，至少能打开看到内容 */
      rowCls += ' notice';
      var mt = x.msg.match(/《(.+?)》/);
      var kw = mt ? mt[1] : x.msg;
      var kwJson = escHtml(JSON.stringify([kw]));
      body = time + escHtml(x.msg) + ' <span class="notice-tail">查看详情 ›</span>';
      html += '<div class="' + rowCls + '" data-act="openNoticeSearch" data-args=\'' + kwJson + '\'>' + body + '</div>';
    }else{
      html += '<div class="' + rowCls + '">' + time + escHtml(x.msg) + '</div>';
    }
  });
  $('#alertLog').innerHTML = html || '<div class="muted" style="padding:12px 4px">暂无提醒记录</div>';
}

/* ========== 公告详情弹窗（点提醒记录里公告行弹出；正文走 SW 中转拉东财 detail 接口） ==========
   入口：openNotice(artCode, title, nm, pureCode, date)
   流程：1. 弹窗骨架 + loading；2. 调 fetchNoticeBody(artCode) 拉详情 JSON；3. 解析正文后渲染；
        4. 失败：渲染错误块 + 重试 / 打开原文 链接。
   原文链接始终可用（兜底）：https://data.eastmoney.com/notices/detail/{artCode}.html（东财官方公告详情页） */
var noticeCtx = null; /* 当前打开的公告上下文，便于"重试"按钮复用 */

async function openNotice(artCode, title, nm, pureCode, date){
  artCode = String(artCode || '').trim();
  if(!artCode){ toast('该公告缺少详情编号'); return; }
  noticeCtx = {artCode: artCode, title: title || '', nm: nm || '', pureCode: pureCode || '', date: date || '', attachUrl: null};
  $('#noticeTitle').textContent = title || ('公告详情 ' + artCode);
  var meta = [];
  if(nm || pureCode){
    meta.push('<span class="nm">' + escHtml(nm || '') + '</span><span>（' + escHtml(pureCode || '') + '）</span>');
  }
  if(date){ meta.push('<span>' + escHtml(date) + '</span>'); }
  meta.push('<span>art_code: ' + escHtml(artCode) + '</span>');
  $('#noticeMeta').innerHTML = meta.join('');
  $('#noticeBody').innerHTML = '<div class="notice-loading">正在加载公告正文…</div>';
  /* 「打开原文」按钮初始态：拉取中、禁用；拿到 PDF 链接后再放出来并设 href。 */
  var orig = $('#noticeOriginal');
  orig.removeAttribute('data-artcode');
  orig.removeAttribute('data-attach');
  orig.href = '#';
  orig.setAttribute('aria-disabled', 'true');
  orig.textContent = '正在加载 PDF 链接…';
  $('#maskNotice').classList.add('show');
  /* 异步拉详情 */
  fetchNoticeBody(artCode).then(function(res){
    var html = res && res.html;
    var attachUrl = res && res.attachUrl;
    if(!html){ renderNoticeError('公告正文为空'); updateOrigBtn(orig, attachUrl); renderNoticeSummary(null); return; }
    /* 东财正文常带完整 <html>...</html>，内含 <head> 与样式资源。简单做法：整段塞进我们的弹层会被弹层样式覆盖掉，
       因此只提取 <body> 内部（如果存在），否则整段。保留 img / table / p / h2 等基础元素样式在 .notice-body 已有覆盖。 */
    var bodyHtml = extractBodyHtml(html);
    $('#noticeBody').innerHTML = bodyHtml;
    /* 速读卡片：从原始 html（stripHtml 内部已完成）提炼类型+关键数字/事件；
       失败返回 null → renderNoticeSummary 隐藏卡片（弹窗行为完全不变）。 */
    renderNoticeSummary(noticeSummarizer.summarize(title, html));
    updateOrigBtn(orig, attachUrl);
    if(attachUrl){ noticeCtx.attachUrl = attachUrl; orig.setAttribute('data-artcode', artCode); orig.setAttribute('data-attach', attachUrl); }
  }).catch(function(err){
    renderNoticeError('加载失败：' + (err && err.message || err));
    updateOrigBtn(orig, '');
    renderNoticeSummary(null);
  });
}

/* 「打开原文」按钮态切换：attachUrl 非空 → 可点 PDF；否则禁用 + 改文案。 */
function updateOrigBtn(el, attachUrl){
  if(attachUrl){
    el.href = attachUrl;
    el.removeAttribute('aria-disabled');
    el.textContent = '打开 PDF 原文 ↗';
  } else {
    el.href = '#';
    el.setAttribute('aria-disabled', 'true');
    el.textContent = '此公告暂无 PDF 原文';
  }
}

function renderNoticeError(msg){
  $('#noticeBody').innerHTML =
    '<div class="notice-error">'
  + '<div>' + escHtml(msg) + '</div>'
  + '<div style="margin-top:14px;color:var(--muted);font-size:12px;">可以点下方「打开原文」到东财查看，或重试一次。</div>'
  + '<div class="retry"><button class="btn" data-act="retryNotice">重试</button></div>'
  + '</div>';
}

function closeNotice(){ $('#maskNotice').classList.remove('show'); }

/* 旧公告提醒（v49 前存储，缺少 artCode）回填：点击按标题到东财搜索，至少能打开看到内容 */
function openNoticeSearch(title){
  title = String(title || '').trim();
  if(!title){ toast('未识别到公告标题'); return; }
  var url = 'https://so.eastmoney.com/web/search?query=' + encodeURIComponent(title);
  window.open(url, '_blank', 'noopener');
}

function retryNotice(){
  if(!noticeCtx || !noticeCtx.artCode) return;
  var ac = noticeCtx.artCode;
  $('#noticeBody').innerHTML = '<div class="notice-loading">正在加载公告正文…</div>';
  var orig = $('#noticeOriginal');
  orig.removeAttribute('data-artcode');
  orig.removeAttribute('data-attach');
  orig.href = '#';
  orig.setAttribute('aria-disabled', 'true');
  orig.textContent = '正在加载 PDF 链接…';
  fetchNoticeBody(ac).then(function(res){
    var html = res && res.html, attachUrl = res && res.attachUrl;
    if(!html){ renderNoticeError('公告正文为空'); updateOrigBtn(orig, attachUrl); renderNoticeSummary(null); return; }
    $('#noticeBody').innerHTML = extractBodyHtml(html);
    renderNoticeSummary(noticeSummarizer.summarize(noticeCtx.title, html));
    updateOrigBtn(orig, attachUrl);
    if(attachUrl){ noticeCtx.attachUrl = attachUrl; orig.setAttribute('data-artcode', ac); orig.setAttribute('data-attach', attachUrl); }
  }).catch(function(err){
    renderNoticeError('加载失败：' + (err && err.message || err));
    updateOrigBtn(orig, '');
    renderNoticeSummary(null);
  });
}

/* 拉公告详情：东财 main detail endpoint；
   这是 GET JSON 接口（非 JSONP），正常走 SW（带 Referer/UA/3 次 retry）。
   失败原因可能：artCode 跨接口不一致、CORS、临时风控等 → 弹层给出"打开原文"兜底即可。 */
function fetchNoticeBody(artCode){
  var url = 'https://np-cnotice-stock.eastmoney.com/api/content/ann?art_code=' + encodeURIComponent(artCode) + '&client_source=web&page_index=1';
  return getRemoteText(url).then(function(txt){
    /* 容忍兼容返回值：直接 JSON、JSONP 包裹、空内容 */
    var d;
    if(!txt) throw new Error('empty body');
    var i = txt.indexOf('{'); var j = txt.lastIndexOf('}');
    if(i >= 0 && j > i){
      try{ d = JSON.parse(txt.substring(i, j + 1)); }catch(_){ /* fallthrough */ }
    }
    if(!d){
      /* 也许是 JSONP callback(...)：提取第一段 JSON */
      var p = txt.indexOf('(');
      if(p > 0){
        var q = txt.indexOf(')', p + 1);
        if(q > p){ try{ d = JSON.parse(txt.substring(p + 1, q)); }catch(_){ /* fallthrough */ } }
      }
    }
    if(!d) throw new Error('解析失败');
    /* 不同端点字段名兼容：notice_content / content / body / html */
    var html = (d.data && (d.data.notice_content || d.data.content || d.data.body || d.data.html))
            || d.notice_content || d.content || d.body || d.html || '';
    if(!html) throw new Error('未拿到正文');
    /* 公告 PDF 原件 CDN 链接（浏览器内置 PDF viewer 直接渲染）——
       「打开原文」按钮用这个，比 data.eastmoney.com/notices/detail/{artCode}.html 跳列表页靠谱
       （实测该 HTML 路径被服务端 302 跳到 /notices/，用户在浏览器新标签看到的是列表页不是公告原文）。 */
    var attachUrl = (d.data && (d.data.attach_url || d.data.attach_url_web)) || '';
    return { html: html, attachUrl: attachUrl };
  });
}

/* 提取 <body>...</body> 片段；如果原 HTML 没有 body，整段当成正文。 */
function extractBodyHtml(html){
  if(!html) return '';
  var m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1] : html;
}

/* 公告速读提炼器：从标题+正文里规则化提取「类型标签 + 关键数字/事件」，
   用于在公告弹窗正文上方插入"速读卡片"，让用户在 800 字法律套话里一眼看到核心要点。
   失败兜底：返回 null，调用方不渲染速读卡片（弹窗行为完全不变）。
   纯本地实现，零网络依赖；规则随真实公告迭代，详见 agent-tmp/notice_summarizer.js 同源测试。 */
var noticeSummarizer = (function(){
  function stripHtml(html){
    if(!html) return '';
    return String(html)
      // 只去真正 HTML 标签（字母开头的标签 / 闭合标签 / 注释 / 处理指令），
      // 不去裸的 <xxx> —— 东财正文里把 <公司章程> 这种当章节标题用的不是标签（v59 翠微股份踩过这坑）
      .replace(/<(?:\/?[a-zA-Z][^>]*?|!--[\s\S]*?--|\?[^]*?\?)>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&minus;/g, '-')   // 表格里负号常写为 &minus;
      .replace(/&mdash;/g, '-')
      .replace(/&middot;/g, '·')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function detectTag(title, text){
    var t = (title || '') + '\n' + (text || '').substring(0, 800);
    /* 强信号：标题里直接出现"X届董事会决议公告"/"X届股东会决议公告" → 直接锁定决议类，
       防止正文里"聘任总经理"等把决议类型挤掉（v59 翠微股份实测踩过这坑）。 */
    if(/董事会.{0,6}决议公告|决议的公告|第[一二三四五六七八九十\d]+届董事会/.test(title || '')){
      return '董事会决议';
    }
    if(/股东会.{0,6}决议公告|第[一二三四五六七八九十\d]+届股东会|股东大会决议公告/.test(title || '')){
      return '股东会决议';
    }
    var rules = [
      {tag:'分红派息', re:/利润分配|分红|派息|派现|送股|转增|权益分派|股利/i, weight:1.0},
      {tag:'股份回购', re:/回购股份|股份回购|回购方案|集中竞价|要约收购/i, weight:1.0},
      {tag:'股东减持', re:/减持股份|股东减持|减持计划|集中竞价减持|大宗交易减持/i, weight:1.0},
      {tag:'股东增持', re:/增持股份|股东增持|增持计划|增持公司股份/i, weight:1.0},
      {tag:'业绩预告', re:/业绩预告|预计.*净利润|半年度业绩|年度业绩|业绩预增|业绩预减|业绩预亏|扭亏/i, weight:1.0},
      {tag:'重大合同', re:/重大合同|签订.*合同|中标|签署.*协议|采购合同|销售合同/i, weight:1.0},
      {tag:'股东会决议', re:/股东大会决议|股东会决议|年度股东大会|临时股东大会|审议通过/i, weight:1.0},
      {tag:'董事会决议', re:/董事会决议|审议通过.*议案|第[一二三四五六七八九十\d]+届董事会/i, weight:1.0},
      {tag:'股权激励', re:/股权激励|限制性股票|股票期权|员工持股计划/i, weight:1.0},
      {tag:'重大资产', re:/重大资产|资产重组|并购|收购.*股权|发行股份购买/i, weight:1.0},
      {tag:'关联交易', re:/关联交易/i, weight:0.9},
      {tag:'停牌', re:/停牌|停牌一天|停牌申请|临时停牌/i, weight:1.0},
      {tag:'复牌', re:/复牌|复牌公告|将于.*复牌/i, weight:1.0},
      {tag:'风险提示', re:/风险提示|退市风险|交易风险/i, weight:1.0},
      {tag:'高管变动', re:/高管变动|董事长.*辞任|总经理.*辞任|聘任.*总经理|聘任.*董事长/i, weight:1.0},
      {tag:'解禁', re:/限售股解禁|解除限售|首发限售股/i, weight:1.0},
      {tag:'现金管理', re:/使用闲置自有资金|使用闲置募集资金|现金管理/i, weight:0.9},
      {tag:'定期报告', re:/年度报告|半年度报告|季度报告|中期报告|经营数据公告/i, weight:1.0},
      {tag:'股东会通知', re:/关于召开.{0,12}(?:临时|年度)?(?:股东大会|股东会)的通知/i, weight:1.0},
      {tag:'经营范围变更', re:/关于增加经营范围|关于变更经营范围|经营范围.{0,4}变更/i, weight:1.0},
      {tag:'公司章程', re:/公司章程\s*[\(（].{0,40}(?:修订|草案)/i, weight:1.0}
    ];
    var best = null, bestScore = 0;
    for(var i=0;i<rules.length;i++){
      var r = rules[i];
      if(r.re.test(t)){
        var score = r.weight + (r.re.test(title || '') ? 0.5 : 0);
        if(score > bestScore){ bestScore = score; best = r.tag; }
      }
    }
    return best;
  }
  function extractItems(tag, text){
    var items = [];
    if(!text) return items;
    var clean = text.replace(/^.*?本公司及董事会全体成员保证信息披露.*?遗漏[。\.]\s*/s, '');
    if(tag === '分红派息'){
      var m1 = clean.match(/每\s*10\s*股(?:派(?:发)?)?(?:现金)?(?:红利|股息)?\s*([\d.,]+)\s*元/i)
             || clean.match(/每\s*10\s*股派(?:发)?\s*现金红利\s*([\d.,]+)\s*元/i)
             || clean.match(/每\s*10\s*股(?:转增|送)\s*(\d+)\s*股/i);
      if(m1) items.push('每 10 股派 ' + m1[1] + ' 元（含税）');
      var m2 = clean.match(/(?:合计|共计|总计|总额).{0,12}?([\d,\.]+\s*[万亿]?元)/);
      if(m2) items.push('合计派现 ' + m2[1].replace(/\s+/g,''));
      var m3 = clean.match(/(送(?:红)?股|转增(?:股本)?).{0,15}?(\d+(?:\.\d+)?\s*股)/);
      if(m3) items.push(m3[1] + ' ' + m3[2].replace(/\s+/g,''));
      if(/不送红股.*?不(?:进行)?(?:转增|以资本公积金转增)/i.test(clean) ||
         /不进行送股.*?不进行资本公积转增/i.test(clean)){
        items.push('不送红股、不转增');
      }
      var m4 = clean.match(/(?:以|按).{0,8}?(总股本|分红派息股权登记日总股本).{0,12}?([\d,，]+)\s*股/);
      if(m4) items.push('基数：' + m4[2] + ' 股');
    }
    else if(tag === '股份回购'){
      var m = clean.match(/回购(?:金额|资金|总额).{0,8}?([\d,\.]+\s*[万亿]?元)/);
      if(m) items.push('回购金额 ' + m[1].replace(/\s+/g,''));
      var m2 = clean.match(/回购价格.{0,15}?([\d.,]+\s*元\/股)/);
      if(m2) items.push('回购价格上限 ' + m2[1].replace(/\s+/g,''));
      var m3 = clean.match(/回购数量.{0,15}?([\d,，]+\s*股)/);
      if(m3) items.push('回购数量 ' + m3[1].replace(/\s+/g,''));
      var m4 = clean.match(/回购期限.{0,8}?(\d+\s*个月)/);
      if(m4) items.push('回购期限 ' + m4[1].replace(/\s+/g,''));
    }
    else if(tag === '股东减持' || tag === '股东增持'){
      var m = clean.match(/(减持|增持).{0,30}?数量.{0,30}?([\d,，]+\s*股)/);
      if(m) items.push(m[1] + '数量 ' + m[2].replace(/\s+/g,''));
      var m2 = clean.match(/(减持|增持).{0,30}?比例.{0,30}?([\d.]+\s*%)/);
      if(m2) items.push(m2[1] + '比例 ' + m2[2].replace(/\s+/g,''));
      var m3 = clean.match(/(减持|增持).{0,30}?价格(?:区间)?.{0,30}?([\d.,]+\s*元\/股)/);
      if(m3) items.push(m3[1] + '价格 ' + m3[2].replace(/\s+/g,''));
      var m4 = clean.match(/(减持|增持).{0,30}?期限.{0,30}?(\d+\s*个月)/);
      if(m4) items.push(m4[1] + '期限 ' + m4[2].replace(/\s+/g,''));
    }
    else if(tag === '业绩预告'){
      var m = clean.match(/预计[^\n。]{0,30}?净利润[^\n。]{0,15}?(-?[\d,\.]+\s*[万亿]?元)/);
      if(m) items.push('预计净利润 ' + m[1].replace(/\s+/g,''));
      var m2 = clean.match(/同比(?:增长|上升|增加)\s*([\d.]+\s*%)/);
      if(m2) items.push('同比增长 ' + m2[1].replace(/\s+/g,''));
      var m3 = clean.match(/同比(?:下降|减少|下滑)\s*([\d.]+\s*%)/);
      if(m3) items.push('同比下降 ' + m3[1].replace(/\s+/g,''));
      if(/扭亏|实现盈利/.test(clean)) items.push('扭亏为盈');
      if(/由盈转亏|出现亏损|预计亏损/.test(clean)) items.push('由盈转亏');
    }
    else if(tag === '重大合同'){
      var m = clean.match(/合同(?:总?金额|总价|总额).{0,8}?([\d,\.]+\s*[万亿]?元)/);
      if(m) items.push('合同金额 ' + m[1].replace(/\s+/g,''));
      var m2 = clean.match(/签订.{0,4}?《([^》]+)》/);
      if(m2) items.push('合同：' + m2[1].substring(0, 30));
      var m3 = clean.match(/对方|交易对手|客户.{0,4}?(\S{2,15}?(?:公司|集团|局|厂|院|中心))/);
      if(m3) items.push('对手方：' + m3[1].substring(0, 20));
    }
    else if(tag === '股东会决议' || tag === '董事会决议'){
      // 优先：抓"审议通过"紧跟的《议案名》——精准命中议案（避开正文里"符合《公司法》和《公司章程》的有关规定"这种法律引用）
      var agendaMatches = clean.match(/审议通过[了]?《([^》\n]{2,40})》/g);
      if(agendaMatches){
        agendaMatches.slice(0, 6).forEach(function(s){
          var t = s.replace(/^审议通过[了]?《/, '').replace(/》$/, '').trim();
          if(t && !/^\d+$/.test(t)) items.push(t);
        });
      }
      // 兜底1：审议通过短句（议案没《》包裹）
      if(items.length === 0){
        var matches = clean.match(/审议通过[「」《》]?([^。\n]{4,30}?)[。\n]/g);
        if(matches){
          matches.slice(0, 4).forEach(function(s){
            var t = s.replace(/审议通过[「」《》]?/, '').replace(/[。\n]$/, '').trim();
            if(t) items.push(t);
          });
        }
      }
      // 兜底2：所有《》作为弱信号
      if(items.length === 0){
        var bookMatches = clean.match(/《([^》\n]{2,40})》/g);
        if(bookMatches){
          bookMatches.slice(0, 4).forEach(function(s){
            var t = s.replace(/[《》]/g, '').trim();
            if(t && !/^\d+$/.test(t)) items.push(t);
          });
        }
      }
    }
    else if(tag === '股权激励'){
      var m = clean.match(/授予.{0,8}?(\d[\d,，]*\s*股)/);
      if(m) items.push('授予股份 ' + m[1].replace(/\s+/g,''));
      var m2 = clean.match(/授予价格.{0,8}?([\d.,]+\s*元\/股)/);
      if(m2) items.push('授予价格 ' + m2[1].replace(/\s+/g,''));
      var m3 = clean.match(/激励对象.{0,8}?(\d+\s*人)/);
      if(m3) items.push('激励对象 ' + m3[1].replace(/\s+/g,''));
    }
    else if(tag === '重大资产'){
      var m = clean.match(/交易(?:价格|金额|作价).{0,8}?([\d,\.]+\s*[万亿]?元)/);
      if(m) items.push('交易作价 ' + m[1].replace(/\s+/g,''));
      var m2 = clean.match(/(标的|标的公司).{0,4}?(\S{2,15}?(?:公司|有限))/);
      if(m2) items.push('标的：' + m2[2].substring(0, 18));
    }
    else if(tag === '停牌' || tag === '复牌'){
      var m = clean.match(/(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日).{0,4}?(开市起|停牌|复牌)/);
      if(m) items.push(m[1] + ' ' + (tag === '停牌' ? '开市起停牌' : '开市起复牌'));
    }
    else if(tag === '风险提示'){
      if(/退市风险|被终止上市|可能.{0,4}终止上市/.test(clean)) items.push('存在退市风险');
      if(/二级市场.{0,4}交易风险|股价.{0,4}交易风险/.test(clean)) items.push('二级市场交易风险');
      if(/股价异常波动|股价大幅波动|股价.{0,4}异常/.test(clean)) items.push('股价异常波动');
      if(/估值风险|高估风险|市场情绪/.test(clean)) items.push('估值/市场情绪风险');
    }
    else if(tag === '高管变动'){
      var m = clean.match(/(聘任|选举|任命)([^。\s]{2,8}?)为[^\n。]{0,15}?(总经理|董事长|副总经理|财务总监|董事会秘书)/);
      if(m) items.push(m[1] + m[2] + '为' + m[3]);
      var m2 = clean.match(/([^。\s]{2,8}?)因[^\n。]{0,12}?辞去[^\n。]{0,8}?(总经理|董事长|副总经理|财务总监|董事会秘书)/);
      if(m2) items.push(m2[1] + '辞去' + m2[2] + '职务');
    }
    else if(tag === '解禁'){
      var m = clean.match(/解除限售.{0,8}?(\d[\d,，]*\s*股)/);
      if(m) items.push('解禁数量 ' + m[1].replace(/\s+/g,''));
      var m2 = clean.match(/占总股本.{0,8}?([\d.]+\s*%)/);
      if(m2) items.push('占总股本 ' + m2[1].replace(/\s+/g,''));
    }
    else if(tag === '现金管理'){
      var m = clean.match(/额度.{0,8}?(不超过|不高于)?\s*([\d,\.]+\s*[万亿]?元)/);
      if(m) items.push('额度 ' + (m[1]||'') + m[2].replace(/\s+/g,''));
    }
    else if(tag === '定期报告'){
      // 半年报 / 半年报摘要 / 季度报告 / 年度报告 / 中期报告 —— 表格列序：本报告期 / 上年同期 / 同比数字（部分带%部分不带）
      function grabFin(label){
        var m = clean.match(new RegExp(label + '\\s+([\\-\\d,\\.]+)\\s+[\\-\\d,\\.]+\\s+([\\-\\d.]+)'));
        if(m) return label + ' ' + m[1].replace(/,/g,'') + '元（同比' + m[2] + '%）';
        return null;
      }
      ['营业收入','利润总额','归属于上市公司股东的净利润','经营活动产生的现金流量净额','归属于上市公司股东的扣除非经常性损益的净利润']
        .forEach(function(lab){ var it = grabFin(lab); if(it) items.push(it); });
      // 半年报摘要还会多列资产/净资产（区间数据：本报告期末 / 上年度末 / 增减%）
      if(items.length < 3){
        var ma = clean.match(/总资产\s+([\-\d,\.]+)\s+[\-\d,\.]+\s+([\-\d.]+)/);
        if(ma) items.push('总资产 ' + ma[1].replace(/,/g,'') + '元（较上年末' + ma[2] + '%）');
        var mn = clean.match(/归属于上市公司股东的净资产\s+([\-\d,\.]+)\s+[\-\d,\.]+\s+([\-\d.]+)/);
        if(mn) items.push('归母净资产 ' + mn[1].replace(/,/g,'') + '元（较上年末' + mn[2] + '%）');
      }
      // 经营数据公告（无逐项 KPI）：抓"合计"行的主营业务合计（第 1 + 第 4 列）
      if(items.length === 0){
        var mt = clean.match(/合\s*计\s+([\-\d,\.]+)\s+[\-\d,\.]+\s+[\-\d,\.]+\s+([\-\d.]+)/);
        if(mt) items.push('主营合计 ' + mt[1].replace(/,/g,'') + '元（同比' + mt[2] + '%）');
      }
    }
    else if(tag === '股东会通知'){
      function pad(s){ s = String(s); return s.length === 1 ? '0' + s : s; }
      // 召开日期
      var m1 = clean.match(/股东会召开日期[：:]\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
      if(m1) items.push('召开日期 ' + m1[1] + '-' + pad(m1[2]) + '-' + pad(m1[3]));
      // 召开时间（具体到时分）
      var m2 = clean.match(/召开.{0,4}日期时间[：:]\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(\d{1,2})\s*点(?:(\d{1,2})\s*分)?/);
      if(m2) items.push('召开时间 ' + m2[1] + '-' + pad(m2[2]) + '-' + pad(m2[3]) + ' ' + pad(m2[4]) + ':' + pad(m2[5] || '00'));
      // 股权登记日（表格里中间夹"Ａ股 603123 翠微股份"等列名，30 字符内找日期）
      var m3 = clean.match(/股权登记日[\s\S]{0,30}?(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if(m3) items.push('股权登记日 ' + m3[1] + '-' + pad(m3[2]) + '-' + pad(m3[3]));
      // 召开地点
      var m4 = clean.match(/召开地点[：:]\s*([^\n。\()]{4,30})/);
      if(m4) items.push('地点：' + m4[1].trim());
    }
    else if(tag === '经营范围变更'){
      var lines = clean.match(/第\s*(\d{1,3})\s*条/g);
      if(lines){
        var uniq = [];
        lines.forEach(function(s){
          var n = parseInt(s.replace(/[^\d]/g, ''), 10);
          if(n > 0 && uniq.indexOf(n) === -1) uniq.push(n);
        });
        if(uniq.length >= 1){
          var sample = uniq.slice(0, 4).map(function(n){ return '第' + n + '条'; }).join('、');
          if(uniq.length > 4) sample += ' 等共 ' + uniq.length + ' 条';
          items.push('修订条款：' + sample);
        }
      }
      if(/尚需提交(?:公司)?(?:股东会|股东大会)审议/.test(clean)) items.push('尚需股东会审议');
      if(/经营范围/.test(clean)) items.push('涉及：经营范围');
      if(/对外担保/.test(clean)) items.push('涉及：对外担保');
    }
    else if(tag === '公司章程'){
      var chapMatches = clean.match(/第\s*[一二三四五六七八九十\d]+\s*章/g);
      if(chapMatches && chapMatches.length >= 5){
        var uniq = [];
        chapMatches.forEach(function(s){ if(uniq.indexOf(s) === -1) uniq.push(s); });
        items.push('全文共 ' + uniq.length + ' 章');
      }
    }
    else if(tag === '关联交易'){
      var m = clean.match(/交易金额.{0,8}?([\d,\.]+\s*[万亿]?元)/);
      if(m) items.push('交易金额 ' + m[1].replace(/\s+/g,''));
    }
    if(items.length === 0 && tag){
      items.push('详情请打开 PDF 原文查阅');
    }
    return items;
  }
  function summarize(title, html){
    if(!title && !html) return null;
    var text = stripHtml(html);
    var tag = detectTag(title, text);
    if(!tag) return null;
    var items = extractItems(tag, text);
    if(!items || items.length === 0) return null;
    /* 限长：决议类公告天然是"列议案"，放宽到 6 条；其他类型保持 4 条简洁 */
    var maxItems = (tag === '董事会决议' || tag === '股东会决议') ? 6 : 4;
    return { tag: tag, items: items.slice(0, maxItems) };
  }
  return { summarize: summarize, stripHtml: stripHtml, detectTag: detectTag };
})();

/* 渲染速读卡片到弹窗 #noticeSummary；summary=null 时隐藏。 */
function renderNoticeSummary(summary){
  var box = $('#noticeSummary');
  if(!box) return;
  if(!summary){
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  var tag = $('#noticeSummaryTag');
  var items = $('#noticeSummaryItems');
  if(tag) tag.textContent = summary.tag;
  if(items) items.innerHTML = summary.items.map(function(s){ return '<li>' + escHtml(s) + '</li>'; }).join('');
  box.style.display = '';
}

/* 渲染基金/股票阈值列表（合并了原顶部"仅停提醒"芯片：每行可直接 × 停提醒 / 停后变"恢复"） */
function renderAlertRows(){
  var fundMuted = alerts.settings.fundMuted || {};
  var fundOv = alerts.settings.overrides || {};
  var fhtml = '';
  holdings.forEach(function(h){
    var info = fundInfo[h.code];
    var nm = (info && info.name) || h.code;
    var v = fundOv[h.code];
    var muted = !!fundMuted[h.code];
    var act = muted
      ? '<span class="row-act"><span class="link" data-act="unmuteFundAlert" data-args=\'["' + h.code + '"]\'>恢复提醒</span></span>'
      : '<span class="row-act"><span class="x" title="仅停止该基金的涨跌提醒（持仓保留）" data-act="muteFundAlert" data-args=\'["' + h.code + '"]\'>关闭提醒</span></span>';
    fhtml += '<div class="row' + (muted ? ' is-muted' : '') + '">'
           + '<span>' + escHtml(nm) + '</span>'
           + '<span class="code">' + escHtml(h.code) + '</span>'
           + '<input type="number" step="0.1" min="0.1" data-code="' + h.code + '" value="' + (v !== undefined && v !== null ? v : '') + '" placeholder="全局">'
           + '<span style="color:var(--muted);font-size:11px;flex:none">%</span>'
           + act
           + '</div>';
  });
  $('#fundThList').innerHTML = holdings.length ? fhtml : '<div class="empty muted">暂无基金持仓</div>';
  $('#fundThList').querySelectorAll('input[data-code]').forEach(function(inp){
    inp.addEventListener('input', onAlertChange);
  });
  var stkMuted = alerts.settings.stockMuted || {};
  var stkOv = alerts.settings.stockOverrides || {};
  var shtml = '';
  stocks.forEach(function(s){
    var info = stockInfo[s.code];
    var nm = (info && info.name) || s.code.replace(/^(sh|sz|hk|us)/,'');
    var v = stkOv[s.code];
    var pureCode = s.code.replace(/^(sh|sz|hk|us)/,'');
    var muted = !!stkMuted[s.code];
    var act = muted
      ? '<span class="row-act"><span class="link" data-act="unmuteStockAlert" data-args=\'["' + s.code + '"]\'>恢复提醒</span></span>'
      : '<span class="row-act"><span class="x" title="仅停止该股票的价格异动提醒（持仓保留）" data-act="muteStockAlert" data-args=\'["' + s.code + '"]\'>关闭提醒</span></span>';
    shtml += '<div class="row' + (muted ? ' is-muted' : '') + '">'
           + '<span>' + escHtml(nm) + '</span>'
           + '<span class="code">' + pureCode + '</span>'
           + '<input type="number" step="0.1" min="0.1" data-scode="' + s.code + '" value="' + (v !== undefined && v !== null ? v : '') + '" placeholder="全局">'
           + '<span style="color:var(--muted);font-size:11px;flex:none">%</span>'
           + act
           + '</div>';
  });
  $('#stockThList').innerHTML = stocks.length ? shtml : '<div class="empty muted">暂无股票持仓</div>';
  $('#stockThList').querySelectorAll('input[data-scode]').forEach(function(inp){
    inp.addEventListener('input', onAlertChange);
  });
}
/* × 仅停该股票的价格异动提醒，不删持仓（删持仓走主界面股票表格的删除） */
function muteStockAlert(code){
  if(!alerts.settings.stockMuted) alerts.settings.stockMuted = {};
  alerts.settings.stockMuted[code] = true;
  saveAlerts(); toggleRowMute('stock', code, true);
}
function unmuteStockAlert(code){
  if(alerts.settings.stockMuted) delete alerts.settings.stockMuted[code];
  saveAlerts(); toggleRowMute('stock', code, false);
}
/* 基金：停/恢复估算涨幅提醒（持仓保留），与股票一致 */
function muteFundAlert(code){
  if(!alerts.settings.fundMuted) alerts.settings.fundMuted = {};
  alerts.settings.fundMuted[code] = true;
  saveAlerts(); toggleRowMute('fund', code, true);
}
function unmuteFundAlert(code){
  if(alerts.settings.fundMuted) delete alerts.settings.fundMuted[code];
  saveAlerts(); toggleRowMute('fund', code, false);
}
/* 局部切换某行的"停/恢复"态（不动其它行，避免把未保存的阈值输入清掉） */
function toggleRowMute(kind, code, muted){
  var listId = kind === 'fund' ? '#fundThList' : '#stockThList';
  var sel = kind === 'fund' ? 'input[data-code="' + code + '"]' : 'input[data-scode="' + code + '"]';
  var inp = document.querySelector(listId + ' ' + sel);
  if(!inp) return;
  var row = inp.closest('.row');
  if(!row) return;
  row.classList.toggle('is-muted', muted);
  var act = row.querySelector('.row-act');
  if(!act) return;
  var muteTag = kind === 'fund' ? 'muteFundAlert' : 'muteStockAlert';
  var unmuteTag = kind === 'fund' ? 'unmuteFundAlert' : 'unmuteStockAlert';
  var what = kind === 'fund' ? '基金' : '股票';
  if(muted){
    act.innerHTML = '<span class="link" data-act="' + unmuteTag + '" data-args=\'["' + code + '"]\'>恢复提醒</span>';
  } else {
    act.innerHTML = '<span class="x" title="仅停止该' + what + '的涨跌提醒（持仓保留）" data-act="' + muteTag + '" data-args=\'["' + code + '"]\'>关闭提醒</span>';
  }
}
function closeAlerts(){
  if(window._alertSnap !== undefined && window._alertSnap !== serializeAlertForm()){
    if(!confirm('有未保存的修改，确定关闭吗？')) return;
  }
  $('#maskAlert').classList.remove('show'); updateAlertBadge();
}
/* 打赏弹窗（点击顶部「打赏」按钮弹出，显示微信赞赏码） */
function openDonate(){ $('#maskDonate').classList.add('show'); }
function closeDonate(){ $('#maskDonate').classList.remove('show'); }
/* —— 提醒设置：改动检测 / Toast / 桌面通知授权 —— */
function serializeAlertForm(){
  var ov = {};
  document.querySelectorAll('#fundThList input[data-code]').forEach(function(inp){
    var v = parseFloat(inp.value);
    if(!isNaN(v) && v > 0) ov[inp.getAttribute('data-code')] = v;
  });
  var stkOv = {};
  document.querySelectorAll('#stockThList input[data-scode]').forEach(function(inp){
    var v = parseFloat(inp.value);
    if(!isNaN(v) && v > 0) stkOv[inp.getAttribute('data-scode')] = v;
  });
  return JSON.stringify({
    pct: $('#setPct').value,
    auto: $('#setAuto').value,
    notice: $('#setNotice').checked,
    stockNotice: $('#setStockNotice').checked,
    sound: $('#setSound').checked,
    notify: $('#setNotify').checked,
    commRateW: $('#setCommRateW').value,
    minComm: $('#setMinComm').value,
    stampTaxW: $('#setStampTaxW').value,
    fundRateW: $('#setFundRateW').value,
    ov: ov,
    stkOv: stkOv
  });
}
function onAlertChange(){ updateSaveBtn(); }
function updateSaveBtn(){
  var btn = $('#saveAlertBtn');
  if(!btn) return;
  var dirty = window._alertSnap !== undefined && window._alertSnap !== serializeAlertForm();
  btn.disabled = !dirty;
}
function updatePctHint(){
  var el = $('#setPct'), note = $('#pctNote');
  if(!el || !note) return;
  var v = parseFloat(el.value);
  if(!isNaN(v) && v < 2){ note.textContent = '阈值偏低，日内波动易触发噪音提醒'; note.className = 'pct-note low'; }
  else { note.textContent = ''; note.className = 'pct-note'; }
}
function updateNotifyState(){
  var el = $('#notifyState');
  if(!el) return;
  /* 扩展环境用 chrome.notifications 权限等级（比网页 Notification 更可靠、无需网页授权） */
  if(typeof chrome !== 'undefined' && chrome.notifications && chrome.notifications.getPermissionLevel){
    try{
      chrome.notifications.getPermissionLevel(function(level){
        if(level === 'granted'){ el.textContent = '已授权'; el.className = 'auth-pill granted'; }
        else if(level === 'denied'){ el.textContent = '已拒绝'; el.className = 'auth-pill denied'; }
        else { el.textContent = '点击授权'; el.className = 'auth-pill'; }
      });
    }catch(e){ el.textContent = 'API 异常'; el.className = 'auth-pill denied'; }
    return;
  }
  if(!('Notification' in window)){
    el.textContent = '不支持'; el.className = 'auth-pill denied'; el.onclick = null; return;
  }
  if(location.protocol === 'file:'){
    el.textContent = '本地不支持'; el.className = 'auth-pill denied'; return;
  }
  var p = Notification.permission;
  if(p === 'granted'){ el.textContent = '已授权'; el.className = 'auth-pill granted'; }
  else if(p === 'denied'){ el.textContent = '已拒绝'; el.className = 'auth-pill denied'; }
  else { el.textContent = '点击授权'; el.className = 'auth-pill'; }
}
function requestNotifyPerm(e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  /* 扩展环境：用一次测试通知触发 Chrome 的扩展通知授权弹窗（chrome.notifications 无独立 request 接口） */
  if(typeof chrome !== 'undefined' && chrome.notifications && chrome.notifications.create){
    try{
      var icon = (chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('icon48.png') : '';
      chrome.notifications.create('perm_test_' + Date.now(), {
        type: 'basic', iconUrl: icon, title: '持仓看板通知', message: '通知已开启（此条为授权测试）', priority: 2
      }, function(){
        if(chrome.runtime && chrome.runtime.lastError){ toast('通知被拒绝或不可用：扩展管理→该扩展→允许通知'); }
        else { toast('已发起授权，请点「允许」'); }
        updateNotifyState();
      });
    }catch(err){ toast('通知请求失败：' + (err && err.message ? err.message : err)); }
    return;
  }
  /* 降级：网页 Notification API */
  if(!('Notification' in window)){ toast('当前浏览器不支持桌面通知'); return; }
  if(location.protocol === 'file:'){
    toast('本地 file:// 文件浏览器禁止桌面通知授权。请用 http://localhost 或 https 打开本页');
    return;
  }
  try{
    var p = Notification.requestPermission(function(res){ afterPerm(res); });
    if(p && typeof p.then === 'function'){
      p.then(afterPerm).catch(function(){ toast('授权请求被浏览器拒绝'); });
    }
  }catch(err){ toast('授权请求失败：' + (err && err.message ? err.message : err)); }
  function afterPerm(res){
    res = res || Notification.permission;
    updateNotifyState();
    if(res === 'granted'){ $('#setNotify').checked = true; onAlertChange(); toast('桌面通知已授权'); }
    else if(res === 'denied'){ toast('已被拒绝：点地址栏锁形图标→站点设置→通知→允许'); }
    else { toast('未授权，将只在页面内提醒'); }
  }
}
var _toastTimer;
function toast(msg){
  var t = $('#toast');
  if(!t){ t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 1800);
}
function clearAlertLog(){
  if(!confirm('清空全部提醒记录？')) return;
  alerts.log = []; saveAlerts(); renderAlertLog(); updateAlertBadge();
}
async function saveAlertSettings(){
  var pct = parseFloat($('#setPct').value);
  alerts.settings.pct = (!isNaN(pct) && pct > 0) ? pct : 3;
  alerts.settings.autoMin = Number($('#setAuto').value) || 0;
  alerts.settings.notice = $('#setNotice').checked;
  alerts.settings.stockNotice = $('#setStockNotice').checked;
  alerts.settings.sound = $('#setSound').checked;
  var commRateW = parseFloat($('#setCommRateW').value);
  var minComm = parseFloat($('#setMinComm').value);
  var stampTaxW = parseFloat($('#setStampTaxW').value);
  var fundRateW = parseFloat($('#setFundRateW').value);
  alerts.settings.commRateW = (!isNaN(commRateW) && commRateW >= 0) ? commRateW : 2.5;
  alerts.settings.minComm = (!isNaN(minComm) && minComm >= 0) ? minComm : 5;
  alerts.settings.stampTaxW = (!isNaN(stampTaxW) && stampTaxW >= 0) ? stampTaxW : 5;
  alerts.settings.fundRateW = (!isNaN(fundRateW) && fundRateW >= 0) ? fundRateW : 10;
  var wantNotify = $('#setNotify').checked;
  if(wantNotify){
    /* 扩展原生通知：权限由 Chrome 在首次 create 时弹窗授予；这里只拦"已拒绝"的情况 */
    if(typeof chrome !== 'undefined' && chrome.notifications && chrome.notifications.getPermissionLevel){
      try{
        var lvl = await new Promise(function(res){ chrome.notifications.getPermissionLevel(function(l){ res(l); }); });
        if(lvl === 'denied'){ toast('通知已被拒绝：扩展管理→该扩展→允许通知'); wantNotify = false; $('#setNotify').checked = false; }
      }catch(e){}
    } else {
      /* 网页环境（file:// 等）走 Web Notification 授权流程 */
      if(location.protocol === 'file:'){
        toast('本地 file:// 不支持桌面通知，请改用 localhost/https 打开');
        wantNotify = false; $('#setNotify').checked = false;
      } else if(wantNotify && 'Notification' in window && Notification.permission === 'default'){
        try{ await Notification.requestPermission(); }catch(e){}
      }
      if(wantNotify && (!('Notification' in window) || Notification.permission !== 'granted')){
        toast('浏览器通知未授权，将只在页面内提醒');
        wantNotify = false;
        $('#setNotify').checked = false;
      }
    }
  }
  alerts.settings.notify = wantNotify;
  var inputs = document.querySelectorAll('#fundThList input[data-code]');
  var ov = {};
  inputs.forEach(function(inp){
    var v = parseFloat(inp.value);
    if(!isNaN(v) && v > 0) ov[inp.getAttribute('data-code')] = v;
  });
  alerts.settings.overrides = ov;
  /* 单股票阈值（key = 完整 stock.code，含 sh/sz 前缀，与股票行情键一致） */
  var stkInputs = document.querySelectorAll('#stockThList input[data-scode]');
  var stkOv = {};
  stkInputs.forEach(function(inp){
    var v = parseFloat(inp.value);
    if(!isNaN(v) && v > 0) stkOv[inp.getAttribute('data-scode')] = v;
  });
  alerts.settings.stockOverrides = stkOv;
  saveAlerts(); applyAuto();
  updateNotifyState();
  window._alertSnap = serializeAlertForm();
  updateSaveBtn();
  toast('提醒设置已保存');
}

function clickImportFile(){
  var inp = document.getElementById('importFile');
  if(inp) inp.click();
}
function exportData(){
  var blob = new Blob([JSON.stringify({funds: holdings, stocks: stocks, idxConfig: loadIdxConfig()}, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fund_holdings.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
function importData(ev){
  var f = ev.target.files[0];
  if(!f) return;
  var r = new FileReader();
  r.onload = function(){
    try{
      var data = JSON.parse(r.result);
      var fundArr, stkArr = [];
      if(Array.isArray(data)){ fundArr = data; }        /* 旧格式：纯基金数组 */
      else if(data && Array.isArray(data.funds)){ fundArr = data.funds; stkArr = Array.isArray(data.stocks) ? data.stocks : []; }
      else{ throw new Error('bad'); }
      holdings = fundArr.filter(function(x){ return /^\d{6}$/.test(x.code) && (x.amount > 0 || x.shares > 0); })
                     .map(function(x){ return {code: x.code, name: typeof x.name === 'string' ? x.name.trim().slice(0, 40) || undefined : undefined, shares: x.shares > 0 ? x.shares : null, cost: x.cost > 0 ? x.cost : null, amount: x.amount > 0 ? x.amount : null}; });
      stocks = stkArr.filter(function(x){ return normStockCode(x.code) && x.shares > 0; })
                     .map(function(x){ var c = normStockCode(x.code); return {code: c, shares: x.shares, cost: x.cost > 0 ? x.cost : null, type: classifyStockType(c).cls}; });
      if(Array.isArray(data.idxConfig) && data.idxConfig.length > 0 && data.idxConfig.length <= 7){
        var valid = new Set(IDX_ALL.map(function(x){ return x.code; }));
        var filtered = data.idxConfig.filter(function(c){ return valid.has(c); });
        if(filtered.length > 0) saveIdxConfig(filtered);
      }
      saveHoldings(); saveStocks(); refreshAll();
    }catch(e){ alert('导入失败：文件格式不正确'); }
  };
  r.readAsText(f);
  ev.target.value = '';
}

updateAlertBadge();
applyAuto();
applyTheme();
applyAllCardFold();
refreshAll();

/* 添加股票弹窗：输入代码实时识别品种 / 手动改类型标记 */
(function(){
  var _inCode = document.getElementById('inStkCode');
  if(_inCode) _inCode.addEventListener('input', updateStkTypeHint);
  var _inType = document.getElementById('inStkType');
  if(_inType) _inType.addEventListener('change', function(){ _inType.dataset.touched = '1'; });
})();

/* ============== 桌面组件模式 ==============
   以 ?widget 打开时进入窄栏常驻模式：隐藏非必要区块、锁定单栏，
   默认开启 1 分钟自动刷新（与提醒阈值联动）。数据仍读同一份 localStorage。 */
(function(){
  if(!/[?&]widget\b/.test(location.search)) return;
  document.body.classList.add('widget-mode');
  if(!alerts.settings.autoMin){ alerts.settings.autoMin = 1; saveAlerts(); }
  applyAuto();
})();

/* ============== 防篡改自检 ==============
   别人 fork 后若把打赏入口删掉、或把收款码(donate.png)换成他自己的，这里会当场暴露。
   注：前端无法真正阻止改名覆盖文件，但「改动代码/移除入口」会被检测并提示使用者。 */
(function integrityCheck(){
  try{
    var bad = [];
    if(!document.querySelector('[data-act="openDonate"]')) bad.push('打赏按钮');
    var m = document.getElementById('maskDonate');
    if(!m){ bad.push('打赏弹窗'); }
    else if(m.innerHTML.indexOf('donate.png') < 0){ bad.push('收款码引用'); }
    if(bad.length){
      console.warn('[看板] 检测到以下结构被非官方改动：' + bad.join('、'));
      var btn = document.querySelector('[data-act="openDonate"]');
      if(btn && !btn.dataset.warned){
        btn.dataset.warned = '1';
        btn.title = '⚠ 此看板文件已被非官方修改，打赏入口可能异常';
        btn.style.outline = '2px solid #e8a13a';
      }
      try{ toast('⚠ 看板文件已被修改，打赏功能可能非官方'); }catch(e){}
    }
  }catch(e){}
})();
