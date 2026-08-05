# TECH-06 — 浏览器兼容与 Polyfill 层

> **一句话概括**：Katalon Recorder 用 three 份字节完全相同的 `webextension-polyfill` 把 `chrome.*` 统一成 `browser.*`、用 `bowser.js` 做 UA 分支、用 `chrome-polyfill` + `remote-object-helper` 在 MAIN/ISOLATED 两个 world 间桥接 `chrome` 对象、用 `trustedPolicy` 规避 CSP、并保留一个 `manifest.bak.json` 记录 MV3 打包前的分散脚本清单——这套层叠抽象让同一份代码能在 Chrome / Firefox / Edge 上跑，但也是裁剪时最大的"死重"来源。

---

## 1. 关键文件清单

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---|---|---|
| `common/browser-polyfill.js` | 10121 B | 后台用的 webextension-polyfill | **保留**（命名空间统一） |
| `common/browser-polyfill-content.js` | 10121 B | 内容脚本(ISOLATED)用，与上面**完全相同** | **保留**（或合并） |
| `common/browser-polyfill-page.js` | 10121 B | MAIN world 用，与上面**完全相同** | **保留**（或合并） |
| `content/bowser.js` | 627 | UA 检测库（与 katalon 版相同） | **保留**（按需） |
| `katalon/bowser.js` | 627 | 同上，重复一份 | **删除**（合并为一份） |
| `common/get-browser-name.js` | 65 | 纯 JS 浏览器名检测 | **保留** |
| `common/get-browser-name-background.js` | 4 | 后台转发到 offscreen | **保留**（配合 offscreen） |
| `common/get-browser-fingerprint.js` | — | 指纹获取（内容侧） | **删除**（埋点） |
| `common/get-browser-fingerprint-background.js` | — | 指纹获取（后台经 offscreen） | **删除**（埋点） |
| `common/browser-fingerprint2.js` | 9346 | FingerprintJS 库 | **删除**（埋点，巨大） |
| `common/chrome-polyfill.js` | 15 | ISOLATED 侧建 `chrome` proxy | **保留**（MAIN/ISOLATED 桥需要） |
| `common/chrome-polyfill-server.js` | 9 | MAIN 侧建 `PageTransportServer` | **保留**（同上） |
| `common/remote-object-helper-content.js` | 97155 B | ISOLATED 桥（与 page 版相同） | **保留**（或合并） |
| `common/remote-object-helper-page.js` | 97155 B | MAIN 桥，完全相同 | **保留**（或合并） |
| `content/trustedPolicy.js` | 9 | Trusted Types `default2` policy | **保留**（CSP 规避） |
| `content/check-browser-automation.js` | 5 | `navigator.webdriver` 上报 | **删除**（埋点） |
| `manifest.bak.json` | 222 | 旧版分散脚本清单（对照） | **删除**（仅参考） |
| `manifest.json` | 75 | 现行 MV3 清单（bundle 化） | **保留** |

---

## 2. 核心机制逐层拆解

### 2.1 `browser.*` 与 `chrome.*` 的统一：webextension-polyfill

三个 polyfill 文件**字节完全相同**（已 `wc -c` 确认均为 10121 字节）：

```
common/browser-polyfill.js           10121
common/browser-polyfill-content.js   10121
common/browser-polyfill-page.js      10121
```

它们是 `webextension-polyfill` 0.12.0，作用是把 Chrome 的回调式 `chrome.*` API 封装成 Promise 式的 `browser.*`。三份相同是因为要在**三个不同执行环境**（SW 后台、ISOLATED 内容脚本、MAIN world 页面）各自注入一份——polyfill 在加载时就接管 `globalThis.chrome` 并暴露 `browser`。

为什么需要它：
- Firefox 的 WebExtension API 本就是 Promise 风格（`browser.*`），但 Chrome 仍是回调风格（`chrome.*`）。
- 用 `browser.*` 写一份代码，在 Chrome 上由 polyfill 转译、在 Firefox 上原生支持，避免 `callback vs Promise` 双份逻辑。

**代价**：每份 10121 字节 × 3 = 约 30KB 重复代码。裁剪时若确定只支持 Chrome，可直接用 `chrome.*` 并删掉 polyfill（但全文 `browser.` 调用需改写）；若支持双核，保留一份通过打包注入三个环境即可，不必物理复制三份。

### 2.2 `bowser.js`：UA 检测的浏览器分支

`content/bowser.js` 与 `katalon/bowser.js` 完全相同（627 行），是一个手写 UA 解析库，输出 `{ name, version, os, osname, ... }`。其 `name` 分支覆盖了几乎所有内核：

```
bowser.js:152  name: 'Chrome'      (osname: 'Chrome OS')
bowser.js:161  name: 'Microsoft Edge'
bowser.js:190  name: 'Firefox'
bowser.js:269  name: 'Edge Chromium'
bowser.js:289  name: 'Safari'
bowser.js:54   name: 'Opera'
bowser.js:262  name: 'Chromium'
... 其余 Vivaldi / Yandex / UC / 等
```

消费方（关键分支点）：
- `katalon/chrome_common.js:18`：`bowser.name` 决定 Katalon Server 端口。
- `katalon/chrome_setup.js:1`：`serverPort = bowser.name=="Chrome" ? 50000 : 50001`。
- `katalon/background.js:255`、`panel/js/katalon/kar.js:521,524`：按浏览器分支走不同通信。
- `content-marketing/panel/popup-chrome-store.js`、`popup-rate-us.js`、`robot.js:144-145`、`onboarding-dialogs.js:159`：营销弹窗按浏览器显示不同商店链接。

