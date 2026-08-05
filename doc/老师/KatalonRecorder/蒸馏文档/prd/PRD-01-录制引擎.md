# PRD-01 录制引擎（Recorder Engine）产品需求文档

> 版本：v1.0
> 日期：2026-08-05
> 参考实现：Katalon Recorder 7.1.0（Chrome MV3）
> 配套技术文档：`_distill/tech/TECH-01-录制引擎.md`
> 本 PRD 描述的是**要造的东西**（个人版录制回放插件的录制引擎），不是 KR 的现状描述。凡引用 KR 行为处均标注 `文件:行号`。

---

## 1. 背景与目标

### 1.1 背景

浏览器自动化测试脚本的第一道门槛是"写定位器 + 组织操作序列"。手写成本高、易错。**录制器**通过监听真实用户操作，自动生成可回放的命令序列，把这道门槛降到零。

现有方案的问题：

| 方案 | 问题 |
|---|---|
| DevTools Network 录制 / HAR 回放 | 记录的是 HTTP 请求，无法还原用户意图；CSRF token、时序、鉴权全部失效，回放必挂 |
| Chrome DevTools Recorder（原生） | 输出格式封闭，扩展能力弱，无法与既有 Selenium 资产互通 |
| Selenium IDE | 已停止对新版 Chrome 的深度适配；架构基于 MV2 |
| Katalon Recorder 7.1.0 | 功能完整但含大量历史包袱：19 个事件 handler 中 11 个产出被注释或不可达；存在会**静默丢失用户输入**的缺陷（`content/recorder-handlers.js:135` 的 `document_start` 空集问题） |

### 1.2 目标

构建一个**最小、正确、可解释**的浏览器录制引擎：

| 目标 | 度量 |
|---|---|
| G1 语义化输出 | 一次用户操作产出 **1 条**语义命令，而非 N 条网络请求或 N 条低层事件 |
| G2 零噪音 | 回放期间录制器不记录任何由自动化产生的操作；录制器自身 UI 不被记录 |
| G3 跨导航连续 | 页面跳转、新开标签页、进入 iframe 后录制不中断，且上下文切换命令被自动补全 |
| G4 可解释 | 每一条产出的命令都能追溯到"哪个事件 + 哪条规则"；不存在"不知道为什么多了一条"的情况 |
| G5 可裁剪 | 单个能力（如 iframe 支持、对话框支持）可独立开关，删掉不影响主干 |

### 1.3 非目标

见 §10 Out of Scope。

---

## 2. 名词定义

| 术语 | 定义 | KR 中的对应 |
|---|---|---|
| **录制引擎（Recorder Engine）** | 把用户在浏览器中的真实操作转换为语义命令序列的子系统 | `content/recorder.js` + `content/recorder-handlers.js` + `panel/js/background/recorder.js` |
| **命令（Command）** | 三元组 `{command, target, value}`，可被回放器执行的最小单位 | `panel/js/UI/models/test-model/test-command.js:4-33` |
| **定位器（Locator）** | 定位 DOM 元素的字符串，形如 `id=foo`、`css=.bar`、`xpath=//div[1]` | `content/locatorBuilders.js` |
| **定位器组（Locator Set）** | 同一元素的多个候选定位器，形如 `[[locator, finderName], ...]`，首个为首选 | `LocatorBuilders.buildAll()` 的返回值，`content/locatorBuilders.js:64-149` |
| **事件键（Event Key）** | 内部注册表的键，`capture` 事件加 `C_` 前缀，如 `C_click`、`change` | `content/recorder.js:125` |
| **捕获阶段（Capture Phase）** | DOM 事件从 `window` 向目标元素下行的阶段，早于目标元素自身的处理器 | `addEventListener(type, fn, true)` |
| **语义塌缩（Semantic Collapse）** | 把 N 个低层 DOM 事件归并成 1 条高层命令的过程 | 详见 TECH-01 §4.0 |
| **frameLocation** | iframe 在文档树中的路径，格式 `root[:index]*`，如 `root:0:1` | `content/recorder.js:85-100` |
| **窗口别名（Window Alias）** | 标签页的稳定逻辑名，用于 `selectWindow` 命令 | `win_ser_local` / `win_ser_N`，`panel/js/background/recorder.js:158-159, 215-216` |
| **前插（Insert Before Last）** | 把新命令插到已落表的最后一条命令**之前**，用于修正因果倒置 | `insertBeforeLastCommand`，`content/recorder.js:109` |
| **上下文（Context）** | 三个隔离的 JS 执行环境：Content Script / Panel 窗口 / Service Worker | 见 TECH-01 §1.1 |
| **握手（Handshake）** | 新装载的页面主动向 Panel 报到、Panel 决定是否让其挂载录制器的过程 | `attachRecorderRequest`，`content/recorder-handlers.js:522-526` |
| **可信事件（Trusted Event）** | `event.isTrusted === true`，由真实用户输入产生，JS 无法伪造 | `content/recorder-handlers.js:91` |
| **回放静音标志** | 回放执行期间挂在 `<body>` 上的属性，通知各监听器暂停记录 | `SideeXPlayingFlag`，`content/command-receiver.js:81` |
| **心跳（Page Heartbeat）** | 页面装载完成时发出的通知，供 Panel 比对 URL 并补 `open` 命令 | `checkForAutomated`，`content/check-browser-automation.js:2-5` |
| **命令表（Command Grid）** | Panel 中承载命令序列的可编辑表格，是录制结果的唯一真相源 | `#records-grid`，`panel/js/UI/view/records-grid/add-command.js` |

---

## 3. 用户故事

### 3.1 主线故事

**US-R-001｜看得懂的录制结果**
> 作为一名手工测试工程师，我希望点一下页面上的登录按钮后，录制结果里出现的是 `click | id=loginBtn` 这样一条我看得懂的命令，而不是 DevTools Network 里那一堆 `POST /api/login`、`GET /avatar.png`，这样我才能判断录得对不对，并手工微调。

**US-R-002｜输入不被拆碎**
> 作为一名测试工程师，我在搜索框里输入"katalon"这 7 个字符（中间还删改了两次），我希望录制结果里只有一条 `type | id=q | katalon`，而不是 7 条、9 条或 14 条命令。

**US-R-003｜双击不重复**
> 作为一名测试工程师，我双击了一个单元格，我希望录制结果里只出现该有的命令，不要出现两条一模一样的 `click`。

**US-R-004｜跳转后继续录**
> 作为一名测试工程师，我在首页点了「登录」链接，页面跳到了登录页，我希望在登录页上的输入和点击**继续被录制**，不需要重新按一次 Record。

**US-R-005｜新标签页自动跟随**
> 作为一名测试工程师，我点了一个 `target="_blank"` 的链接，浏览器开了新标签页，我希望录制结果里自动出现 `selectWindow | win_ser_1`，回放时能自动切过去。

**US-R-006｜iframe 自动切换**
> 作为一名测试工程师，被测页面里有嵌套 iframe，我在 iframe 内部点击时，我希望录制器自动补上 `selectFrame | index=0`，回放时不会因为"元素找不到"而失败。

**US-R-007｜表单回车正确翻译**
> 作为一名测试工程师，我在搜索框输入后按回车，我希望录制结果是 `type` + `submit`（或 `sendKeys ${KEY_ENTER}`），而不是只有一条 `type`（回放时表单根本不会提交）。

**US-R-008｜对话框顺序正确**
> 作为一名测试工程师，我点了「删除」按钮，页面弹出 `confirm("确定删除?")`，我点了确定。我希望录制结果里 `chooseOkOnNextConfirmation` 出现在 `click | id=del` **之前**，因为回放时必须先预设答案再触发弹窗，否则脚本会卡死。

**US-R-009｜回放不自录**
> 作为一名测试工程师，我在录制结束后立刻点回放，我希望回放过程中执行的每一次点击**不会被再次录进命令表**，导致命令翻倍。

**US-R-010｜录制器不录自己**
> 作为一名测试工程师，录制期间页面上有一个「正在录制… / Stop」浮层，我点它的 Stop 按钮时，我不希望这次点击变成一条 `click | id=overlayStopBtn` 命令。

**US-R-011｜别的窗口不受影响**
> 作为一名测试工程师，我在录制期间用另一个 Chrome 窗口查了个文档，我不希望那个窗口里的点击被录进来。

**US-R-012｜下拉框录成 select**
> 作为一名测试工程师，我在下拉框里选了「上海」，我希望结果是 `select | id=city | label=上海`，而不是 `click` 加一堆 `mousedown`。

