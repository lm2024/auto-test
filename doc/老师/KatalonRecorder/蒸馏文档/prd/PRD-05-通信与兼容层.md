# PRD-05 · 跨进程通信总线 / 浏览器兼容层 / 弹框机制（产品需求文档）

> 产品视角，给「个人录制回放插件」的**基础设施层**定范围：五个上下文怎么互相说话、怎么兼容浏览器差异、点击图标怎么弹出工作窗口。
> 所有功能点均有源码依据（见 `实现位置` 列），依据来自 `_distill/tech/TECH-05-通信兼容与弹框.md`。
> 优先级约定：P0=必备，P1=重要，P2=可选。

---

## 1. 背景与目标

**背景**：录制回放插件天然是「多进程分布式系统」——被测页面（ISOLATED / MAIN 两个 world）、Service Worker、工作面板窗口、Offscreen 文档，五个上下文各有各的能力边界与生命周期。MV3 把原来最方便的 background page 换成了会被回收的 Service Worker，而 Service Worker **没有 DOM、没有 `prompt()`、30 秒空闲就被杀**，无法承载录制状态机。原 Katalon Recorder 的解法是：**把整套后台逻辑物理搬进 Panel 弹出窗口**（`panel/index.html:1001-1016` 加载 `js/background/*`），Service Worker 只留权限桩（`worker_wrapper.js:1-26` 只 import 22 个文件，**没有 recorder.js、没有 window-controller.js、没有 playback/**）。

**目标**：为个人插件定义一套**可靠、可解释、可裁剪**的通信基础设施：上行广播 + 下行定向、frameLocation 差分、MAIN world 能力补齐、独立窗口弹框，并**修掉原版的安全与健壮性缺陷**。

**成功标准**：
- 录制时页面任意 iframe 内的操作都能带着正确的 `frameLocation` 上报到 Panel，且自动补出 `selectFrame`。
- 回放时目标页面处于加载中/刚导航完，命令仍能在 30 秒内送达而不报 `Receiving end does not exist`。
- Service Worker 被回收后重新唤醒，Panel ↔ 窗口映射不丢失。
- MAIN world 的 `chrome.storage` 代理通道**无法被同页第三方脚本冒用**（原版可以，见 FR-12）。
- 点击扩展图标稳定弹出一个可长驻的独立窗口，双击不会开两个。

---

## 2. 名词表

| 名词 | 含义 |
|---|---|
| SW（Service Worker） | MV3 后台脚本，本插件中只做权限桩与开窗，见 `worker_wrapper.js:1-26` |
| Panel | `panel/index.html` 承载的独立弹出窗口，**兼任真正的后台大脑** |
| ISOLATED world | content script 默认世界，有 `chrome.*`，与页面 JS 变量隔离 |
| MAIN world | 页面自身 JS 世界，**没有 `chrome.*`**，靠 RPC 代理补齐 |
| Offscreen | MV3 提供的隐藏 DOM 文档，本插件中仅服务埋点（`common/offscreen-server.js:44-52`） |
| 上行 | Content → Panel，走 `runtime.sendMessage` **广播**，Panel 用 `sender.tab.id` 分流 |
| 下行 | Panel → Content，走 `tabs.sendMessage(tabId, msg, {frameId})` **定向** |
| 握手 | 开窗后 SW 向 Panel 发的唯一一次定向消息，携带两个 windowId（`background/background.js:92-98`） |
| frameLocation | iframe 路径字符串，形如 `root:0:2`（`content/recorder.js:26-31` 上报） |
| 窗口别名 | 录制脚本里的 `win_ser_local` / `win_ser_1`（`panel/js/background/recorder.js:212-224`） |
| RemoteObjectHelper | 自研 `postMessage` RPC 代理，把 ISOLATED 的 `chrome.*` 暴露给 MAIN world |
| retryUntilSuccess | 有界重试工具，回放下行用 `(fn, 60, 500)` = 30 秒上限（`window-controller.js:202-212`） |
| master 映射 | `contentWindowId → panelWindowId` 一对一表（`background/background.js:18`） |

---

## 3. 用户故事

- **US-1（录制者）**：作为录制者，我在 iframe 里点按钮，希望脚本自动补出 `selectFrame`，回放时能找到同一个元素。→ FR-4/FR-5
- **US-2（录制者）**：作为录制者，我打开新标签页继续操作，希望脚本里出现 `selectWindow win_ser_1` 而不是丢失上下文。→ FR-6
- **US-3（回放者）**：作为回放者，我希望页面正在加载时命令能自动等待重试，而不是直接报 `Receiving end does not exist`。→ FR-7
- **US-4（使用者）**：作为使用者，我点击扩展图标希望弹出一个**能长驻、切走焦点也不会消失**的工作窗口，尺寸还能被记住。→ FR-13/FR-14/FR-16
- **US-5（使用者）**：作为使用者，我在同一个浏览器开两个窗口分别录制，希望两个 Panel 互不串扰。→ FR-15
- **US-6（安全关注者）**：作为安全关注者，我不希望被测页面里的第三方脚本能通过 `postMessage` 拿到我插件的 `chrome.storage` 读写权。→ FR-12
- **US-7（裁剪者）**：作为裁剪者，我希望删掉埋点 offscreen、CDP debugger、外部扩展通道这些与录制回放无关的模块，权限声明越少越好。→ FR-19/FR-20/FR-21
- **US-8（维护者）**：作为维护者，我希望日志里的浏览器版本号是完整准确的，而不是被正则截成两段。→ FR-17

---

## 4. 功能需求（FR）

### 4.1 通信拓扑

| 编号 | 优先级 | 需求 | 实现位置（源码） |
|---|---|---|---|
| FR-1 | P0 | 后台状态机**不得放在 Service Worker**，须由长驻 Panel 窗口承载；SW 只留权限桩与开窗 | `worker_wrapper.js:1-26`（无 recorder/playback）vs `panel/index.html:1001-1016` |
| FR-2 | P0 | 开窗后 SW 向 Panel 发一次握手消息 `{selfWindowId, commWindowId}`，Panel 收到即**摘除监听器** | 发：`background/background.js:92-98`；收：`panel/js/background/editor.js:79-88` |
| FR-3 | P0 | 上行通道：Content 用 `runtime.sendMessage` 广播，Panel 用 `sender.tab.id` / `sender.frameId` 分流 | 发：`content/recorder.js:102-118`；收：`panel/js/background/recorder.js:362-372` |
| FR-4 | P0 | Content 构造时主动上报一次 `frameLocation`，Panel 侧记录 `tabId + frameId → frameLocation` | 发：`content/recorder.js:26-31`；收：`panel/js/background/window-controller.js:45-49` |
| FR-5 | P0 | 录制时对 `frameLocation` 做**差分**，自动插入 `selectFrame relative=parent` / `selectFrame index=N` | `panel/js/background/recorder.js:271-293` |
| FR-6 | P0 | 首个录制标签页固定别名 `win_ser_local`，后开的递增 `win_ser_N`；首条命令自动补 `open` | `panel/js/background/recorder.js:212-224` |
| FR-7 | P0 | 下行通道：Panel 用 `tabs.sendMessage(tabId, msg, {frameId})` 定向，并包一层 `retryUntilSuccess(fn, 60, 500)`，发送前校验 `tab.status === 'complete'` | `panel/js/background/window-controller.js:142-156` |
| FR-8 | P0 | Content 侧统一命令入口，按 `request.commands` 首字母大写映射到 `selenium["doXxx"]` | `content/command-receiver.js:49-77` |
| FR-9 | P1 | 需要扩展进程权限的操作（截图）由 Content **直连 SW**，不经 Panel | 发：`content/command-receiver.js:68`；收：`background/kar.js:159-169` |
| FR-10 | P1 | 右键菜单点击结果经长连接 Port 回传到 Panel；**必须改为 `Map<windowId, Port>` + `onDisconnect` 清理** | 原版缺陷实现：`background/background.js:228-235` |
| FR-11 | P2 | SW 保活定时器（`setInterval(getPlatformInfo, 20e3)`）——非必需，仅在确有跨唤醒状态时保留 | `background/background.js:237-239` |

### 4.2 MAIN world 能力补齐

| 编号 | 优先级 | 需求 | 实现位置（源码） |
|---|---|---|---|
| FR-12 | **P0** | MAIN↔ISOLATED RPC 代理的握手密钥**必须改为运行时随机 nonce**（`crypto.randomUUID()`），并对 `postMessage` 做 `targetOrigin` 与 `event.origin` 双向校验。原版硬编码 `"pandoraboz"` + `postMessage(..., "*")`，同页任意第三方脚本可冒名拿到 `chrome.storage` 完整读写代理 | 缺陷位置：`common/remote-object-helper-content.js` / `-page.js`（`constructor(s = "pandoraboz")`、`Wr({...}, "*")`、`verifyRawMessage` 仅比 `source !== this.id`） |
| FR-13 | P0 | ISOLATED 侧把扩展 id 写到 `documentElement` 属性，MAIN 侧读取后拼出 `chrome.runtime.id`，再挂上 `runtime/storage/extension` 代理 | Server：`common/chrome-polyfill-server.js:1-9`；Client：`common/chrome-polyfill.js:1-15` |
| FR-14 | P0 | MAIN world 脚本注入顺序为硬约束：`remote-object-helper-page` → `chrome-polyfill` → `browser-polyfill-page`，顺序错则 polyfill 因 `chrome.runtime.id` 为空直接 `throw` | `manifest.bak.json:74-81` |

### 4.3 弹框机制

| 编号 | 优先级 | 需求 | 实现位置（源码） |
|---|---|---|---|
| FR-15 | P0 | 点击扩展图标用 `windows.create({type:"popup"})` 开**独立窗口**，不得用 `action.default_popup`；`default_popup` 声明必须删除 | 实现：`background/background.js:29-106`、`:852`；死配置：`manifest.json:44`（顶层键 + `popup-browser/` 目录不存在） |
| FR-16 | P0 | 维护 `contentWindowId → panelWindowId` 一对一映射；已有 Panel 时只聚焦不新开；建议改存 `chrome.storage.session` | `background/background.js:18`、`:29-106`（分支①） |
| FR-17 | P0 | 开窗 1 秒节流，防止双击开出两个窗口 | `background/background.js:29-106`（`clickEnabled`，分支②） |
| FR-18 | P1 | 窗口尺寸持久化：Panel 侧 `resize` 写 `storage.local.window`，SW 侧开窗时读，缺省 1080×630 | 写：`panel/js/katalon/kar.js:51-59`；读：`background/kar.js:1-20` |
| FR-19 | P1 | 关窗时清理 `master` 映射与右键菜单；`popupWindowIDs` 数组必须同步 splice（原版只 push 不删） | `background/background.js:110-120`；缺陷说明见 TECH-05 §C.2 |
| FR-20 | P1 | 等待 Panel ready **改为 Panel 主动通知**（`runtime.sendMessage({panelReady:true})`），替换原版 500ms×100 轮询 | 原版轮询：`background/background.js:29-106`（分支④） |
| FR-21 | P1 | 录制中在被测页面注入可拖拽浮层（含 Stop 按钮），样式全 `!important` + `z-index: 99999999` + Trusted Types 兼容；录制时须过滤浮层自身 | 浮层：`content/inject-popup-record.js:19-38`、`:48-76`；过滤：`content/recorder.js:104` |

### 4.4 兼容层与裁剪

| 编号 | 优先级 | 需求 | 实现位置（源码） |
|---|---|---|---|
| FR-22 | P1 | 浏览器/版本探测改用 `navigator.userAgentData.getHighEntropyValues(['fullVersionList'])`，Firefox 回落 UA 解析。原版 bowser 1.x 正则 `(\d+(\.\d+)?)` 只捕获两段，Chrome 150.0.7204.100 被显示成 `150.0` | 日志出处：`panel/js/katalon/kar.js:513-529`；截断根因：`panel/js/katalon/bowser.js:274-279`；Edge 需先判：`:159-164` |
| FR-23 | P1 | `webextension-polyfill` 只保留一份物理文件，构建时分发。原版三份完全相同的副本（md5 `62c2cb1c84aa85f1ceb09de9e57659c0`） | `common/browser-polyfill.js` / `-content.js` / `-page.js`；引入点 `worker_wrapper.js:6`、`manifest.json:16`、`panel/index.html:865` |
| FR-24 | P1 | `getBrowserName()` 统一为单一入口 + 内部 `typeof document === 'undefined'` 判断。原版两个同名函数靠「谁 import」决定语义，且 Edge 永远被判成 Chrome | `common/get-browser-name.js:4-64`（`:43-60` Edge 死代码）、`common/get-browser-name-background.js:1-4` |
| FR-25 | P0 | MV2→MV3 迁移必须全局搜查四类 API 并清除：`getBackgroundPage`、`XMLHttpRequest`、`chrome.extension.*`、`default_popup` | `panel/js/background/window-controller.js:326-331`（无 catch 的 reject）；`katalon/background.js:138-179`（SW 内无 XHR）；`manifest.json:44` |
| FR-26 | P1 | CSP 修正为 `"script-src 'self'; object-src 'self'"`；`unsafe-eval`/`unsafe-inline` 是关键字不是指令名，写在 `object-src` 之后会让 Chrome 忽略整条 | 错误版：`manifest.json:41-43`；正确版：`manifest.bak.json:48-50` |
| FR-27 | P1 | 需要 eval 的命令（`storeEval`/`runScript`）走 sandbox 页的单 promise 队列 `EvalScope`，禁止在扩展页直接 eval | `panel/sandbox.js:28-54`；宿主封装 `panel/js/UI/services/helper-service/SandboxEvaluator.js:23-50` |
| FR-28 | P2 | CDP（`chrome.debugger`）仅在文件上传与特殊按键两处使用；**个人插件建议不申请该权限**（会常驻"正在被调试"横幅） | 入口：`background/kar.js:174-192`；上传：`:61-80`；按键：`:111-146`；节点定位：`:197-238`；detach：`:34-58`；探测：`:324-330` + `content/kar.js:1-6` |
| FR-29 | P2 | Offscreen 文档整块删除（仅服务浏览器名 + FingerprintJS 埋点），连带去掉 `offscreen` 权限 | `common/offscreen-server.js:21-42`、`:44-52`；`common/offscreen.js:1-29` |
| FR-30 | P2 | `externally_connectable` 与第三方能力注册通道整块删除；原版 `ids: ["*"]` 允许任意扩展连接 | `manifest.json:46-50`；注册：`background/kar.js:267-308`；淘汰：`:310-322` |

---

## 5. 非功能需求（NFR）

| 编号 | 需求 |
|---|---|
| NFR-1 | **可靠性**：下行命令投递上限 30 秒（60 次 × 500ms），超时须给出明确错误而非静默失败（`window-controller.js:142-156`） |
| NFR-2 | **状态持久性**：所有跨 SW 唤醒需要的状态（`master` 映射、窗口尺寸）必须落 `chrome.storage.session` / `local`，不得只放内存变量（原版 `master`、`port`、`popupWindowIDs` 均为内存变量） |
| NFR-3 | **安全性**：跨 world `postMessage` 必须指定精确 `targetOrigin` 并在接收侧校验 `event.origin` 与随机 nonce；扩展 CSP 不得含 `unsafe-eval` |
| NFR-4 | **隔离性**：多浏览器窗口并行录制时，各 Panel 的 tabId/frameId 上下文互不污染（依赖 FR-16 的一对一映射与 FR-10 的 Port Map） |
| NFR-5 | **权限最小化**：默认 manifest 不申请 `debugger` / `offscreen`；`host_permissions` 只保留 `<all_urls>`（原版同时列了 `http://*/`、`https://*/`、`<all_urls>`，`manifest.json:52`） |
| NFR-6 | **兼容性**：MAIN world 注入顺序在构建期用测试固化，防止后续调整脚本数组顺序导致 polyfill `throw`（`manifest.bak.json:74-81`） |
| NFR-7 | **可观测性**：所有 `sendMessage` 的 `.catch` 不得为空实现；原版 `content/recorder.js:114` 与 `:26-31` 都是静默吞错，排障困难 |
| NFR-8 | **无外部依赖**：Panel 页面不得引用外部 CDN（原版 `panel/index.html:52` 仍引用已失效的 `html5shim.googlecode.com`） |