**注意**：`bowser.js` 只用于**与 Katalon 官方生态/营销相关的分支**（端口、商店链接、埋点）。纯录制回放逻辑几乎不依赖它。个人插件若删掉 `katalon/*` 与 `content-marketing/*`，`bowser.js` 实际无用武之地，可一并删除两份。

### 2.3 `get-browser-name.js`：更轻量的纯 JS 检测

除了 `bowser.js`，还有一份独立的 `getBrowserName()`，不解析版本，只返回浏览器名：

```javascript
// common/get-browser-name.js:4-64
function getBrowserName() {
  var isOpera  = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(" OPR/") >= 0;
  var isFirefox = typeof InstallTrigger !== "undefined";
  var isSafari = /constructor/i.test(window.HTMLElement) || (...);
  var isIE = /*@cc_on!@*/ false || !!document.documentMode;
  var isEdge = !isIE && !!window.StyleMedia;
  var isChrome = !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);
  var isEdgeChromium = isChrome && navigator.userAgent.indexOf("Edg") != -1;
  var isBlink = (isChrome || isOpera) && !!window.CSS;
  if (isFirefox) return "Firefox";
  if (isChrome)  return "Chrome";
  if (isSafari)  return "Safari";
  if (isOpera)   return "Opera";
  if (isIE)      return "IE";
  if (isEdge)    return "Edge";
  if (isEdgeChromium) return "Edge Chromium";
  if (isBlink)   return "Blink";
  return "Unknown";
}
```

**关键**：这个函数依赖 `window`/`navigator`/`document`，**只能在内容脚本或页面里跑，不能跑在 SW**。所以后台版本是个转发壳：

```javascript
// common/get-browser-name-background.js:1-4
function getBrowserName() {
  return sendMessageToOffscreenDocument("get-browser-name");  // 经 offscreen（有 DOM）
}
```

这是"SW 无 DOM → 借 offscreen 取信息"模式的典型（详见 TECH-05 §2.8）。

### 2.4 MAIN world vs ISOLATED world：双 world 桥

这是整个兼容层最难懂、也最关键的一节。

**背景**：MV3 的 `content_scripts` 默认在 ISOLATED world（与页面脚本隔离的扩展私有环境）。但 Katalon 需要：
1. 在页面真实环境里拿到**页面自己的全局对象**（`window`、`document`、`jQuery` 等），用于定位元素、执行用户脚本——这必须在 MAIN world。
2. 同时要让 MAIN world 里的代码能调用 `chrome.*`（如 `chrome.runtime.sendMessage`、`chrome.storage`）——但 MAIN world **默认没有 `chrome` 对象**（出于安全，Chrome 不向页面注入 `chrome`）。

解决：Katalon 在两边都注入桥接代码，通过 `postMessage` 在 ISOLATED 与 MAIN 之间传递 `chrome` 调用。

manifest 中的两段 content_scripts（TECH-07 也会提到）：

```json
// manifest.json:14-27（ISOLATED world，默认）
{ "js": ["common/browser-polyfill-content.js",
         "common/remote-object-helper-content.js",
         "common/chrome-polyfill-server.js"],
  "run_at": "document_start" }
// manifest.json:20-27（MAIN world）
{ "js": ["common/remote-object-helper-page.js"], "world": "MAIN", "run_at": "document_start" }
// manifest.json:28-34（MAIN world，主逻辑 bundle）
{ "js": ["bundles/content.1.bundle.js"], "world": "MAIN", "run_at": "document_start" }
```

**桥的工作方式**：

MAIN 侧（`chrome-polyfill-server.js`）——在页面真实环境里，把扩展 id 写到 DOM，并起一个 `PageTransportServer`：

```javascript
// common/chrome-polyfill-server.js:1-10
document.documentElement.setAttribute('katalonExtensionId', chrome.runtime.id);
const transportServer = new PageTransportServer();
transportServer.addConnectionListener((connection) => {
    RemoteObjectHelper.attachToServer(chrome, connection, 'chrome');
});
transportServer.listen();
```

ISOLATED 侧（`chrome-polyfill.js`）——在扩展私有环境里，读到扩展 id，建一个 `chrome` 的 proxy，所有 `chrome.*` 调用通过 `PageTransport` 转发给 MAIN 侧的 server：

```javascript
// common/chrome-polyfill.js:1-15
const myChrome = {
    runtime: { ...chrome.runtime, id: document.documentElement.getAttribute('katalonExtensionId') },
    extension: {},
};
const transport = new PageTransport();
const chromeProxy = RemoteObjectHelper.attachToClient(myChrome, transport, 'chrome');
chrome.runtime = chromeProxy.runtime;
chrome.storage = chromeProxy.storage;
chrome.extension = chromeProxy.extension;
```

**效果**：MAIN world 里的录制逻辑（如 `content.1.bundle.js` 中的 `recorder.js`）调用 `chrome.runtime.sendMessage(...)`，实际是通过 `PageTransport` 把调用序列化 → `postMessage` 给 ISOLATED 侧的 server → server 用真实 `chrome` 执行 → 结果再序列化回传。这样 MAIN world 既能操作页面 DOM，又能用 `chrome` API。

