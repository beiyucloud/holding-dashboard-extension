// 扩展后台：点击工具栏图标 → 在新标签页打开看板
chrome.action.onClicked.addListener(function () {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

/* ============== 角标：显示今日盈亏 ==============
   扩展页 (dashboard.js) 每次刷新完数据，把今日盈亏金额推过来；
   SW 调用 chrome.action.setBadgeText/setBadgeBackgroundColor 渲染在工具栏图标右上角。
   中国股市惯例：红涨绿跌，所以盈利=红底、亏损=绿底（与左侧"1.2k"那个红角标风格一致）。
   Badge 文本限 4 字符：>=10000→w, >=1000→k, <1000 整数。金额<1 元或无效则清空角标。
   协议：-> {type:'updateBadge', pnl:number} */
function fmtBadgePnl(pnl){
  if(pnl === null || pnl === undefined || !isFinite(pnl)) return '';
  var abs = Math.abs(pnl);
  if(abs < 1) return '';
  var sign = pnl >= 0 ? '+' : '-';
  var s;
  if(abs >= 10000){ s = Math.round(abs/10000) + 'w'; }       // 1w / 12w / 99w（整数 w，万以上同档）
  else if(abs >= 1000){ s = Math.round(abs/1000) + 'k'; }    // 1k / 12k
  else { s = Math.round(abs).toString(); }                    // 99 / 820
  s = s.replace(/\.0(w|k)$/, '$1');                           // 1.0w → 1w；1.0k → 1k（防 toFixed 副作用）
  var txt = sign + s;
  // Chrome badge 硬上限 4 字符；>4 时再砍精度（理论上 w 分支已控住，截断为保底）
  return txt.length > 4 ? txt.slice(0, 4) : txt;
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
    return 'https://fund.eastmoney.com/';
  }

  async function doFetch(url, referer){
    const r = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrer: referer,
      referrerPolicy: 'unsafe-url',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      }
    });
    const txt = await r.text();
    return { status: r.status, body: txt };
  }

  (async function(){
    var referer = hostReferer(msg.url);
    // 东财系 push2 接口在 Chrome 实例冷启动后第一次容易被风控拒（socket hang up / ERR_EMPTY_RESPONSE），
    // 间隔 600ms 重试一次通常能恢复；最多 3 次。
    var delays = [0, 600, 1200];
    var lastErr = null;
    for(var i=0; i<delays.length; i++){
      if(delays[i] > 0) await new Promise(function(r){ setTimeout(r, delays[i]); });
      try{
        var res = await doFetch(msg.url, referer);
        if(res.status >= 200 && res.status < 400){
          sendResponse({ok: true, status: res.status, body: res.body, retries: i});
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