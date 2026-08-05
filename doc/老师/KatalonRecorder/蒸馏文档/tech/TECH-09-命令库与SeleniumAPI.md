# TECH-09 命令库与 Selenium API 执行层蒸馏

> 模块定位：M09 —— 命令库与 Selenium API 执行层
> 源码版本：Katalon Recorder 7.1.0（Manifest V3）
> 蒸馏目标：让工程师据此裁剪重建自己的「录制回放」个人插件

---

## ① 一句话概括

Katalon Recorder 的回放内核 = 一份「命令原型表（Selenium.prototype 上的 do*/get*/is* 方法）」+ 一个「命名魔法工厂（CommandHandlerFactory）」，后者把原型方法自动派生出 `assert/verify/waitFor/store/*Not*` 等几十倍命令；真正执行时，content script 里的 `command-receiver.js` 先把命令名翻成 `selenium["doXxx"](target, value)`，找不到再交给 handler 工厂，所有 DOM 操作都经由 `selenium-browserbot.js` 合成事件（非原生 `element.click()`）完成，locator 字符串由 `parse_locator` 拆前缀后分派到不同查找策略。

---

## ② 关键文件清单

下表按「职责域」分列，最后一列给出裁剪去留建议（保留 / 删除 / 替换）。

### 2.1 命令注册与派发（content 域 · 注入页面执行）

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---|---|---|
| `content/command-receiver.js` | 228 | 消息入口：`doCommands` 分发命令，区分 `doXxx` 直调与 handler 工厂两条路径；`waitFor` 轮询 | **保留**（核心分发器，可瘦身为纯 switch） |
| `content/selenium-commandhandlers.js` | 395 | `CommandHandlerFactory`：自动注册 accessor/action/assert，派生 assert/verify/store/waitFor/Not | **保留**（核心魔法，可只保留 `_registerAllActions`） |
| `content/selenium-api.js` | 3954 | `Selenium.prototype` 上全部 `do*/get*/is*` 命令实现（真实生效方法 153 个） | **替换/裁剪**（只留你需要的命令，删除 KAT 注释掉的 10 个） |
| `content/selenium-browserbot.js` | 2932 | 元素查找、locator 策略、`triggerMouseEvent` 合成事件、frame/window 切换 | **保留**（DOM 真相源，可瘦身策略表） |
| `content/utils.js` | 9668 | `parse_locator`（前缀解析）、`PatternMatcher`、`bot.inject.cache` 等 | **保留/裁剪**（`parse_locator` 必留，其余按需） |

### 2.2 命令清单加载（panel 域 · 命令下拉框）

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---|---|---|
| `panel/js/katalon/kar-loadCommand.js` | 98 | `_loadSeleniumCommands()` 枚举 `Selenium.prototype` 生成命令名清单，供 UI 下拉 | **保留**（仅 UI 用，纯展示） |
| `panel/js/katalon/selenium-ide/iedoc-core.xml` | — | 命令参考文档（Help 面板用） | **删除**（不影响回放） |

### 2.3 变量与脚本通道（content 域）

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---|---|---|
| `panel/js/background/formatCommand.js` | 74 | `xlateArgument` 处理 `${var}`，`handleFormatCommand` 收 `store`/`echo` 回写 UI | **替换**（store 回写可走 `command-receiver` 内联） |
| `content/selenium-api.js:20` `var storedVars` | 1 行 | 全局变量袋（store 写入、replaceVariables 读取） | **保留**（变量系统核心） |

### 2.4 回放控制流（playback 域 · 控制流在回放层，不走 command-receiver）

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---|---|---|
| `playback/service/play-actions-service.js` | 1049 | `if/while/loadVars/gotoIf/label` 等控制流在回放层解释执行（:575-695） | **保留/裁剪**（控制流若不需要可整段删） |

### 2.5 录制时命令渲染（与上一份 TECH-08 重叠，仅说明衔接）

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---|---|---|
| `panel/js/UI/view/records-grid/add-command.js` | 158 | 录到命令后调 `addCommand`，挂 `<datalist>` 候选定位器 | 见 TECH-08 |
| `panel/js/UI/services/helper-service/parser.js` | 143 | `marshall/unmarshall` HTML 序列化，命令落盘 | 见 TECH-08 |

---

## ③ 核心机制逐层拆解

### 3.1 命令原型的三种形状：action / accessor / assertion

回放引擎理解的「命令」只有三个语义族，全部定义在 `Selenium.prototype` 上：

| 形状 | 原型命名 | 例 | 接收参数 | 语义 |
|---|---|---|---|---|
| **action** | `doXxx(target, value)` | `doClick`、`doType` | target, value | 触发页面副作用，`execute` 返回 `ActionResult` |
| **accessor** | `getXxx(target)` / `isXxx(target)` | `getText`、`isChecked` | target（可空） | 读取页面状态，返回裸值 |
| **assertion** | 不单独定义原型 | （全由 factory 派生） | — | 断言/验证 accessor 的返回值 |

> 关键事实：**`Selenium.prototype` 上没有任何 `assert*` 原型方法**。grep `^Selenium\.prototype\.assert` 在 `selenium-api.js` 中零命中。所有 `assert*`/`verify*` 命令都是 `CommandHandlerFactory` 从 `get*/is*` 自动派生出来的（见 3.2）。源码里能看到的 `doAssertText`/`doAssertAlert` 等其实是 `do` 前缀的 action（:352、:3822、:3229），它们内部封装了断言逻辑，属于特例而非通用断言通道。

证据 —— `content/selenium-api.js` 原型编排（节选，行号已核验）：

```
327  Selenium.prototype.doVerifyText   = function(locator, value) {...}
352  Selenium.prototype.doAssertText    = function(locator, value) {...}
376  Selenium.prototype.doStore         = function (value, varName) {...}
381  Selenium.prototype.doStoreText      = function(locator, varName) {...}
536  Selenium.prototype.doClick          = function (locator) {...}
978  Selenium.prototype.doType           = function (locator, value) {...}
1389 Selenium.prototype.doOpen          = function (url, ignoreResponseCode) {...}
1849 Selenium.prototype.getLocation      = function () {...}
1888 Selenium.prototype.getText          = function (locator) {...}
1939 Selenium.prototype.isChecked        = function (locator) {...}
2161 Selenium.prototype.isElementPresent = function (locator) {...}
```

### 3.2 命名魔法：CommandHandlerFactory 如何「无中生有」

这是本模块最值得蒸馏的机制。`content/selenium-commandhandlers.js:44` 的 `CommandHandlerFactory` 在启动期只接收 `Selenium` 实例，遍历其原型方法，按命名正则自动注册并派生命令。

#### 3.2.1 三类基础注册入口

```js
// content/selenium-commandhandlers.js:121-125
registerAll: function(seleniumApi) {
    this._registerAllAccessors(seleniumApi);   // get*/is*  → accessor + 派生
    this._registerAllActions(seleniumApi);     // do*       → action (+AndWait)
    this._registerAllAsserts(seleniumApi);     // assert*   → 真实 assert 原型（本工程为 0）
}
```

