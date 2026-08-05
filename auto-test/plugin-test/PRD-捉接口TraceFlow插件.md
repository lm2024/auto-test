# 捉接口 TraceFlow 插件 PRD（产品需求文档）

> 文档范围：仅限 `auto-test/plugin-test/` 浏览器插件目录，不涉及后端 / 前端等其他模块。
> 插件名称：**捉接口 TraceFlow**（Chrome MV3 扩展）
> 当前版本：v1.1.0

---

## 1. 产品概述

### 1.1 背景
API 自动化测试平台需要一条"从真实业务操作到测试用例"的最短路径。传统方式依赖开发手动抓包、整理接口、手工录入平台，效率低且易遗漏业务上下文。

本插件作为平台的**采集端**，安装在测试 / 开发人员的浏览器中，在真实业务页面上无侵入地录制网络请求与用户操作，并将录制结果一键推送至自动化测试平台，形成"录制 → 组织 → 推送 → 回放"的闭环。

### 1.2 目标用户
- 测试工程师：录制业务链路，生成可回放的接口用例。
- 前端 / 后端开发：抓取页面真实请求，辅助联调与文档生成。
- 技术负责人：沉淀标准业务链路，进行版本对比与回归。

### 1.3 核心价值
- **零代码抓取**：无需 Fiddler / Charles，无需手写请求。
- **业务上下文还原**：通过"操作窗口"将零散请求按用户操作自动分组。
- **一键入平台**：录制结果直接成为平台中的链路（Chain）用例。
- **双向回放**：既可在插件内 HTTP 回放，也可浏览器内模拟操作回放（宏回放）。

---

## 2. 功能需求

### 2.1 接口录制（核心）
| 需求项 | 说明 |
|---|---|
| 录制范围 | 页面所有 HTTP(S) 请求（fetch / XHR / form 提交），通过 CDP `Network` 域 + 页面内 `fetch`/`XHR` 代理双通道捕获 |
| 采集字段 | URL、Method、请求头、请求体、响应头、响应体（自动 JSON 解析）、状态码、耗时、时间戳、资源类型 |
| 去重 | 同一 URL + Method + 2 秒内视为重复，不重复存储 |
| 静态资源过滤 | 脚本 / 样式 / 图片 / 字体 / 媒体 / 文档类按 `resourceType` 标记，保存时过滤 `static` 类型 |
| 录制开关 | 侧边栏「开始 / 停止录制」按钮，同时启动接口录制与宏录制 |

### 2.2 业务操作窗口（Trace 窗口）
- 目的：将"用户一次操作触发的若干请求"聚合为一组，还原业务语义。
- 机制：用户点击 / 选择 / 回车 / 提交时激活一个时间窗口（`WINDOW_MS=3000ms`，最大 `MAX_WINDOW_MS=5000ms`）。
- 窗口内所有请求被打上 `bizOperTraceId`、`windowId`、`triggerEvent`（click/change/keydown/submit）、`targetDom`、`pageUrl`。
- 停止录制或窗口超时后窗口关闭，后续请求归入新窗口或"未分组"。
- 侧边栏实时显示窗口激活状态与剩余秒数。

### 2.3 宏操作录制与回放
- **录制**：监听 click / input / change / submit / Enter，记录元素选择器、文本、值、页面 URL，生成有序操作序列。
- **选择器生成**：优先 id → name → data-testid → 去噪 class（过滤 active/show 等状态类）→ 父子链 `:nth-of-type`。
- **回放（浏览器宏回放）**：在目标页面按选择器模拟真实事件（mousedown/up/click、input、change、原生 value setter 绕过 React 受控组件），支持等待元素出现（MutationObserver）、等待页面加载、逐步延时。
- **HTTP 回放**：按链路节点的顺序 / 并行组，用 `fetch` 重放请求，记录响应与耗时。

### 2.4 认证信息提取（Auth Token 捕获）
- 录制期间自动从以下来源提取 token：
  - 响应头 `Set-Cookie` 中的 token/session/jwt 等
  - 请求头 `Authorization: Bearer`
  - URL query：`access_token` / `code` / `ticket`
  - 响应体字段：`token` / `access_token` / `refresh_token` / `id_token`
- JWT 解析 `exp` 用于过期判断。
- 提取结果存入 `capturedTokens`，侧边栏设置页可查看 / 清除。

### 2.5 加解密沙箱（Phase 4）
- 加密响应 / 请求体的解密在独立 `sandbox.html`（`sandbox="allow-scripts"`）中执行，主世界代码以 `new Function` 运行用户配置的 JS 解密函数。
- 配置项：是否启用、请求解密函数、响应解密函数、算法标识（默认 AES）。
- 通过 `postMessage` 与主世界通信，5s 超时兜底。

