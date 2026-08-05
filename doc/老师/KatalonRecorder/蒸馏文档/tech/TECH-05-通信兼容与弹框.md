# TECH-05 · 跨进程通信总线 / 浏览器兼容层 / 弹框机制

> 本文覆盖三块"看不见但决定成败"的基础设施：
> **A. 五个上下文之间怎么通信** · **B. 浏览器版本兼容怎么做** · **C. 点击图标为什么会弹出一个独立窗口**
> 全部结论带 `文件路径:行号` 与源码片段。

---

# A. 跨进程通信总线

## A.0 一句话结论

**KR 的"后台大脑"不在 Service Worker，而在 Panel 弹出窗口里。Content → Panel 走 `runtime.sendMessage` 广播（Panel 用 `sender.tab.id` 分流），Panel → Content 走 `tabs.sendMessage(tabId, msg, {frameId})` 定向。MAIN world 里没有 `chrome.*`，靠自研 `RemoteObjectHelper` 用 `window.postMessage` + 密钥 `pandoraboz` 做 RPC 代理补齐。**

---

## A.1 拓扑与证据

### Service Worker 只装了 22 个文件

`worker_wrapper.js:1-26`
```js
try {
    importScripts(
        "common/promise-utils.js",
        "background/segment-tracking-services.js",
        "content/bowser.js",
        "common/browser-polyfill.js",
        ...
        "common/offscreen-server.js",
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
} catch (e) { console.log(e); }
```

**注意：没有 `recorder.js`、没有 `window-controller.js`、没有 `playback/`。**

### 这些"后台"模块被 Panel 页面加载

`panel/index.html:1001-1016`
```html
<script type="module" src="js/background/load-setting-data.js"></script>
<script type="module" src="js/background/window-controller.js"></script>
<script type="module" src="js/background/recorder.js"></script>
<script src="js/background/initial.js"></script>
<script src="../common/escape.js"></script>
<script src="js/background/formatCommand.js"></script>
<script src="js/background/website-login.js"></script>
...
<script type="module" src="js/background/playback/index.js"></script>
```

> **"Panel 怎么绕过 `getBackgroundPage()`"的答案是：不需要绕。整套 MV2 background page 的逻辑被物理搬进了 Panel 窗口，Panel 本身就是那个背景页。**

---

## A.2 开窗握手：SW → Panel 唯一一次定向消息

`background/background.js:92-98`
```js
.then(function bridge(panelWindowInfo) {
    popupWindowIDs.push(panelWindowInfo.id);
    return browser.tabs.sendMessage(panelWindowInfo.tabs[0].id, {
      selfWindowId: panelWindowInfo.id,
      commWindowId: contentWindowId,
    });
})
```

Panel 端收到后**立即摘除监听器**（一次性握手）：

`panel/js/background/editor.js:79-88`
```js
browser.runtime.onMessage.addListener(function contentWindowIdListener(message) {
    if (message.selfWindowId != undefined && message.commWindowId != undefined) {
        selfWindowId = message.selfWindowId;
        contentWindowId = message.commWindowId;
        extCommand.setContentWindowId(contentWindowId);
        recorder.setOpenedWindow(contentWindowId);
        recorder.setSelfWindowId(selfWindowId);
        browser.runtime.onMessage.removeListener(contentWindowIdListener);
    }
})
```

| 字段 | 含义 | 用途 |
|---|---|---|
| `selfWindowId` | Panel 自己的窗口 id | `storeXxx` 命令弹 `prompt` 时把焦点抢回来 |
| `commWindowId` | 被录制/回放的目标浏览器窗口 id | 所有录制与回放操作的作用域 |

---

## A.3 上行通道：Content → Panel（录制）

**发送端**（MAIN world）：`content/recorder.js:102-118`
```js
record(command, target, value, insertBeforeLastCommand, actualFrameLocation) {
    let self = this;
    if (!target[0].some(e => e?.includes instanceof Function && e.includes('popupInjectionKR'))) {
        browser.runtime.sendMessage({
            command: command,
            target: target,
            value: value,
            insertBeforeLastCommand: insertBeforeLastCommand,
            frameLocation: (actualFrameLocation != undefined) ? actualFrameLocation : this.frameLocation,
        }).catch(function (reason) { /* ... */ });
    }
}
```

**接收端**（Panel）：`panel/js/background/recorder.js:362-372`
```js
attach() {
    if (this.attached) return;
    this.attached = true;
    browser.tabs.onActivated.addListener(this.tabsOnActivatedHandler);
    browser.windows.onFocusChanged.addListener(this.windowsOnFocusChangedHandler);
    browser.tabs.onRemoved.addListener(this.tabsOnRemovedHandler);
    browser.webNavigation.onCreatedNavigationTarget.addListener(this.webNavigationOnCreatedNavigationTargetHandler);
    browser.runtime.onMessage.addListener(this.addCommandMessageHandler);
}
```

### 窗口别名表的建立（`win_ser_local` 从哪来）

`panel/js/background/recorder.js:212-224`
```js
if (Object.keys(this.openedTabIds[testCaseId]).length === 0) {
    this.currentRecordingTabId[testCaseId] = sender.tab.id;
    this.openedTabNames[testCaseId]["win_ser_local"] = sender.tab.id;
    this.openedTabIds[testCaseId][sender.tab.id] = "win_ser_local";
}
if (getRecordsArray().length === 0) {
    addCommandAuto("open", [[sender.tab.url]], "");
    this.openedTabIds[testCaseId]['tabUrl'] = sender.tab.url;
}
```