#### 3.2.2 action 派生：`doClick` → `click` + `clickAndWait`

```js
// content/selenium-commandhandlers.js:90-102
_registerAllActions: function(seleniumApi) {
    for (var functionName in seleniumApi) {
        var match = /^do([A-Z].+)$/.exec(functionName);   // 匹配 doClick / doType ...
        if (match) {
            var actionName = lcfirst(match[1]);            // "Click" → "click"
            var actionMethod = seleniumApi[functionName];
            var dontCheckPopups = actionMethod.dontCheckAlertsAndConfirms;
            var actionBlock = fnBind(actionMethod, seleniumApi);
            this.registerAction(actionName, actionBlock, false, dontCheckPopups);          // "click"
            this.registerAction(actionName + "AndWait", actionBlock, false, dontCheckPopups); // "clickAndWait"
        }
    }
}
```

> 注意：`.*AndWait` 由 factory 自动加，**但** `kar-loadCommand.js:5` 的 `nonWaitActions` 名单（`open, selectWindow, chooseCancelOnNextConfirmation, answerOnNextPrompt, close, setContext, setTimeout, selectFrame`）在 UI 清单里不追加 `AndWait` 后缀——因为这类命令本身就会触发/不需等待页面加载。两套派生逻辑（factory 给 handler 用、kar-loadCommand 给下拉框用）并存，名字空间对齐但实现分叉，是潜在不一致点（见坑 #4）。

#### 3.2.3 accessor 派生：`getText` → 整套断言家族 + store + waitFor

```js
// content/selenium-commandhandlers.js:67-88
_registerAllAccessors: function(seleniumApi) {
    for (var functionName in seleniumApi) {
        var match = /^(get|is)([A-Z].+)$/.exec(functionName);   // getText → baseName="Text"
        if (match) {
            var accessMethod = seleniumApi[functionName];
            var accessBlock = fnBind(accessMethod, seleniumApi);
            var baseName = match[2];                 // "Text"
            var isBoolean = (match[1] == "is");       // isXxx → 布尔
            var requiresTarget = (accessMethod.length == 1);

            this.registerAccessor(functionName, accessBlock);                         // "getText"
            this._registerStoreCommandForAccessor(baseName, accessBlock, requiresTarget);   // "storeText"
            var predicateBlock = this._predicateForAccessor(accessBlock, requiresTarget, isBoolean);
            this._registerAssertionsForPredicate(baseName, predicateBlock);           // assert/verify/Not...
            this._registerWaitForCommandsForPredicate(seleniumApi, baseName, predicateBlock); // waitFor...
        }
    }
}
```

#### 3.2.4 断言派生：一个 accessor 变出 4~6 个命令

```js
// content/selenium-commandhandlers.js:222-233
_registerAssertionsForPredicate: function(baseName, predicateBlock) {
    var assertBlock = this.createAssertionFromPredicate(predicateBlock);
    this.registerAssert("assert" + baseName, assertBlock, true);    // assertText：失败即停
    this.registerAssert("verify" + baseName, assertBlock, false);   // verifyText：失败不停

    var invertedPredicateBlock = this._invertPredicate(predicateBlock);
    var negativeassertBlock = this.createAssertionFromPredicate(invertedPredicateBlock);
    this.registerAssert("assert" + this._invertPredicateName(baseName), negativeassertBlock, true);  // assertNotText
    this.registerAssert("verify" + this._invertPredicateName(baseName), negativeassertBlock, false); // verifyNotText
}
```

其中 `_invertPredicateName`（:214-220）对 `*Present` 做特判，保证 `isElementPresent` → 反义是 `assertNotPresent`（而非 `assertNotElementPresent`）：

```js
_invertPredicateName: function(baseName) {
    var matchResult = /^(.*)Present$/.exec(baseName);
    if (matchResult != null) {
        return matchResult[1] + "NotPresent";   // ElementPresent → NotPresent
    }
    return "Not" + baseName;                     // Text → NotText
}
```

#### 3.2.5 waitFor 派生：轮询版断言

```js
// content/selenium-commandhandlers.js:253-267
_registerWaitForCommandsForPredicate: function(seleniumApi, baseName, predicateBlock) {
    var waitForActionMethod = this._waitForActionForPredicate(predicateBlock);
    var waitForActionBlock = fnBind(waitForActionMethod, seleniumApi);
    var invertedPredicateBlock = this._invertPredicate(predicateBlock);
    var waitForNotActionMethod = this._waitForActionForPredicate(invertedPredicateBlock);
    var waitForNotActionBlock = fnBind(waitForNotActionMethod, seleniumApi);

    this.registerAction("waitFor" + baseName, waitForActionBlock, false, true);          // waitForText
    this.registerAction("waitFor" + this._invertPredicateName(baseName), waitForNotActionBlock, false, true); // waitForNotText / waitForNotPresent
    this.registerAction("waitForNot" + baseName, waitForNotActionBlock, false, true);     // waitForNotText（兼容别名）
}
```

#### 3.2.6 store 派生：把 accessor 结果塞进变量袋

```js
// content/selenium-commandhandlers.js:269-283
_registerStoreCommandForAccessor: function(baseName, accessBlock, requiresTarget) {
    var action;
    if (requiresTarget) {
        action = function(target, varName) {
            storedVars[varName] = accessBlock(target);
            browser.runtime.sendMessage({ "storeStr": storedVars[varName], "storeVar": varName });
        };
    } else {
        action = function(varName) {
            storedVars[varName] = accessBlock();
            browser.runtime.sendMessage({ "storeStr": storedVars[varName], "storeVar": varName });
        };
    }
    this.registerAction("store" + baseName, action, false, true);   // storeText
}
```

> 注意 `browser.runtime.sendMessage` 是 store 命令把变量同步回 panel UI 的通道。在裁剪版里如果不需要 UI 实时显示变量，可以删掉这行，仅留 `storedVars[varName] = ...`。

#### 3.2.7 派生总览（一个 `getText` accessor 的最终命令集）

| 派生命令 | 来源行 | 行为 |
|---|---|---|
| `getText` | accessor 本体 | 读取文本 |
| `storeText` | :282 | 存入变量袋 |
| `assertText` | :226 | 断言相等，失败即停 |
| `verifyText` | :227 | 断言相等，失败不停 |
| `assertNotText` | :231 | 断言不等，失败即停 |
| `verifyNotText` | :232 | 断言不等，失败不停 |
| `waitForText` | :262 | 轮询至相等 |
| `waitForNotText` | :263 | 轮询至不等 |
| `waitForNotText`（别名） | :266 | 同上，历史兼容 |

### 3.3 命令清单的动态枚举（UI 侧）

UI 下拉框的命令名来自 `panel/js/katalon/kar-loadCommand.js:_loadSeleniumCommands()`，它与 factory 逻辑**平行**而非共享：

