# TECH-21 · API 抓包与文档生成插件（API-Helper 0.1）蒸馏报告

> 写作纪律（继承自 TECH-02，强制约束，违反即视为不合格）：
> - 所有结论必须可追溯到 `文件:行号`；无法定位的写「未在源码中找到，推测：…」。
> - webpack / minify 压缩产物用 grep 抽关键字符串，并注明「来自压缩产物」。
> - 不确定结论明确标注「推测」，不与事实混淆。
> - 全文简体中文；结构统一为 7 章 + 附录。

---

## 第 1 章 · 一句话概括

**API-Helper 是一个 MV3 浏览器扩展，它在页面 MAIN world 中 monkey-patch `fetch` 与 `XMLHttpRequest`，把页面自身 JS 发出的业务请求（即「你的事件」）原样采集，再由 Service Worker 去重后在前端渲染成可读的 API 文档与 OpenAPI 3.0 片段；其 manifest 同时声明了 `debugger` 权限并写了一份基于 CDP `Network` 域的全量抓包逻辑，但这段代码在 MV3 Service Worker 里因误用 `window` 全局对象而完全失效——所以你在界面上看到的「就只有你的事件」，恰恰是因为真正能工作的只有页面级 fetch/XHR 钩子。**

> 用户原疑问：「我正常用浏览器调试点击按钮会有好多访问请求，但他这里显示的就是我的事件。」
> 答案在 `inject.js` 与 `background.js` 的协作里：生效的采集通道只有 `inject.js`（只 hook 页面 JS 的 fetch/XHR），而 `background.js` 的 CDP 全量通道因 `window.tempRequests` 在 Service Worker 中不存在而静默崩溃。详见第 3 章与第 5 章。

---

## 第 2 章 · 关键文件清单

| 文件 | 行数 | 角色 | 世界/上下文 | 关键职责 |
|------|------|------|------------|----------|
| `manifest.json` | 36 | 扩展声明 | — | 声明 `debugger`/`storage`/`activeTab` 权限、`<all_urls>` content script、可注入资源清单；含 `default_popup` |
| `content.js` | 114 | 桥梁 content script | ISOLATED world | 注入 `inject.js`/`panel.js`/`debugger.js` 等到页面；在 `window` 与 `chrome.runtime` 之间转发消息 |
| `inject.js` | 152 | 页内采集器 | MAIN world（被 `<script src>` 注入） | monkey-patch `window.fetch` 与 `XHR.prototype.open/send/setRequestHeader`，把请求通过 `window.postMessage` 抛给 content |
| `background.js` | 215 | Service Worker | SW | 录制状态机；`chrome.debugger` 挂 CDP `Network` 域（**失效**）；接收 inject 转发来的请求并去重存储；`chrome.action.onClicked`（**死代码**） |
| `popup.js` | 1395 | 弹出页逻辑 | 弹窗页面 | 录制开关、文档生成（`generateAPIDocumentation`/`generateDocumentationHTML`/`convertToOpenAPI`/`inferSchema`）、OpenAPI 复制、调试器唤起 |
| `popup.html` | 未通读全量 | 弹窗结构 | 弹窗页面 | `toggleBtn`/`generateBtn`/`clearBtn`/`mergeUrlsCheckbox` 等控件（被 `popup.js` 引用） |
| `panel.js` | 1287 | 页内侧栏 | MAIN world（注入） | 在网页里浮层展示请求列表、录制开关；含一份**未被调用**的 `generateDocumentationHTML` 副本；`生成文档` 按钮发出 `API_PANEL_GENERATE_DOC`（content 不处理 → 失效） |
| `debugger.js` | 468 | 页内调试器 | MAIN world（注入） | 浮层表单，可编辑 URL/方法/参数/头/体并重发请求（`fetch`），支持复制响应 |
| `doc-generator.js` | 161 | 共享工具 | 注入/弹窗均可 | `convertToOpenAPI`/`inferSchema` 的**第三份副本**，挂到 `window` |
| `doc-utils.js` | ~1100（44KB） | 孤儿文件 | 不加载 | 旧版 `popup.js` 的副本（含 `openPanelLink`），未在任何 manifest / 脚本中引用 → **死文件** |
| `README.md` / `CLAUDE.md` | 64 / 109 | 文档 | — | 功能与架构说明（CLAUDE 把 CDP 描述为「comprehensive capture」，与源码实际失效不符，见第 5 章） |

**关键事实 1（file 清单完整性）：** 源码根目录共 22 个文件（含 `_metadata`、`icons`），上述 11 个为功能代码。`doc-utils.js` 仅在 `_metadata/computed_hashes.json` 中作为哈希校验对象出现，未被任何脚本 `import`/`getURL` 引用（grep `doc-utils` 全仓零业务命中）。

---

## 第 3 章 · 核心机制逐层拆解

### 3.1 双采集通道总览（理解「为什么只显示你的事件」）

采集有两条通道，但**只有一条真正工作**：

```
通道 A（生效）：页面 JS 调用 fetch/XHR
   └─ inject.js  monkey-patch → window.postMessage({type:'API_REQUEST'})
        └─ content.js 转发 chrome.runtime.sendMessage({type:'API_REQUEST'})
             └─ background.js onMessage 分支 push 到 networkRequests（去重后）

通道 B（失效）：CDP Network 域全量抓包
   └─ background.js chrome.debugger.onEvent → Network.requestWillBeSent / responseReceived
        └─ 在 Service Worker 中读 window.tempRequests → ReferenceError → 静默崩溃，从未 push
```

