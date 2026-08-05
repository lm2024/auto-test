---
name: kr-playback-engine
description: Katalon Recorder 回放引擎（Playback）专家。用于逆向理解、裁剪或排障浏览器扩展录制回放插件的「命令调度 + 跨进程投递 + 页面稳定性等待 + 流程控制 + 变量系统」能力。
keywords: [katalon-recorder, playback, executionLoop, selenium-api, command-handler, mv3, 回放引擎, 命令派生, 等待流水线, 跨进程通信]
---

# KR Playback Engine 技能

你是一位精通 Katalon Recorder 7.1.0（MV3）**回放引擎**的架构师。
本技能帮助你**逆向理解、裁剪、排障**这套引擎，用于构建个人录制回放插件。

> 源码根目录（只读）：`c:\Users\Li\Downloads\GitHub\auto-test\doc\老师\KatalonRecorder\7.1.0_0\`
> 配套文档：`_distill/tech/TECH-03-回放引擎.md`（源码剖析）、`_distill/prd/PRD-03-回放引擎.md`（需求）、`_distill/prompts/PROMPT-03-回放引擎.md`（提示词）

---

## 一、何时使用本技能

- 需要理解「点一下 Play 之后，一条命令是怎么跑到页面上的」。
- 要给个人插件实现回放：命令调度、跨进程投递、等待策略、变量替换。
- 回放卡死 / 超时 / 命令不生效 / 变量不替换 / 弹窗阻塞 —— 排障。
- 要给引擎新增一条自定义命令，想知道最省事的写法。
- 要判断哪些模块可以砍掉（外部 Socket 回放、CDP 越权、数据驱动）。

**不适用**：定位器生成规则与自愈算法（→ `kr-locator-selfhealing`）、录制事件采集（→ `kr-recorder-engine`）。

---

## 二、心智模型（Java 类比）

```
play-actions.js              ≈  TestRunner（主控 + Promise 状态机 + 流程控制）
window-controller.js         ≈  RemoteWebDriver（会话/窗口/Frame + RPC 发送）
common/promise-utils.js      ≈  Spring @Retryable
command-receiver.js          ≈  RemoteWebDriver Server 端 dispatcher
selenium-api.js              ≈  WebDriver 命令实现（153 个方法本体）
selenium-commandhandlers.js  ≈  注解处理器（153 个方法 → 629 条命令，编译期式派生）
formatCommand.js             ≈  变量上下文 + 占位符解析器
SandboxEvaluator.js          ≈  受限的脚本引擎（MV3 下唯一能 eval 的地方）
```

**一句话**：一个跑在扩展 Panel 页面里的 **Promise 递归状态机**，把命令数组逐条经 `chrome.tabs.sendMessage` 投递到目标 Frame，Content 侧反射调用 `doXxx` 落地 DOM；每条业务命令之前强制插入 5 个内部等待命令确认页面稳定。

---

## 三、四个进程环境（必须先分清）

| 环境 | 代表文件 | 能力 | 限制 |
|---|---|---|---|
| **Panel 页面** | `play-actions.js`、`window-controller.js`、`formatCommand.js` | 扩展 API、持有 tabId/frameId、UI | **MV3 禁止 `eval`/`new Function`** |
| **Content Script**（isolated world） | `command-receiver.js`、`selenium-api.js`、`selenium-commandhandlers.js` | 访问 DOM、**可以 eval** | 拿不到页面 JS 变量、无扩展特权 API |
| **Service Worker** | `background/kar.js` | `chrome.debugger` CDP、截图 | 无 DOM |
| **Page 上下文**（`<script>` 注入） | `page/prompt.js`、`page/runScript.js` | 改写 `window.alert` 等页面全局 | 无扩展 API |

> 90% 的「我加了 console.log 但没打印」都是**上下文选错**。DevTools Console 左上角要切对上下文。

---

## 四、核心决策树

### 决策树 1：我该在哪个文件动手？

```
我要做的事是……
│
├─ 改「命令怎么调度 / 什么时候执行下一条」
│   └─► panel/js/background/playback/service/actions/play/play-actions.js:539-682
│
├─ 改「命令怎么发到页面 / 发给哪个 Frame」
│   └─► panel/js/background/window-controller.js:142-158
│
├─ 改「命令收到后怎么派发」
│   └─► content/command-receiver.js:49-188
│
├─ 新增/修改「一条命令的具体行为」
│   └─► content/selenium-api.js（按 doXxx / getXxx / isXxx 命名即可自动注册）
│
├─ 改「一个方法能派生出哪些命令变体」
│   └─► content/selenium-commandhandlers.js:67-125
│
├─ 改「UI 命令下拉框里有哪些命令」
│   └─► panel/js/katalon/kar-loadCommand.js:7-62
│
├─ 改「${变量} 怎么替换」
│   ├─ 下发前（Panel）─► panel/js/background/formatCommand.js:5-47
│   └─ 执行时（Content）─► content/selenium-api.js:2962
│
├─ 改「if / while 怎么跑」
│   └─► play-actions.js:1114-1265（拦截）+ panel/js/katalon/kar.js:597-611（求值）
│
├─ 改「等多久算页面稳定了」
│   ├─ Content 侧判定 ─► content/selenium-api.js:419-534
│   └─ Panel 侧超时  ─► play-actions.js:831-933
│
├─ 改「弹窗怎么自动应答」
│   └─► page/prompt.js:118-283
│
└─ 改「截图 / 上传 / 真实按键」
    └─► background/kar.js:61-169