```js
// panel/js/katalon/kar-loadCommand.js:7-37（节选）
for (func in Selenium.prototype) {
    if (func.match(/^do[A-Z]/)) {
        var action = func.substr(2,1).toLowerCase() + func.substr(3);   // doClick → click
        commands.push(action);
        if (!action.match(/^waitFor/) && nonWaitActions.indexOf(action) < 0) {
            commands.push(action + "AndWait");                          // clickAndWait
        }
    } else if (func.match(/^assert.+/)) {
        commands.push(func);
        commands.push("verify" + func.substr(6));
    } else if ((r = func.match(/^(get|is)(.+)$/))) {
        var base = r[2];
        commands.push("assert" + base);
        commands.push("verify" + base);
        commands.push("store" + base);
        commands.push("waitFor" + base);
        if ((r = func.match(/^is(.*)Present$/))) {           // isElementPresent → *NotPresent
            base = r[1];
            commands.push("assert" + base + "NotPresent");
            commands.push("verify" + base + "NotPresent");
            commands.push("waitFor" + base + "NotPresent");
        } else {
            commands.push("assertNot" + base);
            commands.push("verifyNot" + base);
            commands.push("waitForNot" + base);
        }
    }
}
// 再追加一批特殊命令
commands.push("pause"); commands.push("store"); commands.push("echo"); commands.push("break");
commands.push('if');     commands.push('elseIf'); commands.push('else'); commands.push('endIf');
commands.push('while');  commands.push('endWhile'); commands.push('loadVars'); ...
```

> 两套派生规则（factory vs kar-loadCommand）名字几乎一致，但 kar-loadCommand 对 `isXxxPresent` 的 *NotPresent 处理在 :26-30，而 factory 在 `_invertPredicateName` :214-220。**两边都要维护，改一处忘了另一处就会让 UI 下拉与真实可执行命令不一致**。裁剪版应只保留一份派生逻辑。

### 3.4 真实生效命令清单（selenium-api.js 原型普查）

grep `^Selenium\.prototype\.(do|get|is)` 共命中 153 个原型方法（断言复核：`do*` 约 99、`get*` 约 43、`is*` 约 11，此外有 `doAssert*` 系列与 `doVerify*` 系列作为 action 特例）。其中 10 个被 `// KAT-BEGIN ... KAT-END` 或类似注释包裹成「已禁用」状态（如早期 Selenium 1 遗留命令），回放不会调用。

按用途粗分（行号取自 grep 实测）：

| 类别 | 代表命令 | 原型行 |
|---|---|---|
| 鼠标 | `click` `doubleClick` `contextMenu` `mouseDown/Up/Move` `clickAt` | 536 / 555 / 576 / 847… |
| 键盘 | `type` `sendKeys` `keyDown/Up/Press` `setCursorPosition` | 978 / 1083 / 775… |
| 选择 | `check` `uncheck` `select` `addSelection` `removeSelection` | 1234 / 1243 / 1252… |
| 表单 | `submit` `editContent` `setText` | 1364 / 3786 / 1051 |
| 导航 | `open` `openWindow` `goBack` `refresh` `close` | 1389 / 1419 / 1698… |
| 窗口/帧 | `selectWindow` `selectFrame` `selectPopUp` `waitForPopUp` | 1435 / 1520 / 1487… |
| 读取 | `getTitle` `getLocation` `getText` `getValue` `getAttribute` `getTable` | 1857 / 1849 / 1888… |
| 布尔 | `isChecked` `isTextPresent` `isElementPresent` `isVisible` `isEditable` | 1939 / 2140 / 2161… |
| 等待 | `waitForPageToLoad` `waitForFrameToLoad` `waitForCondition` `waitForPopUp` | 2898 / 2917 / 2862… |
| 弹窗 | `getAlert` `getConfirmation` `getPrompt` `chooseOk/CancelOnNext*` | 1766 / 1790 / 1826… |
| 脚本 | `runScript` `addScript` `removeScript` `getEval` `storeEval` | 3159 / 3570 / 1912… |
| 截图 | `captureEntirePageScreenshot` | 3229 |
| 特殊（SideeX 内部） | `waitPreparation` `prePageWait` `pageWait` `ajaxWait` `domWait` | 419 / 468 / 475 / 495 / 530 |

> 裁剪建议：个人插件一般只需要 鼠标/键盘/选择/导航/读取/等待 六类，约 60~80 个命令即可覆盖 90% 录制场景。

### 3.5 分发链路：command-receiver 如何把一条命令跑起来

`content/command-receiver.js` 是 content script 收到的回放消息入口。

#### 3.5.1 两条执行路径

```js
// content/command-receiver.js:49-134（节选）
function doCommands(request, sender, sendResponse, type) {
    if (request.commands) {
        // ... 内部特殊命令：waitPreparation / prePageWait / pageWait / ajaxWait / domWait / 截图 ...
        } else {
            var upperCase = request.commands.charAt(0).toUpperCase() + request.commands.slice(1);
            if (selenium["do" + upperCase] != null) {          // 路径 A：doXxx 直调
                try {
                    document.body.setAttribute("SideeXPlayingFlag", true);
                    let returnValue = selenium["do"+upperCase](request.target, selenium.preprocessParameter(request.value));
                    // ... Promise 异步 / 同步 两分支，最终 sendResponse({result:"success"}) ...
                } catch(e) {
                    sendResponse({result: e.message});
                }
            } else {                                            // 路径 B：factory handler
                // KAT-BEGIN handle Selenium IDE commands
                var command = request;
                if (!command.command) { command.command = command.commands; }
                var handler = commandFactory.getCommandHandler(command.command);
                if (handler == null) {
                    sendResponse({ result: "Unknown command: " + request.commands });
                    return;
                }
                command.target = selenium.preprocessParameter(command.target);
                command.value = selenium.preprocessParameter(command.value);
                var result = handler.execute(selenium, command);
                var waitForCondition = result.terminationCondition;
                continueTestWhenConditionIsTrue(waitForCondition, sendResponse, result);
            }
        }
        return true;   // 异步响应
    }
    // ... selectMode / attachRecorder / detachRecorder ...
}
```

**关键设计**：

- **路径 A（直调）**：仅当 `selenium["do" + 首字母大写命令名]` 存在时走。也就是说 `click`/`type`/`open` 等所有 `do*` 命令都走这条快速通道，`actionName + "AndWait"` 也存在 `doClickAndWait` 原型（factory 在 :99 注册的 `AndWait` 实际上是同一个 `actionBlock`，只是 handler 标记 `wait`）。
- **路径 B（handler）**：`assert*`/`verify*`/`store*`/`waitFor*` 这些「没有 do 原型」的命令走 `commandFactory.getCommandHandler`。
- 两条路径都先 `selenium.preprocessParameter(...)` 处理 `${var}` 与 `javascript{}`（见 3.9）。

#### 3.5.2 waitFor 轮询

```js
// content/command-receiver.js:191-222
function continueTestWhenConditionIsTrue(waitForCondition, sendResponse, result) {
    try {
        if (waitForCondition == null) {
            sendResponse({result: result && result.failed ? 'did not match' : "success"});
        } else if (waitForCondition()) {
            sendResponse({result: "success"});
        } else {
            setTimeout(function() {                       // 每 10ms 轮询一次
                continueTestWhenConditionIsTrue(waitForCondition, sendResponse, result);
            }, 10);
        }
    } catch(e) {
        sendResponse({result: e.message});
    }
}
```