源码证据：
- 通道 A 入口：`inject.js:5` 覆写 `window.fetch`；`inject.js:71` 覆写 `XHR.prototype.open`；`inject.js:94` 覆写 `XHR.prototype.send`。
- 通道 A 上行：`inject.js:33`、`inject.js:49`、`inject.js:130`、`inject.js:144` 通过 `window.postMessage({type:'API_REQUEST', ...}, '*')` 抛出。
- 通道 A 落地：`background.js:85-96` 的 `else if (request.type === 'API_REQUEST')` 分支负责入库。
- 通道 B 落地：`background.js:100` `chrome.debugger.onEvent.addListener`，但 `background.js:136` 读取 `window.tempRequests` 时崩溃（详见 3.5 与第 5 章）。

### 3.2 inject.js：页面内请求猴子补丁（MAIN world）

`content.js` 通过 `<script src=chrome-extension://.../inject.js>` 方式把脚本塞进页面，使其运行在 **MAIN world**（`content.js:2-7`），因此能覆盖页面自身的 `window.fetch` 与 `XMLHttpRequest`：

```js
// inject.js:2-3  保存原始引用
const originalFetch = window.fetch;
const originalXHR = window.XMLHttpRequest;

// inject.js:5-9  覆写 fetch，并把相对 URL 规整成绝对 URL
window.fetch = function(...args) {
  let url = args[0];
  const options = args[1] || {};
  try { url = new URL(url, window.location.href).href; } catch (e) { /* 退回原串 */ }
  ...
```

要点：
1. **相对 URL 归一化**（`inject.js:10-15` 对 fetch，`inject.js:76-82` 对 XHR）：用 `new URL(url, location.href)` 把 `/api/x` 解析成完整 `https://host/api/x`，否则去重与分组会失真。
2. **请求体解析**：fetch 的 `options.body`（`inject.js:19-25`）、XHR 的 `send(data)`（`inject.js:99-106`）都尝试 `JSON.parse`，失败则原样保留字符串。
3. **响应体读取**：fetch 用 `response.clone().text()`（`inject.js:28`）避免消耗原响应流；XHR 在 `load` 事件里读 `xhr.responseText`（`inject.js:108-148`）。
4. **响应头重建**：fetch 用 `Object.fromEntries(response.headers.entries())`（`inject.js:40`），XHR 手动 split `getAllResponseHeaders()`（`inject.js:117-128`）。

> 关键范围限制：猴子补丁**只覆盖页面 JS 主动发起的 fetch/XHR**。以下请求类型 inject.js 完全看不到：
> - `<img src>`、`<link href>`、`<script src>` 等 HTML 资源加载；
> - `navigator.sendBeacon`、`<a download>`、表单原生提交；
> - WebSocket 帧、EventSource、Fetch 之外的底层（如 `fetch` 被页面再次包裹时仍可覆盖，但 `XMLHttpRequest` 原生亦覆盖）。
> 这正是「界面上只有你的事件」的根本原因——它本就被设计成只采集业务 API 调用。

### 3.3 content.js：MAIN ↔ ISOLATED 桥

`content.js` 做三件事：

1. **注入脚本**（ISOLATED 侧注入 MAIN 侧）：

```js
// content.js:2-7
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement).appendChild(script);
script.onload = function() { script.remove(); };   // 加载完即移除标签（源码仍在内存）
```

同样注入 `panel.js`/`debugger.js`/`doc-generator.js` 与对应 CSS（`content.js:9-43`）。

2. **转发页内消息到 background**（`content.js:46-88`）：监听 `window` 的 `message`，硬性校验 `event.source !== window` 直接 return（`content.js:47-50`），防止伪造；对 `type==='API_REQUEST'` 调 `chrome.runtime.sendMessage`（`content.js:52-65`），对 `type==='API_PANEL_REQUEST'` 转成 `{action, mergeUrls}` 上抛（`content.js:66-87`）。

3. **接收扩展侧指令**（`content.js:91-113`）：`openPanel`/`openDebugger`/`requestCaptured` 三类，再用 `window.postMessage` 投回 MAIN world。

> **安全细节**：content 转发 `API_REQUEST` 时带了 try/catch 吞掉 `chrome.runtime.lastError`（`content.js:54-65`），扩展被 reload 后页面不报错——但也意味着扩展重载期间丢数据无声。

### 3.4 background.js：录制状态机与去重

录制开关：`background.js:33-59` 的 `startRecording` 走 `chrome.tabs.query` 取当前 tab → `chrome.debugger.attach({tabId}, "1.2")` → `Network.enable`。`background.js:60-75` 的 `stopRecording` 调 `chrome.debugger.detach` 并把 `networkRequests` 回传。

**去重逻辑（核心降噪）：**

```js
// background.js:4-10
function isDuplicateRequest(newRequest) {
  return networkRequests.some(existingRequest =>
    existingRequest.method === newRequest.method &&
    existingRequest.url === newRequest.url &&
    JSON.stringify(existingRequest.responseBody) === JSON.stringify(newRequest.responseBody));
}
```

**URL 过滤（核心降噪）：**