---

## 6. 数据结构（TypeScript）

```ts
/* ─────────────── 6.1 握手消息 ─────────────── */
// SW → Panel，全生命周期仅一次（background/background.js:92-98）
export interface HandshakeMessage {
  selfWindowId: number;   // Panel 自己的窗口 id，storeXxx 弹 prompt 时抢焦点用
  commWindowId: number;   // 被录制/回放的目标浏览器窗口 id，所有操作的作用域
}
// Panel 收到后立即 removeListener（panel/js/background/editor.js:79-88）

/* ─────────────── 6.2 上行：录制消息 ─────────────── */
// Content(MAIN) → Panel 广播（content/recorder.js:102-118）
export interface RecordCommandMessage {
  command: string;                    // 如 "click" / "type"
  target: string[][];                 // 候选定位器二维数组
  value: string;
  insertBeforeLastCommand?: boolean;
  frameLocation: string;              // "root" | "root:0" | "root:0:2"
}

// Content 构造时的一次性 frame 上报（content/recorder.js:26-31）
export interface FrameLocationMessage {
  frameLocation: string;
}

// Panel 侧的分流上下文（由 runtime.onMessage 第二参提供）
export interface MessageSender {
  tab: { id: number; url: string; windowId: number };
  frameId: number;                    // 0 = 主框架
}

/* ─────────────── 6.3 下行：回放消息 ─────────────── */
// Panel → Content 定向（panel/js/background/window-controller.js:142-156）
export interface PlayCommandMessage {
  commands: string;                   // 注意是复数 commands，与上行的 command 不同！
  target: string;
  value: string;
}
export interface SendMessageOptions {
  frameId: number;                    // top ? 0 : currentPlayingFrameId
}

// 录制控制类下行（panel/js/background/editor.js:65,71）
export type RecorderControlMessage =
  | { attachRecorder: true }
  | { detachRecorder: true }
  | { selectMode: true; selecting: boolean };

/* ─────────────── 6.4 Content → SW 直连（需扩展进程权限） ─────────────── */
export type ContentToWorkerMessage =
  | { captureEntirePageScreenshot: true; captureWindowId?: number }  // kar.js:159-169
  | { uploadFile: true; file: string; krId?: string; locator?: string } // kar.js:174-192
  | { sendSpecialKeys: true; keyCodes: number[]; modifiers: number }   // kar.js:174-192
  | { checkChromeDebugger: true };                                     // kar.js:324-330

/* ─────────────── 6.5 MAIN ↔ ISOLATED RPC 帧 ─────────────── */
// 原版实现见 common/remote-object-helper-content.js / -page.js
export interface RpcConnectFrame {
  source: string;                     // 端点唯一 id，用于防自回环
  type: 'connect';
  key: string;                        // ⚠️ 原版硬编码 "pandoraboz"，复刻须换随机 nonce
}
export interface RpcDataFrame<T = unknown> {
  source: string;
  type: 'message';
  key: string;
  message: { id: string; type: 'REQUEST' | 'RESPONSE'; data: T };
}
// 校验：verifyRawMessage 仅判 source !== this.id && type === 'message' && key 相等
// 复刻补充：必须再判 event.origin === location.origin && event.source === window

/* ─────────────── 6.6 弹框与窗口状态 ─────────────── */
export interface PanelWindowRegistry {
  master: Record<number, number>;     // contentWindowId → panelWindowId（background.js:18）
  popupWindowIDs: number[];           // ⚠️ 原版只 push 不 splice
  clickEnabled: boolean;              // 1 秒节流开关
}
export interface WindowSizeSetting {
  window: { width: number; height: number };  // 缺省 1080×630（background/kar.js:1-20）
}

/* ─────────────── 6.7 浏览器探测结果 ─────────────── */
// 原版 bowser 1.x 形态（panel/js/katalon/bowser.js:274-279, :457）
export interface BowserResult {
  name: string;        // "Chrome" | "Microsoft Edge" | ...
  version: string;     // ⚠️ 正则只捕两段：150.0.7204.100 → "150.0"
  osname?: string;
  osversion?: string;
}
```