```

### 决策树 2：新增一条命令该用什么前缀？

```
我的命令……
│
├─ 有副作用（点击、输入、导航）
│   └─► 写 Selenium.prototype.doFoo
│       自动得到：foo、fooAndWait               （规则② :90-102）
│
├─ 只读取值（返回字符串/数字）
│   └─► 写 Selenium.prototype.getFoo
│       自动得到 8 条：getFoo storeFoo assertFoo verifyFoo
│                     assertNotFoo verifyNotFoo waitForFoo waitForNotFoo
│                                                （规则① :67-88）
│
├─ 只读取值（返回布尔）
│   └─► 写 Selenium.prototype.isFoo
│       同上 8 条
│       ⚠ 若命名形如 isFooPresent，反义是 assertFooNotPresent
│         （不是 assertNotFooPresent）           （kar-loadCommand.js:26-35）
│
├─ 改变会话上下文（切窗口 / 切 frame / 关页面 / 暂停）
│   └─► 加进 play-actions.js:1489 的 isExtCommand
│       并在 window-controller.js 实现
│
├─ 流程控制（if / while / goto）
│   └─► 在 play-actions.js:965-1459 的 runCommand 加拦截分支
│       并手工 push 到 kar-loadCommand.js:39-62
│
└─ 需要文件/网络/特权 API
    ├─ Panel 侧能做 ─► 仿 execute-storeCSV.js 写独立执行器
    └─ 需要 CDP    ─► 仿 background/kar.js:61-157
```

### 决策树 3：回放出问题了，先看哪里？

```
现象是……
│
├─ 日志出现 'Retry failed'
│   └─► 【跨进程通信超时】60×500ms=30s 耗尽
│       window-controller.js:142-158 + common/promise-utils.js
│       查：tabId/frameId 是否还在、页面是否禁止注入、CSP
│       ⚠ 这不是元素定位问题，别往定位器上想
│
├─ 卡 30 秒失败但没有 'Retry failed'
│   └─► 【等待流水线卡住】play-actions.js:831-933
│       Content 控制台查：
│         window.sideex_new_page / document.readyState
│         window.ajax_obj.filter(x => x.readyState !== 4)
│         window.domModifiedTime（连查两次看是否在变）
│
├─ 报「元素找不到」
│   └─► 【定位器失效】play-actions.js:1320-1370（自愈已耗尽）
│       转 kr-locator-selfhealing 技能
│
├─ 断言失败带实际值/期望值
│   └─► 【正常断言失败】selenium-commandhandlers.js:204-212 Assert.fail
│
├─ ${变量} 没替换
│   └─► 查双存储同步：formatCommand.js:61-70 ← selenium-api.js:377
│       监听注册在 panel/js/katalon/kar.js:623
│
├─ if / while 条件不对
│   └─► 沙箱求值：kar.js:597 → :611 → SandboxEvaluator.js:41-44
│       ⚠ store 存的都是【字符串】，"10" > "9" 是 false
│
├─ selectFrame/selectWindow/close/pause 无反应
│   └─► 这 4 条不下发页面！play-actions.js:1489
│       断点打在 window-controller.js:212/229/278
│
├─ 弹窗卡死
│   └─► page/prompt.js 是否注入 page 上下文？
│       body 属性 setPrompt/setConfirm 是否被页面清掉？
│
└─ 回放动作被重复录制
    └─► SideeXPlayingFlag 标记：command-receiver.js:81/87 设 / :100/129 移