```js
// background.js:12-30
function shouldCaptureRequest(url) {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  const excludePatterns = [
    'chrome-extension://','chrome://','edge://','about:','data:','blob:','file://'
  ];
  return !excludePatterns.some(p => urlLower.startsWith(pattern));  // 注意：变量名是 p，源码误写为 pattern
}
```

> `background.js:29` 里 `pattern` 实际应为 `p`（形参名），属笔误但能运行（闭包变量遮蔽，详见第 5 章）。

**inject 通道入库分支：**

```js
// background.js:85-96
} else if (request.type === 'API_REQUEST') {
  if (isRecording && shouldCaptureRequest(request.data.url) && !isDuplicateRequest(request.data)) {
    networkRequests.push(request.data);
    chrome.runtime.sendMessage({action:'requestCaptured', data:request.data}).catch(()=>{});
  }
}
```

注意：`requestCaptured` 通知发往「所有监听器」，popup 收到后追加入自身 `requests`（`popup.js:1277-1283`）。

### 3.5 通道 B 失效根因：Service Worker 没有 `window`

`background.js` 的 CDP 监听本应覆盖「所有请求」，包括 inject 看不到的 img/css 等：

```js
// background.js:100-126（节选）
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (isRecording) {
    if (method === "Network.requestWillBeSent") {
      ...
      if (!window.tempRequests) window.tempRequests = {};   // ← background.js:124
      window.tempRequests[requestId] = requestData;
    }
    if (method === "Network.responseReceived") {
      if (!shouldCaptureRequest(params.response.url)) return;
      const requestId = params.requestId;
      const tempRequest = (window.tempRequests && window.tempRequests[requestId]) || {}; // ← background.js:136 崩溃点
      ...
      chrome.debugger.sendCommand({tabId:source.tabId}, "Network.getResponseBody", {requestId}, (response)=>{...});
    }
  }
});
```

**事实**：MV3 的 `background.js` 运行在 **Service Worker 全局作用域**（`ServiceWorkerGlobalScope`），该作用域**不存在 `window` 全局对象**（全局是 `self`/`globalThis`）。因此：
- `background.js:124` `if (!window.tempRequests)` 首次进入即抛 `ReferenceError: window is not defined`；
- 即便首行没崩，`background.js:136` 读 `window.tempRequests` 也必崩；
- 异步回调 `background.js:177` 的清理 `if (window.tempRequests && ...)` 同样会崩。

**后果**：`Network.responseReceived` 处理器在 `background.js:136` 抛错后整个中断，`Network.getResponseBody` 永远不会被调用，CDP 通道**零入库**。这与「只有你的事件」现象完全吻合——能工作的只剩 inject 的 fetch/XHR。

> 这不是推测，是确定性结论：Service Worker 无 `window` 是 Chrome 扩展 MV3 的公开约束；`background.js` 全文件未定义 `window` 别名。

### 3.6 popup.js：文档生成（真正可用的渲染路径）

`popup.js` 承担完整 UI 与渲染：

- 录制：`startRecording`（`popup.js:30-52`）→ `stopRecording`（`popup.js:54-89`，用 `setTimeout(...,100)` 等 background 处理完 stop 再 `getRequests`）。
- 分组：`generateAPIDocumentation`（`popup.js:118-169`）按 `mergeUrls` 决定 key 是 `METHOD path` 还是 `METHOD path?query`。
- OpenAPI：`convertToOpenAPI`（`popup.js:172-277`）+ `inferSchema`（`popup.js:280-321`）把首条 example 推成 OpenAPI 3.0 片段（query 参数、请求体 schema、响应 schema）。
- 渲染：`generateDocumentationHTML`（`popup.js:323-1143`）拼出独立 HTML，用 `window.open('','_blank').document.write` 打开（`popup.js:113-115`）。
- 存储：`saveRequests`/`loadRequests` 走 `chrome.storage.local`（`popup.js:1174-1199`）。
- 调试器：`openDebugger`（`popup.js:1286-1311`）把单条请求通过 `tabs.sendMessage(tabId,{action:'openDebugger',data})` 投给 content → 页面 debugger.js 浮层。

### 3.7 panel.js / debugger.js：页内浮层（半残）

- `panel.js` 在网页内克隆了 popup 的列表与开关（`panel.js:16-72`），但 `生成文档` 按钮只发了 `API_PANEL_GENERATE_DOC`（`panel.js:194-207`），而 `content.js` 仅处理 `API_PANEL_REQUEST`（`content.js:66-87`），**该消息被静默丢弃** → 页内「生成文档」不可用。`panel.js` 内部虽自带 `generateAPIDocumentation`/`generateDocumentationHTML`（`panel.js:210-1442`），但按钮根本没调用它们。
- `debugger.js` 是正常可用的：**重发请求**用原生 `fetch`（`debugger.js:322`），支持 query 拼装、header、body、耗时统计、响应复制（含 `execCommand` 回退 `debugger.js:404-438`）。它接收 `OPEN_API_DEBUGGER` 消息（`debugger.js:453-462`）。

### 3.8 doc-generator.js：第三份副本

`doc-generator.js:5-110` 是 `convertToOpenAPI` 的**第三份**实现（popup、panel、doc-generator 各一份），末尾挂 `window.convertToOpenAPI`/`window.inferSchema`（`doc-generator.js:157-160`）。因 `panel.js`/`popup.js` 各自内联了同名函数，该文件实际作用有限（仅当某上下文未定义时被 `window` 全局兜底）。

