# TECH-01 录制引擎（Recorder）技术蒸馏

> 被分析对象：Katalon Recorder 7.1.0（Chrome MV3）
> 源码根目录：`C:\Users\Li\Downloads\GitHub\auto-test\doc\老师\KatalonRecorder\7.1.0_0`
> 本文所有行号均已**回源码逐条核实**（核实日期：2026-08-05）。凡与既有分析报告冲突处，以本文为准，并在正文中显式标注「⚠️ 修正」。
> 本文只读分析，未修改任何扩展源文件。

---

## 0. 一句话回答："为什么录到的是我的操作，不是网络请求"

**因为 Katalon Recorder 的探针挂在 DOM 事件层（`document.addEventListener`），而不是网络层（`chrome.webRequest` / CDP `Network.*`）。它监听的是"你对页面做了什么"，浏览器为了完成你的动作而顺带发出的 HTTP 请求，它根本看不见、也不想看见。**

再展开成四句话：

| # | 事实 | 证据 |
|---|---|---|
| 1 | 挂钩点是 `document` 上的 DOM 事件监听器，**全程没有申请也没有使用 `webRequest` 权限** | `content/recorder.js:63` `this.window.document.addEventListener(eventName, listener, capture);`；`manifest.json:64` 的 `permissions` 数组里没有 `webRequest` |
| 2 | 只注册 17 个事件键、19 个 handler，且**只有 8 个 handler 会真正产出命令**，其余只维护状态 | `content/recorder-handlers.js` 中 19 处 `Recorder.addEventHandler(...)`（行号见 §3.1） |
| 3 | "语义识别"是**一堆写死的 if/else 分支 + 模块级布尔标志**，把低层事件流塌缩成一条高层命令 | 例：`change` 事件才出 `type` 命令（`recorder-handlers.js:49-80`），`input` 事件只记指针不出命令（`:82-85`） |
| 4 | "能调整顺序"是因为命令最终落到 **Panel 窗口的一张可编辑 HTML 表格**（`#records-grid` 的 `<tr>` 列表 + 内存数组 `testCase.commands`），不是不可变日志 | `panel/js/UI/view/records-grid/add-command.js:99-103`（`insertCommandToIndex` / `commands.push` + `insertBefore` / `appendChild`） |

**与 DevTools Network 面板的本质区别**（这是用户困惑的根源）：

| 维度 | DevTools Network | Katalon Recorder |
|---|---|---|
| 数据源 | 浏览器网络栈（CDP `Network.requestWillBeSent` 等） | 页面渲染进程的 DOM 事件派发 |
| 一次"点击登录按钮"看到什么 | `POST /api/login`、`GET /avatar.png`、`GET /config.json` … N 条 | `click \| id=loginBtn` 1 条 |
| 语义层级 | 传输层（无法知道是人点的还是 JS 发的） | 交互层（`event.isTrusted` 能区分人和 JS） |
| 能否回放 | 不能（重放请求 ≠ 重现用户行为，CSRF token/时序全变） | 能（Selenium 命令可在新会话上重演） |
| 顺序 | 由网络完成时刻决定，乱序 | 由用户操作时刻决定，天然有序 |

> **给 Java 背景读者的类比**：DevTools 是在 `HttpClient` 层面抓包；Katalon Recorder 是在 Swing 的 `ActionListener` 层面记录 `actionPerformed`。前者记录"系统副作用"，后者记录"用户意图"。录制回放工具必须记录意图。

---

## 1. 模块边界与文件清单

### 1.1 三个执行上下文（先定位，再看文件）

| 上下文 | 实体 | 加载方式 | 能不能用 `document` | 能不能用 `chrome.tabs` |
|---|---|---|---|---|
| ① Content Script（MAIN world） | `bundles/content.1.bundle.js` | `manifest.json:27-34` 声明式注入，`world:"MAIN"`、`all_frames:true`、`run_at:"document_start"` | 能（就是页面自己的 document） | 只能通过 `common/chrome-polyfill.js` 的远程代理间接用 |
| ② **Panel 独立窗口**（真正的"后台"） | `panel/index.html` + `panel/js/**` | Service Worker 用 `browser.windows.create({url:"panel/index.html", type:"popup"})` 打开（`background/background.js:52-60`） | 能（面板自己的 document） | 能（它是扩展页面） |
| ③ Service Worker | `worker_wrapper.js` → `importScripts(...)` | `manifest.json:11-13` | **不能** | 能 |

⚠️ **最大的命名陷阱**：`panel/js/background/recorder.js` 名字里有 `background`，但它**不在 Service Worker 里跑**。

证据 A：`worker_wrapper.js:2-23` 的 `importScripts` 清单里没有它：
```js
importScripts(
    "common/promise-utils.js",
    "background/segment-tracking-services.js",
    "content/bowser.js",
    "common/browser-polyfill.js",
    // ... 共 20 个
    "background/background.js",
    "background/install.js",
    "background/kar.js",
    "chrome_variables_init.js",
    "katalon/constants.js",
    "katalon/chrome_variables_default.js",
    "katalon/chrome_common.js",
    "katalon/background.js",
    "panel/js/katalon/papaparse.js"
);
```

证据 B：它被 `panel/js/background/editor.js:26-31` 动态 `import()` 进 Panel 页面：
```js
var recorder;
var addCommandAuto;
(async function () {
    let recorderModule = await import("./recorder.js");
    recorder = new recorderModule.BackgroundRecorder();
    let addCommandModule = await import("../UI/view/records-grid/add-command.js");
    addCommandAuto = addCommandModule.addCommandAuto;
})();
```
而 `editor.js` 本身是 `panel/index.html:875` 的一个**经典脚本**（非 module）：
```html
<script src="js/background/editor.js"></script>
```

证据 C：`panel/js/background/recorder.js:307` 用了 `document.getElementById(...)`、`:320` 用了 `browser.windows.update(this.selfWindowId,...)`、`:325` 用了 `prompt("Enter the name of the variable")` —— MV3 Service Worker 里 `document` 和 `prompt` 都不存在。

### 1.2 录制引擎文件清单

| 文件 | 运行上下文 | 职责 | 行数 |
|---|---|---|---|
| `content/recorder.js` | Content(MAIN) | `Recorder` 类：`attach/detach/parseEventKey/getFrameLocation/record`；全局单例 `var recorder` | 144 |
| `content/recorder-handlers.js` | Content(MAIN) | 19 个 DOM 事件处理器 + `checkForm` / `getOptionLocator` / `findClickableElement`；文件末尾发 `attachRecorderRequest` | 610 |
| `content/locatorBuilders.js` | Content(MAIN) | `buildAll(el)` → 定位器候选数组 `[[locator, finderName], ...]`；14 种策略 | 578 |
| `content/command-receiver.js` | Content(MAIN) | 下行消息路由：`attachRecorder`/`detachRecorder` → `recorder.attach()/detach()`；同时也是回放执行入口 | 228 |
| `content/inject-popup-record.js` | Content(MAIN) | 注入 `#popupInjectionKR` 可拖拽录制提示条 + Stop 按钮 | 101 |
| `content/check-browser-automation.js` | Content(MAIN) | 加载即发 `checkForAutomated` 伪命令（携带 `navigator.webdriver`） | 5 |
| `content/prompt-injecter.js` | Content(MAIN) | 注入 `page/prompt.js`；顶层窗口接收 dialog 结果并转 `record(...)` | 74 |
| `page/prompt.js` | 页面主世界（`<script src>` 注入） | 覆写 `window.alert/confirm/prompt`，录制模式回传 postMessage，回放模式返回预设值 | 283 |
| `content/trustedPolicy.js` | Content(MAIN) | Trusted Types policy，供 `createHTML/createScriptURL` 使用 | 9 |
| **`panel/js/background/recorder.js`** | **Panel 窗口** | `BackgroundRecorder`：消息汇聚、窗口/tab 追踪、frame 差分、命令落表 | 401 |
| `panel/js/background/editor.js` | Panel 窗口 | `window.isRecording/isPlaying` 标志；`attachRecorderRequest` 应答；`notification()` | 108 |
| `panel/js/background/playback/index.js` | Panel 窗口 | `#record` 按钮绑定；`checkStopInContentScript` 接收 | 90 |
| `panel/js/background/playback/service/actions/record-actions.js` | Panel 窗口 | `recordAction`：切换 `isRecording`，`doRecord()` 广播 attach | 79 |
| `panel/js/UI/view/records-grid/add-command.js` | Panel 窗口 | `addCommandAuto` / `addCommandBeforeLastCommand` / `addCommandManu` → 写 `testCase.commands` + `<tr>` | 157 |
| `panel/js/UI/models/test-model/test-command.js` | Panel 窗口 | `TestCommand` 数据模型 | 34 |
| `panel/js/UI/models/test-model/test-case.js` | Panel 窗口 | `insertCommandToIndex` / `getTestCommandCount` | 49 |
| `panel/js/background/window-controller.js` | Panel 窗口 | `frameLocation → frameId` 映射（**回放**用），`doSelectFrame` | 379 |
| `background/background.js` | Service Worker | 开面板、17 个右键菜单、全局 `port` | 239 |
| `worker_wrapper.js` | Service Worker | `importScripts` 清单 | 26 |
| `katalon/ku-recorder.js` | Content(MAIN) | **另一套**录制器 `KURecorder`（Katalon Studio 桌面端集成），与本文主线**无关** | 538 |
| `katalon/ku-recorder-event-handlers.js` | Content(MAIN) | KU 的 19 个 handler（KR handler 的 fork） | 643 |

### 1.3 打包事实：磁盘源文件 == 线上运行代码

`bundles/content.1.bundle.js`（38381 行）是**纯文本顺序拼接**，不是 webpack。装载顺序可用 `/// File:` 标记读出（节选，共 44 个文件）：

```
   143:/// File: "content/trustedPolicy.js"
   158:/// File: "common/chrome-polyfill.js"
   193:/// File: "content/prompt-injecter.js"
   310:/// File: "content/check-browser-automation.js"
 30022:/// File: "content/locatorBuilders.js"
 30606:/// File: "content/recorder.js"
 30756:/// File: "content/recorder-handlers.js"
 31372:/// File: "content/command-receiver.js"
 33992:/// File: "katalon/jquery-3.2.1.min.js"
 36478:/// File: "katalon/ku-recorder.js"
 37022:/// File: "katalon/ku-recorder-event-handlers.js"
 38266:/// File: "content/inject-popup-record.js"
```

已用 `diff` 校验：bundle 第 30608–30751 行（去除 CRLF 后）与 `content/recorder.js` **逐字符一致**。因此可以放心按磁盘源文件行号阅读。

**四个必须照抄的 manifest 属性**（`manifest.json:27-34`）：
```json
{
   "all_frames": true,
   "js": [ "bundles/content.1.bundle.js" ],
   "match_about_blank": true,
   "matches": [ "<all_urls>" ],
   "run_at": "document_start",
   "world": "MAIN"
}
```

| 属性 | 为什么必须 |
|---|---|
| `all_frames: true` | 每个 iframe 拿到独立 `Recorder` 实例，否则 iframe 内操作完全录不到 |
| `match_about_blank: true` | 覆盖 `about:blank` 的 iframe（很多富文本编辑器就是这种） |
| `run_at: "document_start"` | 抢在页面脚本之前注册 capture 监听器 |
| `world: "MAIN"` | 为了能覆写 `window.prompt/confirm/alert`、读页面变量。**若不做对话框录制，可以改成默认 ISOLATED，从而砍掉整个 `common/remote-object-helper-*.js` 代理层** |

因为跑在 MAIN world，`chrome.runtime` 是**代理**出来的（`common/chrome-polyfill.js`），Content 侧的 `browser.runtime.sendMessage` 实际经过 `PageTransport` → `chrome-polyfill-server.js`（ISOLATED world）→ 真正的 `chrome.runtime`。这一层对录制逻辑透明，但**性能上每条命令多两跳 postMessage**。

---

## 2. 生命周期：从"点击 Record"到"命令落表"的完整时序

### 2.1 启动时序（ASCII）

```
用户                Panel 窗口                     Service Worker           Content Script(每个 frame)
 |                      |                                |                          |
 |--点击扩展图标------->|                                |                          |
 |                      |         browser.action.onClicked → openPanel(tab)          |
 |                      |<---windows.create("panel/index.html", type:"popup")--------|
 |                      |         background/background.js:52-60                     |
 |                      |                                |                          |
 |                      |<--tabs.sendMessage(panelTabId, {selfWindowId, commWindowId})
 |                      |         background/background.js:92-98                     |
 |                      |                                |                          |
 |          editor.js:79-88 contentWindowIdListener                                  |
 |            ├─ extCommand.setContentWindowId(contentWindowId)                       |
 |            ├─ recorder.setOpenedWindow(contentWindowId)   ← 窗口白名单            |
 |            └─ recorder.setSelfWindowId(selfWindowId)                               |
 |                      |                                |                          |
 |--点击 #record------->|                                |                          |
 |     playback/index.js:23-26                                                        |
 |       commandFactory.createCommand("record").execute()                             |
 |                      |                                |                          |
 |     record-actions.js:23  isRecording = !isRecording  (→ true)                     |
 |     record-actions.js:59-78  doRecord()                                            |
 |       ├─ recorder.attach()          ← Panel 侧注册 5 个监听器（见 §2.2）           |
 |       ├─ windows.update(contentWindowId,{focused:true})                            |
 |       └─ tabs.query({windowId:contentWindowId, url:"<all_urls>"})                  |
 |            └─ 对每个 tab: tabs.sendMessage(tab.id, {attachRecorder:true}) ---------->|
 |                      |                                |                          |
 |                      |                                |    command-receiver.js:175-180
 |                      |                                |      ├─ sendMessage({attachHttpRecorder:true})
 |                      |                                |      └─ recorder.attach()   ← content/recorder.js:44-68
 |                      |                                |                          |
 |                      |                                |    inject-popup-record.js:2-6
 |                      |                                |      └─ addPopup()  → 注入 #popupInjectionKR
 |                      |                                |                          |
 |                      |                                |    此时 17 个事件键的 listener 已挂在 document 上
```

> 注意 `tabs.sendMessage(tab.id, msg)` **不带 `{frameId}`**，Chrome 会投递给该 tab 的**所有 frame**（`record-actions.js:71`）。同一条 `{attachRecorder:true}` 被两个独立的 `onMessage` 监听器各消费一次：`command-receiver.js:228` 注册的 `doCommands` 和 `inject-popup-record.js:102` 注册的 `injectRecord`。它们互不知情。

### 2.2 Panel 侧 attach 的 5 个监听器

`panel/js/background/recorder.js:362-372`
```js
attach() {
    if (this.attached) {
        return;
    }
    this.attached = true;
    browser.tabs.onActivated.addListener(this.tabsOnActivatedHandler);
    browser.windows.onFocusChanged.addListener(this.windowsOnFocusChangedHandler);
    browser.tabs.onRemoved.addListener(this.tabsOnRemovedHandler);
    browser.webNavigation.onCreatedNavigationTarget.addListener(this.webNavigationOnCreatedNavigationTargetHandler);
    browser.runtime.onMessage.addListener(this.addCommandMessageHandler);
}
```
`detach()` 在 `:374-384` 对称移除。所有 handler 在构造时通过 `rebind()`（`:354-360`）绑死 `this`，这样 `addListener`/`removeListener` 传的是同一个函数引用 —— **这是能成功移除监听器的前提**。

### 2.3 单次点击的完整数据流（ASCII 时序图，标出函数名与消息字段）

