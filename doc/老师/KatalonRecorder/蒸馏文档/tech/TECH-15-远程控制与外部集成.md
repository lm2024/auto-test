# TECH-15 · 远程控制与外部集成（Katalon Recorder 7.1.0 技术蒸馏）

> 适用对象：想把 Katalon Recorder 7.1.0（MV3）裁剪为个人自动化测试插件的工程师。
> 文档纪律：所有结论均来自只读源码目录 `KatalonRecorder/7.1.0_0/`，引用格式为 `文件路径:行号`，并附真实片段。压缩产物会标注「来自压缩产物」。找不到的事实显式标注「未在源码中找到，推测：…」。
> **本文只读不改**，未修改任何源码。

---

## 目录

1. [一句话概括](#1-一句话概括)
2. [关键文件清单](#2-关键文件清单)
3. [核心机制逐层拆解](#3-核心机制逐层拆解)
   - 3.1 [四条外部通道总览](#31-四条外部通道总览)
   - 3.2 [通道 A：socket.io CI 回放（localhost:3500）](#32-通道-asocketio-ci-回放localhost3500)
   - 3.3 [通道 B：Katalon Studio 桌面端 WebSocket（ws://localhost:50000）](#33-通道-bkatalon-studio-桌面端-websocketwslocalhost50000)
   - 3.4 [通道 C：externally_connectable + onMessageExternal](#34-通道-cexternally_connectable--onmessageexternal)
   - 3.5 [通道 D：TestOps 云端日志/备份上传](#35-通道-dtestops-云端日志备份上传)
   - 3.6 [`debugger` 权限查证：到底用在哪](#36-debugger-权限查证到底用在哪)
   - 3.7 [`page/runScript.js`：MAIN world 任意 JS 执行](#37-pagerunscriptjsmain-world-任意-js-执行)
   - 3.8 [`command-receiver.js` 消息协议](#38-command-receiverjs-消息协议)
   - 3.9 [跨 world RPC：chrome-polyfill + RemoteObjectHelper](#39-跨-world-rpcchrome-polyfill--remoteobjecthelper)
   - 3.10 [sandbox iframe：受控 eval](#310-sandbox-iframe受控-eval)
4. [数据结构与流程图](#4-数据结构与流程图)
5. [隐晦知识点与坑](#5-隐晦知识点与坑)
6. [可复用到测试插件的能力清单 + 移植方案](#6-可复用到测试插件的能力清单--移植方案)
7. [最小可用实现（MVP 代码骨架）](#7-最小可用实现mvp-代码骨架)

---

## 1. 一句话概括

Katalon Recorder 的「远程控制与外部集成」不是一条通道，而是**四条互不相干、分属不同历史时期的通道并存**：① Node CLI/CI 通过 **socket.io 连 `http://localhost:3500`** 把测试套件 HTML 推给插件、插件用 `navigator.webdriver` 确认自己跑在 WebDriver 里之后执行并回传日志；② Katalon Studio 桌面端通过 **`ws://localhost:<port>`（默认 50000）** 双向指挥插件做 Object Spy / Recorder；③ 任意第三方浏览器扩展通过 **`externally_connectable` + `onMessageExternal`** 注册「导出能力」并接管代码生成；④ 面板把回放日志 **上传到 TestOps 云**。四条通道里只有 ②③④ 在 7.1.0 里是活的，**① 的宿主页面在本构建中不存在（死代码，但文件全部随包发布）**。而 `debugger` 权限**确实被使用**——只用于两件事：文件上传（`DOM.setFileInputFiles`）和真实按键（`Input.dispatchKeyEvent`）。

---

## 2. 关键文件清单

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---:|---|---|
| `manifest.json` | 75 | `debugger`/`scripting`/`offscreen` 权限、`externally_connectable`、`web_accessible_resources`、MAIN world content script | **改**：删 `externally_connectable`、`debugger`（若不做上传/特殊按键）、修 CSP |
| `manifest.bak.json` | 222 | 打包前的原始 manifest，**保留了 bundle 化之前的 content_scripts 明细清单** | **删**（但先读一遍，它是 `content.1.bundle.js` 的「目录」） |
| `worker_wrapper.js` | 26 | SW 入口，`importScripts` 拼装 17 个背景脚本 | **留**（改成自己的清单） |
| `background/kar.js` | 330 | **CDP（chrome.debugger）全部调用点** + `onMessageExternal` 能力注册 + 整页截图 | **拆**：CDP 部分按需留，外部能力注册整块删 |
| `background/background.js` | 239 | Panel 窗口生命周期、右键菜单、`action.onClicked` | **留** |
| `katalon/background.js` | 376 | **Katalon Studio 桌面端 WebSocket 客户端**（Object Spy / Recorder 远程指挥） | **删** |
| `katalon/constants.js` | 67 | KS 协议常量（命令字、端口 `50000`、右键菜单文案） | **删** |
| `katalon/chrome_common.js` | 34 | `getKatalonServerPort` / `setKatalonServerPort`（`chrome.storage.local`） | **删** |
| `katalon/chrome_setup.js` | 8 | 拼 `qAutomate_server_url = http://localhost:<port>/` | **删** |
| `katalon/context_menu.js` | 101 | Object Spy 元素 → iframe 逐层上抛 → POST 给 KS | **删** |
| `katalon/main.js` | — | `START_ADDON`/`STOP_ADDON` 接收端，切 Object Spy / Recorder 模式 | **删** |
| `playback/index.js` | 66 | **socket.io CI 入口**：`io.connect('http://localhost:3500')` + `sendHtml` | **留作参考**（本构建里是死代码） |
| `playback/service/play-actions-service.js` | 1049 | 无头回放主循环 + `socket.emit('logger'/'result'/'doneSuite')` | **参考** |
| `playback/service/parser-service.js` | 41 | 用正则从测试套件 HTML 里切出 `<table>`/`<tr>` | **留**（20 行就能复刻） |
| `playback/service/data-service.js` | 31 | 数据驱动文件（CSV via Papa Parse / JSON） | **留** |
| `playback/service/log-service.js` | 26 | `console` 包装 | **删**（直接用 console） |
| `content-marketing/socket-io/socket-io.min.js` | 526 | Socket.IO **v3.1.3** 客户端（79 626 字节） | **删/换**：换成原生 `WebSocket` 省 78 KB |
| `content/check-browser-automation.js` | 5 | `navigator.webdriver` 上报，CI 模式的「安全销」 | **留**（5 行） |
| `content/command-receiver.js` | 228 | **回放命令总接收器**：`browser.runtime.onMessage` → `selenium.doXxx` | **留**（核心） |
| `content/runScript-injecter.js` | 32 | 往页面注 `page/runScript.js`，并回收 `from-page-runscript` 结果 | **留** |
| `page/runScript.js` | 53 | **MAIN world 里 `new Function` 等价执行任意 JS** | **留** |
| `content/prompt-injecter.js` | 74 | 同款注入模式，劫持 `alert/confirm/prompt` | **留**（做对照组） |
| `content/trustedPolicy.js` | 9 | Trusted Types 兜底策略 `default2` | **留**（必需，否则严格 TT 站点注入失败） |
| `common/chrome-polyfill.js` | 15 | MAIN world 用 RPC 代理替换 `chrome.runtime/storage/extension` | **删或改**（有提权风险，见 5.6） |
| `common/chrome-polyfill-server.js` | 9 | ISOLATED world 把**整个 `chrome` 对象**暴露给页面通道 | **删** |
| `common/remote-object-helper-content.js` | 1（压缩） | `RemoteObjectHelper` / `PageTransportServer`，密钥 `pandoraboz` | **删** |
| `common/remote-object-helper-page.js` | 1（压缩） | 同上，MAIN world 侧 | **删** |
| `panel/sandbox.html` / `panel/sandbox.js` | 3 / 76 | `sandbox` 页面里的 `eval` 循环，供表达式求值 | **留**（合规的 eval 方案） |
| `panel/js/UI/services/helper-service/SandboxEvaluator.js` | 51 | 主面板侧的 sandbox `postMessage` 客户端 | **留** |
| `panel/js/katalon/kar-generateScript.js` | 423 | 代码导出；`:194-228` 是**第三方扩展导出协议**发送端 | **拆**：外部导出整块删 |
| `panel/js/katalon/kar-upload.js` | 286 | TestOps 日志/备份上传（预签名 URL 两段式） | **删** |
| `panel/js/katalon/kar.js` | 623 | TestOps endpoint 表 + 面板杂项 | **拆** |
| `setting-panel/js/setting-tabs/KS-port-setting-tab.js` | 54 | KS 端口设置 UI | **删** |
| `bundles/content.1.bundle.js` | 38 381 | 44 个 content 脚本的拼接产物（带 `/// File:` 分隔注释） | **参考**（分隔注释就是索引） |

---

## 3. 核心机制逐层拆解

### 3.1 四条外部通道总览

先把「谁连谁、谁先开口」这件事说清楚，否则容易把 3500 和 50000 搞混：

```
                     ┌──────────────────────────────────────────┐
                     │  Chrome 扩展 Katalon Recorder 7.1.0      │
                     │                                          │
   ┌── A ────────────┤ playback/index.js                        │
   │  socket.io      │   io.connect('http://localhost:3500')    │  ← 插件主动连
   │  CI Runner      │   on 'sendHtml' / emit 'logger|result'   │
   │  (Node)         │                                          │
   └─────────────────┤                                          │
                     │                                          │
   ┌── B ────────────┤ katalon/background.js (SW)               │
   │  Katalon Studio │   new WebSocket('ws://localhost:50000/') │  ← 插件主动连
   │  桌面应用       │   handleServerMessage(START_INSPECT…)    │     且失败每 300ms 重试
   └─────────────────┤                                          │
                     │                                          │
   ┌── C ────────────┤ background/kar.js:267                    │
   │  任意第三方扩展 │   runtime.onMessageExternal              │  ← 对方主动连
   │  (ids: ["*"])   │   'katalon_recorder_register'            │
   └─────────────────┤ panel/js/katalon/kar-generateScript.js   │
                     │   runtime.sendMessage(extId, 'export')   │  → 插件反向调用
                     │                                          │
   ┌── D ────────────┤ panel/js/katalon/kar-upload.js           │
   │  TestOps 云     │   GET upload-url → PUT → POST 汇报       │  ← 插件主动推
   └─────────────────┴──────────────────────────────────────────┘
```

| 通道 | 协议 | 方向 | 触发者 | 7.1.0 是否活的 |
|---|---|---|---|---|
| A | socket.io v3（HTTP long-poll / WS） | 插件 → localhost:3500 | Node CLI | **否**（无宿主页面，见 5.1） |
| B | 原生 WebSocket | 插件 → localhost:`<port>` | SW 启动/安装即连 | 是 |
| C | `chrome.runtime.sendMessage` 跨扩展 | 双向 | 第三方扩展先注册 | 是 |
| D | HTTPS + jQuery.ajax | 插件 → testops.katalon.io | 用户点按钮 / 自动备份 | 是 |

---

### 3.2 通道 A：socket.io CI 回放（localhost:3500）

这是用户最关心的「命令行/CI 集成完整协议」。全部证据集中在 `playback/` 目录 66 行的入口文件里。

#### 3.2.1 连接与握手

`playback/index.js:1-7`：

```js
var recorder;

const socket = io.connect('http://localhost:3500');
console.log('listen socket 3500')
let isAutomated;
let executionData;
browser.runtime.onMessage.addListener(browserAutomationListener);
```

三点值得注意：

1. **端口硬编码 3500**，没有任何设置项（全仓 grep `3500` 只命中 `playback/index.js:3` 与 `:4` 的日志，以及 `common/browser-fingerprint2.js:7447` 的一个无关常量数组）。
2. `io` 是全局变量，由 `content-marketing/socket-io/socket-io.min.js` 提供。该文件头部自述版本：

```js
/*!
 * Socket.IO v3.1.3
 * (c) 2014-2021 Guillermo Rauch
 * Released under the MIT License.
 */
```
（`content-marketing/socket-io/socket-io.min.js:1-5`）

3. **它在文件顶层就无条件发起连接**，没有开关、没有 try/catch。所以只要宿主页面被加载，插件就会周期性地敲 `localhost:3500`（socket.io v3 默认带自动重连）。

#### 3.2.2 「安全销」：navigator.webdriver

CI 模式最怕的是：普通用户随便开个网页，某个恶意的本地 3500 服务就能远程驱动他的浏览器。Katalon 的防线是一个 5 行 content script：

`content/check-browser-automation.js:1-5`（同时被打进 `bundles/content.1.bundle.js:312-315`）：

```js
var checkAutomated = navigator.webdriver;
browser.runtime.sendMessage({
  command: "checkForAutomated",
  isAutomated: checkAutomated,
});
```

`playback/index.js:9-15` 接收，并**收到一次就摘掉监听器**：

```js
function browserAutomationListener(mess) {
    if (mess.command !== "checkForAutomated") {
        return;
    }
    isAutomated = mess.isAutomated;
    browser.runtime.onMessage.removeListener(browserAutomationListener);
}
```

`navigator.webdriver` 只有在浏览器被 WebDriver（Selenium/ChromeDriver）启动时才为 `true`。也就是说 **CI 模式要求整个 Chrome 由 WebDriver 拉起**，普通用户日常浏览时该值为 `false`，`sendHtml` 收到也不会执行。

#### 3.2.3 下行协议：`sendHtml`

`playback/index.js:17-32`：

```js
socket.on("sendHtml", function(data) {
    let intervalID = setInterval(() => {
        if (isAutomated == true && data) {
            let html = data.data;
            if (data.datafiles) {
                executeTestSuite(html, data.datafiles);
            } else {
                executeTestSuite(html);
            }
            clearInterval(intervalID);
        } else if (isAutomated == false) {
            //socket.emit("manual-disconnection", socket.id);
            clearInterval(intervalID);
        }
    }, 300);
});
```

消息体形状（从消费方式反推）：

```jsonc
// 事件名: "sendHtml"
{
  "data": "<html><head><title>套件名</title></head><body><table>…</table>…</html>",
  "datafiles": {                       // 可选
    "users.csv": { "type": "csv",  "content": "name,age\nA,1\n" },
    "cfg.json":  { "type": "json", "content": "{\"k\":1}" }
  }
}
```

那个 300ms 的 `setInterval` 是在**等 `isAutomated` 从 `undefined` 变成 boolean**——因为 socket 消息和 content script 上报是两个异步源，没有 happens-before 保证。注意它只处理 `true`/`false` 两个分支，如果 content script 永远没上报（例如 CI 里第一个页面是 `chrome://newtab`，content script 注不进去），这个 interval **会永远转下去**。

#### 3.2.4 套件 HTML 的解析

`playback/service/parser-service.js:26-40`，纯正则，没有用 DOMParser：

```js
function readSuiteFromString(test_suite) {
    let testSuiteName = getTestSuiteName(test_suite);
    let testCases = test_suite.match(/<table[\s\S]*?<\/table>/gi);
    testCases = testCases.map(testCase => {
        let testSteps = testCase.match(/<tr[\s\S]*?<\/tr>/gi);
        let testCaseName = getTestCaseName(testSteps);
        let testCaseHTML = trimBeforeElementTag(testSteps.slice(1).join(""));
        testCaseHTML = changeAfterValueElement(testCaseHTML);
        return { testCaseName, testCaseHTML };
    });
    return { testCases, testSuiteName };
}
```

- 套件名 = `<title>` 的 innerText（`:8-13`）
- 每个 `<table>` = 一个 test case，第一个 `<tr>` 的第一个 `<td>` 是 case 名（`:1-6`）
- 其余 `<tr>` 拼成 `testCaseHTML`，交给回放引擎逐行解析（三列：command / target / value）
- `changeAfterValueElement`（`:19-24`）把字面量 `\n` 还原成真换行

这就是 Selenium IDE 那套「HTML 表格即测试脚本」的格式。

#### 3.2.5 上行协议：四个事件

| 事件名 | payload | 触发点 | 语义 |
|---|---|---|---|
| `infoTestSuite` | `{ testSuite: string, testCases: string[] }` | `playback/index.js:56-59` | 解析完套件，先把清单报给 runner |
| `logger` | `{ mess: string, type: 'verbose'\|'info'\|'debug'\|'error' }` | `play-actions-service.js:93, 226, 279, 286, …`（全文件 30 处） | 逐条日志 |
| `result` | `{ testcase: string, result: 'passed'\|'failed' }` | `play-actions-service.js:186-189` / `:290-293` | 单 case 结果 |
| `doneSuite` | `{ mess: 'Finnish executing', type: 'info' }` | `play-actions-service.js:111-114` | 全套件结束（注意原文拼写就是 `Finnish`） |

`playback/index.js:56-65`：

```js
    socket.emit('infoTestSuite', {
        testSuite: testSuiteName,
        testCases: testCaseNames
    });
    //run test suite
    let actions = await import ("./service/play-actions-service.js");
    actions.setDataService(dataService);
    actions.setTestSuiteData(testSuiteData);
    actions.playSuiteAction(socket);
```

`playback/service/play-actions-service.js:78-81` 把 socket 存成模块级变量：

```js
const playSuiteAction = (socket) => {
  socketLog = socket;
  initBeforePlay();
  playSuite(0);
  isPlaying = true;
};
```

单条命令执行前的日志（`:226-235`）：

```js
    socketLog.emit("logger", {
      mess:
        "Executing: | " + commandName + " | " + commandTarget + " | " + commandValue + " |",
      type: "info",
    });
```

失败路径（`:279-293`）：

```js
    socketLog.emit("logger", { mess: reason, type: "error" });
    logger.logTime();
    logger.info("Test case failed");
    socketLog.emit("logger", { mess: "Test case failed", type: "debug" });
    socketLog.emit("result", {
      testcase: testSuiteData[selectedCaseIndex]["testCaseName"],
      result: "failed",
    });
    failedTestCases++;
```

成功路径对称（`:182-190`）。套件结束（`:104-115`）：

```js
    trackingExecuteTestSuite(
      testSuiteData["testSuiteName"], successedTestCases, failedTestCases, false, true
    );
    socketLog.emit("doneSuite", { mess: "Finnish executing", type: "info" });
    isPlayingSuite = false;
```

> 注意 `trackingExecuteTestSuite` 是 Segment 埋点（属 TECH-14 范畴）。**CI 模式下依然会打埋点**，裁剪时要连这行一起删。

#### 3.2.6 数据驱动

`playback/service/data-service.js:14-28`：

```js
  parseData(name) {
    let dataFile = this._dataFiles[name];
    if (!dataFile.data) {
      let type = dataFile.type;
      if (!type) { type = 'csv'; }
      if (type === 'csv') {
        dataFile.data = Papa.parse(dataFile.content, { header: true }).data;
      } else {
        dataFile.data = JSON.parse(dataFile.content);
      }
    }
    return dataFile;
  }
```

CSV 走 Papa Parse（`panel/js/katalon/papaparse.js`，1613 行，也被 `worker_wrapper.js:22` 导进 SW）。

#### 3.2.7 完整时序（推测的 runner 侧行为）

```
Node CLI (未在本仓)                      Chrome + 扩展
    │                                         │
    │ 1. 起 socket.io server :3500            │
    │ 2. WebDriver 拉起 Chrome                │
    │    --load-extension=<KR>                │
    │                                         │ 3. 宿主页加载 socket-io.min.js
    │                                         │    + playback/index.js
    │ ◄─────── socket 连接建立 ───────────────│
    │                                         │ 4. content script 上报
    │                                         │    {command:'checkForAutomated',
    │                                         │     isAutomated:true}
    │ ── emit 'sendHtml' {data, datafiles} ──►│
    │                                         │ 5. readSuiteFromString()
    │ ◄── emit 'infoTestSuite' {suite,cases} ─│
    │ ◄── emit 'logger' {mess,type} × N ──────│ 6. 逐命令回放
    │ ◄── emit 'result' {testcase,result} ────│
    │ ◄── emit 'doneSuite' ───────────────────│ 7. 结束
    │ 8. 汇总退出码                            │
```

> **未在源码中找到**：Node 端 runner 的实现（不在扩展包里）。上图第 1/2/8 步为**推测**，依据是 `navigator.webdriver` 的判定、端口硬编码、以及事件名语义。

---

### 3.3 通道 B：Katalon Studio 桌面端 WebSocket（ws://localhost:50000）

这条通道是**活的**，跟随 SW 启动。

#### 3.3.1 触发时机

`katalon/background.js:328-335`：

```js
browser.runtime.onStartup.addListener(function () {
    setCurrentWindow();
    waitForConnection();
});

browser.runtime.onInstalled.addListener(function (details) {
    waitForConnection();
});
```

#### 3.3.2 连接与无限重试

`katalon/background.js:210-240`：

```js
function tryToConnect() {
    getKatalonServerPort(function (port) {
        var socketUrl = "ws://localhost:" + port + "/";
        console.log("Try to connect to Katalon Studio at " + socketUrl);
        try {
            var tempSocket = new WebSocket(socketUrl);
            tempSocket.onmessage = function (event) { handleServerMessage(event.data); }
            tempSocket.onopen = function (event) {
                clientSocket = tempSocket;
                clientSocket.onclose = function (event) {
                    clientSocket = null;
                    stopAddon();
                    setTimeout(tryToConnect, 300);
                }
            }
            tempSocket.onerror = function (event) { setTimeout(tryToConnect, 300); }
        } catch (e) { setTimeout(tryToConnect, 300); }
    });
}
```

**每 300ms 无限重连**，没有退避、没有次数上限、没有开关。在 MV3 里这还有副作用：定时器 + WebSocket 会不断把 service worker 唤醒/续命（见 5.3）。

端口来源：`katalon/chrome_common.js:14-25`

```js
function getKatalonServerPort(callback) {
    chrome.storage.local.get(katalonServerPortStorage, function(result) {
        var port;
        if (!(katalonServerPortStorage in result)) {
            port = (bowser.name == "Chrome")
                 ? (katalonServerPort ? katalonServerPort : katalonServerPortForChrome)
                 : katalonServerPortForFirefox;
            setKatalonServerPort(port);
        } else {
            port = result[katalonServerPortStorage];
        }
        callback(port);
    })
}
```

默认值 `katalon/constants.js:27`：

```js
katalonServerPortConst = "50000"
```

用户可在设置面板里改：`setting-panel/js/setting-tabs/KS-port-setting-tab.js:31-33`（回填）与 `:47`（保存 `setKatalonServerPort($('#KS-port').val())`）。

#### 3.3.3 下行命令字

`katalon/background.js:242-281`：

```js
function handleServerMessage(message) {
    if (clientSocket == null || !message) { return; }
    var jsonMessage = JSON.parse(message);

    switch (jsonMessage.command) {
        case REQUEST_BROWSER_INFO:
            var message = {
                command: BROWSER_INFO,
                data: {
                    browserName: bowser.name,
                    version: (jsonMessage.data && jsonMessage.data.currentVersionString)
                             ? jsonMessage.data.currentVersionString : ""
                }
            }
            version = …;
            clientSocket.send(JSON.stringify(message));
            clientSocket.send(SELENIUM_SOCKET + "=true");
            break;
        case START_INSPECT:
            startAddon(RUN_MODE_OBJECT_SPY, jsonMessage.data, version);
            createMenus(RUN_MODE_OBJECT_SPY);
            break;
        case START_RECORD:
            startAddon(RUN_MODE_RECORDER, jsonMessage.data, version);
            createMenus(RUN_MODE_RECORDER);
            break;
        case HIGHLIGHT_OBJECT:
            if (!jsonMessage.data) { break; }
            highlightObject(jsonMessage.data);
            break;
    }
}
```

命令字全部来自 `katalon/constants.js:10-18`：

```js
var START_ADDON = "START_ADDON";
var STOP_ADDON = "STOP_ADDON";
var REQUEST_BROWSER_INFO = "REQUEST_BROWSER_INFO";
var BROWSER_INFO = "BROWSER_INFO";
var CHECK_ADDON_START_STATUS = "CHECK_ADDON_START_STATUS";
var START_INSPECT = "START_INSPECT";
var START_RECORD = "START_RECORD";
var HIGHLIGHT_OBJECT = "HIGHLIGHT_OBJECT";
var SELENIUM_SOCKET = "SELENIUM_SOCKET";
```

**协议是混合的**：既有 JSON（`{"command":"BROWSER_INFO","data":{...}}`），也有裸的 `key=value` 文本（`SELENIUM_SOCKET=true`、`element=<urlencoded json>`）。上行元素数据（`:47-72`）：

```js
    if (mode == 'INSPECT') {
        clientSocket.send(keyword + "=" + encodeURIComponent(JSON.stringify(object)));
    } else if (mode == 'RECORD') {
        browser.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
            if (tabs && tabs[0] && tabs[0].id) {
                object['action']['windowId'] = tabs[0].id;
                clientSocket.send(keyword + "=" + encodeURIComponent(JSON.stringify(object)));
            }
        });
    }
```

`keyword` 固定为 `'element'`，来自 `katalon/context_menu.js:28`：

```js
    var data = { keyword : 'element', obj : object, mode: 'INSPECT'  }
```

#### 3.3.4 广播到所有标签页

`katalon/background.js:283-299`：

```js
function startAddon(newRunMode, data, vers) {
    runMode = newRunMode;
    runData = data;
    browser.tabs.query({}).then(function (tabs) {
        for (i = 0; i < tabs.length; ++i) {
            browser.tabs.sendMessage(tabs[i].id, {
                action: START_ADDON, runMode: newRunMode, data: data, version: vers
            }).then(function () {});
        }
    });
    focusOnWindow();
}
```

content 侧接收在 `katalon/main.js`（已被打进 bundle，`bundles/content.1.bundle.js:37832-37850`，来自压缩产物的分隔注释定位）：

```js
browser.runtime.onMessage.addListener(function(request, sender, callback) {
    if (!request.action) { return; }
    switch (request.action) {
    case START_ADDON:  start(request.runMode, request.data, request.version); break;
    case STOP_ADDON:   stop(); break;
    }
});

browser.runtime.sendMessage({ action : CHECK_ADDON_START_STATUS })
  .then(function(response) {
    start(response.runMode, response.data, response.version);
});
```

最后一段是**新标签页的"补课"机制**：页面刚加载时主动问 SW 当前是不是已经处于 Object Spy 模式，是就立刻进入。这个模式（广播 + 新页补课）很值得复用，见第 6 节。

#### 3.3.5 遗留的 HTTP 轮询通道（已废弃但代码尚在）

`katalon/background.js:127-179` 还有一套 `XMLHttpRequest` 轮询：

```js
function startSendRequest(request) {
    if (registeredRequest) { return; }
    registeredRequest = true;
    katalonServer = request.url;
    setInterval(function () { sendRequest("GET_REQUEST", true); }, 200);
}
```

以 `REQUEST_SEPARATOR = "_|_"`（`:7`）切分 `requestId_|_TYPE_|_data`。但唯一的调用点已被注释掉（`:192-193`）：

```js
    } else if (request.action == "GET_REQUEST") {
        // startSendRequest(request);
```

而且 `new XMLHttpRequest()` 在 MV3 service worker 里**根本不存在**（SW 只有 `fetch`），所以即使打开也会立刻抛异常。判定：**死代码**。

---

### 3.4 通道 C：externally_connectable + onMessageExternal

#### 3.4.1 manifest 声明

`manifest.json:46-50`：

```json
   "externally_connectable": {
      "accepts_tls_channel_id": false,
      "ids": [ "*" ],
      "matches": [ "https://developer.mozilla.org/*", "https://katalon.com/*" ]
   },
```

`ids: ["*"]` 意为**任意已安装扩展都可以给它发消息**。`matches` 里的两个站点则允许网页直接 `chrome.runtime.sendMessage(<KR扩展ID>, …)`。

#### 3.4.2 注册协议：`katalon_recorder_register`

`background/kar.js:265-308`：

```js
var externalCapabilities = {};

browser.runtime.onMessageExternal.addListener(function(message, sender) {
    if (message.type === 'katalon_recorder_register') {
        var payload = message.payload;
        // payload: {
        //     capabilities: [
        //         { id: 'super-power', summary: 'Generate super power', type: 'export' }
        //     ]
        // }
        var capabilities = payload.capabilities;
        if (!capabilities) {
            // payload: { summary: 'Sample Katalon Recorder Plugin Format' }
            capabilities = [ { id: '', summary: payload.summary, type: 'export' } ];
        }
        var extensionId = sender.id;
        var now = new Date().getTime();
        for (var i = 0; i < capabilities.length; i++) {
            var capability = capabilities[i];
            capability.extensionId = extensionId;
            var capabilityGlobalId = extensionId + '-' + capability.id;
            externalCapabilities[capabilityGlobalId] = {
                extensionId: extensionId,
                capabilityId: capability.id,
                summary: capability.summary,
                type: capability.type,
                lastPing: now
            };
        }
    }
});
```

注释里那两段就是官方的协议文档，非常明确。注意 `sender.id` 是 Chrome 保证不可伪造的扩展 ID。

#### 3.4.3 心跳淘汰：2 分钟

`background/kar.js:310-322`：

```js
browser.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.getExternalCapabilities) {
        var now = new Date().getTime();
        Object.keys(externalCapabilities).forEach(function(capabilityGlobalId) {
            var capability = externalCapabilities[capabilityGlobalId];
            if ((now - capability.lastPing) > 2 * 60 * 1000) {
                delete externalCapabilities[capabilityGlobalId];
            }
        });
        sendResponse(externalCapabilities);
    }
});
```

**注意这是一个「懒惰淘汰」**：只在 Panel 查询时才清一遍，不是定时清。而且 `lastPing` 只在注册时写入一次——`grep lastPing` 全仓只有 `:304` 与 `:315` 两处，**没有任何地方刷新它**。所以第三方扩展必须每 2 分钟重发一次 `katalon_recorder_register` 才能保持在线（等于把 register 当心跳用）。

#### 3.4.4 反向调用：`katalon_recorder_export`

Panel 侧先拉取能力列表并渲染成 `<select>` 选项（`panel/js/katalon/kar-generateScript.js:362-393`）：

```js
    $("#export-to-other").click(function() {
        browser.runtime.sendMessage({ getExternalCapabilities: true })
          .then(function(externalCapabilities) {
            …
            Object.keys(externalCapabilities).forEach(function(capabilityGlobalId) {
                var capability = externalCapabilities[capabilityGlobalId];
                if (capability.type == 'export') {
                    var optionId = 'external-exporter-' + capabilityGlobalId;
                    var summary = capability.summary + ' (via plugin)';
                    var tooltip = 'Extension ID: ' + capability.extensionId;
                    selectInput.append($('<option></option>')
                        .attr('id', optionId).attr('value', optionId).attr('title', tooltip)
                        .data('extensionId', capability.extensionId)
                        .data('capabilityId', capability.capabilityId)
                        .addClass('external-exporter').text(summary));
                }
            });
            …
        });
    });
```

选中后真正发消息（`panel/js/katalon/kar-generateScript.js:194-228`）：

```js
        browser.runtime.sendMessage(
            extensionId, {
                type: 'katalon_recorder_export',
                payload: {
                    capabilityId: capabilityId,
                    name: name,
                    commands: commands
                }
            }
        ).then(function(response) {
            var payload = response.payload;
            if (response.status) {
                options = { defaultExtension: payload.extension, mimetype: payload.mimetype };
                displayOnCodeMirror(language, payload.content);
            } else {
                throw (payload);
            }
        }).catch(function(err) {
            var content = 'Could not export.';
            if (err) { content += ' Error: ' + JSON.stringify(err) + '.'; }
            displayOnCodeMirror(language, content);
        });
```

**完整协议表**：

| 方向 | `type` | payload | 响应 |
|---|---|---|---|
| 第三方扩展 → KR | `katalon_recorder_register` | `{ capabilities: [{id, summary, type}] }` 或 `{ summary }` | 无（fire-and-forget） |
| KR → 第三方扩展 | `katalon_recorder_export` | `{ capabilityId, name, commands: Command[] }` | `{ status: bool, payload: { content, extension, mimetype } }` 或 `{ status:false, payload: err }` |

`commands` 的元素形状来自 `kar-generateScript.js:13-23`：

```js
function getCommandsToGenerateScripts() {
    var ret = [];
    let commands = getRecordsArray();
    for (var index = 0; index < commands.length; index++) {
        ret.push(new Command(getCommandName(commands[index]),
                             getCommandTarget(commands[index]),
                             getCommandValue(commands[index])));
    }
    return ret;
}
```

即 `{ command, target, value }` 三元组数组。

---

### 3.5 通道 D：TestOps 云端日志/备份上传

端点表在 `panel/js/katalon/kar.js:5-17`：

```js
var testOpsEndpoint = 'https://testops.katalon.io';
var testOpsUrls = {
  getFirstProject: `${testOpsEndpoint}/api/v1/projects/first`,
  getUploadUrl: `${testOpsEndpoint}/api/v1/files/upload-url`,
  getUploadUrlAvatar: `${testOpsEndpoint}/api/v1/files/upload-url-avatar`,
  getUserInfo: `${testOpsEndpoint}/api/v1/users/me`,
  uploadBackup: `${testOpsEndpoint}/api/v1/katalon-recorder/backup`,
  uploadTestReports: `${testOpsEndpoint}/api/v1/katalon-recorder/test-reports`,
  loginToTestOps: `${testOpsEndpoint}/login`,
  logoutFromTestOps: `${testOpsEndpoint}/api/v1/users/logout`,
};
```

**三段式预签名上传**（`panel/js/katalon/kar-upload.js:80-142`）：

```
① GET  /api/v1/files/upload-url?projectId=…   → { path, uploadUrl }
② PUT  <uploadUrl>  Content-Type: text/plain  ← 日志正文
③ POST /api/v1/katalon-recorder/test-reports
        { projectId, batch: Date.now(), isEnd: true,
          fileName: "KR-<ts>.log", uploadedPath: path }
```

日志正文是直接从 DOM 里刮的（`kar-upload.js:96-100`）：

```js
      var logcontext = "";
      var logcontainer = document.getElementById("logcontainer");
      for (var i = 0; i < logcontainer.childNodes.length; i++) {
        logcontext = logcontext + logcontainer.childNodes[i].textContent + "\n";
      }
```

登录换 token 用了一个写死的 Basic 凭据（`panel/js/katalon/kar.js:27-34`）：

```js
    const loginUrl = `${testOpsEndpoint}/oauth/token`;
    fetch(loginUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa("kit:kit")}`,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: formData,
    })
```

> 这属于 TECH-14（鉴权埋点）的范围，本文只标注它是第 4 条外部通道。**个人插件整块删除**。

---

### 3.6 `debugger` 权限查证：到底用在哪

**结论：`debugger` 权限确实被使用，不是「声明了但未使用」。** 全部调用点集中在 `background/kar.js` 一个文件里，共 11 处 `chrome.debugger.*`。

`manifest.json:64`：

```json
   "permissions": [ "tabs", "activeTab", "contextMenus", "downloads", "webNavigation",
                    "notifications", "cookies", "storage", "unlimitedStorage",
                    "debugger", "scripting", "offscreen" ],
```

#### 3.6.1 调用点全表

| 位置 | CDP 方法 | 用途 |
|---|---|---|
| `background/kar.js:241` | `chrome.debugger.attach(debuggeeId, "1.2")` | 附加，协议版本 1.2 |
| `background/kar.js:245-248` | `DOM.enable` | 开 DOM 域 |
| `background/kar.js:199-201` | `DOM.getFlattenedDocument {depth:-1, pierce:true}` | **跨 iframe** 找节点 |
| `background/kar.js:219` | `DOM.getDocument` | 主文档根节点 |
| `background/kar.js:224-226` | `DOM.querySelector {nodeId, selector}` | 顶层文档按 CSS 找 |
| `background/kar.js:65-71` | `DOM.setFileInputFiles {nodeId, files}` | **文件上传** |
| `background/kar.js:89-94` | `DOM.focus {nodeId}` | 按键前先聚焦 |
| `background/kar.js:111-122` | `Input.dispatchKeyEvent {type:'rawKeyDown', …}` | **真实按键按下** |
| `background/kar.js:127-138` | `Input.dispatchKeyEvent {type:'keyUp', …}` | 真实按键抬起 |
| `background/kar.js:35-38` | `DOM.disable` | 收尾 |
| `background/kar.js:43` | `chrome.debugger.detach` | 分离 |

#### 3.6.2 入口路由

`background/kar.js:159-194`：

```js
browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.captureEntirePageScreenshot) {
        var windowId = request.captureWindowId || sender.tab.windowId;
        retryUntilSuccess(() => browser.tabs.captureVisibleTab(windowId, { format: 'png' }))
          .then((image) => { sendResponse({ image: image }); });
        return true;
    } else {
        var tabId = sender.tab.id;
        var debuggeeId = {tabId: tabId};
        var frameId = sender.frameId;
        if (request.uploadFile) {
            if (attachedTabs[tabId]) {
                doUploadFile(request, sendResponse, debuggeeId, frameId);
            } else {
                doAttachDebugger(sendResponse, debuggeeId, function() {
                    doUploadFile(request, sendResponse, debuggeeId, frameId);
                });
            }
            return true;
        } else if (request.sendSpecialKeys) {
            …同构…
            return true;
        }
    }
});
```

只有 `uploadFile` 和 `sendSpecialKeys` 两个入口。整页截图走 `tabs.captureVisibleTab`，**不需要 debugger**。

#### 3.6.3 节点定位的两条分支

`background/kar.js:197-238`。这是整个 CDP 部分最巧的一段：

```js
function doActionOnNode(frameId, debuggeeId, sendResponse, request, f) {
    if (frameId) {
        chrome.debugger.sendCommand(debuggeeId, "DOM.getFlattenedDocument", {
            depth: -1, pierce: true
        }, function (res) {
            …
                var krId = request.krId;
                var node = res.nodes.find(function (n) {
                    return n.attributes && n.attributes.indexOf(krId) >= 0;
                });
                if (node) { f(node.nodeId); } else { doDetach(…); }
            …
        });
    } else {
        chrome.debugger.sendCommand(debuggeeId, "DOM.getDocument", {}, function (res) {
            …
            chrome.debugger.sendCommand(debuggeeId, "DOM.querySelector", {
                nodeId: res.root.nodeId, selector: request.locator
            }, function (res) { f(res.nodeId); });
        });
    }
}
```

- **顶层文档**（`frameId` 为 0/falsy）：直接 `DOM.querySelector`。
- **iframe 内部**：CDP 的 `DOM.querySelector` 无法跨 frame，于是改用 `DOM.getFlattenedDocument({pierce:true})` 拉平**整棵含 shadow/iframe 的树**，再在所有节点的 `attributes` 扁平数组里线性查找一个由 content script 事先打在元素上的临时标记 `krId`。

> `n.attributes` 在 CDP 里是**扁平数组** `["id","foo","class","bar"]`，所以 `indexOf(krId)` 既可能命中属性名也可能命中属性值——这里靠 `krId` 是随机串来保证不误命中。这是很典型的「用 marker 属性穿透 frame」技巧，值得复用（见第 6 节）。

#### 3.6.4 按键序列：串行递归

`background/kar.js:103-152`，用递归函数 `f(i)` 保证 `rawKeyDown` → `keyUp` → 下一个键**严格串行**：

```js
                  var f = function(i) {
                      if (i >= keyCodes.length) {
                          doDetach(sendResponse, debuggeeId);
                      } else {
                          var keyCode = keyCodes[i];
                          // code: 'KeyV' key: 'v'
                          chrome.debugger.sendCommand(debuggeeId, "Input.dispatchKeyEvent", {
                                type: 'rawKeyDown',
                                windowsVirtualKeyCode: keyCode,
                                nativeVirtualKeyCode : keyCode,
                                macCharCode: keyCode,
                                key: keyboardEventKey,
                                code: keyboardEventCode,
                                modifiers: modifiers
                            }, function (res) {
                                … "Input.dispatchKeyEvent" type:'keyUp' … f(i + 1) …
                            });
                      }
                  };
                  f(0);
```

三个 keyCode 字段（`windowsVirtualKeyCode` / `nativeVirtualKeyCode` / `macCharCode`）填同一个值是跨平台兜底写法。

#### 3.6.5 detach 纪律

每条路径**无论成败都走 `doDetach`**（`background/kar.js:34-58`）：

```js
function doDetach(sendResponse, debuggeeId, err) {
    chrome.debugger.sendCommand(debuggeeId, "DOM.disable", {}, function(res) {
          // force read last error
          if (chrome.runtime.lastError) { }
          chrome.debugger.detach(debuggeeId, function() {
              onDetach(debuggeeId);
              if (err) { sendResponse({ status: false, err: err.message }); }
              else     { sendResponse({ status: true }); }
          });
    });
};
```

`// force read last error` 那两行是**必须的**：不读取 `chrome.runtime.lastError` 会让 Chrome 在控制台打 "Unchecked runtime.lastError"。

外部 detach（用户手动点掉黄条）也要清理（`:27-30`、`:261-263`）：

```js
function onDetach(debuggeeId) {
    delete attachedTabs[debuggeeId.tabId];
}
…
if (chrome.debugger) {
    chrome.debugger.onDetach.addListener(onDetach);
}
```

#### 3.6.6 能力探测

`background/kar.js:324-330`：

```js
browser.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.checkChromeDebugger) {
        sendResponse({ status: !!chrome.debugger });
    }
});
```

content 侧 `content/kar.js:1-7`（全文）：

```js
var hasChromeDebugger = false;

browser.runtime.sendMessage({
    checkChromeDebugger: true
}).then(function(result) {
    hasChromeDebugger = result.status
});
```

> 这段的存在意义是 Firefox 没有 `chrome.debugger`，所以要在运行时降级。个人插件如果只做 Chrome，这三处（`:324-330`、`content/kar.js` 全文、`:261`）都可以删。

---

### 3.7 `page/runScript.js`：MAIN world 任意 JS 执行

这是 M15 里最值得复用的一块。它解决的是：**如何在页面的真实 JS 上下文里执行一段用户提供的脚本，并把返回值同步回扩展**。

#### 3.7.1 注入侧

`content/runScript-injecter.js:20-24`：

```js
(async () => {
	var elementForInjectingScript = document.createElement("script");
	elementForInjectingScript.src = trustedPolicy.createScriptURL(await browser.runtime.getURL("page/runScript.js"));
	(document.head || document.documentElement).appendChild(elementForInjectingScript);
})()
```

三个细节：

1. `trustedPolicy.createScriptURL` —— 兜底 Trusted Types。`content/trustedPolicy.js:1-9`：

```js
var trustedPolicy = {
  createScriptURL: (url) => url,
  createHTML: (string, sink) => string,
  createScript: string => string,
}

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  trustedPolicy = window.trustedTypes.createPolicy('default2', trustedPolicy);
}
```
不这样做，在开了 `require-trusted-types-for 'script'` 的站点上 `script.src = "..."` 会直接抛异常。

2. **`await browser.runtime.getURL(...)`** —— `getURL` 本来是同步 API，这里之所以要 `await`，是因为在 MAIN world 里 `browser.runtime` 已经被换成了跨 world RPC 代理（见 3.9），**所有方法都变成了异步**。这是全仓最容易看漏的一行。

3. `page/runScript.js` 必须在 `manifest.json:71-74` 的 `web_accessible_resources` 里：

```json
   "web_accessible_resources": [ {
      "matches": [ "\u003Call_urls>" ],
      "resources": [ "page/prompt.js", "page/runScript.js", "katalon/authenticated.html" ]
   } ]
```

#### 3.7.2 执行侧

`page/runScript.js:19-53`（全文核心）：

```js
function katalonSendMessage(result) {
	window.postMessage({
		direction: "from-page-runscript",
		result: result
	}, "*");
}

function katalonRunScript(script) {
	var result;
	try {
		var scriptResult = script();
		result = { status: true, result: scriptResult }
	} catch (e) {
		result = { status: false, result: 'Error: ' + e.toString() }
	}
	katalonSendMessage(result);
}

window.addEventListener("message", function(event) {
	if (event.source == window && event.data && event.data.direction == "from-content-runscript") {
		isWanted = true;
		var doc = window.document;
		var scriptTag = doc.createElement("script");
		scriptTag.type = "text/javascript"
		scriptTag.text = 'katalonRunScript(function() {' + event.data.script + ';})';
		doc.body.appendChild(scriptTag);
	}
});
```

**关键技巧**：不用 `eval`，而是拼一个 `<script>` 标签把用户脚本包进 `katalonRunScript(function(){ …用户脚本… ;})`。这样：

- 用户脚本在页面全局作用域执行，能访问页面自己的 `window.xxx`、jQuery、Vue 实例等；
- 用 `function(){}` 包裹后，用户写 `return document.title` 也能拿到返回值；
- 异常被 `try/catch` 捕获，转成 `{status:false, result:'Error: …'}`。

#### 3.7.3 结果回收

`content/runScript-injecter.js:26-32`：

```js
window.addEventListener("message", function(event) {
	if (event.data && event.data.direction == "from-page-runscript"
		&& (event.source.top == window || event.source.top == window.originalWindow)) {
		selenium.browserbot.runScriptResponse = true;
		selenium.browserbot.runScriptMessage = event.data.result;
	}
});
```

`event.source.top == window` 是一层**来源校验**：只接受同一顶层窗口内发出的消息。

#### 3.7.4 命令侧：`runScript`

`content/selenium-api.js:3159-3186`：

```js
Selenium.prototype.doRunScript = function (script, varName) {

    window.postMessage({
        direction: "from-content-runscript",
        script: script
    }, "*");
    return this.browserbot.getRunScriptMessage().then(function (actualMessage) {
        if (actualMessage.status !== undefined) {
            if (actualMessage.status) {
                if (varName) {
                    return browser.runtime.sendMessage({ "storeStr": actualMessage.result, "storeVar": varName })
                      .then(function () { return { result: 'success' }; })
                      .catch(function () { return { result: 'success' }; });
                } else {
                    return Promise.resolve(true);
                }
            } else {
                return Promise.reject(actualMessage.result);
            }
        } else if (actualMessage != "No error!!!!") {
            return Promise.reject(actualMessage);
        } else {
            return Promise.resolve(true);
        }
    });
}
```

等待逻辑（`content/selenium-browserbot.js:2455-2474`）：

```js
BrowserBot.prototype.getRunScriptMessage = function() {
    let self = this;
    let response = new Promise(function(resolve, reject) {
        let count = 0;
        let interval = setInterval(function() {
            if (!self.runScriptResponse) {
                count++;
                if (count > 4) {
                    resolve("No error!!!!");
                    clearInterval(interval);
                }
            } else {
                resolve(self.runScriptMessage);
                self.runScriptResponse = false;
                self.runScriptMessage = null;
                clearInterval(interval);
            }
        }, 200);
    })
    return response;
}
```

**200ms × 5 = 1 秒超时**，超时后 resolve 一个魔法字符串 `"No error!!!!"`，上游把它当成成功。也就是说：**如果用户脚本跑超过 1 秒，`runScript` 会静默判成功且拿不到返回值**。这是个真实的坑（见 5.7）。

同样的模式还有 `page/prompt.js` + `content/prompt-injecter.js` 用来劫持 `alert/confirm/prompt`（`content/prompt-injecter.js:20-24` 与 `:26-74`），逻辑同构，可作为对照。

---

### 3.8 `command-receiver.js` 消息协议

`content/command-receiver.js:228` 是唯一注册点：

```js
browser.runtime.onMessage.addListener(doCommands);
```

`doCommands(request, sender, sendResponse, type)`（`:49`）按 `request` 的**字段名**而不是 `type` 字段分派——这是 SideeX 的老风格：

| 判据字段 | 行号 | 行为 | sendResponse |
|---|---|---|---|
| `request.commands === "waitPreparation"` | `:52-54` | `selenium.doWaitPreparation` | `{}` |
| `=== "prePageWait"` | `:55-57` | `doPrePageWait` | `{ new_page }` |
| `=== "pageWait"` | `:58-60` | `doPageWait` | `{ page_done }` |
| `=== "ajaxWait"` | `:61-63` | `doAjaxWait` | `{ ajax_done }` |
| `=== "domWait"` | `:64-66` | `doDomWait` | `{ dom_time }` |
| `=== "captureEntirePageScreenshot(AndWait)"` | `:67-76` | 转发给 SW 截图 | `{ result, capturedScreenshot, capturedScreenshotTitle }` |
| 其余，且 `selenium["do"+Upper]` 存在 | `:77-108` | 执行 Selenium 原生命令 | `{ result: "success" }` 或 `{ result: <errmsg> }` |
| 其余，落到 CommandHandlerFactory | `:110-132` | Selenium IDE 命令 | 同上 |
| `request.selectMode` | `:139-173` | 元素选择器模式 | 反向 `sendMessage({selectTarget, target})` |
| `request.attachRecorder` | `:175-180` | `recorder.attach()` | 无 |
| `request.detachRecorder` | `:181-187` | `recorder.detach()` | 无 |

#### 3.8.1 「正在回放」标记

`:81` 与 `:87/:95/:100/:105`：

```js
                    document.body.setAttribute("SideeXPlayingFlag", true);
                    let returnValue = selenium["do"+upperCase](request.target, selenium.preprocessParameter(request.value));
                    if (returnValue instanceof Promise) {
                        returnValue.then(function(value) {
                            document.body.removeAttribute("SideeXPlayingFlag");
                            …
```

给 `<body>` 打属性，录制器据此判断「现在是回放不是人操作」，避免把回放动作再录一遍。**极简且有效**，强烈建议复用。

#### 3.8.2 同步/异步命令统一

`:83-102` 同时支持返回 Promise 和返回普通值的命令实现，是很好的模板。

#### 3.8.3 等待条件轮询

`:191-221`：

```js
function continueTestWhenConditionIsTrue(waitForCondition, sendResponse, result) {
    try {
        if (waitForCondition == null) {
            document.body.removeAttribute("SideeXPlayingFlag");
            sendResponse(result && result.failed ? {result:'did not match'} : {result:"success"});
        } else if (waitForCondition()) {
            document.body.removeAttribute("SideeXPlayingFlag");
            sendResponse(result && result.failed
                ? {result: 'Failure message: ' + result.failureMessage}
                : {result: "success"});
        } else {
            setTimeout(function() {
                continueTestWhenConditionIsTrue(waitForCondition, sendResponse, result);
            }, 10);
        }
    } catch(e) { … }
}
```

**10ms 递归轮询，没有超时上限**——如果条件永不成立，`sendResponse` 永不调用，Panel 侧的 Promise 永远挂起。见 5.8。

#### 3.8.4 用户扩展脚本的 eval

`content/command-receiver.js:29-47`：

```js
if (!extensionsLoaded) {
    extensionsLoaded = true;
    browser.storage.local.get('extensions', function(result) {
        extensions = result.extensions;
        if (extensions) {
            var extensionScripts = Object.values(extensions);
            for (var i = 0; i < extensionScripts.length; i++) {
                var extensionScript = extensionScripts[i];
                eval(trustedPolicy.createScript(`{ ${extensionScript.content} }`));
            }
        }
        commandFactory = new CommandHandlerFactory();
        commandFactory.registerAll(selenium);
    });
}
```

这是**页面 MAIN world 里的直接 `eval`**——因为整个 bundle 跑在 `world: "MAIN"`（`manifest.json:27-34`），页面 CSP 不管扩展 CSP，所以能 eval。注意 `{ … }` 那对花括号是块级作用域包裹，防止用户脚本污染全局。

---

### 3.9 跨 world RPC：chrome-polyfill + RemoteObjectHelper

7.1.0 把**几乎全部 content 脚本搬到了 `world: "MAIN"`**（`manifest.json:27-34`）：

```json
   }, {
      "all_frames": true,
      "js": [ "bundles/content.1.bundle.js" ],
      "match_about_blank": true,
      "matches": [ "\u003Call_urls>" ],
      "run_at": "document_start",
      "world": "MAIN"
   },
```

MAIN world 没有扩展权限的 `chrome` API。于是他们造了一套跨 world RPC。

**服务端**（ISOLATED world，`manifest.json:16` 注入）——`common/chrome-polyfill-server.js:1-9`（全文）：

```js
document.documentElement.setAttribute('katalonExtensionId', chrome.runtime.id);

const transportServer = new PageTransportServer();

transportServer.addConnectionListener((connection) => {
    RemoteObjectHelper.attachToServer(chrome, connection, 'chrome');
});

transportServer.listen();
```

**客户端**（MAIN world）——`common/chrome-polyfill.js:1-15`（全文）：

```js
const myChrome = {
    runtime: {
        ...chrome.runtime,
        id: document.documentElement.getAttribute('katalonExtensionId'),
    },
    extension: {},
};

const transport = new PageTransport();
const chromeProxy = RemoteObjectHelper.attachToClient(myChrome, transport, 'chrome');

chrome.runtime = chromeProxy.runtime;
chrome.storage = chromeProxy.storage;
chrome.extension = chromeProxy.extension;
```

传输层在压缩产物 `common/remote-object-helper-content.js:1` / `common/remote-object-helper-page.js:1` 里（**来自压缩产物**，以下片段经格式化）：

```js
class La extends Lo {
  secretKey = "pandoraboz";
  listen() {
    window.addEventListener("message", async s => {
      if (s.data?.type === "connect" && s.data?.key === this.secretKey) {
        const i = new xa(this.secretKey), g = it(i);
        await g.connect();
        this.notifyConnection(g)
      }
    })
  }
}
…
verifyRawMessage(s) {
  return s.data?.source !== this.id
      && s.data?.type === "message"
      && s.data?.key === this.secretKey
}
```

即：**握手密钥硬编码为字符串 `"pandoraboz"`，走 `window.postMessage(..., "*")`**。

副作用之一（前面提过）：MAIN world 里所有 `browser.*` / `chrome.runtime.*` 调用都变成异步 RPC，因此 `content/runScript-injecter.js:22` 才要写 `await browser.runtime.getURL(...)`。

副作用之二是安全问题，见 5.6。

---

### 3.10 sandbox iframe：受控 eval

Panel 是扩展页面，受扩展 CSP 约束（`manifest.json:41-43`）：

```json
   "content_security_policy": {
      "extension_pages": "script-src 'self'; object-src 'self'; unsafe-eval; unsafe-inline;"
   },
```

> 这条 CSP 有语法错误——`unsafe-eval` / `unsafe-inline` 是**指令值**不是**指令名**，写在分号后会被当作未知指令。Chrome 会忽略这两段（并在加载时告警），实际生效的仍是 `script-src 'self'; object-src 'self'`。也就是说 **Panel 里不能 `eval`**。

所以表达式求值被外包给了 `sandbox` 页面。`manifest.json:65-67`：

```json
   "sandbox": {
      "pages": [ "panel/sandbox.html" ]
   },
```

`panel/sandbox.html`（全文 3 行）：

```html
<html>
  <script type="module" src="./sandbox.js"></script>
</html>
```

`panel/sandbox.js:28-54` —— 一个「输入 Promise / 输出 Promise」交替的死循环：

```js
export class EvalScope {
  input = newPromise();
  output = newPromise();

  constructor() { this.run(); }

  async run() {
    do {
      const expression = await this.input.promise;
      this.input = newPromise();
      try {
        const result = await (0, eval)(expression);
        this.output.resolve(result);
      } catch (error) {
        this.output.reject(error);
      }
      this.output = newPromise();
    } while (true);
  }

  async eval(script) {
    this.input.resolve(script);
    return this.output.promise;
  }
}
```

`(0, eval)` 是**间接 eval**，强制在全局作用域求值（而不是 `EvalScope.run` 的闭包里），这样用户脚本里 `var x = 1` 会挂到 sandbox 的 global 上、跨次求值可见。

客户端 `panel/js/UI/services/helper-service/SandboxEvaluator.js:23-44`：

```js
  init() {
    this.sandbox = document.createElement("iframe");
    this.sandbox.src = this.sandboxPath;
    this.sandbox.style.display = "none";
    document.body.appendChild(this.sandbox);

    window.addEventListener("message", (event) => {
      if (event.data?.type === "eval-result") {
        this.outputPromise.resolve(event.data.result);
        this.outputPromise = newPromise();
      }
      if (event.data?.type === "eval-error") {
        this.outputPromise.reject(event.data.error);
        this.outputPromise = newPromise();
      }
    });
  }

  async eval(script) {
    this.sandbox.contentWindow.postMessage(script, "*");
    return this.outputPromise.promise;
  }
```

用户自定义命令扩展也走它（`panel/js/katalon/kar-extensionScript.js:44-77`）：

```js
  Object.keys(extensions).forEach(async function (extensionFileName) {
    const userScript = extensions[extensionFileName].content;
    const info = await sandboxEvaluator.eval(`(() => {
      class LocatorBuilders {
        static builders = [];
        static add(name, builder) { this.builders.push({ name, builder: builder.toString() }); }
        static _orderChanged() {}
      }
      const Selenium = { prototype: {} }

      ${userScript}

      Object.entries(Selenium.prototype).forEach(([key, value]) => {
        Selenium.prototype[key] = value.toString();
      });
      return { builders: LocatorBuilders.builders,
               _preferredOrder: LocatorBuilders._preferredOrder,
               Selenium: Selenium, }
    })()`);
```

**注意函数是用 `.toString()` 跨 iframe 传回来的**（结构化克隆不能传函数），到主面板再包一层重新丢回 sandbox 执行（`:71-75`）。

---

## 4. 数据结构与流程图

### 4.1 消息总线全景

```
┌───────────────────────── Service Worker (worker_wrapper.js) ─────────────────────────┐
│ background/background.js   action.onClicked → openPanel                              │
│ background/kar.js          onMessage: captureEntirePageScreenshot | uploadFile |     │
│                                       sendSpecialKeys | getExternalCapabilities |    │
│                                       checkChromeDebugger                            │
│                            onMessageExternal: katalon_recorder_register              │
│ katalon/background.js      WebSocket ws://localhost:50000                            │
│                            onMessage: xhttp | CHECK_ADDON_START_STATUS               │
└───────┬──────────────────────────────────────────────────────────┬───────────────────┘
        │ runtime.sendMessage / tabs.sendMessage                   │ chrome.debugger (CDP)
        ▼                                                          ▼
┌─────────────────── Content (world: MAIN) ─────────────────┐   ┌──────────────┐
│ command-receiver.js  onMessage(doCommands)                │   │  目标页 DOM  │
│   ├─ selenium.doXxx(...)                                  │   └──────────────┘
│   ├─ commandFactory.getCommandHandler(...)                │
│   └─ recorder.attach() / detach()                         │
│ runScript-injecter.js  ──postMessage──►  page/runScript.js│
│ prompt-injecter.js     ──postMessage──►  page/prompt.js   │
│ chrome-polyfill.js     ──postMessage──►  ISOLATED world   │
│ katalon/main.js        START_ADDON / STOP_ADDON           │
│ check-browser-automation.js  navigator.webdriver 上报     │
└───────────────────────────────────────────────────────────┘
        ▲
        │ runtime.sendMessage
┌───────┴────────────────── Panel (panel/index.html) ─────────────────────────────────┐
│ kar-generateScript.js  → runtime.sendMessage(extId, katalon_recorder_export)         │
│ kar-upload.js          → TestOps HTTPS                                               │
│ SandboxEvaluator.js    → iframe panel/sandbox.html （eval）                          │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 CDP 文件上传时序

```
content (selenium.doUpload)
   │ runtime.sendMessage({ uploadFile:true, krId, locator, file:"a.txt,b.txt" })
   ▼
background/kar.js:174  attachedTabs[tabId]?
   ├─ 否 → doAttachDebugger(:240)
   │        chrome.debugger.attach({tabId},"1.2")   ← 页面顶部出现「正在调试」黄条
   │        └ DOM.enable
   └─ 是 ↓
doUploadFile(:61)
   └ doActionOnNode(:197)
       ├ frameId 有 → DOM.getFlattenedDocument{depth:-1,pierce:true}
       │                 → nodes.find(n => n.attributes.indexOf(krId) >= 0)
       └ frameId 无 → DOM.getDocument → DOM.querySelector{selector: locator}
   └ DOM.setFileInputFiles{ nodeId, files: request.file.split(",") }
   └ doDetach(:34)  DOM.disable → chrome.debugger.detach
       └ sendResponse({status:true})  /  ({status:false, err})
```

### 4.3 外部能力注册状态机

```
       ┌────────────┐  katalon_recorder_register   ┌───────────────────┐
       │ 第三方扩展 │ ───────────────────────────► │ externalCapabilities│
       └────────────┘   (sender.id 不可伪造)        │  key = extId-capId │
              ▲                                     │  { extensionId,    │
              │                                     │    capabilityId,   │
              │ katalon_recorder_export             │    summary, type,  │
              │ { capabilityId, name, commands }    │    lastPing }      │
              │                                     └─────────┬─────────┘
       ┌──────┴──────┐                                        │
       │  KR Panel   │ ◄── getExternalCapabilities ───────────┘
       └─────────────┘      （顺带淘汰 lastPing > 2min 的项）
              │
              └─► response { status, payload:{content,extension,mimetype} }
                          → displayOnCodeMirror
```

### 4.4 CI 套件数据结构

```jsonc
// readSuiteFromString 的输出
{
  "testSuiteName": "My Suite",           // <title>
  "testCases": [
    {
      "testCaseName": "Login",           // 第一个 <tr> 的 <td>
      "testCaseHTML": "<tr><td>open</td><td>/</td><td></td></tr>…"
    }
  ]
}

// datafiles（可选）
{
  "users.csv": { "type": "csv",  "content": "user,pwd\na,1\n" }
}
```

---

## 5. 隐晦知识点与坑

### 5.1 socket.io CI 通道在 7.1.0 里是**死代码**

- `playback/index.js`、`playback/service/*.js`、`content-marketing/socket-io/socket-io.min.js` 全部随包发布（`_metadata/computed_hashes.json` 里都有条目）。
- 但**没有任何 HTML 引用它们**。`panel/index.html:1016` 引的是 `js/background/playback/index.js`（同名不同文件，是 Panel 的按钮绑定层）：

```html
    <script type="module" src="js/background/playback/index.js"></script>
```

- 全仓 `grep "socket-io"` 除 `_metadata/computed_hashes.json` 外零命中，说明**没有页面引入 socket.io 客户端**，`io` 全局不存在，`playback/index.js:3` 一执行就会 `ReferenceError`。
- `playback/index.js` 的相对 `import("../panel/js/...")` 说明它期望被 `/playback/` 下的某个页面加载，但该目录下只有 `.js`。

**结论：这是上一版（或未来版）留下的孤儿模块。** 对我们是好事——它是一份干净的、无 UI 耦合的「无头回放 + 远程协议」参考实现。

### 5.2 `default_popup` 写错了位置，反而让插件能用

`manifest.json:44`：

```json
   "default_popup": "popup-browser/index.html",
```

它在**顶层**，不在 `action` 里；而且 `popup-browser/` 目录**根本不存在**（`ls` 确认）。Chrome 忽略未知顶层键，于是 `action` 没有 popup，`browser.action.onClicked`（`background/background.js:108`）才会触发并打开 Panel 窗口。

> **谁"好心"把它挪进 `action` 里，整个插件就点不开了。** 正确做法是删掉这一行。

### 5.3 `katalon/background.js` 的 300ms 重连会把 MV3 SW 钉住

`:227 / :232 / :236` 三处 `setTimeout(tryToConnect, 300)`。MV3 SW 本应在 30 秒空闲后被回收，但持续的定时器 + WebSocket 连接尝试会不断产生活动。叠加 `background/background.js:237-239` 的显式保活：

```js
const keepAlive = () => setInterval(browser.runtime.getPlatformInfo, 20e3);
browser.runtime.onStartup.addListener(keepAlive);
keepAlive();
```

**这是两套独立的保活机制**。个人插件只需要保留一套（且最好用 `chrome.alarms`）。

### 5.4 `XMLHttpRequest` 在 MV3 SW 里不存在

`katalon/background.js:140` `var xhttp = new XMLHttpRequest();` 位于 SW 上下文。虽然唯一调用点已注释（`:193`），但这是 MV2→MV3 迁移最典型的残留。**移植任何老代码时先全局 grep `XMLHttpRequest`。**

### 5.5 `externally_connectable.ids: ["*"]` 是敞开的门

`manifest.json:48`。任何已安装的扩展（包括用户误装的恶意扩展）都能：

1. 发 `katalon_recorder_register` 往 KR 的导出下拉框里插一条选项（钓鱼：显示名可以伪装成 "Java (JUnit)"）；
2. 用户一旦选中，KR 会把**完整的测试脚本 commands 数组**（可能含账号密码等 `type` 命令的 value）发给它。

**个人插件：整块删除。** 若确需插件生态，把 `ids` 写成显式白名单。

### 5.6 `pandoraboz`：页面可以借道 RPC 拿到 content script 的 `chrome`

`common/chrome-polyfill-server.js:6`：

```js
    RemoteObjectHelper.attachToServer(chrome, connection, 'chrome');
```

暴露出去的是 **ISOLATED world content script 的 `chrome` 对象**（拥有扩展全部权限），握手条件仅仅是 `window.postMessage({type:"connect", key:"pandoraboz"})`（`common/remote-object-helper-content.js:1`，来自压缩产物）。

页面里任何脚本（含第三方广告 JS）都能：

```js
// 概念验证（本文不提供可运行 exploit，仅说明机制）
window.postMessage({ source: 'x', type: 'connect', key: 'pandoraboz' }, '*');
// 之后按 RemoteObjectHelper 的 REQUEST/RESPONSE 帧格式调用
//   chrome.storage.local.get(null)         → 读走全部录制脚本
//   chrome.runtime.sendMessage({uploadFile:true, ...}) → 触发 CDP setFileInputFiles
```

**推测**：第二条能否成功取决于 RPC 转发时 `sender.tab` 是否仍被填充（消息实际由 content script 发出，应当被填充），我未在源码中找到显式的来源过滤逻辑，因此**保守认为可行**。

**裁剪建议**：如果你的 content 脚本能待在 ISOLATED world（绝大多数录制/回放需求都可以），**整套 chrome-polyfill + RemoteObjectHelper 直接删掉**，省 180 KB 且消除该风险。Katalon 之所以要 MAIN world，是因为 `selenium-browserbot` / `atoms.js` 需要访问页面真实的 `window`（如 `window.jQuery`、页面自定义事件）。

### 5.7 `runScript` 的 1 秒静默超时

`content/selenium-browserbot.js:2461-2465`：`count > 4` × 200ms = 1000ms 后 `resolve("No error!!!!")`，`doRunScript`（`content/selenium-api.js:3180-3182`）把这个字符串当成成功：

```js
        } else if (actualMessage != "No error!!!!") {
            return Promise.reject(actualMessage);
        } else {
            return Promise.resolve(true);
        }
```

于是：**用户脚本里写 `await fetch(...)` 或任何超过 1 秒的操作，命令会「成功」但 `storeVar` 拿不到值**，且没有任何告警。移植时应改成可配置超时并在超时时明确 reject。

### 5.8 `continueTestWhenConditionIsTrue` 没有超时上限

`content/command-receiver.js:209-214` 的 10ms 递归。条件永假 → `sendResponse` 永不调用 → Panel 的 `tabs.sendMessage` Promise 永久 pending → 回放卡死（不是失败，是**挂起**）。必须自己补一个 `deadline`。

### 5.9 `DOM.querySelector` 不能跨 frame，所以才有 `krId`

见 3.6.3。若你要在 iframe 里做 CDP 操作，两条路：
- 本文这条：`DOM.getFlattenedDocument({pierce:true})` + marker 属性线性查找（简单，但节点多时是 O(n)）；
- 正规路：`Page.getFrameTree` → `DOM.getFrameOwner` / `Runtime.evaluate` 带 `contextId`（复杂，但精确）。

Katalon 选了前者。marker 由 content script 在发消息前打在元素上（`request.krId`），SW 端不需要知道它长什么样。

### 5.10 CDP `attach` 会弹黄条，且和 DevTools 互斥

`chrome.debugger.attach`（`background/kar.js:241`）会：
- 在页面顶部显示「"XXX" 正在调试此浏览器」横幅（无法隐藏）；
- 若用户已打开 DevTools，`attach` 会失败（`Another debugger is already attached`），代码走 `doDetach(sendResponse, debuggeeId, chrome.runtime.lastError)`（`:242-243`），返回 `{status:false, err}`。

所以**回放期间不要让用户开 DevTools**——这条在 UI 上没有任何提示。

### 5.11 `attachedTabs` 的状态与真实 detach 可能不一致

`background/kar.js:63` 和 `:87` 在**发起操作前**就写 `attachedTabs[tabId] = true`，但 `doAttachDebugger`（`:240`）成功后并不写。也就是说：

- 首次 `uploadFile`：`attachedTabs[tabId]` 是 undefined → 走 attach → 在 `doUploadFile` 里才置 true；
- 每次操作结束都 `doDetach` → `onDetach` 删除该键。

逻辑上自洽，但 **`doDetach` 的回调里若 `chrome.debugger.detach` 本身失败，`onDetach` 仍会被调用并删键**（`:44`），下一次会重新 attach 到一个已 attach 的 tab 上，抛 `lastError` 后走失败分支。低概率，但是真实竞态。

### 5.12 SW 里的全局变量都是易失的

`externalCapabilities`（`background/kar.js:265`）、`attachedTabs`（`:25`）、`clientSocket`/`runMode`/`runData`（`katalon/background.js:9-11`）全是 SW 内存变量。SW 一旦被回收，这些状态**全部丢失且不会恢复**：
- 第三方扩展的注册消失（需要它重发）；
- Object Spy 的 `runMode` 回到 IDLE，但页面里 `katalon/main.js` 那边还以为在录制。

正确做法是落 `chrome.storage.session`。**本项目没有做**。

### 5.13 `bundles/content.1.bundle.js` 带 `/// File:` 分隔注释

这不是压缩产物，是**拼接产物**（38 381 行，可读源码）。每个原文件边界都有：

```
/// File: "content/command-receiver.js"
…
/// End of File: "content/command-receiver.js"
```

配合 `manifest.bak.json:56-199` 的原始 `content_scripts` 清单，可以 1:1 还原打包前的文件顺序。逆向时**先 `grep '^/// File: '` 建索引**。

### 5.14 CSP 那行 `unsafe-eval; unsafe-inline;` 是无效的

`manifest.json:42`。它们是指令值不是指令名，Chrome 会忽略。`manifest.bak.json:48-50` 里是干净的：

```json
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  },
```

说明这两个词是**发布流程中被某个脚本错误追加的**。别照抄。

---

## 6. 可复用到测试插件的能力清单 + 移植方案

| # | 能力 | 源码出处 | 复用价值 | 移植成本 | 建议 |
|---|---|---|---|---|---|
| R1 | MAIN world 任意 JS 执行 + 结果回传 | `page/runScript.js:19-53` + `content/runScript-injecter.js` | ★★★★★ | 低（60 行） | **直接抄**，补超时 |
| R2 | Trusted Types 兜底策略 | `content/trustedPolicy.js:1-9` | ★★★★★ | 极低（9 行） | **直接抄** |
| R3 | 命令接收器 + 同步/异步统一 + `SideeXPlayingFlag` | `content/command-receiver.js:49-136` | ★★★★★ | 中 | 抄骨架，命令表换成自己的 |
| R4 | CDP 文件上传（`DOM.setFileInputFiles`） | `background/kar.js:61-81, 197-238` | ★★★★☆ | 中 | 需要时再开 `debugger` 权限 |
| R5 | CDP 真实按键（`Input.dispatchKeyEvent`） | `background/kar.js:85-157` | ★★★☆☆ | 中 | 只有测「原生快捷键」才需要 |
| R6 | `pierce:true` + marker 属性跨 frame 定位 | `background/kar.js:197-217` | ★★★★☆ | 低 | **思路值钱**，20 行 |
| R7 | detach 纪律（成败都收尾 + 强读 lastError） | `background/kar.js:34-58` | ★★★★★ | 极低 | **直接抄** |
| R8 | 无头回放 + WebSocket 日志回传（CI） | `playback/index.js` + `play-actions-service.js` | ★★★★★ | 中 | 抄协议，**换原生 WebSocket** |
| R9 | 套件 HTML 正则解析 | `playback/service/parser-service.js:26-40` | ★★★☆☆ | 极低 | 若沿用 Selenium IDE 格式则抄 |
| R10 | 数据驱动（CSV/JSON） | `playback/service/data-service.js:14-28` | ★★★★☆ | 低 | 抄，CSV 可换轻量解析 |
| R11 | `navigator.webdriver` 作为远控安全销 | `content/check-browser-automation.js:1-5` | ★★★★★ | 极低（5 行） | **必抄**（见下方强化版） |
| R12 | sandbox iframe 受控 eval | `panel/sandbox.js:28-76` + `SandboxEvaluator.js` | ★★★★★ | 低 | **直接抄**，是唯一合规 eval 方案 |
| R13 | 广播 + 新页补课（`CHECK_ADDON_START_STATUS`） | `katalon/background.js:283-299` + `katalon/main.js` | ★★★★☆ | 低 | **思路值钱** |
| R14 | 能力注册 + 心跳淘汰 | `background/kar.js:265-322` | ★★☆☆☆ | 低 | 个人插件用不上，**删** |
| R15 | 端口可配置 + storage 缓存 | `katalon/chrome_common.js:3-25` | ★★★☆☆ | 极低 | 抄（把 3500/50000 变成配置项） |
| R16 | 预签名 URL 三段式上传 | `kar-upload.js:80-142` | ★★☆☆☆ | 中 | 除非自建报告服务，否则删 |
| R17 | 跨 world RPC（RemoteObjectHelper） | `common/chrome-polyfill*.js` | ★☆☆☆☆ | 高 | **删**（风险 > 收益，见 5.6） |
| R18 | socket.io v3 客户端 | `content-marketing/socket-io/socket-io.min.js` | ★☆☆☆☆ | — | **删**，78 KB 换不来什么 |

### 6.1 移植方案 A：把 CI 通道从 socket.io 换成原生 WebSocket

**动机**：省 78 KB；MV3 SW 原生支持 `WebSocket`（自 Chrome 116 起 WebSocket 活动还能给 SW 续命），不需要 socket.io 的 long-poll 降级。

**协议对齐**：socket.io 的 `emit(event, data)` 用原生 WS 表达为 `{ event, data }` JSON 帧即可。

```js
// runner-client.js —— 替换 playback/index.js:3
const RUNNER_URL = 'ws://127.0.0.1:3500';
let ws, isAutomated;

function emit(event, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, data }));
  }
}

function connect() {
  ws = new WebSocket(RUNNER_URL);
  ws.onmessage = (e) => {
    const { event, data } = JSON.parse(e.data);
    if (event === 'sendHtml') onSendHtml(data);
  };
  ws.onclose = () => setTimeout(connect, 2000);   // 有退避，别学 300ms
  ws.onerror = () => { /* 交给 onclose */ };
}
```

**关键：把 `isAutomated` 从「轮询等待」改成「Promise 等待」**，消除 `playback/index.js:18-31` 那个可能永不结束的 `setInterval`：

```js
const automatedReady = new Promise((resolve) => {
  const t = setTimeout(() => resolve(false), 5000);   // 5s 兜底
  chrome.runtime.onMessage.addListener(function h(m) {
    if (m.command !== 'checkForAutomated') return;
    clearTimeout(t);
    chrome.runtime.onMessage.removeListener(h);
    resolve(!!m.isAutomated);
  });
});

async function onSendHtml(data) {
  if (!(await automatedReady)) { emit('logger', { mess: 'not automated, refused', type: 'error' }); return; }
  await executeTestSuite(data.data, data.datafiles);
}
```

### 6.2 移植方案 B：强化远控安全销

原版只看 `navigator.webdriver`。个人插件建议叠三道：

```js
// 1) 只在 WebDriver 会话里启用
// 2) 只连 127.0.0.1（不是 localhost，避免 DNS rebinding 到外网）
// 3) 一次性 token：runner 启动时把 token 写进环境/命令行，
//    通过 WebDriver 打开的首个页面 URL query 传进来
const url = new URL(location.href);
const token = url.searchParams.get('krToken');
ws.onopen = () => emit('hello', { token, ua: navigator.userAgent });
// runner 端校验 token 不匹配立刻断开
```

理由：`ws://localhost:3500` 是**任何本机进程都能监听的端口**。没有 token，用户机器上任意程序（甚至某些恶意网页配合 DNS rebinding）都能反过来指挥浏览器。

### 6.3 移植方案 C：`runScript` 加超时与真返回值

```js
// page/run-script.js（MAIN world 侧，改写自 page/runScript.js）
function krRun(id, fn) {
  Promise.resolve()
    .then(fn)                                   // 支持 async 用户脚本
    .then(r => post(id, { status: true,  result: r }))
    .catch(e => post(id, { status: false, result: 'Error: ' + e }));
}
function post(id, payload) {
  window.postMessage({ direction: 'from-page-runscript', id, ...payload }, '*');
}
window.addEventListener('message', (ev) => {
  if (ev.source !== window || ev.data?.direction !== 'from-content-runscript') return;
  const s = document.createElement('script');
  s.textContent = `krRun(${JSON.stringify(ev.data.id)}, async function(){ ${ev.data.script}\n });`;
  (document.body || document.documentElement).appendChild(s);
  s.remove();                                   // 用完就摘，别留痕
});
```

三处改进（对比 `page/runScript.js:44-53`）：
1. 带 **`id`**：多条 `runScript` 并发时不会串结果（原版用一个全局 `runScriptResponse` 布尔，并发必错）；
2. `async function` 包裹 + `Promise.resolve().then` → 支持 `await`；
3. `s.remove()` → 不在 DOM 里留下 `<script>` 残骸（原版 `doc.body.appendChild(scriptTag)` 永远不删，跑 100 条命令就有 100 个空 script 标签，会影响 `xpath:position` 类定位器！）。

content 侧配套改成 `Map<id, {resolve, timer}>`：

```js
const pending = new Map();
window.addEventListener('message', (ev) => {
  if (ev.data?.direction !== 'from-page-runscript') return;
  if (ev.source.top !== window) return;                 // 保留原版来源校验
  const p = pending.get(ev.data.id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(ev.data.id);
  ev.data.status ? p.resolve(ev.data.result) : p.reject(ev.data.result);
});

export function runScript(script, timeout = 30000) {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(id, {
      resolve, reject,
      timer: setTimeout(() => { pending.delete(id); reject('runScript timeout'); }, timeout)
    });
    window.postMessage({ direction: 'from-content-runscript', id, script }, '*');
  });
}
```

### 6.4 移植方案 D：CDP 上传的最小封装

如果你确实需要 `type` 到 `<input type=file>`：

```js
// sw/cdp-upload.js
const attached = new Set();

async function withDebugger(tabId, fn) {
  const target = { tabId };
  if (!attached.has(tabId)) {
    await chrome.debugger.attach(target, '1.2');
    await chrome.debugger.sendCommand(target, 'DOM.enable');
    attached.add(tabId);
  }
  try { return await fn(target); }
  finally {
    try { await chrome.debugger.sendCommand(target, 'DOM.disable'); } catch {}
    try { await chrome.debugger.detach(target); } catch {}
    attached.delete(tabId);
  }
}

async function findNodeId(target, { frameId, marker, selector }) {
  if (frameId) {
    const { nodes } = await chrome.debugger.sendCommand(
      target, 'DOM.getFlattenedDocument', { depth: -1, pierce: true });
    const n = nodes.find(n => n.attributes?.includes(marker));
    if (!n) throw new Error('node not found by marker');
    return n.nodeId;
  }
  const { root } = await chrome.debugger.sendCommand(target, 'DOM.getDocument', {});
  const { nodeId } = await chrome.debugger.sendCommand(
    target, 'DOM.querySelector', { nodeId: root.nodeId, selector });
  if (!nodeId) throw new Error('node not found by selector');
  return nodeId;
}

export async function setFiles(tabId, loc, files) {
  return withDebugger(tabId, async (target) => {
    const nodeId = await findNodeId(target, loc);
    await chrome.debugger.sendCommand(target, 'DOM.setFileInputFiles', { nodeId, files });
    return true;
  });
}
```

比原版好在：`chrome.debugger.*` 的 Promise 形态（Chrome 已支持）省掉五层回调；`finally` 保证 detach；`attached` 用 `Set` 而不是对象。

`chrome.debugger.onDetach` 仍要挂（对应 `background/kar.js:261-263`）：

```js
chrome.debugger.onDetach.addListener(({ tabId }) => attached.delete(tabId));
```

### 6.5 裁剪决策速查

| manifest 项 | 原值 | 个人插件建议 |
|---|---|---|
| `permissions.debugger` | 有 | **只有需要文件上传/原生按键才留**。留 → 用户每次回放看到黄条 |
| `permissions.offscreen` | 有 | 删（本模块不用） |
| `permissions.cookies` / `notifications` / `webNavigation` | 有 | 按实际需求，本模块都不用 |
| `externally_connectable` | `ids:["*"]` | **删整块** |
| `web_accessible_resources` | 3 项 | 留 `page/runScript.js`；`katalon/authenticated.html` 删 |
| `content_scripts[].world` | `MAIN` | **优先改回 ISOLATED**；确需 MAIN 的只放最小集合 |
| `content_security_policy` | 含无效关键字 | 改回 `script-src 'self'; object-src 'self'` |
| `sandbox.pages` | `panel/sandbox.html` | **留** |
| 顶层 `default_popup` | 指向不存在目录 | **删这一行**（不要挪进 `action`） |
| `oauth2` / `key` / `update_url` | — | 删（自建插件用自己的） |

---

## 7. 最小可用实现（MVP 代码骨架）

目标：一个能被 CI 远程驱动的最小自动化测试插件，**不申请 `debugger`**，只保留 R1/R2/R3/R8/R11/R12/R15。

### 7.1 manifest.json

```json
{
  "manifest_version": 3,
  "name": "MyTestRecorder",
  "version": "0.1.0",
  "background": { "service_worker": "sw.js", "type": "module" },
  "action": { "default_title": "MyTestRecorder" },
  "permissions": ["tabs", "activeTab", "storage", "scripting"],
  "host_permissions": ["<all_urls>"],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  },
  "sandbox": { "pages": ["panel/sandbox.html"] },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/trusted-policy.js", "content/run-script-bridge.js", "content/command-receiver.js"],
      "all_frames": true,
      "match_about_blank": true,
      "run_at": "document_start"
    },
    {
      "matches": ["<all_urls>"],
      "js": ["content/check-automation.js"],
      "all_frames": false,
      "run_at": "document_start",
      "world": "MAIN"
    }
  ],
  "web_accessible_resources": [
    { "matches": ["<all_urls>"], "resources": ["page/run-script.js"] }
  ]
}
```

> 注意：content 脚本全部留在 **ISOLATED world**（默认），只有 `check-automation.js` 需要读页面的 `navigator.webdriver`，放 MAIN world。这样就**完全不需要 chrome-polyfill / RemoteObjectHelper**。

### 7.2 `content/trusted-policy.js`（照抄 `content/trustedPolicy.js`）

```js
var trustedPolicy = {
  createScriptURL: (url) => url,
  createHTML: (s) => s,
  createScript: (s) => s,
};
if (window.trustedTypes && window.trustedTypes.createPolicy) {
  try {
    trustedPolicy = window.trustedTypes.createPolicy('mytest-default', trustedPolicy);
  } catch (e) { /* 已存在同名策略，忽略 */ }
}
```

> 原版用固定名 `'default2'`（`content/trustedPolicy.js:8`）且没有 try/catch。同一页面被注入两次（例如 `all_frames` + 动态注入）会抛 `Policy with name "default2" already exists`。

### 7.3 `page/run-script.js` + `content/run-script-bridge.js`

见 6.3 的完整代码。要点：带 `id`、支持 async、`<script>` 用完即删、双向超时。

### 7.4 `content/check-automation.js`

```js
// MAIN world，读页面真实 navigator
window.postMessage({ __mytest: 'automated', value: !!navigator.webdriver }, '*');
```

配套在 ISOLATED world 的 bridge 里转给 SW：

```js
window.addEventListener('message', (ev) => {
  if (ev.source !== window || ev.data?.__mytest !== 'automated') return;
  chrome.runtime.sendMessage({ command: 'checkForAutomated', isAutomated: ev.data.value });
});
```

> 为什么不像原版那样直接在 MAIN world 里 `browser.runtime.sendMessage`？因为那需要 chrome-polyfill RPC（5.6 的风险源）。用一次 postMessage 中转，成本 5 行，收益是砍掉整套 RPC。

### 7.5 `content/command-receiver.js`（骨架）

```js
const COMMANDS = {
  async open(target)          { location.href = target; },
  async click(target)         { (await $(target)).click(); },
  async type(target, value)   { const el = await $(target); el.focus(); el.value = value;
                                el.dispatchEvent(new Event('input',  { bubbles: true }));
                                el.dispatchEvent(new Event('change', { bubbles: true })); },
  async assertText(target, v) { const el = await $(target);
                                if (el.innerText.trim() !== v) throw new Error(`expect "${v}", got "${el.innerText.trim()}"`); },
  async runScript(script, varName) { const r = await runScript(script); return { store: varName, value: r }; },
};

const DEFAULT_TIMEOUT = 10000;

async function $(locator, timeout = DEFAULT_TIMEOUT) {
  const deadline = Date.now() + timeout;                 // ← 补上原版缺的超时（坑 5.8）
  for (;;) {
    const el = resolveLocator(locator);
    if (el) return el;
    if (Date.now() > deadline) throw new Error(`element not found: ${locator}`);
    await new Promise(r => setTimeout(r, 50));
  }
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type !== 'exec') return;
  document.body?.setAttribute('MyTestPlayingFlag', 'true');    // ← 抄 command-receiver.js:81
  const fn = COMMANDS[req.command];
  (fn ? fn(req.target, req.value)
      : Promise.reject(new Error('Unknown command: ' + req.command)))
    .then(extra => sendResponse({ result: 'success', ...extra }))
    .catch(err   => sendResponse({ result: String(err && err.message || err) }))
    .finally(()  => document.body?.removeAttribute('MyTestPlayingFlag'));
  return true;                                                  // ← 异步 sendResponse 必须
});
```

### 7.6 `sw.js`：CI 通道 + 回放编排

```js
import { runSuite } from './runner/execute.js';

const RUNNER_URL = 'ws://127.0.0.1:3500';
let ws = null, backoff = 1000, automated = false;

chrome.runtime.onMessage.addListener((m) => {
  if (m.command === 'checkForAutomated') automated = !!m.isAutomated;
});

function emit(event, data) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event, data }));
}

function connect() {
  ws = new WebSocket(RUNNER_URL);
  ws.onopen = () => { backoff = 1000; emit('hello', { ua: navigator.userAgent }); };
  ws.onmessage = async (e) => {
    const { event, data } = JSON.parse(e.data);
    if (event !== 'sendHtml') return;
    if (!automated) { emit('logger', { mess: 'refused: not a webdriver session', type: 'error' }); return; }
    const suite = parseSuite(data.data);
    emit('infoTestSuite', { testSuite: suite.name, testCases: suite.cases.map(c => c.name) });
    for (const c of suite.cases) {
      try {
        await runSuite(c, data.datafiles, (mess, type) => emit('logger', { mess, type }));
        emit('result', { testcase: c.name, result: 'passed' });
      } catch (err) {
        emit('logger', { mess: String(err), type: 'error' });
        emit('result', { testcase: c.name, result: 'failed' });
      }
    }
    emit('doneSuite', { mess: 'finished', type: 'info' });
  };
  ws.onclose = () => {
    ws = null;
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 30000);              // ← 指数退避，别学 300ms 死循环
  };
}

// 只在需要时连；不要在 SW 顶层无条件连（坑 5.3）
chrome.storage.local.get('ciEnabled').then(({ ciEnabled }) => { if (ciEnabled) connect(); });
```

### 7.7 `runner/parse-suite.js`（照抄 `parser-service.js` 思路，改用 DOMParser）

```js
export function parseSuite(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const name = doc.querySelector('title')?.textContent?.trim() ?? 'Untitled';
  const cases = [...doc.querySelectorAll('table')].map(tbl => {
    const rows = [...tbl.querySelectorAll('tr')];
    const caseName = rows[0]?.querySelector('td,th')?.textContent?.trim() ?? 'case';
    const steps = rows.slice(1).map(tr => {
      const [c, t, v] = [...tr.querySelectorAll('td')].map(td => td.textContent);
      return { command: (c || '').trim(), target: t ?? '', value: v ?? '' };
    }).filter(s => s.command);
    return { name: caseName, steps };
  });
  return { name, cases };
}
```

> 用 `DOMParser` 而不是 `parser-service.js:28` 的 `/<table[\s\S]*?<\/table>/gi` 正则：正则遇到嵌套 `<table>`（比如某个 `value` 里含 HTML）会切错。**但注意 MV3 SW 里没有 `DOMParser`**，所以这段要跑在 offscreen document 或 Panel 页里；若坚持在 SW 里做，就只能沿用原版正则。这是一个真实取舍。

### 7.8 sandbox（照抄，用于表达式求值）

`panel/sandbox.html`、`panel/sandbox.js`、`SandboxEvaluator.js` 三个文件几乎可以逐字复制 `panel/sandbox.js:1-76` 与 `panel/js/UI/services/helper-service/SandboxEvaluator.js:1-51`，唯一建议改动是**给 `eval` 也加个 id 和超时**（原版是单槽 `outputPromise`，并发调用会串结果，与 5.7 同源缺陷）。

### 7.9 完成度自检清单

- [ ] `chrome://extensions` 里权限只有 `tabs / activeTab / storage / scripting`，**没有 debugger**
- [ ] 打开任意页面，控制台无 `Unchecked runtime.lastError`
- [ ] 页面开启 Trusted Types（如 `https://www.google.com`）时 `runScript` 仍能工作
- [ ] `runScript('return document.title')` 返回真实标题；`runScript('await new Promise(r=>setTimeout(r,3000)); return 1')` 返回 1 而不是静默成功
- [ ] 未通过 WebDriver 启动时，向 `ws://127.0.0.1:3500` 发 `sendHtml` 被拒绝并回 `logger{type:'error'}`
- [ ] 断开 runner 后重连间隔按 1s→2s→4s…→30s 退避
- [ ] SW 被手动 terminate 后，重新激活不会重复建立多个 WebSocket

---

## 附录 A：本模块全部消息名索引

| 消息 / 事件 | 通道 | 发出 | 接收 |
|---|---|---|---|
| `sendHtml` | socket.io | Runner | `playback/index.js:17` |
| `infoTestSuite` | socket.io | `playback/index.js:56` | Runner |
| `logger` | socket.io | `play-actions-service.js`（30 处） | Runner |
| `result` | socket.io | `play-actions-service.js:186, 290` | Runner |
| `doneSuite` | socket.io | `play-actions-service.js:111` | Runner |
| `REQUEST_BROWSER_INFO` | WS | Katalon Studio | `katalon/background.js:250` |
| `BROWSER_INFO` | WS | `katalon/background.js:262` | Katalon Studio |
| `SELENIUM_SOCKET=true` | WS（裸文本） | `katalon/background.js:263` | Katalon Studio |
| `START_INSPECT` / `START_RECORD` | WS | Katalon Studio | `katalon/background.js:265, 269` |
| `HIGHLIGHT_OBJECT` | WS | Katalon Studio | `katalon/background.js:273` |
| `element=<urlencoded>` | WS（裸文本） | `katalon/background.js:58, 65` | Katalon Studio |
| `START_ADDON` / `STOP_ADDON` | runtime | `katalon/background.js:289, 320` | `katalon/main.js` |
| `CHECK_ADDON_START_STATUS` | runtime | `katalon/main.js` | `katalon/background.js:194` |
| `katalon_recorder_register` | external | 第三方扩展 | `background/kar.js:268` |
| `katalon_recorder_export` | external | `kar-generateScript.js:204` | 第三方扩展 |
| `getExternalCapabilities` | runtime | `kar-generateScript.js:365` | `background/kar.js:311` |
| `checkChromeDebugger` | runtime | `content/kar.js:3` | `background/kar.js:325` |
| `uploadFile` | runtime | content（selenium） | `background/kar.js:174` |
| `sendSpecialKeys` | runtime | content（selenium） | `background/kar.js:183` |
| `captureEntirePageScreenshot` | runtime | `command-receiver.js:68` | `background/kar.js:160` |
| `checkForAutomated` | runtime | `check-browser-automation.js:2` | `playback/index.js:10`、`panel/js/background/recorder.js:253, 266` |
| `from-content-runscript` | postMessage | `selenium-api.js:3161` | `page/runScript.js:44` |
| `from-page-runscript` | postMessage | `page/runScript.js:20` | `content/runScript-injecter.js:26` |
| `from-page-script` | postMessage | `page/prompt.js` | `content/prompt-injecter.js:27` |
| `{type:'connect', key:'pandoraboz'}` | postMessage | `common/chrome-polyfill.js`（PageTransport） | `common/chrome-polyfill-server.js:9` |
| `eval-result` / `eval-error` | postMessage | `panel/sandbox.js:60, 70` | `SandboxEvaluator.js:30, 34` |

---

## 附录 B：`bundles/content.1.bundle.js` 文件索引（`/// File:` 分隔）

供逆向定位用，行号为分隔注释所在行：

```
  143 content/trustedPolicy.js          30022 content/locatorBuilders.js
  158 common/chrome-polyfill.js         30606 content/recorder.js
  179 common/browser-polyfill-page.js   30756 content/recorder-handlers.js
  193 content/prompt-injecter.js        31372 content/command-receiver.js
  273 content/runScript-injecter.js     31606 content/targetSelecter.js
  310 content/check-browser-automation  31703 content/sizzle.js
  321 content/bowser.js                 33980 content/kar.js
  954 content/atoms.js                  34676 katalon/constants.js
12797 content/utils.js                  34748 katalon/chrome_common.js
22471 content/selenium-commandhandlers  34810 katalon/ku-locatorBuilders.js
22872 content/selenium-browserbot.js    35399 katalon/context_menu.js
25810 common/escape.js                  35808 katalon/chrome_setup.js
26056 content/selenium-api.js           37810 katalon/main.js
30016 content/neighbor-xpaths-gen.min   38266 content/inject-popup-record.js
```

（共 44 段，此处列出与本模块相关的部分；完整清单可用 `grep -n '^/// File: ' bundles/content.1.bundle.js` 获取。）