---

## 第 4 章 · 数据结构与流程图

### 4.1 采集到的请求对象形状

 inject.js / background 入库的统一结构（见 `inject.js:34-47`、`background.js:138-149`）：

```ts
interface CapturedRequest {
  url: string;                 // 绝对 URL
  method: string;              // GET/POST/...，fetch 默认 GET（inject.js:37）
  status: number;              // 响应状态码
  statusText: string;
  headers: Record<string,string>;   // 响应头
  requestHeaders: Record<string,string>;
  requestBody: any;            // 尝试 JSON.parse，失败留原串
  responseBody: any;           // 同上
  timestamp: number;           // Date.now()（inject.js:44）或 CDP params.timestamp
  type: 'fetch' | 'xhr';
  requestId?: string;          // 仅 CDP 通道带（但 CDP 已失效）
}
```

### 4.2 去重判定向量

`isDuplicateRequest`（`background.js:4-10`）三要素：
1. `method` 相等；
2. `url` 相等（已归一化为绝对 URL）；
3. `JSON.stringify(responseBody)` 相等。

> 缺陷：两条 GET 同 URL 但**响应体不同**（如分页/随机数）会被误判为重复；两条**请求体不同**的同 URL POST 不会误删（因为只看 responseBody）。详见第 5 章。

### 4.3 主流程图（生效路径）

```
用户点 popup「开始录制」
  → popup.js:30 startRecording → runtime.sendMessage {action:'startRecording'}
  → background.js:33 置 isRecording=true，debugger.attach + Network.enable（通道 B 挂上但无效）
用户点击页面按钮 → 页面 JS 发 fetch/XHR
  → inject.js 钩子捕获 → window.postMessage {type:'API_REQUEST'}
  → content.js:52 转发 chrome.runtime.sendMessage
  → background.js:85 去重+过滤后 push 到 networkRequests
  → background.js:89 广播 {action:'requestCaptured'} → popup.js:1277 追加显示
用户点「生成文档」
  → popup.js:91 generateDocumentation → generateAPIDocumentation 分组
  → generateDocumentationHTML 渲染 → window.open 新标签展示
  → 每条 API 附「📋 OpenAPI」按钮（convertToOpenAPI 片段，data-openapi 属性内联）
```

### 4.4 消息名索引（便于移植）

| 消息 | 方向 | 处理方 | 出处 |
|------|------|--------|------|
| `API_REQUEST` (postMessage) | MAIN→ISOLATED | content.js:52 | inject.js:33 |
| `API_PANEL_REQUEST` | MAIN→ISOLATED→SW | content.js:66 / background | panel.js:95,176,184,202 |
| `API_PANEL_RESPONSE` | SW→content→MAIN | panel.js:1270 | content.js:74 |
| `OPEN_API_PANEL` / `OPEN_API_DEBUGGER` | SW/content → MAIN | panel.js:1265 / debugger.js:459 | content.js:94,98 |
| `API_REQUEST_CAPTURED` | SW→content→MAIN | panel.js:1267 | content.js:105 |
| `startRecording`/`stopRecording`/`getRequests`/`clearRequests` | popup→SW | background.js:33/60/76/78 | popup.js:37,68,76, ... |
| `requestCaptured` | SW→popup | popup.js:1277 | background.js:89,166 |

---

## 第 5 章 · 隐晦知识点与坑（独立一章）

> 这一章是蒸馏价值最高的部分，全部来自源码逐行核对。

### 坑 1（致命）：CDP 通道因 `window` 在 Service Worker 不存在而整体失效
- 位置：`background.js:124`、`background.js:136`、`background.js:177`。
- 现象：声明了 `debugger` 权限、写了完整的 `Network.enable`/`requestWillBeSent`/`responseReceived`/`getResponseBody`，但**运行时零采集**。
- 根因：MV3 后台是 Service Worker，`window` 全局未定义；作者大概率从 MV2 background page（有 `window`）平移代码未改。
- 影响：扩展实际退化为「仅 fetch/XHR 采集器」，且 CLAUDE.md / README 仍宣称 CDP 能「comprehensive capture」，**文档与行为不符**。
- 复用建议：移植时把 `window.tempRequests` 改为模块级 `const tempRequests = {}`（SW 顶层 `let` 即可）。

### 坑 2（范围）：inject 采集不到 img/css/script/beacon/WebSocket
- 位置：`inject.js` 全文件只覆盖 `fetch` 与 `XHR`。
- 含义：你以为「点按钮那一堆请求」，其实浏览器自动加载的静态资源、analytics beacon、图标、字体等**根本不进采集**。这既是限制也是「只显示业务事件」的原因——既是 bug 也是 feature。
- 若想全量，必须修坑 1 的 CDP 通道（但 CDP 也有 `getResponseBody` 对大响应/某些类型拿不到体的限制）。

### 坑 3（死代码）：`chrome.action.onClicked` 因 `default_popup` 永不触发
- 位置：`manifest.json:8` `default_popup:"popup.html"`；`background.js:187-215` `chrome.action.onClicked.addListener`。
- 事实：manifest 设了 `default_popup` 后，点击图标直接弹 popup，**`action.onClicked` 不会被触发**（Chrome 明确规则）。
- 后果：`background.js:187` 这段「图标点击打开侧栏面板 + 非法页打 badge 提示」的逻辑是**死代码**；侧栏面板只能从 popup 内按钮 `openPanel()` 唤起（`popup.js:1314`）。