---

## 7. 流程图

### 7.1 开窗与握手（点击图标 → Panel 可用）

```
用户点击扩展图标
   │  （default_popup 无效，才轮到 onClicked）      ← manifest.json:44 死配置
   ▼
browser.action.onClicked → openPanel(tab)          ← background/background.js:852
   │
   ├─ master[contentWindowId] 已存在？
   │     └─是→ windows.update({focused}) 只聚焦，return    ← background.js:29-106 ①
   │
   ├─ clickEnabled == false？（1 秒内重复点击）
   │     └─是→ 直接丢弃                                    ← ②
   │
   ├─ getWindowSize() 读 storage.local.window（缺省1080×630） ← background/kar.js:1-20
   ▼
windows.create({url:"panel/index.html", type:"popup"})       ← ③
   │
   ▼
轮询 tabs.query({status:"complete"}) 500ms × 100             ← ④【建议改 panelReady 主动通知】
   │
   ├─ 成功 → master[contentWindowId] = panelWindowId          ← ⑤
   │          首个 Panel 时 createKrMenus() 建 17 条右键菜单
   ▼
tabs.sendMessage(panelTabId, {selfWindowId, commWindowId})   ← ⑥ background.js:92-98
   │
   ▼
Panel: contentWindowIdListener 收到
   ├─ extCommand.setContentWindowId()
   ├─ recorder.setOpenedWindow() / setSelfWindowId()
   └─ runtime.onMessage.removeListener(自己)  ← 一次性握手 editor.js:79-88
```

