// 扩展后台。
// ⚠️ 工具栏图标点击已交给 action.default_popup（popup.html）——manifest 配了 default_popup 后
// chrome.action.onClicked 不会再触发，「切换浮窗 / 打开看板」的逻辑已移入 popup.js
// （popup 内「📊 网页浮窗」按钮向当前标签发 floatToggle，「全屏看板」开 dashboard.html）。

/* ============== 角标：显示今日盈亏 ==============
   扩展页 (dashboard.js) 每次刷新完数据，把今日盈亏金额推过来；
   SW 调用 chrome.action.setBadgeText/setBadgeBackgroundColor 渲染在工具栏图标右上角。
   中国股市惯例：红涨绿跌，所以盈利=红底、亏损=绿底（与左侧"1.2k"那个红角标风格一致）。
   格式：1 位小数四舍五入，|n|>=10000→w(1.2w), |n|>=1000→k(1.2k), |n|<1000 整数, |n|<1 或无效→空。
   不带 +/- 符号——方向靠背景色红/绿区分（带符号 1.2k 是 5 字符，硬上限 4 字符带不动）。
   协议：-> {type:'updateBadge', pnl:number} */
function fmtBadgePnl(pnl){
  if(pnl === null || pnl === undefined || !isFinite(pnl)) return '';
  var abs = Math.abs(pnl);
  if(abs < 1) return '';
  var s;
  if(abs >= 10000){
    /* 1.2w（保留 1 位小数）；>100000 走整数 w 兜底（避免 5 字符超限） */
    s = abs >= 100000 ? (Math.round(abs/10000) + 'w') : (Math.round(abs/1000)/10 + 'w');
  }else if(abs >= 1000){
    s = (Math.round(abs/100)/10 + 'k');              /* 1.2k */
  }else{
    s = Math.round(abs).toString();                   /* 1..999 整数 */
  }
  s = s.replace(/\.0(w|k)$/, '$1');                   /* 1.0k → 1k；1.0w → 1w（保底） */
  // Chrome badge 硬上限 4 字符；>4 时再砍精度
  return s.length > 4 ? s.slice(0, 4) : s;
}
function setBadge(pnl){
  var txt = fmtBadgePnl(pnl);
  chrome.action.setBadgeText({ text: txt });                 // 空串 = 清空角标
  if(!txt){ return; }
  // 中国股市惯例：红涨绿跌
  var color = pnl >= 0 ? '#d33' : '#2a8';
  chrome.action.setBadgeBackgroundColor({ color: color });
  // 显式白字（Chrome 109+ 支持 setBadgeTextColor；旧版静默忽略，无副作用）
  // 不显式设的话 Chrome 会按背景明度自动选黑白，红绿这种中等明度易被错判为黑字
  if(chrome.action.setBadgeTextColor){
    chrome.action.setBadgeTextColor({ color: '#ffffff' });
  }
}
chrome.runtime.onMessage.addListener(function(msg){
  if(msg && msg.type === 'updateBadge' && typeof msg.pnl === 'number'){
    setBadge(msg.pnl);
  }
});

/* ============== 浮窗版数据桥 ==============
   浮层是 content script，跑在网页源里，读不到扩展的存储；
   这里代它读扩展的 chrome.storage.local 并回传。
   注意：MV3 后台是 service worker，没有 localStorage / document，
   持仓只能存放在 chrome.storage.local（由 dashboard.html 镜像写入）。
   同时支持把「隐藏浮窗」状态持久化，以及由工具栏图标点击转发的「打开完整看板」动作。 */