**US-R-013｜随手加断言**
> 作为一名测试工程师，我想在录制过程中右键某个元素，从菜单里直接选 `assertText`，把断言插进命令序列，而不需要停止录制再手工添加。

**US-R-014｜命令可编辑可重排**
> 作为一名测试工程师，录完之后我希望能在命令表里删掉多余的命令、修改定位器、调整顺序，因为录制器不可能 100% 准确。

**US-R-015｜停止后彻底干净**
> 作为一名测试工程师，我点了 Stop 之后，我希望页面上的所有监听器和浮层都被彻底移除，不会继续影响我正常浏览网页。

### 3.2 复刻者故事（本项目特有）

**US-R-016｜每条命令可解释**
> 作为一名正在裁剪自己插件的工程师，当命令表里出现一条我没预期的命令时，我希望能通过日志或文档立即定位到是哪个 handler、哪条规则产生的。

**US-R-017｜能力可裁剪**
> 作为一名只测单页应用的工程师，我希望能直接删掉 iframe 追踪和多窗口追踪的代码，主干功能不受任何影响。

---

## 4. 功能需求

优先级：**P0** = MVP 必须；**P1** = 第二迭代；**P2** = 可选增强。

### 4.1 事件捕获层

| ID | 需求 | 优先级 | 验收要点 | KR 参考 |
|---|---|---|---|---|
| **FR-R-001** | 所有 DOM 事件监听器必须注册在 `document` 上，并使用 **capture 阶段**（`addEventListener(type, fn, true)`） | P0 | 页面调用 `stopPropagation()` 后录制仍正常 | `content/recorder.js:63` |
| **FR-R-002** | 事件注册表以 `eventKey` 为键，capture 事件加 `C_` 前缀；`detach` 时必须用与注册时**完全一致**的 capture 值 | P0 | 反复 attach/detach 10 次后，`getEventListeners(document)` 数量不增长 | `content/recorder.js:35-41, 122-130` |
| **FR-R-003** | 同一 `eventKey` 允许挂多个 handler，按注册顺序串行执行 | P0 | `change` 上的 type/select 两个 handler 都能被调到 | `content/recorder.js:57-62` |
| **FR-R-004** | `attach()` 与 `detach()` 必须**幂等**：重复调用无副作用 | P0 | 连发 5 次 `ATTACH_RECORDER`，一次点击仍只产出 1 条命令 | `content/recorder.js:44-47, 71-74` |
| **FR-R-005** | 获取事件目标时必须穿透开放式 Shadow DOM：`event.composedPath()[0] ?? event.target` | P1 | 点击 `<my-button>` 内部的 shadow 按钮，定位器指向 shadow 内元素而非宿主 | KR 为 `event._target \|\| event.target`（`recorder-handlers.js:19-24`），`_target` 全库无赋值，**未实现** |
| **FR-R-006** | 录制器必须在**所有 frame**中运行（`all_frames: true`），每个 frame 各自计算 `frameLocation` | P0 | 三层嵌套 iframe 内点击，上报的 `frameLocation` 为 `root:0:0` | `manifest.json:27-34`、`content/recorder.js:26` |
| **FR-R-007** | 录制器必须在 `document_start` 注入，但**不得**在注入时刻做任何依赖 DOM 内容的静态遍历 | P0 | 对动态插入的 `<input>` 也能正确记录 focus/blur | KR 违反此条：`recorder-handlers.js:135` 是缺陷 B2 的根因 |
| **FR-R-008** | 系统**不得**申请 `webRequest` 权限，**不得**监听任何网络事件 | P0 | `manifest.json` 的 `permissions` 中无 `webRequest`；代码中无 `chrome.webRequest.*` | `manifest.json:64` |

### 4.2 语义识别层

| ID | 需求 | 优先级 | 验收要点 | KR 参考 |
|---|---|---|---|---|
| **FR-R-010** | 左键单击产出 1 条 `click`；中键、右键不产出 `click` | P0 | `event.button !== 0` 时无输出 | `recorder-handlers.js:91` |
| **FR-R-011** | 双击在 30ms 去重窗内只产出 1 条 `click` | P0 | 双击一个按钮，命令表新增 1 行 | `recorder-handlers.js:92, 105, 109` |
| **FR-R-012** | 文本输入的合并**必须依赖 DOM `change` 事件语义**，不得使用自定义防抖定时器 | P0 | 输入 10 个字符后失焦 → 1 条 `type`；中途删改、粘贴、输入法组合均不影响最终值 | `recorder-handlers.js:82-85`（input 只记指针）+ `:49-80`（change 出命令） |
| **FR-R-013** | `input` 事件处理器**只允许**更新"最后输入元素"指针，不得产出任何命令 | P0 | 敲键盘时命令表不增长 | `recorder-handlers.js:82-85` |
| **FR-R-014** | `type` 命令的 value 为**提交时刻的元素完整值**，不是按键差量 | P0 | 输入 `abc`，删除 `c`，输入 `d` → `type\|...\|abd` | `recorder-handlers.js:58` |
| **FR-R-015** | 在输入框按 Enter：先产出 `type`，再根据表单情况产出 `submit` 或 `sendKeys ${KEY_ENTER}`；且**不得**因随后的 `change` 事件重复产出 `type` | P0 | 输入后回车 → 恰好 2 条命令 | `recorder-handlers.js:186-212`（typeLock 机制见 TECH-01 §4.2.3） |
| **FR-R-016** | `submit` vs `sendKeys` 的判定规则：祖先链上存在 `<form>` **且** 该 form 具有 `id`/`name`/`class` 之一 **且** 不含 `onsubmit`/`ng-submit` → `submit`；否则 `sendKeys ${KEY_ENTER}` | P0 | 见 TECH-01 §4.4.1 决策表 | `recorder-handlers.js:29-46` |
| **FR-R-017** | 表单提交后 500ms 内不产出 `click`（导航期噪音抑制） | P0 | 回车提交后落地页的自动聚焦点击不入表 | `recorder-handlers.js:213-216` |
| **FR-R-018** | 单选 `<select>` 变更产出 `select \| 定位器 \| label=选项文本` | P0 | — | `recorder-handlers.js:589-592` |
| **FR-R-019** | 多选 `<select>` 变更时，对每个状态发生变化的 option 分别产出 `addSelection` / `removeSelection` | P1 | 一次改选 2 项 → 2 条命令 | `recorder-handlers.js:593-607` |
| **FR-R-020** | option 的 value 编码：文本含 `&nbsp;`（U+00A0）时降级为 `label=regexp:...`，并转义正则元字符、把空白折成 `\s+` | P1 | — | `recorder-handlers.js:529-549` |
| **FR-R-021** | 在输入框按 ↑/↓ 产出 `sendKeys ${KEY_UP}` / `${KEY_DOWN}` | P1 | — | `recorder-handlers.js:236-237` |
| **FR-R-022** | 按 Tab 产出 `sendKeys ${KEY_TAB}`；触发条件必须**显式可解释**，不得依赖隐式全局状态 | P1 | KR 要求"先按过 ↑↓"（`tabCheck`），本项目要求改为"值发生过变化" | `recorder-handlers.js:240-245`（KR 实现依赖 `tabCheck`） |
| **FR-R-023** | `contentEditable` 元素在 focus 时快照 `innerHTML`，blur 时若有变化产出 `editContent` | P1 | — | `recorder-handlers.js:497-519` |
| **FR-R-024** | 拖放操作（持续 >200ms）产出 `dragAndDropToObject`，target 为起点定位器组，value 为终点单个定位器字符串 | P2 | — | `recorder-handlers.js:349-367` |
| **FR-R-025** | **不得**产出 `mouseDown`/`mouseUp`/`mouseOver`/`mouseOut`/`mouseDownAt`/`mouseMoveAt`/`mouseUpAt`/`runScript`/`clickAt`/`doubleClickAt` 等低层命令 | P0 | 完整走一遍典型流程，命令表中不出现上述任何命令名 | KR 中这些产出全被注释（`recorder-handlers.js:309-311, 315-317, 329-330, 336, 420, 432-436, 445`） |
| **FR-R-026** | **不得**产出任何 `*AndWait` 后缀命令 | P0 | 全流程录制后 grep 命令表无 `AndWait` | KR 录制侧全库无 `AndWait`（已验证） |

### 4.3 防噪音与防自录