### 7.2 录制上行 + frameLocation 差分补 selectFrame

```
【页面加载时】Content 构造
   └─ sendMessage({frameLocation:"root:0"})   ← content/recorder.js:26-31
          └─ Panel: setFrame(sender.tab.id, loc, sender.frameId)  ← window-controller.js:45-49

【用户点击元素】MAIN world recorder.record()
   │
   ├─ target[0] 含 'popupInjectionKR'？ 是→丢弃（不录浮层自身）  ← content/recorder.js:104
   ▼
runtime.sendMessage({command,target,value,frameLocation})       ← content/recorder.js:102-118
   │  （广播，无 tabId）
   ▼
Panel: addCommandMessageHandler(message, sender)                ← recorder.js:362-372
   │
   ├─ openedTabIds 为空？（首次）                                ← recorder.js:212-224
   │     ├─ openedTabNames["win_ser_local"] = sender.tab.id
   │     └─ 无命令时补 addCommandAuto("open",[[sender.tab.url]])
   │
   ├─ message.frameLocation !== 当前记录的 frameLocation？        ← recorder.js:271-293
   │     │
   │     │  old="root:0:1"  new="root:2"
   │     ├─ while(old.len > new.len) → selectFrame relative=parent  ×2
   │     └─ while(old.len < new.len) → selectFrame index=2
   │
   ▼
addCommand(command, target, value) → 写入命令表格
```

