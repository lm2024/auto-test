# PROMPT-03 · 回放引擎（Playback）提示词包

> 用途：把 KR 7.1.0（MV3）回放引擎的源码事实反向喂给 LLM，辅助「裁剪个人录制回放插件」「排查回放卡死/超时」「补齐命令实现」。
> 纪律：所有结论必须带 `路径:行号`，禁止臆测；命令清单以 `Selenium.prototype.*` 的实际定义为准，注释块（`/* KAT-BEGIN … KAT-END */`）内的定义不算数。
> 配套文档：`_distill/tech/TECH-03-回放引擎.md`、`_distill/prd/PRD-03-回放引擎.md`、`_distill/skills/kr-playback-engine/SKILL.md`

---

## 一、用法说明

本文件包含 5 段可直接粘贴的提示词：

| 段 | 名称 | 适用场景 |
|---|---|---|
| 二 | **主提示词**（自包含，无需附源码即可让 LLM 理解全貌） | 从零规划裁剪方案 / 撰写设计文档 |
| 三 | **变体 A · 代码生成型** | 直接产出可运行的 MV3 回放引擎骨架 |
| 四 | **变体 B · 故障诊断型** | 回放卡死、超时、命令不执行 |
| 五 | **变体 C · 命令扩展型** | 新增一条自定义命令 |
| 六 | **调试提示词模板** | 8 类高频故障的定向追问 |

粘贴时替换占位符：

- `{{SRC_DIR}}` → 源码根目录（默认 `c:\Users\Li\Downloads\GitHub\auto-test\doc\老师\KatalonRecorder\7.1.0_0`）
- `{{MY_PROJECT}}` → 你的新插件工程目录
- `{{ERROR_LOG}}` → 粘贴的实际报错日志

---

## 二、主提示词（自包含）

> 特点：**不依赖 LLM 事先读源码**。所有关键事实、行号、派生规则、坑点都已内嵌，LLM 拿到即可推理。