```

---

## 五、关键代码模式（可直接复用）

### 模式 1：带重试的跨进程命令投递

```js
// 对应 common/promise-utils.js（全文 10 行）+ window-controller.js:142-158
async function retryUntilSuccess(func, maxRetry = 30, interval = 100) {
    for (let i = 0; i < maxRetry; i++) {
        try { return await func(); }
        catch (e) { await new Promise(r => setTimeout(r, interval)); }
    }
    throw 'Retry failed';   // 【改良建议】抛 Error 子类而非字符串
}

// 用法：60 次 × 500ms = 30 秒窗口，用于跨越页面刷新导致的 Content Script 重注入
sendCommand(command, target, value, top) {
    return retryUntilSuccess(async () => {
        return browser.tabs.sendMessage(
            tabId,
            { commands: command, target: target, value: value },
            { frameId: top ? 0 : frameId }
        );
    }, 60, 500);
}
```

**为什么必须有**：页面导航期间 Content Script 会被销毁重注入，`tabs.sendMessage` 直接抛 `Could not establish connection`。这 10 行是整个引擎「跨页面跳转仍能继续」的物理基础。

### 模式 2：Promise 递归主循环（支持 pause/resume）

```js
// 对应 play-actions.js:539-682
function executionLoop() {
    if (isLastCommand()) {                    // :544
        logEndTime();                         // :547
        return Promise.resolve();
    }
    if (shouldPause()) {                      // :577-595
        // 关键：不递归，把 resolve 挂起，等 resume 时再调用
        return new Promise(resolve => { pendingResume = resolve; })
                 .then(executionLoop);
    }
    currentPlayingCommandIndex++;             // :607
    return delay(getPlaybackDelay())          // :630（原版直读 $("#slider")）
        .then(() => {
            if (isExtCommand(cmd)) {          // :648
                return doExtCommand(cmd);
            }
            return doPreparation()            // :673
                .then(doPrePageWait)          // :674
                .then(doPageWait)             // :675
                .then(doAjaxWait)             // :676
                .then(doDomWait)              // :677
                .then(doCommand);             // :678
        })
        .then(executionLoop);                 // :679 递归
}
```

**为什么用递归而非 for**：每条命令都异步，且要支持中途暂停。Promise `.then()` 递归在微任务队列展平，**不会栈溢出**（与 Java 同步递归不同），万条命令也安全。

### 模式 3：命令变体元编程派生

```js
// 对应 selenium-commandhandlers.js:67-125
registerAll(api) {
    this._registerAllAccessors(api);   // :67-88
    this._registerAllActions(api);     // :90-102
    this._registerAllAsserts(api);     // :104-119（KR 中空转）
}

// 规则②：doFoo → foo + fooAndWait
_registerAllActions(api) {
    for (const fn in api) {
        const m = /^do([A-Z].+)$/.exec(fn);
        if (!m) continue;
        const name = lcfirst(m[1]);
        this.registerAction(name, bind(api[fn], api), false, ...);          // :98
        this.registerAction(name + "AndWait", bind(api[fn], api), false, ...); // :99
    }
}