`remote-object-helper-content.js` 与 `remote-object-helper-page.js` 完全相同（已确认均为 97155 字节），分别提供 `PageTransport` / `RemoteObjectHelper` 的 ISOLATED 与 MAIN 实现（内含 lodash 压缩代码）。

#### 2.4.1 桥的内部实现（从压缩源码反推）

`remote-object-helper-page.js` 头部（已读）揭示其由三部分压缩组成：
- `Tt`：一组消息类型常量 `MESSAGE / CONNECTED / DISCONNECTED / ERROR / OPEN / REQUEST / RESPONSE / CONNECTION`（remote-object-helper-page.js:1）。
- `k`（即 `EventEmitter`，来自 `events` 模块的压缩实现，含 `on/once/emit/_events/_maxListeners`）。
- 其后紧跟 lodash 4.17.21 压缩代码（remote-object-helper-page.js:2-10 的 MIT license 注释与 `4.17.21` 标识）。

`PageTransport` 与 `RemoteObjectHelper` 是桥的核心。其工作原理推断如下（基于 `chrome-polyfill.js`/`chrome-polyfill-server.js` 的调用方式 + 压缩源码中的消息常量）：

1. **MAIN 侧 `PageTransportServer`**（`chrome-polyfill-server.js:3`）监听 `addConnectionListener`，每个"连接"对应一个从 ISOLATED 来的标签页。它用 `window.postMessage` 与 ISOLATED 世界互发 `REQUEST`/`RESPONSE` 类型消息。
2. **ISOLATED 侧 `PageTransport`**（`chrome-polyfill.js:10`）是真实 `chrome` 对象与 MAIN 世界之间的"信使"。`RemoteObjectHelper.attachToClient(myChrome, transport, 'chrome')` 把 `myChrome`（仅含 `runtime.id`/`extension`）包装成 proxy：当 MAIN 世界代码访问 `chrome.runtime.sendMessage(...)` 时，proxy 拦截调用，把 `{对象路径:'runtime.sendMessage', 参数}` 序列化后经 `PageTransport` 发给 ISOLATED 侧。
3. **ISOLATED 侧 `RemoteObjectHelper.attachToServer(chrome, connection, 'chrome')`**（`chrome-polyfill-server.js:6`）在收到请求后，用**真正的** `chrome.runtime.sendMessage(...)` 执行，再把结果序列化回传。
4. MAIN 侧 proxy 的 `Promise` 在收到 `RESPONSE` 后被 resolve。

**为什么要这么绕**：Chrome 出于安全，**不向 MAIN world 注入 `chrome` 对象**（页面脚本不可直接调扩展 API，否则任意网页都能操控你的扩展）。但录制逻辑必须在 MAIN world 才能拿到页面真实 `window`/DOM。于是 Katalon 让"真正执行 `chrome` 调用"的动作发生在 ISOLATED 世界，MAIN 世界只发"我要调用 chrome.xxx 带这些参数"的请求，由 ISOLATED 代理执行后回传结果。这是教科书级的"跨 world 受限 API 代理"模式。

**裁剪判断**：
- 若你的录制逻辑放在 **ISOLATED world**（默认），MAIN 世界不需要 `chrome`，整条 `chrome-polyfill` + `chrome-polyfill-server` + `remote-object-helper`（两份各 97KB）**可全删**，省 ~194KB。
- 若录制逻辑必须在 **MAIN world**（例如要直接读取页面框架的私有变量、jQuery 实例），则必须保留这套桥。

#### 2.4.2 两套 world 的 content_scripts 清单对照

```json
// manifest.json:14-40（现行，4 段）
// ① ISOLATED（默认，无 world 字段）
[ "common/browser-polyfill-content.js",
  "common/remote-object-helper-content.js",   // ← 桥 ISOLATED 端
  "common/chrome-polyfill-server.js" ]        // ← 桥 server 端（在页面里起 server）
// ② MAIN
[ "common/remote-object-helper-page.js" ]     // ← 桥 MAIN 端（仅建 client）
// ③ MAIN（主逻辑）
[ "bundles/content.1.bundle.js" ]             // ← 录制/定位等真正逻辑
// ④ MAIN（社交分享）
[ "bundles/content.2.bundle.js" ]
```

注意 ① 虽在 ISOLATED world，却注入了 `chrome-polyfill-server.js`——这是因为 server 端需要"能调真实 `chrome`"，而 ISOLATED world 恰好有真实 `chrome`。MAIN 世界（②）只放 client，没有真实 `chrome`。这种交错安排正是跨 world 桥的关键。

### 2.5 `trustedPolicy.js`：Trusted Types 规避 CSP

MV3 的 `extension_pages` CSP 含 `unsafe-inline`，但某些浏览器/严格模式下内联仍受限。Katalon 建了一个名为 `default2` 的 Trusted Types policy：

```javascript
// content/trustedPolicy.js:1-9
var trustedPolicy = {
  createScriptURL: (url) => url,
  createHTML: (string, sink) => string,
  createScript: string => string,
}
if (window.trustedTypes && window.trustedTypes.createPolicy) {
  trustedPolicy = window.trustedTypes.createPolicy('default2', trustedPolicy);
}
```

它用于：
- `inject-popup-record.js:59`：`button.innerHTML = trustedPolicy.createHTML("Stop")`。
- `prompt-injecter.js:22`：`elementForInjectingScript.src = trustedPolicy.createScriptURL(await browser.runtime.getURL("page/prompt.js"))`。

