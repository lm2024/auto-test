# PROMPT-01 · 录制引擎（事件捕获 → 语义命令）提示词包

> 用途：把 KR 7.1.0（MV3）录制引擎的源码事实压缩成**可直接粘贴给 LLM 的自包含提示词**，用于
> ①从零复刻一个最小录制引擎；②逐 handler 增量移植；③排查「录多了/录少了/顺序错/跨导航断/iframe 错位」。
> 纪律：所有结论必须带 `路径:行号`，禁止臆测；找不到写「未在源码中找到」；全部简体中文。
> 配套：`_distill/tech/TECH-01-录制引擎.md`（证据全集）、`_distill/prd/PRD-01-录制引擎.md`（需求编号）。

---

## 一、用法说明

本文件包含 4 段可独立粘贴的提示词：

| 编号 | 名称 | 场景 | 期望产出 |
|---|---|---|---|
| P0 | **主提示词（自包含）** | 让 LLM 完整理解并输出裁剪方案 | 架构说明 + 表格 + 骨架代码 |
| A | **变体 A · 骨架导向** | 我要一次性拿到能跑的最小引擎 | 只出代码，4 个文件 |
| B | **变体 B · 增量移植导向** | 我要一个 handler 一个 handler 搬 | 移植批次计划 + 单批代码 |
| D | **调试提示词 D1–D5** | 我的引擎已经跑起来但行为不对 | 排查决策树 + 根因 |

粘贴前请替换：
- `{{SRC_DIR}}` → 源码根目录（默认 `7.1.0_0`）
- `{{MY_EXT}}` → 你自己的插件工程目录

> **前置认知（回答用户最初的困惑）**
> "为什么录制出来的是 `click / type / select`，而不是一堆 `XHR/fetch`？"
> 因为 KR **根本没有申请 `webRequest` 权限**（`manifest.json:64` 的 permissions 数组里没有它），
> 它压根看不见网络层。它监听的是 **DOM 事件**（`click/change/keydown/...`），
> 再经过「白名单 → 入口守卫 → 状态机」三层过滤，把几十个原始事件**塌缩**成一条语义命令。
> 网络请求是「点击的后果」，而录制记录的是「原因」——这就是可回放性的来源。

---

## 二、P0 · 主提示词（自包含，直接粘贴）