| ID | 需求 | 优先级 | 验收要点 | KR 参考 |
|---|---|---|---|---|
| **FR-R-030** | 所有事件处理器必须统一检查 `event.isTrusted`，非可信事件一律丢弃 | P0 | `document.querySelector('button').click()` 不产生命令 | KR 只在 click 检查（`recorder-handlers.js:91`），**本项目要求全覆盖** |
| **FR-R-031** | 回放执行期间必须存在全局静音标志，对话框覆写与录制器均据此暂停记录 | P0 | 录 10 条 → 回放 → 命令表仍是 10 条 | `SideeXPlayingFlag`，`content/command-receiver.js:81, 87, 95, 100, 105` |
| **FR-R-032** | Panel 侧必须维护"允许录制的浏览器窗口"白名单，非白名单窗口的消息一律丢弃 | P0 | 在另一个 Chrome 窗口点击 → 命令表不增长 | `panel/js/background/recorder.js:176-177` |
| **FR-R-033** | 白名单只在两处扩充：① 启动录制时的目标窗口；② 由已知标签页派生出的新窗口 | P0 | 手工新开的无关窗口不进白名单 | `panel/js/background/editor.js:84`、`bg/recorder.js:161, 168` |
| **FR-R-034** | 录制器自身注入的 UI（浮层）产生的事件必须被过滤，过滤必须是**祖先链级**判断而非仅父节点 | P0 | 点浮层任意位置（含 padding 区）均不产生命令 | KR 用 `eventTarget.parentNode.id !== "popupInjectionKR"`（`recorder-handlers.js:102`，仅父节点，有漏洞）+ `record()` 内字符串扫描兜底（`content/recorder.js:104`） |
| **FR-R-035** | 停止录制时必须移除**全部**监听器与注入 UI，包括拖动浮层用的 `document` 级监听器 | P0 | 停止后 `getEventListeners(document)` 回到基线；反复开停 5 次无累积 | KR 违反此条：`content/inject-popup-record.js:83-99` 的监听器从不移除（缺陷 B8） |

### 4.4 上下文追踪

| ID | 需求 | 优先级 | 验收要点 | KR 参考 |
|---|---|---|---|---|
| **FR-R-040** | 命令序列的第一条必须是 `open \| <起始URL>` | P0 | — | `bg/recorder.js:219-224` |
| **FR-R-041** | 页面导航到**不同 URL** 时补一条 `open`；URL 比对必须是明确的相等或 origin 比较，**不得**使用子串包含 | P0 | `https://a.com/` → `https://a.com/login` 必须产出 `open` | KR 用 `!url.includes(oldUrl)`（`bg/recorder.js:260`），是缺陷 B6 |
| **FR-R-042** | 页面装载完成时发出心跳消息，供 Panel 比对 URL；心跳本身不落表 | P0 | 刷新页面不会多出空命令 | `content/check-browser-automation.js:2-5`、`bg/recorder.js:266-268` |
| **FR-R-043** | 每个被追踪的标签页分配稳定别名：首个为 `win_ser_local`，派生的依次为 `win_ser_1`、`win_ser_2`… | P0 | — | `bg/recorder.js:158-159, 215-216` |
| **FR-R-044** | 只有**由已知标签页派生**的新标签页才分配别名并纳入追踪（血统检查） | P0 | 手工 Ctrl+T 开的标签页不被追踪 | `bg/recorder.js:157` |
| **FR-R-045** | 切换标签页 / 切换浏览器窗口时产出 `selectWindow \| <别名>`；切换到未追踪的标签页时不产出 | P0 | — | `bg/recorder.js:33-64, 66-118` |
| **FR-R-046** | `selectWindow` 的产出必须延迟约 150ms，确保排在触发它的 `click` 命令**之后** | P0 | 点 `target=_blank` 链接 → 顺序为 `click` 然后 `selectWindow` | `bg/recorder.js:47, 63`（注释见 `:44-46`） |
| **FR-R-047** | 关闭**非当前**标签页时产出三明治序列：`selectWindow(被关的)` → `close(被关的)` → `selectWindow(当前的)`；关闭当前标签页只产出 `close` | P1 | — | `bg/recorder.js:130-145` |
| **FR-R-048** | Panel 自身窗口及任何扩展页面（`chrome-extension://`、`moz-extension://`）获得焦点时不产出 `selectWindow` | P0 | 点 Panel 窗口不产生命令 | `bg/recorder.js:95, 346-352` |
| **FR-R-049** | 追踪状态必须以**测试用例 ID** 为一级键隔离，切换用例时上下文互不干扰 | P1 | — | `bg/recorder.js:18-23` |

### 4.5 iframe 支持

| ID | 需求 | 优先级 | 验收要点 | KR 参考 |
|---|---|---|---|---|
| **FR-R-050** | `frameLocation` 编码为 `root` + 各层在 `parent.frames` 中的索引，冒号分隔 | P0 | 顶层 = `root`；第 1 个 iframe 内第 2 个 iframe = `root:0:1` | `content/recorder.js:85-100` |
| **FR-R-051** | 每条录制消息必须携带该操作发生时的 `frameLocation` | P0 | — | `content/recorder.js:110` |
| **FR-R-052** | Panel 维护"当前 frame"状态，收到不同 `frameLocation` 时用三段式 LCA 差分算法产出最少数量的 `selectFrame` 命令 | P0 | `root:0:1` → `root:0:2` 恰好产出 2 条（1 上 1 下） | `bg/recorder.js:271-293` |
| **FR-R-053** | 上行用 `selectFrame \| relative=parent`，下行用 `selectFrame \| index=N` | P0 | — | `bg/recorder.js:275-277, 287-289` |
| **FR-R-054** | 以下时机必须把"当前 frame"重置为 `root`：切标签页、切窗口、关标签页、**页面导航/刷新** | P0 | 在 iframe 内操作后刷新页面，再在顶层点击，不产出多余的 `relative=parent` | KR 缺最后一项（`bg/recorder.js:61, 114, 148`），是缺陷 B5 |
| **FR-R-055** | 来自 iframe 的对话框事件，必须透传该 iframe 的 `frameLocation`，不得使用代理者（顶层窗口）的值 | P1 | — | `content/recorder.js:110`、`content/prompt-injecter.js:34-50`、`page/prompt.js:35-50` |

### 4.6 跨导航续录

| ID | 需求 | 优先级 | 验收要点 | KR 参考 |
|---|---|---|---|---|
| **FR-R-060** | 每次 content script 装载时，主动向 Panel 发送"报到"消息 | P0 | — | `content/recorder-handlers.js:522-526` |
| **FR-R-061** | Panel 收到报到后，仅当"正在录制 且 未在回放"时，才回应挂载指令 | P0 | 回放期间导航到新页面，新页面不挂录制器 | `panel/js/background/editor.js:69-74` |
| **FR-R-062** | 挂载指令的接收方必须幂等处理（重复挂载无副作用） | P0 | 见 FR-R-004 | `content/recorder.js:44-47`、`content/inject-popup-record.js:2-5` |
| **FR-R-063** | 消息发送失败（Panel 已关闭）时静默忽略，**不得**自动 detach | P1 | Panel 崩溃重启后，重新按 Record 能立即恢复录制现有页面 | KR 显式移除了自动 detach（`content/recorder.js:113-115` 的 `KAT-BEGIN remove self.detach`） |

### 4.7 命令表

| ID | 需求 | 优先级 | 验收要点 | KR 参考 |
|---|---|---|---|---|
| **FR-R-070** | 命令表是录制结果的唯一真相源，必须支持增、删、改、重排 | P0 | — | `panel/js/UI/view/records-grid/*` |
| **FR-R-071** | 支持"前插"模式：把新命令插到最后一条命令**之前**，下标必须为 `length - 1` | P0 | 已有 `[open, click]`，前插 `chooseOk` → `[open, chooseOk, click]` | KR 用 `getTestCommandCount() - 2`（`add-command.js:98`），是缺陷 B4 |
| **FR-R-072** | 每条命令保存**完整的定位器组**（多个候选），首选定位器展示在表格中 | P0 | — | `TestCommand` 的 `targets` 字段，`test-command.js:13-20` |
| **FR-R-073** | 命令表必须驻留在具备 DOM 环境的上下文（独立扩展窗口），**不得**放在 Service Worker | P0 | 长时间无操作后 SW 休眠，命令表数据不丢失 | KR 把 `BackgroundRecorder` 放在 Panel 而非 SW（`worker_wrapper.js:2-23` 不含它） |
| **FR-R-074** | 每录一条命令给出轻量反馈（桌面通知或表格高亮）；前插命令可不通知 | P2 | — | `panel/js/background/editor.js:90-104`；前插分支不通知（`bg/recorder.js:338-343`） |