var FLOAT_KEYS = ['fund_board_holdings_v2', 'fund_board_holdings_v1', 'fund_board_stocks_v1', 'fund_board_fx_v1', 'float_hidden'];
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse){
  if(!msg) return;
  if(msg.type === 'floatInit'){
    chrome.storage.local.get(FLOAT_KEYS, function(o){
      function rd(k){ try{ var s = o[k]; return (s === null || s === undefined) ? null : JSON.parse(s); }catch(e){ return null; } }
      sendResponse({
        ok: true,
        holdings: rd('fund_board_holdings_v2') || rd('fund_board_holdings_v1'),
        stocks: rd('fund_board_stocks_v1'),
        fx: rd('fund_board_fx_v1'),
        hidden: o.float_hidden === '1'
      });
    });
    return true; // 异步 sendResponse，必须返回 true
  }
  if(msg.type === 'floatStore' && typeof msg.key === 'string'){
    if(msg.val === null || msg.val === undefined){
      chrome.storage.local.remove(msg.key, function(){ sendResponse({ ok: true }); });
    } else {
      var pair = {}; pair[msg.key] = String(msg.val);
      chrome.storage.local.set(pair, function(){ sendResponse({ ok: true }); });
    }
    return true; // 异步 sendResponse
  }
  if(msg.type === 'openDashboard'){
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    sendResponse({ ok: true });
    return true;
  }
});