**这就是你脚本里那条 `selectWindow | win_ser_local` 的来源** —— 第一个被录制的标签页固定叫 `win_ser_local`，后开的叫 `win_ser_1`、`win_ser_2`…

### frameLocation 差分算法（自动补 selectFrame）

`panel/js/background/recorder.js:271-293`
```js
if (message.frameLocation && message.frameLocation !== this.currentRecordingFrameLocation[testCaseId]) {
    let newFrameLevels = message.frameLocation.split(':');
    let oldFrameLevels = this.currentRecordingFrameLocation[testCaseId].split(':');
    while (oldFrameLevels.length > newFrameLevels.length) {
        addCommandAuto("selectFrame", [["relative=parent"]], "");
        oldFrameLevels.pop();
    }
    ...
    while (oldFrameLevels.length < newFrameLevels.length) {
        addCommandAuto("selectFrame", [["index=" + newFrameLevels[oldFrameLevels.length]]], "");
        oldFrameLevels.push(newFrameLevels[oldFrameLevels.length]);
    }
}
```

**推演示例**：

| 上一条命令所在 frame | 本条命令所在 frame | 自动插入的命令 |
|---|---|---|
| `root` | `root:0` | `selectFrame index=0` |
| `root:0:1` | `root:0` | `selectFrame relative=parent` |
| `root:0:1` | `root:2` | `selectFrame relative=parent` ×2 → `selectFrame index=2` |

frameLocation 由 content 在构造时主动上报一次：`content/recorder.js:26-31`
```js
this.frameLocation = this.getFrameLocation();
browser.runtime.sendMessage({
    frameLocation: this.frameLocation
}).catch(function (reason) { /* Failed silently */ });
```

Panel 侧 `ExtCommand` 记录之：`panel/js/background/window-controller.js:45-49`
```js
this.frameLocationMessageHandler = (message, sender) => {
    if (message.frameLocation) {
        this.setFrame(sender.tab.id, message.frameLocation, sender.frameId);
    }
}
```

---

## A.4 下行通道：Panel → Content（回放）

`panel/js/background/window-controller.js:142-156`
```js
async sendCommand(command, target, value, top) {
    let tabId = this.getCurrentPlayingTabId();
    let frameId = this.getCurrentPlayingFrameId();
    return retryUntilSuccess(async () => {
        const tab = await browser.tabs.get(tabId);
        if (!tab || tab.status !== 'complete') {
            throw new Error('The target tab is not ready');
        }
        return browser.tabs.sendMessage(tabId, {
            commands: command,
            target: target,
            value: value
        }, { frameId: top ? 0 : frameId });
    }, 60, 500).then(res => { return res; });
}
```

**`retryUntilSuccess(fn, 60, 500)` = 最多重试 60 次、每次间隔 500ms = 30 秒上限。** 这是解决 MV3 下 `"Could not establish connection. Receiving end does not exist."` 的实用组合——页面还在加载时 content script 尚未注入，直接发消息必失败。

Content 侧总入口：`content/command-receiver.js:49-77`
```js
function doCommands(request, sender, sendResponse, type) {
    if (request.commands) {
        if (request.commands == "waitPreparation") {
            selenium["doWaitPreparation"]("", selenium.preprocessParameter(""));
            sendResponse({});
        } else if (request.commands == "prePageWait") { ... }
        ...
        } else if (request.commands === 'captureEntirePageScreenshot' || ...) {
            browser.runtime.sendMessage({ captureEntirePageScreenshot: true })
              .then(function(captureResponse) { ... });
        } else {
            var upperCase = request.commands.charAt(0).toUpperCase() + request.commands.slice(1);
            if (selenium["do" + upperCase] != null) { ... }
```

> 注意 `captureEntirePageScreenshot` 是 **Content → Service Worker**（不经 Panel），因为 `tabs.captureVisibleTab` 需要扩展进程权限：
>
> `background/kar.js:159-169`
> ```js
> browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
>     if (request.captureEntirePageScreenshot) {
>         var windowId = request.captureWindowId || sender.tab.windowId;
>         retryUntilSuccess(
>             () => browser.tabs.captureVisibleTab(windowId, { format: 'png' })
>         ).then((image) => { sendResponse({ image: image }); });
>         return true;
>     }
> ```

---

## A.5 MAIN ↔ ISOLATED 的 chrome.* RPC 代理

MAIN world 里没有 `chrome.runtime` / `chrome.storage`。KR 用一对 client/server 桥补齐。

**Server 端**（ISOLATED world，`manifest.json:16` 第三个脚本）：
`common/chrome-polyfill-server.js:1-9`（全文）
```js
document.documentElement.setAttribute('katalonExtensionId', chrome.runtime.id);

const transportServer = new PageTransportServer();

transportServer.addConnectionListener((connection) => {
    RemoteObjectHelper.attachToServer(chrome, connection, 'chrome');
});

transportServer.listen();
```

**Client 端**（MAIN world）：
`common/chrome-polyfill.js:1-15`（全文）
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

**传输层**（`common/remote-object-helper-content.js` / `-page.js`，两份 md5 完全相同 `282bf197618d582fe0198a40d352d4b0`，97155 字节的打包产物）关键片段：

```js
const Wr = globalThis.postMessage.bind(globalThis), ...
class _a extends Nr {
  constructor(s = "pandoraboz") { super(); this.secretKey = s }
  id = Ue();
  async pureConnect() { Wr({ source: this.id, type: "connect", key: this.secretKey }, "*") }
  verifyRawMessage(s) {
    return s.data?.source !== this.id && s.data?.type === "message" && s.data?.key === this.secretKey
  }
  serializeMessage(s) { return { source: this.id, type: "message", key: this.secretKey, message: s } }
}
```