### 4.8 对话框录制（P1）

| ID | 需求 | 优先级 | 验收要点 | KR 参考 |
|---|---|---|---|---|
| **FR-R-080** | 通过向页面注入脚本覆写 `window.alert` / `confirm` / `prompt` 捕获对话框 | P1 | — | `content/prompt-injecter.js:20-24` + `page/prompt.js` |
| **FR-R-081** | 覆写后必须先调用原生实现（用户仍能看见并作答），再上报 | P1 | 用户体验无变化 | `page/prompt.js:62, 79, 103` |
| **FR-R-082** | `confirm` 产出 `chooseOkOnNextConfirmation` / `chooseCancelOnNextConfirmation`（**前插**）+ `assertConfirmation`（追加） | P1 | 顺序为 `chooseOk`、`click`、`assertConfirmation` | `content/prompt-injecter.js:40-47` |
| **FR-R-083** | `prompt` 产出 `answerOnNextPrompt`（有输入）或 `chooseCancelOnNextPrompt`（取消）（**前插**）+ `assertPrompt`（追加） | P1 | — | `content/prompt-injecter.js:32-39` |
| **FR-R-084** | `alert` 只产出 `assertAlert`（追加，不前插） | P1 | — | `content/prompt-injecter.js:48-51` |
| **FR-R-085** | iframe 内的对话框由顶层窗口代为上报，但必须携带 iframe 自身的 `frameLocation` | P1 | 见 FR-R-055 | `page/prompt.js:56-114` |

### 4.9 右键菜单断言（P2）

| ID | 需求 | 优先级 | 验收要点 | KR 参考 |
|---|---|---|---|---|
| **FR-R-090** | 提供右键上下文菜单，支持 `verify*` / `assert*` / `store*` / `waitFor*` 系列命令 | P2 | — | `background/background.js:123-226`（17 项） |
| **FR-R-091** | `contextmenu` 事件发生时必须**立即快照**元素定位器、可见文本、页面标题；菜单选择结果回来时使用快照而非重新查询 | P2 | SPA 在右键后重渲染，命令仍指向正确元素 | `recorder-handlers.js:475-477` |
| **FR-R-092** | 命令名到"取什么数据"的映射必须使用**精确匹配**，不得用 `includes` 前缀判断 | P2 | `waitForTextPresent` 不会被误判进 Text 分支 | KR 用 `m.cmd.includes("Text")` 等（`recorder-handlers.js:480-488`），是缺陷 B9 的邻居问题 |
| **FR-R-093** | 每次通信用完的消息通道必须显式关闭；服务端必须按 `tabId+frameId` 维护通道映射而非全局单变量 | P2 | 连续右键 3 次，第 1、2 次的通道不会永久挂起 | KR 违反：`recorder-handlers.js:489` 只 removeListener、`background/background.js:228-234` 用全局 `var port`（缺陷 B9） |

---

## 5. 非功能需求

| ID | 类别 | 需求 | 度量 / 验收 |
|---|---|---|---|
| **NFR-R-001** | 性能 | 单次事件处理的主线程占用 < 16ms（不掉帧） | 高频点击 20 次/秒，页面 FPS 不低于 55 |
| **NFR-R-002** | 性能 | 每次操作最多调用一次定位器生成（`buildAll`）；禁止重复调用 | 代码审查 + 打点计数。KR 在 click 里调了 2 次（`recorder-handlers.js:103, 104`，缺陷 B13） |
| **NFR-R-003** | 内存 | 反复开始/停止录制 20 次后，`document` 上的监听器数量回到基线 | Chrome DevTools `getEventListeners(document)` |
| **NFR-R-004** | 内存 | 录制 1000 条命令后 Panel 内存增长 < 50MB | Performance Monitor |
| **NFR-R-005** | 侵入性 | 录制器**不得**修改页面 DOM 结构（浮层除外）、**不得**创建页面全局变量 | KR 违反：`recorder-handlers.js:502` 的 `contentTest` 未声明（缺陷 B14） |
| **NFR-R-006** | 侵入性 | 录制器**不得**调用 `preventDefault()` / `stopPropagation()` 干扰页面原生行为 | KR 违反：`inject-popup-record.js:88` 无条件 `preventDefault()`（缺陷 B8） |
| **NFR-R-007** | 隔离性 | Content script 优先使用 ISOLATED world；仅当回放需要访问页面 JS 对象时才用 MAIN | KR 用 MAIN（`manifest.json:33`），因为回放共用同一 bundle |
| **NFR-R-008** | 权限最小化 | 不申请 `webRequest`、`debugger`（除非回放明确需要）、`cookies` | `manifest.json` 审查 |
| **NFR-R-009** | 健壮性 | 任何 handler 抛出的异常不得影响其他 handler；异常必须可见（console.error + 可选上报） | 故意在一个 handler 里 `throw`，其余仍工作 |
| **NFR-R-010** | 健壮性 | 所有跨上下文消息发送必须 `.catch()`，不得产生 unhandled rejection | Console 无红色未捕获 Promise 错误 |
| **NFR-R-011** | 可解释性 | 提供 debug 模式，每条命令输出 `{触发事件, handler名, 命中的分支, 被抑制的原因}` | 开启后能解释"为什么这次点击没录上" |
| **NFR-R-012** | 兼容性 | Chrome / Edge 最近两个大版本（MV3） | 手工验证 |
| **NFR-R-013** | 可裁剪性 | iframe 追踪、多窗口追踪、对话框、右键菜单各自为独立模块，删除任一模块主干仍能编译运行 | 逐个注释掉后跑冒烟用例 |
| **NFR-R-014** | 安全 | 不得把页面内容（表单值、cookie）发送到扩展外部 | 代码审查；无 `fetch`/`XMLHttpRequest` 到外部域 |
| **NFR-R-015** | 时间常数集中管理 | 所有魔数（30/50/150/200/500ms）必须定义为具名常量并集中在一处 | 代码审查。KR 散落在 8 处 |

---

## 6. 数据结构（TypeScript）