// 规则①：getFoo/isFoo → 8 条
_registerAllAccessors(api) {
    for (const fn in api) {
        const m = /^(get|is)([A-Z].+)$/.exec(fn);
        if (!m) continue;
        const base = m[2];
        const isBoolean = (m[1] === "is");
        const requiresTarget = (api[fn].length === 1);
        this.registerAccessor(fn, block);                                   // :80
        this._registerStoreCommandForAccessor(base, block, requiresTarget); // :81 → :269-283
        const pred = this._predicateForAccessor(block, requiresTarget, isBoolean);
        this._registerAssertionsForPredicate(base, pred);                   // :84 → :222-233
        this._registerWaitForCommandsForPredicate(api, base, pred);         // :85 → :253-267
    }
}
```

**收益**：新增命令只写一个函数，8 个变体自动生成。这是 KR 最值得抄的设计。

### 模式 4：Content 侧反射派发 + 回落

```js
// 对应 command-receiver.js:49-188
function doCommands(message, sender, sendResponse) {
    // ① 内部等待命令走 switch                                          :52-66
    switch (message.commands) {
        case "waitPreparation": selenium.doWaitPreparation(); return;
        case "prePageWait":     selenium.doPrePageWait();     return;
        case "pageWait":        selenium.doPageWait();        return;
        case "ajaxWait":        selenium.doAjaxWait();        return;
        case "domWait":         selenium.doDomWait();         return;
    }
    document.body.setAttribute("SideeXPlayingFlag", true);            // :81
    try {
        // ② 优先反射 doXxx                                             :78-79
        const upper = message.commands.charAt(0).toUpperCase() + message.commands.slice(1);
        if (typeof selenium["do" + upper] === "function") {
            return selenium["do" + upper](message.target, message.value);
        }
        // ③ 回落 handler 表（assertText / waitForVisible 等派生命令）   :109-133
        const handler = commandFactory.getCommandHandler(message.commands);
        return handler.execute(selenium, { target, value });
    } finally {
        document.body.removeAttribute("SideeXPlayingFlag");            // :100/129
    }
}
```

### 模式 5：MV3 合规的动态表达式求值

```js
// 对应 panel/js/katalon/kar.js:597-611 + SandboxEvaluator.js:41-44
// Panel 页面禁止 eval，必须走 sandbox iframe

function expandForStoreEval(expression) {                     // kar.js:611
    let prefix = "";
    for (const k in declaredVars) {
        prefix += `var ${k} = ${JSON.stringify(declaredVars[k])};`;
    }
    prefix += `var storedVars = ${JSON.stringify(storedVars)};`;
    return prefix + expression;   // 让表达式能直接写变量名
}

function evalIfCondition(expression) {                        // kar.js:597
    return sandboxEvaluator.eval(expandForStoreEval(expression));
}

// SandboxEvaluator：iframe(sandbox.html) + postMessage，iframe 内部 eval(script)
// manifest 需声明 "sandbox": { "pages": ["panel/sandbox.html"] }
```

### 模式 6：跨进程变量回传

```js
// Content 侧写：selenium-api.js:377 / selenium-commandhandlers.js:269-283
browser.runtime.sendMessage({ "storeStr": value, "storeVar": varName });
browser.runtime.sendMessage({ "echoStr": logText });

// Panel 侧收：formatCommand.js:61-70
function handleFormatCommand(message) {
    if (message.storeStr !== undefined) {
        declaredVars[message.storeVar] = message.storeStr;
    }
    if (message.echoStr !== undefined) {
        sideex_log.info(message.echoStr);
    }
}
// 监听注册：panel/js/katalon/kar.js:623
browser.runtime.onMessage.addListener(handleFormatCommand);
```

### 模式 7：页面稳定性判定（含改良）

```js
// 原版：selenium-api.js:419-464 装钩子，:468-534 四个判定
Selenium.prototype.doWaitPreparation = function() {
    window.addEventListener("beforeunload", () => { window.new_page = true; });
    window.ajax_obj = [];                              // ⚠ 只增不减，内存泄漏
    const oldOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function() {
        window.ajax_obj.push(this);
        return oldOpen.apply(this, arguments);
    };
    ["DOMNodeInserted", "DOMNodeRemoved"].forEach(e =>   // ⚠ 已废弃的 Mutation Events
        document.addEventListener(e, () => { window.domModifiedTime = Date.now(); }));
};

// 【改良版】建议这样写
const pending = new Set();
const origOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function() {
    pending.add(this);
    this.addEventListener("loadend", () => pending.delete(this));   // 修复泄漏
    return origOpen.apply(this, arguments);
};
const origFetch = window.fetch;
window.fetch = function(...a) {                                      // 原版漏了 fetch
    const p = origFetch.apply(this, a);
    pending.add(p);
    p.finally(() => pending.delete(p));
    return p;
};
let domTime = Date.now();
new MutationObserver(() => { domTime = Date.now(); })                // 替代 Mutation Events
    .observe(document, { childList: true, subtree: true, attributes: true });