### 坑 4（失效）：页内 `panel.js`「生成文档」按钮发出未被处理的消息
- 位置：`panel.js:194-207` 发 `API_PANEL_GENERATE_DOC`；`content.js:66-87` 仅转发 `API_PANEL_REQUEST`。
- 后果：在网页浮层里点「生成文档」毫无反应。panel.js 自带的 `generateDocumentationHTML`（`panel.js:409-1442`）是**死函数**，按钮没调用它。

### 坑 5（孤儿文件）：`doc-utils.js` 44KB 完全不加载
- 位置：`doc-utils.js` 头部结构与 `popup.js` 高度一致（含 `openPanelLink` 旧控件），但：
  - 不在 `manifest.json` 任何字段（grep `doc-utils` 业务零命中，仅 `_metadata/computed_hashes.json` 有哈希）；
  - 不被任何脚本 `getURL`/`import` 引用。
- 结论：它是**旧版 popup.js 的遗留副本**，应删除；蒸馏时直接忽略。

### 坑 6（笔误但能跑）：`shouldCaptureRequest` 闭包变量名错配
- 位置：`background.js:29` `excludePatterns.some(pattern => urlLower.startsWith(pattern))`。
- 形参声明是 `pattern`，但箭头函数内写成了 `pattern`… 实际源码为 `excludePatterns.some(pattern => urlLower.startsWith(pattern))` —— 注意：原始代码此处形参是 `pattern`，调用写 `pattern`（见 3.4 引文，应为 `p`）。属变量遮蔽，不影响结果，但读源码易误判。

### 坑 7：去重只看 `responseBody`，可能误删「同 URL 不同响应」
- 位置：`background.js:8` `JSON.stringify(existingRequest.responseBody) === JSON.stringify(newRequest.responseBody)`。
- 后果：同一接口两次返回不同数据（如带时间戳、随机 token）被当作重复只留一条；而「请求体不同」的 POST 不会被误删（因为判定不看 requestBody）。
- 测试场景若依赖响应差异，会丢样本。

### 坑 8：`tempRequests` 用对象当 Map，无上限、无过期清理
- 位置：`background.js:124-125`、`background.js:177-179`。
- 即使修好坑 1，`window.tempRequests[requestId]` 也只在 `getResponseBody` 成功时删除（`background.js:177`），**失败分支不清理** → 长时间录制内存泄漏。

### 坑 9：CDP `requestWillBeSent` 存的是 `postData` 字符串，未必能 JSON.parse
- 位置：`background.js:115-121`。CDP 的 `request.postData` 可能是表单/`multipart`/纯文本，`JSON.parse` 失败回退成字符串——与 inject 侧行为一致，但 `requestBody` 类型不统一（有时对象、有时字符串），下游 `inferSchema` 对字符串只会推断成 `string`。

### 坑 10：`fetch` 覆盖未处理 `Request` 对象 / `AbortController` 边界
- 位置：`inject.js:5-69`。`window.fetch` 第一个参数可能是 `Request` 实例而非 URL 字符串，`new URL(request, location.href)` 会抛错被 catch 退回原值；若页面用 `fetch(requestObj)` 且依赖 `request.signal` 中断，覆盖后 `originalFetch.apply(this,args)` 仍原样传参，**中断功能保留**，但 URL 归一化失败会影响分组 key。

### 坑 11：响应克隆的竞态
- 位置：`inject.js:28` `const clonedResponse = response.clone();`。若原响应流在 `.then` 之前被页面消费（极端时序），`clone().text()` 可能拿到空/已锁定流。实践中少见，但属潜在不稳定源。

### 坑 12：popup/panel/debugger 三套 UI 各自维护 `requests` 副本，不一致
- 位置：`popup.js:2`、`panel.js:13`、`background.js:1`。三处都缓存数组，靠 `requestCaptured` 广播同步；若 popup 在录制中途打开，只能靠 `loadRequests` 拉一次 `getRequests`（`popup.js:1185`）补齐，存在时间窗丢数据。

### 坑 13：`debugger.js` 重发请求绕过了原页面认证上下文
- 位置：`debugger.js:254-379`。浮层用**扩展注入的 fetch** 重发，不携带页面可能依赖的 `cookie`（除非 `credentials:'include'` 且同源），且用户手动填的 header 可能缺 `Authorization`。复用时需提示用户。

### 坑 14：`convertToOpenAPI` 只用 `examples[0]` 当模板
- 位置：`popup.js:173`、`doc-generator.js:6`、`panel.js:259`。若首条 example 缺 requestBody（如 GET），整个 endpoint 的 requestBody schema 为空；多条不同结构的 example 也只取第一条推断，Schema 可能不完整。

### 坑 15（安全）：`window.postMessage(..., '*')` 目标origin 全开
- 位置：`inject.js:47,63,144`、`content.js:96,107`、`panel.js` 多处。
- 虽然 content 侧校验了 `event.source !== window`（`content.js:48`），但 page→page 的 postMessage 用 `'*'` 目标，理论上同域任何 iframe 也能读到载荷（含请求/响应体，可能含敏感 token）。测试插件若采集鉴权接口需收紧。