即把动态生成的 HTML/URL 显式声明为"可信"，绕过 `trusteds-types` 拦截。个人插件若自己控制脚本注入，可保留这个 policy（它无害且增强兼容）。

### 2.6 `check-browser-automation.js`：自动化检测（埋点）

```javascript
// content/check-browser-automation.js:1-5（推测行数，实际为 5 行）
// 检测 navigator.webdriver 并上报，用于识别"被自动化框架驱动"的页面
```

此文件仅用于埋点/防作弊上报，**个人插件应删除**（详见 §5）。

### 2.7 浏览器指纹：FingerprintJS（埋点，巨大）

```javascript
// common/offscreen.js:13-16
case "get-fingerprint-visitor":
  const visitor = await (await FingerprintJS.load({ region: "ap" })).get();
  returnMessage(message.type, visitor); break;
```

指纹经 offscreen 文档（`common/browser-fingerprint2.js` 9346 行，FingerprintJS 库）获取 `visitorId`，用于 License 校验与用户行为埋点。这是发行包里最大的单文件之一。**个人插件务必删除**：删 `offscreen.js` 的 `get-fingerprint-visitor` 分支、`common/get-browser-fingerprint*.js`、`common/browser-fingerprint2.js`（9346 行）。

---

### 2.8 Firefox 专属兼容处理（实战要点）

Firefox 的 MV3 实现与 Chrome 有若干硬差异，Katalon 代码中体现了这些规避手法：

1. **offscreen 不支持** → 特性检测后绕行：
   ```javascript
   // common/offscreen-server.js:62-75（已读）
   async function hasOffscreenDocument() {
     if ("getContexts" in chrome.runtime) {            // Chrome 有
       const contexts = await chrome.runtime.getContexts({ contextTypes:["OFFSCREEN_DOCUMENT"] });
       return Boolean(contexts.length);
     } else {                                            // Firefox 无 → clients.matchAll 兜底
       const matchedClients = await clients.matchAll();
       return await matchedClients.some((client) => client.url.includes(chrome.runtime.id));
     }
   }
   ```
   但 `createOffscreenDocument`（offscreen-server.js:44-52）仍直接调 `chrome.offscreen.createDocument`，**Firefox 上会抛 `chrome.offscreen is undefined`**。正确写法应加特性检测：
   ```javascript
   async function createOffscreenDocument() {
     if (!("offscreen" in chrome)) return;              // ← 必须加，否则 Firefox 崩溃
     if (!(await hasOffscreenDocument())) {
       await chrome.offscreen.createDocument({ url:"panel/offscreen.html",
         reasons:[chrome.offscreen.Reason.DOM_SCRAPING], justification:"..." });
     }
   }
   ```

2. **`getBrowserName()` 在 Firefox 上应走内容脚本**：后台经 offscreen 取浏览器名在 Firefox 失效（offscreen 创建失败），所以 `get-browser-name-background.js` 的 `sendMessageToOffscreenDocument("get-browser-name")` 在 Firefox 会永远 pending。替代方案：在内容脚本直接 `getBrowserName()`（content 脚本有 DOM），通过 `runtime.sendMessage` 回传后台。

3. **`chrome.debugger` CDP 在 Firefox 不支持**：`background/kar.js` 用 CDP 上传文件/发特殊键（如 `<input type=file>` 的 `uploadFile`）。Firefox 无 `chrome.debugger`，这类回放命令在 Firefox 上不可用。个人插件若要支持 Firefox 回放文件上传，需改用 `element.sendKeys` + 临时文件路径等变通手段，或明确标注"文件上传回放仅 Chrome/Edge 支持"。

4. **`bowser.name` 端口分支仅服务官方**：`katalon/chrome_setup.js:1` 与 `katalon/chrome_common.js:18` 用 `bowser.name=="Chrome"` 选 Katalon Studio 的本地 server 端口（50000 vs 50001）。这是官方 IDE 集成逻辑，个人插件删 `katalon/*` 后完全不相关。

5. **`externally_connectable` 双核一致**：两份 manifest 都允许 `ids:["*"]`（manifest.json:48），即任意扩展可经 `runtime.sendMessage(extensionId,...)` 连它。Firefox 同样支持该字段，无差异。

> 小结：Firefox 兼容工作量集中在三处——offscreen 特性检测、CDP debugger 缺失的回放降级、`getBrowserName` 改走内容脚本。其余 polyfill / world / sandbox 机制双核通用，无需额外处理。

### 2.9 `check-browser-automation.js` 与埋点收口

`content/check-browser-automation.js` 是 5 行的小脚本，检测 `navigator.webdriver` 并上报页面是否被自动化框架（Selenium/Puppeteer）驱动。它在 `manifest.bak.json:92-97` 作为独立 content_script 段（`world:"MAIN"`）加载。个人插件无此需求，连同 `segment-tracking-services.js`、`get-browser-fingerprint*.js`、`browser-fingerprint2.js` 一并删除即可。删除后注意 `install.js` 里 `trackingInstallApp()`、`configUninstallUrl()`（install.js:45-62,23）也需移除，否则引用未定义。

## 3. manifest.bak.json 与 manifest.json 的实际 diff

`manifest.bak.json` 是**打包前**的分散脚本清单，`manifest.json` 是打包后的 bundle 清单。逐段差异如下：