**RPC 帧格式**：
| 阶段 | 帧结构 |
|---|---|
| 握手 | `{ source, type: "connect", key: "pandoraboz" }` |
| 数据 | `{ source, type: "message", key, message: { id, type: REQUEST\|RESPONSE, data } }` |
| 防自回环 | `verifyRawMessage` 里 `s.data?.source !== this.id` |

> ⚠️ **安全评价**：`postMessage(..., "*")` + 固定明文密钥。任何同页第三方脚本都可以伪造消息，拿到 `chrome.storage` 的完整读写代理。**复刻时必须换成随机 nonce + `targetOrigin` 校验。**

---

## A.6 chrome.debugger（CDP）只干两件事

`background/kar.js` 中 CDP 仅服务于 **文件上传** 与 **特殊按键** —— 这两件事 `document.execCommand` / 合成 DOM 事件都做不到（浏览器安全限制）。

`background/kar.js:174-192`
```js
if (request.uploadFile) {
    if (attachedTabs[tabId]) { doUploadFile(request, sendResponse, debuggeeId, frameId); }
    else { doAttachDebugger(sendResponse, debuggeeId, function() { doUploadFile(...); }); }
    return true;
} else if (request.sendSpecialKeys) {
    ...
}
```

### 上传：`DOM.setFileInputFiles`
`background/kar.js:61-80`
```js
function doUploadFile(request, sendResponse, debuggeeId, frameId) {
    var tabId = debuggeeId.tabId;
    attachedTabs[tabId] = true;
    doActionOnNode(frameId, debuggeeId, sendResponse, request, function(nodeId) {
        chrome.debugger.sendCommand(debuggeeId, "DOM.setFileInputFiles",
          { nodeId: nodeId, files: request.file.split(",") },
          function (res) { ... });
    });
};
```

### 按键：`DOM.focus` + `Input.dispatchKeyEvent`（rawKeyDown → keyUp 成对）
`background/kar.js:111-146`
```js
chrome.debugger.sendCommand(debuggeeId, "Input.dispatchKeyEvent", {
    type: 'rawKeyDown',
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode : keyCode,
    macCharCode: keyCode,
    key: keyboardEventKey,
    code: keyboardEventCode,
    modifiers: modifiers
}, function (res) { ... "keyUp" ... });
```

### 节点定位的两条路径
`background/kar.js:197-238`
```js
if (frameId) {
    // iframe：拿扁平化全文档，用 krId 属性匹配
    chrome.debugger.sendCommand(debuggeeId, "DOM.getFlattenedDocument", { depth: -1, pierce: true }, function (res) {
        var krId = request.krId;
        var node = res.nodes.find(function (n) { return n.attributes && n.attributes.indexOf(krId) >= 0; });
        ...
    });
} else {
    // 主框架：直接 querySelector
    chrome.debugger.sendCommand(debuggeeId, "DOM.getDocument", {}, function (res) {
        chrome.debugger.sendCommand(debuggeeId, "DOM.querySelector", { nodeId: node.nodeId, selector: request.locator }, ...);
    });
}
```

用完必 detach（`DOM.disable` → `chrome.debugger.detach`）：`background/kar.js:34-58`。
能力探测：`background/kar.js:324-330`，Content 侧缓存结果：`content/kar.js:1-6`。

> 💡 **复刻建议**：`debugger` 权限会让浏览器顶部常驻"正在被调试"横幅，用户体验很差。除非你确实需要文件上传，否则**不要申请这个权限**。

---

## A.7 Offscreen Document：SW 没有 DOM 的补丁

`common/offscreen-server.js:44-52`
```js
async function createOffscreenDocument() {
  if (!(await hasOffscreenDocument())) {
    await chrome.offscreen.createDocument({
      url: "panel/offscreen.html",
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
      justification: "Scrape the DOM to get information.",
    });
  }
}
```

请求-响应用 `pendingPromises[type]` 手写配对，**用完即关**：
`common/offscreen-server.js:21-42`
```js
async function sendMessageToOffscreenDocument(type) {
  await createOffscreenDocument();
  const messagePromise = new Promise((resolve) => { pendingPromises[type] = resolve; });
  chrome.runtime.sendMessage({ type, target: "offscreen" });
  const data = await messagePromise;
  await closeOffscreenDocument();
  return data;
}
```

Offscreen 页只做两件事（`common/offscreen.js:1-29` 全文）：
```js
switch (message.type) {
    case "get-browser-name":
      const browserName = getBrowserName();
      returnMessage(message.type, browserName); break;
    case "get-fingerprint-visitor":
      const visitor = await (await FingerprintJS.load({ region: "ap" })).get();
      returnMessage(message.type, visitor); break;
}
```

**结论：offscreen 完全是为埋点服务的**（浏览器名 + FingerprintJS 指纹），与录制/回放无关。→ 🟥 可整块删，连带去掉 `offscreen` 权限。

---

## A.8 Sandbox 页：MV3 下合规执行 eval

