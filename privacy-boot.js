/* v1.1.2 隐私打码「启动前置」脚本
   作用：在页面任何内容绘制之前，先把已保存的隐私状态落到 <html> 上，
   避免刷新时出现「睁眼图标 / 明文金额」的首帧闪现。
   MV3 页面禁止内联脚本，故独立成文件；主逻辑仍在 dashboard.js 的 applyPrivacyMask()。 */
(function(){
  try{
    if(localStorage.getItem('pd_privacyMask') === '1'){
      document.documentElement.classList.add('pv-boot');
    }
  }catch(e){}
})();