```ts
// ============================================================
// 6.1 命令
// ============================================================

/** 单个定位器：[定位器字符串, 生成策略名] */
export type Locator = [locator: string, finderName: string];

/** 定位器组：同一元素的多个候选，locators[0] 为首选 */
export type LocatorSet = Locator[];

/** 命令名。有意采用字面量联合而非 string，使"负面清单"在类型层面生效 */
export type CommandName =
  // —— 交互 ——
  | 'click'
  | 'type'
  | 'sendKeys'
  | 'submit'
  | 'select'
  | 'addSelection'
  | 'removeSelection'
  | 'editContent'
  | 'dragAndDropToObject'
  // —— 上下文 ——
  | 'open'
  | 'close'
  | 'selectWindow'
  | 'selectFrame'
  // —— 对话框 ——
  | 'chooseOkOnNextConfirmation'
  | 'chooseCancelOnNextConfirmation'
  | 'answerOnNextPrompt'
  | 'chooseCancelOnNextPrompt'
  | 'assertAlert'
  | 'assertConfirmation'
  | 'assertPrompt'
  // —— 断言 / 存储 / 等待（右键菜单，P2）——
  | `verify${'Text' | 'Title' | 'Value'}`
  | `assert${'Text' | 'Title' | 'Value'}`
  | `store${'Text' | 'Title' | 'Value'}`
  | `waitFor${'ElementPresent' | 'ElementNotPresent' | 'TextPresent' | 'TextNotPresent'
             | 'Value' | 'NotValue' | 'Visible' | 'NotVisible'}`;

/** 命令表中的一行 */
export interface TestCommand {
  /** 稳定唯一 id，用于 DOM 行与数据行的双向绑定 */
  id: string;
  command: CommandName;
  /** 首选定位器字符串，等于 targets[0][0]；冗余存储便于表格渲染 */
  defaultTarget: string;
  /** 完整候选定位器组 */
  targets: LocatorSet;
  value: string;
  /** 回放结果，录制期恒为 null */
  status: 'passed' | 'failed' | null;
  /** 回放中的瞬时态，录制期恒为 null */
  state: 'executing' | 'pending' | null;
}
// 对照 KR: panel/js/UI/models/test-model/test-command.js:4-33
// （KR 没有 id 字段在模型里，id 只存在于 DOM 元素上，导致 add-command.js 需要
//   在 DOM 与数组之间做易错的下标换算 —— 本项目要求模型自带 id）

// ============================================================
// 6.2 跨上下文消息
// ============================================================

/** content → Panel：录制一条命令 */
export interface RecordMessage {
  type: 'RECORD';
  command: CommandName;
  target: LocatorSet;
  value: string;
  /** true = 插到最后一条命令之前（对话框因果倒置修正） */
  insertBefore: boolean;
  /** 该操作发生时所在的 frame，形如 "root" | "root:0" | "root:1:2" */
  frameLocation: FrameLocation;
}

/** content → Panel：新页面报到，请求挂载 */
export interface AttachRequestMessage {
  type: 'ATTACH_REQUEST';
}

/** content → Panel：页面装载心跳，供比对 URL 补 open */
export interface PageLoadedMessage {
  type: 'PAGE_LOADED';
  url: string;
}

/** content → Panel：注入浮层上的 Stop 按钮被点击 */
export interface StopRequestMessage {
  type: 'STOP_REQUEST';
}

/** Panel → content：挂载 / 卸载录制器 */
export interface ToggleRecorderMessage {
  type: 'ATTACH_RECORDER' | 'DETACH_RECORDER';
}

export type RecorderMessage =
  | RecordMessage
  | AttachRequestMessage
  | PageLoadedMessage
  | StopRequestMessage
  | ToggleRecorderMessage;

// ============================================================
// 6.3 frame 路径
// ============================================================

/** "root" | "root:0" | "root:1:2" ... */
export type FrameLocation = string;

// ============================================================
// 6.4 事件注册表
// ============================================================

/** capture 事件的键加 "C_" 前缀，使 attach/detach 的 capture 值天然对称 */
export type EventKey = string;          // "click" | "C_click" | ...

export type RecorderHandler = (this: Recorder, event: Event) => void;

export interface RecorderHandlerRegistry {
  register(eventName: string, handler: RecorderHandler, capture?: boolean): void;
  parseKey(key: EventKey): { eventName: string; capture: boolean };
  entries(): IterableIterator<[EventKey, RecorderHandler[]]>;
}

// ============================================================
// 6.5 Content 侧录制器
// ============================================================

export interface Recorder {
  readonly window: Window;
  readonly frameLocation: FrameLocation;
  /** attach/detach 必须幂等 */
  attached: boolean;
  attach(): void;
  detach(): void;
  record(
    command: CommandName,
    target: LocatorSet,
    value?: string,
    opts?: { insertBefore?: boolean; frameLocation?: FrameLocation }
  ): void;
}

// ============================================================
// 6.6 Panel 侧录制会话状态
// ============================================================

export type WindowAlias = 'win_ser_local' | `win_ser_${number}`;

export interface RecordingSession {
  /** 会话所属测试用例（多用例隔离） */
  testCaseId: string;

  /** —— 焦点上下文 —— */
  currentTabId: number | null;
  currentWindowId: number | null;
  currentFrameLocation: FrameLocation;   // 初值 "root"
  currentUrl: string | null;

  /** —— 标签页别名（双向映射）—— */
  tabIdToAlias: Map<number, WindowAlias>;
  aliasToTabId: Map<WindowAlias, number>;
  nextAliasIndex: number;                // 从 1 开始

  /** —— 窗口白名单 —— */
  allowedWindowIds: Set<number>;

  /** —— 命令表 —— */
  commands: TestCommand[];
}
// 对照 KR: panel/js/background/recorder.js:17-30
// KR 用 6 个以 testCaseId 为一级键的普通对象，且把 'tabUrl' 这个字符串键
// 混存进了 openedTabIds（tabId → 别名）表里（bg/recorder.js:223），造成类型污染。
// 本项目要求：一个会话一个对象，URL 单独成字段。

// ============================================================
// 6.7 语义状态机（Content 侧模块级状态）
// ============================================================

export interface SemanticState {
  /** 最后一次 input 事件的目标元素 */
  typeTarget: Element | null;
  /** 跨 keydown→change 的互斥门闩，防止 Enter 场景 type 录两次 */
  typeLock: boolean;
  /** 表单提交后的 click 静音期开关 */
  preventClick: boolean;
  /** 30ms 双击折叠窗开关 */
  clickDedupe: boolean;
  /** 当前聚焦输入框的初始值（用于判断"值是否变化过"） */
  focusValue: string | null;
  /** contentEditable 快照 */
  contentEditableTarget: Element | null;
  contentEditableSnapshot: string | null;
}
// 对照 KR: content/recorder-handlers.js:27-28, 88, 131-134, 155-158, 386, 456, 495-496
// KR 共 12 个裸的模块级 var，本项目要求收敛到一个对象里便于 debug dump。

// ============================================================
// 6.8 时间常数（NFR-R-015 要求集中定义）
// ============================================================

export const TIMING = {
  /** 双击折叠窗：30ms 内的第二次 click 被丢弃 */
  CLICK_DEDUPE_MS: 30,
  /** 表单提交后的 click 静音期 */
  SUBMIT_QUIET_MS: 500,
  /** selectWindow 延迟，确保排在触发它的 click 之后 */
  SELECT_WINDOW_DELAY_MS: 150,
  /** 拖放最短持续时间 */
  DRAG_MIN_DURATION_MS: 200,
} as const;
// 对照 KR: recorder-handlers.js:109 / :216 / bg/recorder.js:63 / recorder-handlers.js:256

// ============================================================
// 6.9 Debug 输出（NFR-R-011）
// ============================================================

export interface RecordDecisionTrace {
  timestamp: number;
  eventType: string;
  eventKey: EventKey;
  handlerName: string;
  targetSummary: string;                 // 如 "<button id=login>"
  outcome: 'recorded' | 'suppressed';
  /** outcome === 'recorded' 时给出命令；否则给出抑制原因 */
  command?: CommandName;
  suppressReason?:
    | 'not-trusted'
    | 'not-left-button'
    | 'click-dedupe-window'
    | 'submit-quiet-period'
    | 'type-lock'
    | 'own-overlay'
    | 'window-not-allowed'
    | 'tag-not-supported';
}
```

---

## 7. 状态机

### 7.1 录制会话主状态机

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    ▼                                          │
              ┌───────────┐                                    │
      ┌──────>│   IDLE    │  isRecording=false                 │
      │       └─────┬─────┘  Panel 无监听、页面无 Recorder       │
      │             │                                          │
      │             │ 用户点 Record                             │
      │             │  · Panel 挂 tabs/windows/webNav 监听       │
      │             │  · 广播 ATTACH_RECORDER 给目标窗口全部 tab   │
      │             ▼                                          │
      │       ┌───────────┐                                    │
      │       │ RECORDING │  isRecording=true                  │
      │       └─────┬─────┘                                    │
      │             │                                          │
      │   ┌─────────┼─────────┬──────────────┐                 │
      │   │         │         │              │                 │
      │   │ 用户操作 │ 页面导航 │ 新页面报到     │ 用户点 Stop      │
      │   │         │         │              │  或浮层 Stop     │
      │   ▼         ▼         ▼              ▼                 │
      │  产出命令   补 open   回应 ATTACH   ──────────────────────┘
      │  （回到      重置 frame  （幂等）      · 广播 DETACH_RECORDER
      │  RECORDING） （回到                   · 移除 Panel 监听
      │             RECORDING）               · 移除浮层
      │
      │       ┌───────────┐
      └───────│  PLAYING  │  isPlaying=true
              └───────────┘  · Panel 拒绝回应 ATTACH_REQUEST（FR-R-061）
                             · 页面 <body> 挂 静音标志（FR-R-031）
                             · 所有事件因 isTrusted=false 被丢弃（FR-R-030）