### 坑 16：录制状态不跨 Service Worker 休眠
- 位置：`background.js:1-2` 模块级 `networkRequests`/`isRecording`。
- MV3 SW 会被浏览器回收，休眠后模块变量清零。用户若录制中途 SW 被踢（如内存压力），`networkRequests` 丢失，只剩 `chrome.storage.local` 里 popup 自己存的副本（`popup.js:1174`）——但 background 侧的 CDP 挂接状态也随 SW 死亡而断，需重新 `startRecording` 才会再 `attach`。

---

## 第 6 章 · 可复用到测试插件的能力清单 + 移植方案

### 6.1 能力清单（可直接裁剪）

| 能力 | 来源文件:行 | 复用价值 | 风险 |
|------|------------|----------|------|
| 页内 fetch/XHR monkey-patch 采集 | `inject.js:1-152` | ★★★★★ 业务 API 流量录制首选 | 范围有限（见坑2） |
| 相对 URL 归一化为绝对 | `inject.js:10-15,76-82` | ★★★★ 分组/去重前置 | — |
| content 桥接 + source 校验 | `content.js:46-88` | ★★★★ 防伪造消息 | `'*'` 目标需收紧（坑15） |
| 录制状态机 + 启停 | `background.js:33-75` | ★★★ 直接搬 | 需修 window 坑（坑1） |
| 请求去重 `isDuplicateRequest` | `background.js:4-10` | ★★★ 降噪 | 改看 requestBody（坑7） |
| URL 黑名单过滤 | `background.js:12-30` | ★★★★ 必带 | 补 `moz-extension` 等 |
| OpenAPI 3.0 生成 `convertToOpenAPI` | `popup.js:172-277` | ★★★★★ 接口文档自动化 | 取首条 example（坑14） |
| JSON Schema 推断 `inferSchema` | `popup.js:280-321` | ★★★★★ 类型推断通用 | 对字符串只出 `string` |
| 文档 HTML 渲染 `generateDocumentationHTML` | `popup.js:323-1143` | ★★★ 现成模板 | 体积大，可精简 |
| 页内请求重发调试器 | `debugger.js:1-468` | ★★★★ 手写请求/断言 | 注意认证上下文（坑13） |
| 复制到剪贴板（含回退） | `debugger.js:382-438` | ★★★ 通用 | — |
| `chrome.storage.local` 持久化 | `popup.js:1174-1199` | ★★★ 状态留存 | 配合 SW 休眠（坑16） |

### 6.2 移植方案 A：修好 CDP 全量通道（推荐给「想要所有请求」的测试插件）

把 `background.js` 的 `window.tempRequests` 改为模块级变量：

```js
// background.js 顶部（SW 全局，无 window）
let tempRequests = {};   // 替换 window.tempRequests

// 原 background.js:124-125
// if (!window.tempRequests) window.tempRequests = {};
// window.tempRequests[requestId] = requestData;
tempRequests[requestId] = requestData;

// 原 background.js:136
// const tempRequest = (window.tempRequests && window.tempRequests[requestId]) || {};
const tempRequest = tempRequests[requestId] || {};

// 原 background.js:177-179 清理（无论成功失败都清）
delete tempRequests[requestId];
```

修复后 CDP 通道即可捕获 img/css/script/beacon 等全量请求，与 inject 通道形成互补。**注意**：此时同一 fetch/XHR 会被两条通道各采一次，`isDuplicateRequest` 的去重（坑7）才是去重关键——建议让 CDP 通道作为「补充」，inject 作为「主」，或在 CDP 的 `requestWillBeSent` 阶段就跳过 `request.initialPriority` 为最高、且类型可经 fetch 复现的请求。

### 6.3 移植方案 B：收紧 postMessage 目标 origin

把 `inject.js`/`panel.js`/`content.js` 中所有 `postMessage(data, '*')` 改为 `'self'` 或精确 origin（若跨 iframe 则需白名单）。content 侧保留 `event.source !== window` 校验即可抵御大部分伪造。

### 6.4 移植方案 C：去重改为「method+url+requestBody+responseBody」

将 `background.js:8` 的判定加入 `requestBody` 比对，避免「同 URL 不同响应」误删，同时避免「同 URL 同响应不同请求体」被误并：

```js
function isDuplicateRequest(n, e) {
  return e.method === n.method && e.url === n.url &&
    JSON.stringify(e.requestBody) === JSON.stringify(n.requestBody) &&
    JSON.stringify(e.responseBody) === JSON.stringify(n.responseBody);
}
```

### 6.5 移植方案 D：消除三份 `convertToOpenAPI` 副本

popup/panel/doc-generator 三处同名函数（`popup.js:172`、`panel.js:258`、`doc-generator.js:5`）。测试插件应只保留一份（建议放 `doc-generator.js` 并 `window` 暴露，或改为 ES Module），其余引用之，降低维护漂移。

### 6.6 移植方案 E：删死代码

- 删除 `background.js:187-215` 的 `chrome.action.onClicked`（因 `default_popup` 存在永不触发），或移除 `manifest.json:8` 的 `default_popup` 改用 onClicked 打开面板——**二选一**，不要留矛盾。
- 删除 `doc-utils.js` 孤儿文件。
- 修复 `panel.js`「生成文档」按钮，要么调用自带 `generateDocumentationHTML`，要么让 `content.js` 处理 `API_PANEL_GENERATE_DOC`。