> 轮询间隔是硬编码 `10ms`，无指数退避、无独立超时（超时由 `Selenium.decorateFunctionWithTimeout` 在 factory 的 `_waitForActionForPredicate` :249 包了一层 `defaultTimeout` 控制）。裁剪版建议把 10ms 提到 50~100ms 以降低 CPU 占用。

#### 3.5.3 启动期注册

```js
// content/command-receiver.js:42-45
// KAT-BEGIN register Selenium IDE commands
commandFactory = new CommandHandlerFactory();
commandFactory.registerAll(selenium);
// KAT-END
```

注意这段在 `browser.storage.local.get('extensions', ...)` 的回调里（:31-46），即**扩展脚本加载完才注册命令**。若裁剪版不加载用户扩展，可把注册提前到模块顶层同步执行。

### 3.6 DOM 操作技能：click 是 `element.click()` 还是合成事件？

**结论：Katalon Recorder 走「合成事件」路线，不是原生 `element.click()`。** 目的有二：
1. 可携带 `isTrusted=false` 之外的完整鼠标按键/修饰键状态（`ctrlKey/shiftKey/altKey/metaKey`）；
2. 可依次触发 `mousedown → click → mouseup`，模拟真实人工交互，规避部分站点对 `isTrusted` 的校验差异。

```js
// content/selenium-api.js:536-553
Selenium.prototype.doClick = function (locator) {
    var element = this.browserbot.findElement(locator);
    var elementWithHref = getAncestorOrSelfWithJavascriptHref(element);
    this.browserbot.clickElement(element);                 // 内部 → _fireEventOnElement("click")
    this.browserbot.triggerMouseEvent(element, 'mousedown', true);  // 合成 mousedown
    this.browserbot.triggerMouseEvent(element, 'mouseup', true);    // 合成 mouseup
};
```

`triggerMouseEvent` 的合成实现（非 IE 分支，Chrome 走这里）：

```js
// content/selenium-browserbot.js:291-315
} else {
    var doc = goog.dom.getOwnerDocument(element);
    var view = goog.dom.getWindow(doc);
    evt = doc.createEvent('MouseEvents');
    if (evt.initMouseEvent) {
        evt.initMouseEvent(eventType, canBubble, true, view, 1, screenX, screenY, clientX, clientY,
            this.controlKeyDown, this.altKeyDown, this.shiftKeyDown, this.metaKeyDown,
            button ? button : 0, null);
    } else {
        evt.initEvent(eventType, canBubble, true);
        evt.shiftKey = this.shiftKeyDown; evt.metaKey = this.metaKeyDown;
        evt.altKey = this.altKeyDown; evt.ctrlKey = this.controlKeyDown;
        if (button) { evt.button = button; }
    }
    element.dispatchEvent(evt);     // ← 合成事件 dispatch，非 element.click()
}
```

`clickElement` → `_fireEventOnElement("click")`（:1986-1989），`MozillaBrowserBot._fireEventOnElement`（:2770-2807）还会先 FOCUS 再触发 mouse 事件序列。

> **裁剪提示**：如果你的个人插件只跑现代站点，且不需要模拟完整鼠标序列，可以直接 `element.click()` + 必要修饰键注入，省掉 `triggerMouseEvent` 一整套。但这意味着放弃对「依赖 mousedown/mouseup 顺序」的交互（如拖拽、某些自定义组件）的兼容。

#### 3.6.1 type 输入：逐字符下发 + 文件上传特例

```js
// content/selenium-api.js:978-1049（节选关键路径）
Selenium.prototype.doType = function (locator, value) {
    var element = this.browserbot.findElement(locator);
    if (element.tagName === 'INPUT' && element.type === 'file') {
        // 文件上传走专用通道（不直接setValue）
        ...
    } else {
        element.scrollIntoViewIfNeeded();
        if (element.getValue && element.getValue() !== value) { /* 先清 */ }
        core.events.setValue(element, value);   // 逐字符 setValue 触发 input/change
        bot.action.type(element, value);
    }
}
```

`type` 不是一次性 `element.value = x`，而是 `core.events.setValue` 模拟逐字符输入并派发 `input`/`change`，以兼容 React/Vue 等受控组件（它们劫持 `value` setter，直接赋值不触发状态更新）。这点在裁剪版务必保留，否则现代 SPA 输入框会「填了但提交为空」。

### 3.7 locator 字符串解析

#### 3.7.1 前缀协议

`parse_locator`（`content/utils.js:1061-1073`）把 `"id=foo"`、`"xpath=//a"`、`"css=.btn"` 拆成 `{type, string}`：

```js
// content/utils.js:1061-1073
function parse_locator(locator) {
    if (locator.includes("d-XPath")) {                       // 录制自愈占位
        return { type: 'tac', string: locator };
    } else {
        var result = locator.match(/^([A-Za-z]+)=.+/);       // 取 "id=" 前缀
        if (result) {
            var type = result[1].toLowerCase();              // id / name / xpath / css / link / dom / stored / webdriver
            var actualLocator = locator.substring(type.length + 1);
            return { type: type, string: actualLocator };
        }
        return { type: 'implicit', string: locator };        // 无前缀 → implicit
    }
}
```

#### 3.7.2 支持的 locator 前缀

注册自 `_registerAllLocatorFunctions`（:1379-1420）扫描 `locateElementBy*` 方法：

| 前缀 | 解析方法 | 行 | 说明 |
|---|---|---|---|
| `id=` | `locateElementById` | 1670 | `getElementById` 且 `id` 属性严格相等 |
| `name=` | `locateElementByName` | 1700 | `getElementsByName` |
| `identifier=` | `locateElementByIdentifier` | 1661 | id 优先，失败回退 name |
| `dom=` | `locateElementByDomTraversal` | 1725 | `document.xxx.yyy` JS 表达式 |
| `xpath=` | `locateElementByXPath` | 1773 | `document.evaluate` |
| `link=` | `locateElementByLinkText` | 1837 | 精确链接文本 |
| `css=` | `locateElementByCss` | 2247 | `querySelector` |
| `stored=` | `locateElementByStoredReference` | 1750 | 引用 store 存过的元素（`.element` 后缀） |
| `webdriver=` | `locateElementByWebDriver` | 1760 | 转 WebDriver By 策略 |
| `class=` | `locateElementByClass` | 2225 | 类选择（非标准前缀） |
| `alt=` | `locateElementByAlt` | 2236 | alt 属性（非标准前缀） |
| （无前缀） | implicit | 1410 | `//`→xpath；`document.`→dom；否则 identifier |

```js
// content/selenium-browserbot.js:1410-1418 implicit 兜底
this.locationStrategies['implicit'] = function(locator, inDocument, inWindow) {
    if (locator.startsWith('//')) {
        return this.locateElementByXPath(locator, inDocument, inWindow);
    }
    if (locator.startsWith('document.')) {
        return this.locateElementByDomTraversal(locator, inDocument, inWindow);
    }
    return this.locateElementByIdentifier(locator, inDocument, inWindow);
};
```

#### 3.7.3 查找失败与 TAC 占位

