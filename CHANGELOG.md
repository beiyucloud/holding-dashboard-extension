# 更新日志

## v1.0.7（2026-08-26）
### 修复
- **基金公告提醒精准打开修复**：基金品种的公告提醒之前借用了股票公告的全文搜索接口，对基金代码（如 110022）全文匹配会混入无关股票噪声（沈信股份 / 欣禧股份 / 汇源股份 / 盛航股份等，其办公地址邮编或财报科目序号里恰好含该数字串），点开公告详情是别人的公告而非基金自己的。修复：把 v49 为股票分支加的 `securityShortName === selfName` 严格匹配过滤扩展到基金分支（`fundInfo[code].name` 取自 fundmobapi `SHORTNAME`，与搜索 `securityShortName` 同一短名体系），噪声被拒、真基金公告（产品资料概要 / 季度报告 / 合同公告等）通过；详情接口 `np-cnotice-stock.eastmoney.com` 对基金 artCode 直接返回完整正文，无需换接口。
- **公告弹窗「打开原文」按钮改用 PDF 原件链接**：之前按钮 href 写的是 `data.eastmoney.com/notices/detail/{artCode}.html`，实测该 HTML 路径已被东财服务端 302 跳转到 `/notices/` 公告列表页，用户在浏览器新标签看到的是东财公告列表而非海看股份自己的公告——形同未打开。修复：`fetchNoticeBody` 解析东财 API 返回时一并取 `data.attach_url` / `data.attach_url_web`（CDN 上的公告 PDF 原件链接，HTTP 200 + `application/pdf`，浏览器内置 PDF viewer 直接渲染），按钮 href 改为这个 PDF URL，文案改为「打开 PDF 原文 ↗」；新增 `updateOrigBtn(el, attachUrl)` helper 处理三态：拉取中（aria-disabled + "正在加载 PDF 链接…"）/ 拿到 PDF（放出来 + 新标签打开）/ 拉取失败或接口无 PDF（禁用 + 改文案提示）。按钮 CSS 加 `.btn[aria-disabled="true"]{opacity:.45;pointer-events:none;cursor:not-allowed;}`。
- **语义版本号 1.0.6 → 1.0.7**（`manifest.json`）。

> 发布状态：本地 `ext/` 已就绪（commit 待打 v1.0.7 tag），**待推送**——GitHub / 官网 / Edge 商店三处发布在收到「推送」指令后执行。

## v1.0.6（2026-08-26）
### 优化 / 修复（累计 v47–v52）
- **「我的股票」表列序重排**：「市值(元)」挪到「现价」之后、「涨跌幅」挪到「成本价」之后（基础→仓位→涨跌→收益归类更整齐）；合计行市值同步挪位，合计涨跌幅栏留空（加总无意义）。
- **批量编辑保存丢失「类型」字段修复**：`saveStockBatch` 漏写 `type`，凡走过一次批量保存该股票 type 被擦成 undefined → 渲染兜底成「其他」。修复：`saveStockBatch` 补 `type`（`prevTypeMap` 沿用原 type 或 `classifyStockType` 重分类）；`renderStocks` 渲染兜底 `s.type || classifyStockType(s.code).cls`（只显示不写回），存量「全部其他」立即恢复。
- **公告类提醒可点开查看详情**：提醒记录公告行可点，尾部「查看详情 ›」蓝色小尾巴；点击在扩展内弹窗拉取东财公告正文（走 SW 中转带 referer，宽容解析字段），失败给「重试」+「打开原文 ↗」双重兜底（原文链接恒可点）。价格类（涨跌幅）提醒不受影响。
- **修复 v49 公告弹窗「点不了」**：v49 `renderAlertLog` 误调不存在的 `escAttr()`，渲染到第一条公告即抛 `ReferenceError` 中断整段渲染。改为 `escHtml`（本身已转义引号）+ 分支加固：新结构化公告→内联弹窗，旧纯文本公告→按标题跳东财搜索，价格条目保持原样。
- **浅色主题识别卡片字体对比提升**：添加持仓弹窗识别卡（`ident-card`/`seg.active`）浅色下原用透明蓝渐变 + 白字反差差；改为浅色专用实色深蓝渐变（`#2f6fe0→#1849b8`）+ 白字 + 阴影，与未选中卡（面板底 + 深色字）层次分明；深色保持原观感。
- **隐私政策页跟随浅 / 深主题**：`privacy.html` 变量化并新增 `[data-theme="light"]` 覆盖；修 MV3 CSP 兼容——原内联 `<script>` 被 `script-src 'self'` 屏蔽（导致「没变化」），改为外部 `privacy.js`（`'self'` 合法），读取与看板同源共享的 `fund_board_theme` 并监听 `storage` 事件实时跟随。
- **语义版本号 1.0.5 → 1.0.6**（`manifest.json`）。

