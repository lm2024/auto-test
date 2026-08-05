# 捉接口 TraceFlow 插件技术架构文档

> 文档范围：仅限 `auto-test/plugin-test/` 浏览器插件目录。
> 类型：Chrome 扩展 Manifest V3（MV3），服务工作者（Service Worker）架构。
> 版本：v1.1.0

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│  浏览器业务页面 (Web Page)                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ content.js  (注入页面上下文，常驻监听)                  │  │
│  │   ├─ 监听后台消息 → postMessage 给 inject.js           │  │
│  │   ├─ 宏录制器 macroRecorder (click/input/change/...)   │  │
│  │   └─ 宏回放器 macroReplayer (模拟事件 + 等待)          │  │
│  │   └─ 注入 inject.js (page world)                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ inject.js  (page world，无扩展 API 权限)               │  │
│  │   ├─ 代理 window.fetch / XMLHttpRequest / form.submit  │  │
│  │   ├─ 注入 X-Biz-Oper-Trace 请求头                      │  │
│  │   ├─ 打 bizOperTraceId 等业务元数据                    │  │
│  │   └─ 加解密 (运行用户代码，隔离于页面)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        │  postMessage(window)        │  chrome.runtime.sendMessage
        ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│  background.js  (Service Worker)                              │
│  ├─ chrome.debugger 捕获 (CDP Network 域, 全量补充)          │
│  ├─ 窗口状态机 (Trace Window)                                │
│  ├─ 消息中枢 (onMessage 路由所有指令)                        │
│  ├─ 存储管理 (chrome.storage.local: recordedApis/macroActions)│
│  ├─ Auth Token 提取                                          │
│  ├─ 加解密沙箱调度 (sandbox.html)                            │
│  └─ 平台登录态同步 (SYNC_PLATFORM_TOKEN)                     │
└─────────────────────────────────────────────────────────────┘
        │  chrome.runtime.sendMessage / storage.onChanged
        ▼
┌─────────────────────────────────────────────────────────────┐
│  sidepanel.html + sidepanel.js  (侧边栏 UI)                   │
│  ├─ 录制列表 / Trace 分组渲染 / 过滤 / 搜索                  │
│  ├─ 设置面板、登录面板、调试器、推送对话框                   │
│  ├─ 链路列表 / 版本对比 / 回放日志                           │
│  └─ 依赖 auth.js + platform-api.js (纯逻辑模块)             │
└─────────────────────────────────────────────────────────────┘
        │  PlatformApi.apiFetch (fetch + Bearer Token)
        ▼