```
你是一位资深测试工具架构师 + 技术文档作者。我要把 Chrome 扩展 Katalon Recorder 7.1.0（MV3）
的【录制引擎】逆向裁剪成一个个人录制回放插件。请基于我给出的「已核实事实」作答，
不要臆测源码里没有的东西。

【源码目录】{{SRC_DIR}}
【必读文件（录制主链路）】
- manifest.json                                   （权限集合 / content_scripts 注入时机）
- content/recorder.js                             （Recorder 类：attach/detach/record/frameLocation）
- content/recorder-handlers.js                    （19 个 handler 注册，事件→命令的语义层）
- content/locatorBuilders.js                      （buildAll，生成 target 候选数组）
- content/command-receiver.js                     （SideeXPlayingFlag、attach/detach 消息入口）
- content/prompt-injecter.js                      （把 MAIN world 的对话框事件转发进扩展）
- page/prompt.js                                  （猴子补丁 alert/confirm/prompt）
- content/inject-popup-record.js                  （页面内 Recording 浮层 + Stop 按钮）
- panel/js/background/recorder.js                 （录制会话总控：标签页/窗口/命令落库）
- panel/js/background/editor.js                   （录制开关标志位 + 挂载握手）
- panel/js/UI/view/records-grid/add-command.js    （命令写入表格，含 insertBeforeLastCommand）
- panel/js/UI/models/test-model/test-command.js   （TestCommand 数据模型）
- background/background.js                        （右键菜单 17 项 → 断言/验证命令）

【硬性纪律】
1. 每个结论必须带 `文件路径:行号`；找不到就写「未在源码中找到」。
2. 全部简体中文（代码标识符除外）。
3. 不要把「回放」逻辑混进来，本次只谈录制。

──────────────────────────────────────────────
【已核实事实 F1–F14（可直接引用，均已回源码核对）】

F1. 【没有网络层】manifest.json:64 的 permissions 不含 webRequest / webRequestBlocking，
    因此引擎在 DOM 事件层工作，不在网络层。录制产出是"用户意图"，不是"HTTP 流量"。

F2. 【三个执行上下文】
    - Content Script：注入每个 frame，跑 Recorder + handlers（document_start 时机）。
    - Panel 独立窗口：panel/js/background/recorder.js 才是真正的"录制后台"，持有会话状态。
    - Service Worker：background/background.js 只做右键菜单等边角事务；
      panel/js/background/recorder.js 并不在 SW 里（worker_wrapper.js 的 importScripts 未包含它）。

F3. 【capture 阶段监听 + C_ 前缀】
    Recorder.addEventHandler(handlerName, eventName, handler, options)（recorder.js:121-130）
    用 `let key = options ? ('C_' + eventName) : eventName` 把"是否 capture"编码进 key；
    parseEventKey（recorder.js:35-41）用 /^C_/ 反解出 {eventName, capture}。
    attach（recorder.js:44-68）据此 document.addEventListener(eventName, fn, capture)。
    这么做的唯一目的是让 detach（recorder.js:71-83）能对称摘除同一组监听器。
    走 capture 是为了抢在页面 stopPropagation / SPA 重渲染卸载节点**之前**拿到事件。

F4. 【事件→命令的三层塌缩】
    第一层 白名单：只有被 addEventHandler 注册过的事件类型才会进入引擎。
    第二层 入口守卫：handler 开头的 if 早退（isTrusted、SideeXPlayingFlag、preventClick、
            preventClickTwice、popupInjectionKR 过滤等）。
    第三层 状态机：typeLock / typeTarget / preventType / preventClick 等模块级变量跨事件协同。
    结果：一次"输入 abc 并回车"产生的几十个 keydown/keypress/input/keyup/change/submit，
    最终只落 1~2 条命令。

F5. 【input 只记指针，change 才出命令】
    - input handler（recorder-handlers.js:82-85）只做 `typeTarget = getEventTarget(event)`，
      不产出任何命令。
    - change handler（recorder-handlers.js:49-80）才根据 tagName/type 产出
      type / sendKeys / addSelection / removeSelection 等命令。
    合并"逐字符输入 → 一条 type"靠的是**浏览器原生 change 语义**（失焦或提交时才触发），
    源码中**没有**任何 setTimeout 防抖定时器。

F6. 【typeLock：跨 keydown→change 的互斥锁】
    模块级 `var typeLock = 0`（recorder-handlers.js:27 附近）。
    keydown handler（:159-248）在识别 Enter 时置锁并决定是否补 type，
    change handler（:49-80）读锁避免重复落 type。锁是**跨事件**的，不是函数内局部量。

F7. 【click 的五道守卫】click handler（recorder-handlers.js:89-111）依次检查：
    ① event.isTrusted（拒绝合成事件，防自录）
    ② SideeXPlayingFlag（回放期间静音）
    ③ preventClick（提交后 500ms 静音窗口）
    ④ preventClickTwice（30ms 内第二次 click 折叠为 doubleClick 或丢弃）
    ⑤ popupInjectionKR 过滤（record() 内，recorder.js:102-118：target 命中该 class 直接不发）

F8. 【frameLocation 与 selectFrame】
    getFrameLocation（recorder.js:85-100）自底向上拼出 `root:0:1` 形态的坐标。
    每条 record 消息都带 frameLocation（recorder.js:102-118）。
    后台 addCommandMessageHandler（panel/js/background/recorder.js:175-344）比较
    上一条与本条的 frameLocation，用**最近公共祖先（LCA）差分**产出
    `selectFrame relative=parent`（回退若干级）+ `selectFrame index=N`（逐级下钻），
    或 `selectFrame relative=top` 回顶层。

F9. 【多窗口 win_ser 别名】
    第一个窗口固定别名 `win_ser_local`，后续为 `win_ser_1/2/...`。
    webNavigation.onCreatedNavigationTarget（panel/js/background/recorder.js:152-173）
    做"血统检查"确认新标签页由被录窗口打开，才分配别名并产出
    selectWindow / (三明治) close 序列。

F10.【挂载握手 attachRecorderRequest】
    内容脚本侧 attachRecorderRequest（recorder-handlers.js:522-526）向后台"报到"，
    后台在 editor.js:69-74 应答；命中则下发 attachRecorder。
    这是**跨导航保持录制**的关键：新页面 document_start 时主动问"还在录吗"，
    而不是后台去追着注入。幂等：重复 attach 被 recorder.js:45-47 的 `if (this.attached) return` 挡住。

F11.【insertBeforeLastCommand（因果倒置）】
    alert/confirm/prompt 的"预期对话框"命令必须排在触发它的 click **之前**。
    record() 第 4 参 insertBeforeLastCommand（recorder.js:102-118）为 true 时，
    走 addCommandBeforeLastCommand（add-command.js:149-151）。
    ⚠ KR 在 add-command.js:98 有 `-2` off-by-one，多层对话框场景会插错位（缺陷 B1）。

F12.【防自录五道闸门】
    ① event.isTrusted ② SideeXPlayingFlag（command-receiver.js:81-105）
    ③ popupInjectionKR class 过滤（recorder.js:102-118）
    ④ isPrivilegedPage（panel/js/background/recorder.js:346-352，chrome:// 等不录）
    ⑤ Panel 独立窗口本身不在录制窗口列表内。

F13.【已知缺陷（务必在你的实现里修掉）】
    B1  add-command.js:98 的 `-2` 越界，多对话框场景插错位。
    B2  ⚠最严重：focus/blur 监听器在 document_start 时刻用
        `document.getElementsByTagName("input")` 取节点（recorder-handlers.js:135-151），
        此刻 DOM 为空 → 监听器从未绑定 → `preventType` 永远不复位 → 静默丢命令。
        修法：改用 document 级 capture 委托，或 DOMContentLoaded 后再绑定。
    B3  inject-popup-record.js:83-99 每次开始录制都新增 document 级监听器，不移除 → 泄漏。
    B4  19 个 handler 中仅约 8 个真正产出命令，其余整段被注释或不可达 → 裁剪时别照抄。
    B13 KU（katalon/ku-recorder.js）与 KR 并行存在两套录制器，KU 的 record 全被注释。
    B16 无 `*AndWait` 命令：全库 grep 确认 AndWait 只出现在回放/格式器，录制侧不产出。
    B19 右键菜单 17 项（background/background.js:123-226）与主链路耦合松散。

F14.【命令产出白名单（录制侧真实会出现的）】
    click / doubleClick / type / sendKeys / select / addSelection / removeSelection /
    submit / open / selectFrame / selectWindow / close / dragAndDropToObject /
    editContent / runScript(部分) + 右键菜单产出的 assert*/verify*/store* 系列。
    open 有 4 个触发点，且**不带** AndWait 后缀。

──────────────────────────────────────────────
【任务：请依次输出以下 8 项】

1. 一段 ≤200 字的「为什么录到的是语义操作而不是网络请求」解释，面向 Java 工程师，
   用 Servlet Filter / AOP 切面 做类比，并引用 F1、F3。

2. 一张「三层塌缩」表：层名 / 实现位置(路径:行号) / 挡掉了什么 / 举一个被挡的例子。

3. 一张「19 个 handler 清单」表：handlerName / 事件名 / 是否 capture / 是否真的产出命令 /
   产出的命令 / 行号。对不产出命令的标注原因（全注释 / 不可达 / 仅设状态）。

4. 用「在输入框敲 abc 然后按 Enter 提交表单」这一个场景，
   画出**逐事件时间线**（keydown×3 / input×3 / keyup×3 / change / submit / click），
   标注每个事件被哪一层挡掉或改写了哪个状态变量，最终落几条命令。必须引用 F5、F6、F7。

5. 一张「状态机变量总表」：变量名 / 作用域 / 生命周期 / 谁写谁读 / 不复位的后果。
   至少覆盖 typeLock、typeTarget、preventType、preventClick、preventClickTwice、
   SideeXPlayingFlag、attached、frameLocation。

6. 一张「裁剪 checklist」：必留（capture 注册 / C_ 前缀 / record 消息协议 / frameLocation 差分 /
   握手 / insertBeforeLastCommand）、必删（KU 双轨 / 云端上报 / 全注释 handler）、
   必修（B1 / B2 / B3）。每项给行号。

7. 一段 ≤300 行的 TypeScript/JavaScript **最小录制引擎骨架**，包含 4 个文件：
   manifest.json（MV3，document_start，all_frames）、recorder.ts（attach/detach/record/frameLocation）、
   handlers.ts（只保留 click/dblclick/change/input/keydown/select 六类）、
   panel.ts（会话状态 + frame 差分 + 命令落库）。
   要求：每个函数上方一行注释写明对应 KR 源码 `路径:行号`；已修复 B1/B2/B3。

8. 一张「与 KR 的差异说明表」：我删了什么 / 为什么删 / 风险是什么。

输出格式：Markdown，中文，表格优先，代码块标注语言。
```