```

**不变式**：`isRecording && isPlaying` 不允许同时为 true。UI 层通过互斥按钮保证（KR：`record-actions.js:27-35` 录制时隐藏所有播放按钮）。

### 7.2 单次文本输入的状态机（最关键的一个）

```
                     ┌────────────┐
       ┌────────────>│   空闲态    │  typeTarget=null, typeLock=false
       │             └──────┬─────┘
       │                    │ focus 输入框
       │                    │  focusValue = el.value
       │                    ▼
       │             ┌────────────┐
       │             │  聚焦态     │
       │             └──────┬─────┘
       │                    │
       │        ┌───────────┴────────────┐
       │        │                        │
       │   input 事件（每个字符）        keydown Enter
       │        │  typeTarget = el       │
       │        │  【不产出命令】         │
       │        ▼                        ▼
       │  ┌────────────┐          ┌──────────────────────┐
       │  │  输入中     │          │ ① record type        │
       │  └──────┬─────┘          │ ② typeLock = true    │
       │         │                │ ③ record submit      │
       │         │ blur / 失焦     │    或 sendKeys ENTER │
       │         ▼                │ ④ preventClick=true  │
       │  ┌────────────┐          │    500ms 后复位       │
       │  │change 事件 │          └──────────┬───────────┘
       │  │ typeLock?  │                     │
       │  │  false     │                     │ 浏览器随即派发 change
       │  └──────┬─────┘                     ▼
       │         │                    ┌──────────────┐
       │         │ record type        │ change 事件   │
       │         │                    │ typeLock=true │
       │         │                    │ → 跳过        │
       │         │                    │ → typeLock=false
       │         │                    └──────┬───────┘
       └─────────┴───────────────────────────┘
```

**核心不变式**：
- **I1**：一次"聚焦 → 输入 → 提交"最多产出 1 条 `type`。
- **I2**：`typeLock` 只可能由 keydown-Enter 置位，只可能由 change 复位。
- **I3**：`input` 事件永不产出命令。

> 对照 KR：I1/I2 由 `content/recorder-handlers.js:52`（`typeLock == 0` 判定）与 `:79`（无条件复位）、`:186`（`(typeLock = 1)` 赋值）共同保证。I3 见 `:82-85`。

### 7.3 click 去重状态机

```
   ┌──────────────────┐
   │ clickDedupe=false│◄─────────────────────┐
   └────────┬─────────┘                      │
            │ click 事件 (button==0,          │
            │  isTrusted, !preventClick)      │  30ms 定时器到期
            ▼                                 │
     record('click')                          │
     clickDedupe = true ──────────────────────┘
            │
            │ 30ms 内又来 click（双击的第二次）
            ▼
        丢弃，不产出
```

### 7.4 frame 上下文状态机

```
   currentFrameLocation: "root"
            │
            │ 收到 RECORD{frameLocation: F}
            ▼
      F === current ? ──是──> 直接落表
            │否
            ▼
   三段式 LCA 差分（FR-R-052）
     段① old 更深 → 输出 N 个 relative=parent
     段② 同深分叉 → 继续 relative=parent 直到公共祖先
     段③ 向下钻   → 输出 index=k
            │
            ▼
   currentFrameLocation = F
   落表原命令
```

**重置为 `root` 的四个触发**（FR-R-054）：`tabs.onActivated`、`windows.onFocusChanged`、`tabs.onRemoved`、`PAGE_LOADED`。

### 7.5 挂载握手状态机（Content 侧）

```
   页面装载
      │
      │ new Recorder(window)   attached = false
      │ 发送 ATTACH_REQUEST
      ▼
  ┌─────────────┐
  │  DETACHED   │◄──── DETACH_RECORDER ────┐
  └──────┬──────┘                          │
         │ ATTACH_RECORDER                 │
         │  （幂等：已 attached 则直接 return）│
         ▼                                 │
  ┌─────────────┐                          │
  │  ATTACHED   │──────────────────────────┘
  └─────────────┘
   · document 上 N 个 listener
   · 浮层已注入
```

---

## 8. 边界与异常场景

| # | 场景 | 期望行为 | 依据 / KR 现状 |
|---|---|---|---|
| E1 | 用户按 Record 之前页面已打开多个标签页 | 只对**当前活动窗口**的所有标签页广播挂载；其余窗口不动 | FR-R-032；KR `record-actions.js:68-73` |
| E2 | 录制中用户手动 Ctrl+T 开新标签页并操作 | 不追踪、不产出任何命令（血统检查失败） | FR-R-044；KR `bg/recorder.js:157` |
| E3 | 录制中页面 302 重定向 | 心跳触发 URL 比对 → 补一条 `open`；frame 重置为 root | FR-R-041/054 |
| E4 | 录制中页面用 `history.pushState` 改 URL（SPA 路由） | **不产出 `open`**（content script 未重载，无心跳）。视为已知限制 | KR 同样不处理；心跳只在 script 装载时发（`check-browser-automation.js`） |
| E5 | 用户点击后页面立即 `stopPropagation()` | 仍能录到（capture 阶段先于目标处理器） | FR-R-001 |
| E6 | 用户点击的元素在点击后立即被 SPA 卸载 | 定位器必须在事件处理**当场**生成，不得延后 | 所有 handler 内同步调用 `buildAll()`；KR `recorder-handlers.js:103` |
| E7 | 元素没有任何可用定位器 | 定位器组为空数组；命令仍落表，首选定位器记为 `LOCATOR_DETECTION_FAILED` | KR `content/locatorBuilders.js:55-62` |
| E8 | 页面在 iframe 内跳转（只有子 frame 导航） | 子 frame 的 content script 重载 → 发 ATTACH_REQUEST → 重新挂载。心跳会带子 frame 的 URL，可能误触发顶层 `open` | ⚠️ **KR 未区分主/子 frame 的心跳**（`check-browser-automation.js` 在所有 frame 执行）。本项目要求心跳只在顶层发送 |
| E9 | Panel 窗口被用户关闭但录制未停止 | 消息发送失败被静默吞掉；页面上录制器仍挂着 | FR-R-063；KR 显式移除了自动 detach（`content/recorder.js:113-115`） |
| E10 | Service Worker 休眠后被事件唤醒 | Panel 中的会话状态不受影响（状态不在 SW） | FR-R-073 |
| E11 | 用户在 `chrome://` 或扩展页面上操作 | content script 无法注入，无任何录制；窗口焦点切换也不产出 `selectWindow` | FR-R-048；KR `bg/recorder.js:346-352` |
| E12 | 同一元素被极快连击 5 次（间隔 <30ms） | 只录 1 条 `click`（去重窗设计如此）。⚠️ 这是**已知的语义损失** | FR-R-011 |
| E13 | 用户用输入法（IME）输入中文 | 只产出 1 条 `type`，value 为最终确认的中文；`compositionstart/update/end` 不被监听 | FR-R-012（依赖 change 语义天然正确） |
| E14 | 用户粘贴（Ctrl+V）而非键入 | 仍产出 1 条 `type`（`paste` 会触发 `input` 与 `change`） | FR-R-012 |
| E15 | `<input type="checkbox">` / `radio` 被点击 | 产出 `click`（不产出 `type`），因为它们不在受支持的输入类型清单中 | KR `Recorder.inputTypes`（`recorder-handlers.js:48`）不含 checkbox/radio |
| E16 | `<input type="file">` 被点击并选文件 | 产出 `click`；`change` 时因 `file` 在 inputTypes 中会产出 `type \| ... \| C:\fakepath\x.png`。⚠️ **该值无法回放**，应特判丢弃 | KR `recorder-handlers.js:48` 包含 `"file"`，未特判 —— 本项目要求排除 |
| E17 | 一个 handler 抛异常 | 其他 handler 不受影响；异常写入 console 且计入 debug trace | NFR-R-009；KR 无隔离（`content/recorder.js:59-61` 的 for 循环无 try/catch） |
| E18 | 对话框在页面加载期间弹出（`<body>` 尚不存在） | 覆写函数中的 `document.body.hasAttribute(...)` 会抛 `TypeError` | ⚠️ KR 缺陷：`page/prompt.js:59` 等 6 处未判空。本项目要求 `document.body?.hasAttribute(...)` |
| E19 | 用户在同一秒内切换标签页两次 | 两个 150ms 定时器都会跑，但第二个会因 `tabId === currentTabId` 判定而跳过，最终只产出 1 条 `selectWindow` | FR-R-045/046；KR `bg/recorder.js:48-49` |
| E20 | 命令表为空时发生标签页切换 | 不产出 `selectWindow`（必须先有 `open`） | KR `bg/recorder.js:52-53` |
| E21 | 前插命令时命令表为空 | 退化为普通追加，不得抛异常或产生负下标 | FR-R-071；KR `add-command.js:98` 在 count=0 时会算出 `-2`（缺陷 B4 的极端情况） |
| E22 | 页面存在多层 iframe，且中间层跨域 | `parent.frames` 访问在跨域时**不抛异常**（`frames` 是允许跨域访问的），索引计算仍有效 | KR `content/recorder.js:89-94` 依赖此特性 |
| E23 | 反复开始/停止录制 20 次 | 无监听器累积、无浮层残留、无内存增长 | NFR-R-003；KR 违反（缺陷 B8） |
| E24 | 录制期间用户手动编辑命令表某一行 | 后续自动录制的命令追加到**当前选中行之后**；用户的编辑不被覆盖 | FR-R-070；KR `add-command.js:70-94` |
| E25 | 元素带 open Shadow DOM | 定位到 shadow 内的真实目标 | FR-R-005（KR 未实现） |
| E26 | 元素带 closed Shadow DOM | `composedPath()` 不穿透，定位到宿主元素。**已知限制** | — |