```text
你是一位资深测试工具架构师 + 技术文档作者。我是 Java 背景工程师，要把 Chrome 扩展
Katalon Recorder 7.1.0（Manifest V3）的【回放引擎 Playback】逆向裁剪成一个个人录制回放插件。

以下是我从源码中核实过的全部关键事实（源码根目录 {{SRC_DIR}}，路径均相对该根目录）。
请你把它们当作 ground truth，不要臆造额外事实；如果我给的事实不足以回答，请明确说
「源码中未提供该信息」，而不是猜测。

════════════════════════════════════════════════════════════════════
【事实 0】两套并存的回放体系（最大的坑）
════════════════════════════════════════════════════════════════════
A. UI 内回放（主线，必须保留）
   目录 panel/js/background/playback/
   核心文件 panel/js/background/playback/service/actions/play/play-actions.js（1565 行）
B. 外部 Socket 回放（可整块删除）
   目录 playback/（7 个文件）
   入口 playback/index.js:3   const socket = io.connect('http://localhost:3500');
   用途：供 Katalon Studio / CI 远程驱动
下文只讨论 A。

════════════════════════════════════════════════════════════════════
【事实 1】进程模型（四个 JS 执行环境）
════════════════════════════════════════════════════════════════════
1) Panel 页面进程   —— 侧边栏 UI + 回放主控（play-actions.js / window-controller.js）
                       MV3 限制：不能 eval / new Function
2) Content Script   —— isolated world，命令真正落地（command-receiver.js / selenium-api.js）
                       可以 eval（不受 Panel CSP 约束）
3) Service Worker   —— background/kar.js，负责 chrome.debugger CDP、截图
4) Page 上下文      —— page/prompt.js、page/runScript.js，用 <script> 注入，
                       用于改写 window.alert/confirm/prompt（isolated world 改写无效）

════════════════════════════════════════════════════════════════════
【事实 2】完整下行链路（五级）
════════════════════════════════════════════════════════════════════
play-actions.js  doCommand()                                    :935-963
  → extCommand.sendCommand(command, target, value, top)
      window-controller.js:142-158
      内部包裹 retryUntilSuccess(async () => {
          browser.tabs.sendMessage(tabId,
              { commands: command, target: target, value: value },
              { frameId: top ? 0 : frameId });
      }, 60, 500)                       ← 60 次 × 500ms = 30 秒重试窗口
  → chrome.tabs.sendMessage（跨进程 IPC）
  → command-receiver.js  doCommands(message, sender, sendResponse)   :49-188
       :52-66   分发 5 个内部等待命令
       :67      截图命令
       :78-79   反射调用 selenium["do" + 首字母大写(cmd)](target, value)
       :81/87   document.body.setAttribute("SideeXPlayingFlag")
       :100/129 移除该标记
       :109-133 找不到 doXxx 时回落 commandFactory.getCommandHandler(cmd).execute(...)
       :191-221 continueTestWhenConditionIsTrue —— waitFor* 的 10ms setTimeout 轮询
  → content/selenium-api.js  Selenium.prototype.doXxx / getXxx / isXxx

通信重试工具全文只有 10 行（common/promise-utils.js）：
  async function retryUntilSuccess(func, maxRetry = 30, interval = 100) {
      for (let i = 0; i < maxRetry; i++) {
          try { return await func(); }
          catch (e) { await new Promise(r => setTimeout(r, interval)); }
      }
      throw 'Retry failed';
  }
它是「跨页面跳转仍能继续回放」的物理基础：页面刷新会销毁 Content Script，
sendMessage 会抛 "Could not establish connection"，靠 30 秒重试等新 Content 就位。

════════════════════════════════════════════════════════════════════
【事实 3】执行主循环 executionLoop（play-actions.js:539-682）
════════════════════════════════════════════════════════════════════
全局状态（play-actions.js:46-50）：
    let blockStack = [];            // :46  if/while 块栈
    let labels = {};                // :47  label 名 → 命令索引
    let expectingLabel = null;      // :48
    let currentPlayingCommandIndex = -1;  // :50  游标，先自增后取

play() 的四段式骨架（play-actions.js:274-281）：
    initializePlayingProgress()
      .then(executionLoop)
      .then(finalizePlayingProgress)
      .catch(catchPlayingError);

executionLoop 内部顺序：
  :544      是否已是最后一条 → 是则 logEndTime()(:547) 并 resolve
  :577-595  断点 / 暂停处理（不递归，把 resolve 挂起等 resume）
  :607      currentPlayingCommandIndex++
  :630      delay($("#slider").slider("option","value"))  ← 速度滑块，直读 jQuery DOM
  :648      if (isExtCommand(command)) 走 ExtCommand 直发分支
  :673-679  常规命令的六段 Promise 链：
              doPreparation → doPrePageWait → doPageWait
                → doAjaxWait → doDomWait → doCommand → executionLoop（递归）

isExtCommand（play-actions.js:1489）返回 true 的 4 条命令：
    pause / selectFrame / selectWindow / close
它们改变的是会话上下文而非页面 DOM，必须由持有 tabId/frameId 的
window-controller.js（:212 doSelectFrame / :229 doSelectWindow / :278 doClose）亲自执行。

注意：主循环是 Promise 递归而非 for 循环，因为每条命令都异步且要支持 pause/resume。
Promise .then() 递归在微任务队列展平，不会栈溢出（与 Java 同步递归不同）。

════════════════════════════════════════════════════════════════════
【事实 4】命令注册的元编程（selenium-commandhandlers.js，395 行）
════════════════════════════════════════════════════════════════════
registerAll（:121-125）依次调用三个注册器：

规则①  _registerAllAccessors（:67-88）
    正则 /^(get|is)([A-Z].+)$/
    每个 accessor 派生 8 个命令：
      getFoo, storeFoo, assertFoo, verifyFoo,
      assertNotFoo, verifyNotFoo, waitForFoo, waitForNotFoo
    关键子调用：
      :80      registerAccessor(functionName, accessBlock)     ← 原名
      :81      _registerStoreCommandForAccessor(...)  实现在 :269-283
      :84      _registerAssertionsForPredicate(...)   实现在 :222-233
      :85      _registerWaitForCommandsForPredicate(...) 实现在 :253-267

规则②  _registerAllActions（:90-102）
    正则 /^do([A-Z].+)$/
    每个 action 派生 2 个命令：
      :98   registerAction(actionName, ...)
      :99   registerAction(actionName + "AndWait", ...)

规则③  _registerAllAsserts（:104-119）
    正则 /^assert([A-Z].+)$/  →  assertFoo(halt=true) + verifyFoo(halt=false)
    【实测：KR 7.1.0 的 Selenium.prototype 上没有任何裸 assert 前缀方法，此规则空转】

其他关键实现：
  :204-212  createAssertionFromPredicate —— if (!result.isTrue) Assert.fail(result.message);
  :269-283  store 命令通过 browser.runtime.sendMessage({storeStr, storeVar}) 跨进程回传
  :314-328  ActionHandler.execute —— this.wait 为真时走 makePageLoadCondition（AndWait 实现）
  :358-379  AssertHandler.execute —— haltOnFailure 决定失败时是否 throw

════════════════════════════════════════════════════════════════════
【事实 5】全量命令统计（脚本从 content/selenium-api.js 精确提取）
════════════════════════════════════════════════════════════════════
Selenium.prototype 活跃方法总数        153
  ├─ doXxx（动作）                      99
  └─ getXxx / isXxx（访问器）           54
裸 assertXxx                            0
被 /* KAT-BEGIN … KAT-END */ 注释掉     10
Content 侧 handler 表条目               629
Panel 侧 formalCommands 白名单条目      575
  ├─ handler 有 / 白名单无               71（accessor 原名 54 + nonWait 的 AndWait 8 + waitForNot*Present 9）
  └─ 白名单有 / handler 无               17（全部 Panel 独占：流程控制 + 数据驱动）

被注释掉的 10 个方法（content/selenium-api.js）：
  doVerifyText :326-333   doVerifyTitle :335-341   doVerifyValue :343-349
  doAssertText :351-358   doAssertTitle :360-366   doAssertValue :368-374
  doStoreText  :380-388   doStoreTitle  :390-394   doStoreValue  :396-403
  doStoreAttribute :412-416
原因：改用规则①从 getText/getTitle/getValue/getAttribute 自动派生，避免行为不一致。
KAT-BEGIN/KAT-END 是 Katalon 魔改上游 SideeX 代码的统一标记，全仓 grep 可定位所有改动点。

常用命令的行号锚点（content/selenium-api.js）：
  storedVars 定义 :20      特殊键注入 build_sendkeys_maps :26-103
  DEFAULT_TIMEOUT = 30*1000  :290
  doStore :376   doEcho :405   doStoreEval :409
  doWaitPreparation :419  doPrePageWait :468  doPageWait :475
  doAjaxWait :495         doDomWait :530
  doClick :536   doDoubleClick :555  doType :978   doSendKeys :1083
  doCheck :1234  doUncheck :1243     doSelect :1252  doSubmit :1364
  doOpen :1389（隐式 AndWait）  doSelectWindow :1435  doSelectFrame :1520
  doGoBack :1698  doRefresh :1706   doClose :1714
  getLocation :1849  getTitle :1857  getValue :1875  getText :1888
  getEval :1912  isChecked :1939  getAttribute :2124
  isTextPresent :2140  isElementPresent :2161  isVisible :2174
  doWaitForCondition :2862  doSetTimeout :2884
  preprocessParameter :2949（javascript{...} 求值）
  replaceVariables :2962（${var} → storedVars）
  doRunScript :3159  doCaptureEntirePageScreenshot :3229
  doShowElement :3867  doUpload :3887

白名单生成（panel/js/katalon/kar-loadCommand.js，97 行）：
  :5     var nonWaitActions = ['open','selectWindow','chooseCancelOnNextConfirmation',
                               'answerOnNextPrompt','close','setContext','setTimeout','selectFrame'];
  :7-37  遍历 Selenium.prototype 推导派生名
  :26-35 is*Present 的反义特例 —— 生成 assert<Base>NotPresent 而不是 assertNot<Base>Present
  :39-62 手工追加 21 条：pause store echo break if elseIf else endIf while endWhile
         loadVars endLoadVars storeCsv writeToCSV appendToCSV appendToJSON
         dragAndDropToObjectByJqueryUI gotoIf gotoLabel label upload
  :64-75 排序去重
最终映射表：panel/js/UI/view/command-toolbar/generate-command-data-list.js:8
  formalCommands[command.toLowerCase()] = command;   ← 小写容错

════════════════════════════════════════════════════════════════════
【事实 6】五段等待流水线（回放稳定性的核心）
════════════════════════════════════════════════════════════════════
每条业务命令之前强制执行 5 条引擎私有命令，Panel 侧包装函数在
play-actions.js:831-933，各带 30000ms 超时。

doWaitPreparation（selenium-api.js:419-464）安装三类钩子：
  ① beforeunload  → window.new_page = true
  ② 重写 XMLHttpRequest.prototype.open，把每个 xhr push 进 window.ajax_obj
  ③ DOM 变更事件  → window.domModifiedTime = Date.now()

doPrePageWait :468   window.sideex_new_page = window.new_page
doPageWait    :475   window.sideex_page_done = (document.readyState == "complete")
doAjaxWait    :495   遍历 window.ajax_obj，检查每个 readyState 是否为 4
doDomWait     :530   window.sideex_dom_time = window.domModifiedTime

Content 侧分发：command-receiver.js:52-66

【已知缺陷】
- window.ajax_obj 只增不减 → SPA 长会话内存泄漏
- DOM 监听用已废弃的 Mutation Events（DOMNodeInserted 等），性能差
- ajaxWait 遇到长轮询 / SSE 常驻连接会永远等到 30s 超时
- domWait 遇到高频 CSS 动画会永远等不到静止

════════════════════════════════════════════════════════════════════
【事实 7】三套互不联动的超时（最容易误诊的点）
════════════════════════════════════════════════════════════════════
① Content 命令超时  30000ms  selenium-api.js:290  Selenium.DEFAULT_TIMEOUT
                              可用 setTimeout 命令改（doSetTimeout :2884）
② Panel 内部等待    30000ms×5 play-actions.js:831-933  硬编码，不可改
③ 跨进程通信重试    60×500ms  window-controller.js:142-158 + promise-utils.js
                              硬编码，不可改；耗尽抛字符串 'Retry failed'

【调试铁律】日志出现 'Retry failed' → 一定是 ③，即 Content Script 30 秒内没就位，
常见原因：页面还在加载 / 目标 frame 已销毁 / 页面 CSP 阻止脚本注入 / 跨域 iframe。
这与「元素找不到」是完全不同的故障，不要混淆。

════════════════════════════════════════════════════════════════════
【事实 8】变量系统（双进程双存储）
════════════════════════════════════════════════════════════════════
storedVars    Content 进程   content/selenium-api.js:20   var storedVars = new Object();
declaredVars  Panel 进程     panel/js/background/formatCommand.js:3   var declaredVars = {};

跨进程同步（Content → Panel）：
  Content 发：browser.runtime.sendMessage({ "storeStr": v, "storeVar": name })
      selenium-api.js:377（doStore）/ :406（doEcho 发 echoStr）/ :410（doStoreEval）
      selenium-commandhandlers.js:269-283（所有 storeXxx 派生命令）
  Panel 收：formatCommand.js:61-70  handleFormatCommand
      监听注册在 panel/js/katalon/kar.js:623

三个 ${} 替换实现：
  xlateArgument            formatCommand.js:5-47   Panel，合并 storedVars+declaredVars
                                                   下发前替换；特例 ${nbsp}
  replaceVariables         selenium-api.js:2962    Content，只查 storedVars，执行时替换
  convertVariableToString  play-actions.js:1502-1528  Panel，流程控制取值时

内联求值：selenium-api.js:2949 preprocessParameter
  匹配 /^javascript\{((.|\r?\n)+)\}$/ → getEval 求值
  （Content 是 isolated world，可以直接 eval，不受 MV3 Panel CSP 约束）

特殊键：selenium-api.js:26-103 build_sendkeys_maps 把 KEY_ENTER / KEY_TAB 等注入 storedVars，
所以 sendKeys | id=q | ${KEY_ENTER} 能工作。

════════════════════════════════════════════════════════════════════
【事实 9】流程控制（blockStack + labels，无 AST）
════════════════════════════════════════════════════════════════════
命令列表是扁平数组，流程控制靠运行时栈模拟（类似 JVM 字节码的 goto + 栈帧）。
全部在 runCommand（play-actions.js:965-1459）内拦截：

  if        :1114     else      :1125     elseIf    :1136     endIf     :1147
  while     :1154     endWhile  :1165
  loadVars  :1186     endLoadVars :1210
  label     :1227     gotoIf    :1237     gotoLabel :1255
  storeCsv  :1267     writeToCSV/appendToCSV/appendToJSON  :1280-1304

条件表达式求值（MV3 关键点）：
  Panel 页面禁止 eval，必须走 sandbox iframe。
  panel/js/katalon/kar.js:597   evalIfCondition(expr) = sandboxEvaluator.eval(expandForStoreEval(expr))
  panel/js/katalon/kar.js:611   expandForStoreEval —— 把 declaredVars 拼成
                                "var x = ...; var storedVars = {...};" 前导声明 + 表达式
  panel/js/UI/services/helper-service/SandboxEvaluator.js:41-44  iframe(sandbox.html) + postMessage + eval
  SandboxEvaluator 全文 50 行。这是 MV3 下执行动态 JS 的唯一合规姿势。

════════════════════════════════════════════════════════════════════
【事实 10】弹窗劫持（page/prompt.js，283 行）
════════════════════════════════════════════════════════════════════
必须注入 page 上下文（不是 isolated world），否则改写 window.alert 对页面无效。

:21-32   保存 originalPrompt / originalConfirmation / originalAlert
:56      分叉：子 Frame（把弹窗代理给 window.top）vs 顶层窗口（真正拦截）
:118-135 顶层 prompt：检查 document.body.hasAttribute("setPrompt")
                      → 有则返回 nextPromptResult 并移除属性（自动应答）
                      → 无则真弹窗 + postMessage 上报（录制模式）
:136-153 顶层 confirm：同理，属性名 "setConfirm"
:154-176 顶层 alert：检查 SideeXPlayingFlag，回放中直接吞掉并 postMessage 内容
:217-283 控制通道监听 from-content-script 消息：
         setNextPromptResult / getPromptMessage /
         setNextConfirmationResult / getConfirmationMessage / setNextAlertResult
:252     遗留调试代码 console.error("no")，可删
:271-280 getAlertMessage 分支已被注释，注释原话：
         "Has been send to content scripts, do not need to require value again"

对应命令：selenium-api.js
  doChooseCancelOnNextPrompt :3804      doAnswerOnNextPrompt :3808
  doAssertPrompt :3812                  doAssertAlert :3822
  doVerifyAlert :3831（人工补丁，因为规则②不生成 verify 变体）
  doChooseCancelOnNextConfirmation :3841  doChooseOkOnNextConfirmation :3845
  doAssertConfirmation :3849            doAssertConfirmationPresent :3858
  doVerifyConfirmationPresent :3862
  isAlertPresent :1731  isPromptPresent :1743  isConfirmationPresent :1755
  getAlert :1766  getConfirmation :1790  getPrompt :1826

════════════════════════════════════════════════════════════════════
【事实 11】越权能力（background/kar.js，330 行）
════════════════════════════════════════════════════════════════════
:61-81    doUploadFile → chrome.debugger.sendCommand(..., "DOM.setFileInputFiles", ...)
          原因：<input type=file> 的 value 受安全策略保护，JS 无法赋值
:85-157   doSendSpecialKeys → chrome.debugger CDP "Input.dispatchKeyEvent"（rawKeyDown / keyUp）
          原因：JS 合成的 KeyboardEvent 是 isTrusted:false，很多框架会忽略
:160-169  截图 → browser.tabs.captureVisibleTab(windowId, { format: 'png' })
:197      doActionOnNode —— 给元素打 krId 属性，再用 CDP DOM.querySelector 拿 nodeId
:240      doAttachDebugger —— chrome.debugger.attach（会出现「正在调试此浏览器」黄条）

裁剪建议：不需要文件上传和真实按键的话，整块砍掉，可省掉 "debugger" 高危权限。

════════════════════════════════════════════════════════════════════
【事实 12】失败策略与自愈接入
════════════════════════════════════════════════════════════════════
三层失败语义：
  命令级  selenium-commandhandlers.js:358-379  haltOnFailure（assert=true / verify=false）
  用例级  play-actions.js:1320-1370            先隐式等待重试，再换候选定位器
  套件级  play-actions.js:1530-1552            读 setting.testExecution.continueExecution
                                                  / setting.testExecution.hideExecutionDialog

自愈接入点（详见 TECH-02）：
  play-actions.js:944   getPossibleTargetList（doCommand 内）
  play-actions.js:1326  getPossibleTargetList（失败重试分支内）
  命中后调用 addBrokenLocator 上报 UI

回放期录制抑制：
  command-receiver.js:81/87 设置 SideeXPlayingFlag，:100/129 移除
  page/prompt.js:59-60 等处据此判断是否自动应答弹窗

════════════════════════════════════════════════════════════════════
【事实 13】数据驱动（Panel 侧执行，不下发页面）
════════════════════════════════════════════════════════════════════
四个执行器：panel/js/background/playback/service/actions/play/
  execute-storeCSV.js / execute-writeToCSV.js / execute-appendToCSV.js / execute-appendToJSON.js

execute-storeCSV.js
  :11-27   validateRowIndex —— 非数字或负数报 "row_index must be a non-negative number"
  :35-43   validateColumnName —— 空则报 "column_name cannot be empty"
  :66-104  parseLocation —— target 只能是 1 段（file）或 3 段（file,row,col），
                            否则报 "Target has incorrect format!"
  :130-148 getCSVData —— 整表模式返回【列式对象】{ col1:[...], col2:[...], length:N }
  :175-181 文件不存在报 "Data file does not exist!"
  :182-189 单元格模式：declaredVars[value] = getCellValue(file,row,col)
  :192     整表模式：declaredVars[value] = getCSVData(file)
数据源：window.dataFiles[fileName]，解析器 import 自
  panel/js/UI/services/data-file-service/data-file-services.js

════════════════════════════════════════════════════════════════════
【事实 14】日志两行的确切出处（用户实际看到的）
════════════════════════════════════════════════════════════════════
  [info] Playing test case Untitled Test Suite / Untitled Test Case
      → play-actions.js:158-176 playTestCaseAction 里的
        sideex_log.info("Playing test case " + testSuite.name + " / " + testCase.name)
  [info] Browser: Chrome Version: 150.0
      → panel/js/katalon/kar.js:518-529 logStartTime()
        sideex_log.info("Browser: " + (bowser.name||"") + " Version: " + (bowser.version||""))
        同函数还打 Time / OS / "If the test cannot start, please refresh the active browser tab"
logStartTime 调用点：play-actions.js:172（用例级）、:339（套件级）
logEndTime  调用点：play-actions.js:547、:806、:1403

════════════════════════════════════════════════════════════════════
【事实 15】关键文件行数
════════════════════════════════════════════════════════════════════
  content/selenium-api.js                                        3954
  panel/.../play/play-actions.js                                 1565
  content/selenium-commandhandlers.js                             395
  panel/js/background/window-controller.js                        379
  background/kar.js                                               330
  page/prompt.js                                                  283
  content/command-receiver.js                                     228
  panel/js/katalon/kar-loadCommand.js                              97
  panel/js/background/playback/index.js                            90
  panel/js/background/formatCommand.js                             74
  playback/index.js                                                65
  panel/js/UI/services/helper-service/SandboxEvaluator.js          50
  panel/js/background/playback/service/CommandFactory.js           47
  panel/js/UI/view/command-toolbar/generate-command-data-list.js   15
  common/promise-utils.js                                          10

════════════════════════════════════════════════════════════════════
【我的任务】
════════════════════════════════════════════════════════════════════
请基于以上事实，为我产出【个人裁剪版回放引擎】的完整设计与实施方案，包含：

1. 架构图（文本版）：四个进程环境 + 模块划分 + 数据流向。
2. 模块清单：每个模块的职责、预估行数、对应 KR 源码的哪些行。
3. 命令最小集：从 153 个方法里选出 30 条左右，说明取舍理由。
4. 元编程注册器的最简实现（可直接用的 JS 代码，不超过 150 行）。
5. 执行主循环的最简实现（Promise 递归 + 游标 + 暂停/继续，不超过 120 行）。
6. 等待流水线的【改良版】设计：
   - 用 MutationObserver 替代 Mutation Events
   - 修复 window.ajax_obj 内存泄漏
   - 提供每一段等待的开关（应对长轮询 / 常驻动画）
   - 三套超时统一到一个 config
7. 逐步实施计划（8 步以内，每步有可验证的产出）。
8. 风险清单：至少 8 条，每条给出源码依据和规避方案。

【输出要求】
- 全部使用简体中文。
- 每个结论都要标注来自哪个源码位置（格式 `路径:行号`）。
- 我给的事实之外的内容，明确标注「推断」或「建议」，不要伪装成源码事实。
- 代码用 ```js 代码块，注释用中文。
- 不要输出寒暄和总结性套话，直接给内容。
```

---

## 三、变体 A · 代码生成型（直接产出可运行骨架）

> 用法：先粘贴【二、主提示词】的「事实」部分（事实 0 ~ 15），再接下面这段替换掉原【我的任务】。

```text
【我的任务 · 代码生成】