---

## 三、变体 A · 最小可运行骨架导向（只要代码）

```
基于事实 F1–F14，请**只产出代码**，不要任何解释性段落。产出 4 个文件，用 4 个代码块分隔：

【文件 1】manifest.json
- MV3；permissions 仅 ["tabs","storage","scripting","webNavigation","contextMenus"]，
  **禁止**加 webRequest（理由见 F1，注释里写明）。
- content_scripts: { matches:["<all_urls>"], all_frames:true, run_at:"document_start" }。

【文件 2】recorder.js
必须实现（每个方法顶部注释标注 KR 对应 路径:行号）：
- class Recorder { constructor(window) }                       // 参照 content/recorder.js
- static addEventHandler(name, eventName, handler, capture)    // :121-130，capture → 'C_'+eventName
- static parseEventKey(key)                                    // :35-41，/^C_/ 反解
- attach()  // :44-68，遍历 eventHandlers，addEventListener(name, fn, capture)；
            //          开头 if(this.attached) return（幂等，参照 :45-47）
- detach()  // :71-83，用同一 capture 值 removeEventListener（否则摘不掉）
- getFrameLocation() // :85-100，自底向上拼 'root:0:1'
- record(command, target, value, insertBeforeLastCommand, actualFrameLocation)
            // :102-118，过滤 popupInjection class；sendMessage 带 frameLocation

【文件 3】handlers.js
只注册 6 个 handler，全部 capture=true：
- 'click'  on 'click'      // 参照 :89-111，实现 F7 的五道守卫（isTrusted / playing /
                           //   preventClick / preventClickTwice 30ms / popup 过滤）
- 'clickAt' 折叠为 doubleClick 分支（30ms 窗口内第二次）
- 'type'   on 'change'     // 参照 :49-80，按 tagName/type 分流 type / select /
                           //   addSelection / removeSelection
- 'type'   on 'input'      // 参照 :82-85，**只**做 typeTarget = getEventTarget(event)
- 'sendKeys' on 'keydown'  // 参照 :159-248，仅保留 Enter/Tab/Esc 决策；用 typeLock 防重复
- 'select' on 'focus'+'change' 的快照差分  // 参照 :569-610，getOptionLocator 见 :529-549
模块级状态变量：typeTarget、typeLock、preventClick、preventClickTwice、preventType。
⚠ 修复 B2：不要用 document.getElementsByTagName('input') 逐节点绑 focus/blur，
   改成 document 级 capture 委托（在注释里写明"修复 KR recorder-handlers.js:135-151 缺陷"）。

【文件 4】panel.js（录制会话总控，参照 panel/js/background/recorder.js:1-401）
- 会话状态：recordingTabId / recordingWindowId / currentFrameLocation / lastCommand
- onMessage 处理 record 消息                    // 参照 :175-344
- frame 差分：LCA 算法产出 selectFrame relative=parent×N + index=N   // 参照 F8
- 窗口别名：win_ser_local / win_ser_N            // 参照 :152-173
- attachRecorderRequest 应答握手                 // 参照 editor.js:69-74
- addCommand / addCommandBeforeLastCommand       // 参照 add-command.js:21-141,149-151
  ⚠ 修复 B1：不要用 length-2，用显式定位"最后一条命令的索引"。

硬性要求：
- 每个函数上方 1 行注释 `// KR: 路径:行号 —— 一句话说明`。
- 不实现回放、不实现定位器自愈（引用 TECH-02 即可）。
- 不产出任何 *AndWait 命令（F13/B16）。
- 代码可直接 load unpacked 运行，控制台无报错。
```

---

## 四、变体 B · 逐 handler 增量移植导向（分批搬运）

```
我已经有一个空壳插件 {{MY_EXT}}（MV3，content script 已注入，能 sendMessage 到 panel）。
现在要把 KR 的 handler **分批**搬过来，每批可独立验证。请你：