```js
// content/selenium-browserbot.js:1619-1629
BrowserBot.prototype.findElement = function(locator, win) {
    var element = this.findElementOrNull(locator, win);
    if (element == null) {
        if (locator.includes("d-XPath")) {
            throw new SeleniumError("Element located by TAC not found");
        } else if (locator == "auto-located-by-tac") {
            throw new SeleniumError("The value \"auto-located-by-tac\" only can be automatically generated when recording a command");
        } else throw new SeleniumError("Element " + locator + " not found");
    }
    return core.firefox.unwrap(element);
};
```

> `d-XPath...` 与 `auto-located-by-tac` 是**录制期**由自愈/候选择定位器模块塞进 target 的占位字符串（详见 TECH-02），回放时它们本应已被替换为真实 locator；若还带着这两个值，说明录制数据未规范化，引擎会抛专属错误。`findElementOrNull`（:1599-1617）先 `parse_locator` 再 `findElementBy` 分派，找到后还会 `highlight(element)` 高亮。

### 3.8 frame / window 切换

#### 3.8.1 selectFrame

```js
// content/selenium-api.js:1520-1534
Selenium.prototype.doSelectFrame = function (locator) {
    this.browserbot.selectFrame(locator);
}
```
`browserbot.selectFrame`（:525-569）支持三种 locator：`index=0`、相对 `relative=parent`/`relative=top`、或普通 locator 表达式（先 `findElement` 再切到该 frame 的 window）。切帧后，后续 `findElement` 都在新 frame 的 document 内查找——这是「不需要递归进 frame 查找」的设计（见 :1605-1607 注释）。

#### 3.8.2 selectWindow

```js
// content/selenium-api.js:1435-1485
Selenium.prototype.doSelectWindow = function (windowID) {
    this.browserbot.selectWindow(windowID);
}
```
`browserbot.selectWindow`（:449-477）按前缀解析：`title=`（窗口标题）、`name=`（窗口 name）、`var=`（storedVars 里存的 window 引用）。`selectPopUp`/`deselectPopUp` 处理模态弹窗。

> 裁剪版若不需要多窗口/多帧，可直接删除 3.8 全部分支，能省掉 browserbot 里约 150 行与 `getWhetherThisFrameMatchFrameExpression`（:1536）等配套逻辑。

### 3.9 变量替换与脚本求值（preprocessParameter）

每条命令的 target/value 在分发前都过一遍 `preprocessParameter`：

```js
// content/selenium-api.js:2949-2985
Selenium.prototype.preprocessParameter = function (value) {
    var match = value.match(/^javascript\{((.|\r?\n)+)\}$/);   // javascript{...} 求值
    if (match && match[1]) {
        var result = eval(trustedPolicy.createScript(match[1]));
        return result == null ? null : result.toString();
    }
    return this.replaceVariables(value);                        // 否则替换 ${var}
};

Selenium.prototype.replaceVariables = function (str) {
    var match = str.match(/\$\{\w+\}/g);
    if (!match) return str;
    for (var i = 0; match && i < match.length; i++) {
        var variable = match[i];
        var name = variable.substring(2, variable.length - 1);
        var replacement = storedVars[name];                     // 从全局变量袋读
        ...
        if (replacement != undefined) {
            stringResult = stringResult.replace(variable, replacement);
        }
    }
    return stringResult;
};
```

- `javascript{...}`：把大括号内容当 JS `eval` 执行（走 `trustedPolicy.createScript` 可信脚本策略，MV3 的 CSP 要求）。
- `${var}`：用 `storedVars[name]` 替换。`storedVars` 定义在 `selenium-api.js:20`：`var storedVars = new Object();`，由 `store*` 命令写入（见 3.2.6）。

### 3.10 错误与超时处理

**错误类型**：
- `findElement` 抛 `SeleniumError("Element ... not found")` —— 元素缺失（:1626）。
- 断言失败抛 `AssertionFailedError`（带 `isAssertionFailedError` 标记），`AssertHandler.execute`（:363-379）捕获后：若 `haltOnFailure`（assert 系列）则转成 `SeleniumError` 上抛终止回放；`verify` 系列只标记 `result.setFailed` 不终止。
- `waitFor` 命令本身不抛错，靠 `_waitForActionForPredicate` 里的 `decorateFunctionWithTimeout`（:249）在超时后让 terminationCondition 返回 true → 走到 `continueTestWhenConditionIsTrue` 的 `waitForCondition()` 为 true 分支，但 result.failed 标记失败（:204-205 返回 "Failure message: ..."）。

**超时来源**：
- `setTimeout` 命令（`doSetTimeout`，:2884）→ `Selenium.defaultTimeout`。
- `waitFor*` 的 `defaultTimeout` 来自 `commandFactory.defaultTimeout`（factory 实例字段，未在源码显式初值，推测默认 30s，实测需追溯到 `Selenium.defaultTimeout`）。

> 未在源码中找到 `commandFactory.defaultTimeout` 的显式赋值，推测：继承自 Selenium 的 `defaultTimeout`（Selenium IDE 惯例 30000ms）。裁剪版应显式设置该常量，避免 `undefined` 导致 `decorateFunctionWithTimeout` 行为异常。

---

## ④ 数据结构 / 状态机 / 时序图

### 4.1 命令 handler 注册表（运行时结构）

```
CommandHandlerFactory.handlers = {
  "click":        ActionHandler,        // 来自 doClick
  "clickAndWait": ActionHandler,        // 来自 doClick（wait 标记）
  "getText":      AccessorHandler,      // 来自 getText
  "storeText":    ActionHandler,        // 来自 getText 派生
  "assertText":   AssertHandler(halt),  // 来自 getText 派生
  "verifyText":   AssertHandler(nohalt),// 来自 getText 派生
  "waitForText":  ActionHandler,        // 来自 getText 派生（带 terminationCondition）
  ...
}
```

每个 handler 形态（来自 `selenium-commandhandlers.js`）：
- `ActionHandler`：`{actionBlock, wait?, checkAlerts}`（:304-312）
- `AccessorHandler`：`{accessBlock}`（:334-337）
- `AssertHandler`：`{assertBlock, haltOnFailure}`（:358-361）

### 4.2 命令执行结果类型

```
ActionResult   { terminationCondition }            // :330-332
AccessorResult { result | terminationCondition }   // :344-353
AssertResult   { passed=true / failed / failureMessage }  // :381-389
```

`terminationCondition` 是 `waitFor` 与 `AndWait` 命令的关键：返回函数，回放循环反复调用直到 `true` 或抛错（见 3.5.2）。

### 4.3 回放单命令时序图

```
panel/background ──sendMessage──▶ command-receiver.doCommands(request)
                                         │
                           ┌─────────────┴─────────────┐
                     request.commands 首字母大写    是否命中 selenium["doXxx"]
                           │                                │
                    路径 A（action）                  路径 B（assert/verify/store/waitFor）
                           │                                │
              preprocessParameter(target/value)    preprocessParameter(target/value)
                           │                                │
              selenium["doXxx"](target,value)      commandFactory.getCommandHandler(name)
                           │                        .execute(selenium, command)
                  ┌────────┴────────┐                      │
              同步返回 / Promise                    返回 ActionResult/AccessorResult/AssertResult
                           │                                │
                  browserbot.findElement           若有 terminationCondition →
                  triggerMouseEvent(合成)          continueTestWhenConditionIsTrue(轮询10ms)
                          ...                               │
                           │                                │
                    sendResponse({result}) ◀──────── sendResponse({result})
```