---

## 9. 验收用例

格式：`GIVEN / WHEN / THEN`。每条给出**精确的期望命令序列**。

### AC-R-001 语义化输出（US-R-001 / FR-R-008）
```
GIVEN 打开 https://example.com/login，开始录制
WHEN  点击 <button id="loginBtn">登录</button>
THEN  命令表恰好新增 1 行：
        click | id=loginBtn |
AND   命令表中不出现任何 URL、HTTP 方法、请求头相关内容
AND   扩展的 manifest.permissions 中不含 "webRequest"
```

### AC-R-002 输入合并（US-R-002 / FR-R-012/013/014）
```
GIVEN 页面有 <input id="q" type="text">，正在录制
WHEN  依次输入 k a t a l o n（7 次按键）
      再按 3 次 Backspace
      再输入 o n（2 次按键）
      然后点击页面空白处使输入框失焦
THEN  命令表恰好新增 1 行：
        type | id=q | katalon
AND   录制过程中（失焦之前）命令表行数保持不变
```

### AC-R-003 双击折叠（US-R-003 / FR-R-011）
```
GIVEN 正在录制
WHEN  双击 <td id="cell">
THEN  命令表恰好新增 1 行：click | id=cell |
AND   不出现 doubleClick / doubleClickAt / clickAt
```

### AC-R-004 表单回车（US-R-007 / FR-R-015/016）
```
GIVEN 页面结构：
        <form id="searchForm">
          <input id="q" type="text">
        </form>
      正在录制
WHEN  在 #q 输入 "katalon" 后按 Enter
THEN  命令表恰好新增 2 行，顺序为：
        1. type   | id=q          | katalon
        2. submit | id=searchForm |
AND   不出现第二条 type
```

### AC-R-004b 无 form 的回车
```
GIVEN 页面只有一个游离的 <input id="q">（无 <form> 祖先），正在录制
WHEN  在 #q 输入 "abc" 后按 Enter
THEN  命令表恰好新增 2 行：
        1. type     | id=q | abc
        2. sendKeys | id=q | ${KEY_ENTER}
```

### AC-R-004c 带 onsubmit 的 form
```
GIVEN <form id="f" onsubmit="return false"><input id="q"></form>，正在录制
WHEN  在 #q 输入 "abc" 后按 Enter
THEN  第 2 行为 sendKeys | id=q | ${KEY_ENTER}（而非 submit）
```

### AC-R-005 提交后静音（FR-R-017）
```
GIVEN 承接 AC-R-004
WHEN  表单提交后 300ms 内落地页自动聚焦并产生一次真实点击
THEN  该点击不产出 click 命令
WHEN  提交后 600ms 再点击
THEN  正常产出 click
```

### AC-R-006 跨导航续录（US-R-004 / FR-R-060~062）
```
GIVEN 在 https://a.com 上录了 2 条命令
WHEN  点击一个普通链接跳转到 https://b.com
AND   在 b.com 上点击一个按钮
THEN  命令表为：
        1. open  | https://a.com     |
        2. click | <a.com 的元素>    |
        3. click | <b.com 上的链接>   |     ← 触发跳转的那次点击
        4. open  | https://b.com     |
        5. click | <b.com 的按钮>     |
AND   不需要重新按 Record
```

### AC-R-007 新标签页（US-R-005 / FR-R-043~046）
```
GIVEN 正在录制，已有若干命令
WHEN  点击 <a href="/detail" target="_blank">详情</a>
AND   在新标签页中点击 <button id="save">
THEN  命令表顺序为：
        ...
        n.   click        | link=详情   |
        n+1. selectWindow | win_ser_1  |
        n+2. click        | id=save    |
AND   selectWindow 必须在 click 之后（150ms 延迟生效）
```

### AC-R-008 关闭标签页（FR-R-047）
```
GIVEN 已追踪 win_ser_local（当前）与 win_ser_1
WHEN  关闭 win_ser_1（非当前标签页）
THEN  命令表新增 3 行：
        selectWindow | win_ser_1     |
        close        | win_ser_1     |
        selectWindow | win_ser_local |
```

### AC-R-009 iframe 进入与退出（US-R-006 / FR-R-050~053）
```
GIVEN 页面结构：顶层 → iframe[0] → iframe[1]
      正在录制，当前 frame 为 root
WHEN  在 iframe[0] 内的 iframe[1] 中点击 <button id="inner">
THEN  命令表新增 3 行：
        selectFrame | index=0  |
        selectFrame | index=1  |
        click       | id=inner |
WHEN  随后点击顶层文档的 <button id="outer">
THEN  再新增 3 行：
        selectFrame | relative=parent |
        selectFrame | relative=parent |
        click       | id=outer        |
```

### AC-R-009b 同级 iframe 切换
```
GIVEN 当前 frame 为 root:0:1
WHEN  在 root:0:2 中点击
THEN  恰好新增 2 行 selectFrame：
        selectFrame | relative=parent |
        selectFrame | index=2         |
```

### AC-R-009c 导航后 frame 重置（FR-R-054）
```
GIVEN 当前 frame 为 root:0
WHEN  刷新页面
AND   在顶层文档点击
THEN  不产出任何 selectFrame
AND   只产出 open（若 URL 变化）+ click
```

### AC-R-010 对话框顺序（US-R-008 / FR-R-082）
```
GIVEN 点击 #del 会触发 confirm("确定删除?")
      正在录制
WHEN  点击 #del
AND   在弹窗中点「确定」
THEN  命令表顺序为：
        n.   chooseOkOnNextConfirmation |          |
        n+1. click                      | id=del   |
        n+2. assertConfirmation         | 确定删除? |
AND   chooseOk 必须严格在 click 之前
```

### AC-R-010b 前插下标正确性（FR-R-071，覆盖缺陷 B4）
```
GIVEN 命令表为 [open, click]，无选中行
WHEN  执行一次前插 chooseOkOnNextConfirmation
THEN  命令表为 [open, chooseOkOnNextConfirmation, click]
AND   不得为 [chooseOkOnNextConfirmation, open, click]
```

### AC-R-011 回放不自录（US-R-009 / FR-R-030/031）
```
GIVEN 录制得到 10 条命令，已停止录制
WHEN  点击回放，全部执行完毕
THEN  命令表仍为 10 条
WHEN  在回放过程中（未停止）观察
THEN  不出现任何新增命令
```

### AC-R-011b 合成事件不入表（FR-R-030）
```
GIVEN 正在录制
WHEN  在控制台执行 document.querySelector('#loginBtn').click()
THEN  命令表不增长
WHEN  在控制台执行 el.dispatchEvent(new Event('change'))
THEN  命令表不增长（本项目要求 isTrusted 检查覆盖所有事件）
```

### AC-R-012 不录自己的 UI（US-R-010 / FR-R-034）
```
GIVEN 正在录制，页面上有录制浮层
WHEN  点击浮层的标题文字
THEN  命令表不增长
WHEN  点击浮层的 padding 空白区（事件目标为浮层根元素本身）
THEN  命令表不增长        ← KR 的 parentNode 判断在此处失效，本项目必须通过
WHEN  点击浮层的 Stop 按钮
THEN  录制停止，且命令表不增长
```

### AC-R-013 窗口隔离（US-R-011 / FR-R-032/033）
```
GIVEN 在窗口 A 中开始录制
WHEN  切到窗口 B（非派生）并点击其中的元素
THEN  命令表不增长
AND   不产出 selectWindow
WHEN  切回窗口 A 并点击
THEN  正常录制
```

### AC-R-014 下拉框（US-R-012 / FR-R-018）
```
GIVEN <select id="city"><option>北京</option><option>上海</option></select>
WHEN  选中「上海」
THEN  命令表恰好新增 1 行：
        select | id=city | label=上海
AND   不出现 click / mousedown 相关命令
```