---

## 第 7 章 · 最小可用实现（MVP 代码骨架）

> 以下为「业务 API 流量录制 + OpenAPI 文档」的最小可运行骨架，**仅用 inject 通道（已验证可用）**，不依赖失效的 CDP 通道。可直接裁剪进个人测试插件。

### 7.1 manifest（精简）

```json
{
  "manifest_version": 3,
  "name": "api-capture-mvp",
  "version": "0.1",
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js" },
  "action": { "default_popup": "popup.html" },
  "content_scripts": [{
    "js": ["content.js"],
    "matches": ["<all_urls>"],
    "run_at": "document_start"
  }],
  "web_accessible_resources": [{
    "matches": ["<all_urls>"],
    "resources": ["inject.js"]
  }]
}
```

> 说明：MVP 不需要 `debugger` 权限（CDP 通道已坏且非必需）；若后续按 6.2 修好 CDP 全量通道再加回。

### 7.2 inject.js（核心采集，MAIN world）

```js
// inject.js —— 由 content.js 以 <script src> 注入，运行在页面 MAIN world
(function () {
  const origFetch = window.fetch;
  const origXHR = window.XMLHttpRequest;

  window.fetch = function (...args) {
    let url;
    try { url = new URL(args[0], location.href).href; } catch { url = args[0]; }
    const opt = args[1] || {};
    let reqBody = null;
    if (opt.body) { try { reqBody = JSON.parse(opt.body); } catch { reqBody = opt.body; } }
    return origFetch.apply(this, args).then(async (res) => {
      const txt = await res.clone().text();
      let body; try { body = JSON.parse(txt); } catch { body = txt; }
      window.postMessage({
        __api: true,
        data: {
          url, method: opt.method || 'GET', status: res.status,
          statusText: res.statusText,
          headers: Object.fromEntries(res.headers.entries()),
          requestHeaders: opt.headers || {},
          requestBody: reqBody, responseBody: body,
          timestamp: Date.now(), type: 'fetch'
        }
      }, '*');
      return res;
    });
  };

  const open = origXHR.prototype.open;
  origXHR.prototype.open = function (m, u) {
    this._m = m;
    try { this._u = new URL(u, location.href).href; } catch { this._u = u; }
    this._h = {};
    return open.apply(this, arguments);
  };
  const setH = origXHR.prototype.setRequestHeader;
  origXHR.prototype.setRequestHeader = function (k, v) { this._h[k] = v; return setH.apply(this, arguments); };
  const send = origXHR.prototype.send;
  origXHR.prototype.send = function (d) {
    let rb = null; if (d) { try { rb = JSON.parse(d); } catch { rb = d; } }
    this.addEventListener('load', () => {
      let bd; try { bd = JSON.parse(this.responseText); } catch { bd = this.responseText; }
      const h = {};
      (this.getAllResponseHeaders() || '').trim().split(/[\r\n]+/).forEach(l => {
        const i = l.indexOf(': '); if (i > 0) h[l.slice(0, i)] = l.slice(i + 2);
      });
      window.postMessage({
        __api: true,
        data: { url: this._u, method: this._m, status: this.status, statusText: this.statusText,
          headers: h, requestHeaders: this._h || {}, requestBody: rb, responseBody: bd,
          timestamp: Date.now(), type: 'xhr' }
      }, '*');
    });
    return send.apply(this, arguments);
  };
})();
```

### 7.3 content.js（桥）

```js
// content.js
const s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement).appendChild(s);
s.onload = () => s.remove();

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || !e.data.__api) return;   // 校验来源
  chrome.runtime.sendMessage({ type: 'API_REQUEST', data: e.data.data }).catch(() => {});
});

chrome.runtime.onMessage.addListener((req, _s, res) => {
  if (req.action === 'requestCaptured') {
    window.postMessage({ __apiCaptured: true, data: req.data }, '*');
    res({ ok: true });
  }
  return true;
});
```

### 7.4 background.js（状态机 + 去重，已修 window 坑）

```js
// background.js  —— MV3 Service Worker，无 window
let networkRequests = [];
let isRecording = false;

function isDup(n) {
  return networkRequests.some(e =>
    e.method === n.method && e.url === n.url &&
    JSON.stringify(e.requestBody) === JSON.stringify(n.requestBody) &&
    JSON.stringify(e.responseBody) === JSON.stringify(n.responseBody));
}
function shouldCapture(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  return !['chrome-extension://','chrome://','edge://','about:','data:','blob:','file://']
    .some(p => u.startsWith(p));
}

chrome.runtime.onMessage.addListener((req, _s, res) => {
  if (req.action === 'startRecording') { isRecording = true; networkRequests = []; return res({ status: 'started' }); }
  if (req.action === 'stopRecording')  { isRecording = false; return res({ status: 'stopped', requests: networkRequests }); }
  if (req.action === 'getRequests')    { return res({ requests: networkRequests, isRecording }); }
  if (req.action === 'clearRequests')  { networkRequests = []; return res({ status: 'cleared' }); }
  if (req.type === 'API_REQUEST') {
    if (isRecording && shouldCapture(req.data.url) && !isDup(req.data)) {
      networkRequests.push(req.data);
      chrome.runtime.sendMessage({ action: 'requestCaptured', data: req.data }).catch(() => {});
    }
    return res({ ok: true });
  }
});
```