请直接为我生成一个可运行的 MV3 回放引擎骨架，工程目录 {{MY_PROJECT}}。
要求逐个文件输出完整代码（不要省略号、不要 TODO 占位），文件清单如下：

1. manifest.json
   - MV3，permissions 只要 ["activeTab", "scripting", "storage"]
   - 不要 "debugger"（对应事实 11 的裁剪决策）
   - content_scripts 注入 content/*.js，all_frames: true
   - side_panel 或 action popup 挂 panel/index.html

2. common/retry.js（≈20 行）
   - 照抄 KR 的 retryUntilSuccess 语义（common/promise-utils.js）
   - 【改良】失败时抛自定义 Error 子类 IpcTimeoutError，而不是字符串 'Retry failed'
     （对应 PRD 边界 B-2）

3. common/config.js（≈30 行）
   - 【改良】把 KR 的三套超时统一（事实 7）：
     { commandTimeoutMs, pageWaitTimeoutMs, ipcRetryTimes, ipcRetryIntervalMs, playbackDelayMs }
   - 每段等待的开关：{ enablePrePageWait, enablePageWait, enableAjaxWait, enableDomWait }

4. content/command-registry.js（≈150 行）
   - 复刻事实 4 的三条派生规则（accessor 8 变体 / action 2 变体 / assert 2 变体）
   - 包含 is*Present 的反义特例（事实 5 的 kar-loadCommand.js:26-35 规则）
   - 导出 { registerAll, getCommandHandler }

5. content/commands.js（≈300 行）
   - 实现 30 条最小命令集（见下），命名严格遵守 doXxx / getXxx / isXxx
   - 必备：doOpen doClick doDoubleClick doType doSendKeys doSelect doCheck doUncheck
           doSubmit doSelectWindow doSelectFrame doClose doStore doStoreEval doEcho
           doRunScript doSetTimeout doPause
     访问器：getTitle getText getValue getLocation getAttribute getEval
             isElementPresent isVisible isChecked isTextPresent isEditable
   - 内含 replaceVariables（${var}）与 preprocessParameter（javascript{...}）

6. content/waiter.js（≈120 行）
   - 【改良版】等待流水线：
     · MutationObserver 替代 Mutation Events（修复事实 6 缺陷 2）
     · XHR + fetch 双拦截，用 Set 且请求结束后 delete（修复内存泄漏，事实 6 缺陷 1）
     · 每段可通过 config 关闭（应对长轮询 / 常驻动画）
     · 暴露 waitStable(config): Promise<void>

7. content/receiver.js（≈100 行）
   - 对应 command-receiver.js:49-188
   - 反射派发 + handler 表回落
   - SideeXPlayingFlag 打标/摘标（事实 12）

8. panel/engine/session.js（≈180 行）
   - 对应 window-controller.js
   - tabId / frameId 管理 + sendCommand（包 retry）
   - ExtCommand 直发的 4 条命令（事实 3 的 isExtCommand）

9. panel/engine/runner.js（≈150 行）
   - 对应 play-actions.js 的 play() + executionLoop
   - 【改良】显式状态枚举 IDLE/INITIALIZING/RUNNING/WAITING/PAUSED/FINALIZING/FAILED/STOPPED
   - 【改良】不直读 jQuery DOM，延迟从 config.playbackDelayMs 取（修复事实 3 的 :630）
   - 支持 pause / resume / stop / breakpoint

10. panel/engine/vars.js（≈80 行）
    - declaredVars + xlateArgument（事实 8）
    - 监听 runtime.onMessage 收 { storeStr, storeVar, echoStr }

11. panel/engine/flow.js（≈130 行，可选模块）
    - blockStack + labels（事实 9）
    - if/elseIf/else/endIf/while/endWhile
    - 【改良】endWhile 无匹配 while 时报语法错误（PRD 边界 B-5）
    - 【改良】while 最大迭代次数保护（PRD 边界 B-6）

12. panel/sandbox.html + panel/engine/sandbox-eval.js（≈60 行）
    - 对应 SandboxEvaluator.js:41-44
    - iframe + postMessage + eval

【输出要求】
- 按文件顺序输出，每个文件用 ```js（或 ```json / ```html）代码块，块前用
  `#### 文件：<相对路径>（约 N 行）` 标题。
- 代码内注释标注「对应 KR 源码 <路径:行号>」。
- 改良点用 `// 【改良】` 前缀标出，并说明改了原版哪个缺陷。
- 全部中文注释。不要输出任何寒暄。
```

---

## 四、变体 B · 故障诊断型（回放卡死 / 超时 / 命令不执行）

```text
你是 Chrome 扩展自动化测试引擎的调试专家。我在使用 / 裁剪 Katalon Recorder 7.1.0（MV3）
的回放引擎时遇到故障，请帮我定位。

【必须先做的判别】
在给任何建议之前，请先按下面的「三套超时判别表」确认故障归属，不要一上来就说
「可能是元素定位问题」：

┌────────────────────────────┬──────────────────────────────────────┬──────────────────────┐
│ 现象                        │ 归属                                  │ 源码锚点              │
├────────────────────────────┼──────────────────────────────────────┼──────────────────────┤
│ 报 'Retry failed'           │ 跨进程通信超时（60×500ms=30s）         │ window-controller.js │
│                            │ Content Script 没就位                  │ :142-158 +           │
│                            │                                       │ common/promise-      │
│                            │                                       │ utils.js             │
├────────────────────────────┼──────────────────────────────────────┼──────────────────────┤
│ 卡在某条命令 30 秒后失败      │ Panel 内部等待超时                     │ play-actions.js      │
│ 但没有 'Retry failed'       │ （5 段流水线之一没通过）                 │ :831-933             │
├────────────────────────────┼──────────────────────────────────────┼──────────────────────┤
│ 报「元素找不到」             │ 定位器失效 / 自愈耗尽                   │ play-actions.js      │
│                            │                                       │ :1320-1370           │
├────────────────────────────┼──────────────────────────────────────┼──────────────────────┤
│ 断言失败带实际值/期望值       │ Assert.fail                           │ selenium-command-    │
│                            │                                       │ handlers.js:204-212  │
└────────────────────────────┴──────────────────────────────────────┴──────────────────────┘

【背景事实速查】（源码根目录 {{SRC_DIR}}）

下行链路：
  play-actions.js:935 doCommand → window-controller.js:142 sendCommand
    → retryUntilSuccess(60,500) → tabs.sendMessage(tabId,{commands,target,value},{frameId})
    → command-receiver.js:49 doCommands → :78-79 selenium["do"+Cmd] 反射
    → 或 :109-133 commandFactory.getCommandHandler(cmd)

五段等待（每条业务命令前强制执行，play-actions.js:673-679）：
  doPreparation(:419 装钩子) → doPrePageWait(:468 有无导航)
  → doPageWait(:475 readyState==complete) → doAjaxWait(:495 XHR 全 readyState==4)
  → doDomWait(:530 domModifiedTime 静止)
  【常见卡点】
    · ajaxWait 卡：页面有长轮询 / SSE / WebSocket 心跳 → window.ajax_obj 永远有未完成项
    · domWait 卡：页面有常驻 CSS 动画 / 定时刷新组件 → domModifiedTime 一直在变
    · prePageWait 卡：iframe 频繁 reload

扩展级命令（不下发页面，play-actions.js:1489）：pause / selectFrame / selectWindow / close
  → 如果这 4 条不生效，看 window-controller.js:212/229/278，而不是 Content Script

变量不生效排查：
  · Panel 侧 ${} 替换：formatCommand.js:5-47 xlateArgument（合并 storedVars+declaredVars）
  · Content 侧 ${} 替换：selenium-api.js:2962 replaceVariables（只查 storedVars）
  · 回传链路：Content sendMessage({storeStr,storeVar}) → formatCommand.js:61-70
    → 监听注册在 panel/js/katalon/kar.js:623
  · 未定义变量会保留原文 ${xxx} 不替换，不会报错（PRD 边界 B-8）

流程控制不生效排查：
  · if/while 条件走沙箱：panel/js/katalon/kar.js:597 evalIfCondition
    → :611 expandForStoreEval → SandboxEvaluator.js:41-44
  · MV3 下 Panel 页面直接 eval 会被 CSP 拦，必须走 sandbox iframe
  · gotoLabel 目标不存在时静默失败（labels[name] === undefined）

弹窗卡住排查：
  · page/prompt.js 必须注入 page 上下文，isolated world 改写 window.alert 无效
  · 顶层 vs 子 Frame 分叉在 page/prompt.js:56
  · 回放中的 alert 会被静默吞掉（:154-163），不会卡；confirm/prompt 需要预设命令
  · 状态标记挂在 document.body：setPrompt(:225) / setConfirm(:242) / setAlert(:265)
    如果页面代码清空了 body 属性，自动应答会失效

命令找不到排查：
  · Content handler 表 629 条 vs Panel 白名单 575 条，两者不等
  · 白名单没有但能跑：accessor 原名（getTitle 等 54 条）
  · 白名单有但 Content 没有：17 条 Panel 独占（if/while/label/goto/CSV/pause/break）
  · nonWaitActions 的 AndWait 变体被白名单过滤（kar-loadCommand.js:5）

【我的故障】
{{ERROR_LOG}}

【你要做的】
1. 先用判别表确定故障归属（必须明确说出属于哪一类）。
2. 给出 3 ~ 5 个从最可能到最不可能的原因，每个都要带 `路径:行号` 依据。
3. 给出可立即执行的验证步骤（比如在哪个文件哪一行加 console.log，或在 DevTools
   哪个上下文执行什么表达式）。
4. 给出修复方案；如果是原版设计缺陷，说明「这是 KR 的已知缺陷，位置在 X:Y」。
5. 全部简体中文，不要寒暄。
```

---

## 五、变体 C · 命令扩展型（新增一条自定义命令）

```text
你是 Katalon Recorder 回放引擎的扩展开发顾问。我要给引擎新增一条自定义命令。

【KR 的命令扩展机制（事实，源码根目录 {{SRC_DIR}}）】

核心优势：只写一个方法，多个变体自动生成，无需手工注册。

规则①  写 Selenium.prototype.getFoo = function(target) {...}
        自动得到 8 条命令：
          getFoo / storeFoo / assertFoo / verifyFoo /
          assertNotFoo / verifyNotFoo / waitForFoo / waitForNotFoo
        实现：content/selenium-commandhandlers.js:67-88
        细节：
          :80  registerAccessor（原名注册）
          :81  → :269-283 store 变体，通过 runtime.sendMessage({storeStr,storeVar}) 回传 Panel
          :84  → :222-233 assert/verify 变体
          :85  → :253-267 waitFor 变体
          :204-212 断言失败走 Assert.fail(result.message)
        特例：如果方法名形如 isXxxPresent，反义命名是 assertXxxNotPresent
              （不是 assertNotXxxPresent），见 kar-loadCommand.js:26-35

规则②  写 Selenium.prototype.doFoo = function(target, value) {...}
        自动得到 2 条命令：foo / fooAndWait
        实现：content/selenium-commandhandlers.js:90-102（AndWait 在 :99）
        AndWait 语义：selenium-commandhandlers.js:314-328，this.wait 为真时走
        makePageLoadCondition

规则③  写 Selenium.prototype.assertFoo = ...（裸 assert 前缀）
        自动得到 assertFoo(halt) / verifyFoo(no-halt)
        实现：content/selenium-commandhandlers.js:104-119
        【注意：KR 7.1.0 中此规则空转，没有任何活跃方法命中】

【新增命令的完整清单（缺一不可）】
1. 在 content/selenium-api.js 里加方法（选 do / get / is 前缀，决定派生哪套变体）
2. 如果需要出现在 UI 命令下拉框，确认 kar-loadCommand.js 的推导能覆盖；
   若是流程控制类（不下发页面），需要手工 push 到 kar-loadCommand.js:39-62 的追加列表
3. 如果是 Panel 独占命令（不下发页面），在 play-actions.js:965-1459 的 runCommand 里加拦截分支
4. 如果需要绕过 Content Script（改会话上下文），加入 play-actions.js:1489 的 isExtCommand
5. 如果需要 Panel 侧执行（如文件操作），仿照
   panel/js/background/playback/service/actions/play/execute-storeCSV.js 写独立执行器
6. 如果需要 Service Worker 能力（CDP / 截图），仿照 background/kar.js:61-169

【参数处理约定】
  · target/value 在下发前已由 Panel 侧 xlateArgument（formatCommand.js:5-47）替换过 ${var}
  · Content 侧还会再走 replaceVariables（selenium-api.js:2962，只查 storedVars）
  · 支持 javascript{...} 内联求值：selenium-api.js:2949 preprocessParameter
  · 想写变量回 Panel：browser.runtime.sendMessage({ storeStr: 值, storeVar: 变量名 })
    参考 selenium-api.js:377
  · 想打日志：browser.runtime.sendMessage({ echoStr: 内容 })，参考 selenium-api.js:406

【超时约定】
  · Content 侧默认 30000ms：selenium-api.js:290 Selenium.DEFAULT_TIMEOUT
  · 长耗时命令要自己做轮询的，参考 command-receiver.js:191-221 的 10ms setTimeout 模式

【我要新增的命令】
命令名：__________
语义：__________
参数：target = __________，value = __________
是否需要页面 DOM 访问：是 / 否
是否需要 Service Worker 能力：是 / 否
是否是流程控制类：是 / 否

【你要做的】
1. 判断我该用 do / get / is 哪个前缀，说明会自动派生出哪些命令名。
2. 给出完整代码（含所有需要改动的文件与插入位置）。
3. 列出该命令的边界情况与错误信息设计（参考 execute-storeCSV.js:11-43 的校验风格）。
4. 给 2 个验收用例（命令序列 + 期望结果）。
5. 全部简体中文，代码注释标注对应 KR 源码位置。
```

---

## 六、调试提示词模板（8 类高频故障）

> 用法：挑对应模板，填 `{{...}}`，附在【变体 B】之后一起发。

### D-1 · 报 `Retry failed`

```text
【故障】日志出现 Retry failed。

【已知】这来自 common/promise-utils.js 的 retryUntilSuccess 耗尽，
调用点在 window-controller.js:142-158，参数是 (60, 500) 即 30 秒。
本质是 chrome.tabs.sendMessage 连续 60 次都抛异常 → Content Script 不在。

【请依次排查并给出验证方法】
1. 目标 tabId 是否还存在？（window-controller.js:27-31 的 currentPlayingTabId）
2. 目标 frameId 是否还存在？（:212 doSelectFrame 之后 frame 被销毁）
3. 页面是不是 chrome:// / chrome-extension:// / Web Store 等禁止注入的 URL？
4. 页面 CSP 是否阻止了 content script？（content script 不受页面 CSP 约束，
   但 page 上下文注入的 page/prompt.js 会受影响，请区分）
5. manifest 的 content_scripts matches / all_frames 是否覆盖该页面？

【补充信息】
目标 URL：{{URL}}
是否在 iframe 中：{{YES_NO}}
故障前一条命令：{{PREV_COMMAND}}
```

### D-2 · 卡在某条命令 30 秒（无 Retry failed）

```text
【故障】命令卡住约 30 秒后失败，日志没有 Retry failed。

【已知】说明通信是通的，卡在 Panel 侧五段等待流水线（play-actions.js:831-933，
各 30000ms 超时）。五段依次是：
  doPreparation(:419) → doPrePageWait(:468) → doPageWait(:475)
  → doAjaxWait(:495) → doDomWait(:530)

【请帮我定位卡在哪一段，验证方法】
在 Content Script 控制台（DevTools → Console → 上下文选扩展 content script）执行：
  window.sideex_new_page      // prePageWait 的判定值
  document.readyState         // pageWait 的判定依据
  window.ajax_obj             // ajaxWait 的判定依据，看有没有 readyState !== 4 的项
  window.ajax_obj.filter(x => x.readyState !== 4)
  window.domModifiedTime      // domWait 的判定依据，连续执行两次看是否在变

【已知缺陷（KR 原版）】
· ajaxWait 遇长轮询 / SSE / 心跳请求永远等不到（selenium-api.js:495）
· domWait 遇常驻 CSS 动画 / 定时刷新永远等不到（selenium-api.js:530）
· window.ajax_obj 只增不减，SPA 长会话会累积（selenium-api.js:419-464）

【补充信息】
页面是否 SPA：{{YES_NO}}
页面是否有长轮询/WebSocket：{{YES_NO}}
页面是否有常驻动画：{{YES_NO}}
```

### D-3 · `${变量}` 没有被替换

```text
【故障】命令里写了 ${myVar}，但实际执行时是字面量 "${myVar}"。

【已知的三层替换】
1. Panel 下发前：formatCommand.js:5-47 xlateArgument（合并 storedVars + declaredVars）
2. Content 执行时：selenium-api.js:2962 replaceVariables（只查 storedVars）
3. 流程控制取值：play-actions.js:1502-1528 convertVariableToString

【已知行为】未定义的变量会原样保留，不报错（这是 KR 的设计，不是 bug）。

【请排查】
1. 变量是怎么写进去的？
   · store 命令 → selenium-api.js:377 sendMessage({storeStr,storeVar})
   · storeXxx 派生 → selenium-commandhandlers.js:269-283
   · storeCsv → execute-storeCSV.js:184/192 直接写 declaredVars
2. Panel 收到了吗？在 formatCommand.js:61-70 handleFormatCommand 打断点
3. 监听器注册了吗？panel/js/katalon/kar.js:623 browser.runtime.onMessage.addListener
4. 是不是在 Content 侧用了 Panel 侧才有的变量？
   （declaredVars 只在 Panel，storedVars 只在 Content，两者不自动双向同步）

【补充信息】
变量写入命令：{{WRITE_COMMAND}}
变量读取命令：{{READ_COMMAND}}
Panel 控制台执行 declaredVars 的输出：{{DECLARED_VARS}}
Content 控制台执行 storedVars 的输出：{{STORED_VARS}}
```

### D-4 · `if` / `while` 条件永远为假（或报 CSP 错误）

```text
【故障】if / while 的条件表达式行为不符合预期。

【已知】MV3 下 Panel 页面禁止 eval，条件求值必须走沙箱 iframe：
  panel/js/katalon/kar.js:597  evalIfCondition(expr) = sandboxEvaluator.eval(expandForStoreEval(expr))
  panel/js/katalon/kar.js:611  expandForStoreEval 把 declaredVars 拼成
                               "var x = ...;" 前导声明 + "var storedVars = {...};" + 表达式
  SandboxEvaluator.js:41-44    iframe(sandbox.html) + postMessage + eval

【请排查】
1. 变量在 declaredVars 里吗？（不在 → 表达式里的标识符是 undefined）
2. 变量值是字符串还是数字？store 存进去的都是【字符串】，
   所以 "3" > 0 为 true 但 "3" === 3 为 false，"10" > "9" 为 false（字符串比较）
3. sandbox.html 在 manifest 的 sandbox.pages 里声明了吗？
4. 控制台有没有 "Refused to evaluate a string as JavaScript" 的 CSP 报错？
   有 → 说明没走沙箱，直接 eval 了

【补充信息】
条件表达式原文：{{EXPRESSION}}
declaredVars 内容：{{DECLARED_VARS}}
控制台报错：{{CONSOLE_ERROR}}
```

### D-5 · 弹窗把回放卡死

```text
【故障】页面弹出 alert / confirm / prompt 后回放卡住。

【已知机制】page/prompt.js（283 行）注入 page 上下文改写三个方法。
· alert：回放中（有 SideeXPlayingFlag）会被静默吞掉，理论上不会卡（:154-163）
· confirm / prompt：需要预先执行 chooseOkOnNextConfirmation / answerOnNextPrompt
  等命令设置 document.body 的 setConfirm / setPrompt 属性（:119/137）
· 子 Frame 的弹窗代理给 window.top（:56-114）

【请排查】
1. page/prompt.js 真的注入到 page 上下文了吗？
   在页面控制台（不是扩展 content script 上下文）执行 window.prompt.toString()，
   看是不是被改写过的版本
2. document.body.hasAttribute("SideeXPlayingFlag") 是 true 吗？
   （command-receiver.js:81/87 设置，:100/129 移除，命令间隙是没有的）
3. 页面代码有没有清掉 body 属性？（KR 用 body 属性传状态是脆弱设计）
4. 弹窗是在 iframe 里弹的吗？看 page/prompt.js:56 的分叉是否走对
5. 是不是 beforeunload 触发的浏览器原生确认框？那个 JS 拦不了

【补充信息】
弹窗类型：{{ALERT_CONFIRM_PROMPT}}
是否在 iframe：{{YES_NO}}
弹窗前一条命令：{{PREV_COMMAND}}
```

### D-6 · 命令名在 UI 里搜不到 / 输入后报未知命令

```text
【故障】某个命令在 UI 下拉框里找不到，或者输入后报未知命令。

【已知】Content handler 表 629 条 ≠ Panel 白名单 575 条，两边规则不同：
· handler 表：selenium-commandhandlers.js 的三条派生规则（:67-88 / :90-102 / :104-119）
· 白名单：kar-loadCommand.js:7-37 的推导 + :39-62 的手工追加 + :64-75 去重
  最终映射：generate-command-data-list.js:8  formalCommands[cmd.toLowerCase()] = cmd

【三类差异】
1. handler 有 / 白名单无（71 条）
   · accessor 原名 54 条（getTitle / getText / isElementPresent …）
     → UI 搜不到但脚本里写了照样能跑
   · nonWaitActions 的 AndWait 变体 8 条（openAndWait / closeAndWait …）
     → 被 kar-loadCommand.js:5 的黑名单过滤
   · waitForNot*Present 系列 9 条 → 两边命名规则不一致的「幽灵命令」
2. 白名单有 / handler 无（17 条）
   · if/else/elseIf/endIf/while/endWhile/loadVars/endLoadVars/label/gotoIf/gotoLabel/
     storeCsv/writeToCSV/appendToCSV/appendToJSON/pause/break
   · 这些在 play-actions.js:1114-1304 被 Panel 拦截，不下发页面
3. is*Present 反义命名：assertXxxNotPresent（不是 assertNotXxxPresent），
   见 kar-loadCommand.js:26-35

【补充信息】
命令名：{{COMMAND_NAME}}
现象：{{SEARCH_FAIL_OR_UNKNOWN_COMMAND}}
```

### D-7 · 回放动作被重复录制（命令自增殖）

```text
【故障】边录边放，或回放后命令列表凭空多出来一堆。

【已知机制】靠 document.body 上的 SideeXPlayingFlag 标记抑制：
  command-receiver.js:81 / :87   命令执行前 setAttribute
  command-receiver.js:100 / :129 命令执行后 removeAttribute
录制器和 page/prompt.js:59-60 都检查这个标记。

【请排查】
1. 命令执行期间 body 上真的有这个属性吗？
2. 是不是命令抛异常导致 removeAttribute 没执行，标记残留 / 或提前被移除？
   （检查 :100 和 :129 两条移除路径的覆盖是否完整）
3. 异步动作（比如 click 后页面 300ms 才响应）在标记移除后才触发事件 → 被录进去
   → 这是 KR 的设计缺陷，标记的生命周期只覆盖同步执行阶段
4. iframe 里的 body 和 top 的 body 是两个对象，标记打在哪个上？

【补充信息】
多出来的命令：{{EXTRA_COMMANDS}}
是否同时开启录制：{{YES_NO}}
```

### D-8 · selectFrame / selectWindow / close / pause 不生效

```text
【故障】这 4 条命令没反应。

【已知】它们是「扩展级命令」，不下发 Content Script：
  play-actions.js:1489  isExtCommand 返回 true 的正是这 4 条
  真正执行在 panel/js/background/window-controller.js
    :212  doSelectFrame  → 改 currentPlayingFrameLocation
    :229  doSelectWindow → 改 currentPlayingTabId
    :278  doClose
    :285  wait
    :354  setFirstTab

【请排查】
1. 在 Content Script 里加日志是白费——这些命令根本不到 Content
   要在 window-controller.js:212/229/278 打断点
2. frameLocation 的格式对吗？形如 "root" / "root:0" / "root:0:2"
   生成逻辑参考 page/prompt.js:35-50 的 getFrameLocation
3. selectWindow 的窗口标识对吗？（title / name / handle）
4. selectFrame 后，后续 sendCommand 的 frameId 是从哪来的？
   window-controller.js:142-158 的 { frameId: top ? 0 : frameId }

【补充信息】
命令与参数：{{COMMAND_AND_TARGET}}
页面 frame 结构：{{FRAME_STRUCTURE}}
```

---

## 七、提示词使用技巧

| 技巧 | 说明 |
|---|---|
| **先喂事实再提问** | 主提示词的「事实 0 ~ 15」是可复用前缀，任何变体都可以直接拼在前面 |
| **强制标注来源** | 每段提示词末尾都要求「结论带 `路径:行号`」，能显著降低 LLM 编造 |
| **区分事实与推断** | 要求 LLM 对源码外的内容标注「推断」/「建议」 |
| **给判别表而非开放提问** | 变体 B 的「三套超时判别表」能防止 LLM 一上来就猜「元素定位问题」 |
| **拒答比编造好** | 明确写「如果事实不足以回答，请说『源码中未提供该信息』」 |
| **分文件输出** | 变体 A 要求每个文件独立代码块 + 行数预估，避免 LLM 输出被截断后难以拼接 |
| **改良点显式标注** | 变体 A 要求用 `// 【改良】` 标出与原版的差异，便于日后回溯 |

---

## 八、配套文档索引

| 文档 | 路径 | 用途 |
|---|---|---|
| 技术蒸馏 | `_distill/tech/TECH-03-回放引擎.md` | 15 节完整源码剖析，含 5.2 全量命令清单 |
| 产品需求 | `_distill/prd/PRD-03-回放引擎.md` | 56 条 FR-P 需求 + 11 节 PRD |
| 技能包 | `_distill/skills/kr-playback-engine/SKILL.md` | 决策树 + 代码模式 + 坑表格 |
| 录制引擎 | `_distill/tech/TECH-01-录制引擎.md` | 回放的上游 |
| 定位器与自愈 | `_distill/tech/TECH-02-定位器与自愈.md` | 回放失败时的兜底机制 |