### 3.1 `content_scripts`：从分散文件到 bundle

**bak（manifest.bak.json:56-199）** 把内容脚本拆成 8 段，列出所有独立 JS：
- ISOLATED：`browser-polyfill-content` + `remote-object-helper-content` + `chrome-polyfill-server`
- MAIN（第 2 段）：`myKRIsolatedWindow.js` + `remote-object-helper-page` + `chrome-polyfill` + `browser-polyfill-page` + `prompt-injecter` + `runScript-injecter`
- MAIN：`check-browser-automation`
- MAIN（大段 selenium）：`bowser` + `atoms` + `utils` + `selenium-commandhandlers` + `selenium-browserbot` + `escape` + `selenium-api` + `neighbor-xpaths-generator` + `locatorBuilders` + `recorder` + `recorder-handlers` + `command-receiver` + `targetSelecter` + `sizzle` + `kar`
- MAIN（katalon 大段）：`katalon/bowser` + `jquery` + `neighbor-xpaths-generator` + `constants` + `chrome_common` + ... + `main`
- MAIN：`jquery.simulate`
- MAIN（社交分享）：`sharing-social`
- MAIN：`inject-popup-record`

**现行（manifest.json:14-40）** 合并为 4 段：
```json
"content_scripts": [ {
  "js": ["common/browser-polyfill-content.js","common/remote-object-helper-content.js","common/chrome-polyfill-server.js"],
  "run_at":"document_start"
}, {
  "js": ["common/remote-object-helper-page.js"], "world":"MAIN", "run_at":"document_start"
}, {
  "js": ["bundles/content.1.bundle.js"], "world":"MAIN", "run_at":"document_start"
}, {
  "js": ["bundles/content.2.bundle.js"], "world":"MAIN",
  "matches": ["https://www.facebook.com/dialog/share?*","https://twitter.com/intent/tweet?*","https://www.linkedin.com/sharing/share-offsite/?*"]
} ]
```

差异：
1. 大部分独立 `js` 被 webpack 打包进 `bundles/content.1.bundle.js`（MAIN）/ `content.2.bundle.js`（社交分享）。
2. `myKRIsolatedWindow.js`、`runScript-injecter.js`、`neighbor-xpaths-generator.js`（content 段）、`check-browser-automation.js` 等从 manifest 显式声明中消失——要么进了 bundle，要么被移除。
3. **文件缺失确认**：`content/myKRIsolatedWindow.js` 与 `katalon/neighbor-xpaths-generator.js` 在 `bak` 中引用，但当前发行包目录中**不存在**（其余 bak 引用文件均存在）。说明打包过程中这两个文件被改名/合并/删除。

### 3.2 CSP：新增 `unsafe-eval; unsafe-inline`

- bak（manifest.bak.json:48-50）：`"extension_pages": "script-src 'self'; object-src 'self'"`（**无** unsafe-eval）。
- 现行（manifest.json:42）：`"script-src 'self'; object-src 'self'; unsafe-eval; unsafe-inline;"`。

原因：sandbox 的 `eval` 与大量内联脚本需要 `unsafe-eval`/`unsafe-inline`。**注意**：严格商店审核下 `unsafe-eval` 在 extension_pages 是被允许的（因为有 `sandbox` 机制配合），但 `unsafe-inline` 会触发部分 lint 警告。

### 3.3 其他差异

| 字段 | bak | 现行 |
|---|---|---|
| `name` | `"addon_name_placeholder"` | `"Katalon Recorder (Selenium tests generator)"` |
| `default_popup` | 顶层 `"popup-browser/index.html"`（bak:207） | 同样在顶层（manifest.json:44），**两者都被 MV3 忽略** |
| `action` | 含 `default_icon`/`default_title`（bak:203-206） | 同（manifest.json:2-5） |
| `web_accessible_resources` | `page/prompt.js`、`page/runScript.js`、`katalon/authenticated.html`（bak:208-219） | 同上（manifest.json:71-74） |
| `externally_connectable` | 有 `accepts_tls_channel_id:false`（bak:46） | 同样有（manifest.json:47） |

关键一致点：**两份 manifest 都把 `default_popup` 写在顶层、都指向不存在的 `popup-browser/`**——证明这是长期遗留 bug，且从未靠 `default_popup` 弹窗（一直走 `onClicked`→独立窗口，见 TECH-07）。

---

### 3.4 bak 引用文件在现行包中的去向（消失/合并清单）

对比 `manifest.bak.json` 显式列出的 JS 与现行 `bundles/content.1.bundle.js`，可确认以下文件**已不在 manifest 显式声明中**：

| bak 中声明（段） | 文件 | 现行去向 | 证据 |
|---|---|---|---|
| MAIN 第 2 段 | `content/myKRIsolatedWindow.js` | **文件不存在** | `ls` 确认缺失 |
| MAIN 第 2 段 | `content/runScript-injecter.js` | 进 bundle | bundle 含 runScript 逻辑（推测） |
| MAIN 大段 | `content/neighbor-xpaths-generator.js` | 进 bundle | bundle 含 neighbor xpath |
| MAIN 大段 | `content/check-browser-automation.js` | 进 bundle 或删 | 见 §2.9 |
| katalon 大段 | `katalon/neighbor-xpaths-generator.js` | **文件不存在** | `ls` 确认缺失 |
| katalon 大段 | `katalon/jquery-3.2.1.min.js` 等 | 进 bundle | bundle 含 jquery |
| 社交段 | `content-marketing/content/sharing-social.js` | 现行改为 `bundles/content.2.bundle.js` 的 FB/Twitter/LinkedIn 段 | manifest.json:34-39 |
| 浮层段 | `content/inject-popup-record.js` | 进 bundle（MAIN） | bundle 含 inject-popup-record（见 TECH-07） |