> 发布状态：随 v1.0.6 发布流程同步（GitHub main + tag v1.0.6 + Release 含 zip；官网 beiyucloud.taoxinyuan.com 上线 v1.0.6；Edge 加载项商店提交审核）。

## v1.0.5（2026-08-25）
### 优化
- **提醒面板合并：顶部"仅停提醒"芯片并入单品种阈值行（基金/股票）**
  - 顶部"当前提醒监控"块去除，每只基金/股票行的最右侧直接放「关闭提醒」按钮 / 停后变「恢复提醒」（行变灰）。同一只股票不再在两处出现。
  - 基金也补齐"单只停提醒"能力（新增 `fundMuted`，与 `stockMuted` 平行；`defaultAlerts` 默认 `{}`，估算涨幅循环跳过已停项）。
  - 实现：`dashboard.html` 删监控摘要 div + 旧 `.monitor-scope`/`.stk-scope` 样式、新增行内 `.row-act`/`.is-muted`，按钮由圆形 × 改为小文字标签（"关闭提醒"/"恢复提醒"，同 4 字宽避免抖动），窄屏(≤768px)减小间距与输入框宽度以避免按钮被裁；`dashboard.js` 删 `renderMonitorScope`，新增 `renderAlertRows` + `muteFundAlert`/`unmuteFundAlert` + `toggleRowMute`（局部切行，不重渲整个列表，避免把未保存的阈值输入清掉）。
- **扩展内新增「隐私政策」入口**
  - 看板页脚新增「隐私政策」文字链接，点击在扩展内新标签页打开 `privacy.html`（本地文件、无需联网），与「数据全部存本地、不上云」的隐私主张一致。
  - 同步将页脚展示用「看板版本」从 v32 升到 v33（2026-08-25）。
- **CI：Edge 自动发布 workflow 修复**
  - `.github/workflows/release-edge.yml` 增加 `permissions: { contents: read, issues: write }`，避免「失败通知」step（actions/github-script 创建 issue）因默认 GITHUB_TOKEN 只读而报 `Resource not accessible by integration`。
  - 仓库 Secrets 补齐 `EDGE_API_KEY` / `EDGE_CLIENT_ID` / `EDGE_PRODUCT_ID`，以后推 `v*` tag 即可自动打包并向 Edge 商店提交审核。

> 发布状态：已推送 GitHub（main + tag v1.0.5 + Release 含 zip/crx）；官网 beiyucloud.taoxinyuan.com 同步上线 v1.0.5；Edge 加载项商店审核中。

## v1.0.4（2026-08-19）

### 修复 / 优化
- **桌面通知标题改为「持仓看板提醒」**
  - 修复：通知标题原本写死「基金看板提醒」，但看板早已支持股票 / ETF / LOF / 可转债 / REITs 等场内品种，标题局限在"基金"会误导用户以为只有基金在提醒。
  - 现在：`dashboard.js` 中 `pushNotify('基金看板提醒', msg)` 改为 `pushNotify('持仓看板提醒', msg)`（与测试授权通知标题「持仓看板通知」保持一致）。