第一步，输出一张「移植批次计划表」，列 5 批，每批含：
  批次号 / 搬哪些 handler / 依赖的状态变量 / 依赖的基础设施 / 验收动作 / 预期命令序列。
建议批次（可调整但需说明理由）：
  批次 1 基础设施：addEventHandler/parseEventKey/attach/detach/record/getFrameLocation
                  （recorder.js:121-130,35-41,44-68,71-83,102-118,85-100）
  批次 2 click 家族：click + doubleClick 折叠（recorder-handlers.js:89-111，F7 五道守卫）
  批次 3 文本输入：input(:82-85) + change(:49-80) + keydown(:159-248) + typeLock(F6)
  批次 4 上下文：frameLocation 差分(F8) + win_ser 别名(F9) + 握手(F10)
  批次 5 高级：对话框 insertBeforeLastCommand(F11) + 右键菜单(F13/B19) + 拖拽/富文本

第二步，我说「做批次 N」时，你**只**输出该批次的完整代码 + 一段"手工验收脚本"
（我在浏览器里要做哪几个动作、面板里应该出现哪几条命令、命令的 target/value 应该长什么样）。

每批的硬性要求：
1. 每个函数上方注释 `// KR: 路径:行号`。
2. 明确列出该批引入的模块级状态变量，以及**它们在什么时候复位**（这是 KR 最容易出 bug 的地方，
   参见 B2：preventType 因 focus/blur 从未绑定而永不复位）。