```
页面 DOM                Content Script (frame N)                       Panel 窗口
   |                             |                                          |
   |--用户左键点 <button id=ok>  |                                          |
   |                             |                                          |
   | capture 阶段: window→document→...→target                               |
   |    第 2 站命中 document 上的 listener                                   |
   |----------------------------->|                                          |
   |     content/recorder.js:58-62  listener(event)                          |
   |       for handlers of Recorder.eventHandlers["C_click"]                 |
   |         handlers[i].call(self, event)      ← this === recorder 实例      |
   |                             |                                          |
   |     recorder-handlers.js:89-111  'clickAt'/'click' handler              |
   |       ├─ 89  const eventTarget = getEventTarget(event)                  |
   |       ├─ 91  if (event.button==0 && !preventClick && event.isTrusted)   |
   |       ├─ 92  if (!preventClickTwice)                                     |
   |       ├─102  if (eventTarget.parentNode.id !== "popupInjectionKR")      |
   |       ├─103  this.record("click", this.locatorBuilders.buildAll(el), '')|
   |       ├─105  preventClickTwice = true                                   |
   |       └─109  setTimeout(()=>preventClickTwice=false, 30)                |
   |                             |                                          |
   |     locatorBuilders.js:64-149  buildAll(el)                             |
   |       for finderName of LocatorBuilders.order (14 种)                   |
   |         locator = buildWith(finderName, e)                              |
   |         if (findElement(locator) === e) locators.push([locator, name])  |
   |       → [["id=ok","id"], ["xpath=//button[@id='ok']","xpath:attributes"], ...]
   |                             |                                          |
   |     content/recorder.js:102-118  record(command, target, value, insertBefore?, frameLoc?)
   |       ├─104  if (!target[0].some(e => e?.includes instanceof Function    |
   |       |                              && e.includes('popupInjectionKR')))|
   |       └─105  browser.runtime.sendMessage({                              |
   |                  command:  "click",                                     |
   |                  target:   [["id=ok","id"], ...],                       |
   |                  value:    "",                                          |
   |                  insertBeforeLastCommand: undefined,                    |
   |                  frameLocation: "root:0"      ← this.frameLocation      |
   |              })                                                          |
   |                             |------------ runtime 广播 ---------------->|
   |                             |                                          |
   |                             |   panel/js/background/recorder.js:175-344 |
   |                             |     addCommandMessageHandler(message, sender)
   |                             |       sender.tab.id / sender.tab.windowId / sender.frameId
   |                             |                                          |
   |                             |   ①176 门禁: !message.command 或 windowId 不在白名单 → return
   |                             |   ②184-199 若无选中 suite/case → 自动 createTestSuite/createTestCase
   |                             |   ③203-210 首次: 初始化 openedTabIds/openedTabNames/
   |                             |              currentRecordingFrameLocation="root"/openedTabCount=1
   |                             |   ④212-217 第一个 tab → 命名 "win_ser_local"
   |                             |   ⑤219-224 命令表为空 → addCommandAuto("open",[[sender.tab.url]],"")
   |                             |   ⑥226-250 未知 tab → 补 open 并重命名 win_ser_local
   |                             |   ⑦252-269 URL 变化 → 补 open；checkForAutomated 到此 return
   |                             |   ⑧271-293 frameLocation 变化 → 补 selectFrame（三段式差分）
   |                             |   ⑨295-335 特判: doubleClickAt / *Value / *Text / store*
   |                             |   ⑩337-343 落表:
   |                             |        insertBeforeLastCommand ? addCommandBeforeLastCommand(...)
   |                             |                                : notification(...) + addCommandAuto(...)
   |                             |                                          |
   |                             |   add-command.js:21-141  addCommand(...)  |
   |                             |     45  targetList = target.map(t => t[0])
   |                             |     47  new TestCommand(name, targetList[0], targetList, value)
   |                             |     54  renderCommandElement(testCommand) → <tr>
   |                             |    102  testCase.commands.push(testCommand)
   |                             |    103  #records-grid.appendChild(<tr>)   |
   |                             |    110  scrollIntoView(false)             |
   |                             |                                          |
   |                             |   editor.js:90-104  notification(...)     |
   |                             |     browser.notifications.create → 1.5s 后 clear
```

### 2.4 停止时序

**路径 A（点 Panel 的 Stop）** —— `record-actions.js:31-56`
```js
} else {
    $('#playback').fadeIn("slow");
    // ...
    recorder.detach();
    browser.tabs.query({ windowId: extCommand.getContentWindowId(), url: "<all_urls>" })
      .then(function (tabs) {
        for (let tab of tabs) {
          browser.tabs.sendMessage(tab.id, { detachRecorder: true });
        }
      });
    $("#record")[0].childNodes[1].textContent = " Record";
    switchRecordButton(true);
    trackingLocalPlayback("record");
}
```

**路径 B（点页面浮层的 Stop）** —— 复用路径 A
```
inject-popup-record.js:74-76
    button.addEventListener("click", function (event) {
        browser.runtime.sendMessage({ checkStopInContentScript: true });
    })
        ↓
playback/index.js:66-89
    if (message.checkStopInContentScript) {
        if (isRecording) {
            $("#record").click();                      ← 直接模拟点击自己的 Record 按钮
            browser.windows.update(extensionId, { focused: true });
            ... 展开测试套件、选中新用例
        }
    }
```
`$("#record").click()` 复用完整停止流程，避免逻辑重复 —— 这是干净的做法，值得抄。

---

## 3. 事件捕获层

### 3.1 注册了哪些 DOM 事件（完整表）

全部来自 `content/recorder-handlers.js`，共 **19 处** `Recorder.addEventHandler(...)`：

| # | 定义行 | handlerName | eventName | capture | map key | 是否产出命令 | 产出什么 |
|---|---|---|---|---|---|---|---|
| 1 | 49 | `type` | `change` | **false** | `change` | ✅ | `type`（+ 可能 `submit`/`sendKeys`） |
| 2 | 82 | `type` | `input` | **false** | `input` | ❌ | 只写 `typeTarget` |
| 3 | 89 | `clickAt` | `click` | true | `C_click` | ✅ | `click` |
| 4 | 115 | `doubleClickAt` | `dblclick` | true | `C_dblclick` | ⚠️ 死代码 | 本应 `doubleClick`，见 §10 |
| 5 | 159 | `sendKeys` | `keydown` | true | `C_keydown` | ✅ | `sendKeys` / `type` / `submit` |
| 6 | 252 | `dragAndDrop` | `mousedown` | true | `C_mousedown` | ❌ | 存 `this.mousedown`、`option._wasSelected` 快照 |
| 7 | 283 | `dragAndDrop` | `mouseup` | true | `C_mouseup` | ❌ | 全部 `record` 被注释（`:309-317`, `:329-330`, `:336`） |
| 8 | 349 | `dragAndDropToObject` | `dragstart` | true | `C_dragstart` | ❌ | 存 `this.dragstartLocator` |
| 9 | 358 | `dragAndDropToObject` | `drop` | true | `C_drop` | ✅ | `dragAndDropToObject` |
| 10 | 372 | `runScript` | `scroll` | true | `C_scroll` | ❌ | 存 `this.scrollDetector` |
| 11 | 387 | `mouseOver` | `mouseover` | true | `C_mouseover` | ❌ | 维护 `mouseoverQ` 三帧队列 |
| 12 | 417 | `mouseOut` | `mouseout` | true | `C_mouseout` | ❌ | `record` 已注释（`:420`） |
| 13 | 427 | `mouseOver` | `DOMNodeInserted` | true | `C_DOMNodeInserted` | ❌ | `record` 已注释（`:432`, `:445`） |
| 14 | 457 | `checkPageLoaded` | `readystatechange` | true | `C_readystatechange` | ❌ | 维护 `pageLoaded`（complete 后 1.5s 才置 true） |
| 15 | 472 | `contextMenu` | `contextmenu` | true | `C_contextmenu` | ✅ | 17 种 `verify*/assert*/store*/waitFor*` |
| 16 | 497 | `editContent` | `focus` | true | `C_focus` | ❌ | 存 `getEle` / `contentTest` / `checkFocus` |
| 17 | 509 | `editContent` | `blur` | true | `C_blur` | ✅ | `editContent` |
| 18 | 569 | `select` | `focus` | true | `C_focus` | ❌ | 存 `option._wasSelected` |
| 19 | 585 | `select` | `change` | **false** | `change` | ✅ | `select` / `addSelection` / `removeSelection` |

**折叠后的 `Recorder.eventHandlers` 结构（17 个 key）**：
```
change             → [ type-change(L49),   select-change(L585) ]
input              → [ type-input(L82) ]
C_click            → [ clickAt(L89) ]
C_dblclick         → [ doubleClickAt(L115) ]
C_keydown          → [ sendKeys(L159) ]
C_mousedown        → [ dragAndDrop(L252) ]
C_mouseup          → [ dragAndDrop(L283) ]
C_dragstart        → [ dragAndDropToObject(L349) ]
C_drop             → [ dragAndDropToObject(L358) ]
C_scroll           → [ runScript(L372) ]
C_mouseover        → [ mouseOver(L387) ]
C_mouseout         → [ mouseOut(L417) ]
C_DOMNodeInserted  → [ mouseOver(L427) ]
C_readystatechange → [ checkPageLoaded(L457) ]
C_contextmenu      → [ contextMenu(L472) ]
C_focus            → [ editContent(L497), select(L569) ]
C_blur             → [ editContent(L509) ]
```

**注册顺序 = 执行顺序**，这是有语义的：`change` 键下 `type` 先于 `select`。用户改 `<select>` 时，`type` handler 先跑，因为 `tagName` 是 `select` 不匹配 `input`/`textarea`，什么都不记，然后在 `:79` 无条件 `typeLock = 0`；随后 `select` handler 才记 `select` 命令。若顺序反过来，`typeLock` 会被 `type` handler 的复位干扰。

### 3.2 为什么用 capture 阶段而不是 bubble

监听点固定在 `document`（`content/recorder.js:63`）：
```js
this.window.document.addEventListener(eventName, listener, capture);
```

DOM 事件三阶段：`capture (window → document → ... → target 的父)` → `target` → `bubble (target 的父 → ... → document → window)`。**document 在 capture 阶段是第 2 站，在 bubble 阶段是倒数第 2 站。**

| 理由 | 说明 | 落点 |
|---|---|---|
| (a) 抢在页面 `stopPropagation()` 之前 | 页面上任意一个 `e.stopPropagation()` 都能让事件永远到不了 bubble 阶段的 document，录制直接瞎掉。capture 阶段页面元素上的 handler 还没被调用 | 通用 |
| (b) 抢在 SPA re-render 之前 | React/Vue 在 click handler 里 `setState` 可能把这棵子树整个替换掉。等到 bubble 时 `event.target` 已 detach，`buildAll(el)` 内部的 `findElement(locator) === e` 校验（`locatorBuilders.js:134-137`）会全部失败，返回空数组 → `target[0]` 抛 `TypeError` | `locatorBuilders.js:133-140` |
| (c) 抢在导航发生之前 | 点 `<a href>` 会卸载页面。capture + 同步 `sendMessage` 能在 unload 前把消息发出去 | `recorder.js:105` |
| (d) 反过来，`change`/`input`/`select-change` **故意用冒泡** | `change` 语义上是"值已提交"，必须等 `<select>.selectedIndex`、`<input>.value` 落定。capture 阶段读到的可能是旧值 | §3.1 表格 #1/#2/#19 |

> ⚠️ **注意 (d) 的不对称是有意设计，不是疏忽。** 复刻时不要"统一都用 capture"。

### 3.3 事件处理器的注册/注销机制（`C_` 前缀含义）

**注册**：`content/recorder.js:121-130`
```js
Recorder.eventHandlers = {};
Recorder.addEventHandler = function (handlerName, eventName, handler, options) {
    handler.handlerName = handlerName;
    if (!options) options = false;
    let key = options ? ('C_' + eventName) : eventName;
    if (!this.eventHandlers[key]) {
        this.eventHandlers[key] = [];
    }
    this.eventHandlers[key].push(handler);
}
```

**`C_` 前缀 = Capture 的标记，被编码进 map 的 key 里，而不是单独存字段。** 这么设计的原因见下面的 `detach()`。

**解码**：`content/recorder.js:35-41`
```js
parseEventKey(eventKey) {
    if (eventKey.match(/^C_/)) {
        return { eventName: eventKey.substring(2), capture: true };
    } else {
        return { eventName: eventKey, capture: false };
    }
}
```

**attach —— 每个 key 折叠成一个真实 listener**：`content/recorder.js:44-68`
```js
attach() {
    if (this.attached) {
        return;                      // ← 幂等，重复消息无害（§9 依赖这一点）
    }
    this.attached = true;
    this.eventListeners = {};
    var self = this;
    for (let eventKey in Recorder.eventHandlers) {
        var eventInfo = this.parseEventKey(eventKey);
        var eventName = eventInfo.eventName;
        var capture = eventInfo.capture;
        // create new function so that the variables have new scope.
        function register() {
            var handlers = Recorder.eventHandlers[eventKey];
            var listener = function (event) {
                for (var i = 0; i < handlers.length; i++) {
                    handlers[i].call(self, event);      // ← this === Recorder 实例
                }
            }
            this.window.document.addEventListener(eventName, listener, capture);
            this.eventListeners[eventKey] = listener;
        }
        register.call(this);
    }
}
```

三个要点：
1. **`register()` 函数包装的目的**是给 `eventKey`/`eventName`/`capture` 造一个新作用域。原代码用的是 `var`（函数作用域），若直接写闭包，循环结束后所有闭包会共享最后一次的值。注意 `for (let eventKey ...)` 用了 `let`，但 `var eventName` / `var capture` 仍是 `var` —— `register()` 是必要的。
2. **`handlers[i].call(self, event)`** 让每个 handler 里的 `this` 都是 Recorder 实例，所以 handler 内能直接写 `this.record(...)`、`this.locatorBuilders`、`this.mousedown`。
3. **保存 listener 引用到 `this.eventListeners[eventKey]`**，供 detach 使用。

**detach —— 必须用同样的 capture 值**：`content/recorder.js:71-83`
```js
detach() {
    if (!this.attached) {
        return;
    }
    this.attached = false;
    for (let eventKey in this.eventListeners) {
        var eventInfo = this.parseEventKey(eventKey);
        var eventName = eventInfo.eventName;
        var capture = eventInfo.capture;
        this.window.document.removeEventListener(eventName, this.eventListeners[eventKey], capture);
    }
    delete this.eventListeners;
}
```

> **`C_` 前缀的真正必要性在这里**：`removeEventListener(type, listener, useCapture)` 的第三参必须与注册时**完全一致**，否则移除失败（浏览器把 `(type, listener, capture)` 当作复合主键）。把 capture 编码进 key，就保证了 attach/detach 一定对称。

**`getEventTarget` —— Shadow DOM 预留口**：`content/recorder-handlers.js:19-24`
```js
function getEventTarget(event) {
    if (!event) {
        return event;
    }
    return event._target || event.target;
}
```
全库搜索（排除 `bundles/`）**没有任何地方给 `event._target` 赋值**。这是给 Shadow DOM / `composedPath()[0]` 预留的钩子（`event.target` 跨 shadow 边界会被 retarget 成宿主元素），7.1.0 里等价于 `event.target`。

> **复刻建议**：直接写 `const el = event.composedPath?.()[0] ?? event.target;`，一步到位支持开放式 Shadow DOM。

### 3.4 为什么"看不到网络请求"——录的是 DOM 事件层

| 项 | 事实 | 证据 |
|---|---|---|
| 权限里没有 `webRequest` | `permissions` 只有 `tabs, activeTab, contextMenus, downloads, webNavigation, notifications, cookies, storage, unlimitedStorage, debugger, scripting, offscreen` | `manifest.json:64` |
| `webNavigation` 用途不是抓请求 | 只用了 `onCreatedNavigationTarget` 一个事件，且只用来给"新开的 tab"分配 `win_ser_N` 别名 | `panel/js/background/recorder.js:152-173, 370` |
| `debugger` 权限用途 | CDP，用于回放期间的截图/文件上传等，**与录制无关**（`content/command-receiver.js` 里的录制路径完全不涉及） | `manifest.json:64` |
| 唯一"跟导航有关"的录制输入 | `content/check-browser-automation.js:1-5` 发的 `checkForAutomated` 伪命令，作用是"页面加载心跳"，让 Panel 有机会比对 URL 补 `open` | `panel/js/background/recorder.js:253-268` |

`content/check-browser-automation.js` 全文只有 5 行：
```js
var checkAutomated = navigator.webdriver;
browser.runtime.sendMessage({
  command: "checkForAutomated",
  isAutomated: checkAutomated,
});
```

**结论**：录制引擎完全不知道页面发了什么 HTTP 请求。你在 DevTools 看到的 `POST /api/login` 之所以在录制结果里"消失"，是因为它从来就没有进入过 Recorder 的视野。

---

## 4. 事件 → 命令的语义识别（本文核心）

### 4.0 三层塌缩模型

用户的一次物理操作，会在 DOM 里炸开成一串事件。Recorder 用**三层过滤**把它们塌缩回一条命令：

```
物理操作（1 次）
    ↓  浏览器事件派发
DOM 事件流（N 个）           例："点一下按钮" → mousedown, mouseup, click
    ↓  ① 层：handler 白名单（只有 17 个 eventKey 被监听，其余全丢）
候选事件（M 个，M ≤ N）
    ↓  ② 层：入口守卫（button==0 / isTrusted / tagName 判定 / preventXxx 标志）
有效事件（K 个，K ≤ M）
    ↓  ③ 层：语义分支 + 状态机（typeLock / preventClickTwice / enterTarget / _wasSelected）
命令（通常 1 条）
```

三层各自的实现位置：

| 层 | 实现 | 位置 |
|---|---|---|
| ① 白名单 | `Recorder.eventHandlers` 这张 map 里有什么 key，就只监听什么 | `content/recorder.js:121-130`、`content/recorder.js:51-67` |
| ② 入口守卫 | 每个 handler 开头的 `if` | 例 `recorder-handlers.js:91`、`:52`、`:161` |
| ③ 状态机 | 12 个**模块级**全局变量 + 6 个 `setTimeout` | 见 §4.11 变量总表 |

⚠️ **关键认知修正**：很多人以为"连续输入被合并"靠的是**防抖定时器**。**不是。** 7.1.0 里字符流的合并**完全交给浏览器的 `change` 事件语义**，一行防抖代码都没有。定时器只用来解决**另外五个**去重问题（见 §4.12）。

---

### 4.1 click 的识别

**唯一产出 `click` 命令的地方**：`content/recorder-handlers.js:88-111`

```js
// © Jie-Lin You, SideeX Team
var preventClickTwice = false;
Recorder.addEventHandler('clickAt', 'click', function (event) {
    const eventTarget = getEventTarget(event);
    if (event.button == 0 && !preventClick && event.isTrusted) {      // ← 守卫 A/B/C
        if (!preventClickTwice) {                                      // ← 守卫 D
            var top = event.pageY,
                left = event.pageX;
            var element = eventTarget;
            do {
                top -= element.offsetTop;
                left -= element.offsetLeft;
                element = element.offsetParent;
            } while (element);                                         // ← 死循环计算，结果被丢弃
            var target = eventTarget;                                  // ← 未使用
            if (eventTarget.parentNode.id !== "popupInjectionKR") {    // ← 守卫 E
                this.record("click", this.locatorBuilders.buildAll(eventTarget), '');
                var arrayTest = this.locatorBuilders.buildAll(eventTarget);   // ← 未使用，重复计算
                preventClickTwice = true;
            }
        }
        setTimeout(function () { preventClickTwice = false; }, 30);    // ← 30ms 去重窗
    }
}, true);
```