`panel/sandbox.js:28-54`
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
      } catch (error) { this.output.reject(error); }
      this.output = newPromise();
    } while (true);
  }
  async eval(script) { this.input.resolve(script); return this.output.promise; }
}
```

> 💡 这个"**单 promise 队列**"模式（`input`/`output` 两个 deferred 交替，`do...while(true)` 死循环消费）非常简洁，**值得直接复用**。

Panel 端封装（隐藏 iframe）：`panel/js/UI/services/helper-service/SandboxEvaluator.js:23-50`
```js
init() {
    this.sandbox = document.createElement("iframe");
    this.sandbox.src = this.sandboxPath;      // "sandbox.html"
    this.sandbox.style.display = "none";
    document.body.appendChild(this.sandbox);
    window.addEventListener("message", (event) => {
      if (event.data?.type === "eval-result") { this.outputPromise.resolve(event.data.result); ... }
      if (event.data?.type === "eval-error")  { this.outputPromise.reject(event.data.error); ... }
    });
}
async eval(script) {
    this.sandbox.contentWindow.postMessage(script, "*");
    return this.outputPromise.promise;
}
```

这是 `storeEval` / `runScript` 这类"执行用户表达式"命令的合规落点。

⚠️ 但 `manifest.json:42` 的 CSP 里仍写了 `unsafe-eval; unsafe-inline;`（且写在 `object-src` 之后，是**关键字不是指令名**，Chrome 会忽略整条），说明 sandbox 化改造并未彻底。

---

## A.9 外部扩展通道

`manifest.json:46-50`
```json
"externally_connectable": {
   "accepts_tls_channel_id": false,
   "ids": [ "*" ],
   "matches": [ "https://developer.mozilla.org/*", "https://katalon.com/*" ]
},
```

第三方扩展注册"导出能力"：`background/kar.js:267-308`
```js
browser.runtime.onMessageExternal.addListener(function(message, sender) {
    if (message.type === 'katalon_recorder_register') {
        var payload = message.payload;
        // payload: { capabilities: [ { id:'super-power', summary:'Generate super power', type:'export' } ] }
        var capabilities = payload.capabilities;
        ...
        externalCapabilities[capabilityGlobalId] = {
            extensionId, capabilityId, summary: capability.summary, type: capability.type, lastPing: now
        };
    }
});
```
2 分钟未 ping 即淘汰（`background/kar.js:310-322`）。

⚠️ `ids: ["*"]` 意味着**任意扩展都能连**。🟥 不做插件生态就整块删。

---

## A.10 长连接 Port（右键菜单唯一用途）

`background/background.js:228-235`
```js
var port;
browser.contextMenus.onClicked.addListener(function (info, tab) {
  port.postMessage({ cmd: info.menuItemId });
});

browser.runtime.onConnect.addListener(function (m) {
  port = m;
});
```

> ⚠️ **缺陷**：`port` 是单变量，多 Panel 场景后连接的会覆盖前者；且未判空，无 Panel 时点菜单会抛异常。复刻请改 `Map<windowId, Port>` + `port.onDisconnect` 清理。

SW 保活：`background/background.js:237-239`
```js
const keepAlive = () => setInterval(browser.runtime.getPlatformInfo, 20e3);
browser.runtime.onStartup.addListener(keepAlive);
keepAlive();
```

---

## A.11 消息 Schema 全量清单

| 消息首字段 | 方向 | 发送方 | 接收方 | 语义 |
|---|---|---|---|---|
| `selfWindowId` / `commWindowId` | SW → Panel | `background/background.js:94` | `editor.js:79` | 开窗握手 |
| `command`/`target`/`value`/`insertBeforeLastCommand`/`frameLocation` | Content → Panel | `content/recorder.js:105` | `panel/js/background/recorder.js:371` | 录制一条命令 |
| `command:"checkForAutomated"` + `isAutomated` | Content → Panel | `content/check-browser-automation.js:2` | `recorder.js:253` | 上报 `navigator.webdriver` |
| `frameLocation` | Content → Panel | `content/recorder.js:27` | `window-controller.js:45` | 上报 iframe 路径 |
| `commands`/`target`/`value` | Panel → Content | `window-controller.js:150` | `command-receiver.js:49` | 回放一条命令 |
| `attachRecorder` / `detachRecorder` | Panel → Content | `editor.js:71` | `command-receiver.js:174-186` | 开/关录制 + 页面浮层 |
| `attachRecorderRequest` | Content → Panel | `recorder-handlers.js:522` | `editor.js:69` | 新页面加载后请求重新挂钩 |
| `attachHttpRecorder`/`detachHttpRecorder` | Content → Panel | `command-receiver.js:176,182` | Panel | 录制状态回执 |
| `selectMode` + `selecting` | Panel → Content | `editor.js:65` | `command-receiver.js:140` | 进入/退出"选取元素"模式 |
| `selectTarget` + `target` | Content → Panel | `command-receiver.js:149` | `editor.js:42` | 回传定位器候选数组 |
| `cancelSelectTarget` | Content → Panel | `command-receiver.js:161` | `editor.js:58` | 取消选取 |
| `showElement` | Panel → Content | `element-actions.js` | Content | 高亮元素 |
| `storeStr` + `storeVar` | Content → Panel | `selenium-api.js:377,386,392,401,410,414` | `formatCommand.js:73` | 写回放变量 |
| `echoStr` | Content → Panel | `selenium-api.js:406` | 同上 | `echo` 命令输出 |
| `captureEntirePageScreenshot` | Content → **SW** | `command-receiver.js:68` | `background/kar.js:160` | 截图（base64 png） |
| `uploadFile` + `file` + `krId`/`locator` | Content → **SW** | `selenium-api.js:3260` | `background/kar.js:174` | CDP 文件上传 |
| `sendSpecialKeys` + `keyCodes`/`modifiers` | Content → **SW** | `selenium-api.js:1155` | `background/kar.js:183` | CDP 按键 |
| `checkChromeDebugger` | Content → SW | `content/kar.js:3` | `background/kar.js:325` | 能力探测 |
| `checkStopInContentScript` | Content → Panel | `inject-popup-record.js:75` | Panel | 页面浮层 Stop 按钮 |
| `getExternalCapabilities` | Panel → SW | `kar-generateScript.js` | `background/kar.js:311` | 拉取第三方导出能力 |
| `type:'katalon_recorder_register'` | 外部扩展 → SW | 第三方 | `background/kar.js:268` | 注册导出能力 |
| `type:'katalon_recorder_export'` | Panel → 外部扩展 | `kar-generateScript.js:202` | 第三方 | 委托导出 |
| `"open-panel"` / `"focus-panel"`（**纯字符串**） | 页面/Panel → SW | `welcome.js:8`；`top-toolbar/actions.js:161` | `background/install.js:64` | 开/聚焦面板 |
| `{type, target:"offscreen"}` | SW ↔ Offscreen | `offscreen-server.js:30` | `offscreen.js` | 浏览器名/指纹 |
| `{id, type:REQUEST/RESPONSE}` + `key:"pandoraboz"` | MAIN ↔ ISOLATED | `remote-object-helper-*.js` | 双向 | `chrome.*` RPC |
| `action`/`request`/`srcTabId` | SW ↔ Content | `katalon/background.js:84,105,288,319` | 双向 | Object Spy 通道 |
| `method`（`XHTTP_POST_METHOD`） | Content → SW | `katalon/chrome_common.js:27` | `katalon/background.js:189` | Object Spy 转发 HTTP |

---

## A.12 复刻要点（通信层）

1. **不要把 recorder/playback 放进 Service Worker**。SW 会被 30s 空闲杀死、没有 DOM、没有 `prompt()`、状态不可靠。用长驻 Panel 窗口当后台，SW 只留权限桩。
2. **上行广播 + `sender.tab.id` 分流；下行 `{frameId}` 定向**。iframe 支持完全依赖 `sender.frameId` 与自维护的 `frameLocation`（`root:0:2` 形式）——这是最值得抄的设计。
3. **`retryUntilSuccess(fn, 60, 500)`** 是解决 "Receiving end does not exist" 的实用组合。
4. **MAIN world RPC 桥**：如果录制器必须跑在 MAIN world（为了拿页面自身的框架实例），就需要这套 `postMessage` RPC。**务必**把 `pandoraboz` 换成 `crypto.randomUUID()` 并做 origin 校验。
5. **CDP 只在两处不可替代**（`DOM.setFileInputFiles`、`Input.dispatchKeyEvent`），其余别用 `debugger` 权限。
6. **Offscreen 仅用于埋点** → 纯净版整块删掉。
7. **Sandbox 页 `EvalScope` 的单 promise 队列模式**直接复用。

---

# B. 浏览器版本兼容层

## B.0 一句话结论

**日志 `[info] Browser: Chrome Version: 150.0` 来自 `panel/js/katalon/kar.js:513-529` 的 `logStartTime()`，值取自 bowser 1.x 的 `bowser.name` / `bowser.version`；bowser 的正则只捕获两段版本号，所以 Chrome 150.0.7204.100 显示成 `150.0`。跨浏览器统一靠 Mozilla `webextension-polyfill`（三份物理副本，md5 完全相同）。**

---

## B.1 那句日志的确切出处

`panel/js/katalon/kar.js:513-529`
```js
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