/* ============== 跨域请求代理 ==============
   MV3 扩展页面 fetch 受 CSP connect-src 限制 + 部分服务端（push2.eastmoney.com）
   对来源页 Referer 严格校验：用 service worker 中转一次，host_permissions 已声明 eastmoney，
   SW context 发 fetch 可带正确 Referer / UA，避免被服务端静默 hang up。

   协议：
     -> chrome.runtime.sendMessage({type:'xfetch', url, opts})
     <- {ok:true, status, body} 或 {ok:false, error, retries}
   body 始终是文本（JSON 接口由调用方 JSON.parse）。
   不做白名单校验——只有 dashboard.html 会调，没有外部攻击面。 */
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse){
  if(!msg || msg.type !== 'xfetch') return;

  /* Referer 是 fetch 的「禁止设置请求头」(forbidden header name)，直接写进 headers 会被浏览器
     静默丢弃。东财系 JSON 接口（如 F10 lsjz）强制校验 Referer，缺失会返回 {"Data":"","ErrCode":-999}。
     正确做法是用 fetch 的 referrer 初始化参数来带（这是规范允许、唯一能生效的方式）。
     按域名给不同的 referrer：push2 系对应 quote，新浪对应 finance.sina，其余默认 fund。 */
  function hostReferer(url){
    var u;
    try{ u = new URL(url); }catch(_){ return 'https://fund.eastmoney.com/'; }
    var host = u.hostname;
    if(/push2.*\.eastmoney\.com/.test(host)) return 'https://quote.eastmoney.com/';
    if(/stock\.finance\.sina/.test(host)) return 'https://finance.sina.com.cn/';
    /* 公告详情接口（np-cnotice / np-anotice）：公告详情页本身在 data.eastmoney.com，按该域名给 referer */
    if(/np-(cnotice|anotice)/.test(host)) return 'https://data.eastmoney.com/';
    /* 行业资金流 dataapi（data.eastmoney.com/dataapi/bkzj/getbkzj，hy.html 同源）：给页面自身 referer */
    if(host === 'data.eastmoney.com') return 'https://data.eastmoney.com/bkzj/hy.html';
    return 'https://fund.eastmoney.com/';
  }

  /* User-Agent 同样按域名区分：fundmobapi 是移动端接口，桌面浏览器 UA 会被静默返回
     空 Datas（实测：桌面 UA→Datas:null，Android 移动 UA→正常）。其余接口（push2 系行情、
     新浪）保持桌面 UA 以规避风控。 */
  var DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  var MOBILE_UA = 'Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SP1A.210812.016) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
  function hostUserAgent(url){
    var host = '';
    try{ host = new URL(url).hostname; }catch(_){}
    if(/fundmobapi\.eastmoney\.com/.test(host)) return MOBILE_UA;
    return DESKTOP_UA;
  }

  async function doFetch(url, referer){
    const ua = hostUserAgent(url);
    const r = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrer: referer,
      referrerPolicy: 'unsafe-url',
      headers: {
        'User-Agent': ua,
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      }
    });
    // 腾讯快照 qt.gtimg.cn 返回 GBK，需显式按 GBK 解码（arrayBuffer + TextDecoder('gbk')）。
    // ⚠️ 只对腾讯域名走这条：其余主机一律保持 v177 的原实现 `await r.text()`，
    //    实测把全部主机改成 arrayBuffer+TextDecoder 后 F10 概况等 HTML 接口取不到正文。
    let host = '';
    try { host = new URL(url).hostname; } catch (_) {}
    const isGbk = /(?:^|\.)qt\.gtimg\.cn$/.test(host);
    let txt;
    if (isGbk) {
      const buf = await r.arrayBuffer();
      txt = new TextDecoder('gbk').decode(buf);
    } else {
      txt = await r.text();
    }
    return { status: r.status, body: txt, ua: ua };
  }

  (async function(){
    var referer = hostReferer(msg.url);
    // 东财系 push2 接口在 Chrome 实例冷启动后第一次容易被风控拒（socket hang up / ERR_EMPTY_RESPONSE），
    // 间隔 600ms 重试一次通常能恢复；其余主机最多 3 次。
    //
    // v174：push2 系单独降为 2 次。本机对 push2*.eastmoney.com/api/qt/* 是「确定性 RST」——
    //   TCP 握手 89ms、TLS 握手 146ms 都正常，请求一发出就被重置（100~220ms 内）；
    //   实测连试 3 次全败、单接口白等约 2.2s，而一轮刷新要打 6~8 个这类接口，
    //   前端于是要 30~40s 才把首屏填满（排在后面的卡片看着像「没数据」）。
    //   第 3 次的边际收益≈0（前两次都在 200ms 内失败，多等 1200ms 不可能恢复），
    //   砍掉它既省 1.4s，也少发一轮注定失败的请求（拦截本身带 IP 速率特征，少打反而更稳）。
    //   push2 的路径/主机与前端「失败短路」相互独立：这里管「单次调用别死等」，
    //   前端管「一轮内同一接口不再重复打」。
    var isPush2Host = false;
    try{ isPush2Host = /^(?:\d+\.)?push2(?:his|delay|ex)?\.eastmoney\.com$/.test(new URL(msg.url).hostname); }catch(_){}
    var delays = isPush2Host ? [0, 600] : [0, 600, 1200];
    var lastErr = null;
    for(var i=0; i<delays.length; i++){
      if(delays[i] > 0) await new Promise(function(r){ setTimeout(r, delays[i]); });
      try{
        var res = await doFetch(msg.url, referer);
        if(res.status >= 200 && res.status < 400){
          sendResponse({ok: true, status: res.status, body: res.body, retries: i, ua: res.ua});
          return;
        }
        lastErr = 'http ' + res.status;
      }catch(e){
        lastErr = (e && e.message) || String(e);
      }
    }
    sendResponse({ok: false, error: lastErr, retries: delays.length});
  })();

  return true; // 异步 sendResponse
});

/* ============== 始终在线「单一数据源」：service worker 计算持仓快照 ==============
   看板 / 网页浮窗 / toolbar popup / 角标 全部只读 fund_board_calc 快照，
   由 SW 通过 chrome.alarms 每 60s 重算、并在浮窗/popup 请求 ensureSnapshot 时按需重算，
   保证「不打开全屏看板」时四处数字也完全一致。 */