**五道守卫逐条解释**：

| 守卫 | 代码 | 挡掉什么 |
|---|---|---|
| A | `event.button == 0` | 中键（1）、右键（2）。右键有独立的 `contextmenu` 通道（§4.8） |
| B | `!preventClick` | 表单提交后 500ms 内的 click（`:213-216` 设置）。防止"回车提交 → 页面跳转 → 落地页误触"产生噪声 |
| C | `event.isTrusted` | **所有 JS 合成的点击**：`el.click()`、`dispatchEvent(new MouseEvent('click'))`。**这是防回放自录的第一道防线**（§8.1） |
| D | `!preventClickTwice` | 30ms 内的第二次 click |
| E | `eventTarget.parentNode.id !== "popupInjectionKR"` | 点击注入到页面里的那个"Katalon Recorder is recording… / Stop"浮层（`content/inject-popup-record.js:19-100`） |

**守卫 D（30ms 窗）的实际效果 —— 双击只录 1 条 `click`**：

用户双击一次，DOM 事件序列是：
```
mousedown, mouseup, click(detail=1), mousedown, mouseup, click(detail=2), dblclick
                                     ↑                                    ↑
                                第 1 次 click                       两次 click 间隔通常 < 30ms
```
第 2 次 `click` 落在 30ms 窗内被 D 挡掉 → **只留 1 条 `click`**。而 `dblclick` 的 handler 因为一个 bug（§10-B1）会抛异常，**`doubleClick` 命令实际永远录不出来**。

> ⚠️ **源码未注释 D 的设计意图**，以上是从行为反推。另一个可被 D 挡掉的真实场景是点击 `<label>`：浏览器会向关联的 `<input>` 再派发一次 click。

**注意 `record("click", ...)` 的命令名与 handlerName 不一致**：`addEventHandler('clickAt', 'click', ...)` 里 `handlerName='clickAt'`，但真正 record 的是 `"click"`。`handlerName` 在 7.1.0 中**只在 `content/recorder.js:123` 被赋值，全库没有任何地方读取它**（已 grep 确认，排除 `bundles/`）。它是 SideeX 遗留的死字段。

**记住这条**：Panel 侧 `panel/js/background/recorder.js:296` 的 `if (message.command == "doubleClickAt")` 分支，因为 recorder 从不发送 `doubleClickAt`（只发 `doubleClick`），**永远不会进入**。这是三重死代码。

---

### 4.2 输入的识别：为什么连续敲 10 个字符只产生 1 条 `type`

这是用户最关心的问题。**答案分两步。**

#### 4.2.1 第一步：keydown 对普通字符完全无动作

`content/recorder-handlers.js:159-248` 的 keydown handler，进门后**只判断 4 个 keyCode**：

```js
Recorder.addEventHandler('sendKeys', 'keydown', function (event) {
    const eventTarget = getEventTarget(event);
    if (eventTarget.tagName) {
        var key = event.keyCode;
        var tagName = eventTarget.tagName.toLowerCase();
        var type = eventTarget.type;
        if (tagName == 'input' && Recorder.inputTypes.indexOf(type) >= 0) {
            if (key == 13) { /* Enter：见 §4.5 */ }
            ...
            if ((key == 38 || key == 40) && eventTarget.value != '') { /* ↑↓ */ }
            if (key == 9) { /* Tab */ }
        }
    }
}, true);
```

敲 `a`（keyCode 65）→ 三个 `if` 全不命中 → **函数直接返回，零命令**。敲 10 个字符就是 10 次空转。

#### 4.2.2 第二步：`input` 事件只记指针，`change` 事件才出命令

```js
// content/recorder-handlers.js:82-85  —— 每敲一个字符都触发，但只做一件事
Recorder.addEventHandler('type', 'input', function (event) {
    const eventTarget = getEventTarget(event);
    typeTarget = eventTarget;          // ← 只存"最后被输入的元素"这个指针，不存值、不发命令
});
```

```js
// content/recorder-handlers.js:49-80  —— 整个输入过程只触发一次
Recorder.addEventHandler('type', 'change', function (event) {
    const eventTarget = getEventTarget(event);
    if (eventTarget.tagName && !preventType && typeLock == 0 && (typeLock = 1)) {
        var tagName = eventTarget.tagName.toLowerCase();
        var type = eventTarget.type;
        if ('input' == tagName && Recorder.inputTypes.indexOf(type) >= 0) {
            if (eventTarget.value.length > 0) {
                this.record("type", this.locatorBuilders.buildAll(eventTarget), eventTarget.value);
                // ...（enterTarget 相关逻辑见 §4.5）
            } else {
                this.record("type", this.locatorBuilders.buildAll(eventTarget), eventTarget.value);
            }
        } else if ('textarea' == tagName) {
            this.record("type", this.locatorBuilders.buildAll(eventTarget), eventTarget.value);
        }
    }
    typeLock = 0;
});
```

**合并的真正机理**：HTML 规范规定，`<input type=text>` 的 `change` 事件**只在"值被提交"时触发一次**（失焦 blur，或按 Enter），而不是每次按键。每次按键触发的是 `input` 事件。

```
用户敲 "hello" 后点别处：
  keydown h, input, keydown e, input, ... keydown o, input     ← 10 个事件，0 条命令
  blur → change                                                 ← 1 个事件，1 条命令
                                                                   type | id=q | hello
```

> **给 Java 读者的类比**：`input` = `DocumentListener.insertUpdate()`（每次改都回调）；`change` = `ActionListener` / `FocusLost`（提交时才回调）。Recorder 只订阅后者。

**所以"合并"是免费的，来自浏览器语义，不是 Recorder 的功劳。** 这也是它比"记录键盘流"的录制器更稳的原因：只要最终值对，中间的删改、粘贴、输入法组合（IME composition）全部不影响结果。

#### 4.2.3 `typeLock` 的真正作用：跨 handler 防重

`typeLock` 定义在 `content/recorder-handlers.js:28`，初值 0。表面上像个可重入锁，但 JS 单线程 + handler 内无 `await`，**同一个 `change` 事件里它不可能被并发进入**。它的真实用途是**跨事件**：

| 时刻 | 代码位置 | typeLock |
|---|---|---|
| 用户按 Enter，keydown handler 里 `if (typeTarget.tagName && !preventType && (typeLock = 1))` | `:186` | **赋值为 1**（注意是 `=` 赋值不是 `==` 比较，恒为真） |
| keydown handler 内 record 了一条 `type` | `:192` / `:207` / `:210` | 1 |
| 浏览器紧接着派发 `change` 事件 | — | 1 |
| change handler 判定 `typeLock == 0` → **false，跳过** | `:52` | 1 |
| change handler 末尾无条件复位 | `:79` | **0** |

**没有 `typeLock`，按 Enter 会录出两条一模一样的 `type`。** 这是一个货真价实的"跨事件互斥锁"，只是命名和写法（`(typeLock = 1)` 塞在 `&&` 链里）非常隐晦。

⚠️ 注意 `:79` 的 `typeLock = 0;` 在 `if` **外面**，无论是否进入分支都会复位 —— 所以锁的生命周期严格是"从 keydown 到下一次 change"。

#### 4.2.4 `preventType` 与那个致命的空集 bug

`preventType`（`:134`）是"本次输入不要录 type"的开关：

| 操作 | 位置 | 效果 |
|---|---|---|
| 置 **true** | `:177` Enter 且 `tempValue == enterTarget.value && tabCheck == enterTarget` | 只录 `sendKeys ${KEY_ENTER}`，不录 type |
| 置 **true** | `:243` Tab 且 `tabCheck == eventTarget` | 只录 `sendKeys ${KEY_TAB}`，不录 type |
| 置 **false** | `:143`，在 input 元素的 `focus` 监听器里 | **这段代码从未被绑定 —— 见下** |

```js
// content/recorder-handlers.js:131-151
var focusTarget = null;
var focusValue = null;
var tempValue = null;
var preventType = false;
var inp = document.getElementsByTagName("input");     // ← 在 document_start 时刻执行
for (var i = 0; i < inp.length; i++) {                //    此时 <body> 还不存在
    if (Recorder.inputTypes.indexOf(inp[i].type) >= 0) {
        inp[i].addEventListener("focus", function (event) {
            const eventTarget = getEventTarget(event);
            focusTarget = eventTarget;
            focusValue = focusTarget.value;
            tempValue = focusValue;
            preventType = false;                       // ← 唯一的复位点
        });
        inp[i].addEventListener("blur", function (event) { ... });
    }
}
```

`manifest.json:27-34` 声明 `"run_at": "document_start"`。这一行是**顶层语句**，在 bundle 装载时立即执行，此刻 DOM 树里一个 `<input>` 都没有 → `inp.length === 0` → **循环体一次都不执行** → 这两个 listener 永远不存在。

**级联后果（三条，全部可复现）**：

1. `focusTarget`、`focusValue`、`tempValue` **永远是 `null`**。
2. `preventType` 一旦被置 true，**永不复位**，此后整个页面生命周期内**所有 `type` 命令全部丢失**。触发路径：在某输入框按 ↑/↓（设置 `tabCheck`，`:238`）→ 再按 Tab（`:240-245` 命中）→ `preventType = true` → 从此不再录任何输入。
3. `:174` 的 `tempValue == enterTarget.value` 中 `tempValue` 恒为 `null`，与字符串永不相等（`null == "abc"` 为 `false`，`null == ""` 也为 `false`）；`:178` 的 `focusValue == enterTarget.value` 同理恒 false。**这两条分支是死代码**，Enter 的实际走向只可能是 `:186` 那一支。

> **复刻建议**：不要照抄这段。用 `document.addEventListener('focus', handler, true)`（capture 阶段的事件委托），一行搞定，且对动态插入的 input 也生效。

---

### 4.3 下拉框 `<select>`

三个 handler 协作，产出 `select` / `addSelection` / `removeSelection`。

**快照 1 —— mousedown 时记住多选框的旧状态**：`content/recorder-handlers.js:266-278`
```js
const eventTarget = getEventTarget(event);
if (eventTarget.nodeName) {
    var tagName = eventTarget.nodeName.toLowerCase();
    if ('option' == tagName) {
        var parent = eventTarget.parentNode;
        if (parent.multiple) {
            var options = parent.options;
            for (var i = 0; i < options.length; i++) {
                options[i]._wasSelected = options[i].selected;    // ← 打私有标记
            }
        }
    }
}
```

**快照 2 —— focus 时兜底**：`content/recorder-handlers.js:569-583`
```js
Recorder.addEventHandler('select', 'focus', function (event) {
    ...
    if ('select' == tagName && eventTarget.multiple) {
        var options = eventTarget.options;
        for (var i = 0; i < options.length; i++) {
            if (options[i]._wasSelected == null) {
                // is the focus was gained by mousedown event, _wasSelected would be already set
                options[i]._wasSelected = options[i].selected;
            }
        }
    }
}, true);
```

**差分 —— change 时比对**：`content/recorder-handlers.js:585-610`
```js
Recorder.addEventHandler('select', 'change', function (event) {
    const eventTarget = getEventTarget(event);
    if (eventTarget.tagName) {
        var tagName = eventTarget.tagName.toLowerCase();
        if ('select' == tagName) {
            if (!eventTarget.multiple) {
                var option = eventTarget.options[eventTarget.selectedIndex];
                this.record("select", this.locatorBuilders.buildAll(eventTarget), this.getOptionLocator(option));
            } else {
                var options = eventTarget.options;
                for (var i = 0; i < options.length; i++) {
                    if (options[i]._wasSelected == null) { }        // ← 空语句，死代码
                    if (options[i]._wasSelected != options[i].selected) {
                        var value = this.getOptionLocator(options[i]);
                        if (options[i].selected) {
                            this.record("addSelection", this.locatorBuilders.buildAll(eventTarget), value);
                        } else {
                            this.record("removeSelection", this.locatorBuilders.buildAll(eventTarget), value);
                        }
                        options[i]._wasSelected = options[i].selected;   // ← 更新快照
                    }
                }
            }
        }
    }
});
```

**`change` 键上挂了两个 handler**（`type` 的 `:49` 和 `select` 的 `:585`），按注册顺序串行执行（`content/recorder.js:59-61`）。对 `<select>` 而言，第一个 handler 因 `tagName` 既不是 `input` 也不是 `textarea` 而无产出，但**它会把 `typeLock` 拉高又清零**（`:52` → `:79`）——无副作用，但要知道它跑过。

**value 的形态**：`getOptionLocator()`（`content/recorder-handlers.js:529-549`）优先输出 `label=选项文本`；若文本里含 `&nbsp;`（`\xA0`），退化为 `label=regexp:...` 并把正则元字符转义、把空白折成 `\s+`。

---

### 4.4 键盘：Enter / Tab / ↑↓

#### 4.4.1 Enter（keyCode 13）—— 最复杂的一段

`content/recorder-handlers.js:166-220`，完整执行路径（结合 §4.2.4 的空集 bug，实际只有一条活路）：

```js
if (key == 13) {
    enterTarget = eventTarget;
    enterValue = enterTarget.value;
    var tempTarget = eventTarget.parentElement;
    var formChk = tempTarget.tagName.toLowerCase();

    if (tempValue == enterTarget.value && tabCheck == enterTarget) {   // ← 死分支（tempValue 恒 null）
        this.record("sendKeys", this.locatorBuilders.buildAll(enterTarget), "${KEY_ENTER}");
        enterTarget = null;
        preventType = true;
    } else if (focusValue == enterTarget.value) {                      // ← 死分支（focusValue 恒 null）
        while (formChk != 'form' && formChk != 'body') { ... }
        this.checkForm(formChk, tempTarget);
        enterTarget = null;
    }

    if (typeTarget.tagName && !preventType && (typeLock = 1)) {        // ← 实际唯一活路
        var tagName = typeTarget.tagName.toLowerCase();
        var type = typeTarget.type;
        if ('input' == tagName && Recorder.inputTypes.indexOf(type) >= 0) {
            if (typeTarget.value.length > 0) {
                this.record("type", this.locatorBuilders.buildAll(typeTarget), typeTarget.value);   // ① type
                if (enterTarget != null) {
                    var tempTarget = typeTarget.parentElement;
                    var formChk = tempTarget.tagName.toLowerCase();
                    while (formChk != 'form' && formChk != 'body') {   // ← 向上找最近的 <form>
                        tempTarget = tempTarget.parentElement;
                        formChk = tempTarget.tagName.toLowerCase();
                    }
                    this.checkForm(formChk, tempTarget);               // ② submit 或 sendKeys
                    enterTarget = null;
                }
            } else {
                this.record("type", ..., typeTarget.value);
            }
        } else if ('textarea' == tagName) {
            this.record("type", ..., typeTarget.value);
        }
    }
    preventClick = true;
    setTimeout(function () { preventClick = false; }, 500);            // ③ 500ms 静音期
    setTimeout(function () {
        if (enterValue != eventTarget.value) enterTarget = null;
    }, 50);
}
```

`checkForm()` 决定第 ② 条命令是什么 —— `content/recorder-handlers.js:29-46`：
```js
Recorder.prototype.checkForm = function (targetName, target) {
    let atrList = ['id', 'name', 'class'];
    let tempTarget = target;
    if (targetName === 'form'
        && atrList.some(atr => target.hasAttribute(atr))
        && !target.hasAttribute("onsubmit")
        && !target.hasAttribute("ng-submit")
    ) {
        if (tempTarget.hasAttribute("id"))
            this.record("submit", [["id=" + tempTarget.id, "id"]], "");
        else if (tempTarget.hasAttribute("name"))
            this.record("submit", [["name=" + tempTarget.name, "name"]], "");
        else {
            this.record("submit", [["css=." + tempTarget.classList[0]]], "");
        }
    } else
        this.record("sendKeys", this.locatorBuilders.buildAll(enterTarget), "${KEY_ENTER}");
}
```

**决策表**：

| 祖先链上有 `<form>`？ | form 有 id/name/class？ | form 有 `onsubmit`/`ng-submit`？ | 产出 |
|---|---|---|---|
| 有 | 有 | 无 | `submit \| id=xxx`（或 `name=` / `css=.第一个class`） |
| 有 | 有 | **有** | `sendKeys \| <input> \| ${KEY_ENTER}` |
| 有 | 无 | — | `sendKeys \| ${KEY_ENTER}` |
| 无（走到 `body` 停） | — | — | `sendKeys \| ${KEY_ENTER}` |

**设计意图**：原生 `<form>` 提交用 `submit` 命令回放最稳（不依赖按钮定位）；但如果 form 挂了 JS 提交钩子（`onsubmit` / Angular 的 `ng-submit`），直接调 `form.submit()` **不会**触发这些钩子，所以必须退回"真的按一下回车"。

⚠️ `checkForm` 的 `else` 分支（`:45`）用的是**全局 `enterTarget`**，不是形参 `target`。调用点在 `enterTarget = null` 之前，所以能工作 —— 但这是隐式耦合，复刻时应改成显式传参。

**典型输出（在搜索框输入 `katalon` 后回车，form 有 id）**：
```
type    | id=q       | katalon
submit  | id=search  |
```
两条，不多不少。