```

---

## 六、常见坑（表格速查）

| # | 坑 | 现象 | 源码位置 | 规避 |
|---|---|---|---|---|
| 1 | **两套 playback 目录** | 改了半天代码没生效 | `playback/` vs `panel/js/background/playback/` | UI 回放走后者；`playback/index.js:3` 是 socket 外部驱动 |
| 2 | **三套超时互不联动** | `setTimeout` 命令改了还是 30s 超时 | `selenium-api.js:290` / `play-actions.js:831-933` / `window-controller.js:142` | 只有第一套能被 `setTimeout` 改 |
| 3 | **`Retry failed` 被误诊** | 以为是元素找不到 | `common/promise-utils.js` | 这是**通信超时**，查 Content Script 是否就位 |
| 4 | **4 条命令不下发页面** | 在 Content 加日志没打印 | `play-actions.js:1489` | `pause/selectFrame/selectWindow/close` 断点打在 `window-controller.js:212/229/278` |
| 5 | **`ajax_obj` 内存泄漏** | SPA 长会话越跑越慢 | `selenium-api.js:419-464` | 用 `Set` + `loadend` 清理 |
| 6 | **`ajaxWait` 遇长轮询死等** | 每条命令都卡 30 秒 | `selenium-api.js:495` | 提供关闭开关 |
| 7 | **`domWait` 遇常驻动画死等** | 同上 | `selenium-api.js:530` | 同上 |
| 8 | **Mutation Events 已废弃** | 页面明显变卡 | `selenium-api.js:419-464` | 换 `MutationObserver` |
| 9 | **`fetch` 未被拦截** | 用 fetch 的页面等待不准 | `selenium-api.js:419-464` 只拦 XHR | 补 fetch 拦截 |
| 10 | **store 存的都是字符串** | `if "10" > "9"` 为 false | `formatCommand.js:61-70` | 条件里显式 `Number(x)` |
| 11 | **未定义变量静默保留** | `${foo}` 原样出现在页面上 | `formatCommand.js:5-47` | 加 warn 日志 |
| 12 | **双变量存储不自动同步** | Content 里读不到 Panel 存的变量 | `selenium-api.js:20` vs `formatCommand.js:3` | 只有 Content→Panel 单向回传 |
| 13 | **Panel 不能 eval** | CSP 报 `Refused to evaluate a string` | MV3 限制 | 走 `SandboxEvaluator.js:41-44` |
| 14 | **Content 可以 eval** | 以为处处都要沙箱 | `selenium-api.js:2949` | `javascript{...}` 在 Content 直接求值 |
| 15 | **`is*Present` 反义命名特例** | 写 `assertNotElementPresent` 报未知命令 | `kar-loadCommand.js:26-35` | 正确写法 `assertElementNotPresent` |
| 16 | **handler 表 ≠ 白名单** | UI 搜不到 `getTitle` 但能跑 | 629 vs 575 | 见下方对照表 |
| 17 | **`nonWaitActions` 黑名单** | `openAndWait` 搜不到 | `kar-loadCommand.js:5` | `open` 已隐式等待（`selenium-api.js:1389`） |
| 18 | **10 个方法被注释掉** | 改 `doAssertText` 不生效 | `selenium-api.js:326-416` | 已改由 `getText` 派生 |
| 19 | **规则③ 空转** | 以为写 `assertFoo` 会自动注册 | `selenium-commandhandlers.js:104-119` | KR 无裸 assert 方法，必须写 `doAssertFoo` |
| 20 | **`doVerifyAlert` 人工补丁** | 疑惑为什么单独写这个 | `selenium-api.js:3831` | 规则②不生成 verify 变体，只能手写 |
| 21 | **弹窗必须注入 page 上下文** | isolated world 改 `window.alert` 无效 | `page/prompt.js` | `<script>` 注入 |
| 22 | **弹窗状态挂 body 属性** | 页面清空 body 属性后自动应答失效 | `page/prompt.js:119/137/155` | 改用纯 postMessage 握手 |
| 23 | **`SideeXPlayingFlag` 生命周期太短** | 异步动作在标记移除后被录进去 | `command-receiver.js:81/100` | 延长标记覆盖窗口 |
| 24 | **速度控制直读 jQuery DOM** | 引擎无法脱离 UI 单测 | `play-actions.js:630` | 抽 `getPlaybackDelay()` |
| 25 | **`endWhile` 无匹配 `while`** | `blockStack` pop 出 undefined | `play-actions.js:1165` | 加语法校验 |
| 26 | **`while` 永真无保护** | 只能靠 stop 打断 | `play-actions.js:1154-1165` | 加最大迭代数 |
| 27 | **`gotoLabel` 目标不存在静默失败** | 跳转没反应也不报错 | `play-actions.js:1255` | 加校验 |
| 28 | **`debugger` 权限的黄条** | 用户看到「正在调试此浏览器」 | `background/kar.js:240` | 不做上传/真实按键就别申请 |
| 29 | **遗留调试语句** | 控制台莫名打印 `no` | `page/prompt.js:252` | 删掉 |
| 30 | **`storeCsv` 整表是列式** | 以为是 `rows[0].name` | `execute-storeCSV.js:130-148` | 实际是 `${tbl.name[0]}` |

---

## 七、KR 对应实现位置（速查表）

### 7.1 按功能查

| 功能 | 实现位置 |
|---|---|
| 播放按钮绑定 | `panel/js/background/playback/index.js`（90 行） |
| 命令对象工厂 | `panel/js/background/playback/service/CommandFactory.js:1-47` |
| 用例回放入口 | `play-actions.js:158-176` `playTestCaseAction` |
| 套件回放入口 | `play-actions.js:339` 附近 |
| 起始日志（用例名） | `play-actions.js:158-176` `sideex_log.info("Playing test case ...")` |
| 起始日志（OS/浏览器） | `panel/js/katalon/kar.js:518-529` `logStartTime` |
| 结束日志 | `play-actions.js:547 / 806 / 1403` `logEndTime` |
| 四段式 Promise 骨架 | `play-actions.js:274-281` |
| 全局状态变量 | `play-actions.js:46-50` |
| **执行主循环** | `play-actions.js:539-682` |
| 末条判定 | `play-actions.js:544` |
| 断点/暂停 | `play-actions.js:577-595` |
| 游标自增 | `play-actions.js:607` |
| 速度滑块延迟 | `play-actions.js:630` |
| ExtCommand 分支 | `play-actions.js:648` |
| 六段 Promise 链 | `play-actions.js:673-679` |
| 五个等待包装（各 30s） | `play-actions.js:831-933` |
| `doCommand` | `play-actions.js:935-963` |
| `runCommand`（含全部拦截） | `play-actions.js:965-1459` |
| `isExtCommand` | `play-actions.js:1489` |
| `convertVariableToString` | `play-actions.js:1502-1528` |
| 执行结果对话框 / 失败策略 | `play-actions.js:1530-1552` |
| **命令投递（带重试）** | `window-controller.js:142-158` |
| 重试工具 | `common/promise-utils.js`（10 行） |
| `ExtCommand` 类 | `window-controller.js:18-376` |
| 会话状态 | `window-controller.js:27-31` |
| `doSelectFrame` | `window-controller.js:212` |
| `doSelectWindow` | `window-controller.js:229` |
| `doClose` | `window-controller.js:278` |
| `wait` | `window-controller.js:285` |
| `setFirstTab` | `window-controller.js:354` |
| **Content 派发入口** | `command-receiver.js:49-188` |
| 内部等待分发 | `command-receiver.js:52-66` |
| 截图分发 | `command-receiver.js:67` |
| 反射调用 | `command-receiver.js:78-79` |
| `SideeXPlayingFlag` | `command-receiver.js:81/87/100/129` |
| handler 表回落 | `command-receiver.js:109-133` |
| `waitFor*` 轮询 | `command-receiver.js:191-221` |
| **Accessor 派生规则** | `selenium-commandhandlers.js:67-88` |
| **Action 派生规则** | `selenium-commandhandlers.js:90-102`（AndWait 在 `:99`） |
| **Assert 派生规则**（空转） | `selenium-commandhandlers.js:104-119` |
| `registerAll` | `selenium-commandhandlers.js:121-125` |
| 断言失败抛出 | `selenium-commandhandlers.js:204-212` |
| assert/verify 注册 | `selenium-commandhandlers.js:222-233` |
| waitFor 注册 | `selenium-commandhandlers.js:253-267` |
| store 变体（跨进程回传） | `selenium-commandhandlers.js:269-283` |
| `ActionHandler.execute`（AndWait） | `selenium-commandhandlers.js:314-328` |
| `AssertHandler.execute`（halt） | `selenium-commandhandlers.js:358-379` |
| `storedVars` 定义 | `selenium-api.js:20` |
| 特殊键注入 | `selenium-api.js:26-103` |
| `DEFAULT_TIMEOUT = 30s` | `selenium-api.js:290` |
| **被注释的 10 个方法** | `selenium-api.js:326-416` |
| 等待钩子安装 | `selenium-api.js:419-464` |
| 四个等待判定 | `selenium-api.js:468/475/495/530` |
| `preprocessParameter`（`javascript{}`） | `selenium-api.js:2949` |
| `replaceVariables`（`${}`） | `selenium-api.js:2962` |
| `declaredVars` 定义 | `formatCommand.js:3` |
| `xlateArgument` | `formatCommand.js:5-47` |
| `handleFormatCommand` | `formatCommand.js:61-70` |
| 消息监听注册 | `panel/js/katalon/kar.js:623` |
| `evalIfCondition` | `panel/js/katalon/kar.js:597` |
| `expandForStoreEval` | `panel/js/katalon/kar.js:611` |
| 沙箱求值 | `SandboxEvaluator.js:41-44`（全文 50 行） |
| 白名单推导 | `kar-loadCommand.js:7-37` |
| `nonWaitActions` 黑名单 | `kar-loadCommand.js:5` |
| `is*Present` 反义特例 | `kar-loadCommand.js:26-35` |
| 手工追加 21 条 | `kar-loadCommand.js:39-62` |
| 白名单去重 | `kar-loadCommand.js:64-75` |
| 小写映射表 | `generate-command-data-list.js:8` |
| 弹窗劫持（子 Frame） | `page/prompt.js:56-114` |
| 弹窗劫持（顶层） | `page/prompt.js:118-176` |
| 弹窗控制通道 | `page/prompt.js:217-283` |
| CDP 上传 | `background/kar.js:61-81` |
| CDP 按键 | `background/kar.js:85-157` |
| 截图 | `background/kar.js:160-169` |
| CDP 节点定位 | `background/kar.js:197` |
| CDP 附加 | `background/kar.js:240` |
| 数据驱动执行器 | `.../play/execute-{storeCSV,writeToCSV,appendToCSV,appendToJSON}.js` |
| CSV 校验 | `execute-storeCSV.js:11-43` |
| CSV target 解析 | `execute-storeCSV.js:66-104` |
| CSV 列式读取 | `execute-storeCSV.js:130-148` |
| 自愈接入点 | `play-actions.js:944 / 1326` `getPossibleTargetList` |
| 外部 Socket 回放入口 | `playback/index.js:3` |

### 7.2 命令数量对照

| 口径 | 数量 | 来源 |
|---|---|---|
| `Selenium.prototype` 活跃方法 | 153 | `content/selenium-api.js` |
| ├─ `doXxx` | 99 | 规则② |
| └─ `getXxx` / `isXxx` | 54 | 规则① |
| 裸 `assertXxx` | 0 | 规则③空转 |
| 被 `KAT-BEGIN/END` 注释 | 10 | `:326-416` |
| Content handler 表 | 629 | 派生结果 |
| Panel `formalCommands` | 575 | `kar-loadCommand.js` |
| handler 有 / 白名单无 | 71 | accessor 原名 54 + AndWait 8 + waitForNot*Present 9 |
| 白名单有 / handler 无 | 17 | Panel 独占（流程控制 + 数据驱动） |

### 7.3 高频命令行号（`content/selenium-api.js`）

| 命令 | 行号 | 命令 | 行号 |
|---|---|---|---|
| `doStore` | `:376` | `doOpen` | `:1389` |
| `doEcho` | `:405` | `doSelectWindow` | `:1435` |
| `doStoreEval` | `:409` | `doSelectFrame` | `:1520` |
| `doWaitPreparation` | `:419` | `doGoBack` | `:1698` |
| `doPrePageWait` | `:468` | `doRefresh` | `:1706` |
| `doPageWait` | `:475` | `doClose` | `:1714` |
| `doAjaxWait` | `:495` | `getLocation` | `:1849` |
| `doDomWait` | `:530` | `getTitle` | `:1857` |
| `doClick` | `:536` | `getValue` | `:1875` |
| `doDoubleClick` | `:555` | `getText` | `:1888` |
| `doContextMenu` | `:576` | `getEval` | `:1912` |
| `doFireEvent` | `:651` | `isChecked` | `:1939` |
| `doFocus` | `:673` | `getAttribute` | `:2124` |
| `doKeyDown` | `:775` | `isTextPresent` | `:2140` |
| `doMouseOver` | `:827` | `isElementPresent` | `:2161` |
| `doType` | `:978` | `isVisible` | `:2174` |
| `doSetText` | `:1051` | `isEditable` | `:2247` |
| `doSendKeys` | `:1083` | `doWaitForCondition` | `:2862` |
| `doCheck` | `:1234` | `doSetTimeout` | `:2884` |
| `doUncheck` | `:1243` | `doRunScript` | `:3159` |
| `doSelect` | `:1252` | `doCaptureEntirePageScreenshot` | `:3229` |
| `doSubmit` | `:1364` | `doShowElement` | `:3867` |
| — | — | `doUpload` | `:3887` |

---

## 八、裁剪清单

### 8.1 必留（约 2500 行）

| 文件 | 原始行数 | 保留比例 |
|---|---|---|
| `play-actions.js` | 1565 | ~40%（主循环+变量必留，流程/数据驱动可砍） |
| `window-controller.js` | 379 | ~70% |
| `command-receiver.js` | 228 | ~90% |
| `selenium-commandhandlers.js` | 395 | ~100%（元编程不能拆） |
| `selenium-api.js` | 3954 | ~20%（只留 30 条命令） |
| `formatCommand.js` | 74 | 100% |
| `common/promise-utils.js` | 10 | 100% |
| `SandboxEvaluator.js` | 50 | 视是否要 if/while |

### 8.2 可整块删除

| 模块 | 路径 | 理由 |
|---|---|---|
| 外部 Socket 回放 | `playback/`（7 文件） | 无 CI 驱动需求 |
| CDP 上传/按键 | `background/kar.js:61-157` | 省掉 `debugger` 高危权限 |
| 数据驱动 | `execute-*.js` 4 文件 | 非核心 |
| 弹窗劫持 | `page/prompt.js`（283 行） | 不测弹窗可删 |
| 罕用命令 | `selenium-api.js` 的 `:3485/:3627/:3570/:3613/:3188` | `doRollup`/`doUseXpathLibrary`/`doAddScript`/`doRemoveScript`/`doAddLocationStrategy` |
| 命令参考文档 | `kar-loadCommand.js:79-97` | 只服务 UI 帮助面板 |

### 8.3 最小命令集（30 条）

```
导航  open
点击  click clickAndWait doubleClick
输入  type sendKeys
表单  select check uncheck submit
窗口  selectWindow selectFrame close
断言  assertText verifyText assertTitle assertValue assertElementPresent
等待  waitForElementPresent waitForText waitForVisible
变量  store storeText storeValue storeEval echo
脚本  runScript
控制  pause setTimeout
```

### 8.4 从零实现顺序

1. **通信骨架**：`tabs.sendMessage` + `retryUntilSuccess` + Content dispatcher（≈150 行）
2. **命令本体**：手写 10 个 `doXxx`
3. **元编程注册**：照抄三条派生规则（≈200 行）
4. **执行主循环**：Promise 递归 + 游标（≈100 行）
5. **等待流水线**：先只做 `pageWait`（readyState），跑通再加 domWait
6. **变量系统**：`declaredVars` + `${}` 替换（≈80 行）
7. （可选）流程控制 + 沙箱求值
8. （可选）自愈接入

---

## 九、工作纪律

使用本技能时必须遵守：

1. **结论带行号**：任何关于 KR 行为的断言，都要给 `文件路径:行号`。
2. **行号回源码核实**：引用前先 Read/Grep 确认，不凭记忆。
3. **区分事实与建议**：源码里有的叫「事实」，我提出的改进叫「建议」/「改良」。
4. **不改源码**：`7.1.0_0/` 下的扩展源文件只读，产出一律落在 `_distill/`。
5. **找不到就说找不到**：不编造。写「未在源码中找到」。
6. **注释块不算数**：`/* KAT-BEGIN … KAT-END */` 内的定义是死代码，统计命令时必须排除。
7. **先分清上下文**：讨论任何代码前，先确认它跑在 Panel / Content / Service Worker / Page 哪个环境。

---

## 十、相关技能

| 技能 | 关系 |
|---|---|
| `kr-recorder-engine` | 上游：录制产出的命令数组是回放的输入 |
| `kr-locator-selfhealing` | 下游兜底：回放失败时的定位器重试机制 |