## B.2 为什么是 `150.0` 而不是 `150.0.7204.100`

`panel/js/katalon/bowser.js:274-279`
```js
    else if (/chrome|crios|crmo/i.test(ua)) {
      result = {
        name: 'Chrome'
        , chrome: t
        , version: getFirstMatch(/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i)
      }
    }
```

正则 `(\d+(\.\d+)?)` **只捕获两段**。

### Edge 必须先于 Chrome 判定
Edge 的 UA 里也含 `Chrome/`，所以顺序是硬约束：
`panel/js/katalon/bowser.js:159-164`
```js
    } else if (/edg([ea]|ios)/i.test(ua)) {
      result = { name: 'Microsoft Edge', msedge: t, version: edgeVersion }
    }
```

### 模块加载即执行（无惰性求值）
`panel/js/katalon/bowser.js:457`
```js
  var bowser = detect(typeof navigator !== 'undefined' ? navigator.userAgent || '' : '')
```
SW 里 `navigator` 存在，故 `content/bowser.js` 被 `worker_wrapper.js:5` import 后同样可用。

**三份 bowser 副本**：`content/bowser.js`（SW 用）、`katalon/bowser.js`（Object Spy 用）、`panel/js/katalon/bowser.js`（Panel 用）。

---

## B.3 browser.* Promise 化

三份**完全相同**的 Mozilla `webextension-polyfill`（md5 `62c2cb1c84aa85f1ceb09de9e57659c0`，10113 字节）：

| 文件 | 服务对象 | 引入位置 |
|---|---|---|
| `common/browser-polyfill.js` | SW + Panel | `worker_wrapper.js:6`、`panel/index.html:865` |
| `common/browser-polyfill-content.js` | ISOLATED content | `manifest.json:16` |
| `common/browser-polyfill-page.js` | MAIN world | 打进 `bundles/content.1.bundle.js` |

拆三份纯粹是 manifest 路径限制导致的冗余。

### MAIN world 的注入顺序是硬约束

`manifest.bak.json:74-81`
```json
"js": [
  "content/myKRIsolatedWindow.js",
  "common/remote-object-helper-page.js",
  "common/chrome-polyfill.js",
  "common/browser-polyfill-page.js",
  "content/prompt-injecter.js",
  "content/runScript-injecter.js"
],
```

必须**先** `chrome-polyfill.js`（补出 `chrome.runtime.id`）**再** `browser-polyfill-page.js`，否则 polyfill 会因 `chrome.runtime.id` 为空而 `throw`：

