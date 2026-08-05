---
name: kr-mv3-messaging
version: 1.0.0
description: >-
  理解并复刻 Katalon Recorder 7.1.0（MV3）的跨进程通信基础设施：五上下文拓扑（SW / Panel /
  ISOLATED / MAIN / Offscreen）、上行广播与 sender 分流、下行 tabs.sendMessage 定向 +
  retryUntilSuccess 有界重试、frameLocation 差分自动补 selectFrame、窗口别名 win_ser_local、
  MAIN↔ISOLATED 的 chrome.* RPC 代理（含 pandoraboz 明文密钥安全缺陷）、bowser 版本探测与
  webextension-polyfill 注入顺序硬约束、以及"点图标弹独立窗口"的 default_popup 死配置机制。
  面向想裁剪个人本地录制回放插件的工程师。
type: reverse-engineering
domain: browser-extension / messaging-infrastructure
source-version: Katalon Recorder 7.1.0 (Manifest V3)
related-skills:
  - kr-panel-ui
  - kr-recorder-engine
  - kr-playback-engine
tags:
  - katalon-recorder
  - manifest-v3
  - messaging
  - service-worker
  - main-world
  - rpc-bridge
  - browser-compat
  - popup-window
---

# kr-mv3-messaging · Katalon Recorder MV3 通信总线 / 兼容层 / 弹框机制

本技能帮助你在**不修改扩展源码**的前提下，逆向吃透 Katalon Recorder 的五进程通信拓扑、浏览器兼容层与弹框机制，并据此裁剪出自己的纯本地录制回放插件。

## 何时使用

- 用户问「消息为什么发不到 content script」「Receiving end does not exist 怎么解」「MAIN world 里为什么没有 `chrome.runtime`」。
- 用户要复刻：MV3 后台架构选型、上行/下行通道、iframe 定位、多窗口隔离、点图标弹独立窗口。
- 用户在做 MV2 → MV3 迁移，需要一份踩坑清单（`getBackgroundPage` / `XMLHttpRequest` / `default_popup` / CSP）。
- 用户关心扩展安全：跨 world `postMessage` 通道、`externally_connectable`、CSP 配置。
- 用户是 Java 背景，需要把浏览器扩展的消息模型翻译成 RMI / JMS / Spring Retry 等熟悉概念。

## 核心事实（务必先建立的心智模型）

1. **【总钥匙】后台不在 Service Worker，而在 Panel 独立窗口里。**
   `worker_wrapper.js:1-26` 的 `importScripts` 只装了 22 个文件，**没有 `recorder.js`、没有 `window-controller.js`、没有 `playback/`**；而 `panel/index.html:1001-1016` 用 `<script type="module">` 加载了 `js/background/window-controller.js`、`js/background/recorder.js`、`js/background/playback/index.js`。
   整套 MV2 background page 逻辑被**物理搬进 Panel 窗口**——所以「Panel 怎么绕过 `getBackgroundPage()`」这个问题不成立：**它不需要绕，它自己就是背景页**。理由也很硬：SW 没有 DOM、没有 `prompt()`、30 秒空闲被杀，承载不了录制状态机。

2. **握手是全生命周期唯一一次 SW→Panel 定向消息，且用完即摘。**
   发：`background/background.js:92-98`（`{selfWindowId, commWindowId}`）；收：`panel/js/background/editor.js:79-88`，处理完立刻 `removeListener(自己)`。`selfWindowId` 用于 `storeXxx` 弹 `prompt` 时抢焦点，`commWindowId` 是所有录制/回放的作用域。

3. **上行广播 + `sender` 分流；下行 `{frameId}` 定向。**
   上行 `content/recorder.js:102-118` 用 `runtime.sendMessage`（不带 tabId），Panel 在 `panel/js/background/recorder.js:362-372` 靠 `sender.tab.id` / `sender.frameId` 分流；下行 `panel/js/background/window-controller.js:142-156` 用 `tabs.sendMessage(tabId, msg, {frameId})`。
   **易错点**：上行字段是 `command`（单数），下行是 `commands`（复数）。

4. **`retryUntilSuccess(fn, 60, 500)` = 30 秒上限，是 MV3 下 `Receiving end does not exist` 的标准解。**
   `panel/js/background/window-controller.js:142-156`，发送前先 `tabs.get` 校验 `tab.status === 'complete'`。页面加载中 content script 尚未注入，直接发必失败。