**差分推演对照**：

| 上一条所在 frame | 本条所在 frame | 自动插入 |
|---|---|---|
| `root` | `root:0` | `selectFrame index=0` |
| `root:0:1` | `root:0` | `selectFrame relative=parent` |
| `root:0:1` | `root:2` | `selectFrame relative=parent` ×2 → `selectFrame index=2` |

### 7.3 回放下行 + retryUntilSuccess 有界重试

```
Panel: sendCommand(command, target, value, top)      ← window-controller.js:142-156
   │
   ├─ tabId = getCurrentPlayingTabId()
   ├─ frameId = top ? 0 : getCurrentPlayingFrameId()
   ▼
retryUntilSuccess(fn, 60, 500)   ← 最多 60 次 × 500ms = 30 秒上限
   │
   ├───► fn 第 n 次尝试
   │        │
   │        ├─ tabs.get(tabId) → tab.status !== 'complete'？
   │        │     └─是→ throw 'The target tab is not ready' → 等 500ms 重来
   │        │
   │        ├─ tabs.sendMessage(tabId, {commands,target,value}, {frameId})
   │        │     └─ 抛 "Receiving end does not exist" → 等 500ms 重来
   │        │        （页面还在加载，content script 尚未注入）
   │        ▼
   │      成功 → 返回 Content 的响应
   │
   └─ 60 次仍失败 → reject，回放报错

【Content 侧】command-receiver.doCommands(request)     ← command-receiver.js:49-77
   ├─ commands == "waitPreparation" / "prePageWait" → 特判分支
   ├─ commands == "captureEntirePageScreenshot"
   │      └─ 转发 runtime.sendMessage → SW tabs.captureVisibleTab   ← background/kar.js:159-169
   └─ 其余 → selenium["do" + 首字母大写(commands)](target, value)
```