```js
if(!(globalThis.chrome&&globalThis.chrome.runtime&&globalThis.chrome.runtime.id))
throw new Error("This script should only be loaded in a browser extension.");
```

> `content/myKRIsolatedWindow.js` 在最终包中**不存在**（已被打进 bundle 头部的自定义加载器）。

---

## B.4 浏览器名的两套同名实现（反模式）

| 版本 | 文件 | 实现方式 | 谁 import |
|---|---|---|---|
| DOM 版 | `common/get-browser-name.js:4-64` | 特征探测（`window.opr`、`InstallTrigger`、`document.documentMode`…） | Panel（`panel/index.html:874`） |
| SW 版 | `common/get-browser-name-background.js:1-4` | 转发到 offscreen | SW（`worker_wrapper.js:12`） |

```js
// common/get-browser-name-background.js 全文
function getBrowserName() {
  return sendMessageToOffscreenDocument("get-browser-name");
}
```

> ⚠️ **两个同名函数，靠"谁被 import"决定语义**——这是很脆的隐式多态。
> ⚠️ 另有 bug：`common/get-browser-name.js:43-60` 里 `isChrome` 分支先于 `isEdgeChromium` 返回，**Edge Chromium 永远被判成 "Chrome"**，`isEdgeChromium` 是死代码。

---

## B.5 Firefox 兼容痕迹

| 位置 | 内容 |
|---|---|
| `manifest.json:6-10` | 保留 gecko id `{91f05833-bab1-4fb1-b9e4-187091a4d75d}` |
| `katalon/chrome_common.js:18` | 端口按浏览器分叉：Chrome 50000 / Firefox 50001 |
| `panel/js/background/recorder.js:346-352` | 特权页判定同时覆盖 `moz-extension` 与 `chrome-extension` |
| `panel/js/background/window-controller.js:369-375` | 商店链接分叉（AMO / Chrome Web Store） |
| `window-controller.js:342-348` | 注释直言 "Firefox did not update url information when tab is updated"，手动补 `https://www.google.com` |

---

## B.6 MV2 → MV3 迁移的三处遗留死代码（重要教训）

### ① `getBackgroundPage()` —— MV3 已移除
`panel/js/background/window-controller.js:326-331`
```js
recorder.setOpenedWindow(window.id);
browser.runtime.getBackgroundPage()
.then(function(backgroundWindow) {
    backgroundWindow.master[window.id] = recorder.getSelfWindowId();
});
```
**必然 reject 且无 `.catch`** → SW 侧 `master` 映射在"回放时新建窗口"路径下永远不更新（表现：该窗口点扩展图标会再开一个 Panel）。

### ② `XMLHttpRequest` —— SW 里不存在
`katalon/background.js:138-179`
```js
function sendRequest(request, waitAnswer) {
    try {
        var xhttp = new XMLHttpRequest();
        ...
```
`katalon/background.js` 被 `worker_wrapper.js:21` import 进 SW，而 SW 里 `XMLHttpRequest` 是 `undefined`。所幸唯一调用者已被注释（`katalon/background.js:192-193`）。真正生效的是 WebSocket 路径（`katalon/background.js:210-215`）。

### ③ `default_popup` 指向不存在的目录 → 见 C 节

### ④ CSP 被构建期误改
| 版本 | CSP |
|---|---|
| `manifest.bak.json:48-50`（打包前，正确） | `"script-src 'self'; object-src 'self'"` |
| `manifest.json:41-43`（发布版，错误） | `"script-src 'self'; object-src 'self'; unsafe-eval; unsafe-inline;"` |

`unsafe-eval` / `unsafe-inline` 是**关键字**不是**指令名**，写在这里 Chrome 直接忽略整条。

---

## B.7 复刻要点（兼容层）

1. **不要用 bowser 1.x**。换 `navigator.userAgentData.getHighEntropyValues(['fullVersionList'])`（Chromium 90+）拿准确完整版本，Firefox 回落 UA 解析。
2. **`webextension-polyfill` 只放一份**，构建时按目标复制，不要维护三份物理副本。
3. **MAIN world 注入顺序是硬约束**：`remote-object-helper-page` → `chrome-polyfill` → `browser-polyfill-page`。
4. **迁移 MV2 时全局搜这四类 API**：`getBackgroundPage`、`XMLHttpRequest`、`chrome.extension.*`、`browser_action.default_popup`。KR 全中。
5. `getBrowserName()` 同名双实现改成单一入口 + 内部判断 `typeof document === 'undefined'`。

---

# C. 点击插件图标的弹框机制

## C.0 一句话结论

**`manifest.json:44` 声明的 `default_popup: "popup-browser/index.html"` 指向一个根本不存在的目录，且写在 manifest 顶层（应在 `action` 内），因此完全失效；实际弹框由 `browser.action.onClicked` → `openPanel()` → `browser.windows.create({type:"popup"})` 完成。这是一个"靠 bug 工作"的设计。**

---

## C.1 default_popup 是死配置（双重证据）

`manifest.json:1-5, 44`
```json
"action": {
   "default_icon": "katalon/images/branding/branding_16.png",
   "default_title": "Katalon Recorder"
},
...
"default_popup": "popup-browser/index.html",
```

**证据 1**：`default_popup` 写在 manifest **顶层**，而 MV3 规范要求 `action.default_popup`。顶层是未知键，Chrome 忽略。

**证据 2**：`popup-browser/` 目录**不存在**：
```
$ ls -d popup-browser
ls: cannot access 'popup-browser': No such file or directory
```

> 💡 **关键推论**：因为 `default_popup` 无效，`action.onClicked` 才会触发。如果哪天有人"好心"把它修正到 `action` 里，整个插件就点不开了。**复刻时应直接删除这一行。**