┌─────────────────────────────────────────────────────────────┐
│  自动化测试平台后端 (http://<platformUrl>)  ← 不在本插件范围  │
└─────────────────────────────────────────────────────────────┘
```

**关键设计点**：扩展有三个隔离的执行环境——
1. **Service Worker**（background.js）：唯一拥有 debugger/storage 等特权 API，作为消息中枢。
2. **Content Script**（content.js）：隔离的扩展上下文，能访问 DOM 与 `chrome.runtime`，但**不能**访问页面 JS 全局变量。
3. **Page World**（inject.js）：通过 `<script>` 注入，能访问页面原生 `fetch`/`XHR`，但**不能**用 `chrome.*` API。两世界通过 `window.postMessage` 桥接。

---

## 2. 模块职责

### 2.1 `manifest.json`
- `manifest_version: 3`，`background.service_worker: background.js`。
- `content_scripts`：`<all_urls>` + `document_start` 注入 `content.js`。
- `web_accessible_resources`：暴露 `inject.js` / `sandbox.html` 给页面。
- 权限：`storage`、`sidePanel`、`debugger`、`activeTab`、`tabs`、`scripting`；主机权限 `<all_urls>`。

### 2.2 `background.js`（Service Worker）
| 子系统 | 职责 |
|---|---|
| 窗口状态机 | `activateWindow` / `closeWindow` / `resetWindowTimer`，管理 `currentTrace`、`windowState` |
| CDP 捕获 | `attachDebugger` 挂 `Network.enable`；`onEvent` 监听 `requestWillBeSent` / `responseReceived`，`getResponseBody` 取响应体 |
| 消息路由 | `chrome.runtime.onMessage` 处理 20+ 类型指令（见 §4） |
| 存储 | `recordedApis`、`macroActions`、`settings`、`isRecording*`、`bizTraceState`、`encryptConfig`、`capturedTokens` |
| Token 提取 | `extractAuthTokens` / `extractTokensFromBody`，覆盖头/体/URL/Set-Cookie |
| 沙箱调度 | `initSandbox` / `decryptInSandbox`，经 `sandbox.html` 执行用户解密代码 |
| 过滤 | `shouldCapture`（off/ignore/whitelist）、`getType`（static/track/api） |
| 登录同步 | `SYNC_PLATFORM_TOKEN`：在同源已登录标签页 `executeScript` 读 `localStorage` |

### 2.3 `content.js`（Content Script）
- 注入 `inject.js` 到页面，并转发 `inject.js` 的 `postMessage` 到 background（`SAVE_API` / `TRIGGER_INTERACTION`）。
- `macroRecorder`：监听 DOM 事件记录操作；`macroReplayer`：按选择器模拟事件回放。
- 接收 background 指令：`START/STOP_RECORDING`、`*_MACRO_*`、`START/STOP_MACRO_REPLAY`、`BIZ_TRACE_UPDATE`。
- 全局忽略 `Extension context invalidated` 错误，防止页面崩溃。

### 2.4 `inject.js`（Page World）
- 代理 `window.fetch` 与 `XMLHttpRequest.prototype.open/send/setRequestHeader`，以及 `form.submit`。
- 在请求头注入 `X-Biz-Oper-Trace`（TraceId），在保存数据上附加 `bizOperTraceId` / `triggerEvent` / `targetDom` / `pageUrl`。
- 监听 `AUTOTEST_RECORDING_STATE` / `AUTOTEST_BIZ_TRACE_UPDATE` / `AUTOTEST_ENCRYPT_CONFIG`。
- 加解密：若 `encryptConfig.enabled`，用 `new Function` 运行用户解密函数处理 body / response。
- 通过 `postMessage({type:'AUTOTEST_API_REQUEST'})` 回传 content.js。

### 2.5 `sidepanel.html` + `sidepanel.js`（UI）
- 三个 Tab：**录制**（接口列表 + Trace 分组 + 过滤 + 搜索 + 调试 + 文档 + 推送 + 导出）、**链路**（列表 / 版本对比 / 回放入口）、**回放日志**（HTTP / 浏览器回放实时日志 + 暂停 / 停止）。
- 纯前端渲染，无框架（原生 DOM），通过 `chrome.storage.onChanged` 增量刷新列表。
- 依赖 `auth.js` 与 `platform-api.js`。

### 2.6 `auth.js`（登录态模块，无 DOM / 无网络）
- `window.PlatformAuth`：令牌存储 (`platformAuth`)、JWT `exp` 解析、`getState`（ANONYMOUS/AUTHED/EXPIRED/MISMATCH）、`onChange` 跨标签页同步。
- 仅本地预检，不验签；权威校验在后端。

### 2.7 `platform-api.js`（请求网关，无 DOM）
- `window.PlatformApi.apiFetch`：URL 拼装、Bearer Token 注入、401 拦截（弹登录 → 重放）、错误归一（NO_BASE_URL / NETWORK / UNAUTHORIZED / BIZ）。
- `waitForLogin`：并发 401 复用同一 Promise，只弹一次登录框；重放时 `retryOn401:false` 防死循环。

### 2.8 `sandbox.html`（加解密沙箱）
- 仅 `<script>` 监听 `postMessage`，以 `new Function('data', 'return (code)(data)')` 执行解密函数，结果回传父窗口。
- `sandbox="allow-scripts"`：隔离主世界，避免恶意 / 出错解密代码污染页面。

---

## 3. 数据流

### 3.1 录制数据流
```
页面请求
  ├─ (inject.js) fetch/XHR 代理 → 打 Trace 元数据 → postMessage
  │     └─ content.js → chrome.runtime.sendMessage(SAVE_API) → background.saveApi → storage.recordedApis
  └─ (background.js) chrome.debugger CDP → onEvent(Network.responseReceived)
        → getResponseBody → extractAuthTokens → saveApi → storage.recordedApis
```
> 双通道互补：inject.js 覆盖页面内 JS 发起的请求（含 body），CDP 补充无法代理的场景（如原生 WebSocket / 部分子资源）。

### 3.2 推送数据流
```
sidepanel.getChecked() → buildInterfaceList()
  → 按 bizOperTraceId 分组
  → PlatformApi.apiFetch('/api/plugin/chain/create|append')
  → 成功返回 chainCode → 可选跳转平台
```

### 3.3 回放数据流
- **HTTP 回放**：`httpReplay` 按 `sortNo` 排序节点，`fetch(node.requestUrl, {headers, body})`，记录响应 / 耗时 / 状态。
- **浏览器宏回放**：打开 `origin` 页 → `START_RECORDING` → 向 content.js 发 `START_MACRO_REPLAY` → 页面内 `macroReplayer` 逐步模拟 → 完成写 `macroReplayResult` → 侧边栏切回录制 Tab。

---

## 4. 消息协议（background ↔ content ↔ inject ↔ sidepanel）

### 4.1 指令清单（background.onMessage）
| type | 来源 | 说明 |
|---|---|---|
| `START_RECORDING` / `STOP_RECORDING` | sidepanel | 启停录制（接口 + 宏） |
| `TRIGGER_INTERACTION` | inject→content→bg | 用户操作激活 Trace 窗口 |
| `WINDOW_EXTEND` / `GET_BIZ_TRACE_STATE` | sidepanel | 窗口延长 / 查询 |
| `*_MACRO_RECORDING` / `SAVE_MACRO_ACTION` / `GET_MACRO_ACTIONS` / `CLEAR_MACRO_ACTIONS` | content/sidepanel | 宏录制控制 |
| `START_MACRO_REPLAY` / `STOP_MACRO_REPLAY` / `MACRO_REPLAY_DONE` | content/sidepanel | 宏回放控制 |
| `SAVE_API` / `CLEAR_APIS` / `DELETE_API` / `UPDATE_API_NAME` | content/sidepanel | 接口存储 |
| `GET_STATUS` / `GET_AUTH_CONTEXT` | sidepanel | 状态 / Token 查询 |
| `SYNC_PLATFORM_TOKEN` | sidepanel | 同步平台登录态 |
| `DECRYPT_DATA` / `SAVE_ENCRYPT_CONFIG` / `GET_ENCRYPT_CONFIG` | sidepanel | 加解密配置 |
| `HIDE_SIDE_PANEL` | sidepanel | 关闭侧边栏 |

### 4.2 inject ↔ content（window.postMessage）
- `AUTOTEST_API_REQUEST` → content 转 `SAVE_API`
- `AUTOTEST_TRIGGER_INTERACTION` → content 转 `TRIGGER_INTERACTION`
- `AUTOTEST_RECORDING_STATE` / `AUTOTEST_BIZ_TRACE_UPDATE` / `AUTOTEST_ENCRYPT_CONFIG` → inject 接收

---

## 5. 存储结构（chrome.storage.local）

| key | 类型 | 说明 |
|---|---|---|
| `settings` | object | 平台地址、过滤、ID/版本/回放/加密配置 |
| `isRecordingApi` / `isRecordingMacro` | bool | 录制开关 |
| `recordedApis` | ApiRecord[] | 录制接口列表 |
| `macroActions` | MacroAction[] | 宏操作序列 |
| `bizTraceState` | object | 当前 Trace 窗口状态 |
| `platformAuth` | object | `{token, user, exp, boundUrl}` |
| `encryptConfig` | object | 加解密配置 |
| `macroReplayResult` | object | 宏回放结果 |

**ApiRecord 字段**：`url, method, headers, body, status, statusText, responseHeaders, response, duration, timestamp, apiType, resourceType, bizOperTraceId, windowActive, windowId, triggerEvent, targetDom, pageUrl, ignore, nodeName`。

---

## 6. 安全设计
- **特权隔离**：debugger/storage 仅在 Service Worker；页面世界无法调用 `chrome.*`。
- **解密隔离**：用户 JS 在 `sandbox.html`（`allow-scripts`，无同源 DOM 访问）执行。
- **登录态同源**：`SYNC_PLATFORM_TOKEN` 仅读取与 `frontendUrl` 同源标签页的 `localStorage`。
- **令牌本地化**：`platformAuth` 仅存本地，请求时注入 `Authorization: Bearer`。
- **容错**：所有 `chrome.runtime.sendMessage` 检查 `lastError`；`Extension context invalidated` 全局吞掉。

---

## 7. 构建与打包
- 加载方式：Chrome `chrome://extensions` → 开发者模式 → 加载已解压的 `plugin-test/` 目录。
- 参考：`插件打包实操步骤.md`（同目录）。
- 内网部署注意：sidepanel.html 已使用系统字体栈，`Noto Sans SC` 缺失时自动降级，不白屏。

---

## 8. 关键参数

| 参数 | 默认值 | 位置 |
|---|---|---|
| `WINDOW_MS` | 3000ms | background.js |
| `MAX_WINDOW_MS` | 5000ms | background.js |
| 重复判定窗口 | 2000ms | background.saveApi |
| 沙箱超时 | 5000ms | background.decryptInSandbox |
| 默认后端 | `http://localhost:9093` | sidepanel 设置 |
| 默认前端 | `http://localhost:9094` | sidepanel 设置 |

---

## 9. 已知约束 / 待完善
- CDP `debugger` 需用户授权，且与 DevTools 互斥。
- 宏回放依赖页面 DOM 结构稳定；动态渲染页面可能找不到选择器。
- 解密函数由用户自行提供，插件不做语法 / 安全校验（仅沙箱隔离）。
- 当前无单元测试；逻辑模块（auth.js / platform-api.js）为纯函数可独立测试。