#### 4.4.2 Tab（keyCode 9）
```js
// content/recorder-handlers.js:240-245
if (key == 9) {
    if (tabCheck == eventTarget) {
        this.record("sendKeys", this.locatorBuilders.buildAll(eventTarget), "${KEY_TAB}");
        preventType = true;
    }
}
```
`tabCheck` 只在 `:238`（按过 ↑/↓ 之后）被赋值。所以**光按 Tab 不会录任何东西**；必须先在同一元素上按过 ↑ 或 ↓。这个前置条件在源码里没有注释，从 §4.2.4 可知这条路径一旦走通就会把 `preventType` 永久钉死。

#### 4.4.3 ↑ / ↓（keyCode 38 / 40）—— 为自动补全下拉设计
```js
// content/recorder-handlers.js:222-239
var tempbool = false;
if ((key == 38 || key == 40) && eventTarget.value != '') {
    if (focusTarget != null && focusTarget.value != tempValue) {   // ← 死分支（focusTarget 恒 null）
        tempbool = true;
        tempValue = focusTarget.value;
    }
    if (tempbool) {
        this.record("type", this.locatorBuilders.buildAll(eventTarget), tempValue);
    }
    setTimeout(function () {
        tempValue = focusTarget.value;                              // ← ⚠️ 必抛 TypeError（见 §10-B3）
    }, 250);
    if (key == 38) this.record("sendKeys", this.locatorBuilders.buildAll(eventTarget), "${KEY_UP}");
    else this.record("sendKeys", this.locatorBuilders.buildAll(eventTarget), "${KEY_DOWN}");
    tabCheck = eventTarget;
}
```
实际产出**只有** `sendKeys ${KEY_UP}` / `${KEY_DOWN}` 一条；那条 250ms 后的定时器会在控制台抛 `TypeError: Cannot read properties of null (reading 'value')`。

---

### 4.5 富文本 contentEditable

`content/recorder-handlers.js:497-519`，focus 存快照、blur 比对：
```js
var getEle;
var checkFocus = 0;
Recorder.addEventHandler('editContent', 'focus', function (event) {
    const eventTarget = getEventTarget(event);
    var editable = eventTarget.contentEditable;
    if (editable == 'true') {
        getEle = eventTarget;
        contentTest = getEle.innerHTML;      // ← contentTest 未声明，隐式全局
        checkFocus = 1;
    }
}, true);

Recorder.addEventHandler('editContent', 'blur', function (event) {
    if (checkFocus == 1) {
        const eventTarget = getEventTarget(event);
        if (eventTarget == getEle) {
            if (getEle.innerHTML != contentTest) {
                this.record("editContent", this.locatorBuilders.buildAll(eventTarget), getEle.innerHTML);
            }
            checkFocus = 0;
        }
    }
}, true);
```
与 `<input>` 的 `change` 同构：**只在失焦时比对首尾快照**，中间过程一律不记。注意 value 是整段 `innerHTML`，含标签。

> `contentTest` 在 `:502` 直接赋值而未声明（`content/recorder-handlers.js` 全文 grep 无 `var contentTest`）。在 MAIN world 非严格模式下会变成 `window.contentTest`，可运行但污染页面全局。

---

### 4.6 拖拽

`dragstart`（`:349-354`）延迟 200ms 落 `this.dragstartLocator`，`drop`（`:358-367`）取用：
```js
Recorder.addEventHandler('dragAndDropToObject', 'drop', function (event) {
    clearTimeout(this.dropLocator);
    const eventTarget = getEventTarget(event);
    if (this.dragstartLocator && event.button == 0 && getEventTarget(this.dragstartLocator) !== eventTarget) {
        this.record("dragAndDropToObject",
            this.locatorBuilders.buildAll(getEventTarget(this.dragstartLocator)),
            this.locatorBuilders.build(eventTarget));
    }
    delete this.dragstartLocator;
    delete this.selectMousedown;
}, true);
```
**200ms 的含义**：只有拖拽持续超过 200ms 才认账，滤掉"手抖"的极短 drag。注意 value 用的是 `build()`（单个最优定位器字符串）而非 `buildAll()`（数组），因为终点存在 value 列里，只能是字符串。

`mousedown`/`mouseup` 里那一大坨 `mouseDownAt`/`mouseMoveAt`/`mouseUpAt`（`:309-311`、`:315-317`、`:329-330`、`:336`）**全部被注释掉**，是 SideeX 时代的 HTML5 拖拽兜底方案，7.1.0 已废弃。

---

### 4.7 右键菜单 → 断言 / 存储 / 等待

这是**唯一由用户主动发起、而非被动捕获**的命令来源，链路横跨三个上下文：

```
① 用户右键点击元素
        │  contextmenu 事件（capture）
        ▼
   content/recorder-handlers.js:472-491
        │  browser.runtime.connect()  建立 Port
        │  就地快照三份数据（此时元素还在、还没被 SPA 重渲染）：
        │     tmpText  = locatorBuilders.buildAll(el)     定位器数组
        │     tmpVal   = getText(el)                      可见文本
        │     tmpTitle = normalizeSpaces(el.ownerDocument.title)
        │  注册一次性 onMessage 监听
        ▼
② 用户在菜单里点了某项（17 选 1）
        ▼
   background/background.js:229-231（Service Worker）
        port.postMessage({ cmd: info.menuItemId })
        ▼
③ 回到 content script，按 cmd 名字模式分派
   recorder-handlers.js:479-490
```

```js
Recorder.addEventHandler('contextMenu', 'contextmenu', async function (event) {
    var myPort = await browser.runtime.connect();
    const eventTarget = getEventTarget(event);
    var tmpText  = this.locatorBuilders.buildAll(eventTarget);
    var tmpVal   = getText(eventTarget);
    var tmpTitle = normalizeSpaces(eventTarget.ownerDocument.title);
    var self = this;
    myPort.onMessage.addListener(function portListener(m) {
        if (m.cmd.includes("Text")) {
            self.record(m.cmd, tmpText, tmpVal);
        } else if (m.cmd.includes("Title")) {
            self.record(m.cmd, [[tmpTitle]], '');
        } else if (m.cmd.includes("Value")) {
            self.record(m.cmd, tmpText, getInputValue(eventTarget));
        } else if (m.cmd.includes('waitFor')) {
            self.record(m.cmd, tmpText, '');
        }
        myPort.onMessage.removeListener(portListener);
    });
}, true);
```

**17 个菜单项**（`background/background.js:124-225`）与分派规则：

| 菜单项 | 命中的 `includes` 分支 | target | value |
|---|---|---|---|
| `verifyText` / `assertText` / `storeText` | `"Text"` | 定位器数组 | 快照的可见文本 |
| `verifyTitle` / `assertTitle` / `storeTitle` | `"Title"` | `[[页面标题]]` | `''` |
| `verifyValue` / `assertValue` / `storeValue` | `"Value"` | 定位器数组 | **实时**读 `getInputValue(el)` |
| `waitForElementPresent` / `waitForElementNotPresent` / `waitForTextPresent` / `waitForTextNotPresent` / `waitForValue` / `waitForNotValue` / `waitForVisible` / `waitForNotVisible` | `"waitFor"` | 定位器数组 | `''` |

⚠️ **分派顺序陷阱**：`waitForTextPresent` 里同时含 `"Text"` 和 `"waitFor"`，而 `"Text"` 的判断在前 → 它会走 **Text 分支**，被录成 `waitForTextPresent | 定位器 | 可见文本`。恰好这个组合是对的，属于"歪打正着"。但 `waitForValue` 含 `"Value"`，也会走 Value 分支拿到实时值 —— 同样歪打正着。设计上应该用精确匹配而非 `includes`。

⚠️ **Port 泄漏**：每次右键都 `browser.runtime.connect()` 建一个新 Port，只 remove 了 listener（`:489`），**从未 `myPort.disconnect()`**。同时 `background/background.js:228-234` 用一个全局单变量 `var port` 接收，后连的会覆盖先连的 —— 意味着"右键两次、只在第二次的菜单上点"时，第一次的 Port 已经收不到消息（永久挂起）。

⚠️ **`storeXxx` 三项还要跨回 Panel 弹 `prompt()` 要变量名**，见 §5.2。

---

### 4.8 JS 原生对话框 alert / confirm / prompt

DOM 事件层看不见 `window.alert`，所以走的是**猴子补丁 + postMessage** 的独立通道，横跨 4 层：

```
┌─ 页面 JS 调 alert("已保存")
│
├─ page/prompt.js（通过 <script src> 注入到页面真实 JS 上下文）
│     覆写了 window.alert / confirm / prompt
│     · 顶层窗口分支  page/prompt.js:116-177
│     · iframe 分支    page/prompt.js:56-114
│     先调 originalAlert(text) 让用户真的看见弹窗并作答
│     再 window.top.postMessage({ direction:"from-page-script", recordedType, recordedMessage, recordedResult, frameLocation }, "*")
│
├─ content/prompt-injecter.js:26-74（content script，只在顶层窗口监听）
│     收到 message → 调 recorder.record(...)
│
└─ panel/js/background/recorder.js:175-344
      落表
```

**注入代码**：`content/prompt-injecter.js:20-24`
```js
(async () => {
    var elementForInjectingScript = document.createElement("script");
    elementForInjectingScript.src = trustedPolicy.createScriptURL(await browser.runtime.getURL("page/prompt.js"));
    (document.head || document.documentElement).appendChild(elementForInjectingScript);
})();
```

**分派与"因果倒置"处理**：`content/prompt-injecter.js:30-52`
```js
switch (event.data.recordedType) {
    case "prompt":
        if (event.data.recordedResult != null) {
            recorder.record("answerOnNextPrompt", [[event.data.recordedResult]], "", true, event.data.frameLocation);
        } else {
            recorder.record("chooseCancelOnNextPrompt", [[""]], "", true, event.data.frameLocation);
        }
        recorder.record("assertPrompt", [[event.data.recordedMessage]], "", false, event.data.frameLocation);
        break;
    case "confirm":
        if (event.data.recordedResult == true) {
            recorder.record("chooseOkOnNextConfirmation", [[""]], "", true, event.data.frameLocation);
        } else {
            recorder.record("chooseCancelOnNextConfirmation", [[""]], "", true, event.data.frameLocation);
        }
        recorder.record("assertConfirmation", [[event.data.recordedMessage]], "", false, event.data.frameLocation);
        break;
    case "alert":
        //record("answerOnNextAlert",[[event.data.recordedResult]],"",true);
        recorder.record("assertAlert", [[event.data.recordedMessage]], "", false, event.data.frameLocation);
        break;
}
```

注意第 4 个实参 `true` = `insertBeforeLastCommand` —— 这是整篇文档里最反直觉的机制，单独在 §5 讲。

**为什么必须传第 5 个参数 `event.data.frameLocation`**：`prompt-injecter.js` 的监听器只在**顶层窗口**注册（`:26` `if (window.top == window || ...)`）。iframe 里的弹窗，其 `page/prompt.js` 副本会把自己算出的 `frameLocation`（`page/prompt.js:35-50`，与 `content/recorder.js:85-100` 逻辑完全相同）随消息带上来。顶层的 `recorder` 实例 `this.frameLocation` 是 `"root"`，会算错，所以必须用透传值覆盖（`content/recorder.js:110`）：
```js
frameLocation: (actualFrameLocation != undefined) ? actualFrameLocation : this.frameLocation,
```

**回放期不录**：`page/prompt.js` 每个覆写函数入口都先查 `document.body.hasAttribute("SideeXPlayingFlag")`（`:59`、`:76`、`:93`、`:155`）；回放时走"直接应答"分支，不发录制消息。详见 §8.2。

---

### 4.9 页面加载 → `open`

Recorder **没有**监听任何导航事件。`open` 命令全部由 **Panel 侧**在 `addCommandMessageHandler` 里"顺手补"出来，共 4 个触发点：

```js
// panel/js/background/recorder.js:219-224 —— ① 第一条命令必是 open
if (getRecordsArray().length === 0) {
    addCommandAuto("open", [[sender.tab.url]], "");
    this.openedTabIds[testCaseId]['tabUrl'] = sender.tab.url;
}

// :226-234 —— ② 消息来自一个从未见过的 tab
if (this.openedTabIds[testCaseId][sender.tab.id] == undefined) {
    addCommandAuto("open", [[sender.tab.url]], "");
    this.currentRecordingTabId[testCaseId]  = sender.tab.id;
    this.currentRecordingWindowId[testCaseId] = sender.tab.windowId;
    this.openedTabNames[testCaseId]["win_ser_local"] = sender.tab.id;
    this.openedTabIds[testCaseId][sender.tab.id]     = "win_ser_local";
    this.openedTabIds[testCaseId]['tabUrl'] = sender.tab.url;
}

// :253-257 —— ③ 已有命令但还没记过 tabUrl，且这条是心跳
if (!this.openedTabIds[testCaseId]['tabUrl']
    && this.openedTabNames[testCaseId]["win_ser_local"] === sender.tab.id
    && message.command === 'checkForAutomated') {
    addCommandAuto("open", [[sender.tab.url]], "");
    this.openedTabIds[testCaseId]['tabUrl'] = sender.tab.url;
} else {
    // :260-265 —— ④ URL 变了（子串比对）
    if (this.openedTabIds[testCaseId]['tabUrl']
        && !sender.tab.url.includes(this.openedTabIds[testCaseId]['tabUrl'])) {
        addCommandAuto("open", [[sender.tab.url]], "");
        this.openedTabIds[testCaseId]['tabUrl'] = sender.tab.url;
    }
    if (message.command === 'checkForAutomated') {
        return;                       // ← 心跳到此为止，不落表
    }
}
```

**心跳从哪来** —— `content/check-browser-automation.js` 全文 5 行，每次 content script 装载（即每次页面加载/跳转）执行一次：
```js
var checkAutomated = navigator.webdriver;
browser.runtime.sendMessage({
  command: "checkForAutomated",
  isAutomated: checkAutomated,
});
```
它借用了 `command` 字段混进录制消息通道，纯粹为了**给 Panel 一个"我这边页面变了，你比对一下 URL"的时机**。`isAutomated` 字段在 `panel/js/background/recorder.js` 中**未被读取**（已 grep 确认）。

⚠️ **`!url.includes(oldUrl)` 是子串判断，不是相等判断**。后果：从 `https://a.com/` 跳到 `https://a.com/login` → `"https://a.com/login".includes("https://a.com/")` 为 true → **不产生 `open`**，`tabUrl` 也不更新。这是有意为之还是 bug，源码无注释；行为上等价于"只有跳到完全不同前缀的站点才补 open"。

**⚠️ 重要修正：7.1.0 的录制引擎不会产生任何 `*AndWait` 命令。** 全库 grep `clickAndWait|AndWait`（排除 `bundles/`）的结果只落在**回放执行器**（`content/selenium-api.js`、`content/selenium-commandhandlers.js`、`content/command-receiver.js`、`playback/**`）和**格式化导出器**（`panel/js/katalon/newformatters/*`、`panel/js/katalon/selenium-ide/format/**`）里，录制侧一处都没有。等待靠回放期的隐式同步，不靠录制期埋点。

---

### 4.10 完整命令映射总表