---

## C.2 真正的弹框实现（完整源码）

`background/background.js:18-20`
```js
var master = {};              // contentWindowId → panelWindowId 一对一映射
var clickEnabled = true;      // 1 秒节流开关
const popupWindowIDs = [];
```

`background/background.js:29-106`
```js
function openPanel(tab, noFocus = false) {
  let contentWindowId = tab.windowId;
  if (master[contentWindowId] != undefined) {            // ① 已有 Panel → 只聚焦
    browser.windows.update(master[contentWindowId], { focused: !noFocus })
      .catch(function (e) { master[contentWindowId] == undefined; openPanel(tab); });
    return;
  } else if (!clickEnabled) {                            // ② 1 秒内重复点击 → 丢弃
    return;
  }

  clickEnabled = false;
  setTimeout(function () { clickEnabled = true; }, 1000);

  var f = function (height, width) {                     // ③ 真正开窗
    const url = "panel/index.html";
    browser.windows.create({
        url: browser.runtime.getURL(url),
        type: "popup",
        height: height,
        width: width,
        focused: !noFocus,
      })
      .then(function waitForPanelLoaded(panelWindowInfo) {   // ④ 轮询等 status==="complete"
        return new Promise(function (resolve, reject) {
          let count = 0;
          let interval = setInterval(function () {
            if (count > 100) { reject("SideeX editor has no response"); clearInterval(interval); }
            browser.tabs.query({ active: true, windowId: panelWindowInfo.id, status: "complete" })
              .then(function (tabs) {
                if (tabs.length != 1) { count++; return; }
                else {
                  master[contentWindowId] = panelWindowInfo.id;
                  if (Object.keys(master).length === 1) { createKrMenus(); }   // ⑤ 首个 Panel 才建菜单
                  resolve(panelWindowInfo);
                  clearInterval(interval);
                }
              });
          }, 500);
        });
      })
      .then(function bridge(panelWindowInfo) {                // ⑥ 握手
        popupWindowIDs.push(panelWindowInfo.id);
        return browser.tabs.sendMessage(panelWindowInfo.tabs[0].id, {
          selfWindowId: panelWindowInfo.id,
          commWindowId: contentWindowId,
        });
      })
      .catch(function (e) { console.log(e); });
  };

  getWindowSize(f, false);                                // ⑦ 先取历史尺寸
}

browser.action.onClicked.addListener(openPanel);
```

### 尺寸恢复与持久化

读（SW 侧）：`background/kar.js:1-20`
```js
function getWindowSize(callback) {
    browser.storage.local.get('window').then(function(result) {
        var height = 630;
        var width = 1080;
        if (result) {
            try {
                result = result.window;
                if (result.height) { height = result.height; }
                if (result.width)  { width  = result.width;  }
            } catch (e) {}
        }
        callback(height, width);
    });
}
```

写（Panel 侧）：`panel/js/katalon/kar.js:51-59`
```js
$(window).on("resize", function () {
  var data = { window: { width: window.outerWidth, height: window.outerHeight } };
  browser.storage.local.set(data);
});
```

### 关窗清理

`background/background.js:110-120`
```js
browser.windows.onRemoved.addListener(function (windowId) {
  let keys = Object.keys(master);
  for (let key of keys) {
    if (master[key] === windowId) {
      delete master[key];
      if (keys.length === 1) { browser.contextMenus.removeAll(); }
    }
  }
});
```

> ⚠️ `popupWindowIDs` 只 push 不 splice，长期运行会累积失效 id，`focusPanel()` 对已关闭窗口调 `windows.update` 会抛未捕获 rejection。

---

## C.3 第二种自动弹框：安装后自动开面板 + 跳登录

`background/install.js:17-33`
```js
browser.runtime.onInstalled.addListener(function (details) {
  runAutoUpdate();
  if (details.reason === "install") {
    browser.tabs.create({ url: browser.runtime.getURL("/pages/welcome/welcome.html") });
    trackingInstallApp();
    browser.storage.local.set({ firstTime: true });
  } else if (details.reason === "update") { ... }
});
```

`pages/welcome/welcome.js:1-12`（全文）
```js
import AuthService from "../../panel/js/UI/services/auth-service/auth-service.js";

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

(async () => {
  await browser.runtime.sendMessage("open-panel");
  await delay(1000); // Wait for KR panel to open
  const loginUrl = await AuthService.getUniversalLoginUrl();
  location.href = loginUrl;
})();
```

`background/install.js:64-80`
```js
browser.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message === "open-panel") { openPanel(sender.tab, true); sendResponse("OK"); return false; }
  if (message === "focus-panel") { focusPanel(); sendResponse("OK"); return false; }
  ...
});
```

`noFocus=true` → 面板在后台打开，前台留给登录页。**这就是"装完插件自动弹出面板并跳登录"的完整链路。**

---

## C.4 第三种弹框：页面内注入的录制浮层

不是扩展窗口，是往被测页面 DOM 里插的 `<div>`。

`content/inject-popup-record.js:19-38`
```js
function addPopup() {
    const div = document.createElement('div');
    div.id = "popupInjectionKR";
    div.style = `display: flex!important;
        flex-direction: row!important;
        position: fixed!important;
        top: 90% !important;
        left: 35% !important;
        ...
        width: 350px !important;
        z-index: 99999999 !important;`;
```

`content/inject-popup-record.js:48-76`
```js
div1.innerText = "Katalon Recorder is recording ...";
...
button.innerHTML = trustedPolicy.createHTML("Stop");
button.addEventListener("click", function (event) {
    browser.runtime.sendMessage({ checkStopInContentScript: true });
})
```