### 4.4 locator 解析状态机

```
输入 locator 字符串
   │
   ├─ includes("d-XPath") ? ──▶ {type:"tac", string:locator}  (TAC 占位)
   │
   ├─ 匹配 /^([A-Za-z]+)=.+/ ? ──▶ {type: 前缀小写, string: 去掉前缀}
   │         │
   │         └─ type ∈ {id,name,dom,xpath,link,css,stored,webdriver,class,alt}
   │
   └─ 否则 ──▶ {type:"implicit", string:locator}
                   │
                   ├─ startsWith("//")      → xpath
                   ├─ startsWith("document.")→ dom
                   └─ 其他                  → identifier(id→name)
```

---

## ⑤ 隐晦知识点与坑（独立章节）

### 坑 #1：两套命令派生逻辑并存，改一处漏一处
`CommandHandlerFactory`（content 域，决定「能否执行」）与 `kar-loadCommand._loadSeleniumCommands`（panel 域，决定「下拉框显示什么」）各自实现了一遍 assert/verify/store/waitFor/Not 派生。两边命名约定刻意对齐，但**代码完全独立**。若在 factory 加新命令家族却忘了同步 kar-loadCommand，会出现「命令能跑但不出现在下拉框」或反之。

### 坑 #2：`assert*` 在原型上为零，但 `doAssert*` 是 action 特例
新手 grep `Selenium.prototype.assert` 会以为项目支持原生 assert 命令；实际所有 `assert*` 都是 factory 从 `get/is` 派生。而 `doAssertText`（:352）、`doAssertAlert`（:3822）等是**带 `do` 前缀的 action**，内部硬编码断言逻辑，走路径 A 直调，绕过了 factory 的 assert 派生体系。这会让人误以为「改 factory 就能影响 assertText」——其实不影响。

### 坑 #3：`click` 不是 `element.click()`
见 3.6。直接改用原生 `element.click()` 会丢失 mousedown/mouseup 序列与修饰键，可能破坏依赖事件顺序的站点（拖拽、自定义组件）。反过来，合成事件产生 `isTrusted=false`，个别站点的反机器人校验可能因此失败——这是取舍点。

### 坑 #4：`AndWait` 两处规则不一致
factory 给**所有** `do*` 都加 `AndWait`（:99），而 kar-loadCommand 用 `nonWaitActions` 名单（:5）排除 `open/selectWindow/...` 等。但 factory 的 `AndWait` 实际只是复用同一 `actionBlock` 并设 `wait=true`；`open` 等命令即使被 factory 注册了 `openAndWait`，其 `actionBlock` 内部是否真等页面加载取决于 `makePageLoadCondition`。两套规则在「哪些命令该有 AndWait」上语义不等价，UI 与引擎可能给出不同命令集。

### 坑 #5：`store*` 通过 `browser.runtime.sendMessage` 回写 UI
`selenium-commandhandlers.js:274/279` 每个 store 命令执行后都向 background 发消息同步变量。这是为 panel 实时显示变量值。裁剪版若删掉 background 通道但保留 sendMessage，会因无监听而静默失败（不影响命令本身，但变量不显示）。更糟的是若 MV3 service worker 未常驻，消息可能丢失。

### 坑 #6：waitFor 轮询硬编码 10ms
`command-receiver.js:211` `setTimeout(..., 10)`。长 waitFor（如等一个异步加载的列表）会每 10ms 跑一次 predicate，CPU 占用高。建议 50~100ms。

### 坑 #7：`preprocessParameter` 对 `javascript{}` 用 `eval`
`selenium-api.js:2952` 直接 `eval(trustedPolicy.createScript(match[1]))`。`trustedPolicy` 是 MV3 的 Trusted Types 策略，降低了 XSS 风险，但录制数据若被篡改（如导入恶意 .side），`javascript{}` 仍可执行任意 JS。裁剪版若面向不可信数据源，应禁用 `javascript{}` 或加白名单。

### 坑 #8：`findElement` 的 TAC 占位专属错误
`auto-located-by-tac` 与 `d-XPath` 是录制期占位（TECH-02）。若命令数据未被规范化就回放，会触发 `selenium-browserbot.js:1622-1625` 的专属错误。这提示：回放前应在 UI/序列层把占位 locator 替换为真实 locator（自愈模块职责），否则必失败。

### 坑 #9：`requiresTarget` 决定 store 参数顺序
`_registerStoreCommandForAccessor`（:271-281）依据 `accessMethod.length == 1` 判断 accessor 是否需要 target：`getText(target)` 需要 target，store 签名 `(target, varName)`；`getTitle()` 不需要 target，store 签名 `(varName)`。若你新增 accessor 但参数个数写错（如多一个可选参数），`requiresTarget` 判断会翻转，导致 `storeTitle` 把 varName 当 target。纯靠 `function.length` 推断，脆弱。

### 坑 #10：accessor 返回数组被 `selArrayToString` 拍平
`_predicateForSingleArgAccessor`（:143）用 `selArrayToString(accessorResult)` 把数组转字符串再 `PatternMatcher.matches`。这意味着 `getSelectedLabels` 返回的多选值会被拼成字符串做模式匹配，与直觉的「数组比较」不同。裁剪版若自定义比较逻辑需注意。

### 坑 #11：assert 失败「halt」与否由 handler 决定，不由命令名前缀单一控制
`assert*` → `haltOnFailure=true`，`verify*` → `false`（:226-227）。但 `doAssertText` 这种 action 特例的 halt 行为写在它自己的实现里，与 factory 无关。控制流层（play-actions-service）解释 `if/while` 时还要消费 assert 结果决定跳转——三处 halt 语义需对齐。

### 坑 #12：控制流命令不在 command-receiver 处理
`if / while / gotoIf / label / loadVars` 等（kar-loadCommand:44-55 追加）在回放层 `play-actions-service.js:575-695` 解释执行，不走 `doCommands` 的通用分发。意味着：录制的数据模型里这些命令是「一等公民命令」，但在 content script 里它们根本不会进 `selenium["doXxx"]` 也不会进 factory——回放引擎在更上层拦截。裁剪版若想支持控制流，必须自己实现解释器，不能依赖本模块。

### 坑 #13：扩展脚本在注册命令前加载
`command-receiver.js:29-47` 注册 `commandFactory` 在 `browser.storage.local.get('extensions')` 回调内。若你同步调用回放（如测试），命令可能尚未注册，`getCommandHandler` 返回 null → "Unknown command"。裁剪版应把注册提升为同步模块初始化。