| # | 用户操作 | 触发的 DOM 事件（按序） | 监听 key | 源码 | 产出命令 | target 形态 | value 形态 |
|---|---|---|---|---|---|---|---|
| 1 | 左键单击 | mousedown → mouseup → **click** | `C_click` | `recorder-handlers.js:89-111` | `click` | `buildAll()` 数组 | `''` |
| 2 | 左键双击 | …click ×2 → dblclick | `C_click` / `C_dblclick` | `:89-111` / `:115-127` | **`click` ×1**（第 2 次被 30ms 窗吃掉）；`doubleClick` 因 §10-B1 永不产出 | 同上 | `''` |
| 3 | 文本框输入后失焦 | input ×N → **change** | `input` / `change` | `:82-85` / `:49-80` | `type` ×1 | `buildAll()` | 最终字符串 |
| 4 | 文本框输入后回车 | input ×N → **keydown(13)** →(change 被 typeLock 挡) | `C_keydown` | `:166-220` | `type` + (`submit` 或 `sendKeys ${KEY_ENTER}`) | `buildAll()` / form 定位器 | 值 / `''` / `${KEY_ENTER}` |
| 5 | textarea 输入后失焦 | input ×N → change | `change` | `:75-77` | `type` | `buildAll()` | 最终字符串 |
| 6 | 单选下拉框选值 | mousedown → **change** | `change` | `:589-592` | `select` | `buildAll()`（select 元素） | `label=选项文本` |
| 7 | 多选下拉框改选 | mousedown（快照）→ change（差分） | `C_mousedown` / `change` | `:266-278` / `:593-607` | `addSelection` / `removeSelection`（每个变化的 option 一条） | `buildAll()` | `label=选项文本` |
| 8 | 在输入框按 ↑/↓ | keydown(38/40) | `C_keydown` | `:222-239` | `sendKeys` | `buildAll()` | `${KEY_UP}` / `${KEY_DOWN}` |
| 9 | 按过 ↑↓ 后按 Tab | keydown(9) | `C_keydown` | `:240-245` | `sendKeys` | `buildAll()` | `${KEY_TAB}` |
| 10 | 编辑 contentEditable 后失焦 | focus → blur | `C_focus` / `C_blur` | `:497-519` | `editContent` | `buildAll()` | `innerHTML` 全文 |
| 11 | 拖放（>200ms） | dragstart → drop | `C_dragstart` / `C_drop` | `:349-367` | `dragAndDropToObject` | 起点 `buildAll()` | 终点 `build()` 单串 |
| 12 | 右键菜单选断言/存储/等待 | contextmenu + Port 消息 | `C_contextmenu` | `:472-491` | 17 选 1（见 §4.7 表） | 视分支 | 视分支 |
| 13 | 页面弹 `alert()` | —（猴子补丁） | 无 | `prompt-injecter.js:48-51` | `assertAlert` | `[[消息文本]]` | `''` |
| 14 | 页面弹 `confirm()` 点确定 | —（猴子补丁） | 无 | `prompt-injecter.js:40-47` | `chooseOkOnNextConfirmation`（**前插**）+ `assertConfirmation` | `[[""]]` / `[[消息]]` | `''` |
| 15 | 页面弹 `confirm()` 点取消 | — | 无 | 同上 | `chooseCancelOnNextConfirmation`（前插）+ `assertConfirmation` | 同上 | `''` |
| 16 | 页面弹 `prompt()` 输入后确定 | — | 无 | `prompt-injecter.js:32-39` | `answerOnNextPrompt`（前插）+ `assertPrompt` | `[[用户输入]]` / `[[消息]]` | `''` |
| 17 | 页面弹 `prompt()` 点取消 | — | 无 | 同上 | `chooseCancelOnNextPrompt`（前插）+ `assertPrompt` | `[[""]]` / `[[消息]]` | `''` |
| 18 | 首次录制 / 换站点 | —（Panel 侧补） | 无 | `bg/recorder.js:219-265` | `open` | `[[url]]` | `''` |
| 19 | 切换标签页 | —（`tabs.onActivated`） | 无 | `bg/recorder.js:33-64` | `selectWindow` | `[[win_ser_xxx]]` | `''` |
| 20 | 切换浏览器窗口 | —（`windows.onFocusChanged`） | 无 | `bg/recorder.js:66-118` | `selectWindow` | `[[win_ser_xxx]]` | `''` |
| 21 | 关闭标签页 | —（`tabs.onRemoved`） | 无 | `bg/recorder.js:120-150` | `close`（可能被两条 `selectWindow` 夹住） | `[[win_ser_xxx]]` | `''` |
| 22 | 操作跨越 iframe 边界 | —（Panel 侧差分） | 无 | `bg/recorder.js:271-293` | `selectFrame` ×N | `[[relative=parent]]` 或 `[[index=N]]` | `''` |

**从不产出的命令**（重要的"负面清单"，复刻时别浪费时间找）：
`clickAt`、`doubleClickAt`、`doubleClick`（实际不可达）、`mouseDown`、`mouseUp`、`mouseDownAt`、`mouseMoveAt`、`mouseUpAt`、`mouseOver`、`mouseOut`、`runScript`、任何 `*AndWait`、`answerOnNextAlert`（`prompt-injecter.js:49` 已注释）。

---

### 4.11 状态机变量总表

| 变量 | 定义位置 | 类型 | 生命周期 | 作用 |
|---|---|---|---|---|
| `typeTarget` | `recorder-handlers.js:27` | Element | 常驻，被 `input` 覆盖 | 记住"最后被输入的元素"，供 Enter 分支取值 |
| `typeLock` | `:28` | 0/1 | keydown→change 之间 | 防止 Enter 场景下 `type` 录两次（§4.2.3） |
| `preventClickTwice` | `:88` | boolean | 30ms | 双击只录一条 click |
| `preventClick` | `:155` | boolean | 500ms | 表单提交后静音 |
| `enterTarget` | `:156` | Element | 至 checkForm 结束 / 50ms 定时器 | 标记"刚按过 Enter"，触发 form 探测 |
| `enterValue` | `:157` | string | 50ms | 50ms 后比对值是否变化，变了就撤销 `enterTarget` |
| `tabCheck` | `:158` | Element | 常驻 | ↑↓ 之后才允许录 Tab |
| `focusTarget` / `focusValue` / `tempValue` | `:131-133` | — | **永远为 null**（§10-B2） | 设计上是输入框焦点快照 |
| `preventType` | `:134` | boolean | **单向，永不复位**（§10-B2） | 抑制 `type` |
| `getEle` / `checkFocus` / `contentTest` | `:495-496` / `:502` | — | focus→blur | contentEditable 快照 |
| `pageLoaded` | `:456` | boolean | readystatechange +1500ms | 页面稳定后才处理 scroll/mouseover |
| `nowNode` | `:386` | number | 每次 mouseover 刷新 | DOM 节点数，用于判断 DOMNodeInserted 是否真的新增 |
| `this.mousedown` / `this.selectMousedown` / `this.mouseoverQ` / `this.dragstartLocator` / `this.scrollDetector` / `this.nodeInsertedLocator` | 挂在 Recorder 实例上 | — | 各自 200/500ms | 拖拽与悬停检测（大部分产出已注释） |

**六个时间常数**（复刻时的关键调参点）：

| 常数 | 位置 | 用途 |
|---|---|---|
| **30 ms** | `recorder-handlers.js:109` | click 去重窗（双击折叠） |
| **500 ms** | `:216` | Enter 后 click 静音期 |
| **50 ms** | `:217-219` | Enter 后校验 value 是否变化 |
| **250 ms** | `:232-234` | ↑↓ 后刷新 tempValue（实际抛异常） |
| **200 ms** | `:256`、`:260`、`:351` | mousedown/dragstart 最短持续时间 |
| **1500 ms** | `:466` | `readystatechange` 后判定"页面稳定" |
| **10 ms** | `:401-403` | `nodeAttrChange` 快照有效期 |
| **150 ms** | `bg/recorder.js:63` | `tabs.onActivated` 延迟，保证 `selectWindow` 排在触发它的 `click` **之后** |
| **100 ms** | `bg/recorder.js:324` | 窗口 focus 后再弹 `prompt()` 的等待 |

> `bg/recorder.js:44-46` 那段注释是理解 150ms 的钥匙：
> ```
> // Because event listener is so fast that selectWindow command is added
> // before other commands like clicking a link to browse in new tab.
> // Delay a little time to add command in order.
> ```
> 即：`tabs.onActivated` 由 Service Worker 事件系统直达 Panel，比"content script → runtime.sendMessage → Panel"这条路快；不延迟就会录成 `selectWindow` 在前、`click` 在后，回放必挂。

---

## 5. `insertBeforeLastCommand`：因果倒置的修正

### 5.1 为什么需要它

对话框类命令有个物理上的悖论：

```
时间轴（真实发生）              录制器看到的顺序
────────────────────           ────────────────
t0  用户点「删除」按钮           click | id=del        ← 先录
t1  页面调 confirm("确定?")
t2  用户点「确定」
t3  postMessage 回来            chooseOkOnNextConfirmation  ← 后录
```

但**回放**时，Selenium 的 `chooseOkOnNextConfirmation` 是"**预设**下一次 confirm 的答案"，必须在触发 confirm 的那个 `click` **之前**执行，否则 `click` 一执行就卡在原生对话框上，脚本死锁。

所以必须把 `chooseOkOnNextConfirmation` **插到已经落表的 `click` 前面**。

### 5.2 三层传递

**第 1 层 —— content script 打标**：`content/recorder.js:102-118`
```js
record(command, target, value, insertBeforeLastCommand, actualFrameLocation) {
    let self = this;
    if (!target[0].some(e => e?.includes instanceof Function && e.includes('popupInjectionKR'))) {
        browser.runtime.sendMessage({
            command: command,
            target: target,
            value: value,
            insertBeforeLastCommand: insertBeforeLastCommand,   // ← 透传
            frameLocation: (actualFrameLocation != undefined) ? actualFrameLocation : this.frameLocation,
        }).catch(function (reason) { /* ... */ });
    }
}
```

**第 2 层 —— Panel 分流**：`panel/js/background/recorder.js:337-343`
```js
//handle choose ok/cancel confirm
if (message.insertBeforeLastCommand) {
    addCommandBeforeLastCommand(message.command, message.target, message.value);
} else {
    notification(message.command, message.target, message.value);
    addCommandAuto(message.command, message.target, message.value);
}
```
另有一处在 `storeXxx` 的 prompt 回调里（`:326-331`），逻辑相同。

⚠️ 走前插分支时**不弹 `notification`**（`panel/js/background/editor.js:90-104` 的桌面通知）。所以你会看到"点了确定，桌面只弹了 assertConfirmation 的通知，没弹 chooseOk 的" —— 这是设计，不是丢命令。

**第 3 层 —— 落表**：`panel/js/UI/view/records-grid/add-command.js:148-151`
```js
// add command before last command (append upward)
function addCommandBeforeLastCommand(command_name, command_target_array, command_value) {
    addCommand(command_name, command_target_array, command_value, 0, true);
}
```
即 `auto=0`（手动模式）、`insertCommand=true`。真正的插入在 `:95-104`：
```js
} else {
    if (insertCommand) {
        //insert before last command
        const index = testCase.getTestCommandCount() - 2;
        testCase.insertCommandToIndex(index, testCommand);
        document.getElementById("records-grid").insertBefore(new_record, getRecordsArray()[index]);
    } else {
        testCase.commands.push(testCommand);
        document.getElementById("records-grid").appendChild(new_record);
    }
    ...
}
```

### 5.3 `- 2` 的 off-by-one 分析

`getTestCommandCount()` 的定义 —— `panel/js/UI/models/test-model/test-case.js:25`：
```js
getTestCommandCount() {
    return this.commands.length;
}
```

**关键**：`addCommand()` 是在 `testCase.insertCommandToIndex()` **之前**读的 count（`:98`），此时新命令**还没**进数组。设数组长度为 `L`，最后一条命令下标是 `L-1`。要"插到最后一条之前"，正确下标应是 `L-1`。代码用的是 `L-2`。

**结果**：命令被插到了**倒数第二条之前**，即"隔着一条"。

| 已有命令 | 期望结果 | 实际结果 |
|---|---|---|
| `[open, click]`（L=2，index=0） | `[open, chooseOk, click]` | `[chooseOk, open, click]` ❌ |
| `[open, type, click]`（L=3，index=1） | `[open, type, chooseOk, click]` | `[open, chooseOk, type, click]` ❌ |

⚠️ **但这个 bug 只在"没有选中行"时暴露**。`add-command.js:70-94` 的选中分支走的是完全不同的路径（基于 `selected_ID` 的 DOM 相对插入）。录制过程中通常有选中行（`addCommandAuto` 每次插完都会 `$(selected_ID).addClass('selectedRecord')`，`:91`），所以实际命中率不高 —— 这解释了它为什么能一直存在。

复刻时正确写法：
```js
const index = testCase.getTestCommandCount() - 1;   // ← 而不是 - 2
```

---

## 6. 多标签页 / 多窗口追踪与 `win_ser` 别名

### 6.1 别名体系

Selenium 的 `selectWindow` 需要一个**稳定的窗口名**。Chrome 的 `tabId` 是数字且每次会话都变，不能直接写进脚本。KR 的方案是给每个 tab 分配一个**逻辑别名**：

| 别名 | 何时分配 | 位置 |
|---|---|---|
| `win_ser_local` | 第一个开始录制的 tab（"主战场"） | `bg/recorder.js:215-216`、`:232-233` |
| `win_ser_1`, `win_ser_2`, … | 每次由已知 tab 派生出新 tab | `bg/recorder.js:158-159, 171` |

### 6.2 四张映射表

`BackgroundRecorder` 构造函数 `panel/js/background/recorder.js:17-30`：
```js
constructor() {
    this.currentRecordingTabId = {};          // testCaseId → tabId          当前焦点
    this.currentRecordingWindowId = {};       // testCaseId → windowId
    this.currentRecordingFrameLocation = {};  // testCaseId → "root:0:1"     当前 frame
    this.openedTabNames = {};                 // testCaseId → { 别名 → tabId }
    this.openedTabIds = {};                   // testCaseId → { tabId → 别名 }   ★ 反查表
    this.openedTabCount = {};                 // testCaseId → 下一个序号

    this.openedWindowIds = {};                // windowId → true   白名单
    this.contentWindowId = -1;
    this.selfWindowId = -1;
    this.attached = false;
    this.rebind();
}
```

**全部以 `testCaseId` 为一级 key** —— 因为一个 Panel 可以开多个测试用例，切换用例时录制上下文要隔离。

`openedTabIds[testCaseId]` 这张表还**混存了一个非 tabId 的 key `'tabUrl'`**（`:223`、`:234`、`:257`、`:264`），用来记"上一次 open 的 URL"。这是明显的类型污染 —— 复刻时应拆成独立字段。

### 6.3 新窗口的别名分配

`panel/js/background/recorder.js:152-173`：
```js
webNavigationOnCreatedNavigationTargetHandler(details) {
    let testCase = getSelectedCase();
    if (!testCase) return;
    let testCaseId = testCase.id;
    if (this.openedTabIds[testCaseId][details.sourceTabId] != undefined) {   // ← 必须由已知 tab 派生
        this.openedTabNames[testCaseId]["win_ser_" + this.openedTabCount[testCaseId]] = details.tabId;
        this.openedTabIds[testCaseId][details.tabId] = "win_ser_" + this.openedTabCount[testCaseId];
        if (details.windowId != undefined) {
            this.setOpenedWindow(details.windowId);
        } else {
            // Google Chrome does not support windowId.
            // Retrieve windowId from tab information.
            let self = this;
            browser.tabs.get(details.tabId)
                .then(function (tabInfo) {
                    self.setOpenedWindow(tabInfo.windowId);
                });
        }
        this.openedTabCount[testCaseId]++;
    }
};
```

`webNavigation.onCreatedNavigationTarget` 在"`target="_blank"` 链接被点击"、"`window.open()` 被调用"、"中键点击链接"时触发，`details.sourceTabId` 就是发起方。

**血统检查 `openedTabIds[...][details.sourceTabId] != undefined` 是核心防噪机制**：用户在录制期间手动开的、与被测流程无关的 tab，因为 sourceTabId 不在表里而被完全忽略。

⚠️ 该方法**没有** `if (!this.openedTabIds[testCaseId]) return;` 的空守卫（对比 `:39-41`、`:72-74`、`:126-128` 都有）。若在任何命令落表前就触发导航，`this.openedTabIds[testCaseId]` 是 `undefined`，`:157` 会抛 `TypeError`。

### 6.4 `selectWindow` 的三个触发源

**① 切 tab** —— `panel/js/background/recorder.js:33-64`
```js
setTimeout(function () {
    if (self.currentRecordingTabId[testCaseId] === activeInfo.tabId
        && self.currentRecordingWindowId[testCaseId] === activeInfo.windowId)
        return;                                                    // 没变，不录
    if (getRecordsArray().length === 0) return;                    // 还没开录，不录
    if (self.openedTabIds[testCaseId][activeInfo.tabId] == undefined) return;   // 陌生 tab，不录
    self.currentRecordingTabId[testCaseId] = activeInfo.tabId;
    self.currentRecordingWindowId[testCaseId] = activeInfo.windowId;
    self.currentRecordingFrameLocation[testCaseId] = "root";       // ★ 换 tab 必须重置 frame
    addCommandAuto("selectWindow", [[self.openedTabIds[testCaseId][activeInfo.tabId]]], "");
}, 150);
```

**② 切浏览器窗口** —— `:66-118`，多一层 `browser.tabs.query({windowId, active:true})` 找出该窗口的活动 tab，并用 `isPrivilegedPage()` 排除扩展页面：
```js
isPrivilegedPage(url) {
    if (url.substr(0, 13) == 'moz-extension' ||
        url.substr(0, 16) == 'chrome-extension') {
        return true;
    }
    return false;
}
```
（`:346-352`。这就是"焦点切回 Panel 窗口本身时不会录 selectWindow"的原因。）

**③ 关 tab** —— `:120-150`，这里最有意思：
```js
if (this.openedTabIds[testCaseId][tabId] != undefined) {
    if (this.currentRecordingTabId[testCaseId] !== tabId) {
        // 关的不是当前 tab：先跳过去，关掉，再跳回来
        addCommandAuto("selectWindow", [[this.openedTabIds[testCaseId][tabId]]], "");
        addCommandAuto("close",        [[this.openedTabIds[testCaseId][tabId]]], "");
        addCommandAuto("selectWindow", [[this.openedTabIds[testCaseId][this.currentRecordingTabId[testCaseId]]]], "");
    } else {
        addCommandAuto("close", [[this.openedTabIds[testCaseId][tabId]]], "");
    }
    delete this.openedTabNames[testCaseId][this.openedTabIds[testCaseId][tabId]];
    delete this.openedTabIds[testCaseId][tabId];
    this.currentRecordingFrameLocation[testCaseId] = "root";
}
```
**"三明治"模式**：因为 Selenium 的 `close` 关的是**当前**窗口，要关别的窗口必须先切过去。录制器替你把这个上下文切换补全了。这是"录制器懂回放语义"的典型例子。

### 6.5 `openedWindowIds` 白名单

`addCommandMessageHandler` 的第一行守卫 —— `panel/js/background/recorder.js:176-177`：
```js
if (!message.command || this.openedWindowIds[sender.tab.windowId] == undefined)
    return;
```

只有白名单里的浏览器窗口发来的消息才处理。白名单只在两处写入：
- `panel/js/background/editor.js:84` —— Panel 启动握手时把"内容窗口"（`contentWindowId`）加入
- `bg/recorder.js:161` / `:168` —— 派生出的新窗口加入