可拖拽（`mousedown`/`mousemove`/`mouseup` 三段，`:40-46, 83-99`）。

**防止把浮层自身录进去**：`content/recorder.js:104`
```js
if (!target[0].some(e => e?.includes instanceof Function && e.includes('popupInjectionKR'))) {
```

> 💡 注意两个细节：① 所有样式加 `!important` 防止被页面 CSS 覆盖；② 用 `trustedPolicy.createHTML` 兼容启用了 Trusted Types 的页面。这两点在实战中都会踩到。

---

## C.5 第四、五种弹框：设置窗口与登录窗口

设置窗口（820×740，带 id 去重）：`panel/js/katalon/kar.js:229-250`
```js
var settingWindowID;
$(function () {
  function openPanel() {
    let height = 740;
    let width = 820;
    browser.windows.create({
        url: browser.runtime.getURL("setting-panel/index.html"),
        type: "popup", height: height, width: width, focused: true,
      })
      .then((panel) => (settingWindowID = panel.id));
  }
  $("#settings").on("click", function () {
    if (settingWindowID === undefined) { openPanel(); }
    else { browser.windows.update(settingWindowID, { ... }
```

登录窗口：`panel/js/UI/services/auth-service/auth-service.js:21-28`
```js
static async openUniversalLoginUrl() {
    const url = await this.getUniversalLoginUrl();
    await browser.windows.create({ url: url, type: "popup", focused: true });
}
```

---

## C.6 右键菜单：17 条

`background/background.js:123-226` 逐条 `browser.contextMenus.create`，完整 id 列表（顺序即注册顺序）：

```
verifyText, verifyTitle, verifyValue,
assertText, assertTitle, assertValue,
storeText,  storeTitle,  storeValue,
waitForElementPresent, waitForElementNotPresent,
waitForTextPresent,    waitForTextNotPresent,
waitForValue,          waitForNotValue,
waitForVisible,        waitForNotVisible
```

统一形态：
```js
browser.contextMenus.create({
    id: "verifyText",
    title: "verifyText",
    documentUrlPatterns: ["<all_urls>"],
    contexts: ["all"],
});
```

点击后经 Port 转给 Panel（`background/background.js:229-231`，见 A.10）。

另有一套 **Object Spy 专用菜单**（动态、按 runMode 建）：`katalon/background.js:337-377`。

---

## C.7 复刻要点（弹框）

1. **必须弹独立窗口，不能用 popup**。popup 在失去焦点时会被浏览器销毁，而录制过程中用户必然要去点目标页面 → popup 必挂。`windows.create({type:"popup"})` 生成的是真实浏览器窗口，可长驻。**这是所有录制类扩展的必选架构。**
2. **`master[contentWindowId] → panelWindowId` 一对一映射**是精髓：每个浏览器窗口配一个 Panel，互不串扰。复刻时把 `master` 换成 `chrome.storage.session`（SW 重启后不丢）。
3. **等 Panel ready 别用轮询**。KR 用 `tabs.query({status:"complete"})` 轮询 500ms×100；更好的做法是 Panel 加载完主动 `runtime.sendMessage({panelReady:true})`，SW 侧一次性 resolve。
4. **`clickEnabled` 1 秒节流必要**（`windows.create` 是异步的，双击会开两个窗口）。
5. **尺寸持久化**用 `storage.local.window = {width, height}`，Panel 侧 `resize` 事件写、SW 侧开窗时读 —— 简单有效，直接抄。
6. **页面浮层三要素**：`!important` 全覆盖样式 + `z-index: 99999999` + Trusted Types 兼容 + 录制时过滤自身。

---

## 附录：本文涉及的全部缺陷清单

| 位置 | 问题 | 建议 |
|---|---|---|
| `manifest.json:44` | `default_popup` 指向不存在目录且位置错误 | 直接删除 |
| `manifest.json:42` | CSP 写了无效关键字 | 恢复为 `"script-src 'self'; object-src 'self'"` |
| `manifest.json:48` | `externally_connectable.ids: ["*"]` | 显式白名单或删除 |
| `manifest.json:52` | `host_permissions` 同时列 `http://*/`、`https://*/`、`<all_urls>` | 只留 `<all_urls>` |
| `window-controller.js:328-331` | `getBackgroundPage()` MV3 已移除，无 catch | 改用消息通知 SW |
| `window-controller.js:322,337,346` | 硬编码 `https://www.google.com` | 改 `about:blank` 或配置项 |
| `katalon/background.js:138-179` | SW 中用 `XMLHttpRequest` | 改 `fetch` |
| `background/background.js:228-235` | `port` 单变量、无判空 | 改 `Map<windowId, Port>` |
| `background/background.js:93,110-120` | `popupWindowIDs` 只 push 不 splice | `onRemoved` 里同步清理 |
| `background/background.js:61-91` | 500ms×100 轮询等 Panel ready | 改 Panel 主动通知 |
| `background/background.js:105` vs `kar.js:2` | `getWindowSize` 签名不一致（传 2 收 1） | 统一签名 |
| `remote-object-helper-*.js` | 明文密钥 `pandoraboz` + `postMessage(*, "*")` | 随机 nonce + origin 校验 |
| `get-browser-name.js:43-60` | Edge 永远被识别为 Chrome | 调整判定顺序 |
| `bowser.js:278`（3 份） | 版本正则只取两段 | 改 `/([\d.]+)/` 或用 `userAgentData` |
| `panel/index.html:52` | 引用已失效的 `html5shim.googlecode.com` | 删除 |
