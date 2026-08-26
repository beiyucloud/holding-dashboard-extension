/* privacy.html 主题同步：与 dashboard 同源（chrome-extension://<id>/）共享 localStorage，
   读取看板持久化的 fund_board_theme（'light' / 'dark'）。
   必须在渲染前同步执行（本文件以 <script src> 引入、位于 <head>，CSP 允许 'self'），
   MV3 的 script-src 'self' 会屏蔽内联脚本，故必须走外部文件。 */
(function(){
  function apply(){
    var t = 'dark';
    try{
      var s = localStorage.getItem('fund_board_theme');
      if(s === 'light' || s === 'dark') t = s;
    }catch(e){}
    if(t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.setAttribute('data-theme', 'dark'); /* 显式 dark，避免继承父级 */
  }
  apply();
  /* 看板页切换主题时实时跟随（storage 事件跨同源标签页广播） */
  window.addEventListener('storage', function(ev){
    if(ev.key === 'fund_board_theme') apply();
  });
})();