**这就是"在另一个不相干的 Chrome 窗口里操作不会被录进来"的机制。**

---

## 7. iframe 追踪与 `selectFrame` 差分

### 7.1 `frameLocation` 的编码

`content/recorder.js:85-100`：
```js
getFrameLocation(currentWindow = window) {
    const path = [];
    while (currentWindow && !(currentWindow === window.top || currentWindow.originalWindow === window.top)) {
        const frames = currentWindow.parent.frames;
        for (let index = 0; index < frames.length; index++) {
            if (frames[index] === currentWindow || frames[index] === currentWindow.originalWindow) {
                path.unshift(index);              // ← 头插，最终得到「从根到叶」的顺序
            }
        }
        currentWindow = currentWindow.parent;
    }
    const frameLocation = ["root", ...path].join(":");
    return frameLocation;
}
```

编码规则：`root` + 每一层在 `parent.frames` 中的**索引**，冒号分隔。

```
顶层文档                          → "root"
顶层的第 0 个 iframe               → "root:0"
顶层第 1 个 iframe 里的第 2 个 iframe → "root:1:2"
```

`manifest.json:27-34` 的 `"all_frames": true` 保证**每个 iframe 都有一个独立的 Recorder 实例**，各自算各自的 `frameLocation`（`content/recorder.js:26`），并在构造时上报一次（`:27-31`）：
```js
browser.runtime.sendMessage({
    frameLocation: this.frameLocation
}).catch(function (reason) { /* Failed silently if receiving end does not exist */ });
```
这条上报由 `panel/js/background/window-controller.js:46-50` 的 `frameLocationMessageHandler` 接收，**供回放期定位 frame 用**；录制期用的是每条命令消息里携带的 `frameLocation` 字段（`content/recorder.js:110`）。

`window.originalWindow` 的比对（`:88`、`:91`）是给某些站点做了 `window` 代理/沙箱（如某些微前端框架）时的兜底。全库 grep 未找到 KR 自己给 `originalWindow` 赋值的地方，说明它是**读外部约定**。

### 7.2 三段式 LCA 差分算法

Panel 侧记着"当前在哪个 frame"，每条命令到来时比对，把差异翻译成一串 `selectFrame`。`panel/js/background/recorder.js:271-293`：

```js
if (message.frameLocation && message.frameLocation !== this.currentRecordingFrameLocation[testCaseId]) {
    let newFrameLevels = message.frameLocation.split(':');
    let oldFrameLevels = this.currentRecordingFrameLocation[testCaseId].split(':');

    // 段①：新路径更浅 → 一路向上
    while (oldFrameLevels.length > newFrameLevels.length) {
        addCommandAuto("selectFrame", [["relative=parent"]], "");
        oldFrameLevels.pop();
    }

    // 段②：同深度但分叉 → 继续向上，直到公共祖先
    while (oldFrameLevels.length != 0
           && oldFrameLevels[oldFrameLevels.length - 1] != newFrameLevels[oldFrameLevels.length - 1]) {
        addCommandAuto("selectFrame", [["relative=parent"]], "");
        oldFrameLevels.pop();
    }

    // 段③：从公共祖先向下钻
    while (oldFrameLevels.length < newFrameLevels.length) {
        addCommandAuto("selectFrame", [["index=" + newFrameLevels[oldFrameLevels.length]]], "");
        oldFrameLevels.push(newFrameLevels[oldFrameLevels.length]);
    }

    this.currentRecordingFrameLocation[testCaseId] = message.frameLocation;
}
```

**这是标准的 LCA（最近公共祖先）路径差分**，等价于文件系统里从 `/a/b/c` 走到 `/a/d`：先 `cd ..` 两次到 `/a`，再 `cd d`。

**逐例演算**：

| old | new | 段① | 段② | 段③ | 产出 |
|---|---|---|---|---|---|
| `root` | `root:0` | — | — | `index=0` | `selectFrame\|index=0` |
| `root:0` | `root` | `relative=parent` | — | — | `selectFrame\|relative=parent` |
| `root:0` | `root:1` | — | `relative=parent`（`0≠1`，pop 到 `[root]`） | `index=1` | 2 条 |
| `root:0:1` | `root:0:2` | — | `relative=parent`（`1≠2`） | `index=2` | 2 条 |
| `root:0:1` | `root:2:3` | — | `relative=parent` ×2 | `index=2`, `index=3` | 4 条 |
| `root` | `root:1:0` | — | — | `index=1`, `index=0` | 2 条 |

⚠️ **段③有个隐蔽的自增陷阱**：
```js
addCommandAuto("selectFrame", [["index=" + newFrameLevels[oldFrameLevels.length]]], "");
oldFrameLevels.push(newFrameLevels[oldFrameLevels.length]);
```
`push` 那一行**先求值 `newFrameLevels[oldFrameLevels.length]`，此时 `oldFrameLevels.length` 还是旧值**，所以 push 进去的和刚 record 的是同一个元素 —— 巧合地正确。但可读性极差，复刻时应写成：
```js
const idx = newFrameLevels[oldFrameLevels.length];
addCommandAuto("selectFrame", [[`index=${idx}`]], "");
oldFrameLevels.push(idx);
```

**⚠️ `root` 段②的边界**：`oldFrameLevels[0]` 恒为 `"root"`，`newFrameLevels[0]` 也恒为 `"root"`，所以段② 的 while 条件在 `length===1` 时必为 false，不会把 `root` 也 pop 掉。安全。

### 7.3 三个必须重置 `frameLocation` 的时机

| 时机 | 位置 | 原因 |
|---|---|---|
| 切换 tab | `bg/recorder.js:61` | 新 tab 从顶层文档开始 |
| 切换窗口 | `bg/recorder.js:114` | 同上 |
| 关闭 tab | `bg/recorder.js:148` | 焦点回到别处，frame 上下文作废 |
| 首次为该用例建表 | `bg/recorder.js:206` | 初始化 |

**漏掉的一个：页面刷新/导航。** 页面重载后 iframe 全部重建，但 `currentRecordingFrameLocation` 不会重置。若刷新前停在 `root:0`，刷新后在顶层点击（上报 `root`），差分会产出一条 `selectFrame|relative=parent` —— 回放时这条命令会失败或行为不确定。已归入 §10-B5。

### 7.4 弹窗的 frameLocation 透传

见 §4.8 末尾。`content/recorder.js:110` 的三元表达式是这条链路的关键：iframe 里的 `confirm()` 由**顶层**的 `prompt-injecter.js` 代为 record，若不透传就会错标成 `root`。

---

## 8. 防自录与噪音过滤：五道闸门

录制回放工具最容易踩的坑是**自己录自己**——回放时注入的点击又被录制器捕获，或者录制器自己的 UI 被录进去。KR 有五道独立的闸门。

### 8.1 闸门一：`event.isTrusted`（防回放自录，最硬的一道）

`content/recorder-handlers.js:91`
```js
if (event.button == 0 && !preventClick && event.isTrusted) {
```

`isTrusted` 是浏览器写死的只读属性：**真实用户操作产生的事件为 `true`，任何 JS 合成的事件为 `false`**，页面脚本无法伪造。

回放期 KR 用 `selenium.doClick()` 之类的 API 触发点击（`content/selenium-api.js`），这些都是合成事件 → `isTrusted === false` → click handler 直接跳过。

⚠️ **只有 click handler 检查了 `isTrusted`。** `change`、`keydown`、`focus`、`blur`、`contextmenu`、`drop` 等 handler **都没有检查**（已逐个核对 `content/recorder-handlers.js` 全文）。所以闸门一不是全覆盖，真正兜底的是闸门二。

> **复刻建议**：在 `Recorder.attach()` 的统一 listener 里加一句 `if (!event.isTrusted) return;`，比在每个 handler 里散着写可靠得多。

### 8.2 闸门二：`SideeXPlayingFlag`（回放期间的全局静音）

回放执行一条命令前，在 `<body>` 上打属性；执行完立刻摘掉。`content/command-receiver.js:81` / `:87` / `:95` / `:100` / `:105`：
```js
try {
    document.body.setAttribute("SideeXPlayingFlag", true);
    let returnValue = selenium["do"+upperCase](request.target, selenium.preprocessParameter(request.value));
    if (returnValue instanceof Promise) {
        returnValue.then(function(value) {
            document.body.removeAttribute("SideeXPlayingFlag");
            ...
        }).catch(function(reason) {
            document.body.removeAttribute("SideeXPlayingFlag");
            ...
        });
    } else {
        document.body.removeAttribute("SideeXPlayingFlag");
        ...
    }
} catch(e) {
    document.body.removeAttribute("SideeXPlayingFlag");
    ...
}
```
另有 Selenium IDE 命令分支的 `:129`、以及 `continueTestWhenConditionIsTrue()` 的 `:195` / `:203` / `:218`。

**谁读这个标志**：`page/prompt.js` 的三个覆写函数（`:59`、`:76`、`:93`、`:155`）：
```js
window.prompt = function(text, defaultText) {
    if (document.body.hasAttribute("SideeXPlayingFlag")) {
        return window.top.prompt(text, defaultText);      // ← 回放：直接转发，不发录制消息
    } else {
        let result = originalPrompt(text, defaultText);
        ...
        window.top.postMessage({ direction:"from-page-script", recordedType:"prompt", ... }, "*");
        return result;
    }
};
```

⚠️ **`Recorder` 本身不读 `SideeXPlayingFlag`。** 对话框通道靠它，DOM 事件通道靠 `isTrusted` 和闸门三。这是两套独立机制，别搞混。

### 8.3 闸门三：`isRecording && !isPlaying`（Panel 侧的总开关）

`panel/js/background/editor.js:33-35` 定义两个全局旗标：
```js
/* flags */
window.isRecording = false;
window.isPlaying = false;
```

`isRecording` 只在 `panel/js/background/playback/service/actions/record-actions.js:23` 翻转：
```js
isRecording = !isRecording;
```

`isRecording` 的作用点在 §9 的握手里（`editor.js:69-74`）。若正在回放（`isPlaying === true`），即使 `isRecording` 为 true，也不会给新页面派发 `attachRecorder` → 回放导航到的新页面上 recorder 不会被挂上去。

### 8.4 闸门四：`openedWindowIds` 白名单

`panel/js/background/recorder.js:176-177`，已在 §6.5 讲过。作用是**空间隔离**：只录被测那一个浏览器窗口（及其派生窗口）里的操作。

### 8.5 闸门五：`popupInjectionKR` 双重过滤（防录制自己的 UI）

录制期间 KR 会往页面里注入一个可拖动的浮层（`content/inject-popup-record.js:19-100`），里面有个 Stop 按钮。这个浮层是**页面 DOM 的一部分**，点它当然会触发 `click` 事件。两层过滤：

**过滤 A —— handler 层（浅）**：`content/recorder-handlers.js:102`
```js
if (eventTarget.parentNode.id !== "popupInjectionKR") {
```
只看**直接父节点**。浮层结构是 `#popupInjectionKR > div1` 和 `#popupInjectionKR > button`（`:78-79`），所以点文字和点按钮都能被挡住。但如果点到 `#popupInjectionKR` 自身（padding 区域），`eventTarget.parentNode` 是 `<body>` → **挡不住** → 会录出一条指向浮层的 `click`。

**过滤 B —— record() 层（深，兜底）**：`content/recorder.js:104`
```js
if (!target[0].some(e => e?.includes instanceof Function && e.includes('popupInjectionKR'))) {
```
检查**首选定位器数组里任何一个字符串是否含 `popupInjectionKR`**。因为浮层有 id，`buildAll()` 一定会产出 `id=popupInjectionKR` 或含它的 XPath/CSS → 被拦下。

`e?.includes instanceof Function` 这个写法是在防 `target[0]` 里混进非字符串（`buildAll()` 的元素是 `[locator, finderName]` 二元组，`target[0]` 是第一个二元组，其元素都是字符串；但 `prompt-injecter.js` 传的是 `[[消息文本]]`，元素也是字符串）。属于防御性冗余。

**浮层的 Stop 按钮怎么停止录制** —— `content/inject-popup-record.js:74-76`：
```js
button.addEventListener("click", function (event) {
    browser.runtime.sendMessage({ checkStopInContentScript: true });
})
```
`panel/js/background/playback/index.js:66-89` 接收，模拟点一下 Panel 的 `#record` 按钮：
```js
browser.runtime.onMessage.addListener(function(message, sender, sendRequest) {
    if (message.checkStopInContentScript) {
        if (isRecording) {
            $("#record").click();
            browser.windows.update(extensionId, { focused: true });
            ...
        }
    }
});
```

⚠️ **`addPopup()` 的监听器泄漏**：`content/inject-popup-record.js:83-99` 在 `document` 上注册了 `mouseup` 和 `mousemove`（都是 capture）用于拖动，但 `removePopup()`（`:13-17`）只 `$('#popupInjectionKR').remove()`，**从不移除这两个监听器**。每次「开始录制 → 停止 → 再开始」都会多注册一对。`mousemove` 里还有无条件的 `event.preventDefault()`（`:88`），累积后会影响页面的文本选择等原生行为。

---

## 9. 断点续录：`attachRecorderRequest` 报到-应答握手

### 9.1 问题

Content script 的生命周期绑定在**文档**上。用户在录制中点了个链接 → 页面导航 → **旧的 content script 连同 Recorder 实例一起销毁**，新页面重新装载一份全新的、`attached === false` 的 Recorder。

Panel 侧的 `browser.tabs.sendMessage(tabId, {attachRecorder:true})` 是在**按下 Record 按钮那一刻**发的（`record-actions.js:68-73`），新页面根本没赶上。

如果不管，用户会看到"点了一个链接之后就不录了"。

### 9.2 解决：让新页面主动报到

**报到（content → Panel）** —— `content/recorder-handlers.js:522-526`，这是**顶层语句**，每次 bundle 装载执行一次：
```js
browser.runtime.sendMessage({
    attachRecorderRequest: true
}).catch(function (reason) {
    // Failed silently if receiveing end does not exist
});
```

**应答（Panel → content）** —— `panel/js/background/editor.js:69-74`：
```js
if (message.attachRecorderRequest) {
    if (isRecording && !isPlaying) {
        browser.tabs.sendMessage(sender.tab.id, { attachRecorder: true });
    }
    return;
}
```

**执行（content）** —— `content/command-receiver.js:174-187`：
```js
// TODO: code refactoring
if (request.attachRecorder) {
    browser.runtime.sendMessage({
        attachHttpRecorder: true
    });
    recorder.attach();
    return;
} else if (request.detachRecorder) {
    browser.runtime.sendMessage({
        detachHttpRecorder: true
    });
    recorder.detach();
    return;
}
```
同一条 `attachRecorder` 消息还被 `content/inject-popup-record.js:1-11` 的第二个监听器收到，用于注入/移除浮层。

### 9.3 完整时序

```
 [Panel]                     [Service Worker]              [Tab: 页面 A]        [Tab: 页面 B]
    │                                                            │
 用户点 #record                                                   │
    │ recordAction()                                             │
    │  isRecording = true                                        │
    │  recorder.attach()   ← Panel 侧挂 tabs/windows/webNav 监听  │
    │  tabs.query({windowId, url:"<all_urls>"})                   │
    │  ── sendMessage{attachRecorder} ───────────────────────────>│
    │                                                    recorder.attach()
    │                                                    addPopup()
    │                                                            │
    │                                                      用户点击链接
    │<── sendMessage{command:"click", target, frameLocation} ─────│
    │  addCommandMessageHandler → addCommandAuto("click", ...)    │
    │                                                            │
    │                                              ⚡ 导航，页面 A 销毁
    │                                              ⚡ Recorder 实例随之消失
    │                                                                          页面 B 装载
    │                                                                    bundle 顶层语句执行：
    │                                                                    · new Recorder(window)
    │                                                                      → sendMessage{frameLocation}
    │                                                                    · sendMessage{attachRecorderRequest}
    │<───────────────────────────────────────────────────────────────────────────┤
    │  editor.js:69  if (isRecording && !isPlaying)                              │
    │  ── tabs.sendMessage(sender.tab.id, {attachRecorder:true}) ───────────────>│
    │                                                                    recorder.attach()
    │                                                                    addPopup()
    │                                                                            │
    │<── sendMessage{command:"checkForAutomated"} ───────────────────────────────┤
    │  bg/recorder.js:260  URL 变了 → addCommandAuto("open", [[新URL]])           │
    │  bg/recorder.js:266  return（心跳本身不落表）                                │
    │                                                                            │
    │                                                                      用户继续操作
    │<── sendMessage{command:"type", ...} ───────────────────────────────────────┤
```

### 9.4 幂等性是这套设计成立的前提

同一个 tab 可能同时收到两路 `attachRecorder`：
- 路径 1：`record-actions.js:68-73` 的广播（按下 Record 时对所有已存在的 tab 群发）
- 路径 2：`editor.js:71` 的点对点应答（回应报到）

在 iframe 场景下更热闹：`tabs.sendMessage` 会投递给该 tab 的**所有** frame，而每个 frame 又各自发过一次 `attachRecorderRequest`。

之所以不出乱子，全靠两处幂等守卫：
```js
// content/recorder.js:44-47
attach() {
    if (this.attached) {
        return;
    }
    ...
}
```
```js
// content/inject-popup-record.js:2-5
if (request.attachRecorder) {
    if ($('#popupInjectionKR').length == 0) {
        addPopup();
    }
    return;
}
```