3. 给出"这批做完后，还不能录到什么"的清单，避免我误判为 bug。
4. 若某个 KR handler 在 7.1.0 里其实是全注释/不可达（B4），直接告诉我"跳过，不用搬"，并给行号。

第三步，5 批全部完成后，输出一张「与 KR 行为差异对照表」和一份回归清单
（对应 PRD-01 的 AC-R-001~021）。
```

---

## 五、调试提示词 D1–D5（五类典型故障 SOP）

### D1 · 录多了（命令噪音、一次操作出好几条）

```
我的录制引擎「录多了」。同一次点击产生了 2~3 条命令，或者鼠标一动就冒命令。
请按下面的决策树逐节点排查，每个节点给出对应 KR 源码 路径:行号 与我该加的日志：

1. 白名单层：我是不是注册了 mousedown/mouseup/mousemove 之类的高频事件？
   （KR 只注册了必要事件，见 recorder-handlers.js 的 addEventHandler 调用点）
2. capture 重复绑定：attach() 是否幂等？（KR: recorder.js:45-47 `if(this.attached) return`）
   跨导航握手（F10）会不会导致同一 frame 被 attach 两次？
3. all_frames 重复：同一动作是否在父/子 frame 各录了一次？（检查 frameLocation 字段）
4. 双击折叠：preventClickTwice 的 30ms 窗口是否失效？（KR: recorder-handlers.js:89-111）
5. 提交静音：preventClick 的 500ms 窗口是否没设？（同上，F7 第③道）
6. 合成事件：event.isTrusted 是否漏判？我的浮层/高亮脚本是否触发了合成 click？
7. 自录：浮层元素是否加了 popupInjectionKR 等价的 class 并在 record() 里过滤？
   （KR: recorder.js:102-118；注意 B3 泄漏：inject-popup-record.js:83-99）