5. **iframe 支持靠 `frameLocation` 差分，自动补 `selectFrame`。**
   Content 构造时上报一次（`content/recorder.js:26-31`），Panel 记录（`panel/js/background/window-controller.js:45-49`）；差分算法在 `panel/js/background/recorder.js:271-293`：old 更长循环补 `relative=parent`，new 更长循环补 `index=N`。

6. **`win_ser_local` 是硬编码的第一个窗口别名。**
   `panel/js/background/recorder.js:212-224`：首个被录 tab 固定叫 `win_ser_local`，命令表为空时自动补 `open <url>`。这就是脚本首行 `selectWindow | win_ser_local` 的来源。

7. **MAIN world 没有 `chrome.*`，靠自研 RPC 代理补齐——且密钥是明文。**
   Server（ISOLATED）`common/chrome-polyfill-server.js:1-9` 把 `chrome.runtime.id` 写到 `documentElement` 属性；Client（MAIN）`common/chrome-polyfill.js:1-15` 读回后挂上 `runtime/storage/extension` 代理。传输层 `common/remote-object-helper-content.js` / `-page.js`（md5 相同 `282bf197618d582fe0198a40d352d4b0`）用 `constructor(s = "pandoraboz")` 硬编码密钥 + `postMessage(..., "*")`，`verifyRawMessage` 只判 `source !== this.id && type === "message" && key` 相等。**🔴 同页任意第三方脚本都能冒名拿到 `chrome.storage` 完整读写代理。**

8. **MAIN world 注入顺序是硬约束。**
   `manifest.bak.json:74-81`：`remote-object-helper-page` → `chrome-polyfill` → `browser-polyfill-page`。顺序错则 polyfill 因 `chrome.runtime.id` 为空直接 `throw new Error("This script should only be loaded in a browser extension.")`。

9. **弹框「靠 bug 工作」。**
   `manifest.json:44` 的 `default_popup: "popup-browser/index.html"` ①写在 manifest 顶层（MV3 要求 `action.default_popup`），②目录根本不存在。**正因为它无效，`action.onClicked` 才会触发**（`background/background.js:852` → `:29-106` → `windows.create({type:"popup"})`）。谁"好心"把它修正到 `action` 里，整个插件就点不开了——正确做法是**删掉这一行**。

10. **`master[contentWindowId] → panelWindowId` 一对一映射是多窗口隔离的精髓，但它是内存变量。**
    `background/background.js:18`。SW 被回收即丢失 → 同窗口会再开一个 Panel。复刻必须改 `chrome.storage.session`。

11. **必须弹独立窗口，不能用 popup。**
    popup 失焦即销毁，而录制过程中用户必然要去点目标页面 → popup 必挂。`windows.create({type:"popup"})` 生成的是真实浏览器窗口，可长驻。**这是所有录制类扩展的必选架构。**

12. **`150.0` 不是 bug 是正则：`panel/js/katalon/bowser.js:274-279` 的 `(\d+(\.\d+)?)` 只捕两段。**
    日志出处 `panel/js/katalon/kar.js:513-529`；Edge 必须先于 Chrome 判定（`:159-164`，Edge UA 也含 `Chrome/`）；bowser 在 `:457` 模块加载即执行。复刻改用 `navigator.userAgentData.getHighEntropyValues(['fullVersionList'])`。

13. **MV2→MV3 四处遗留，全中：**
    ① `panel/js/background/window-controller.js:326-331` 的 `getBackgroundPage()` 必然 reject 且**无 `.catch`**；② `katalon/background.js:138-179` 在 SW 里 `new XMLHttpRequest()`（所幸调用者已注释于 `:192-193`，实走 WebSocket `:210-215`）；③ `manifest.json:44` `default_popup` 死配置；④ CSP 被构建期误改成 `"...; unsafe-eval; unsafe-inline;"`（`manifest.json:41-43`），而 `manifest.bak.json:48-50` 才是正确的——这两个是**关键字不是指令名**，Chrome 忽略整条。

14. **Offscreen 完全为埋点服务，可整块删。**
    `common/offscreen-server.js:21-42,:44-52` + `common/offscreen.js:1-29` 只做 `get-browser-name` 与 FingerprintJS 指纹，与录制回放无关。连带去掉 `offscreen` 权限。

15. **CDP 只在两处不可替代**：`DOM.setFileInputFiles`（`background/kar.js:61-80`）与 `Input.dispatchKeyEvent`（`:111-146`）。`debugger` 权限会让浏览器顶部常驻"正在被调试"横幅，个人插件**非必要不申请**。