- **Edge 商店描述补全「股票 / 场内基金实时行情」**
  - `manifest.json` description 由「本地持仓盈亏/基金估值/价格异动提醒看板」改为「本地持仓盈亏/基金估值/股票·场内基金(ETF·LOF·可转债·REITs)实时行情/价格异动提醒看板」，避免商店页只提基金、漏掉已支持的全品类。
- **全局阈值过低提示文案去「基金」本位**
  - `dashboard.js` 中"偏低，基金日常波动易触发噪音"改为"偏低，持仓日内波动易触发噪音"——股票日内波动更猛，单提基金不准确。
- **空持仓 UX 收口（卡片按需显示 + 今日盈亏占位）**
  - 修复：未添加任何基金 / 股票时，页面仍空跑两张「我的基金 / 我的股票」卡片（含"暂无持仓"提示行），既占空间又让今日盈亏卡出现空洞的 `0`。
  - 现在：
    - 「我的基金」section（`#fundSection`）= `holdings.length === 0` 时**整段（标题 + 表）一起隐藏**；
    - 「我的股票」section（`#stockSection`）= `stocks.length === 0` 时**整段隐藏**；
    - 「今日盈亏」汇总卡：基金 + 股票都未持仓时，主数字显示灰色「**未持仓**」、基金/股票拆分行也落「未持仓」、累计盈亏 chip 与市值副框复位为占位（录入提示 / `--`），不再显示空洞的 `0`。
  - 只要任一品种有持仓，对应 section 与今日盈亏卡按原逻辑正常显示。
- **「今日盈亏」拆分两行严格对称（基金/股票各自"未持仓"占位）**（补丁）
  - 修复：上一条空持仓 UX 收口只处理了"两都为空"和"无股票有基金"两种场景。当「**有股票无基金**」时，基金那一行仍回退到 `fmtSigned(0) = "0"`，与"有基金无股票"时的"未持仓"提示不对称。
  - 根因：`updateSummary` 里 `pnlFund / pnlStock` 用一个 `if(sRes.count > 0){...} else {...}` 同时设两行，"有股票"分支走 `fmtSigned(fSplit, 0)`，所以 `fSplit=0` 时基金那行显示 `0`。
  - 现在：拆成两个独立 `if/else`，分别按 `fRes.fundCount > 0` / `sRes.count > 0` 判定——无持仓品种统一显示灰色「未持仓」（`className='val muted'`），有持仓品种显示数值与红绿。
- **批量编辑面板「删除」按钮无功能修复**（补丁）
  - 修复：用户点击「批量编辑持仓」里的「删除」链接没有任何反应，被误判为无功能。
  - 根因：HTML 上挂了 `data-act="rowDel"`，但全文件从未定义 `window.rowDel` 函数——MV3 单根委托找不到处理函数就静默丢弃（`dashboard.js:9` `bindMv3Delegation`）。
  - 现在：补上 `rowDel(e)` 函数（`dashboard.js:1244-1252`）从 DOM 移除当前 `<tr>`，保存时按剩余 tr 收集，被删行自然不写入新持仓；若删到一格不剩自动补一行空行。同时给两个删除链接加 `data-args='["event"]'` 让事件透传；`.row-del` 加 `:hover { text-decoration: line-through; opacity: .75; }` 视觉反馈。
- **新增「官网」入口（beiyucloud.taoxinyuan.com）**
  - 看板 UI 新增指向落地页（使用说明 / 下载 / 更新日志 / 常见问题）的入口，方便用户从扩展内直接访问官方站点。
  - 顶栏：在「☕ 打赏」按钮前新增「官网」按钮，点击新标签页打开 `https://beiyucloud.taoxinyuan.com`（`<a class="btn" target="_blank" rel="noopener noreferrer">` 直跳，无需 JS、不受扩展 CSP `connect-src` 限制）。
  - 底部 footer：版权 / 数据通道行追加「持仓实时盈亏看板」文字链接（同域名新标签页打开）。
  - `manifest.json` 新增 `homepage_url` = `https://beiyucloud.taoxinyuan.com`，商店详情页展示「主页」链接。