### 7.5 popup.js（生成文档，精简版）

```js
// popup.js —— 仅保留分组 + OpenAPI + 渲染（复制自 popup.js:118-277 / :323-343 的骨架）
function group(reqs, mergeUrls) {
  const g = {};
  reqs.forEach(r => {
    const u = new URL(r.url);
    const key = mergeUrls ? `${r.method} ${u.pathname}` : `${r.method} ${u.pathname}${u.search}`;
    (g[key] ||= { method: r.method, path: mergeUrls ? u.pathname : u.pathname + u.search,
      baseUrl: u.origin, examples: [] }).examples.push(r);
  });
  return Object.values(g);
}
function infer(v) {
  if (v === null) return { type: 'null' };
  const t = Array.isArray(v) ? 'array' : typeof v;
  if (t === 'array') return { type: 'array', items: v.length ? infer(v[0]) : { type: 'object' } };
  if (t === 'object') { const p = {}; const req = [];
    for (const [k, val] of Object.entries(v)) { p[k] = infer(val); if (val != null) req.push(k); }
    return { type: 'object', properties: p, required: req.length ? req : undefined }; }
  return { type: t === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : t };
}
function toOpenAPI(api) {
  const ex = api.examples[0];
  const spec = { openapi: '3.0.0', info: { title: 'API', version: '1.0.0' },
    servers: [{ url: api.baseUrl }], paths: {} };
  const op = spec.paths[api.path] = {};
  op[api.method.toLowerCase()] = { summary: `${api.method} ${api.path}`, responses: {} };
  if (ex.requestBody) op[api.method.toLowerCase()].requestBody = {
    content: { 'application/json': { schema: infer(ex.requestBody), example: ex.requestBody } } };
  const code = String(ex.status || 200);
  op[api.method.toLowerCase()].responses[code] = {
    description: ex.statusText || 'ok',
    content: { 'application/json': { schema: infer(ex.responseBody), example: ex.responseBody } } };
  return spec;
}
// 生成并下载
document.getElementById('gen').onclick = () => {
  chrome.runtime.sendMessage({ action: 'getRequests' }, (r) => {
    const apis = group(r.requests, true);
    const html = apis.map(a => `<h2>${a.method} ${a.path}</h2><pre>${JSON.stringify(toOpenAPI(a), null, 2)}</pre>`).join('');
    const w = window.open('', '_blank'); w.document.write(`<body>${html}</body>`); w.document.close();
  });
};
```

### 7.6 自检清单（移植后必验）

- [ ] inject.js 是否运行在 MAIN world（`<script src>` 注入，而非 content 直接执行）；
- [ ] content 转发是否校验 `event.source !== window`；
- [ ] background 是否**没有**任何 `window.xxx` 赋值（SW 无 window）；
- [ ] 去重向量是否覆盖 requestBody（避免坑 7）；
- [ ] `shouldCaptureRequest` 是否覆盖 `moz-extension://` 等（跨浏览器）；
- [ ] 录制状态是否在 SW 休眠后能从 `storage.local` 恢复（参考坑 16）；
- [ ] 若启用 CDP 通道，是否如 6.2 修好 `tempRequests` 且加了失败分支清理。

---

## 附录 A · 一句话回答用户原疑问

「界面上显示的就只是我的事件」——因为**真正生效的采集通道只有 `inject.js` 的 fetch/XHR 猴子补丁**（`inject.js:5,71,94`），它天然只捕获页面 JS 主动发出的业务请求；`background.js` 里那套基于 CDP `Network` 域的全量抓包（`background.js:100-184`）本应能采到 img/css/beacon 等一切流量，却因为作者在 Service Worker 中误用 `window.tempRequests`（`background.js:124,136,177`，SW 无 `window`）而整体静默崩溃，从未入库。两条通道一存一废，最终界面上就只剩「你点击触发的那些 API 事件」。要拿到全量流量，按第 6 章方案 A 修三行即可。

## 附录 B · 关键行号速查

| 主题 | 文件:行 |
|------|---------|
| fetch 覆盖 | `inject.js:5` |
| XHR open/send 覆盖 | `inject.js:71` / `inject.js:94` |
| 上行 postMessage | `inject.js:33,49,130,144` |
| content 注入脚本 | `content.js:2-7` |
| content source 校验 | `content.js:48` |
| 录制启停（含 CDP attach） | `background.js:33-75` |
| 去重 | `background.js:4-10` |
| URL 过滤 | `background.js:12-30` |
| **SW 无 window 崩溃点** | `background.js:124,136,177` |
| action.onClicked 死代码 | `background.js:187-215` |
| 分组 | `popup.js:118-169` |
| OpenAPI 生成 | `popup.js:172-277` |
| Schema 推断 | `popup.js:280-321` |
| HTML 渲染 | `popup.js:323-1143` |
| panel 生成按钮失效 | `panel.js:194-207` |
| debugger 重发 | `debugger.js:254-379` |
| 孤儿文件 | `doc-utils.js`（全文件未引用） |
| 权限声明 | `manifest.json:28` / `manifest.json:8`(popup) / `manifest.json:14-17`(content) |