---

## 8. 边界与异常

| 场景 | 行为 | 依据 / 复刻建议 |
|---|---|---|
| 目标 tab 已关闭 | `tabs.get` reject → `retryUntilSuccess` 耗尽 60 次后报错（浪费 30 秒） | `window-controller.js:142-156`。建议：先判 `tabs.get` 是否 `No tab with id` 并**立即终止**，不重试 |
| 页面还在加载，content script 未注入 | `Receiving end does not exist` → 自动重试至成功 | `window-controller.js:142-156`（这是该重试机制的**主要设计目标**） |
| 页面不允许注入（`chrome://`、Web Store、`moz-extension:`） | 永远注入不了，重试必然耗尽 | 特权页判定：`panel/js/background/recorder.js:346-352`。建议录制/回放前先做一次白名单校验并明确报错 |
| iframe 跨域 | 无影响——content script 按 frame 独立注入，靠 `sender.frameId` 与 `frameLocation` 定位，不依赖 `contentWindow` 访问 | `window-controller.js:45-49`、`recorder.js:271-293` |
| iframe 在录制中途被移除/重建 | `frameId` 变化，旧 frameId 定向消息失败 | 未在源码中找到专门处理。建议：`webNavigation.onCommitted` 时刷新 frame 表 |
| SW 被回收后唤醒 | `master`、`port`、`popupWindowIDs` 全部丢失 → 同一窗口会再开一个 Panel | `background/background.js:18`（内存变量）。**必须改 `chrome.storage.session`** |
| 无 Panel 时点右键菜单 | `port` 为 `undefined`，`port.postMessage` 抛 TypeError | `background/background.js:228-235`。改 `Map` + 判空 |
| 多 Panel 并存 | 后连接的 `port` 覆盖前者，右键断言全部发到最后一个 Panel | 同上。改 `Map<windowId, Port>` |
| Panel 窗口被用户关闭 | `windows.onRemoved` 删 `master` 项；最后一个 Panel 关闭时 `contextMenus.removeAll()` | `background/background.js:110-120`。⚠️ `popupWindowIDs` 未同步 splice，`focusPanel()` 对已关窗口调 `windows.update` 会抛未捕获 rejection |
| 回放中新建窗口 | `getBackgroundPage()` 必然 reject 且**无 `.catch`** → SW 侧 `master` 不更新 → 该窗口点图标会再开一个 Panel | `panel/js/background/window-controller.js:326-331`。改用 `runtime.sendMessage` 通知 SW |
| MAIN world 脚本顺序被改 | `browser-polyfill-page.js` 因 `chrome.runtime.id` 为空直接 `throw`，整个 MAIN world 录制失效 | `manifest.bak.json:74-81` |
| 同页第三方脚本伪造 RPC 帧 | 只要发 `{type:"connect", key:"pandoraboz"}` 即可建立连接，随后完整读写 `chrome.storage` | `common/remote-object-helper-*.js`。**P0 安全缺陷**，见 FR-12 |
| 页面启用 Trusted Types | 直接 `innerHTML` 会被拒 → 浮层渲染失败 | `content/inject-popup-record.js:48-76` 用 `trustedPolicy.createHTML` 兼容 |
| 页面 CSS 覆盖浮层样式 | 浮层错位/不可见 | `content/inject-popup-record.js:19-38` 全部样式加 `!important` + `z-index: 99999999` |
| 浮层自身被录进脚本 | 生成 `click popupInjectionKR` 垃圾命令 | `content/recorder.js:104` 过滤 |
| 双击扩展图标 | `windows.create` 异步，无节流会开两个窗口 | `background/background.js:29-106` `clickEnabled` 1 秒节流 |
| Edge 浏览器 | 被 `get-browser-name.js` 判成 "Chrome"（`isEdgeChromium` 是死代码）；bowser 侧靠 `:159-164` 先判 `edg` 才正确 | `common/get-browser-name.js:43-60`、`panel/js/katalon/bowser.js:159-164` |
| Chrome 版本号显示不全 | `150.0.7204.100` → `150.0` | `panel/js/katalon/bowser.js:274-279` 正则 `(\d+(\.\d+)?)` |
| SW 中调用 `XMLHttpRequest` | `undefined`，抛 ReferenceError | `katalon/background.js:138-179`（所幸唯一调用者已被注释于 `:192-193`，实际走 WebSocket `:210-215`） |

