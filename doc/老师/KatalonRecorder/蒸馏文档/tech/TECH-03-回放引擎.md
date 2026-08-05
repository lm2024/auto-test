# TECH-03 · 回放引擎（Playback）技术蒸馏

> 适用对象：想把 Katalon Recorder 7.1.0（MV3）逆向裁剪为个人录制回放插件的 Java 背景工程师。
> 文档纪律：所有结论均来自只读源码，引用格式 `文件路径:行号` 并附代码片段。凡源码中找不到的事实，显式标注「未在源码中找到」。
> 源码根目录：`c:\Users\Li\Downloads\GitHub\auto-test\doc\老师\KatalonRecorder\7.1.0_0\`（下文所有路径均相对此根）

---

## 目录

1. [一句话概括](#1-一句话概括)
2. [两套并存的回放体系](#2-两套并存的回放体系)
3. [从点击 Play 到第一行日志：完整生命周期](#3-从点击-play-到第一行日志完整生命周期)
4. [命令下行链路：跨进程通信全景](#4-命令下行链路跨进程通信全景)
5. [命令体系：元编程注册 + 全量命令清单](#5-命令体系元编程注册--全量命令清单)
6. [执行主循环 executionLoop 逐行拆解](#6-执行主循环-executionloop-逐行拆解)
7. [五大内部等待命令：页面稳定性判定](#7-五大内部等待命令页面稳定性判定)
8. [流程控制：blockStack 与 labels](#8-流程控制blockstack-与-labels)
9. [变量系统：storedVars / declaredVars 双存储](#9-变量系统storedvars--declaredvars-双存储)
10. [弹窗处理：alert / confirm / prompt 劫持](#10-弹窗处理alert--confirm--prompt-劫持)
11. [越权能力：截图 / 上传 / 特殊按键（chrome.debugger CDP）](#11-越权能力截图--上传--特殊按键chromedebugger-cdp)
12. [失败策略、错误分级与执行对话框](#12-失败策略错误分级与执行对话框)
13. [自愈（Self-Healing）在回放链路上的接入点](#13-自愈self-healing在回放链路上的接入点)
14. [数据驱动命令：CSV / JSON](#14-数据驱动命令csv--json)
15. [裁剪建议：最小可用回放引擎](#15-裁剪建议最小可用回放引擎)

---

## 1. 一句话概括

Katalon Recorder 的回放引擎是一个**运行在扩展 Panel 页面里的递归 Promise 状态机**：它把测试用例的命令数组一条条取出来，先做变量替换，再通过 `chrome.tabs.sendMessage` 把 `{command, target, value}` 三元组投递到目标标签页的指定 Frame，由 Content Script 侧的 `Selenium` 对象反射调用 `doXxx` 方法真正操作 DOM；每条业务命令之前还会强制插入 5 个「内部等待命令」来确认页面已稳定；命令之间用 `blockStack` 模拟 `if/while` 的栈式流程控制，用 `labels` 表实现 `goto` 跳转。

**核心心智模型（Java 类比）**：

```
play-actions.js          ≈  TestRunner（主控 + 状态机 + 流程控制）
window-controller.js     ≈  RemoteWebDriver（会话/窗口/Frame 管理 + RPC 发送）
command-receiver.js      ≈  RemoteWebDriver Server 端 dispatcher
selenium-api.js          ≈  WebDriver 命令实现（153 个方法本体）
selenium-commandhandlers.js ≈ 注解处理器（从 153 个方法元编程派生出 629 个命令）
```

---

## 2. 两套并存的回放体系

**这是入门 KR 回放引擎最大的坑**：源码里有两套结构极像、目录名都叫 `playback` 的回放代码，读错了会白费力气。

| 维度 | 体系 A：UI 内回放（**主线**） | 体系 B：外部 Socket 回放（可裁剪） |
|---|---|---|
| 目录 | `panel/js/background/playback/` | `playback/` |
| 入口 | 用户点侧边栏 Play 按钮 | `playback/index.js:3` `io.connect('http://localhost:3500')` |
| 驱动方 | 人（Panel UI） | Katalon Studio / CI（Socket.IO 服务端） |
| 主文件 | `.../service/actions/play/play-actions.js`（1565 行） | `playback/service/play-actions-service.js` |
| 是否必须 | **是**，裁剪时保留 | **否**，个人插件可整目录删除 |

体系 B 的入口证据：

```js
// playback/index.js:3-4
const socket = io.connect('http://localhost:3500');
console.log('listen socket 3500')
```

```js
// playback/index.js:56-65（节选）
    socket.emit('infoTestSuite', {
        ...
    actions.playSuiteAction(socket);
```

`playback/` 下共 7 个文件：`index.js`、`service/{data-service, log-service, parser-service, play-actions-service, util, variable-sevice}.js`（注意 `variable-sevice.js` 拼写少了个 `r`，是源码原样）。

> **裁剪结论**：本文档后续所有内容只讲体系 A。

---

## 3. 从点击 Play 到第一行日志：完整生命周期

### 3.1 按钮绑定

`panel/js/background/playback/index.js`（90 行）把 DOM 按钮映射到命令对象：

```js
// panel/js/background/playback/index.js（节选）
// playback     -> playTestCase
// playSuite    -> playTestSuite
// playSuites   -> playAll
// stop / pause / resume / record / executeTestStep
```

命令对象由工厂创建：

```js
// panel/js/background/playback/service/CommandFactory.js:1-47（节选）
createCommand(type)  // type ∈ record | playTestCase | playTestSuite | playAll
                     //        | stop | resume | pause | showElement
                     //        | selectElement | executeTestStep
```

### 3.2 用户日志两行的确切出处

用户贴的日志：

```
[info] Playing test case Untitled Test Suite / Untitled Test Case
[info] Browser: Chrome Version: 150.0
```

**第一行**来自 `playTestCaseAction`：

```js
// panel/js/background/playback/service/actions/play/play-actions.js:158-176（节选）
sideex_log.info("Playing test case " + testSuite.name + " / " + testCase.name);
...
logStartTime();          // :172
```

**第二行**来自 `logStartTime`（此前一直没定位到，现已核实在 `panel/js/katalon/kar.js`）：

```js
// panel/js/katalon/kar.js:513-529
function logTime() {
  var now = new Date();
  sideex_log.info("Time: " + now + " Timestamp: " + now.getTime());
}

function logStartTime() {
  logTime();
  sideex_log.info(
    "OS: " + (bowser.osname || "") + " Version: " + (bowser.osversion || "")
  );
  sideex_log.info(
    "Browser: " + (bowser.name || "") + " Version: " + (bowser.version || "")
  );
  sideex_log.info(
    "If the test cannot start, please refresh the active browser tab"
  );
}
```

`bowser` 是 UA 解析库，实现在 `panel/js/katalon/bowser.js`（另有三份副本：`content/bowser.js`、`katalon/bowser.js`、`bundles/content.1.bundle.js:69`）。

`logStartTime()` 有两个调用点（用例级 + 套件级）：

```
panel/js/background/playback/service/actions/play/play-actions.js:172   logStartTime();
panel/js/background/playback/service/actions/play/play-actions.js:339   logStartTime();
```

对应的收尾 `logEndTime()` 有三个调用点：`play-actions.js:547`（主循环末条）、`:806`、`:1403`。

### 3.3 play() 的四段式 Promise 骨架

```js
// panel/js/background/playback/service/actions/play/play-actions.js:274-281（节选）
function play() {
  return initializePlayingProgress()
    .then(executionLoop)
    .then(finalizePlayingProgress)
    .catch(catchPlayingError);
}
```

**Java 类比**：

```java
CompletableFuture
    .runAsync(this::initializePlayingProgress)
    .thenCompose(v -> executionLoop())
    .thenRun(this::finalizePlayingProgress)
    .exceptionally(this::catchPlayingError);
```

### 3.4 全局状态变量

```js
// panel/js/background/playback/service/actions/play/play-actions.js:46-50
let blockStack = [];
let labels = {};
let expectingLabel = null;
...
let currentPlayingCommandIndex = -1;
```

| 变量 | 作用 | 行号 |
|---|---|---|
| `blockStack` | if/while 块栈，模拟嵌套作用域 | `:46` |
| `labels` | `label` 命令注册表，`gotoLabel` 查表跳转 | `:47` |
| `expectingLabel` | 跳转目标暂存（正在寻找某 label 的状态） | `:48` |
| `currentPlayingCommandIndex` | 当前执行到第几条命令（`-1` 表示未开始） | `:50` |

---

## 4. 命令下行链路：跨进程通信全景

### 4.1 五级链路图

```
[Panel 页面进程]
  play-actions.js  doCommand(command, target, value)          :935-963
        │
        ▼
  extCommand.sendCommand(command, target, value, frameLocation)
        │
[window-controller.js]                                        :142-158
  retryUntilSuccess(async () => {
      browser.tabs.sendMessage(tabId, {commands, target, value}, {frameId})
  }, 60, 500)                       ← 最长重试 60×500ms = 30s
        │
        ▼  chrome.tabs.sendMessage（IPC 跨进程）
[Content Script 进程 / 目标 Frame]
  command-receiver.js  doCommands(message, sender, sendResponse)  :49-188
        │
        ├─ waitPreparation / prePageWait / pageWait / ajaxWait / domWait  :52-66
        ├─ captureEntirePageScreenshot                                    :67
        ├─ selenium["do" + UpperCase]  ← 反射调用                         :78-79
        └─ commandFactory.getCommandHandler(cmd).execute(...)             :109-133
        │
        ▼
[selenium-api.js]  Selenium.prototype.doXxx / getXxx / isXxx   （153 个方法本体）
        │
        ▼
      真实 DOM 操作
```

### 4.2 关键源码：sendCommand 的重试包装

```js
// panel/js/background/window-controller.js:142-158（节选）
sendCommand(command, target, value, top) {
    ...
    return retryUntilSuccess(async () => {
        return browser.tabs.sendMessage(
            tabId,
            { commands: command, target: target, value: value },
            { frameId: top ? 0 : frameId }
        );
    }, 60, 500);
}
```

重试工具本体只有 10 行：

```js
// common/promise-utils.js（全文 10 行）
async function retryUntilSuccess(func, maxRetry = 30, interval = 100) {
    for (let i = 0; i < maxRetry; i++) {
        try {
            return await func();
        } catch (e) {
            await new Promise(r => setTimeout(r, interval));
        }
    }
    throw 'Retry failed';
}
```

**为什么需要重试**：页面导航期间 Content Script 会被销毁重注入，`tabs.sendMessage` 会直接抛 `Could not establish connection`。`retryUntilSuccess(…, 60, 500)` 给了 30 秒窗口等待新页面的 Content Script 就位。这是整个回放引擎「跨页面跳转仍能继续」的物理基础。

### 4.3 ExtCommand 的会话状态

```js
// panel/js/background/window-controller.js:27-31（节选）
this.currentPlayingTabId = -1;
this.currentPlayingFrameLocation = 'root';
this.waitInterval = 500;
this.waitTimes = 60;
```

| 方法 | 行号 | 职责 |
|---|---|---|
| `sendCommand` | `:142` | 向指定 Frame 发命令（带重试） |
| `doSelectFrame` | `:212` | 切换 `currentPlayingFrameLocation` |
| `doSelectWindow` | `:229` | 切换 `currentPlayingTabId` |
| `doClose` | `:278` | 关闭当前标签页 |
| `wait` | `:285` | 轮询等待某状态 |
| `setFirstTab` | `:354` | 回放开始时锁定首个标签页 |

`ExtCommand` 类整体位于 `panel/js/background/window-controller.js:18-376`。

### 4.4 Content 侧的反射派发

```js
// content/command-receiver.js:78-79（节选）
let upperCase = message.commands.charAt(0).toUpperCase() + message.commands.slice(1);
result = selenium["do" + upperCase](message.target, message.value);
```

**Java 类比**：等价于 `Selenium.class.getMethod("do" + capitalize(cmd), String.class, String.class).invoke(seleniumInstance, target, value)`。

若 `do + UpperCase` 不存在（例如 `assertText`、`waitForElementPresent` 这类派生命令），则走 handler 表：

```js
// content/command-receiver.js:109-133（节选）
let handler = commandFactory.getCommandHandler(message.commands);
...
let result = handler.execute(selenium, command);
```

### 4.5 SideeXPlayingFlag：回放期抑制录制

Content Script 在执行命令前后会在 `document.body` 上打/摘一个属性标记：

```
content/command-receiver.js:81    设置 SideeXPlayingFlag
content/command-receiver.js:87    设置
content/command-receiver.js:100   移除
content/command-receiver.js:129   移除
```

录制器和 `page/prompt.js` 都会检查这个标记来判断「现在是回放中，不要记录事件 / 直接自动应答弹窗」，例如：

```js
// page/prompt.js:59-60（节选）
if (document.body.hasAttribute("SideeXPlayingFlag")) {
    return window.top.prompt(text, defaultText);
}
```

---

## 5. 命令体系：元编程注册 + 全量命令清单

> **本节是全文档最有价值的部分。** 所有条目均由脚本从 `content/selenium-api.js` 逐行正则提取（排除 `/* KAT-BEGIN … KAT-END */` 注释块内的定义），再套用两份派生规则精确计算得出，非凭印象罗列。

### 5.1 三条派生规则（selenium-commandhandlers.js）

`CommandHandlerFactory.registerAll` 依次执行三个注册器：

```js
// content/selenium-commandhandlers.js:121-125
registerAll: function(seleniumApi) {
    this._registerAllAccessors(seleniumApi);
    this._registerAllActions(seleniumApi);
    this._registerAllAsserts(seleniumApi);
},
```

#### 规则 ①：Accessor（`getXxx` / `isXxx`）→ **8 个命令**

```js
// content/selenium-commandhandlers.js:67-88
_registerAllAccessors: function(seleniumApi) {
    // Methods of the form getFoo(target) result in commands:
    // getFoo, assertFoo, verifyFoo, assertNotFoo, verifyNotFoo
    // storeFoo, waitForFoo, and waitForNotFoo.
    for (var functionName in seleniumApi) {
        var match = /^(get|is)([A-Z].+)$/.exec(functionName);
        if (match) {
            ...
            var baseName = match[2];
            var isBoolean = (match[1] == "is");
            var requiresTarget = (accessMethod.length == 1);

            this.registerAccessor(functionName, accessBlock);
            this._registerStoreCommandForAccessor(baseName, accessBlock, requiresTarget);

            var predicateBlock = this._predicateForAccessor(accessBlock, requiresTarget, isBoolean);
            this._registerAssertionsForPredicate(baseName, predicateBlock);
            this._registerWaitForCommandsForPredicate(seleniumApi, baseName, predicateBlock);
        }
    }
},
```

以 `getTitle` 为例，一次性生成：

| 派生命令 | 来源方法 | 行为 |
|---|---|---|
| `getTitle` | `registerAccessor` `:80` | 原样注册（可被脚本直接调用） |
| `storeTitle` | `_registerStoreCommandForAccessor` `:269-283` | 结果存入变量 |
| `assertTitle` | `_registerAssertionsForPredicate` `:222-233` | 断言，失败即 halt |
| `verifyTitle` | 同上 | 断言，失败**不** halt |
| `assertNotTitle` | 同上 | 反向断言，halt |
| `verifyNotTitle` | 同上 | 反向断言，不 halt |
| `waitForTitle` | `_registerWaitForCommandsForPredicate` `:253-267` | 轮询等待条件成立 |
| `waitForNotTitle` | 同上 | 轮询等待条件不成立 |

**store 命令的跨进程回传**（Content → Panel）：

```js
// content/selenium-commandhandlers.js:269-283（节选）
_registerStoreCommandForAccessor: function(baseName, accessBlock, requiresTarget) {
    ...
    browser.runtime.sendMessage({ "storeStr": ..., "storeVar": ... });
}
```

**断言失败的抛出点**：

```js
// content/selenium-commandhandlers.js:204-212（节选）
createAssertionFromPredicate: function(predicate) {
    return function(...) {
        var result = predicate.apply(null, arguments);
        if (!result.isTrue) {
            Assert.fail(result.message);
        }
    };
}
```

#### 规则 ②：Action（`doXxx`）→ **2 个命令**

```js
// content/selenium-commandhandlers.js:90-102
_registerAllActions: function(seleniumApi) {
    for (var functionName in seleniumApi) {
        var match = /^do([A-Z].+)$/.exec(functionName);
        if (match) {
            var actionName = lcfirst(match[1]);
            ...
            this.registerAction(actionName, actionBlock, false, dontCheckPopups);
            this.registerAction(actionName + "AndWait", actionBlock, false, dontCheckPopups);
        }
    }
},
```

即 `doClick` → `click` + `clickAndWait`。`AndWait` 变体在执行完动作后额外等待页面加载：

```js
// content/selenium-commandhandlers.js:314-328（节选）
ActionHandler.prototype.execute = function(seleniumApi, command) {
    ...
    if (this.wait) {
        return new PageLoadCondition(...);   // makePageLoadCondition
    }
};
```

#### 规则 ③：Assert（`assertXxx` 直接定义）→ **2 个命令**

```js
// content/selenium-commandhandlers.js:104-119
_registerAllAsserts: function(seleniumApi) {
    for (var functionName in seleniumApi) {
        var match = /^assert([A-Z].+)$/.exec(functionName);
        if (match) {
            ...
            this.registerAssert(assertName, assertBlock, true);      // halt
            var verifyName = "verify" + match[1];
            this.registerAssert(verifyName, assertBlock, false);     // no halt
        }
    }
},
```

> **实测结论**：`Selenium.prototype` 上**没有**任何以 `assert` 开头（非 `do` 前缀）的活跃方法，所以规则 ③ 在 KR 7.1.0 中**空转**。真正的 `assertAlert` 等来自 `doAssertAlert`（走规则 ②）。

`haltOnFailure` 的最终落点：

```js
// content/selenium-commandhandlers.js:358-379（节选）
AssertHandler.prototype.execute = function(seleniumApi, command) {
    try {
        this.assert(...);
        return new AssertResult();
    } catch (e) {
        if (this.haltOnFailure) { throw e; }
        ...
    }
};
```

### 5.2 全量命令清单（穷举 `content/selenium-api.js`）

#### 5.2.0 统计总表

| 口径 | 数量 | 说明 |
|---|---|---|
| `Selenium.prototype.*` **活跃**方法总数 | **153** | 排除注释块内定义 |
| ├─ `doXxx` 动作方法 | **99** | 走规则 ② |
| └─ `getXxx` / `isXxx` 访问器 | **54** | 走规则 ① |
| `assertXxx`（裸 assert 前缀） | **0** | 规则 ③ 空转 |
| **被 `/* KAT-BEGIN … KAT-END */` 注释掉的方法** | **10** | 见 5.2.9 |
| Content 侧 handler 表实际条目数 | **629** | = 99×2 + 54×8 − 去重 |
| Panel 侧 `formalCommands` 白名单条目数 | **575** | `kar-loadCommand.js` 口径 |
| 在 handler 表但不在白名单 | **71** | UI 隐藏但可用 |
| 在白名单但 handler 表无实现 | **17** | 全部由 Panel 侧拦截执行 |

#### 5.2.1 变量与日志类（3 个）

| 方法 | 行号 | 说明 |
|---|---|---|
| `doStore` | `:376` | `browser.runtime.sendMessage({storeStr, storeVar})` 回传 Panel |
| `doEcho` | `:405` | `sendMessage({echoStr})` 打日志 |
| `doStoreEval` | `:409` | 先 `getEval` 再回传 |

```js
// content/selenium-api.js:376-378
Selenium.prototype.doStore = function (value, varName) {
    browser.runtime.sendMessage({ "storeStr": value, "storeVar": varName });
};
```

#### 5.2.2 内部等待类（5 个，**引擎私有，不对用户暴露**）

| 方法 | 行号 | 判定依据 |
|---|---|---|
| `doWaitPreparation` | `:419` | 安装 beforeunload / XHR / DOM 监听钩子 |
| `doPrePageWait` | `:468` | `window.sideex_new_page = window.new_page` |
| `doPageWait` | `:475` | `document.readyState == "complete"` |
| `doAjaxWait` | `:495` | 遍历 `window.ajax_obj` 检查 readyState |
| `doDomWait` | `:530` | `window.domModifiedTime` 是否稳定 |

详见 [第 7 节](#7-五大内部等待命令页面稳定性判定)。

#### 5.2.3 鼠标 / 点击类（30 个）

| 方法 | 行号 | 方法 | 行号 |
|---|---|---|---|
| `doClick` | `:536` | `doMouseOver` | `:827` |
| `doDoubleClick` | `:555` | `doMouseOut` | `:837` |
| `doContextMenu` | `:576` | `doMouseDown` | `:847` |
| `doClickAt` | `:587` | `doMouseDownRight` | `:858` |
| `doDoubleClickAt` | `:610` | `doMouseDownAt` | `:869` |
| `doContextMenuAt` | `:637` | `doMouseDownRightAt` | `:884` |
| `doFireEvent` | `:651` | `doMouseUp` | `:899` |
| `doFocus` | `:673` | `doMouseUpRight` | `:910` |
| `doHighlight` | `:1902` | `doMouseUpAt` | `:921` |
| `doDragAndDrop` | `:2397` | `doMouseUpRightAt` | `:936` |
| `doDragAndDropToObjectByJqueryUI` | `:2436` | `doMouseMove` | `:951` |
| `doDragAndDropToObject` | `:2452` | `doMouseMoveAt` | `:962` |
| `doSetMouseSpeed` | `:2369` | `getMouseSpeed` | `:2388`（accessor） |
| `doSetSpeed` | `:1200` | `getSpeed` | `:1212`（accessor） |
| `doShowElement` | `:3867` | `doEditContent` | `:3786` |

```js
// content/selenium-api.js:536（节选）
Selenium.prototype.doClick = function(locator) { ... }
```

#### 5.2.4 键盘 / 输入类（14 个）

| 方法 | 行号 | 备注 |
|---|---|---|
| `doKeyPress` | `:686` | |
| `doShiftKeyDown` | `:703` | |
| `doShiftKeyUp` | `:712` | |
| `doMetaKeyDown` | `:721` | |
| `doMetaKeyUp` | `:730` | |
| `doAltKeyDown` | `:739` | |
| `doAltKeyUp` | `:748` | |
| `doControlKeyDown` | `:757` | |
| `doControlKeyUp` | `:766` | |
| `doKeyDown` | `:775` | |
| `doKeyUp` | `:792` | |
| `doType` | `:978` | 最常用，直接改 `value` + 触发事件 |
| `doSetText` | `:1051` | |
| `doTypeKeys` | `:1056` | |
| `doSendKeys` | `:1083` | 支持 `${KEY_ENTER}` 等特殊键 |

特殊键常量表在启动时注入 `storedVars`：

```js
// content/selenium-api.js:26-103（节选）
function build_sendkeys_maps() {
    ...   // 生成 KEY_ENTER / KEY_TAB / KEY_ESC ... 并写入 storedVars
}
```

#### 5.2.5 表单 / 选择类（7 个）

| 方法 | 行号 |
|---|---|
| `doCheck` | `:1234` |
| `doUncheck` | `:1243` |
| `doSelect` | `:1252` |
| `doAddSelection` | `:1312` |
| `doRemoveSelection` | `:1330` |
| `doRemoveAllSelections` | `:1349` |
| `doSubmit` | `:1364` |

#### 5.2.6 窗口 / Frame / 导航类（13 个）

| 方法 | 行号 | 备注 |
|---|---|---|
| `doOpen` | `:1389` | **隐式 AndWait**，内部调 `makePageLoadCondition` |
| `doOpenWindow` | `:1419` | |
| `doSelectWindow` | `:1435` | 走 `isExtCommand` 直发通道 |
| `doSelectPopUp` | `:1487` | |
| `doDeselectPopUp` | `:1511` | |
| `doSelectFrame` | `:1520` | 走 `isExtCommand` 直发通道 |
| `doWaitForPopUp` | `:1573` | |
| `doGoBack` | `:1698` | |
| `doRefresh` | `:1706` | |
| `doClose` | `:1714` | 走 `isExtCommand` 直发通道 |
| `doWindowFocus` | `:2485` | |
| `doWindowMaximize` | `:2493` | |
| `doWaitForFrameToLoad` | `:2917` | |

对应的 accessor：

| 访问器 | 行号 |
|---|---|
| `getWhetherThisFrameMatchFrameExpression` | `:1536` |
| `getWhetherThisWindowMatchWindowExpression` | `:1553` |
| `getAllWindowIds` | `:2512` |
| `getAllWindowNames` | `:2520` |
| `getAllWindowTitles` | `:2528` |
| `getLocation` | `:1849` |
| `getTitle` | `:1857` |

#### 5.2.7 弹窗类（10 个）

| 方法 | 行号 | 类型 |
|---|---|---|
| `isAlertPresent` | `:1731` | accessor |
| `isPromptPresent` | `:1743` | accessor |
| `isConfirmationPresent` | `:1755` | accessor |
| `getAlert` | `:1766` | accessor |
| `getConfirmation` | `:1790` | accessor |
| `getPrompt` | `:1826` | accessor |
| `doChooseCancelOnNextPrompt` | `:3804` | action |
| `doAnswerOnNextPrompt` | `:3808` | action |
| `doAssertPrompt` | `:3812` | action |
| `doAssertAlert` | `:3822` | action |
| `doVerifyAlert` | `:3831` | action |
| `doChooseCancelOnNextConfirmation` | `:3841` | action |
| `doChooseOkOnNextConfirmation` | `:3845` | action |
| `doAssertConfirmation` | `:3849` | action |
| `doAssertConfirmationPresent` | `:3858` | action |
| `doVerifyConfirmationPresent` | `:3862` | action |

> 注意：`doAssertAlert` 走的是**规则 ②（Action）**，因此生成的是 `assertAlert` + `assertAlertAndWait`，**不会**生成 `verifyAlert`。KR 单独写了 `doVerifyAlert`（`:3831`）来补这个缺口。这是一个「元编程规则覆盖不全，人工补丁」的典型例子。

#### 5.2.8 断言 / 取值访问器（54 个完整列表）

| Accessor | 行号 | Accessor | 行号 |
|---|---|---|---|
| `getSpeed` | `:1212` | `getSelectOptions` | `:2105` |
| `getWhetherThisFrameMatchFrameExpression` | `:1536` | `getAttribute` | `:2124` |
| `getWhetherThisWindowMatchWindowExpression` | `:1553` | `isTextPresent` | `:2140` |
| `isAlertPresent` | `:1731` | `isElementPresent` | `:2161` |
| `isPromptPresent` | `:1743` | `isVisible` | `:2174` |
| `isConfirmationPresent` | `:1755` | `isEditable` | `:2247` |
| `getAlert` | `:1766` | `getAllButtons` | `:2279` |
| `getConfirmation` | `:1790` | `getAllLinks` | `:2289` |
| `getPrompt` | `:1826` | `getAllFields` | `:2299` |
| `getLocation` | `:1849` | `getAttributeFromAllWindows` | `:2309` |
| `getTitle` | `:1857` | `getMouseSpeed` | `:2388` |
| `getBodyText` | `:1866` | `getAllWindowIds` | `:2512` |
| `getValue` | `:1875` | `getAllWindowNames` | `:2520` |
| `getText` | `:1888` | `getAllWindowTitles` | `:2528` |
| `getEval` | `:1912` | `getHtmlSource` | `:2536` |
| `isChecked` | `:1939` | `getElementIndex` | `:2574` |
| `getTable` | `:1952` | `isOrdered` | `:2594` |
| `getSelectedLabels` | `:1986` | `getElementPositionLeft` | `:2621` |
| `getSelectedLabel` | `:1995` | `getElementPositionTop` | `:2662` |
| `getSelectedValues` | `:2004` | `getElementWidth` | `:2713` |
| `getSelectedValue` | `:2013` | `getElementHeight` | `:2724` |
| `getSelectedIndexes` | `:2022` | `getCursorPosition` | `:2735` |
| `getSelectedIndex` | `:2031` | `getExpression` | `:2775` |
| `getSelectedIds` | `:2040` | `getXpathCount` | `:2788` |
| `getSelectedId` | `:2049` | `getCssCount` | `:2800` |
| `isSomethingSelected` | `:2058` | `getCookie` | `:2987` |
| — | — | `getCookieByName` | `:2997` |
| — | — | `isCookiePresent` | `:3010` |

**共 54 个**（左列 26 + 右列 28）。每个 × 8 条派生 = 432 条命令（含重名去重）。

**`isXxxPresent` 的反义特例**：`_registerWaitForCommandsForPredicate` 与 `kar-loadCommand.js` 对 `is*Present` 走特殊反义规则——不是 `NotElementPresent`，而是 `ElementNotPresent`：

```js
// panel/js/katalon/kar-loadCommand.js:26-35
if ((r = func.match(/^is(.*)Present$/))) {
    base = r[1];
    commands.push("assert" + base + "NotPresent");
    commands.push("verify" + base + "NotPresent");
    commands.push("waitFor" + base + "NotPresent");
} else {
    commands.push("assertNot" + base);
    commands.push("verifyNot" + base);
    commands.push("waitForNot" + base);
}
```

即 `isElementPresent` → `assertElementNotPresent` / `verifyElementNotPresent` / `waitForElementNotPresent`（**注意不是** `assertNotElementPresent`）。受此规则影响的有 4 个：`isAlertPresent`、`isPromptPresent`、`isConfirmationPresent`、`isElementPresent`、`isCookiePresent`（5 个）。

#### 5.2.9 剩余 action 方法（Cookie / 脚本 / 超时 / 定位策略 / 截图 / 上传）

| 方法 | 行号 | 说明 |
|---|---|---|
| `doAssignId` | `:2812` | 给元素强制加 id |
| `doAllowNativeXpath` | `:2824` | |
| `doIgnoreAttributesWithoutValue` | `:2840` | |
| `doWaitForCondition` | `:2862` | 轮询 JS 表达式 |
| `doSetTimeout` | `:2884` | 改 `this.defaultTimeout` |
| `doWaitForPageToLoad` | `:2898` | |
| `doCreateCookie` | `:3021` | |
| `doDeleteCookie` | `:3062` | |
| `doDeleteAllVisibleCookies` | `:3125` | |
| `doRunScript` | `:3159` | 经 `postMessage` 送 page 上下文执行 |
| `doAddLocationStrategy` | `:3188` | 注册自定义定位策略 |
| `doCaptureEntirePageScreenshot` | `:3229` | 发消息给 Service Worker |
| `doRollup` | `:3485` | |
| `doAddScript` | `:3570` | |
| `doRemoveScript` | `:3613` | |
| `doUseXpathLibrary` | `:3627` | |
| `doUpload` | `:3887` | 走 chrome.debugger CDP |

#### 5.2.10 被 `/* KAT-BEGIN … KAT-END */` 注释掉的 10 个方法

Katalon 把 SideeX 原版的 10 个方法整体注释掉了，改用元编程派生版本，避免行为不一致：

| 方法 | 注释块行号 | 被谁取代 |
|---|---|---|
| `doVerifyText` | `:326-333` | `getText` 派生的 `verifyText` |
| `doVerifyTitle` | `:335-341` | `getTitle` 派生的 `verifyTitle` |
| `doVerifyValue` | `:343-349` | `getValue` 派生的 `verifyValue` |
| `doAssertText` | `:351-358` | `getText` 派生的 `assertText` |
| `doAssertTitle` | `:360-366` | `getTitle` 派生的 `assertTitle` |
| `doAssertValue` | `:368-374` | `getValue` 派生的 `assertValue` |
| `doStoreText` | `:380-388` | `getText` 派生的 `storeText` |
| `doStoreTitle` | `:390-394` | `getTitle` 派生的 `storeTitle` |
| `doStoreValue` | `:396-403` | `getValue` 派生的 `storeValue` |
| `doStoreAttribute` | `:412-416` | `getAttribute` 派生的 `storeAttribute` |

```js
// content/selenium-api.js:326-333
/* KAT-BEGIN
Selenium.prototype.doVerifyText = function(locator, value) {
    var element = this.browserbot.findElement(locator);
    if (getText(element) !== value) {
        throw new Error("Actual value '" + getText(element) + "' did not match '" + value + "'");
    }
};
KAT-END */
```

> **裁剪启示**：`KAT-BEGIN/KAT-END` 是 Katalon 对上游 SideeX 代码做改动的统一标记，全仓库 grep 这个标记就能定位 Katalon 的所有魔改点。`content/selenium-api.js` 内共 12 处（另 2 处在 `:1207-1209`、`:1221-1223`，注释 `fix Selenium command execution`）。

#### 5.2.11 Panel 侧独占命令（17 个：白名单有、Content 无 handler）

这 17 条命令**不会**下发给 Content Script，而是在 `play-actions.js` 的 `runCommand` 里被拦截并在 Panel 进程直接执行：

| 命令 | 类别 | 拦截行号（`play-actions.js`） |
|---|---|---|
| `if` | 流程控制 | `:1114` |
| `else` | 流程控制 | `:1125` |
| `elseIf` | 流程控制 | `:1136` |
| `endIf` | 流程控制 | `:1147` |
| `while` | 流程控制 | `:1154` |
| `endWhile` | 流程控制 | `:1165` |
| `loadVars` | 数据驱动 | `:1186` |
| `endLoadVars` | 数据驱动 | `:1210` |
| `label` | 跳转 | `:1227` |
| `gotoIf` | 跳转 | `:1237` |
| `gotoLabel` | 跳转 | `:1255` |
| `storeCsv` | 数据驱动 | `:1267` |
| `writeToCSV` | 数据驱动 | `:1280` 附近 |
| `appendToCSV` | 数据驱动 | `:1290` 附近 |
| `appendToJSON` | 数据驱动 | `:1304` 附近 |
| `pause` | 控制 | `isExtCommand` `:1489` |
| `break` | 流程控制 | 由 `blockStack` 消费 |

以及 `kar-loadCommand.js:39-62` 手工追加的其余条目：

```js
// panel/js/katalon/kar-loadCommand.js:39-62
    commands.push("pause");
    commands.push("store");
    commands.push("echo");
    commands.push("break");

    commands.push('if');
    commands.push('elseIf');
    commands.push('else');
    commands.push('endIf');
    commands.push('while');
    commands.push('endWhile');
    commands.push('loadVars');
    commands.push('endLoadVars');
    commands.push('storeCsv');
    commands.push('writeToCSV');
    commands.push('appendToCSV');
    commands.push('appendToJSON');

    commands.push('dragAndDropToObjectByJqueryUI');

    commands.push('gotoIf');
    commands.push('gotoLabel');
    commands.push('label');
    commands.push('upload');
```

#### 5.2.12 Content 有 handler、白名单没有的 71 条

三类：

1. **accessor 原样名**（54 条）：`getTitle`、`getText`、`getAllButtons`、`isElementPresent` …
   `registerAccessor`（`:80`）注册了原名，但 `kar-loadCommand.js:19-24` 只 push 了 `assert/verify/store/waitFor` 四种派生，没 push 原名 → UI 下拉框里搜不到 `getTitle`，但脚本里写了照样能跑。
2. **nonWaitActions 的 AndWait 变体**（8 条）：`openAndWait`、`selectWindowAndWait`、`closeAndWait`、`setTimeoutAndWait`、`selectFrameAndWait`、`answerOnNextPromptAndWait`、`chooseCancelOnNextConfirmationAndWait`、`setContextAndWait`。
   规则 ② 无条件生成 `AndWait`，但白名单用 `nonWaitActions` 黑名单过滤掉了：
   ```js
   // panel/js/katalon/kar-loadCommand.js:5
   var nonWaitActions = ['open', 'selectWindow', 'chooseCancelOnNextConfirmation',
                         'answerOnNextPrompt', 'close', 'setContext', 'setTimeout', 'selectFrame'];
   ```
   `open` 本身就隐式等页面加载（`doOpen` `:1389`），再套 `AndWait` 会双重等待。
3. **`waitForNot*Present` 系列**（9 条）：handler 表按 `waitForNot + baseName` 生成（`selenium-commandhandlers.js:253-267` 有兼容分支），白名单则按 `baseName + NotPresent` 生成，两边命名不一致造成的「幽灵命令」。

#### 5.2.13 formalCommands 的最终形态

```js
// panel/js/UI/view/command-toolbar/generate-command-data-list.js:8
formalCommands[command.toLowerCase()] = command;
```

即白名单最终是一个 **小写 → 正规写法** 的映射表，用于 UI 输入框大小写容错。`kar-loadCommand.js:64-75` 负责排序去重：

```js
// panel/js/katalon/kar-loadCommand.js:64-75
    commands.sort();

    var uniqueCommands = [];
    var previousCommand = null;
    for (var i = 0; i < commands.length; i++) {
        var currentCommand = commands[i];
        if (previousCommand != currentCommand) {
            uniqueCommands.push(currentCommand);
        }
        previousCommand = currentCommand;
    }
    return uniqueCommands;
```

---

## 6. 执行主循环 executionLoop 逐行拆解

`panel/js/background/playback/service/actions/play/play-actions.js:539-682`，143 行，是整个引擎的心脏。

### 6.1 骨架

```js
// panel/js/background/playback/service/actions/play/play-actions.js:539-682（结构还原）
function executionLoop() {
    // ① 终止判定
    if ( /* 已是最后一条 */ ) {                                      // :544
        logEndTime();                                                // :547
        return;
    }
    // ② 断点 / 暂停
    if ( /* breakpoint 命中 或 用户点了 pause */ ) { ... }            // :577-595
    // ③ 游标推进
    currentPlayingCommandIndex++;                                     // :607
    // ④ 速度控制
    return delay($("#slider").slider("option", "value"))              // :630
      .then(() => {
        // ⑤ 扩展级命令直发（不经 Content Script）
        if (isExtCommand(command)) { ... }                            // :648
        // ⑥ 常规命令：5 个内部等待 + 真正命令 + 递归
        return doPreparation()                                        // :673
          .then(doPrePageWait)                                        // :674
          .then(doPageWait)                                           // :675
          .then(doAjaxWait)                                           // :676
          .then(doDomWait)                                            // :677
          .then(doCommand)                                            // :678
          .then(executionLoop);                                       // :679  ← 递归
      });
}
```

### 6.2 六个关键点

| # | 关注点 | 行号 | 要点 |
|---|---|---|---|
| ① | 终止判定 | `:544` | 判断 `currentPlayingCommandIndex` 是否已到末条；到了就 `logEndTime()`（`:547`）并 resolve |
| ② | 断点/暂停 | `:577-595` | 支持 UI 打断点、pause/resume；实现方式是**不再递归**，把 resolve 存起来等 resume 调用 |
| ③ | 游标推进 | `:607` | `currentPlayingCommandIndex++`，**先加后取**，所以初值是 `-1`（`:50`） |
| ④ | 速度滑块 | `:630` | `delay($("#slider").slider("option", "value"))` — 每条命令间的人为延迟，直接读 jQuery UI 滑块值 |
| ⑤ | ExtCommand 直发 | `:648` | `isExtCommand()` 为真的命令绕过 Content Script |
| ⑥ | 六段 Promise 链 | `:673-679` | **每条业务命令都要先走完 5 个等待命令**，这是 KR 稳定性的核心设计 |

### 6.3 isExtCommand：哪些命令不下发到页面

```js
// panel/js/background/playback/service/actions/play/play-actions.js:1489（节选）
function isExtCommand(command) {
    switch (command) {
        case "pause":
        case "selectFrame":
        case "selectWindow":
        case "close":
            return true;
        default:
            return false;
    }
}
```

**原因**：这 4 条命令改变的是「会话上下文」而非「页面 DOM」，必须由持有 `tabId` / `frameId` 的 Panel 侧 `ExtCommand` 亲自执行（`window-controller.js:212/229/278`）。

**Java 类比**：相当于 `driver.switchTo().frame()` / `driver.close()` 由 RemoteWebDriver 本地处理，不发 HTTP 请求给浏览器驱动。

### 6.4 递归 vs 循环

`executionLoop` 用 **Promise 递归**而非 `for` 循环，原因是每条命令都是异步的，且要支持中途 pause/resume。

**风险**：递归深度 = 命令条数。JS 的 Promise `.then()` 递归不会累积调用栈（微任务队列会展平），所以上万条命令也不会栈溢出。这点和 Java 的同步递归不同，值得注意。

---

## 7. 五大内部等待命令：页面稳定性判定

### 7.1 五段式流水线

```
doPreparation  →  doPrePageWait  →  doPageWait  →  doAjaxWait  →  doDomWait  →  doCommand
   安装钩子         有无导航?        加载完成?      XHR 完成?     DOM 静止?      执行业务命令
```

Panel 侧的 5 个包装函数位于 `play-actions.js:831-933`，每个都带 30000ms 超时。

### 7.2 doWaitPreparation：安装三类钩子

```js
// content/selenium-api.js:419-464（节选，结构还原）
Selenium.prototype.doWaitPreparation = function() {
    // ① 导航钩子
    window.addEventListener("beforeunload", function() {
        window.new_page = true;
    });
    // ② XHR 钩子：重写 XMLHttpRequest，收集所有请求对象
    window.ajax_obj = [];
    var oldOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(...) {
        window.ajax_obj.push(this);
        return oldOpen.apply(this, arguments);
    };
    // ③ DOM 变更钩子
    ["DOMNodeInserted", "DOMNodeRemoved", ...].forEach(evt =>
        document.addEventListener(evt, () => { window.domModifiedTime = Date.now(); })
    );
};
```

> **重点**：`window.ajax_obj` 是一个**只增不减的数组**，长页面上会持续膨胀（内存泄漏隐患）。裁剪时建议改成 `Set` + 完成后移除，或用 `PerformanceObserver` 替代。

### 7.3 四个判定函数

| 函数 | 行号 | 写入的全局变量 | 判定逻辑 |
|---|---|---|---|
| `doPrePageWait` | `:468` | `window.sideex_new_page` | `= window.new_page`，Panel 侧据此决定是否需要等新页面 |
| `doPageWait` | `:475` | `window.sideex_page_done` | `= (document.readyState == "complete")` |
| `doAjaxWait` | `:495` | `window.sideex_ajax_done` | 遍历 `window.ajax_obj`，检查每个 XHR 的 `readyState` 是否为 4 |
| `doDomWait` | `:530` | `window.sideex_dom_time` | `= window.domModifiedTime`，Panel 侧对比两次采样间隔判断 DOM 是否静止 |

```js
// content/selenium-api.js:475（节选）
Selenium.prototype.doPageWait = function() {
    window.sideex_page_done = (document.readyState == "complete");
};
```

```js
// content/selenium-api.js:530（节选）
Selenium.prototype.doDomWait = function() {
    window.sideex_dom_time = window.domModifiedTime;
};
```

### 7.4 Content 侧的分发

```js
// content/command-receiver.js:52-66（节选）
switch (message.commands) {
    case "waitPreparation":  selenium.doWaitPreparation(); break;
    case "prePageWait":      selenium.doPrePageWait();     break;
    case "pageWait":         selenium.doPageWait();        break;
    case "ajaxWait":         selenium.doAjaxWait();        break;
    case "domWait":          selenium.doDomWait();         break;
}
```

### 7.5 超时常量

```js
// content/selenium-api.js:290
Selenium.DEFAULT_TIMEOUT = 30 * 1000;
```

Panel 侧五个等待函数各自也硬编码 30000ms（`play-actions.js:831-933`）。用户可用 `setTimeout` 命令改 Content 侧的 `this.defaultTimeout`：

```js
// content/selenium-api.js:2884（节选）
Selenium.prototype.doSetTimeout = function(timeout) {
    this.defaultTimeout = timeout;
};
```

> **坑**：`setTimeout` 只影响 Content 侧的 `Selenium` 实例，**不影响** Panel 侧五个内部等待的 30s 硬编码，也不影响 `sendCommand` 的 `retryUntilSuccess(60, 500)`。三套超时互不联动。

### 7.6 waitFor* 命令的轮询实现

`waitForXxx` 系列不走等待流水线，而是在 Content 侧自轮询：

```js
// content/command-receiver.js:191-221（节选）
function continueTestWhenConditionIsTrue(...) {
    ...
    setTimeout(function() { continueTestWhenConditionIsTrue(...); }, 10);
}
```

10ms 一次的 `setTimeout` 轮询，直到条件成立或超时。

---

## 8. 流程控制：blockStack 与 labels

### 8.1 设计思想

KR 的命令列表是**扁平数组**（没有 AST），流程控制靠两个数据结构在运行时模拟：

- `blockStack`（`:46`）：栈，元素记录「块类型 + 起始索引 + 条件求值结果」
- `labels`（`:47`）：Map，`label 名 → 命令索引`

**Java 类比**：像 JVM 字节码的 `goto` + 栈帧，而不是 Java 源码的结构化语法。

### 8.2 命令与拦截行号

全部在 `runCommand`（`play-actions.js:965-1459`）内部：

| 命令 | 行号 | 行为 |
|---|---|---|
| `if` | `:1114` | 求值条件 → push 一帧到 `blockStack`；假则快进到 `else`/`elseIf`/`endIf` |
| `else` | `:1125` | 翻转当前帧的执行标志 |
| `elseIf` | `:1136` | 前面分支都假才求值本条件 |
| `endIf` | `:1147` | pop 一帧 |
| `while` | `:1154` | 求值条件；真则 push 帧并记住起始索引 |
| `endWhile` | `:1165` | 条件仍真则把 `currentPlayingCommandIndex` 拨回 `while` 处 |
| `label` | `:1227` | 注册 `labels[name] = index` |
| `gotoIf` | `:1237` | 条件真则跳到 label |
| `gotoLabel` | `:1255` | 无条件跳到 label |
| `loadVars` | `:1186` | 数据驱动循环起点（把 CSV 每行当一次迭代） |
| `endLoadVars` | `:1210` | 数据驱动循环终点 |

### 8.3 条件表达式如何求值

`if` / `while` / `gotoIf` 的条件是 **JavaScript 表达式字符串**，MV3 下 Panel 页面禁止 `eval`，所以走**沙箱 iframe**：

```js
// panel/js/katalon/kar.js:597（节选）
function evalIfCondition(expression) {
    return sandboxEvaluator.eval(expandForStoreEval(expression));
}
```

`expandForStoreEval` 把所有已声明变量拼成 JS 前导声明再拼上表达式：

```js
// panel/js/katalon/kar.js:611（节选，结构还原）
function expandForStoreEval(expression) {
    let prefix = "";
    for (let k in declaredVars) {
        prefix += "var " + k + " = " + JSON.stringify(declaredVars[k]) + ";";
    }
    prefix += "var storedVars = " + JSON.stringify(storedVars) + ";";
    return prefix + expression;
}
```

沙箱本体：

```js
// panel/js/UI/services/helper-service/SandboxEvaluator.js:41-44（节选）
// 通过 iframe(sandbox.html) + postMessage 完成
eval(script)
```

`SandboxEvaluator` 全文 50 行，机制是：Panel 页面里嵌一个 `sandbox.html` 的 `<iframe>`（manifest 声明为 sandbox 页面，CSP 允许 `unsafe-eval`），Panel 通过 `postMessage` 把表达式送进去，iframe 里 `eval` 后把结果 `postMessage` 回来。

> **MV3 关键点**：这是 MV3 下执行动态 JS 的**唯一合规姿势**。裁剪自己的插件时，如果需要 `if/while` 条件求值，必须照抄这套沙箱方案，或退而求其次用一个极简表达式解释器。

### 8.4 一个完整示例的执行轨迹

```
0  store        | 3        | count
1  while        | count > 0
2  click        | id=next
3  storeEval    | count-1  | count
4  endWhile
5  echo         | done
```

| 步 | index | 动作 | blockStack |
|---|---|---|---|
| 1 | 0 | `store` → `declaredVars.count = "3"` | `[]` |
| 2 | 1 | `while` 求值 `3>0`=true → push | `[{type:'while', start:1}]` |
| 3 | 2 | `click` 下发 Content | 同上 |
| 4 | 3 | `storeEval` → `count=2` | 同上 |
| 5 | 4 | `endWhile` 求值 `2>0`=true → `currentPlayingCommandIndex = 1` | 同上 |
| … | | 循环直到 `count=0` | |
| n | 4 | `endWhile` 求值 `0>0`=false → pop，继续 index 5 | `[]` |
| n+1 | 5 | `echo done` | `[]` |

---

## 9. 变量系统：storedVars / declaredVars 双存储

### 9.1 两份存储，两个进程

| 存储 | 位置 | 定义行 | 谁写 | 谁读 |
|---|---|---|---|---|
| `storedVars` | **Content Script 进程** | `content/selenium-api.js:20` | `build_sendkeys_maps`（特殊键常量）、Content 侧命令 | `replaceVariables`（`:2962`）、`getEval` |
| `declaredVars` | **Panel 进程** | `panel/js/background/formatCommand.js:3` | `handleFormatCommand`（收 `storeStr/storeVar` 消息）、`executeStoreCSV` | `xlateArgument`（`:5-47`）、`expandForStoreEval` |

```js
// content/selenium-api.js:20
var storedVars = new Object();
```

```js
// panel/js/background/formatCommand.js:3
var declaredVars = {};
```

### 9.2 跨进程同步：三种消息

```js
// panel/js/background/formatCommand.js:61-70（节选）
function handleFormatCommand(message) {
    if (message.storeStr !== undefined) {
        declaredVars[message.storeVar] = message.storeStr;
    }
    if (message.echoStr !== undefined) {
        sideex_log.info(message.echoStr);
    }
}
```

监听器注册：

```js
// panel/js/katalon/kar.js:623
browser.runtime.onMessage.addListener(handleFormatCommand);
```

Content 侧发送方（三处代表）：

```js
// content/selenium-api.js:377   doStore
browser.runtime.sendMessage({ "storeStr": value, "storeVar": varName });
// content/selenium-api.js:406   doEcho
browser.runtime.sendMessage({ "echoStr": value });
// content/selenium-api.js:410   doStoreEval
browser.runtime.sendMessage({ "storeStr": this.getEval(value), "storeVar": varName });
// content/selenium-commandhandlers.js:269-283   所有 storeXxx 派生命令
```

### 9.3 `${var}` 替换的三个实现

| 函数 | 位置 | 作用域 | 触发时机 |
|---|---|---|---|
| `xlateArgument` | `panel/js/background/formatCommand.js:5-47` | Panel（合并 `storedVars` + `declaredVars`） | 命令下发**前** |
| `replaceVariables` | `content/selenium-api.js:2962` | Content（只查 `storedVars`） | 命令执行**时** |
| `convertVariableToString` | `play-actions.js:1502-1528` | Panel | 流程控制取值时 |

`xlateArgument` 的特殊处理（`${nbsp}` → 不换行空格）：

```js
// panel/js/background/formatCommand.js:5-47（节选）
function xlateArgument(value) {
    // 合并 storedVars + declaredVars
    // 逐个把 ${xxx} 替换为对应值
    // 特例：${nbsp} → nonBreakingSpace()
}
```

`convertVariableToString`：

```js
// panel/js/background/playback/service/actions/play/play-actions.js:1502-1528（节选）
function convertVariableToString(variable, log = true) {
    // 若字符串含 "${"，则交给 xlateArgument 处理
    // 否则原样返回
}
```

### 9.4 `javascript{...}` 内联求值

```js
// content/selenium-api.js:2949（节选）
Selenium.prototype.preprocessParameter = function(value) {
    var match = value.match(/^javascript\{((.|\r?\n)+)\}$/);
    if (match && match[1]) {
        return this.getEval(match[1]);
    }
    return this.replaceVariables(value);
};
```

**注意**：Content Script 是 isolated world，可以 `eval`（不受 Panel 的 MV3 CSP 限制），所以这里能直接求值，不需要沙箱 iframe。这是 KR 里「Content 能 eval、Panel 不能 eval」的分界线。

### 9.5 特殊键常量

```js
// content/selenium-api.js:26-103（节选）
function build_sendkeys_maps() {
    // 把 KEY_ENTER / KEY_TAB / KEY_ESCAPE / KEY_F1 ... 注入 storedVars
}
```

所以 `sendKeys | id=q | ${KEY_ENTER}` 能工作——`${KEY_ENTER}` 走 `replaceVariables` 从 `storedVars` 取到对应的键码字符串。

---

## 10. 弹窗处理：alert / confirm / prompt 劫持

### 10.1 三层劫持架构

`page/prompt.js`（283 行）通过 `<script>` 注入到 **page 上下文**（不是 isolated world），直接改写 `window.alert/confirm/prompt`。

**为什么必须注入 page 上下文**：Content Script 的 isolated world 里改 `window.alert` 不影响页面自身的调用。

```js
// page/prompt.js:21-32
var originalPrompt = originalPrompt ? originalPrompt : window.prompt;
var nextPromptResult = false;
var recordedPrompt = null;

var originalConfirmation = originalConfirmation ? originalConfirmation : window.confirm;
var nextConfirmationResult = false;
var recordedConfirmation = null;

var originalAlert = originalAlert ? originalAlert : window.alert;
var nextAlertResult = false;
var recordedAlert = null;
```

### 10.2 顶层窗口 vs 子 Frame 的分叉

```js
// page/prompt.js:56
if (!(window === window.top || window.originalWindow === window.top)) {
    // 子 Frame 分支：把弹窗代理给 top
} else {
    // 顶层分支：真正的拦截逻辑
}
```

子 Frame 分支的做法是**转发给 top**：

```js
// page/prompt.js:58-73
window.prompt = function(text, defaultText) {
    if (document.body.hasAttribute("SideeXPlayingFlag")) {
        return window.top.prompt(text, defaultText);
    } else {
        let result = originalPrompt(text, defaultText);
        let frameLocation = getFrameLocation();
        window.top.postMessage({
            direction: "from-page-script",
            recordedType: "prompt",
            recordedMessage: text,
            recordedResult: result,
            frameLocation: frameLocation
        }, "*");
        return result;
    }
};
```

### 10.3 回放期的自动应答

顶层窗口分支用 `document.body` 上的属性标记来判断「下一次弹窗要自动应答什么」：

```js
// page/prompt.js:118-135
window.prompt = function(text, defaultText) {
    if (document.body.hasAttribute("setPrompt")) {
        recordedPrompt = text;
        document.body.removeAttribute("setPrompt");
        return nextPromptResult;          // ← 自动应答，不弹真窗
    } else {
        ...  // 录制模式：真弹窗 + 上报
    }
};
```

`alert` 更特殊——它没有返回值，所以直接吞掉并把内容 `postMessage` 出去：

```js
// page/prompt.js:154-163
window.alert = function(text) {
    if(document.body.hasAttribute("SideeXPlayingFlag")){
        recordedAlert = text;
        // Response directly
        window.top.postMessage({
            direction: "from-page-script",
            response: "alert",
            value: recordedAlert
        }, "*");
        return;
    } else { ... }
};
```

### 10.4 控制通道（Content → page）

```js
// page/prompt.js:217-283（节选）
if (window.top == window || window.top == window.originalWindow) {
    window.addEventListener("message", function(event) {
        if (event.source == window && event.data &&
            event.data.direction == "from-content-script") {
            switch (event.data.command) {
                case "setNextPromptResult":
                    nextPromptResult = event.data.target;
                    document.body.setAttribute("setPrompt", true);
                    window.postMessage({direction: "from-page-script", response: "prompt"}, "*");
                    break;
                case "getPromptMessage":         // 取回上次弹窗内容供断言
                case "setNextConfirmationResult":
                case "getConfirmationMessage":
                case "setNextAlertResult":
                ...
            }
        }
    });
}
```

**状态标记三件套**：`setPrompt`（`:225`）、`setConfirm`（`:242`）、`setAlert`（`:265`），都挂在 `document.body` 上。

### 10.5 命令映射

| KR 命令 | 对应 page 侧 command |
|---|---|
| `answerOnNextPrompt` (`selenium-api.js:3808`) | `setNextPromptResult` |
| `chooseCancelOnNextPrompt` (`:3804`) | `setNextPromptResult`（值为 false） |
| `chooseOkOnNextConfirmation` (`:3845`) | `setNextConfirmationResult`（true） |
| `chooseCancelOnNextConfirmation` (`:3841`) | `setNextConfirmationResult`（false） |
| `assertPrompt` (`:3812`) / `getPrompt` (`:1826`) | `getPromptMessage` |
| `assertConfirmation` (`:3849`) / `getConfirmation` (`:1790`) | `getConfirmationMessage` |
| `assertAlert` (`:3822`) / `verifyAlert` (`:3831`) / `getAlert` (`:1766`) | 直接读 `recordedAlert`（`:271-280` 的 `getAlertMessage` 分支已被注释） |

> **源码注释原话**（`page/prompt.js:271`）：`// Has been send to content scripts, do not need to require value again` —— alert 的内容在触发时就已推送，不需要二次拉取。

### 10.6 一处遗留调试代码

```js
// page/prompt.js:251-252
                    try{
                        console.error("no");
```

`console.error("no")` 是开发者忘删的调试语句，每次 `getConfirmationMessage` 都会在页面控制台打一行 `no`。裁剪时可删。

---

## 11. 越权能力：截图 / 上传 / 特殊按键（chrome.debugger CDP）

Content Script 做不到的三件事，全部由 Service Worker（`background/kar.js`，330 行）用扩展 API 或 CDP 完成。

### 11.1 截图（tabs.captureVisibleTab）

```js
// background/kar.js:160-169（节选）
browser.tabs.captureVisibleTab(windowId, { format: 'png' })
```

Content 侧的触发：

```js
// content/selenium-api.js:3229（节选）
Selenium.prototype.doCaptureEntirePageScreenshot = function(filename, kwargs) {
    // 发 captureEntirePageScreenshot 消息给后台
};
```

Content 侧分发拦截点：`content/command-receiver.js:67`。

### 11.2 文件上传（DOM.setFileInputFiles）

```js
// background/kar.js:61-81（节选）
function doUploadFile(...) {
    ...
    chrome.debugger.sendCommand({ tabId }, "DOM.setFileInputFiles", {
        nodeId: nodeId,
        files: [filePath]
    });
}
```

**为什么必须用 CDP**：`<input type="file">` 的 `value` 属性受浏览器安全策略保护，JS 无法赋值。只有调试协议能绕过。

Content 侧命令：`Selenium.prototype.doUpload`（`content/selenium-api.js:3887`）。

### 11.3 特殊按键（Input.dispatchKeyEvent）

```js
// background/kar.js:85-157（节选）
function doSendSpecialKeys(...) {
    ...
    chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
        type: "rawKeyDown", ...
    });
    chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
        type: "keyUp", ...
    });
}
```

**为什么必须用 CDP**：JS 合成的 `KeyboardEvent` 有 `isTrusted: false`，很多框架（尤其是需要真实键盘行为的富文本编辑器、原生表单校验）会忽略它。CDP 派发的是**真实浏览器级事件**。

### 11.4 调试器附加与节点查找

| 函数 | 行号 | 说明 |
|---|---|---|
| `doAttachDebugger` | `background/kar.js:240` | `chrome.debugger.attach`，附加后浏览器顶部会出现「正在调试此浏览器」黄条 |
| `doActionOnNode` | `background/kar.js:197` | 通过 `krId` 属性或 DOM 查询定位 CDP `nodeId` |

**流程**：Content 先给目标元素打一个唯一 `krId` 属性 → 通知后台 → 后台用 CDP `DOM.querySelector('[krId=xxx]')` 拿 `nodeId` → 对 `nodeId` 执行 CDP 操作。

> **裁剪权衡**：`chrome.debugger` 需要 manifest 里声明 `"debugger"` 权限，且会显示醒目的调试提示条，用户体验较差。个人插件如果不需要文件上传和真实按键，**建议整块砍掉**，可省掉一个高危权限。

---

## 12. 失败策略、错误分级与执行对话框

### 12.1 三层失败语义

| 层次 | 判定点 | 行为 |
|---|---|---|
| **命令级** | `AssertHandler.execute`（`selenium-commandhandlers.js:358-379`） | `haltOnFailure=true`（assert）→ throw；`false`（verify）→ 记录不中断 |
| **用例级** | `runCommand` 的 catch（`play-actions.js:1320-1370` 附近） | 先尝试自愈；仍失败则看全局设置 |
| **套件级** | `setting.testExecution.continueExecution` | 决定失败后是否跑下一条用例 |

### 12.2 全局设置读取点

```js
// panel/js/background/playback/service/actions/play/play-actions.js:1530-1552（节选）
function executionDialog(...) {
    ...
    setting.testExecution.continueExecution   // 失败后是否继续
    setting.testExecution.hideExecutionDialog // 是否隐藏执行结果对话框
}
```

### 12.3 错误捕获总入口

```js
// panel/js/background/playback/service/actions/play/play-actions.js:274-281
      .catch(catchPlayingError);
```

`catchPlayingError` 负责：记录错误日志、把当前命令行标红、调用 `finalizePlayingProgress` 收尾、按 `continueExecution` 决定后续。

### 12.4 三种超时来源汇总（易混淆）

| 超时 | 值 | 定义位置 | 可否被 `setTimeout` 命令修改 |
|---|---|---|---|
| Content 命令超时 | 30000ms | `content/selenium-api.js:290` `Selenium.DEFAULT_TIMEOUT` | ✅ 可（`doSetTimeout` `:2884`） |
| Panel 内部等待超时 | 30000ms ×5 | `play-actions.js:831-933` 各函数内硬编码 | ❌ 不可 |
| 跨进程通信重试 | 60×500ms=30s | `window-controller.js:142-158` + `common/promise-utils.js` | ❌ 不可 |

> **调试提示**：如果日志显示 `Retry failed`，说明是**第三种**超时——Content Script 30 秒内没就位，通常是页面还在加载、或目标 Frame 已销毁、或页面 CSP 阻止了脚本注入。这与「元素找不到」是完全不同的故障，不要混淆。

---

## 13. 自愈（Self-Healing）在回放链路上的接入点

> 自愈机制的完整原理见 `TECH-02-定位器与自愈.md`。本节只讲**回放引擎侧的挂载点**。

### 13.1 两处 `getPossibleTargetList`

```
panel/js/background/playback/service/actions/play/play-actions.js:944    getPossibleTargetList
panel/js/background/playback/service/actions/play/play-actions.js:1326   getPossibleTargetList
```

`:944` 在 `doCommand`（`:935-963`）内，`:1326` 在 `runCommand` 的失败重试分支（`:1320-1370`）内。

### 13.2 失败重试的完整逻辑

```js
// panel/js/background/playback/service/actions/play/play-actions.js:1320-1370（结构还原）
.catch(function(reason) {
    // ① 若还在隐式等待窗口内 → 重试同一个 target
    if ( /* 未超时 */ ) {
        return delay(...).then(() => runCommand(...));
    }
    // ② 隐式等待耗尽 → 从 possibleTargets 取下一个候选定位器
    let possibleTargets = getPossibleTargetList(...);      // :1326
    if ( /* 还有候选 */ ) {
        // 换定位器重试
        // 命中后调用 addBrokenLocator 上报 UI
    }
    // ③ 全部候选耗尽 → 真失败
    throw reason;
});
```

### 13.3 与回放主循环的关系

自愈发生在**单条命令层面**，不影响 `executionLoop` 的递归结构：

```
executionLoop
  └─ doCommand
       └─ runCommand ──失败──> 隐式等待重试 ──耗尽──> 换候选定位器 ──全失败──> throw
                                                          │
                                                    命中 → addBrokenLocator 上报
                                                          └─> 正常返回，executionLoop 继续
```

---

## 14. 数据驱动命令：CSV / JSON

### 14.1 四个执行器文件

```
panel/js/background/playback/service/actions/play/execute-storeCSV.js
panel/js/background/playback/service/actions/play/execute-writeToCSV.js
panel/js/background/playback/service/actions/play/execute-appendToCSV.js
panel/js/background/playback/service/actions/play/execute-appendToJSON.js
```

全部在 **Panel 进程**执行，不下发 Content Script。

### 14.2 storeCsv 的两种 target 格式

```js
// panel/js/background/playback/service/actions/play/execute-storeCSV.js:66-104（节选）
function parseLocation(location) {
  let tokens = location.split(',');
  if (tokens.length !== 3 && tokens.length !== 1) {
    return { result: false, errorMessage: "Target has incorrect format!" }
  }
  let fileName = tokens[0];
  ...
}
```

| target 格式 | 语义 | 存入 `declaredVars` 的内容 |
|---|---|---|
| `data.csv,10,first_name` | 取单元格 | 字符串（该单元格值） |
| `data.csv` | 取整表 | 列式对象 `{col1: [...], col2: [...], length: N}` |

单元格模式：

```js
// execute-storeCSV.js:182-189
  if (rowIndex || columnName) { //old command with format data_file,row_index,column_name
    const csvValue = getCellValue(fileName, rowIndex, columnName);
    declaredVars[value] = csvValue;
    return {
      success: true,
      errorMessage: "",
      successMessage: `Store ${csvValue} into ${value}`
    }
  }
```

整表模式（**列式存储**，注意不是行式）：

```js
// execute-storeCSV.js:130-148
function getCSVData(fileName) {
  let fileData = window.dataFiles[fileName];
  if (window.dataFiles[fileName].data === undefined) {
    parseData(fileName);
  }

  let csvData = fileData.data.reduce((obj, row) => {
    for (const [key, value] of Object.entries(row)) {
      if (obj[key]) {
        obj[key].push(value);
      } else {
        obj[key] = [value];
      }
    }
    return obj;
  }, {});
  csvData.length = fileData.data.length;
  return csvData;
}
```

所以脚本里可以写 `${myCsv.first_name[0]}`、`${myCsv.length}`。

### 14.3 数据文件存储

```js
// execute-storeCSV.js:131
  let fileData = window.dataFiles[fileName];
```

`window.dataFiles` 是 Panel 页面上的全局对象，解析器来自：

```js
// execute-storeCSV.js:1
import { parseData } from "../../../../../UI/services/data-file-service/data-file-services.js";
```

### 14.4 loadVars / endLoadVars 的循环语义

`loadVars`（`play-actions.js:1186`）+ `endLoadVars`（`:1210`）构成一个「按 CSV 行数迭代」的循环块：每次迭代把当前行的各列注入 `declaredVars`，跑完块内命令后拨回起点，直到行耗尽。实现方式与 `while`/`endWhile` 同构（都用 `blockStack`）。

### 14.5 校验逻辑

`execute-storeCSV.js` 有三层校验，值得抄：

```js
// execute-storeCSV.js:11-27
function validateRowIndex(originalRowIndex) {
  let rowIndex;
  rowIndex = parseInt(originalRowIndex);
  if (isNaN(rowIndex)) {
    return { result: false, errorMessage: "row_index must be a non-negative number" }
  }
  if (rowIndex < 0) {
    return { result: false, errorMessage: "row_index must be a non-negative number" }
  }
  return { result: true, data: rowIndex }
}
```

---

## 15. 裁剪建议：最小可用回放引擎

### 15.1 必留文件清单（约 2500 行）

| 文件 | 行数 | 裁剪后保留比例 | 理由 |
|---|---|---|---|
| `panel/js/background/playback/service/actions/play/play-actions.js` | 1565 | ~40% | 主循环 + 变量替换必留；流程控制/数据驱动可砍 |
| `panel/js/background/window-controller.js` | 379 | ~70% | 会话/Frame/发命令 |
| `content/command-receiver.js` | 228 | ~90% | 派发入口 |
| `content/selenium-commandhandlers.js` | 395 | ~100% | 元编程注册，不能拆 |
| `content/selenium-api.js` | 3954 | ~20% | 只留常用 30 个命令 |
| `panel/js/background/formatCommand.js` | 74 | 100% | 变量系统 |
| `common/promise-utils.js` | 10 | 100% | 重试工具 |
| `panel/js/UI/services/helper-service/SandboxEvaluator.js` | 50 | 视需要 | 只有要 if/while 才留 |

### 15.2 可整块删除

| 模块 | 路径 | 理由 |
|---|---|---|
| 外部 Socket 回放 | `playback/`（7 个文件） | 个人插件不需要 CI 驱动 |
| CDP 越权能力 | `background/kar.js:61-157, 240` | 省掉 `debugger` 高危权限 |
| 数据驱动 | `execute-{storeCSV,writeToCSV,appendToCSV,appendToJSON}.js` | 非核心 |
| 弹窗劫持 | `page/prompt.js` | 若不测弹窗可删 |
| 罕用命令 | `selenium-api.js` 的 `doRollup:3485`、`doUseXpathLibrary:3627`、`doAddScript:3570`、`doRemoveScript:3613`、`doAddLocationStrategy:3188` | 几乎无人用 |

### 15.3 最小命令集建议（30 条）

| 类别 | 命令 | 对应源码 |
|---|---|---|
| 导航 | `open` | `selenium-api.js:1389` |
| 点击 | `click`、`clickAndWait`、`doubleClick` | `:536`、`:555` |
| 输入 | `type`、`sendKeys` | `:978`、`:1083` |
| 表单 | `select`、`check`、`uncheck`、`submit` | `:1252`、`:1234`、`:1243`、`:1364` |
| 窗口 | `selectWindow`、`selectFrame`、`close` | `:1435`、`:1520`、`:1714` |
| 断言 | `assertText`、`verifyText`、`assertTitle`、`assertElementPresent`、`assertValue` | 派生自 `:1888`、`:1857`、`:2161`、`:1875` |
| 等待 | `waitForElementPresent`、`waitForText`、`waitForVisible` | 派生自 `:2161`、`:1888`、`:2174` |
| 变量 | `store`、`storeText`、`storeValue`、`storeEval`、`echo` | `:376`、派生、`:409`、`:405` |
| 脚本 | `runScript` | `:3159` |
| 控制 | `pause`、`setTimeout` | `isExtCommand`、`:2884` |

### 15.4 改进建议（超越原版）

| 原版缺陷 | 源码位置 | 建议 |
|---|---|---|
| `window.ajax_obj` 只增不减，内存泄漏 | `selenium-api.js:419-464` | 改用 `PerformanceObserver` 监听 `resource` 条目，或完成后从数组移除 |
| 三套超时互不联动 | `:290` / `play-actions.js:831-933` / `window-controller.js:142` | 统一到一个 config 对象 |
| 速度控制直读 jQuery 滑块 | `play-actions.js:630` | 抽成 `getPlaybackDelay()`，解耦 UI |
| 弹窗靠 `document.body` 属性传状态 | `page/prompt.js:119/137/155` | 改用纯 `postMessage` 握手，避免属性被页面清掉 |
| 遗留调试语句 | `page/prompt.js:252` `console.error("no")` | 删除 |
| DOM 变更监听用废弃的 Mutation Events | `selenium-api.js:419-464` | 换 `MutationObserver`（性能好一个量级） |
| `AndWait` 无条件生成 | `selenium-commandhandlers.js:99` | 用白名单而非黑名单，避免 71 条幽灵命令 |

### 15.5 从零实现的推荐顺序

1. **通信骨架**：`tabs.sendMessage` + `retryUntilSuccess` + Content 侧 dispatcher（≈150 行）
2. **命令本体**：手写 10 个 `doXxx`（click/type/open/select/...）
3. **元编程注册**：照抄 `CommandHandlerFactory` 的三条规则（≈200 行）
4. **执行主循环**：Promise 递归 + 游标（≈100 行）
5. **等待流水线**：先只做 `pageWait`（readyState），跑通后再加 domWait
6. **变量系统**：`declaredVars` + `${}` 替换（≈80 行）
7. （可选）流程控制 + 沙箱求值
8. （可选）自愈

---

## 附录 A：关键文件行数速查

| 文件 | 行数 |
|---|---|
| `content/selenium-api.js` | 3954 |
| `panel/js/background/playback/service/actions/play/play-actions.js` | 1565 |
| `content/selenium-commandhandlers.js` | 395 |
| `panel/js/background/window-controller.js` | 379 |
| `background/kar.js` | 330 |
| `page/prompt.js` | 283 |
| `content/command-receiver.js` | 228 |
| `panel/js/katalon/kar-loadCommand.js` | 97 |
| `panel/js/background/playback/index.js` | 90 |
| `panel/js/background/formatCommand.js` | 74 |
| `playback/index.js` | 65 |
| `panel/js/UI/services/helper-service/SandboxEvaluator.js` | 50 |
| `panel/js/background/playback/service/CommandFactory.js` | 47 |
| `panel/js/UI/view/command-toolbar/generate-command-data-list.js` | 15 |
| `common/promise-utils.js` | 10 |

## 附录 B：核心行号索引

| 主题 | 位置 |
|---|---|
| 全局状态变量 | `play-actions.js:46-50` |
| 用例日志首行 | `play-actions.js:158-176` |
| 浏览器版本日志 | `panel/js/katalon/kar.js:518-529` |
| `play()` 四段式 | `play-actions.js:274-281` |
| 执行主循环 | `play-actions.js:539-682` |
| 六段 Promise 链 | `play-actions.js:673-679` |
| 速度控制 | `play-actions.js:630` |
| 五个等待包装 | `play-actions.js:831-933` |
| `doCommand` | `play-actions.js:935-963` |
| `runCommand` | `play-actions.js:965-1459` |
| 流程控制拦截 | `play-actions.js:1114-1265` |
| 数据驱动拦截 | `play-actions.js:1267-1304` |
| 自愈重试 | `play-actions.js:1320-1370` |
| `isExtCommand` | `play-actions.js:1489` |
| `convertVariableToString` | `play-actions.js:1502-1528` |
| `executionDialog` | `play-actions.js:1530-1552` |
| `sendCommand` 重试 | `window-controller.js:142-158` |
| Content 派发 | `command-receiver.js:49-188` |
| 反射调用 | `command-receiver.js:78-79` |
| `waitFor` 轮询 | `command-receiver.js:191-221` |
| Accessor 派生 | `selenium-commandhandlers.js:67-88` |
| Action 派生 | `selenium-commandhandlers.js:90-102` |
| Assert 派生 | `selenium-commandhandlers.js:104-119` |
| store 回传 | `selenium-commandhandlers.js:269-283` |
| `AssertHandler.execute` | `selenium-commandhandlers.js:358-379` |
| `storedVars` 定义 | `selenium-api.js:20` |
| 特殊键注入 | `selenium-api.js:26-103` |
| 默认超时 | `selenium-api.js:290` |
| 等待钩子安装 | `selenium-api.js:419-464` |
| `preprocessParameter` | `selenium-api.js:2949` |
| `replaceVariables` | `selenium-api.js:2962` |
| `declaredVars` 定义 | `formatCommand.js:3` |
| `xlateArgument` | `formatCommand.js:5-47` |
| `handleFormatCommand` | `formatCommand.js:61-70` |
| 沙箱求值 | `SandboxEvaluator.js:41-44` |
| `evalIfCondition` | `panel/js/katalon/kar.js:597` |
| `expandForStoreEval` | `panel/js/katalon/kar.js:611` |
| CDP 上传 | `background/kar.js:61-81` |
| CDP 按键 | `background/kar.js:85-157` |
| 截图 | `background/kar.js:160-169` |
| 弹窗顶层劫持 | `page/prompt.js:118-176` |
| 弹窗控制通道 | `page/prompt.js:217-283` |

---

## 附录 C：未在源码中找到的事实

| 待查事实 | 说明 |
|---|---|
| （无） | 本轮所有待查项（含 `Browser: Chrome Version` 日志出处）均已在源码中定位，见 §3.2。 |