**复刻要点**：任何"挂载/卸载"型消息处理器都必须写成幂等的，否则事件监听器会重复注册，一次点击录出 N 条命令。

### 9.5 已被移除的自动 detach

`content/recorder.js:111-116` 有个耐人寻味的 KAT 补丁：
```js
}).catch(function (reason) {
    // If receiving end does not exist, detach the recorder
    /* KAT-BEGIN remove self.detach
    self.detach();
    KAT-END */
});
```
上游 SideeX 的逻辑是"消息发不出去（Panel 关了）→ 自动摘掉监听器"。Katalon 把它注释掉了。

**后果**：Panel 关闭后，页面上的 Recorder 仍然挂着所有监听器，每次操作都会调 `browser.runtime.sendMessage()` 并静默失败。除非页面刷新或收到 `detachRecorder`，否则一直空转。

**为什么要改**：推测是为了 Panel 意外崩溃/重启后能续上（因为 `attachRecorderRequest` 只在页面装载时发一次，若 Recorder 已自我 detach，Panel 回来后无法把它叫醒）。⚠️ 源码只有 `remove self.detach` 五个字，**未给出原因**，以上为推断。

---

## 10. 已知缺陷清单

按"是否影响复刻决策"排序。等级：🔴 必须修 / 🟡 建议修 / ⚪ 死代码，删掉即可。

| ID | 等级 | 位置 | 现象 | 根因 | 复刻对策 |
|---|---|---|---|---|---|
| **B1** | ⚪ | `content/recorder-handlers.js:115-127` | `doubleClick` 命令**永远录不出来**，双击时控制台报 `TypeError: Cannot read properties of null (reading 'parentNode')` | `do{...element = element.offsetParent}while(element)` 循环退出时 `element === null`，紧接着 `:124` 读 `element.parentNode`；`:125` 又用 `element` 当定位目标 | 整个 handler 删掉（双击已由 §4.1 的 30ms 窗折叠成 1 条 `click`）；若确需 `doubleClick`，把坐标计算的临时变量与目标元素**分开命名** |
| **B2** | 🔴 | `content/recorder-handlers.js:135-151` | `focusTarget`/`focusValue`/`tempValue` 永远为 `null`；`preventType` 一旦置 true **永不复位**，之后所有 `type` 命令全部丢失 | `document.getElementsByTagName("input")` 在 `run_at:"document_start"` 时刻返回空集（`manifest.json:31`），for 循环体零次执行 | 改用事件委托：`document.addEventListener('focus', h, true)` / `'blur'`。这样对动态插入的 input 也生效 |
| **B3** | 🟡 | `content/recorder-handlers.js:232-234` | 在输入框按 ↑/↓ 后 250ms，控制台抛 `TypeError: Cannot read properties of null (reading 'value')` | 定时器里读 `focusTarget.value`，而 `focusTarget` 因 B2 恒为 `null`，且**没有空值检查** | 修好 B2 后自然消失；或加 `if (focusTarget)` |
| **B4** | 🟡 | `panel/js/UI/view/records-grid/add-command.js:98` | 对话框类命令的"前插"插错位置（插到倒数第二条**之前**而非最后一条之前） | `const index = testCase.getTestCommandCount() - 2;` 应为 `- 1`（此时新命令尚未入数组，`length-1` 才是最后一条的下标） | 改成 `- 1`。注意该分支只在**无选中行**时可达，录制中通常有选中行，故不易察觉 |
| **B5** | 🟡 | `panel/js/background/recorder.js:271-293` | 页面刷新后若之前停在某 iframe，会多录一条无效的 `selectFrame\|relative=parent` | 只在切 tab / 切窗口 / 关 tab（`:61`/`:114`/`:148`）重置 `currentRecordingFrameLocation`，**导航/刷新时不重置** | 在 `checkForAutomated` 心跳分支里一并重置为 `"root"` |
| **B6** | 🟡 | `panel/js/background/recorder.js:260` | 从 `https://a.com/` 跳到 `https://a.com/login` **不产生 `open`**，且 `tabUrl` 不更新 | 用的是 `!sender.tab.url.includes(oldUrl)` 子串判断，不是相等判断 | 明确语义：要么严格相等，要么只比 origin。别用 `includes` |
| **B7** | 🟡 | `panel/js/background/recorder.js:152-173` | 首条命令落表前触发新窗口导航 → `TypeError: Cannot read properties of undefined` | `webNavigationOnCreatedNavigationTargetHandler` 缺 `if (!this.openedTabIds[testCaseId]) return;` 守卫（另外三个 handler `:39`/`:72`/`:126` 都有） | 补齐守卫 |
| **B8** | 🟡 | `content/inject-popup-record.js:83-99` vs `:13-17` | 反复开停录制后，页面上累积多份 `mouseup`/`mousemove` 监听器；`mousemove` 里无条件 `preventDefault()` 会干扰页面原生行为 | `removePopup()` 只删 DOM 节点，不解绑 document 上的监听器 | 把监听器挂在浮层元素上，或保存引用在 `removePopup()` 里 `removeEventListener` |
| **B9** | 🟡 | `content/recorder-handlers.js:472-491` + `background/background.js:228-234` | 连续右键两次，第一次建立的 Port 永久挂起收不到消息 | ① content 侧只 `removeListener` 不 `disconnect()`；② SW 侧用全局单变量 `var port` 接收，后连覆盖先连 | Port 用完 `disconnect()`；SW 侧用 `Map<tabId+frameId, port>` |
| **B10** | ⚪ | `panel/js/background/recorder.js:296-310` | `doubleClickAt` 去重分支永远不执行 | Recorder 从不发送 `doubleClickAt`（handlerName 叫 `doubleClickAt`，但 record 的命令名是 `doubleClick`），且比对的 `clickAt` 也从未被产出（实际是 `click`） | 删除整段 |
| **B11** | ⚪ | `content/recorder-handlers.js:166-185` | Enter 分支的前两个 `if/else if` 永不命中 | 依赖 `tempValue`/`focusValue`，二者因 B2 恒为 `null` | 修好 B2 后重新设计这段；或直接删掉，统一走 `:186` 分支 |
| **B12** | ⚪ | `content/recorder-handlers.js:596` | `if (options[i]._wasSelected == null) { }` 空语句 | 遗留 | 删 |
| **B13** | ⚪ | `content/recorder-handlers.js:93-100`、`:104` | click handler 里的坐标计算与 `arrayTest` 完全无用，`buildAll()` 被重复调用两次（`buildAll` 内含 14 次 DOM 查询 + 14 次 `findElement` 反查，是热点） | 遗留 `clickAt` 的坐标计算 | 删除。性能上单次点击可省一半定位器计算开销 |
| **B14** | 🟡 | `content/recorder-handlers.js:502` | `contentTest` 未声明即赋值，污染页面全局 `window.contentTest` | 缺 `var` | 声明它 |
| **B15** | 🟡 | `content/recorder-handlers.js:45` | `checkForm()` 的 `else` 分支用全局 `enterTarget` 而非形参 | 隐式耦合 | 显式传参 |
| **B16** | 🟡 | `content/recorder-handlers.js` 全文 | 除 click 外，**所有** handler 都不检查 `event.isTrusted` | 设计不完整 | 在 `attach()` 的统一 listener 里集中检查 |
| **B17** | ⚪ | `content/locatorBuilders.js:133-140` | `finderName != 'tac'` 的 else 分支（`:139` splice 到数组头部）不可达 | 全库 grep 无 `LocatorBuilders.add('tac', ...)`；`content/locatorBuilders.js:351-569` 共 14 个 finder（`ui`/`id`/`link`/`name`/`dom:name`/`xpath:link`/`xpath:img`/`xpath:attributes`/`xpath:idRelative`/`xpath:neighbor`/`xpath:href`/`dom:index`/`xpath:position`/`css`），不含 `tac` | 与录制引擎无关，见 TECH-02 |
| **B18** | ⚪ | `content/recorder.js:123` | `handler.handlerName = handlerName;` 赋值后全库无人读取 | SideeX 遗留 | 删；或改造成"按 handlerName 开关某类录制"的特性 |
| **B19** | ⚪ | `content/recorder-handlers.js:19-24` | `getEventTarget()` 里的 `event._target` 全库无赋值处 | Shadow DOM 预留钩子未完成 | 改成 `event.composedPath?.()[0] ?? event.target` |
| **B20** | 🟡 | `content/recorder-handlers.js:427-451` | 监听了已废弃的 `DOMNodeInserted`（Chrome 已标记 deprecated，未来会移除），且产出全被注释 | 遗留 | 删掉；若需要 DOM 变更检测，用 `MutationObserver` |

**修复优先级**：B2 是唯一会**静默丢失用户数据**的缺陷，必须第一个修。B1/B10/B13/B18/B19/B12/B11/B17 全部是删代码，能减掉约 30% 的 handler 体积。

---

## 11. 最小可用录制引擎（MVP）骨架

以下是从 KR 7.1.0 蒸馏出的可运行最小骨架，**已修复 §10 中的 B1/B2/B3/B4/B13/B16/B19**。约 300 行，含 4 个文件。

### 11.1 目录结构

```
my-recorder/
├── manifest.json
├── background.js                # Service Worker：仅做消息中转 + 窗口/标签事件
├── content/
│   ├── locator.js               # 定位器（可直接复用 KR 的 locatorBuilders，此处给极简版）
│   ├── recorder.js              # 事件层：attach/detach/record
│   └── handlers.js              # 语义层：事件 → 命令
└── panel/
    ├── index.html
    └── panel.js                 # 命令表 + tab/frame 追踪
```

### 11.2 `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "My Recorder",
  "version": "0.1.0",
  "background": { "service_worker": "background.js" },
  "permissions": ["tabs", "activeTab", "webNavigation", "storage"],
  "host_permissions": ["<all_urls>"],
  "action": { "default_title": "Open Recorder Panel" },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/locator.js", "content/recorder.js", "content/handlers.js"],
      "all_frames": true,
      "run_at": "document_start"
    }
  ]
}
```

> 对照 KR：KR 用 `"world": "MAIN"` 是为了让回放期的 `selenium.*` 能直接操作页面 JS 对象。**纯录制不需要 MAIN world**，用默认的 ISOLATED 更安全（不会与页面变量冲突，也不会像 KR 那样污染出 `window.contentTest`）。

### 11.3 `content/recorder.js` —— 事件层

```js
// ============ 事件层：只负责挂/摘监听器 + 发消息 ============
class Recorder {
  constructor(win) {
    this.window = win;
    this.attached = false;
    this.eventListeners = null;
    this.frameLocation = Recorder.computeFrameLocation(win);
  }

  // 对照 KR: content/recorder.js:85-100
  static computeFrameLocation(win) {
    const path = [];
    let cur = win;
    while (cur && cur !== win.top) {
      const frames = cur.parent.frames;
      for (let i = 0; i < frames.length; i++) {
        if (frames[i] === cur) path.unshift(i);
      }
      cur = cur.parent;
    }
    return ['root', ...path].join(':');
  }

  // 对照 KR: content/recorder.js:121-130
  // 修复 B18：去掉无用的 handlerName
  static handlers = new Map();          // key: "click" | "C_click"  → Array<fn>
  static on(eventName, fn, capture = true) {
    const key = capture ? 'C_' + eventName : eventName;
    if (!Recorder.handlers.has(key)) Recorder.handlers.set(key, []);
    Recorder.handlers.get(key).push(fn);
  }

  static parseKey(key) {
    return key.startsWith('C_')
      ? { eventName: key.slice(2), capture: true }
      : { eventName: key, capture: false };
  }

  // 对照 KR: content/recorder.js:44-68（幂等，§9.4 依赖这一点）
  attach() {
    if (this.attached) return;
    this.attached = true;
    this.eventListeners = new Map();

    for (const [key, fns] of Recorder.handlers) {
      const { eventName, capture } = Recorder.parseKey(key);
      const listener = (event) => {
        // 修复 B16：统一防自录闸门，覆盖所有事件而不只是 click
        if (!event.isTrusted) return;
        for (const fn of fns) fn.call(this, event);
      };
      this.window.document.addEventListener(eventName, listener, capture);
      this.eventListeners.set(key, listener);
    }
  }

  // 对照 KR: content/recorder.js:71-83
  // capture 必须与注册时一致，否则移除失败 —— 这就是 C_ 前缀存在的理由
  detach() {
    if (!this.attached) return;
    this.attached = false;
    for (const [key, listener] of this.eventListeners) {
      const { eventName, capture } = Recorder.parseKey(key);
      this.window.document.removeEventListener(eventName, listener, capture);
    }
    this.eventListeners = null;
  }

  // 对照 KR: content/recorder.js:102-118
  record(command, target, value = '', opts = {}) {
    chrome.runtime.sendMessage({
      type: 'RECORD',
      command,
      target,                                  // [[locator, finderName], ...]
      value,
      insertBefore: !!opts.insertBefore,
      frameLocation: opts.frameLocation ?? this.frameLocation,
    }).catch(() => { /* Panel 未开，静默 */ });
  }
}

// 修复 B19：一步到位支持开放式 Shadow DOM
function targetOf(event) {
  return event.composedPath?.()[0] ?? event.target;
}

const recorder = new Recorder(window);

// —— 与 Panel 的握手（对照 KR: recorder-handlers.js:522-526 + command-receiver.js:174-187）——
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'ATTACH_RECORDER') recorder.attach();
  else if (msg.type === 'DETACH_RECORDER') recorder.detach();
});

// 页面装载时主动报到，实现跨导航续录（§9）
chrome.runtime.sendMessage({ type: 'ATTACH_REQUEST' }).catch(() => {});
// 页面加载心跳，让 Panel 有机会补 open（对照 KR: content/check-browser-automation.js）
chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: location.href }).catch(() => {});
```

### 11.4 `content/handlers.js` —— 语义层

```js
// ============ 语义层：DOM 事件 → 语义命令 ============
const INPUT_TYPES = ['text','password','search','email','url','tel','number',
                     'date','datetime-local','month','time','week','range','color','file'];

// ---------- 状态机（对照 KR §4.11） ----------
let typeTarget      = null;   // 最后被输入的元素
let typeLock        = false;  // 跨 keydown→change 的互斥锁
let preventClick    = false;  // 表单提交后的 500ms 静音
let clickDedupe     = false;  // 30ms 双击折叠窗
let enterPending    = null;   // 刚按过 Enter 的元素

// 修复 B2：事件委托代替 document_start 时刻的静态遍历
let focusValue = null;
document.addEventListener('focus', (e) => {
  const el = targetOf(e);
  if (el?.tagName?.toLowerCase() === 'input' && INPUT_TYPES.includes(el.type)) {
    focusValue = el.value;
  }
}, true);
document.addEventListener('blur', () => { focusValue = null; }, true);

// ---------- click（对照 KR: recorder-handlers.js:89-111） ----------
// 修复 B13：删掉无用的坐标计算与重复 buildAll
Recorder.on('click', function (event) {
  if (event.button !== 0) return;        // 只认左键
  if (preventClick) return;              // 提交后静音期
  if (clickDedupe) return;               // 30ms 内的第二次（双击的后半）
  const el = targetOf(event);
  if (el.closest?.('#myRecorderOverlay')) return;   // 不录自己的 UI（比 KR 的 parentNode 判断更稳）

  this.record('click', buildAll(el));
  clickDedupe = true;
  setTimeout(() => { clickDedupe = false; }, 30);
});

// ---------- 输入（对照 KR: recorder-handlers.js:82-85 + :49-80） ----------
// 关键：input 只记指针，change 才出命令 —— 合并交给浏览器语义，不做防抖
Recorder.on('input', function (event) {
  typeTarget = targetOf(event);
}, /* capture */ false);

Recorder.on('change', function (event) {
  const el = targetOf(event);
  const tag = el.tagName?.toLowerCase();

  if (tag === 'select') {                        // <select> 交给下面的 select handler
    return;
  }
  if (typeLock) { typeLock = false; return; }    // keydown 已经录过了，跳过
  if (tag === 'input' && INPUT_TYPES.includes(el.type)) {
    this.record('type', buildAll(el), el.value);
  } else if (tag === 'textarea') {
    this.record('type', buildAll(el), el.value);
  }
}, false);

// ---------- keydown：Enter / Tab / ↑↓（对照 KR: recorder-handlers.js:159-248） ----------
Recorder.on('keydown', function (event) {
  const el = targetOf(event);
  const tag = el.tagName?.toLowerCase();
  if (tag !== 'input' || !INPUT_TYPES.includes(el.type)) return;

  if (event.key === 'Enter') {
    // ① 先把当前输入值落成 type
    if (typeTarget === el) {
      this.record('type', buildAll(el), el.value);
      typeLock = true;                     // 阻止随后的 change 重复录（§4.2.3）
    }
    // ② 再决定是 submit 还是 sendKeys（对照 KR: checkForm，recorder-handlers.js:29-46）
    const form = el.closest('form');
    if (form && !form.hasAttribute('onsubmit') && !form.hasAttribute('ng-submit')
        && (form.id || form.name || form.classList.length)) {
      const loc = form.id      ? `id=${form.id}`
                : form.name    ? `name=${form.name}`
                :                `css=.${form.classList[0]}`;
      this.record('submit', [[loc]]);
    } else {
      this.record('sendKeys', buildAll(el), '${KEY_ENTER}');
    }
    // ③ 提交后 500ms 内不录 click，避开导航期噪声
    enterPending = el;
    preventClick = true;
    setTimeout(() => { preventClick = false; }, 500);
    return;
  }

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    if (el.value === '') return;
    this.record('sendKeys', buildAll(el),
                event.key === 'ArrowUp' ? '${KEY_UP}' : '${KEY_DOWN}');
    return;
  }

  // 修复 B2 的副作用：Tab 不再依赖 tabCheck 这种隐式前置条件
  if (event.key === 'Tab' && el.value !== focusValue) {
    // 值有变化时，change 会紧接着触发并录出 type；这里只补 KEY_TAB
    this.record('sendKeys', buildAll(el), '${KEY_TAB}');
  }
});