---

## 9. 验收用例

| ID | 用例 | 预期 | 对应 FR |
|---|---|---|---|
| AC-1 | 点击扩展图标 | 弹出独立 popup 窗口，尺寸为上次记忆值（首次 1080×630） | FR-15/FR-18 |
| AC-2 | 快速双击扩展图标 | 只弹出 1 个窗口 | FR-17 |
| AC-3 | 同一窗口再次点击图标 | 不新开，仅聚焦已有 Panel | FR-16 |
| AC-4 | 开两个浏览器窗口分别点图标 | 得到 2 个 Panel，各自录制互不串扰 | FR-16/NFR-4 |
| AC-5 | Panel 打开后打印握手日志 | 收到 `{selfWindowId, commWindowId}` 且监听器已摘除（再发同类消息无响应） | FR-2 |
| AC-6 | 在主页面点击按钮录制 | 脚本首行为 `open <url>`，窗口别名为 `win_ser_local` | FR-6 |
| AC-7 | 进入 iframe（index=0）点击 | 自动插入 `selectFrame index=0`，随后才是 `click` | FR-4/FR-5 |
| AC-8 | 从 `root:0:1` 跳到 `root:2` | 插入 2 条 `selectFrame relative=parent` + 1 条 `selectFrame index=2` | FR-5 |
| AC-9 | 回放时目标页正在加载 | 命令自动等待重试，加载完成后成功执行，不报 `Receiving end does not exist` | FR-7 |
| AC-10 | 回放时目标 tab 被手动关闭 | 在明确的超时/错误信息下终止，不静默挂起 | FR-7/边界表 |
| AC-11 | 在被测页面 console 执行 `postMessage({source:'x',type:'connect',key:'pandoraboz'},'*')` | **无法建立 RPC 连接**（复刻版用随机 nonce + origin 校验） | FR-12 |
| AC-12 | 打乱 MAIN world 脚本注入顺序 | 构建期测试失败并给出明确提示 | FR-14/NFR-6 |
| AC-13 | 录制中查看被测页面 | 出现可拖拽浮层「正在录制」+ Stop 按钮，且浮层自身不被录入脚本 | FR-21 |
| AC-14 | 在启用 Trusted Types 的页面录制 | 浮层正常渲染，无 CSP/TT 报错 | FR-21 |
| AC-15 | 查看启动日志 | 浏览器版本为完整四段（如 `150.0.7204.100`），Edge 不被误报为 Chrome | FR-22/FR-24 |
| AC-16 | 检查 `dist/manifest.json` | 无 `default_popup`、无 `debugger`/`offscreen` 权限、CSP 为 `script-src 'self'; object-src 'self'`、无 `externally_connectable` | FR-15/FR-26/FR-28/FR-29/FR-30/NFR-5 |
| AC-17 | 全局搜索源码 | 无 `getBackgroundPage`、无 `XMLHttpRequest`、无 `chrome.extension.` | FR-25 |
| AC-18 | 执行 `storeEval` 命令 | 表达式在 sandbox iframe 中求值成功，扩展页 CSP 不含 `unsafe-eval` | FR-27 |
| AC-19 | 关闭最后一个 Panel 后重开 | 右键菜单被正确移除又重建，`popupWindowIDs` 无残留 id | FR-19 |
| AC-20 | 无 Panel 时点右键断言菜单 | 静默忽略或给出提示，不抛未捕获异常 | FR-10 |