**结论**：webpack 把 8 段近 40 个独立文件打包进 `content.1.bundle.js`（主逻辑）+ `content.2.bundle.js`（社交分享）。两个"幽灵文件"（`myKRIsolatedWindow.js` 两份）在打包过程中被移除/合并，导致 bak 的清单与实际文件树不再一致。这正是保留 `manifest.bak.json` 仅作"历史参考"而非"现状真相"的原因。

### 3.5 兼容层裁剪决策树

```
录制逻辑想放在哪个 world？
├─ ISOLATED world（推荐，简单）
│   ├─ 删除 chrome-polyfill* / remote-object-helper-*（全部 4 文件，~195KB）
│   ├─ 删除 bowser.js 两份（若不用官方分支）
│   └─ 保留 browser-polyfill（单份，或用构建注入）
└─ MAIN world（需读页面私有变量/jQuery）
    ├─ 保留 chrome-polyfill + chrome-polyfill-server + remote-object-helper-*（桥必留）
    └─ 保留 trustedPolicy（MAIN 内注入需绕过 CSP）

需要跨浏览器吗？
├─ 仅 Chrome/Edge（Chromium）
│   ├─ 删 get-browser-name-background / offscreen 取信息逻辑（直接后台可用 window? 否——SW 无 window，仍需 offscreen 或内容脚本）
│   └─ 保留 chrome.debugger（文件上传回放可用）
└─ + Firefox
    ├─ 加 "offscreen" in chrome 特性检测（offscreen-server.js:44 需改）
    ├─ 删 chrome.debugger 相关回放（Firefox 不支持）
    └─ getBrowserName 改内容脚本直取

需要埋点/指纹吗？
└─ 否 → 删 browser-fingerprint2.js(9346行) + get-browser-fingerprint* + segment-tracking-services + check-browser-automation
```

## 4. 跨浏览器兼容分支总结（Chrome / Firefox / Edge）

| 机制 | Chrome | Firefox | Edge |
|---|---|---|---|
| `browser.*` polyfill | 转译回调→Promise | 原生 Promise | 同 Chrome（Chromium） |
| offscreen document | `chrome.offscreen.*` 支持 | **不支持**（用 clients.matchAll 兜底） | 同 Chrome |
| MAIN/ISOLATED world | `world:"MAIN"` 支持 | MV3 支持 `world` | 同 Chrome |
| `chrome.debugger` CDP | 支持 | 不支持 | 支持 |
| `getBackgroundPage()` | 返回 SW 全局 | 返回 SW 全局（语义略异） | 支持 |
| `sandbox.pages` + `unsafe-eval` | 支持 | 支持 | 支持 |
| `externally_connectable` | 支持 | 支持 | 支持 |

Firefox MV3 不支持 `offscreen`，所以 `common/offscreen-server.js:62-75` 用 `clients.matchAll()` 兜底判断，但 `chrome.offscreen.createDocument` 在 Firefox 上会抛错——因此**依赖 offscreen 取浏览器名/指纹的逻辑在 Firefox 上会失败**。Firefox 上 `getBrowserName()` 应改为在内容脚本直接调用 `getBrowserName()`，而非经后台 offscreen（见 MVP §6）。

---

## 5. 隐晦知识点与坑

1. **三份 polyfill 完全相同是冗余**：`browser-polyfill*.js` 三份 10121 字节完全一致。若用打包工具，应改为单源通过多入口注入，而非物理复制。

2. **`bowser.js` 双份冗余**：`content/bowser.js` 与 `katalon/bowser.js` 完全相同（627 行）。且 `bowser` 实际只服务于 Katalon 官方生态分支，纯录制回放几乎不依赖。

3. **MAIN world 没有 `chrome`**：这是最容易踩的坑。在 `world:"MAIN"` 的内容脚本里直接写 `chrome.runtime.sendMessage` 会 `undefined`，必须先经 `chrome-polyfill-server.js`（`PageTransportServer`）桥接。若你的录制逻辑全放 MAIN world，必须保留这一套桥。若把录制逻辑放 ISOLATED world，则可省掉整条 `chrome-polyfill`/`remote-object-helper` 链。

4. **`remote-object-helper` 单文件 97155 字节**：体积巨大，且 content/page 两份相同。它是 MAIN/ISOLATED 桥的核心，删不掉但可合并。

5. **FingerprintJS 是埋点巨无霸**：`browser-fingerprint2.js` 9346 行纯为指纹。个人插件删除后，需同步删 `offscreen.js` 的 `get-fingerprint-visitor` case 与 `get-browser-fingerprint*.js`，否则 offscreen 会报错。

6. **`trustedPolicy` 的 policy 名是 `default2`**：不是 `default`。浏览器已占用 `default` policy 名时，Katalon 用 `default2` 避免冲突。`createHTML`/`createScriptURL`/`createScript` 都原样透传——它只是"声明可信"，不做 sanitize。