8. 回放静音：SideeXPlayingFlag 是否在回放期间置位？（command-receiver.js:81-105）

输出：决策树 + 每节点一行日志代码 + 最可能的 1 个根因 + 修复片段。
```

### D2 · 录少了（该有的命令没出来，尤其是 type）

```
我的录制引擎「录少了」：在输入框里打字后，面板里没有 type 命令；或者某些点击没被记录。
请按下面清单排查，重点怀疑**状态变量没复位**：

1. type 的产出点：我是不是错误地在 input 事件里产出命令？
   正确做法是 input 只记指针（KR: recorder-handlers.js:82-85），change 才产命令（:49-80）。
   如果元素一直没失焦、也没提交，浏览器**不会**触发 change —— 这不是 bug，是设计（F5）。
2. ⚠ preventType 永不复位（KR 的 B2 缺陷）：
   KR 在 recorder-handlers.js:135-151 用 document.getElementsByTagName("input") 绑 focus/blur，
   但 content script 是 document_start 注入，此刻 DOM 为空 → 监听器从未绑定 →
   preventType 一旦被置位就永远为真 → 后续 type 全部被静默吞掉。
   请检查我的实现是否照抄了这个写法；正确做法是 document 级 capture 委托。
3. typeLock 死锁：keydown 置锁后，是否存在某条路径没有解锁？（F6）
4. preventClick 窗口过长：500ms 静音窗口是否覆盖了用户的正常连续点击？
5. isTrusted 误杀：某些浏览器/自动化环境下事件 isTrusted 为 false。
6. capture 被吃：页面在 capture 阶段调用了 stopImmediatePropagation？
   （走 capture + 绑在 document 上已是最早时机，见 F3；若仍被吃需确认监听顺序）
7. 特权页面：是不是在 chrome:// / Chrome 应用商店页面操作？
   （KR: panel/js/background/recorder.js:346-352 isPrivilegedPage 直接不录）
8. handler 是死的：我搬的这个 handler 在 KR 里本来就是全注释/不可达（B4）？

输出：排查表（现象→检查点→路径:行号→判定方法）+ 最可能根因 + 修复片段。
```

### D3 · 顺序错（命令排列与操作顺序不一致）

```
我的录制命令顺序不对。典型：点击按钮弹出 confirm 后，assertConfirmation 排在 click 后面
（应该在前面）；或多层对话框时插到了错误位置。请排查：

1. 因果倒置机制：对话框类命令必须用 insertBeforeLastCommand=true 前置
   （KR: recorder.js:102-118 第 4 参 → add-command.js:149-151）。我是否漏传了这个参数？
2. ⚠ off-by-one（KR 的 B1 缺陷）：add-command.js:98 用了 `-2` 偏移，
   在"一次点击触发多个对话框"时会插错位置。请检查我是否照抄；
   正确做法是显式记录"最后一条真实命令"的索引再前插一位。