---

## 10. Out of Scope（不在本次范围）

- **Object Spy 独立通道**：`katalon/background.js:84,105,288,319` 的 `action`/`request`/`srcTabId` 消息族与 `katalon/chrome_common.js:27` 的 HTTP 转发（Chrome 50000 / Firefox 50001 端口分叉，`katalon/chrome_common.js:18`）——属于 Katalon Studio 联动，个人插件整块删。
- **第三方扩展生态**：`externally_connectable` + `katalon_recorder_register` / `katalon_recorder_export` 能力注册与 2 分钟 ping 淘汰（`background/kar.js:267-322`）。
- **埋点与指纹**：`background/segment-tracking-services.js`、Offscreen 的 FingerprintJS（`common/offscreen.js:1-29`）。
- **安装引导链路**：`background/install.js:17-33` 首装开欢迎页 + `pages/welcome/welcome.js:1-12` 的 `open-panel` → 延时 1 秒 → 跳登录。个人插件无账号体系。
- **设置窗口 / 登录窗口**：`panel/js/katalon/kar.js:229-250`、`panel/js/UI/services/auth-service/auth-service.js:21-28`（第四、五种弹框，仅确认存在）。
- **CDP 内部细节**：`DOM.getFlattenedDocument` 的 `krId` 属性匹配算法（`background/kar.js:197-238`）在放弃 `debugger` 权限后无需实现。
- **`remote-object-helper-*.js` 打包产物逐行反混淆**：97155 字节，仅蒸馏了握手/帧格式/校验三处关键片段，Proxy 代理的完整序列化协议未展开。
- **Firefox 全量适配**：仅记录了兼容痕迹（`manifest.json:6-10` gecko id、`panel/js/background/recorder.js:346-352`、`panel/js/background/window-controller.js:342-348,369-375`），未做实测。

---

*文档完。功能点均可在 `7.1.0_0` 源码按实现位置列核对；机制细节见 `_distill/tech/TECH-05-通信兼容与弹框.md`。*