### 2.6 过滤与设置
| 设置项 | 说明 |
|---|---|
| 过滤模式 | `off`（全录）/ `ignore`（命中关键词或域名不录）/ `whitelist`（仅录命中项） |
| 忽略关键词 / 域名 | 按行分隔，域名支持子域匹配 |
| 平台后端地址 | `platformUrl`（默认 `http://localhost:9093`） |
| 平台前端地址 | `frontendUrl`（默认 `http://localhost:9094`） |
| 节点 ID 模式 | 自增 / 步长（`idMode` / `idStep`） |
| 版本模式 | 自动 / 手动（`versionMode`） |
| 回放超时 / 间隔 | `replayTimeout` / `replayInterval` |
| 失败策略 | 继续 / 中止（`failStrategy`） |
| 并行分组 | 是否启用分组并行（`enableParallelGroup`） |

### 2.7 平台交互（推送 / 列表 / 回放）
- **推送**：勾选接口后推送至平台 `/api/plugin/chain/create` 或 `/api/plugin/chain/append`。
  - 单组 / 未分组 → 一条链路。
  - 多 Trace 组 → 拆分多条链路（按 `triggerEvent + traceId` 后缀命名）。
  - 含宏操作 → 追加一个 `MACRO` 类型节点。
- **链路列表**：从 `/api/plugin/chain/list` 拉取，展示名称、版本、节点数、执行模式、编码。
- **版本对比**：`/api/chain/versions` 拉取各版本 diffSummary（新增 / 删除 / 修改计数）。
- **跳转平台**：推送成功后可一键跳转 `/chain/edit/{chainCode}` 或 `/chain/list`。

### 2.8 导出与文档
- **导出 JSON**：勾选接口导出为 `{ chainName, interfaceList[] }` 结构。
- **生成 OpenAPI**：单接口生成 OpenAPI 3.0 spec，复制到剪贴板。
- **生成 API 文档**：按 `Method + path` 聚合，生成可打印的 HTML 文档（含请求体 / 响应体 / 响应头）。

### 2.9 平台登录鉴权
- 支持账号密码 + 验证码登录（`/api/user/login`），令牌存 `platformAuth`。
- 支持「同步平台登录态」：从已登录的同源平台页面读取 `localStorage.autotest_token/user`。
- JWT `exp` 本地预检 + 后端 `/api/user/me` 权威校验。
- 状态机：`ANONYMOUS` / `AUTHED` / `EXPIRED` / `MISMATCH`（环境不符）。
- 401 自动弹出登录框，登录后自动重放原请求（防死循环：重放时强制不弹窗）。

### 2.10 调试器
- 侧边栏内置单接口调试器：编辑 URL / Method / Header / Body，发送并显示状态码、耗时、响应体。

---

## 3. 非功能需求

| 类别 | 要求 |
|---|---|
| 兼容性 | Chrome / Edge（MV3），`<all_urls>` 主机权限 |
| 性能 | 录制基于事件驱动，存储于 `chrome.storage.local`；侧边栏通过 storage 变更事件增量刷新 |
| 安全 | 解密代码隔离在沙箱；读取平台登录态限定同源；令牌仅存本地 |
| 健壮性 | 所有跨进程消息均做 `chrome.runtime.lastError` 兜底；`Extension context invalidated` 全局忽略 |
| 离线 | 无 Google Fonts 依赖（系统字体栈兜底），可内网部署 |
| 权限最小化 | debugger / storage / sidePanel / tabs / scripting / activeTab |

---

## 4. 用户流程

```
1. 安装插件 → 点击图标打开侧边栏
2. 设置 → 配置平台后端/前端地址、过滤规则
3. 登录平台（账号密码 或 同步登录态）
4. 开始录制 → 在业务页面操作（点击/输入/提交）
5. 停止录制 → 查看按 Trace 窗口分组的接口列表
6. （可选）编辑节点名 / 删除 / 调试 / 生成文档
7. 推送至平台 → 形成链路用例（含宏操作节点）
8. 在链路 Tab 选择链路 → HTTP回放 或 浏览器宏回放 → 查看日志
```

---

## 5. 验收标准（ATC）
1. 开启录制后，业务页面上的 fetch/XHR 请求在 1s 内出现在侧边栏列表。
2. 单次点击触发的多个请求被聚合在同一 Trace 窗口分组下。
3. 停止录制后，未分组的请求单独显示，不影响已分组数据。
4. 推送成功后平台出现对应链路，节点数 = 勾选接口数（+1 宏节点如有）。
5. HTTP 回放逐节点执行，日志显示每节点状态码与耗时。
6. 浏览器宏回放能在目标页复现操作并重新捕获接口。
7. 未登录状态下访问受保护接口时，弹出登录框且登录后可自动重放。
8. 解密配置正确时，加密响应在存储前被解密为明文。

---

## 6. 范围边界
- **包含**：本插件全部采集、组织、推送、回放、鉴权、加解密能力。
- **不包含**：平台后端的链路存储 / 执行引擎 / 报告生成（属后端模块）；平台前端的链路编辑 UI（属 frontend 模块）。
- 插件与平台的契约接口：`/api/plugin/chain/create`、`/api/plugin/chain/append`、`/api/plugin/chain/list`、`/api/plugin/chain/detail`、`/api/chain/versions`、`/api/user/login`、`/api/user/me`、`/api/captcha`。