3. 对话框事件通路：MAIN world 的 alert/confirm/prompt 被猴子补丁覆写（page/prompt.js:56-177），
   经 postMessage 转发（content/prompt-injecter.js:26-74）进扩展。
   跨进程转发是**异步**的，是否可能晚于 click 消息到达后台？请给出加序号/时间戳的对策。
4. frame 切换命令位置：selectFrame 是否插在了目标命令**之后**？（F8：差分必须先出 selectFrame）
5. 窗口切换：selectWindow / close 的"三明治"顺序是否正确（F9）？
6. 异步落库：我的 panel 端 addCommand 是否是异步的，导致并发消息乱序？
   建议在后台用单队列串行消费 record 消息。

输出：一张「顺序保证点」表（保证点 / 实现位置 / 失效表现）+ 根因 + 修复片段。
```

### D4 · 跨导航断（页面跳转后不再录制）

```
页面一跳转，我的录制就停了。请按握手机制排查：

1. 握手方向：KR 是**内容脚本主动报到**，不是后台追着注入。
   新页面 document_start 时发 attachRecorderRequest（recorder-handlers.js:522-526），
   后台在 editor.js:69-74 判断"当前是否在录"，是则下发 attachRecorder。
   我的实现是否反过来了（后台在 onCommitted 里注入）？那样会有竞态窗口。
2. 注入时机：content_scripts.run_at 必须是 document_start，
   否则会错过页面早期事件；all_frames 必须为 true，否则 iframe 内不录。
3. 会话标志位：后台的"正在录制"标志是否在导航时被重置？（KR: editor.js:34 附近的 flags）
4. 幂等：重复 attach 是否被挡？（recorder.js:45-47）不挡会造成 D1 的"录多了"。
5. sendMessage 失败静默：KR 的 record() 在 catch 里**故意不做 detach**
   （recorder.js:102-118 的 KAT-BEGIN/KAT-END 注释块把 self.detach() 注释掉了）。
   我是否在 catch 里误加了 detach，导致一次偶发失败就永久停录？
6. bfcache / SPA：pushState 不触发 document_start，内容脚本不会重跑 —— 这种情况本来就不需要重挂。
7. 特权页跳转：跳到 chrome:// 后无法注入（F12 第④道），返回后是否能自动恢复？

输出：一张「握手时序图」（内容脚本 ↔ 后台，标注 路径:行号）+ 竞态点清单 + 根因。
```

### D5 · iframe 错位（命令录到了，但回放时找不到元素）

```
我的引擎在 iframe 页面上录制，回放时元素找不到，或者操作到了错误的 frame。请排查：

1. frameLocation 生成：是否自底向上拼接到 'root'？形态应为 `root:0:1`
   （KR: recorder.js:85-100）。我的实现是否用了 frame 的 URL 或 name 代替索引？
2. 消息携带：每条 record 消息是否都带了 frameLocation？（recorder.js:102-118）
   record 的第 5 参 actualFrameLocation 用于覆盖（对话框等特殊场景）。
3. 差分算法：后台是否做了 LCA 差分？（F8，panel/js/background/recorder.js:175-344）
   正确产出应为：先若干条 `selectFrame relative=parent` 回退到公共祖先，
   再若干条 `selectFrame index=N` 逐级下钻；回顶层用 `selectFrame relative=top`。
4. 首条命令：会话第一条命令若发生在 iframe 内，是否补了从 top 下钻的 selectFrame？
5. 索引一致性：录制时的 frame 索引依赖 window.frames 顺序，
   若页面动态增删 iframe，索引会漂移 —— 这是**设计局限**，请在文档里标注而不是当 bug 修。
6. all_frames 注入：是否每个 frame 都跑了 Recorder？跨域 iframe 是否被注入？
7. 上下文残留：上一条命令的 frameLocation 是否在会话切换标签页时被清空？