### 坑 #14：`storedVars` 是全局可变单例
`selenium-api.js:20` `var storedVars = new Object()` 跨所有用例共享。一个用例里 `store` 的变量会泄漏到后续用例，造成用例间隐式耦合（测试污染）。现代测试框架应为每用例 isolate 变量袋；本工程无此隔离。

---

## ⑥ 裁剪建议（保留 / 删除 / 替换 三分类）

### 6.1 保留（核心，缺一不可）

| 模块 | 文件:行 | 理由 |
|---|---|---|
| 命令分发入口 | `command-receiver.js:49-134` | 回放消息总入口，路径 A/B 必须保留 |
| 命令注册工厂 | `selenium-commandhandlers.js:44-285` | assert/verify/store/waitFor 派生魔法，删则命令集崩塌 |
| action 注册 | `selenium-commandhandlers.js:90-102` | do* → action + AndWait |
| 元素查找 | `selenium-browserbot.js:1599-1629` | findElement 是 DOM 真相源 |
| locator 解析 | `utils.js:1061-1073` | 前缀协议必须保留 |
| 变量袋 | `selenium-api.js:20` `storedVars` | store/${var} 系统核心 |
| 变量替换 | `selenium-api.js:2949-2985` | ${var} 与 javascript{} 处理 |
| 鼠标合成 | `selenium-browserbot.js:291-315` | 模拟真实交互（或替换见下） |
| 输入模拟 | `selenium-api.js:978` `doType` 的 `core.events.setValue` | SPA 受控组件兼容必须 |

### 6.2 删除（个人插件用不到）

| 模块 | 文件:行 | 理由 |
|---|---|---|
| 用户扩展脚本加载 | `command-receiver.js:29-47` eval 扩展 | 个人插件无需可插拔扩展，且 eval 有安全风险 |
| 截图命令 | `selenium-api.js:3229` captureEntirePageScreenshot | 非录制回放必需，且依赖 offscreen/debugger |
| 弹窗处理全套 | `getAlert/getConfirmation/getPrompt` :1766-1849 | 简单回放一般不需自动处理原生弹窗 |
| 多窗口/帧切换 | `doSelectWindow`/`doSelectFrame` :1435/1520 | 单页应用可删，省 ~150 行 |
| 非标准 locator | `class=`/`alt=` :2225/2236 | 非 Selenium 标准，个人插件可弃 |
| 录制期 TAC 占位逻辑 | `selenium-browserbot.js:1622-1625` | 若回放前已规范化 locator，可删专属错误分支（保留 implicit 即可） |
| 帮助文档加载 | `kar-loadCommand.js:78-88` iedoc-core.xml ajax | 纯 UI 帮助，无回放价值 |
| rollup / addLocationStrategy | `selenium-api.js:3485`/`3188` | 高级用户脚本，个人插件用不到 |
| 控制流解释器（若不需要） | `play-actions-service.js:575-695` | 不需要 if/while 可整段删 |

### 6.3 替换（更现代/更安全的实现）

| 原实现 | 文件:行 | 替换为 |
|---|---|---|
| 合成事件 `triggerMouseEvent` | `selenium-browserbot.js:252-316` | 现代站点可换 `element.click()` + `element.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))` 精简版，省掉 IE 分支 |
| `eval(trustedPolicy.createScript(...))` | `selenium-api.js:2952` | 用 `new Function(...)` 或禁用 `javascript{}`，面向不可信数据 |
| 手写 UUID / 变量袋 | `storedVars` 全局单例 | 用例级 isolate 的 `Map`，避免测试污染（坑 #14） |
| `decorateFunctionWithTimeout` 隐性默认超时 | factory `defaultTimeout` | 显式常量 `PLAYBACK_TIMEOUT = 30000` |
| `setTimeout(...,10)` 轮询 | `command-receiver.js:211` | 改为 50~100ms + 指数退避上限 |
| 两套命令派生 | factory + kar-loadCommand | 抽一个 `buildCommandRegistry(Selenium)` 同时服务 UI 与引擎 |
| `browser.runtime.sendMessage` 回写变量 | `selenium-commandhandlers.js:274` | 改为回调/事件总线，避免 service worker 未常驻丢消息 |

### 6.4 体量估算

| 取舍档 | 保留命令数 | 预计保留代码 |
|---|---|---|
| 全量 | 153 原型 + ~800 派生 | content 域 ~7000 行 |
| 标准档（推荐） | ~70 命令 | ~2500 行 |
| 极简档 | ~30 命令（click/type/open/assertText/verify*/waitFor*） | ~1200 行 |

---

## ⑦ 最小可用实现（MVP 代码骨架）

目标：一个能「录制 → 回放 click/type/open/store/assertText」的极简命令执行层。**只写骨架，不替换源码。**

### 7.1 命令注册表（合并两套派生，单源）

```js
// mvp/command-registry.js
// 单源派生：action 原型的 do* → action + AndWait；get/is* → accessor + store/assert/verify/waitFor/Not
export class CommandRegistry {
  constructor(selenium) {
    this.selenium = selenium;
    this.handlers = new Map();
    this.registerAll();
  }

  registerAll() {
    const proto = Object.getPrototypeOf(this.selenium);
    for (const name of Object.getOwnPropertyNames(proto)) {
      const fn = proto[name];
      if (typeof fn !== 'function') continue;
      let m;
      if ((m = /^do([A-Z].+)$/.exec(name))) {
        const action = name[2].toLowerCase() + name.slice(3);   // doClick → click
        this.handlers.set(action, { kind: 'action', run: fn.bind(this.selenium) });
        this.handlers.set(action + 'AndWait', { kind: 'action', run: fn.bind(this.selenium), wait: true });
      } else if ((m = /^(get|is)([A-Z].+)$/.exec(name))) {
        const base = m[2];
        const access = fn.bind(this.selenium);
        const requiresTarget = fn.length === 1;
        // accessor 本体
        this.handlers.set((m[1] === 'get' ? 'get' : 'is') + base, { kind: 'accessor', run: access, requiresTarget });
        // store
        this.handlers.set('store' + base, { kind: 'store', access, requiresTarget, base });
        // assert / verify / Not
        this.handlers.set('assert' + base, { kind: 'assert', access, requiresTarget, halt: true });
        this.handlers.set('verify' + base, { kind: 'assert', access, requiresTarget, halt: false });
        this.handlers.set('waitFor' + base, { kind: 'waitFor', access, requiresTarget });
      }
    }
  }

  get(name) { return this.handlers.get(name); }
}
```

### 7.2 Selenium 极简命令实现

```js
// mvp/selenium.js
const storedVars = new Map();           // 用例级隔离见 6.3
const PLAYBACK_TIMEOUT = 30000;

export class Selenium {
  constructor(bot) { this.bot = bot; }   // bot = 极简 browserbot

  doOpen(url) { this.bot.open(url); }
  doClick(locator) { this.bot.click(locator); }
  doType(locator, value) { this.bot.type(locator, value); }

  getText(locator) { return this.bot.findElement(locator).textContent; }
  isChecked(locator) { return this.bot.findElement(locator).checked; }
  getTitle() { return this.bot.doc.title; }

  // ${var} 替换
  preprocess(value) {
    if (typeof value !== 'string') return value;
    return value.replace(/\$\{(\w+)\}/g, (_, k) =>
      storedVars.has(k) ? storedVars.get(k) : '');
  }
}
```