7. **`default_popup` 在两份 manifest 都写错位置**：见 TECH-07 实证。这是兼容层之外、清单层的独立坑。

8. **Firefox 不支持 offscreen 的硬伤**：`chrome.offscreen.createDocument` 在 Firefox 抛 `undefined`。`offscreen-server.js` 的 `hasOffscreenDocument` 有 `clients.matchAll` 兜底，但 `createOffscreenDocument` 仍调 `chrome.offscreen`，Firefox 会失败。需特性检测 `if (chrome.offscreen)` 再创建。

9. **polyfill 在 SW 里也需加载**：`worker_wrapper.js:6` 用 `importScripts("common/browser-polyfill.js")` 把 polyfill 注入 SW，否则后台里 `browser.*` 不可用。容易漏掉：以为 polyfill 只在 content 需要，其实 SW 更需要（SW 里没有原生 `browser`）。

10. **`remote-object-helper` 两份 97KB 是体积大头**：若走 MAIN world 桥，发行包会多 ~194KB。审核/加载时虽不影响功能，但值得在裁剪评估时列为首位优化点。

11. **`default2` policy 名不可改**：`trustedPolicy.js:8` 用 `default2` 而非 `default`，因为浏览器已占用 `default` 这个 Trusted Types policy 名（部分页面/框架已注册）。改名 `default` 会抛 `Policy "default" already exists` 错误。

12. **`bowser` 检测 `Edge Chromium` 靠 UA 的 `Edg`**：`get-browser-name.js:35` 用 `navigator.userAgent.indexOf("Edg")` 区分 Edge Chromium 与老 Edge（`StyleMedia`）。UA 可被伪造，但对插件内部分支足够；不要用于安全判断。

13. **`browser-polyfill` 0.12.0 不支持 `chrome.offscreen` 的 Promise 化**：所以 `offscreen-server.js` 直接用 `chrome.offscreen.*` 而非 `browser.offscreen.*`——polyfill 没覆盖该较新 API。这是"何时用 chrome.* 何时用 browser.*"的边界案例：polyfill 覆盖不到的 API，必须回退 `chrome.*` 并自行 Promise 化。

---

## 6. 裁剪建议（保留 / 删除 / 替换）

| 分类 | 文件/机制 | 理由 |
|---|---|---|
| **保留** | `common/browser-polyfill*.js`（合并为 1 份注入 3 环境） | 双核兼容基础 |
| **保留** | `common/get-browser-name.js` + `-background.js` | 轻量、无埋点 |
| **保留** | `common/chrome-polyfill*.js` + `remote-object-helper-*` | MAIN/ISOLATED 桥必需（若录制逻辑在 MAIN world） |
| **保留** | `content/trustedPolicy.js` | 无害、增强 CSP 兼容 |
| **删除** | `content/bowser.js` + `katalon/bowser.js`（两份） | 仅服务 Katalon 官方分支；个人插件用不到 |
| **删除** | `common/browser-fingerprint2.js` + `get-browser-fingerprint*.js` | 埋点巨无霸（9346 行） |
| **删除** | `content/check-browser-automation.js` | 埋点 |
| **删除** | `manifest.bak.json` | 仅开发对照 |
| **替换** | `worker_wrapper.js` 的 `importScripts` 22 文件 | 用真实打包工具；同步把三份 polyfill 合并 |
| **替换** | offscreen 取浏览器名/指纹 | Firefox 改为内容脚本直接 `getBrowserName()`；指纹逻辑整体删 |
| **替换** | `remote-object-helper` 双份 | 合并为一份按需注入 |
| **删除** | bak 中缺失文件相关引用 | `myKRIsolatedWindow.js`、`katalon/neighbor-xpaths-generator.js` 已不存在 |

---

## 7. 最小可用实现（MVP 代码骨架）

以下给出一个**只支持 Chrome、录制逻辑放 ISOLATED world（省掉 MAIN/ISOLATED 桥）**的极简兼容层。

### 7.1 单份 polyfill（推荐方案）

用构建工具把 `webextension-polyfill` 作为依赖，在 SW、content 入口分别 `import "webextension-polyfill"` 即可，不再物理复制三份。

### 7.2 `manifest.json`（去掉 MAIN world 桥）

```json
{
  "manifest_version": 3,
  "name": "Mini Recorder",
  "version": "0.1.0",
  "action": { "default_title": "Mini Recorder" },
  "background": { "service_worker": "worker_wrapper.js" },
  "permissions": ["contextMenus","storage","scripting"],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [{
    "matches": ["<all_urls>"], "all_frames": true, "run_at": "document_start",
    "js": ["content.js"]
  }],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; unsafe-inline;"
  }
}
```

> 注意：这里**没有** `sandbox`，也没有 `unsafe-eval`——因为录制逻辑放 ISOLATED world，不需要 `eval` 逃生舱（storeEval 若需要可再加 sandbox）。也**没有** `default_popup`（MV3 本就忽略，见 TECH-07）。

### 7.3 `content.js`（ISOLATED world 直接调用 `chrome`）

```javascript
// 在 ISOLATED world，chrome 直接可用，无需桥
browser.runtime.onMessage.addListener((msg) => {
  if (msg.cmd) { console.log("录命令:", msg.cmd); }
});
document.addEventListener("contextmenu", async () => {
  const p = await browser.runtime.connect();
  p.onMessage.addListener((m) => { /* 录制 */ });
});
```