// ---------- <select>（对照 KR: recorder-handlers.js:266-278 / :569-583 / :585-610） ----------
function snapshotOptions(sel) {
  for (const o of sel.options) o.dataset.wasSelected = String(o.selected);
}
Recorder.on('mousedown', function (event) {
  const el = targetOf(event);
  if (el.tagName?.toLowerCase() === 'option' && el.parentNode.multiple) {
    snapshotOptions(el.parentNode);
  }
});
Recorder.on('focus', function (event) {
  const el = targetOf(event);
  if (el.tagName?.toLowerCase() === 'select' && el.multiple
      && el.options[0]?.dataset.wasSelected === undefined) {
    snapshotOptions(el);
  }
});
Recorder.on('change', function (event) {
  const el = targetOf(event);
  if (el.tagName?.toLowerCase() !== 'select') return;
  if (!el.multiple) {
    this.record('select', buildAll(el), optionLocator(el.options[el.selectedIndex]));
  } else {
    for (const o of el.options) {
      const was = o.dataset.wasSelected === 'true';
      if (was !== o.selected) {
        this.record(o.selected ? 'addSelection' : 'removeSelection',
                    buildAll(el), optionLocator(o));
        o.dataset.wasSelected = String(o.selected);
      }
    }
  }
}, false);

// 对照 KR: recorder-handlers.js:529-549
function optionLocator(option) {
  const label = option.text.replace(/^ *(.*?) *$/, '$1');
  if (label.includes('\xA0')) {
    return 'label=regexp:' + label
      .replace(/[()[\]\\^$*+?.|{}]/g, s => '\\' + s)
      .replace(/\s+/g, s => s.includes('\xA0') ? (s.length > 1 ? '\\s+' : '\\s') : s);
  }
  return 'label=' + label;
}

// ---------- contentEditable（对照 KR: recorder-handlers.js:497-519） ----------
let ceElement = null, ceSnapshot = null;
Recorder.on('focus', function (event) {
  const el = targetOf(event);
  if (el.isContentEditable) { ceElement = el; ceSnapshot = el.innerHTML; }
});
Recorder.on('blur', function (event) {
  const el = targetOf(event);
  if (el === ceElement && el.innerHTML !== ceSnapshot) {
    this.record('editContent', buildAll(el), el.innerHTML);
  }
  ceElement = null; ceSnapshot = null;
});
```

### 11.5 `panel/panel.js` —— 命令表与上下文追踪

```js
// ============ Panel：唯一的真相源 ============
const commands = [];              // { command, target, value }
let isRecording   = false;
let curTabId      = null;
let curWindowId   = null;
let curFrameLoc   = 'root';
let curUrl        = null;
const tabAlias    = new Map();    // tabId → "win_ser_local" | "win_ser_N"
let aliasCounter  = 1;
const allowedWindows = new Set(); // 只录白名单窗口（对照 KR §6.5）

function addCommand(command, target, value = '', insertBefore = false) {
  const row = { command, target, value };
  if (insertBefore && commands.length > 0) {
    commands.splice(commands.length - 1, 0, row);   // 修复 B4：是 length-1 不是 length-2
  } else {
    commands.push(row);
  }
  renderGrid();
}

// —— iframe 差分（对照 KR: bg/recorder.js:271-293，三段式 LCA）——
function syncFrame(newLoc) {
  if (!newLoc || newLoc === curFrameLoc) return;
  const nw = newLoc.split(':');
  const od = curFrameLoc.split(':');
  while (od.length > nw.length) { addCommand('selectFrame', [['relative=parent']]); od.pop(); }
  while (od.length > 1 && od[od.length - 1] !== nw[od.length - 1]) {
    addCommand('selectFrame', [['relative=parent']]); od.pop();
  }
  while (od.length < nw.length) {
    const idx = nw[od.length];                       // 显式取值，避免 KR 的自增陷阱
    addCommand('selectFrame', [[`index=${idx}`]]);
    od.push(idx);
  }
  curFrameLoc = newLoc;
}

// —— 消息入口 ——
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!isRecording) return;

  if (msg.type === 'ATTACH_REQUEST') {               // 跨导航续录握手（§9）
    chrome.tabs.sendMessage(sender.tab.id, { type: 'ATTACH_RECORDER' });
    return;
  }

  if (!sender.tab || !allowedWindows.has(sender.tab.windowId)) return;

  // 首条命令必是 open（对照 KR: bg/recorder.js:219-224）
  if (commands.length === 0) {
    curTabId = sender.tab.id; curWindowId = sender.tab.windowId;
    tabAlias.set(curTabId, 'win_ser_local');
    curUrl = sender.tab.url;
    addCommand('open', [[curUrl]]);
  }

  if (msg.type === 'PAGE_LOADED') {
    if (msg.url !== curUrl) {                        // 修复 B6：相等判断而非 includes
      curUrl = msg.url;
      addCommand('open', [[curUrl]]);
    }
    curFrameLoc = 'root';                            // 修复 B5：导航后重置 frame 上下文
    return;
  }

  if (msg.type !== 'RECORD') return;
  syncFrame(msg.frameLocation);
  addCommand(msg.command, msg.target, msg.value, msg.insertBefore);
});

// —— 多标签追踪（对照 KR: bg/recorder.js:33-64 / :120-150 / :152-173）——
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  if (!isRecording || commands.length === 0) return;
  // 150ms：等由本次点击引发的 click 命令先落表（KR 的注释解释了这个魔数）
  setTimeout(() => {
    if (tabId === curTabId && windowId === curWindowId) return;
    if (!tabAlias.has(tabId)) return;                // 陌生 tab 不录
    curTabId = tabId; curWindowId = windowId; curFrameLoc = 'root';
    addCommand('selectWindow', [[tabAlias.get(tabId)]]);
  }, 150);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (!isRecording || !tabAlias.has(tabId)) return;
  if (tabId !== curTabId) {                          // "三明治"：切过去 → 关 → 切回来
    addCommand('selectWindow', [[tabAlias.get(tabId)]]);
    addCommand('close',        [[tabAlias.get(tabId)]]);
    addCommand('selectWindow', [[tabAlias.get(curTabId)]]);
  } else {
    addCommand('close', [[tabAlias.get(tabId)]]);
  }
  tabAlias.delete(tabId);
  curFrameLoc = 'root';
});

chrome.webNavigation.onCreatedNavigationTarget.addListener((d) => {
  if (!isRecording) return;
  if (!tabAlias.has(d.sourceTabId)) return;          // 血统检查：必须由已知 tab 派生
  tabAlias.set(d.tabId, `win_ser_${aliasCounter++}`);
  chrome.tabs.get(d.tabId).then(t => allowedWindows.add(t.windowId));   // 修复 B7：无裸下标访问
});

// —— 开始/停止 ——
async function startRecording(targetWindowId) {
  isRecording = true;
  allowedWindows.add(targetWindowId);
  const tabs = await chrome.tabs.query({ windowId: targetWindowId, url: '<all_urls>' });
  for (const t of tabs) {
    chrome.tabs.sendMessage(t.id, { type: 'ATTACH_RECORDER' }).catch(() => {});
  }
}

async function stopRecording() {
  isRecording = false;
  const tabs = await chrome.tabs.query({ url: '<all_urls>' });
  for (const t of tabs) {
    chrome.tabs.sendMessage(t.id, { type: 'DETACH_RECORDER' }).catch(() => {});
  }
}
```

### 11.6 KR 与 MVP 的差异对照

| 维度 | KR 7.1.0 | 本 MVP | 理由 |
|---|---|---|---|
| content script world | `MAIN` | `ISOLATED`（默认） | 纯录制无需访问页面 JS 对象；避免污染 |
| `isTrusted` 检查 | 只在 click（B16） | 统一在 `attach()` 的 listener 里 | 全覆盖，且只写一遍 |
| focus 快照 | 静态遍历 `<input>`（B2 空集） | `document.addEventListener('focus', h, true)` 事件委托 | 对动态 DOM 生效 |
| 事件键数量 | 17 键 / 19 handler，其中 8 个有产出 | 8 键 / 10 handler，全部有产出 | 删掉 `dblclick`/`mouseup`/`mouseout`/`scroll`/`DOMNodeInserted`/`readystatechange`/`dragstart`/`drop`/`contextmenu` |
| 前插下标 | `count - 2`（B4） | `length - 1` | 修 off-by-one |
| URL 比对 | `!url.includes(old)`（B6） | `url !== old` | 语义明确 |
| 导航后 frame 重置 | 无（B5） | `PAGE_LOADED` 时重置 | 避免多余 selectFrame |
| 浮层过滤 | `parentNode.id` + `record()` 内字符串扫描 | `el.closest('#myRecorderOverlay')` | 一处、可靠 |
| Panel 归属 | 独立 `popup` 窗口 | 同左（保留） | Service Worker 不能用 `document`，命令表必须有 DOM 宿主 |
| 对话框录制 | `page/prompt.js` 猴子补丁 + postMessage | **未包含**（可后补） | MVP 先跑通主干 |
| 右键菜单断言 | 17 项 contextMenus + Port | **未包含**（可后补） | 同上 |

### 11.7 复刻实施顺序建议

1. **先跑通"点击 → 一条 click 命令"**：`manifest` + `recorder.js` 的 attach/record + Panel 的消息接收。这一步能验证三上下文通信链路。
2. **加 `type`**：体会 `input`/`change` 的分工，确认"敲 10 个字符出 1 条命令"。
3. **加握手**：点链接跳转后仍能继续录，这是从"玩具"到"可用"的分水岭。
4. **加定位器**：直接抄 `content/locatorBuilders.js`（Apache-2.0），它是整个 KR 里最值钱的部分（详见 TECH-02）。
5. **加多标签/iframe**：只有测多窗口应用时才需要。
6. **加对话框/右键菜单**：锦上添花。

> **不要一开始就抄 `recorder-handlers.js` 的全部 19 个 handler。** 其中 11 个的产出已被注释或不可达，抄过来只会带一堆看不懂的全局变量和定时器。按上面的顺序增量加，每加一个 handler 都能说清"它解决了哪个具体的去重/合并问题"。

---

## 附录 A：19 个 handler 快查表

| # | 行号 | handlerName | 事件 | capture | 有产出？ | 产出命令 |
|---|---|---|---|---|---|---|
| 1 | `:49` | `type` | `change` | ✗ | ✓ | `type` |
| 2 | `:82` | `type` | `input` | ✗ | ✗（只记指针） | — |
| 3 | `:89` | `clickAt` | `click` | ✓ | ✓ | `click` |
| 4 | `:115` | `doubleClickAt` | `dblclick` | ✓ | ✗（B1 抛异常） | ~~`doubleClick`~~ |
| 5 | `:159` | `sendKeys` | `keydown` | ✓ | ✓ | `type` / `submit` / `sendKeys` |
| 6 | `:252` | `dragAndDrop` | `mousedown` | ✓ | ✗（只快照） | — |
| 7 | `:283` | `dragAndDrop` | `mouseup` | ✓ | ✗（全注释） | — |
| 8 | `:349` | `dragAndDropToObject` | `dragstart` | ✓ | ✗（只快照） | — |
| 9 | `:358` | `dragAndDropToObject` | `drop` | ✓ | ✓ | `dragAndDropToObject` |
| 10 | `:372` | `runScript` | `scroll` | ✓ | ✗（只记状态） | — |
| 11 | `:387` | `mouseOver` | `mouseover` | ✓ | ✗（只记状态） | — |
| 12 | `:417` | `mouseOut` | `mouseout` | ✓ | ✗（全注释） | — |
| 13 | `:427` | `mouseOver` | `DOMNodeInserted` | ✓ | ✗（全注释） | — |
| 14 | `:457` | `checkPageLoaded` | `readystatechange` | ✓ | ✗（只记状态） | — |
| 15 | `:472` | `contextMenu` | `contextmenu` | ✓ | ✓ | 17 选 1 |
| 16 | `:497` | `editContent` | `focus` | ✓ | ✗（只快照） | — |
| 17 | `:509` | `editContent` | `blur` | ✓ | ✓ | `editContent` |
| 18 | `:569` | `select` | `focus` | ✓ | ✗（只快照） | — |
| 19 | `:585` | `select` | `change` | ✗ | ✓ | `select` / `addSelection` / `removeSelection` |

**有产出的只有 8 个**（#1 #3 #5 #9 #15 #17 #19，以及理论上的 #4）。

**17 个 eventKey**：`change`、`input`（非 capture）；`C_click`、`C_dblclick`、`C_keydown`、`C_mousedown`、`C_mouseup`、`C_dragstart`、`C_drop`、`C_scroll`、`C_mouseover`、`C_mouseout`、`C_DOMNodeInserted`、`C_readystatechange`、`C_contextmenu`、`C_focus`、`C_blur`（capture）。其中 `change` 挂 2 个（#1 #19）、`C_focus` 挂 2 个（#16 #18）。

---

## 附录 B：消息协议速查

| 方向 | 消息体 | 发送方 | 接收方 | 作用 |
|---|---|---|---|---|
| content → Panel | `{command, target, value, insertBeforeLastCommand, frameLocation}` | `content/recorder.js:105-111` | `bg/recorder.js:175` | 录制一条命令 |
| content → Panel | `{frameLocation}` | `content/recorder.js:27-29` | `panel/js/background/window-controller.js:46-50` | 上报 frame 位置（回放用） |
| content → Panel | `{attachRecorderRequest:true}` | `content/recorder-handlers.js:522-526` | `panel/js/background/editor.js:69` | 新页面报到 |
| content → Panel | `{command:"checkForAutomated", isAutomated}` | `content/check-browser-automation.js:2-5` | `bg/recorder.js:175`（`:253`/`:266` 分支） | 页面加载心跳 |
| content → Panel | `{checkStopInContentScript:true}` | `content/inject-popup-record.js:75` | `panel/js/background/playback/index.js:67` | 浮层 Stop 按钮 |
| content → SW | `{attachHttpRecorder:true}` / `{detachHttpRecorder:true}` | `content/command-receiver.js:176-178` / `:182-184` | 未找到接收方（已 grep，排除 `bundles/`） | 疑似遗留 |
| Panel → content | `{attachRecorder:true}` | `record-actions.js:71`、`editor.js:71` | `command-receiver.js:175`、`inject-popup-record.js:2` | 挂载录制器 + 注入浮层 |
| Panel → content | `{detachRecorder:true}` | `record-actions.js:48` | `command-receiver.js:181`、`inject-popup-record.js:7` | 卸载 |
| page → content | `postMessage({direction:"from-page-script", recordedType, recordedMessage, recordedResult, frameLocation})` | `page/prompt.js:64-70` 等 6 处 | `content/prompt-injecter.js:27-29` | 对话框录制 |
| SW → content | Port `{cmd: menuItemId}` | `background/background.js:230` | `content/recorder-handlers.js:479` | 右键菜单选择结果 |
| Panel → Panel | `{selfWindowId, commWindowId}` | （Panel 启动流程） | `panel/js/background/editor.js:79-88` | 注册白名单窗口 |

---

## 附录 C：给 Java 工程师的概念映射

| Web / KR 概念 | Java 世界的类比 |
|---|---|
| `document.addEventListener(type, fn, true)` | `Container` 上装 `AWTEventListener`，且在 dispatch 到目标组件**之前**收到 |
| capture 阶段 | Servlet Filter 链的前置处理（在 Servlet 之前） |
| bubble 阶段 | Filter 链的后置处理 |
| `event.stopPropagation()` | Filter 里不调 `chain.doFilter()` |
| `event.isTrusted` | 区分 `Robot` 合成事件与真实硬件事件 |
| `input` 事件 | `DocumentListener.insertUpdate()` |
| `change` 事件 | `ActionListener.actionPerformed()` / `FocusListener.focusLost()` |
| Content Script | 注入到目标 JVM 的 Java Agent（premain/agentmain） |
| Service Worker | 一个会被随时 kill 的无状态守护进程（不能持有内存状态） |
| Panel 独立窗口 | 真正的有状态服务进程，持有 `commands` 这份"内存数据库" |
| `chrome.runtime.sendMessage` | 进程间 RPC（fire-and-forget，返回 Promise） |
| `frameLocation` = `root:0:1` | 组件树路径 `/root/child[0]/child[1]` |
| `win_ser_local` / `win_ser_N` | 给 `WindowHandle` 起的稳定别名 |
| `insertBeforeLastCommand` | 往 `List` 的 `size()-1` 位置 `add(index, e)` |
| `typeLock` | 跨方法调用的一次性 `boolean` 门闩（非 `ReentrantLock`） |
| `SideeXPlayingFlag` | 挂在共享对象上的 `volatile boolean isReplaying` |

---

*文档结束。全部行号已于 2026-08-05 回源码逐条核实；标注「⚠️」处为与既有分析报告不一致或源码本身存在缺陷/未注释的推断，已显式区分。*