### 7.3 极简 browserbot（合成事件 + locator 解析）

```js
// mvp/browserbot.js
import { parseLocator } from './locator.js';

export class BrowserBot {
  constructor(doc) { this.doc = doc; }

  open(url) { location.href = url; }     // 演示用，真实需等 load

  findElement(locator) {
    const { type, str } = parseLocator(locator);
    let el;
    switch (type) {
      case 'id':    el = this.doc.getElementById(str); break;
      case 'css':   el = this.doc.querySelector(str); break;
      case 'xpath': el = this.doc.evaluate(str, this.doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; break;
      case 'name':  el = this.doc.getElementsByName(str)[0]; break;
      case 'link':  el = [...this.doc.querySelectorAll('a')].find(a => a.textContent.trim() === str); break;
      default:      el = this.doc.getElementById(str) || this.doc.querySelector(str);
    }
    if (!el) throw new Error('Element not found: ' + locator);
    return el;
  }

  click(locator) {
    const el = this.findElement(locator);
    el.scrollIntoView({ block: 'center' });
    el.focus();
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.click();                           // 现代浏览器可用原生 click 触发 click 序列
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  }

  type(locator, value) {
    const el = this.findElement(locator);
    const setter = Object.getOwnPropertyDescriptor(el, 'value')?.set
                || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);              // 触发受控组件 value setter
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
```

### 7.4 locator 解析（单源）

```js
// mvp/locator.js
export function parseLocator(locator) {
  if (!locator) return { type: 'implicit', str: locator };
  const m = /^([a-zA-Z]+)=(.+)$/.exec(locator);
  if (m) return { type: m[1].toLowerCase(), str: m[2] };
  if (locator.startsWith('//')) return { type: 'xpath', str: locator };
  return { type: 'implicit', str: locator };
}
```

### 7.5 回放执行器（合并路径 A/B + waitFor 轮询）

```js
// mvp/player.js
import { CommandRegistry } from './command-registry.js';
import { Selenium } from './selenium.js';
import { BrowserBot } from './browserbot.js';

export class Player {
  constructor(doc) {
    this.selenium = new Selenium(new BrowserBot(doc));
    this.registry = new CommandRegistry(this.selenium);
  }

  async run(commands) {
    for (const cmd of commands) {
      await this.runOne(cmd);
    }
  }

  async runOne(cmd) {
    const name = cmd.command.trim();
    const h = this.registry.get(name);
    if (!h) throw new Error('Unknown command: ' + name);

    const target = this.selenium.preprocess(cmd.target);
    const value = this.selenium.preprocess(cmd.value);

    if (h.kind === 'action') {
      h.run(target, value);
      // 真实环境在此 await 页面加载（h.wait）
    } else if (h.kind === 'accessor') {
      return h.run(target);
    } else if (h.kind === 'store') {
      const v = h.requiresTarget ? h.access(target) : h.access();
      storedSet(h.base, v);
    } else if (h.kind === 'assert') {
      const actual = h.requiresTarget ? String(h.access(target)) : String(h.access());
      const ok = actual.includes(value);     // 简化版 PatternMatcher
      if (!ok && h.halt) throw new Error(`assert ${name} failed: got "${actual}"`);
      if (!ok) console.warn(`verify ${name} failed: got "${actual}"`);
    } else if (h.kind === 'waitFor') {
      await this.poll(() => {
        const actual = h.requiresTarget ? String(h.access(target)) : String(h.access());
        return actual.includes(value);
      });
    }
  }

  poll(cond, timeout = 30000, interval = 50) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        let ok = false;
        try { ok = cond(); } catch { ok = false; }
        if (ok) return resolve();
        if (Date.now() - start > timeout) return reject(new Error('waitFor timeout'));
        setTimeout(tick, interval);
      };
      tick();
    });
  }
}
```

### 7.6 与数据模型（TECH-08）的衔接

```js
// mvp/index.js
import { Player } from './player.js';
import { KRData } from './model.js';   // 见 TECH-08 MVP 的 TestData/TestCase/TestCommand

export function playbackTestCase(testCase, doc) {
  const player = new Player(doc);
  // TestCommand → {command, target, value}
  return player.run(testCase.commands.map(c => ({
    command: c.name, target: c.defaultTarget, value: c.value
  })));
}
```

> 该 MVP 覆盖了：命令单源派生（解决坑 #1）、合成/原生 click 可选（坑 #3）、locator 单源解析（3.7）、变量袋隔离（坑 #14）、waitFor 轮询可配间隔（坑 #6）、assert/verify halt 区分（坑 #11）。未覆盖：frame/window 切换、弹窗、截图、控制流解释器（坑 #12，需另写 if/while 解释层）。

---

## 附：关键行号速查表

| 机制 | 文件:行 |
|---|---|
| 命令分发入口 | `content/command-receiver.js:49` |
| doXxx 直调路径 | `content/command-receiver.js:78-82` |
| handler 工厂路径 | `content/command-receiver.js:109-133` |
| waitFor 轮询 10ms | `content/command-receiver.js:211` |
| 命令工厂类 | `content/selenium-commandhandlers.js:44` |
| 注册三入口 | `content/selenium-commandhandlers.js:121-125` |
| action 派生 + AndWait | `content/selenium-commandhandlers.js:90-102` |
| accessor 派生 | `content/selenium-commandhandlers.js:67-88` |
| 断言派生（assert/verify/Not） | `content/selenium-commandhandlers.js:222-233` |
| waitFor 派生 | `content/selenium-commandhandlers.js:253-267` |
| store 派生 + 回写 UI | `content/selenium-commandhandlers.js:269-283` |
| NotPresent 特判 | `content/selenium-commandhandlers.js:214-220` |
| doClick 合成点击 | `content/selenium-api.js:536-553` |
| doType 输入 | `content/selenium-api.js:978` |
| storedVars 全局袋 | `content/selenium-api.js:20` |
| preprocessParameter | `content/selenium-api.js:2949-2956` |
| replaceVariables | `content/selenium-api.js:2962-2985` |
| 鼠标合成事件 | `content/selenium-browserbot.js:252-316` |
| locator 策略注册 | `content/selenium-browserbot.js:1379-1420` |
| implicit 兜底 | `content/selenium-browserbot.js:1410-1418` |
| findElement 失败专属错误 | `content/selenium-browserbot.js:1619-1629` |
| parse_locator | `content/utils.js:1061-1073` |
| UI 命令清单枚举 | `panel/js/katalon/kar-loadCommand.js:2-76` |
| AndWait 排除名单 | `panel/js/katalon/kar-loadCommand.js:5` |
| 控制流在回放层 | `playback/service/play-actions-service.js:575-695` |

---

> 本文档所有结论均可追溯到上述 `文件:行号`；未在源码中找到显式证据处已标注「推测」。裁剪时请对照 TECH-08（数据模型与持久化）一并实施，两者经 `<datalist>` 候选定位器与 `auto-located-by-tac` 占位字符串衔接。