// ---- 与 xfetch 同源的底层 fetch（带 Referer/UA，腾讯走 GBK 解码） ----
function bkHostReferer(url){
  var u; try{ u = new URL(url); }catch(_){ return 'https://fund.eastmoney.com/'; }
  var host = u.hostname;
  if(/push2.*\.eastmoney\.com/.test(host)) return 'https://quote.eastmoney.com/';
  if(/stock\.finance\.sina/.test(host)) return 'https://finance.sina.com.cn/';
  return 'https://fund.eastmoney.com/';
}
var BK_DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
var BK_MOBILE_UA = 'Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SP1A.210812.016) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
function bkHostUserAgent(url){
  var host=''; try{ host=new URL(url).hostname; }catch(_){}
  if(/fundmobapi\.eastmoney\.com/.test(host)) return BK_MOBILE_UA;
  return BK_DESKTOP_UA;
}
async function bkFetch(url){
  var referer=bkHostReferer(url), ua=bkHostUserAgent(url);
  var r=await fetch(url,{method:'GET',credentials:'omit',referrer:referer,referrerPolicy:'unsafe-url',headers:{'User-Agent':ua,'Accept':'*/*','Accept-Language':'zh-CN,zh;q=0.9'}});
  var host=''; try{ host=new URL(url).hostname; }catch(_){}
  var isGbk=/(?:^|\.)qt\.gtimg\.cn$/.test(host);
  var txt;
  if(isGbk){ var buf=await r.arrayBuffer(); txt=new TextDecoder('gbk').decode(buf); }
  else txt=await r.text();
  return { status:r.status, body:txt };
}
function bkOk(r){ return r && r.status>=200 && r.status<400; }