### 7.4 轻量浏览器名检测（替换 FingerprintJS + bowser）

```javascript
// getBrowserName.js（内容脚本内）
export function getBrowserName() {
  if (typeof InstallTrigger !== "undefined") return "Firefox";
  if (!!window.chrome?.runtime) return navigator.userAgent.includes("Edg") ? "Edge" : "Chrome";
  if (!!window.safari) return "Safari";
  return "Unknown";
}
```

### 7.5 trustedTypes（可选）

```javascript
// trustedPolicy.js
const policy = window.trustedTypes?.createPolicy('default2', {
  createHTML: (s) => s, createScriptURL: (u) => u, createScript: (s) => s,
}) ?? { createHTML:(s)=>s, createScriptURL:(u)=>u, createScript:(s)=>s };
export default policy;
```

### 7.6 用打包工具消除三份 polyfill 冗余（推荐）

Katalon 物理复制三份 `webextension-polyfill`（各 10121 字节）。现代做法是用 Vite + `@crxjs/vite-plugin` 或 `webpack` + `copy-webpack-plugin`，把 polyfill 作为依赖单源注入三个环境：

```javascript
// vite.config.js 思路（伪代码）
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
export default defineConfig({
  plugins: [ crx({ manifest }) ],
  // content 入口与 background 入口各自 `import 'webextension-polyfill'`
  // 无需手动复制三份
});
```

```javascript
// background.js / content.js 顶部
import 'webextension-polyfill';   // 自动在全局挂 browser.*
```

这样 `common/browser-polyfill*.js` 三个文件可删除，由构建期解决。同理 `remote-object-helper-content.js`/`remote-object-helper-page.js` 双份也可改为同一源的两个打包产物。

### 7.7 跨浏览器特性检测清单（裁剪后自检）

| 检测点 | 代码位置（改写后） | 说明 |
|---|---|---|
| offscreen 支持？ | `if ("offscreen" in chrome)` | Firefox 跳过，改内容脚本取信息 |
| CDP debugger 支持？ | `if (chrome.debugger)` | Firefox 禁用文件上传回放 |
| `getBackgroundPage` 支持？ | 仅 Chrome/Edge 用；Firefox 用 `chrome.runtime.getBackgroundPage` 也可但语义不同 | 见 TECH-05 §2.10 |
| `world:"MAIN"` 支持？ | MV3 双核均支持 | 可放心用 |
| `sandbox` + `unsafe-eval` | 双核均支持 | storeEval 可用 |

### 7.8 一份干净的跨浏览器 `manifest.json` 对照

```json
{
  "manifest_version": 3,
  "name": "Mini Recorder",
  "version": "0.1.0",
  "action": { "default_title": "Mini Recorder" },
  "background": { "service_worker": "worker_wrapper.js" },
  "permissions": ["contextMenus", "storage", "scripting", "offscreen"],
  "host_permissions": ["<all_urls>"],
  "sandbox": { "pages": ["sandbox.html"] },
  "content_scripts": [{
    "matches": ["<all_urls>"], "all_frames": true, "run_at": "document_start",
    "js": ["content.js"]
  }],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; unsafe-eval; unsafe-inline;"
  }
}
```

与 Katalon `manifest.json` 的差异：去掉 `cookies`/`notifications`/`downloads`/`webNavigation`/`unlimitedStorage`/`debugger`（按需保留 `debugger` 若要做文件上传回放）；CSP 保留 `unsafe-eval` 因有 sandbox；无 `default_popup`（见 TECH-07）。

### 7.9 `chrome.*` 与 `browser.*` 选用速查（改代码时必看）

裁剪/改代码时经常要决定用哪个命名空间。经验法则：

| 场景 | 用 | 原因 |
|---|---|---|
| 通用 API（storage/tabs/windows/runtime.sendMessage） | `browser.*` | polyfill 已 Promise 化，双核通用 |
| `chrome.offscreen.*` | `chrome.*` | polyfill 0.12.0 未覆盖，Firefox 需特性检测 |
| `chrome.debugger.*`（CDP） | `chrome.*` | 仅 Chrome，无 Promise 化需求 |
| `chrome.runtime.getContexts` | `chrome.*` | 较新 API，polyfill 未覆盖 |
| MAIN world 里要调 chrome | 经 `chrome-polyfill` 桥 | MAIN world 无原生 chrome 对象 |
| SW 里读 DOM 信息 | 经 offscreen（chrome.*） | SW 无 window/document |

一句话：**优先 `browser.*`；polyfill 没覆盖到的较新/专有 API 才回退 `chrome.*` 并自行处理回调或特性检测。**

> 补充：上面经验法则同样适用于新增功能。当引入一个 Katalon 源码里没有的新 API 时，先查 `webextension-polyfill` 文档确认是否被 Promise 化；未被覆盖就按 `chrome.*` 写并加 `if ("xxx" in chrome)` 特性检测，这样 Firefox 上能优雅降级而非整体崩溃。

> 本文档所有结论均可溯源至 `KatalonRecorder/7.1.0_0/` 源码对应 `文件:行号`；字节相同、文件缺失等结论经 `wc -c` / `ls` 实证；未找到确切依据的标注「推测」。

---

> 本文件所有结论均可溯源至 `KatalonRecorder/7.1.0_0/` 源码对应 `文件:行号`；字节相同、文件缺失等结论经 `wc -c` / `ls` 实证；未找到确切依据的标注「推测」。