输出：一个具体三层 iframe 例子（root → root:0 → root:0:1）的**差分推演两遍**
（从 root:0:1 到 root:2，以及从 root:2 回 root），给出应产出的完整 selectFrame 序列。
```

---

## 六、附录 · 可直接粘贴的事实速查块

> 当上下文有限、只能粘贴一小段时，用下面这块「压缩事实」替代 P0 的 F1–F14。

```
KR 7.1.0 录制引擎压缩事实：
- 无 webRequest 权限(manifest.json:64) → 只能监听 DOM 事件，不看网络。
- addEventHandler(recorder.js:121-130) 用 'C_'+eventName 编码 capture；
  parseEventKey(:35-41) 反解；attach(:44-68)/detach(:71-83) 对称。
- 全部绑在 document 的 capture 阶段，抢在 stopPropagation / SPA 卸载之前。
- 三层塌缩：白名单 → 入口守卫(if 早退) → 模块级状态机(typeLock/preventClick/...)。
- input(:82-85) 只记 typeTarget；change(:49-80) 才出 type/select/addSelection。
  合并靠浏览器 change 语义，无防抖定时器。
- click(:89-111) 五道守卫：isTrusted / SideeXPlayingFlag / preventClick(500ms) /
  preventClickTwice(30ms→doubleClick) / popupInjectionKR 过滤(record 内, :102-118)。
- keydown(:159-248) 处理 Enter/Tab/Esc，用 typeLock 与 change 互斥。
- getFrameLocation(:85-100) 产出 'root:0:1'；后台(panel/js/background/recorder.js:175-344)
  做 LCA 差分 → selectFrame relative=parent/index=N/relative=top。
- 窗口别名 win_ser_local / win_ser_N，血统检查在 :152-173。
- 挂载握手：attachRecorderRequest(recorder-handlers.js:522-526) ↔ editor.js:69-74。
- 对话框前置：record 第 4 参 insertBeforeLastCommand → add-command.js:149-151
  （:98 有 -2 off-by-one 缺陷 B1）。
- ⚠B2：focus/blur 用 getElementsByTagName("input") 在 document_start 绑定(:135-151)，
  DOM 为空 → 从未绑定 → preventType 永不复位 → 静默丢命令。必须改 document 级委托。
- ⚠B3：inject-popup-record.js:83-99 每次录制新增 document 监听器不移除 → 泄漏。
- 19 个 handler 中仅约 8 个真正产出命令（B4），其余全注释/不可达。
- 录制侧不产出任何 *AndWait 命令（B16）。
- 右键菜单 17 项在 background/background.js:123-226 产出 assert*/verify*/store*。
```

---

## 七、使用建议（面向 Java 工程师的类比）

| KR 概念 | Java 类比 | 说明 |
|---|---|---|
| capture 阶段监听 document | Servlet `Filter` 链最前置 | 在业务 Handler 之前拿到请求/事件 |
| 三层塌缩 | Filter → 前置校验 → 有状态 Service | 逐层过滤，最后由状态决定输出 |
| 模块级 typeLock | `ThreadLocal` / 实例字段锁 | 跨方法调用共享，忘了复位就死锁 |
| record() sendMessage | MQ 生产者 | 内容脚本只发，不关心谁消费 |
| panel 后台会话 | 有状态 Session Bean | 持有 lastCommand、frameLocation |
| frameLocation 差分 | 树路径 LCA | 与文件系统相对路径同理 |
| insertBeforeLastCommand | `List.add(index, e)` | 因果倒置的补偿写入 |
| attachRecorderRequest | 客户端心跳注册 | 服务端只应答，不主动推 |

---

*提示词包完。所有 `路径:行号` 均可在 `7.1.0_0` 源码中核对；证据全集见 `_distill/tech/TECH-01-录制引擎.md`，需求编号见 `_distill/prd/PRD-01-录制引擎.md`。*