## 取证锚点（修改/复刻时优先读这些文件）

| 主题 | 文件 | 关键行 |
|---|---|---|
| SW 装了什么（拓扑第一证据） | `worker_wrapper.js` | 1-26 |
| Panel 兼后台（第二证据） | `panel/index.html` | 1001-1016 |
| 开窗 + 节流 + 握手 | `background/background.js` | 29-106、852 |
| 握手接收（一次性） | `panel/js/background/editor.js` | 79-88 |
| 上行发送 + 浮层过滤 | `content/recorder.js` | 26-31、102-118、104 |
| 上行接收（attach 幂等） | `panel/js/background/recorder.js` | 362-372 |
| 窗口别名 win_ser_local | `panel/js/background/recorder.js` | 212-224 |
| frameLocation 差分 | `panel/js/background/recorder.js` | 271-293 |
| frame 表记录 | `panel/js/background/window-controller.js` | 45-49 |
| 下行 + retryUntilSuccess | `panel/js/background/window-controller.js` | 142-156 |
| 下行统一入口 | `content/command-receiver.js` | 49-77 |
| 截图直连 SW | `background/kar.js` | 159-169 |
| CDP 上传/按键/节点/detach/探测 | `background/kar.js` | 61-80 / 111-146 / 197-238 / 34-58 / 324-330 |
| RPC Server（ISOLATED） | `common/chrome-polyfill-server.js` | 1-9（全文） |
| RPC Client（MAIN） | `common/chrome-polyfill.js` | 1-15（全文） |
| RPC 传输层 + 明文密钥 | `common/remote-object-helper-content.js` / `-page.js` | 打包产物，见 TECH-05 §A.5 |
| MAIN 注入顺序硬约束 | `manifest.bak.json` | 74-81 |
| 右键菜单 Port（单变量缺陷） | `background/background.js` | 228-235、123-226 |
| SW 保活 | `background/background.js` | 237-239 |
| 关窗清理 | `background/background.js` | 110-120 |
| 窗口尺寸 读/写 | `background/kar.js` / `panel/js/katalon/kar.js` | 1-20 / 51-59 |
| 页面录制浮层 | `content/inject-popup-record.js` | 19-38、48-76 |
| Offscreen（仅埋点） | `common/offscreen-server.js` / `common/offscreen.js` | 21-42、44-52 / 1-29 |
| Sandbox EvalScope | `panel/sandbox.js` + `SandboxEvaluator.js` | 28-54 / 23-50 |
| 版本探测与日志 | `panel/js/katalon/kar.js` / `panel/js/katalon/bowser.js` | 513-529 / 274-279、159-164、457 |
| 浏览器名双实现（Edge 死代码） | `common/get-browser-name.js` / `-background.js` | 4-64、43-60 / 1-4 |
| MV3 遗留：getBackgroundPage | `panel/js/background/window-controller.js` | 326-331 |
| MV3 遗留：SW 内 XHR | `katalon/background.js` | 138-179、192-193、210-215 |
| CSP 正确 vs 错误 | `manifest.bak.json` / `manifest.json` | 48-50 / 41-43 |
| 外部扩展通道 | `manifest.json` / `background/kar.js` | 46-50 / 267-308、310-322 |

## 工作流

1. **先亮总钥匙**：任何回答的第一句都要点明「后台在 Panel 窗口，不在 Service Worker」，并给出 `worker_wrapper.js:1-26` 与 `panel/index.html:1001-1016` 的双证据。用户若带着「SW 是后台」的默认假设，后面所有推理都会跑偏。
2. **按主题取证**：用上方锚点逐文件读取，所有结论带 `文件路径:行号` + 代码片段。拓扑判断只认 `importScripts` 清单与 `<script>` 标签，不靠文件名/目录名猜测。
3. **区分四类通道**：上行广播（Content→Panel）、下行定向（Panel→Content）、直连（Content→SW，需扩展进程权限如截图/CDP）、跨 world RPC（MAIN↔ISOLATED）。回答前先判定问题落在哪一类。
4. **Java 类比**（用户是 Java 背景，主动做映射）：
   - MAIN↔ISOLATED 的 `RemoteObjectHelper` 代理 → **RMI stub**（本地对象方法调用被序列化成帧，远端执行后回传，调用方无感）；
   - 上行 `runtime.sendMessage` 广播 + `sender.tab.id` 分流 → **JMS Topic**（发布订阅，订阅方自行按 header 过滤）；
   - 下行 `tabs.sendMessage(tabId, msg, {frameId})` → **JMS Queue / 点对点**（明确投递目标）；
   - `retryUntilSuccess(fn, 60, 500)` → **Spring Retry `@Retryable(maxAttempts=60, backoff=@Backoff(500))`**；
   - 右键菜单 `runtime.connect()` Port → **长连接 Socket / Stub**（原版单变量 `port` 相当于把连接池写成了单例字段，多客户端必然互相覆盖）；
   - `master[contentWindowId] → panelWindowId` → **`ConcurrentHashMap` 会话注册表**（原版放内存 = 没做持久化，容器重启即丢）；
   - Panel 兼后台 → **把整个 Spring 容器塞进了 Swing 主窗口**，窗口关了容器就没了；
   - `EvalScope` 单 promise 队列（`panel/sandbox.js:28-54`）→ **`SynchronousQueue` + 单消费者线程**。