// ---- 解析（与 float.js / popup.js 同源） ----
function bkCurOf(code){ if(/^hk/i.test(code))return 'HKD'; if(/^us/i.test(code))return 'USD'; return 'CNY'; }
function bkFxRate(cur,fx){ return cur==='CNY'?1:(fx[cur]||1); }
function bkParseFundMobapi(body){
  var map={}; try{
    var j=JSON.parse(body); var arr=(j&&(j.Datas||j.datas))||[]; var today=new Date();
    arr.forEach(function(it){
      if(!it||!it.FCODE)return;
      var nav=parseFloat(it.NAV),chg=parseFloat(it.NAVCHGRT);
      var pd=(it.PDATE||'').replace(/\//g,'-');
      var y=pd.slice(0,4),m=pd.slice(5,7),d=pd.slice(8,10);
      var isToday=(y==today.getFullYear()&&m==(today.getMonth()+1)&&d==today.getDate());
      /* 与看板表格同源同优先级：盘中优先用东财官方盘中估值（GSZ/GSZZL，estType='official'），
         只有拿到今日有效 GSZ 才认（GZTIME 日期=今天 且 当前在 09:15-15:05，盘前残留旧 GSZ 不采信）；
         没有则回退官方净值口径，新浪估算随后只兜底、不覆盖 official。 */
      var gz=parseFloat(it.GSZ),gzzl=(it.GSZZL!==null&&it.GSZZL!==undefined&&it.GSZZL!=='')?parseFloat(it.GSZZL):NaN;
      var gzt=it.GZTIME||''; var gzDate=gzt.slice(0,10).replace(/\//g,'-');
      var nowMin=today.getHours()*60+today.getMinutes();
      var gzToday=(gzDate===today.getFullYear()+'-'+('0'+(today.getMonth()+1)).slice(-2)+'-'+('0'+today.getDate()).slice(-2));
      if(!isNaN(gz)&&!isNaN(gzzl)&&gzToday&&nowMin>=555&&nowMin<=905){
        map[it.FCODE]={gsz:gz,dwjz:isNaN(nav)?gz:nav,gszzl:gzzl,estType:'official',navDate:pd,name:it.SHORTNAME||it.FCODE};
      }else{
        map[it.FCODE]={gsz:isNaN(nav)?null:nav,dwjz:isNaN(nav)?null:nav,gszzl:isNaN(chg)?null:chg,estType:isToday?'nav':'yNav',navDate:pd,name:it.SHORTNAME||it.FCODE};
      }
    });
  }catch(e){}
  return map;
}
function bkParseQt(body){
  var stocks={},fx={}; var re=/v_([A-Za-z0-9_.]+)="([^"]*)"/g,m;
  while((m=re.exec(body))){
    var code=m[1],raw=m[2]; if(!raw)continue; var p=raw.split('~');
    if(/^fx/i.test(code)){ var rate=parseFloat(p[3]); if(!isNaN(rate))fx[code.replace(/^fx/,'').toUpperCase()]=rate; continue; }
    var price=parseFloat(p[3]),prev=parseFloat(p[4]);
    var pct=(price&&prev)?(price-prev)/prev*100:null;
    stocks[code]={price:price,prevClose:prev,pct:pct,name:p[1]||code};
  }
  return {stocks:stocks,fx:fx};
}
function bkSinaToday(){ var t=new Date(); return t.getFullYear()+'-'+('0'+(t.getMonth()+1)).slice(-2)+'-'+('0'+t.getDate()).slice(-2); }
async function bkFetchSinaEst(code){
  try{
    var r=await bkFetch('https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/FdFundService.getEstimateNetworthPic?symbol='+code);
    if(!bkOk(r))return null;
    var d=JSON.parse(r.body); d=(d&&d.result&&d.result.data)||{};
    var arr=d.networth||[]; if(!arr.length)return null;
    var lp=arr[arr.length-1];
    var prevNav=parseFloat(lp.pre_nav),pct=parseFloat(lp.nav_pct);
    if(isNaN(prevNav)||isNaN(pct))return null;
    /* 序列末点在盘中=今日实时估算；盘前/周末/节假日=上一交易日收盘估算（不可当今日估算用）。
       返回估算所属日期（pre_date，归一 YYYY-MM-DD），由调用方只放行 est.date===今天：
       盘前/周末拒掉后 SW 落到官方 NAVCHGRT（yNav 口径），与看板 showYesterdayView
       （非交易日/9:30 前强制显示昨日官方净值）完全一致。
       🔴 2026-10-17 周六实测：无日期门槛时 SW 把「昨估算−昨官方净值」的估算误差当成今日盈亏，
       SW 角标 +1k vs 看板 -384 两套数字。 */
    /* 🔴 新浪字段语义实锤（2026-10-15 四基金对质）：pre_nav ≠ 昨收净值，而是
       「今日估算净值」= 官方昨收 × (1+nav_pct/100)。返回原始字段由调用方合并：
       gsz=pre_nav（今日估算净值），官方昨收由东财 NAV 提供、缺失时用 pre_nav/(1+pct/100) 反推。 */
    var ed=(typeof lp.pre_date==='string')?lp.pre_date.replace(/\//g,'-'):'';
    return {gsz:+prevNav.toFixed(4),pct:pct,date:ed};
  }catch(e){return null;}
}
/* ---- 结算口径精度对齐（2026-10-17）----
   盘前/周末/节假日（estType='yNav'）时看板「昨日盈亏」= 市值 × 走势序列末两点反算的涨跌幅（全精度）；
   而 mobapi 的 NAVCHGRT 只有 2 位小数 → SW 与看板差 ±2~4 元（实测 角标/浮窗 -386 vs 看板 -384）。
   这里按 (代码, NAV日期) 缓存一次 pingzhongdata 的末两点涨跌幅，仅当走势末点日期 === 该基金 NAV 日期
   时采信（防走势滞后一天用错涨跌幅）；缓存落 chrome.storage.local，同一 NAV 日只拉一次
   （pingzhongdata 单文件 300~700KB，绝不能每分钟拉）。 */
function bkExtractArr(txt,name){
  var i=txt.indexOf('var '+name+' '); if(i<0)return null;
  var s=txt.indexOf('[',i); if(s<0)return null;
  var d=0,inStr=false,esc=false;
  for(var k=s;k<txt.length;k++){
    var ch=txt.charAt(k);
    if(inStr){ if(esc)esc=false; else if(ch==='\\')esc=true; else if(ch==='"')inStr=false; continue; }
    if(ch==='"'){ inStr=true; continue; }
    if(ch==='[')d++;
    else if(ch===']'){ d--; if(!d)return txt.slice(s,k+1); }
  }
  return null;
}
async function bkTrendPct(code){
  try{
    var r=await bkFetch('https://fund.eastmoney.com/pingzhongdata/'+code+'.js?t=1');
    if(!bkOk(r))return null;
    var raw=bkExtractArr(r.body,'Data_netWorthTrend'); if(!raw)return null;
    var arr=JSON.parse(raw); if(!arr||arr.length<2)return null;
    var last=arr[arr.length-1],prev=arr[arr.length-2];
    var y1=Number(last.y),y0=Number(prev.y);
    if(!(y0>0)||!isFinite(y1))return null;
    var d=new Date(last.x);
    var ds=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
    return {date:ds,pct:(y1/y0-1)*100};
  }catch(e){ return null; }
}
async function bkApplySettlePct(fundInfo){
  var codes=Object.keys(fundInfo).filter(function(c){ var i=fundInfo[c]; return i&&i.estType==='yNav'; });
  if(!codes.length)return;
  var cache=await new Promise(function(res){
    chrome.storage.local.get('fund_settle_pct_v1',function(o){
      var c={}; try{ c=JSON.parse((o&&o.fund_settle_pct_v1)||'{}')||{}; }catch(e){ c={}; }
      res(c);
    });
  });
  var dirty=false;
  await Promise.all(codes.map(function(code){
    var info=fundInfo[code], hit=cache[code];
    if(hit&&hit.date===info.navDate&&isFinite(hit.pct)){ info.gszzl=hit.pct; return null; }
    return bkTrendPct(code).then(function(t){
      if(!t)return;
      cache[code]={date:t.date,pct:t.pct}; dirty=true;
      if(t.date===info.navDate){ info.gszzl=t.pct; } /* 走势末点=NAV 日才采信 */
    });
  }));
  if(dirty){
    try{ if(Object.keys(cache).length>80){ cache={}; } var p={}; p.fund_settle_pct_v1=JSON.stringify(cache); chrome.storage.local.set(p); }catch(e){}
  }
}
function bkCalcFundPnl(h,fundInfo,fx){
  var info=fundInfo[h.code]||null; var r={mv:null,pnl:null,cum:null};
  if(!info||!((info.gsz!=null)||(info.dwjz!=null))||!h.shares)return r;
  var mv=h.shares*(info.gsz!=null?info.gsz:info.dwjz); r.mv=mv;
  if(info.estType==='nav'&&info.gszzl!=null){ r.pnl=mv*info.gszzl/100; }
  else if(info.estType==='yNav'&&info.gszzl!=null){ r.pnl=mv*info.gszzl/100; }
  else if(info.gsz!=null&&info.dwjz!=null){ r.pnl=h.shares*(info.gsz-info.dwjz); }
  else if(info.gszzl!=null){ r.pnl=mv*info.gszzl/100; }
  if(h.cost!=null&&info.dwjz!=null){ var cb=h.shares*h.cost; r.cum=h.shares*info.dwjz-cb; }
  return r;
}
function bkCalcStockPnl(s,stockInfo,fx){
  var info=stockInfo[s.code]||null; var r={mv:null,pnl:null,cum:null,cur:bkCurOf(s.code)};
  if(!info||info.price==null||!s.shares)return r;
  r.mv=s.shares*info.price;
  if(info.prevClose)r.pnl=s.shares*(info.price-info.prevClose);
  if(s.cost)r.cum=s.shares*(info.price-s.cost);
  return r;
}

var lastComputeTs=0, lastPnl=0;
async function computeSnapshot(){
  /* 看板活跃让位：看板 90s 内发布过快照（writer==='dash'）→ SW 不重算、不覆盖。
     新浪分钟级估值每 1~2 分钟滚一个点，两个计算器在不同时刻取数必有分钟级小差；
     让位后「看板打开期间全屏只有一个计算器（看板）」，popup/浮窗/角标经 onChanged
     跟随看板发布的那一份，四处数字数学上必然一致；看板关闭 90s 后 SW 才接管。 */
  var yieldToDash = await new Promise(function(res){
    chrome.storage.local.get('fund_board_calc', function(o){
      var s=o&&o.fund_board_calc;
      res(!!(s&&s.writer==='dash'&&(Date.now()-(s.ts||0)<90000)));
    });
  });
  if(yieldToDash){
    chrome.storage.local.get(['fund_board_calc','float_privacy'], function(o){
      var s=o&&o.fund_board_calc;
      if(s&&typeof s.totPnl==='number'&&o.float_privacy!=='1') lastPnl=s.totPnl; /* 隐私切换回滚时用看板值 */
      lastComputeTs=Date.now();
    });
    return null;
  }
  return new Promise(function(resolve){
    chrome.storage.local.get(['fund_board_holdings_v2','fund_board_holdings_v1','fund_board_stocks_v1','fund_board_fx_v1','float_privacy'], function(o){
      function rd(k){ var s=o[k]; if(s===null||s===undefined)return null; try{return JSON.parse(s);}catch(e){return null;} }
      var holdings=rd('fund_board_holdings_v2')||rd('fund_board_holdings_v1')||[];
      var stocks=rd('fund_board_stocks_v1')||[];
      var priv=(o&&o.float_privacy==='1');
      if(!holdings.length&&!stocks.length){ lastComputeTs=Date.now(); resolve(null); return; }
      (async function(){
        try{
          var fundCodes=holdings.map(function(h){return h.code;}).filter(Boolean);
          var stockCodes=stocks.map(function(s){return s.code;}).filter(Boolean);
          var needFx=stocks.some(function(s){return bkCurOf(s.code)!=='CNY';});
          var fxCodes=['fxUSDCNY','fxHKDCNY'];
          var fundInfo={},stockInfo={},fx={USD:7.0,HKD:0.90};
          if(fundCodes.length){
            var fr=await bkFetch('https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=200&plat=Android&appType=ttjj&product=EFund&Version=1&deviceid=fundboard&Fcodes='+fundCodes.join(','));
            if(bkOk(fr))fundInfo=bkParseFundMobapi(fr.body);
            var ests=await Promise.all(fundCodes.map(bkFetchSinaEst));
            ests.forEach(function(est,i){ var code=fundCodes[i]; if(!est)return; var cur=fundInfo[code]||{}; if(cur.estType==='nav'||cur.estType==='official')return; /* 今日官方净值已公布或已有东财盘中估值（与看板同源） → 不被新浪估算覆盖 */
              if(est.date!==bkSinaToday())return; /* 🔴 只认今日估算：盘前/周末末点是上一交易日收盘估算，放行会把估算误差当今日盈亏（2026-10-17 周六实测 SW+1k vs 看板-384）；拒掉后落 yNav 官方口径，与看板 showYesterdayView 一致 */
              /* gsz=新浪 pre_nav=今日估算净值；dwjz=官方昨收（东财 NAV 优先，缺失时 pre_nav/(1+pct/100) 反推）——
                 pnl = 份额×(gsz−dwjz) = 份额×官方昨收×pct/100，与看板表格同口径 */
              var dwjz=(cur.dwjz!=null&&!isNaN(cur.dwjz))?cur.dwjz:(est.pct?(est.gsz/(1+est.pct/100)):null);
              fundInfo[code]={gsz:est.gsz,dwjz:dwjz,gszzl:est.pct,estType:'est',name:(cur&&cur.name)||code}; });
            /* 仍处于 yNav（盘前/周末/节假日）→ 用走势反算全精度涨跌幅，和看板「昨日盈亏」对齐 */
            await bkApplySettlePct(fundInfo);
          }
          if(stockCodes.length||needFx){
            var all=stockCodes.concat(needFx?fxCodes:[]);
            var sr=await bkFetch('https://qt.gtimg.cn/q='+all.join(','));
            if(bkOk(sr)){ var p=bkParseQt(sr.body); stockInfo=p.stocks; if(needFx&&p.fx.USDCNY)fx.USD=p.fx.USDCNY; if(needFx&&p.fx.HKDCNY)fx.HKD=p.fx.HKDCNY; }
          }
          var totMv=0,hasMv=false,totPnl=0,hasPnl=false,totCum=0,hasCum=false;
          var fMv=0,fPnl=0,fCum=0,sMv=0,sPnl=0,sCum=0;
          holdings.forEach(function(h){ var r=bkCalcFundPnl(h,fundInfo,fx); if(r.mv!=null){totMv+=r.mv;fMv+=r.mv;hasMv=true;} if(r.pnl!=null){totPnl+=r.pnl;fPnl+=r.pnl;hasPnl=true;} if(r.cum!=null){totCum+=r.cum;fCum+=r.cum;hasCum=true;} });
          stocks.forEach(function(s){ var r=bkCalcStockPnl(s,stockInfo,fx); var fxr=bkFxRate(r.cur,fx); if(r.mv!=null){var m=r.mv*fxr;totMv+=m;sMv+=m;hasMv=true;} if(r.pnl!=null){var p=r.pnl*fxr;totPnl+=p;sPnl+=p;hasPnl=true;} if(r.cum!=null){var c=r.cum*fxr;totCum+=c;sCum+=c;hasCum=true;} });
          var snap={ts:Date.now(),fundInfo:fundInfo,stockInfo:stockInfo,fx:{USD:fx.USD,HKD:fx.HKD},
            totMv:hasMv?Math.round(totMv):null, totPnl:hasPnl?Math.round(totPnl):null, totCum:hasCum?Math.round(totCum):null,
            totMvFund:Math.round(fMv), totPnlFund:Math.round(fPnl), totCumFund:Math.round(fCum),
            totMvStock:Math.round(sMv), totPnlStock:Math.round(sPnl), totCumStock:Math.round(sCum)};
          chrome.storage.local.set({fund_board_calc:snap},function(){
            lastComputeTs=Date.now();
            if(hasPnl){ lastPnl=totPnl; setBadge(priv?0:totPnl); }
            else if(priv){ setBadge(0); }
            resolve(snap);
          });
        }catch(e){ lastComputeTs=Date.now(); resolve(null); }
      })();
    });
  });
}

// 隐私模式切换 → 立即刷新角标（不重算行情，仅用上次汇总值）
try{
  chrome.storage.onChanged.addListener(function(changes,area){
    if(area==='local'&&changes.float_privacy!==undefined){
      var priv=(changes.float_privacy.newValue==='1');
      setBadge(priv?0:lastPnl);
    }
  });
}catch(e){}

// 定时重算（每 60s）+ 安装/启动即算一次
if(chrome.alarms){
  try{ chrome.alarms.create('calcSnap',{periodInMinutes:1}); }catch(e){}
  chrome.alarms.onAlarm.addListener(function(a){ if(a&&a.name==='calcSnap') computeSnapshot(); });
}
if(chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(function(){ computeSnapshot(); });
if(chrome.runtime.onInstalled) chrome.runtime.onInstalled.addListener(function(){ computeSnapshot(); });

// ensureSnapshot：浮窗/popup 打开时按需重算（30s 内合并，避免重复打接口）
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse){
  if(!msg) return;
  if(msg.type==='ensureSnapshot'){
    if(Date.now()-lastComputeTs < 30000){ try{sendResponse({ok:true,cached:true});}catch(e){} return true; }
    computeSnapshot().then(function(s){ try{sendResponse({ok:true,fresh:!!s});}catch(e){} }).catch(function(){ try{sendResponse({ok:false});}catch(e){} });
    return true;
  }
});