## v1.0.3（2026-08-17）

### 修复 / 优化
- **顶部状态标签改用「真实数据」判定**
  - 修复：收盘后即便当日净值已公布，顶部仍一直显示「收盘后·显示收盘估值（待净值公布）」。
  - 现在：当 `marketStatus()` 检测到本次拉到的基金里已有 `estType = nav`（即今日 NAV 已公布），自动把顶部标签切到「**净值已公布 · MM-DD HH:MM**」，避免「永远待」的误读。
  - 判定窗口：仅覆盖盘后时段（`afterClose=true`），不影响盘中「实时估值」与盘前/周末「昨日净值」的标签。
- **「净值已公布」日期格式修正（补丁）**
  - 修复：之前用 `(\d{2})-(\d{2})` 在 `gztime="2026-08-26 已更新"` 上从最左匹配，会撞到「2026-08」里的"26-08"（年份前两位被当成月份），结果显示成 `净值已公布 · 26-08`。
  - 现在：日期直接取权威源 `info.navDate.slice(5, 10)` 切 MM-DD（"2026-08-26" → "08-26"），`gztime` 只抓 `HH:MM`，输出 `08-26 14:30` 或 `08-26 已公布`。
- **角标「1 位小数四舍五入」格式（bg.js）**
  - 之前：1000~9999 整数 k（1189 → "1k"）、10000+ 整数 w，损失精度。
  - 现在：1000~9999 → 1 位小数 k（1189 → "1.2k"）；10000~99999 → 1 位小数 w（12345 → "1.2w"）；100000+ → 整数 w（123456 → "12w"）兜底，避免 4 字符硬限溢出。
  - 不再带 `+`/`-` 符号——方向完全交给背景色红/绿（红涨绿跌，bg.js line 31 已实现）。带符号 1 位小数 k/w 是 5 字符，硬上限 4 字符带不动。
- **「清空持仓后刷新不再回填默认示例」（dashboard.js）**
  - 修复：用户把默认 3 只示例基金（161725 / 110022 / 003096）全删或全编辑后，刷新页面 / 重开看板时，3 只默认示例又会被重新塞回，用户的真实持仓被覆盖。
  - 根因：`loadHoldings()` 用 `Array.isArray(h) && h.length` 判"已初始化"，把「空数组」误判成「未初始化」，于是回退到内置种子并 `saveHoldings()` 写回 localStorage。
  - 现在：改成 `getItem(key) !== null` 才认作"已初始化"，空数组也会被尊重（用户主动清空 = 保持空）。仅在「从未打开过本扩展」时才会一次性看到默认 3 只作为引导。

## v1.0.2（2026-08-17）

### 修复 / 优化
- **持有收益率改用「已结算净值」口径**
  - 盘中、盘后（净值未公布）时段，持有收益率与累计盈亏不再随实时估算净值跳动，固定显示**上一交易日确认净值**；
  - 仅当当日新净值公布（`estType = nav`）后，才自动更新为最新值。
  - 一句话：估值不显示持有收益率这项，只显示已结算的。
- 今日盈亏、估算涨幅仍按实时估值显示（保留原有口径，便于盘中跟踪当日波动）。
- 同步更新看板底部「计算口径」说明文案，明确持有收益率的已结算口径。

### 影响范围
基金表「持有收益率」列、合计行「累计盈亏」、顶部卡「持有收益率」三处展示统一为已结算口径。

---

## v1.0.1（2026-08-11）
- 上架 Microsoft Edge 加载项商店（一键安装、无安全警告、自动更新）。
- 补充隐私说明页（privacy.html）。

## v1.0.0
- 首个发布版本：本地持仓盈亏 / 基金估值 / 价格异动提醒看板，数据全部存本地、不上云。