5. **裁剪建议给分层结论**：
   - **必留**：Panel 兼后台架构、上行广播+分流、下行定向+`retryUntilSuccess`、frameLocation 差分、`windows.create({type:"popup"})`、`master` 映射（改 `storage.session`）、窗口尺寸持久化、页面浮层三要素（`!important` + `z-index:99999999` + Trusted Types + 过滤自身）。
   - **必改**：`pandoraboz` → 随机 nonce + origin 校验；`port` 单变量 → `Map<windowId, Port>`；轮询等 ready → Panel 主动 `panelReady`；`getBackgroundPage()` → 消息通知；CSP → `"script-src 'self'; object-src 'self'"`；bowser → `userAgentData`。
   - **必删**：Offscreen 与 `offscreen` 权限、`debugger` 权限（除非确需文件上传）、`externally_connectable`（`ids:["*"]`）、Object Spy 通道、埋点、`default_popup` 那一行、`panel/index.html:52` 的失效 CDN。
6. **给可验证的最小实验**：每个结论尽量配一条可在 DevTools 里跑的验证命令（如在页面 console 发 `postMessage({source:'x',type:'connect',key:'pandoraboz'},'*')` 复现 RPC 冒名）。
7. **绝不修改扩展源文件**：只产出文档/提示词/技能，或在用户自有项目里新建文件。

## 配套产物

- 技术文档：`_distill/tech/TECH-05-通信兼容与弹框.md`（A 通信总线 / B 兼容层 / C 弹框机制三大块，附全量消息 Schema 清单与 15 项缺陷表）。
- 需求文档：`_distill/prd/PRD-05-通信与兼容层.md`（10 节，30 条 FR、8 条 NFR、7 组 TS 接口、3 张流程图、20 条验收用例）。
- 提示词：`_distill/prompts/PROMPT-05-通信与兼容层.md`（自包含主提示词 + 代码生成/问题诊断两变体 + T1-T5 调试模板）。
- 相邻技能：`kr-panel-ui`（Panel 内部 UI 与右键菜单落地）、`kr-recorder-engine`（上行消息的生产者）、`kr-playback-engine`（下行消息的消费者）。

## 红线

- **不臆测行号**：找不到的写「未在源码中找到」，绝不编造 `路径:行号`。
- **不改动被分析的扩展源码**：所有产出只写进 `_distill/` 或用户自有项目。
- **必须显式点出 `pandoraboz` 明文密钥这个安全缺陷**：只要话题涉及 MAIN world / 跨 world 通信 / RPC 代理，就必须说明「硬编码密钥 + `postMessage(..., "*")` + 不校验 `event.origin`，同页第三方脚本可完整代理 `chrome.storage`」，并给出「随机 nonce + 精确 targetOrigin + 双向 origin 校验」的正确做法。**不得因为"能跑"就略过。**
- **不得建议把 `default_popup` "修正"到 `action` 内**：那会让整个插件点不开（`manifest.json:44` 靠无效才让 `onClicked` 生效）。正确做法是删除。
- **不得把 recorder/playback 建议放进 Service Worker**：SW 无 DOM、无 `prompt()`、会被回收，这是 KR 架构选型的根本原因。
- **两个易错点回答时必须显式点出**：① 上行 `command`（单数）vs 下行 `commands`（复数）；② SW 内存变量（`master` / `port` / `popupWindowIDs`）在 SW 回收后全部丢失。