### AC-R-014b 多选框（FR-R-019）
```
GIVEN <select id="tags" multiple> 已选中 A，未选中 B、C
WHEN  加选 B、取消 A
THEN  命令表新增 2 行（顺序按 option 在 DOM 中的次序）：
        removeSelection | id=tags | label=A
        addSelection    | id=tags | label=B
```

### AC-R-015 停止后干净（US-R-015 / FR-R-035 / NFR-R-003）
```
GIVEN 已开始并停止录制 20 次
WHEN  在 DevTools 执行 getEventListeners(document)
THEN  各事件类型的监听器数量与「从未录制过」时一致
AND   页面上不存在 #myRecorderOverlay 元素
AND   页面文本选择、拖拽等原生行为不受影响
```

### AC-R-016 file 输入特判（E16 / FR-R-014）
```
GIVEN <input id="f" type="file">，正在录制
WHEN  点击并选择一个文件
THEN  命令表新增 1 行 click | id=f |
AND   不产出 type | id=f | C:\fakepath\xxx.png
```

### AC-R-017 IME 输入（E13）
```
GIVEN <input id="q">，正在录制，使用拼音输入法
WHEN  输入 "zhongwen" 并选词得到「中文」，然后失焦
THEN  命令表恰好新增 1 行：type | id=q | 中文
AND   不出现拼音中间态
```

### AC-R-018 异常隔离（NFR-R-009 / E17）
```
GIVEN 人为在 select 的 change handler 中注入 throw new Error('boom')
WHEN  在 <select> 上改选
THEN  控制台出现该错误
AND   同一 change 事件上的 type handler 仍正常执行完毕
AND   后续所有录制功能正常
```

### AC-R-019 可解释性（NFR-R-011 / US-R-016）
```
GIVEN 开启 debug 模式
WHEN  快速双击某按钮
THEN  trace 输出两条记录：
        { eventType:'click', outcome:'recorded',   command:'click' }
        { eventType:'click', outcome:'suppressed', suppressReason:'click-dedupe-window' }
```

### AC-R-020 幂等挂载（FR-R-004/062）
```
GIVEN 页面已挂载录制器
WHEN  连续发送 5 次 ATTACH_RECORDER 消息
AND   点击一个按钮
THEN  命令表恰好新增 1 行
AND   页面上只有 1 个浮层元素
```

### AC-R-021 SPA 路由（E4，负面用例）
```
GIVEN 正在录制一个使用 history.pushState 的 SPA
WHEN  点击导航链接使路由变化（无页面重载）
THEN  只产出 click，不产出 open
AND   此行为被记录在「已知限制」文档中
```

---

## 10. Out of Scope

以下内容**明确不在**本录制引擎的范围内。

| # | 排除项 | 理由 |
|---|---|---|
| **OOS-1** | 网络请求录制 / HAR 导出 / Mock | 与录制回放的语义层级正交。若需要，应作为独立模块，不与录制引擎耦合 |
| **OOS-2** | 回放执行器 | 独立子系统。本文档只定义"产出什么命令"，不定义"如何执行" |
| **OOS-3** | 定位器生成算法与自愈 | 见 `_distill/tech/TECH-02-定位器与自愈.md` 与 `_distill/prd/PRD-02-定位器与自愈.md`。本引擎只调用 `buildAll(el)` 接口 |
| **OOS-4** | 命令导出格式（Java/Python/C#/Robot 等） | 属于格式化器（formatter）子系统。KR 中在 `panel/js/katalon/newformatters/*` |
| **OOS-5** | 测试套件 / 测试用例的组织与持久化 | 属于数据层。本引擎只要求"命令能追加到某个命令表" |
| **OOS-6** | 变量、参数化、数据驱动（CSV/Excel） | 后续迭代 |
| **OOS-7** | 云端存储、团队协作、Katalon TestOps 集成 | 个人版插件不需要 |
| **OOS-8** | 埋点与用户行为分析（Segment 等） | KR 有（`segment-tracking-service.js`），个人版不需要 |
| **OOS-9** | Firefox / Safari 支持 | 首版只做 Chromium |
| **OOS-10** | Manifest V2 兼容 | 只做 MV3 |
| **OOS-11** | 移动端 / 响应式录制（触摸事件 `touchstart`/`touchend`） | KR 也不支持。若需要，需新增独立的触摸语义层 |
| **OOS-12** | Closed Shadow DOM 穿透 | 浏览器不提供能力 |
| **OOS-13** | Canvas / WebGL 内部元素录制 | 无 DOM 结构可定位 |
| **OOS-14** | 视觉录制（截图 + 图像比对） | 完全不同的技术路线 |
| **OOS-15** | 录制期的性能剖析 / Lighthouse 集成 | 与录制目标无关 |
| **OOS-16** | 命令的自动断言推断（如"点击后自动加 assertText"） | 噪音大于价值；保留右键手动加断言（FR-R-090） |
| **OOS-17** | KR 的 KU 录制器（`katalon/ku-recorder.js` + `katalon/ku-recorder-event-handlers.js`） | 这是 KR 内并行存在的第二套录制器，其 `record` 调用全部被注释，属于未启用的实验性代码，不作为参考 |
| **OOS-18** | `debugger` 权限相关能力（CDP 截图、文件上传） | 属于回放能力，非录制 |
| **OOS-19** | 已废弃事件（`DOMNodeInserted` 等 Mutation Events）的支持 | 浏览器正在移除；如需 DOM 变更检测应用 `MutationObserver` |
| **OOS-20** | 坐标型命令（`clickAt` / `mouseMoveAt` / `dragAndDrop` 的像素偏移形态） | 脆弱、跨分辨率不可移植。KR 中相关产出也已全部注释 |

---

## 附录：需求追溯矩阵

| 用户故事 | 关联功能需求 | 关联验收用例 |
|---|---|---|
| US-R-001 | FR-R-008, FR-R-010, FR-R-025 | AC-R-001 |
| US-R-002 | FR-R-012, FR-R-013, FR-R-014 | AC-R-002, AC-R-017 |
| US-R-003 | FR-R-011 | AC-R-003 |
| US-R-004 | FR-R-060, FR-R-061, FR-R-062, FR-R-041 | AC-R-006 |
| US-R-005 | FR-R-043, FR-R-044, FR-R-045, FR-R-046 | AC-R-007 |
| US-R-006 | FR-R-050~FR-R-054 | AC-R-009, AC-R-009b, AC-R-009c |
| US-R-007 | FR-R-015, FR-R-016, FR-R-017 | AC-R-004, AC-R-004b, AC-R-004c, AC-R-005 |
| US-R-008 | FR-R-071, FR-R-082, FR-R-083 | AC-R-010, AC-R-010b |
| US-R-009 | FR-R-030, FR-R-031, FR-R-061 | AC-R-011, AC-R-011b |
| US-R-010 | FR-R-034 | AC-R-012 |
| US-R-011 | FR-R-032, FR-R-033, FR-R-048 | AC-R-013 |
| US-R-012 | FR-R-018, FR-R-019, FR-R-020 | AC-R-014, AC-R-014b |
| US-R-013 | FR-R-090~FR-R-093 | —（P2） |
| US-R-014 | FR-R-070, FR-R-072 | E24 |
| US-R-015 | FR-R-035, NFR-R-003 | AC-R-015 |
| US-R-016 | NFR-R-011 | AC-R-019 |
| US-R-017 | NFR-R-013 | —（代码审查） |

**缺陷修复追溯**（对应 TECH-01 §10）：

| KR 缺陷 | 本 PRD 中的约束 |
|---|---|
| B1 doubleClick 死代码 | FR-R-025（不得产出 doubleClickAt）+ AC-R-003 |
| B2 document_start 空集 | FR-R-007 + AC-R-002 |
| B3 空指针定时器 | FR-R-007（B2 的衍生） |
| B4 前插 off-by-one | FR-R-071 + AC-R-010b |
| B5 导航不重置 frame | FR-R-054 + AC-R-009c |
| B6 URL 子串比对 | FR-R-041 |
| B7 缺空守卫 | E21 + NFR-R-009 |
| B8 监听器泄漏 | FR-R-035 + NFR-R-006 + AC-R-015 |
| B9 Port 泄漏 | FR-R-093 |
| B13 重复 buildAll | NFR-R-002 |
| B14 隐式全局 | NFR-R-005 |
| B16 isTrusted 覆盖不全 | FR-R-030 + AC-R-011b |
| B19 Shadow DOM 钩子未完成 | FR-R-005 |
| B20 DOMNodeInserted | OOS-19 |

---

*文档结束。*
