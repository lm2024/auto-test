# TECH-14 — 鉴权、License 门禁、埋点与营销剥离

> 源码基准：Katalon Recorder 7.1.0（MV3），根目录 `KatalonRecorder/7.1.0_0`
> 本文所有结论均可追溯到 `文件:行号`。凡源码中确实找不到的，明确写「未在源码中找到，推测：…」。
> 本模块是**裁剪时删除量最大、风险最低**的一块：约 **13,900 行代码可以整体删除**，且不影响录制/回放任何核心能力。

---

## 1. 一句话概括

Katalon Recorder 的「账号体系」本质上是**一个 Keycloak OAuth2+PKCE 登录 + 一个只用来染色埋点的 email 字段**；所谓「免费/付费门禁」在 7.1.0 里**已被开发者自己全部注释掉**（`KR-522`），只剩两个「温柔劝导」弹窗；真正有分量的是**跨浏览器指纹追踪体系**（FingerprintJS + 三级持久化 anonymousId + 卸载 URL 回传身份），而它上报的数据里**不包含任何录制 URL 与选择器**——所以剥离它是纯粹的「减法」，没有功能替代成本。

---

## 2. 关键文件清单

### 2.1 鉴权（OAuth / Keycloak）

| 文件 | 行数 | 职责 | 可删 |
|---|---|---|---|
| `panel/js/UI/services/auth-service/auth-service.js` | 64 | Keycloak 端点常量、`getUniversalLoginUrl`/`getToken`/`logout` | ✅ 整删 |
| `utils/generatePKCE.js` | 45 | PKCE code_verifier(128) + SHA-256 challenge | ✅ 整删 |
| `panel/js/UI/controllers/top-toolbar/actions.js` | 171 | 登录按钮 / 登出 / **OAuth 回调劫持** | ⚠️ 部分删（保留 play 按钮分发） |
| `katalon/authenticated.html` | 30 | OAuth redirect 落地页（纯静态提示） | ✅ 整删 |
| `panel/js/UI/services/user-services/UserService.js` | 26 | 读 `checkLoginData` 的薄封装 | ✅ 整删 |
| `panel/js/background/website-login.js` | 143 | **旧版门禁，7.1.0 全文件无人调用（死代码）** | ✅ 整删 |
| `common/jwtJsDecode.js` | 1（压缩） | 解 JWT 取 email | ✅ 整删 |

### 2.2 埋点（Segment / HubSpot / 指纹）

| 文件 | 行数 | 职责 | 可删 |
|---|---|---|---|
| `panel/js/UI/services/tracking-service/segment-tracking-service.js` | 565 | Segment 主服务，导出 47 个 `tracking*` + `Tracker` 类 | ✅ 整删 |
| `panel/js/UI/services/tracking-service/hubspot-tracking-service.js` | 109 | HubSpot 联系人打标（仅登录/注册两个事件） | ✅ 整删 |
| `panel/js/UI/services/tracking-service/playback-local-tracking.js` | 98 | **本地**计数器 `playbackTracking`（不上报，供弹窗阈值用） | ✅ 整删 |
| `panel/js/UI/services/tracking-service/left-side-panel-tracking.js` | 60 | 左侧面板行为聚合 | ✅ 整删 |
| `panel/js/UI/services/tracking-service/popup-tracking.js` | 38 | popup 行为 | ✅ 整删 |
| `panel/js/UI/services/tracking-service/dynamic-testsuite-tracking.js` | 28 | 动态套件行为 | ✅ 整删 |
| `panel/js/UI/services/tracking-service/UsageWatcher.js` | 71 | 本地用量计数（`usage` 键） | ✅ 整删 |
| `background/segment-tracking-services.js` | 91 | **SW 里的 Segment 副本**（MV3 不能动态 import） | ✅ 整删 |
| `common/browser-fingerprint2.js` | **9346** | FingerprintJS 全量库 | ✅ 整删 |
| `common/get-browser-fingerprint.js` | 29 | offscreen 侧取 visitorId | ✅ 整删 |
| `common/get-browser-fingerprint-background.js` | 37 | SW 侧封装 `getTrackingBrowserIds` | ✅ 整删 |
| `common/get-anonymous-id.js` | 16 | uuid + 持久化 | ✅ 整删 |
| `common/persistent-store.js` | 68 | **local > sync > cookie 三级持久化** | ✅ 整删 |
| `common/offscreen-server.js` + `common/offscreen.js` + `panel/offscreen.html` | 75+29+4 | offscreen 文档，**只服务于指纹与 browserName** | ✅ 整删 |
| `panel/js/UI/controllers/tracking/add-tracking-handler.js` | 159 | 把 21 个 tracking 绑到 UI 事件 | ✅ 整删 |
| `panel/js/UI/controllers/dialog/welcome-tracking.js` | 63 | 欢迎页埋点 | ✅ 整删 |

### 2.3 营销 / 弹窗 / 云端

| 文件 | 行数 | 职责 | 7.1.0 是否活跃 |
|---|---|---|---|
| `content-marketing/panel/login-inapp.js` | 660 | 内嵌登录表单 + `checkLoginOrSignupUserForCreateTestCase` | ⚠️ 仅 `getCheckLoginData` 被引用 |
| `content-marketing/panel/popup-sharing.js` | 533 | 社交分享（**截图上传第三方端点**） | ✅ 活跃（index.html:1020） |
| `content-marketing/socket-io/socket-io.min.js` | 526 | socket.io 库，**全仓无 import** | ❌ 纯死代码 |
| `content-marketing/panel/popup-rate-us.js` | 200 | NPS 评分弹窗 | ✅ 活跃（index.html:1030） |
| `content-marketing/panel/popup-chrome-store.js` | 112 | 商店好评 | ❌ 已注释（index.html:1026） |
| `content-marketing/panel/popup-promote-signup.js` | 108 | **唯一活跃的注册劝导弹窗** | ✅ 活跃（2 处 import） |
| `content-marketing/panel/popup-what-are-you-automating.js` | 97 | onboarding 问卷 | ❌ 已注释（index.html:1027） |
| `content-marketing/panel/popup-play-suite-quota.js` | 85 | **套件回放配额门禁** | ❌ 调用点全注释 |
| `content-marketing/panel/self-healing-rating.js` | 83 | 自愈满意度 | ✅ 活跃（index.html:1024） |
| `content-marketing/panel/popup-sample-data.js` | 82 | 示例数据引导 | 未在 index.html 找到引用 |
| `content-marketing/panel/popup-create-dynamic-test-suite.js` | 21 | 动态套件门禁 | ❌ 调用点已注释 |
| `content-marketing/panel/converttosimage.js` | 19（压缩） | html2canvas 1.0.0-rc.7 | ✅ 活跃（index.html:1017） |
| `content-marketing/content/sharing-social.js` | 62 | 已打包进 `bundles/content.2.bundle.js` | ✅ 活跃（manifest:34-40） |
| `panel/js/katalon/kar-upload.js` | 286 | TestOps 全量备份 + 报告上传 | ✅ 活跃（index.html:1034） |
| `panel/js/UI/services/test-ops-service/test-ops-service.js` | 9 | 15 分钟定时全量备份 | ✅ 活跃 |
| `panel/js/UI/controllers/other-listeners/test-ops.js` | 33 | TestOps 按钮 + 启动定时器 | ✅ 活跃（index.html:967） |

### 2.4 配置来源（manifest）

| manifest.json 行 | 键 | 值 |
|---|---|---|
| 46-50 | `externally_connectable` | `ids:["*"]`，`matches:["https://developer.mozilla.org/*","https://katalon.com/*"]` |
| 51 | `homepage_url` | `https://web-api.katalon.com/`（被当作 API base 用） |
| 53 | `hubspot_url` | `https://web-api.katalon.com/` |
| 59 | `key` | 扩展公钥（**固定扩展 ID**，OAuth redirect_uri 依赖它） |
| 64 | `permissions` | 含 `cookies`（持久化追踪）、`offscreen`（指纹）、`notifications` |
| 68 | `segment_url` | `https://backend.katalon.com/api` |
| 71-74 | `web_accessible_resources` | 含 `katalon/authenticated.html` |

---

## 3. 核心机制逐层拆解

### 3.1 三套并存、互不同步的「身份」概念

这是理解本模块的第一把钥匙。源码里同时存在 **3 个身份存储键**，来自 3 个历史阶段，彼此**没有单一真相源**：

| storage 键 | 结构 | 写入方 | 读取方 |
|---|---|---|---|
| `segment` | `{ userId: <anonymousId>, user: <email> }` | `setSegmentUser()`（segment-tracking-service.js:6-10）、`trackingSegment` 首次兜底（:66-81） | 顶栏显示（actions.js:106-114）、卸载 URL（install.js:46-54） |
| `checkLoginData` | `{ recordTimes, playTimes, hasLoggedIn, isActived, user }` | `setUserAfterLogin`（actions.js:54-68）、`logout`（:23-26） | `UserService.getLoginInfo()`（UserService.js:14-22）、弹窗阈值 |
| `hubspot` | `{ user: <email> }` | `setHubspotUser()`（hubspot-tracking-service.js:15-27） | `trackingHubspot`（:60-94） |

三者在登录时被**顺序写入**（`actions.js:59-67`），但没有事务；任一步失败就会出现 `segment.user` 有值而 `checkLoginData.isActived=false` 的半登录态。而顶栏显示逻辑要求**两者同时成立**：

```js
// panel/js/UI/controllers/top-toolbar/actions.js:109
if (result.segment?.user && checkedResult.checkLoginData?.isActived) {
```

而 `logout()` 的入口守卫同样要求两者同时成立（`actions.js:19`）——**半登录态会导致既显示不出用户名、又登不出去**，只能清 storage。

> 结构性字段还有第 4 个：`checkLoginData` 的 TypeDef 在两处**不一致**。`website-login.js:32-37` 的默认对象里**没有** `isActived`，而 `UserService.js:16-20` 的默认对象里**没有** `recordTimes/playTimes`。同名键、两套 schema。

### 3.2 OAuth 2.0 Authorization Code + PKCE：完整链路

#### 3.2.1 端点常量

```js
// panel/js/UI/services/auth-service/auth-service.js:3-12
const CLIENT_ID = "katalon-recorder";
export const REDIRECT_URI = `chrome-extension://${chrome.runtime.id}/katalon/authenticated.html`;
const AUTH_BASE_ENDPOINT = "https://login.katalon.com";
const OPENID_CONNECT = AUTH_BASE_ENDPOINT + "/realms/katalon/protocol/openid-connect";
const LOGIN_URL     = OPENID_CONNECT + "/auth";
const LOGOUT_URL    = OPENID_CONNECT + "/logout";
const GET_TOKEN_URL = OPENID_CONNECT + "/token";
```

`/realms/katalon/` 是 **Keycloak** 的标准路径结构——服务端是自建 Keycloak，不是 Auth0/Okta。

`REDIRECT_URI` 用 `chrome.runtime.id` 动态拼接，而 `chrome.runtime.id` 由 `manifest.json:59` 的 `key` 字段固定（打包 CRX 时公钥决定 ID）。**这意味着：改了 `key` 或去掉 `key`，OAuth 就直接失效**——Keycloak 服务端白名单里注册的是固定 redirect_uri。这条对裁剪者很关键：你不可能"保留登录但换扩展 ID"。

#### 3.2.2 PKCE 生成

```js
// utils/generatePKCE.js:14-22
const generateRandomString = (length = 128) => {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    ...
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    ...
};
```

**坑 A（安全）**：`code_verifier` 用 `Math.random()` 生成，不是 `crypto.getRandomValues()`。RFC 7636 §7.1 明确要求 verifier 必须来自密码学安全随机源。此处虽然 128 字符长度使暴力破解不现实，但 `Math.random()` 的状态可被同页面其他脚本推断。**复刻时若要保留 OAuth，务必换成 `crypto.getRandomValues`。**

challenge 侧则是标准的 S256：

```js
// utils/generatePKCE.js:28-29
const digest = await window.crypto.subtle.digest("SHA-256", data);
const codeChallenge = base64UrlEncode(digest);
```

**坑 B（MV3）**：这里用了 `window.crypto`。Service Worker 里没有 `window`。所以 `generatePKCE.js` **只能在 panel 页面上下文运行**，不能被 `worker_wrapper.js` importScripts。这也是为什么整条 OAuth 链路（包括回调监听）都写在 panel 里而不是 SW 里——见 §3.2.4 的后果。

verifier 存进 `storage.local.codePKCE`（generatePKCE.js:31-36），跨窗口交给 `getToken` 用。

#### 3.2.3 登录 URL 拼装

```js
// auth-service.js:15-19
static async getUniversalLoginUrl() {
    const codeChallenge = (await generatePKCE()).code_challenge;
    const url = `${LOGIN_URL}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    return url;
}
```

**坑 C**：`redirect_uri` 未经 `encodeURIComponent`。`chrome-extension://<id>/katalon/authenticated.html` 恰好不含需要转义的字符，所以能用；但这是脆弱的。同样地，**没有 `state` 参数**——PKCE 防的是授权码拦截，`state` 防的是 CSRF，两者不能互相替代。这个实现缺 CSRF 防护。

打开方式是新建 popup 窗口（不是新 tab）：

```js
// auth-service.js:21-28
await browser.windows.create({ url: url, type: "popup", focused: true });
```

#### 3.2.4 回调劫持：用 `tabs.onUpdated` 而不是 `launchWebAuthFlow`

这是全流程最"野"的一处。标准做法是 `chrome.identity.launchWebAuthFlow`，但 KR 选择了监听全局 tab 更新：

```js
// panel/js/UI/controllers/top-toolbar/actions.js:146-170
chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
    if (tab.url.startsWith(REDIRECT_URI) && changeInfo.status === "loading") {
      const gotUrl = new URLSearchParams(tab.url);
      const codeParam = gotUrl.get("code");
      if (!codeParam) { return; }
      AuthService.getToken(codeParam)
        .then((response) => response.json())
        .then(async (data) => {
          const accessToken = data.access_token;
          await setUserAfterLogin(accessToken);
          const refreshToken = data.refresh_token;
          await browser.storage.local.set({ refreshToken });
          await chrome.tabs.remove(tabId);
          await browser.runtime.sendMessage("focus-panel");
          await browser.storage.local.remove("codePKCE");
          updateTestOpsLoginToken(accessToken);
          await browser.runtime.sendMessage("notify-logged-in");
        })
```

逐行的隐晦点：

| 行 | 现象 | 说明 |
|---|---|---|
| 146 | 监听器注册在 **panel 页面**（`$(() => {...})` 内，actions.js:70） | **panel 关闭时监听器就没了**。所以 KR 的登录必须在 panel 打开状态下走完，否则 code 无人接收 |
| 147 | `tab.url.startsWith(...)` 未做 `tab.url` 存在性检查 | 某些 tab（chrome:// 特权页）`tab.url` 为 `undefined`，`.startsWith` 会抛 `TypeError`。**这是一个高频后台报错源** |
| 148 | `new URLSearchParams(tab.url)` | **拿整个 URL 当 query string 解析**。正确写法是 `new URL(tab.url).searchParams`。它之所以还能工作，是因为 `?code=xxx` 里 `code` 恰好是第一个 `?` 后第一个键，`URLSearchParams` 会把 `chrome-extension://...html?code` 整段当成第一个 key。**实测能取到，纯属侥幸**——未在源码中找到测试，推测：如果 Keycloak 在 `code` 前加了别的参数（如 `session_state`），这行就会取到错的值 |
| 158-159 | `refresh_token` 明文存 `storage.local` | 任何拿到 profile 目录的人可读；扩展内任何脚本可读 |
| 160 | `chrome.tabs.remove(tabId)` | 关掉 authenticated.html 那个 popup 窗口 |
| 162 | 用完删 `codePKCE` | 唯一一处清理 |
| 163 | `updateTestOpsLoginToken(accessToken)` | **把 Keycloak 的 access_token 换成 TestOps 的 session**，见 §3.4.1 |

**坑 D（多实例竞态）**：`tabs.onUpdated` 是全局的，而 panel 可以被多个窗口打开（虽然 KR 用 `extensionId` 做单例，`play-actions.js:728`）。若两个 panel 同时在，同一个 `code` 会被 `getToken` 两次；OAuth code 是一次性的，第二次必然 400。

#### 3.2.5 登出

```js
// panel/js/UI/controllers/top-toolbar/actions.js:30-50
AuthService.logout()                       // → Keycloak /logout（带 refresh_token）
  .then(() => fetch(testOpsUrls.logoutFromTestOps, {...}))  // → TestOps
  .then(() => { updateTestOpsLoginToken(); })
  .finally(() => { browser.storage.local.remove("refreshToken"); });
```

注意 UI 状态（`$("#login-user").hide()`，:28-29）是**在网络请求之前**同步改的——网络失败也显示已登出，但 Keycloak 侧 session 还在。

### 3.3 `externally_connectable`：允许任意扩展注册能力

#### 3.3.1 manifest 声明

```json
// manifest.json:46-50
"externally_connectable": {
   "accepts_tls_channel_id": false,
   "ids": [ "*" ],
   "matches": [ "https://developer.mozilla.org/*", "https://katalon.com/*" ]
}
```

`"ids": ["*"]` 的语义是：**浏览器上安装的任意扩展**都可以向 KR 发 `runtime.sendMessage`。`matches` 则限制网页侧只有那两个域名可以。

#### 3.3.2 唯一的外部消息处理器

全仓只有一处 `onMessageExternal`：

```js
// background/kar.js:265-308
var externalCapabilities = {};

browser.runtime.onMessageExternal.addListener(function(message, sender) {
    if (message.type === 'katalon_recorder_register') {
        var payload = message.payload;
        var capabilities = payload.capabilities;
        if (!capabilities) {
            capabilities = [{ id: '', summary: payload.summary, type: 'export' }];
        }
        var extensionId = sender.id;
        var now = new Date().getTime();
        for (var i = 0; i < capabilities.length; i++) {
            var capability = capabilities[i];
            capability.extensionId = extensionId;
            var capabilityGlobalId = extensionId + '-' + capability.id;
            externalCapabilities[capabilityGlobalId] = {
                extensionId, capabilityId: capability.id,
                summary: capability.summary, type: capability.type,
                lastPing: now
            };
        }
    }
});
```

配套的读取端（面向 panel 内部）带 **2 分钟心跳过期**：

```js
// background/kar.js:310-322
if ((now - lastPing) > 2 * 60 * 1000) { delete externalCapabilities[capabilityGlobalId]; }
sendResponse(externalCapabilities);
```

#### 3.3.3 安全评估（裁剪时必须理解为何要删）

| 风险点 | 说明 |
|---|---|
| **无来源白名单** | `ids:["*"]` + 处理器里不校验 `sender.id`，任意扩展可注册 |
| **`summary` 直进 UI** | `capability.summary` 由外部扩展提供，最终渲染进导出菜单。若渲染处用 `innerHTML`，即为跨扩展 XSS 注入点。（渲染点在 `panel/js/katalon/kar-extensionScript.js`，本文未逐行核对该文件的转义处理，**推测：存在注入面**） |
| **内存驻留** | `externalCapabilities` 是 SW 全局变量，MV3 里 SW 30 秒空闲即销毁 → **注册的能力会静默丢失**。这个机制在 MV3 下本身就是半坏的 |
| **无数量上限** | 恶意扩展可 for 循环注册 10 万条，撑爆 SW 内存 |

**结论：裁剪时把 `manifest.json:46-50` 整块删除 + `background/kar.js:265-322` 删除。** 这是唯一一处让外部世界能主动往你插件里塞数据的入口，删掉它等于关掉整个外部攻击面。

### 3.4 TestOps 云端：静默全量上传

这一块在功能上属于 M12（报告），但在**隐私与鉴权**上属于本模块，因为它是**登录态唯一真正解锁的功能**。

#### 3.4.1 用 Keycloak token 换 TestOps session

```js
// panel/js/katalon/kar.js:19-41
const updateTestOpsLoginToken = (jwtToken = undefined) => {
  if (jwtToken) {
    const formData = new URLSearchParams();
    formData.append("username", "");
    formData.append("grant_type", "password");
    formData.append("password", `access_token_${jwtToken}`);
    const loginUrl = `${testOpsEndpoint}/oauth/token`;
    fetch(loginUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa("kit:kit")}`,
        ...
```

**硬编码 Basic 凭据 `kit:kit`**（kar.js:31）。这是 OAuth2 的 client 凭据，写死在前端。同时它把 access_token 塞进 `password` 字段用 `grant_type=password`——这是把 JWT 当密码用的非标准握手。

#### 3.4.2 全量备份：`storage.local.get(null)`

```js
// panel/js/katalon/kar-upload.js:33-42
function backupData() {
  return browser.storage.local.set({ firstTime: false }).then(function () {
    browser.storage.local.get(null).then(function (result) {
      $.ajax({ url: testOpsUrls.getUploadUrlAvatar, type: "GET",
        success: function (response) {
          ...
          var data = JSON.stringify(result);
```

`storage.local.get(null)` = **拿全部键**。这包含：所有测试用例（含 URL、选择器、输入的密码变量）、`refreshToken`、`segment.user`、`codePKCE`、`checkLoginData`、`setting`……**整个扩展的本地状态被序列化后 PUT 到 S3 预签名 URL**。

触发时机有两处：

| 触发 | 位置 | 频率 |
|---|---|---|
| 用户点「Back up data」按钮 | `test-ops.js:14-30` | 手动 |
| **定时器** | `test-ops-service.js:1-8` | **每 15 分钟一次，panel 打开即启动** |

```js
// panel/js/UI/services/test-ops-service/test-ops-service.js:1-8
const setBackupDataInterval = () => {
  let timerId = setTimeout(function tick() {
    getProjects().then(() => {
      backupData();
      timerId = setTimeout(tick, 15 * 60 * 1000);
    })
  }, 15 * 60 * 1000);
}
```

`test-ops.js:32` 在 `$(document).ready` 里无条件调用 `setBackupDataInterval()`——**未登录时 `getProjects()` 会 reject，链路中断，不上传**（这是唯一的"保护"）。一旦登录，就是每 15 分钟一次全量。

#### 3.4.3 回放结束的自动报告上传

```js
// panel/js/background/playback/service/actions/play/play-actions.js:730-747
$.ajax({ url: testOpsUrls.getFirstProject, type: "GET" }).then((projects) => {
  if (projects.length === 1) {
    let project = projects[0];
    uploadTestReportsToTestOps(null, project.id, true);   // ← 第三参 autouploaded=true
  } else {
    $("#ka-upload").removeClass("disable");
    sideex_log.appendA("Upload this execution to Katalon TestOps", "ka-upload-log");
    ...
```

**逻辑是：如果你的 TestOps 账号下只有 1 个项目，回放一结束就自动把整份日志上传，不询问、不提示。** 只有 ≥2 个项目时才降级成一个"点击上传"链接。上传内容是 `#logcontainer` 的全部 `textContent`（kar-upload.js:96-100），即完整执行日志——**包含每条命令的 target 选择器与 value**。

> 这是本次逆向中**最需要警示**的一条：与埋点不同（埋点不带 URL/选择器，见 §5.3），TestOps 自动上传是**真的把业务数据传走**。

---

## 4. 数据结构与时序图

### 4.1 本模块涉及的 storage 键全表

| 键 | 区域 | 结构 | 写入点 | 敏感度 |
|---|---|---|---|---|
| `codePKCE` | local | `{code_verifier, code_challenge}` | generatePKCE.js:31 | 中（临时，回调后删） |
| `refreshToken` | local | string（JWT） | actions.js:159 | **高** |
| `segment` | local | `{userId, user}` | segment-tracking-service.js:9 | 中（含 email） |
| `hubspot` | local | `{user}` | hubspot-tracking-service.js:26 | 中（含 email） |
| `checkLoginData` | local | `{recordTimes, playTimes, hasLoggedIn, isActived, user}` | actions.js:62 / website-login.js:72 | 中 |
| `anonymousId` | local+sync+cookie | uuid v4 | persistent-store.js:45-53 | **高（跨设备追踪）** |
| `visitor` | local+sync+cookie | `{visitorId, confidence}` | 同上（key=`"visitor"`，get-browser-fingerprint-background.js:7） | **高（浏览器指纹）** |
| `usage` | local | `{ [key]: {key,count,lastTime} }` | UsageWatcher.js:25 | 低 |
| `playbackTracking` | local | `{recordNum, playTestCaseSuccess, playTestCaseFail, selfHealing, playSuite}` | playback-local-tracking.js:32 | 低（本地，不上报） |
| `ratePoints` | local | `{successfulExc, score, reviews}` | popup-rate-us.js:151-152 | 低 |
| `onBoardingUserChoice` | local | `{use_case: [...]}` | popup-what-are-you-automating.js（已注释） | 低 |
| `tracking` | local | `{isUpdated: true}` | install.js:26-30 | 低 |
| `firstTime` | local | bool | install.js:24 / kar-upload.js:34 | 低 |

### 4.2 OAuth 登录时序图

```
用户                Panel(actions.js)      AuthService     Keycloak      authenticated.html   TestOps
 │                        │                     │              │                 │              │
 ├─点 #login-button──────▶│                     │              │                 │              │
 │                        ├─openUniversalLoginUrl()───────────▶│                 │              │
 │                        │                     ├─generatePKCE()                 │              │
 │                        │                     │  ├─ verifier=Math.random×128   │              │
 │                        │                     │  ├─ challenge=b64url(SHA256(v))│              │
 │                        │                     │  └─ storage.local.codePKCE ✎   │              │
 │                        │                     ├─windows.create(popup, LOGIN_URL?...&code_challenge=..)
 │                        │                     │              │                 │              │
 │◀───────────── Keycloak 登录页 ───────────────────────────────┤                 │              │
 ├─输入账号密码─────────────────────────────────────────────────▶│                 │              │
 │                        │                     │              ├─302 → REDIRECT_URI?code=XXX ──▶│
 │                        │                     │              │                 │              │
 │                        │◀── tabs.onUpdated(status="loading") ──────────────────┤              │
 │                        │  【actions.js:146】                 │                 │              │
 │                        ├─ URLSearchParams(tab.url).get("code")                 │              │
 │                        ├─getToken(code)─────▶│              │                 │              │
 │                        │                     ├─读 codePKCE.code_verifier       │              │
 │                        │                     ├─POST /token (code+verifier)───▶│              │
 │                        │                     │◀── {access_token, refresh_token}│              │
 │                        │◀────────────────────┤              │                 │              │
 │                        ├─setUserAfterLogin(access_token)     │                 │              │
 │                        │   ├─jwtJsDecode.decode → payload.email                │              │
 │                        │   ├─checkLoginData{isActived,hasLoggedIn,user} ✎      │              │
 │                        │   ├─setSegmentUser(email) ✎                           │              │
 │                        │   ├─trackingLogin()  ──── kru_login ─────▶ backend.katalon.com       │
 │                        │   ├─setHubspotUser(email) ✎                           │              │
 │                        │   └─trackingHubspotLogin() ─ kr_product_registration ▶ web-api...    │
 │                        ├─storage.local.refreshToken ✎                          │              │
 │                        ├─tabs.remove(tabId) ────────────────────────────────── ✗ 关闭         │
 │                        ├─sendMessage("focus-panel")                            │              │
 │                        ├─storage.local.remove("codePKCE")                      │              │
 │                        ├─updateTestOpsLoginToken(access_token) ────────────────────────────▶ │
 │                        │      POST /oauth/token  Basic kit:kit                 │   grant_type=password
 │                        │      password=access_token_<JWT>                      │              │
 │                        │◀───────────────────── Set-Cookie(session) ─────────────────────────┤
 │                        ├─refreshStatusBar()                                    │              │
 │                        └─sendMessage("notify-logged-in")                       │              │
 │                        │                                                       │              │
 │              【此后每 15 分钟】storage.local.get(null) 全量 ──────────────────────────────────▶│
```

### 4.3 埋点上报的 body 结构

`trackingSegment(event, action)` 最终 POST 到 `${segment_url}/segment-kr/tracking`（segment-tracking-service.js:58-61），body 形状：

```jsonc
{
  "userId": "<anonymousId uuid v4>",       // segment.userId
  "event": "kru_execute_test_case",
  "properties": {
    // ↓ 来自 action 参数（各事件自定义）
    "test_case_id": "Untitled Test Case",  // ← 注意：是【名字】不是 id，见 §5.3 坑
    "status": true,
    "is_self_healing_triggered": false,
    "data-driven": false,
    // ↓ 来自 trackingSegment 统一注入
    "user": "someone@example.com",         // 仅登录后才有
    // ↓ 来自 trackingSegmentAPI 统一注入（:44-46）
    "browser_name": "Chrome",
    "browser_id_2": "<FingerprintJS visitorId>",
    "browser_id_2_confidence": 0.99
  }
}
```

统一注入的三行：

```js
// panel/js/UI/services/tracking-service/segment-tracking-service.js:44-46
data.properties.browser_name = await getBrowserName();
const browserIds = await getTrackingBrowserIds();
Object.assign(data.properties, browserIds);
```

---

## 5. 埋点体系全解剖

### 5.1 三条上报通道

| 通道 | 端点 | 门禁 | 触发量 |
|---|---|---|---|
| **Segment（panel）** | `https://backend.katalon.com/api/segment-kr/tracking` | `setting.tracking === true` **或** 事件是 `kru_install_application` | 主力，全仓 **204 处调用**，分布在 **24 个文件** |
| **Segment（SW 副本）** | 同上 | 同上 | 仅安装事件（install.js:23） |
| **HubSpot** | `${hubspot_url}wp-json/restful_api/v1/hubspot/update-contact` | `setting.tracking === true` | 仅 2 个：登录、注册（hubspot-tracking-service.js:96-106） |

**门禁的关键漏洞**（两个副本一致）：

```js
// panel/js/UI/services/tracking-service/segment-tracking-service.js:48-52
return browser.storage.local.get("setting").then((settingData) => {
    if (settingData.setting.tracking || data.event === "kru_install_application") {
```

即：**用户在设置里关掉 tracking，安装事件仍然照发**。而安装事件（SW 版）还额外带上营销归因 cookie：

```js
// background/segment-tracking-services.js:61-70
const cookies = await browser.cookies.getAll({ name: "kr_campaign_source" });
const campaignSource = cookies.find((cookie) => cookie.value)?.value;
let data = { userId: await getAnonymousId(), event: "kru_install_application",
             properties: { kr_campaign_source: campaignSource } };
```

它会**扫描所有域名下**名为 `kr_campaign_source` 的 cookie（`getAll` 不限 domain），用于归因是哪个落地页带来的安装。

> 另一处：`settingData.setting.tracking` 没有可选链。若 `setting` 键缺失（首次安装且 `load-setting-data.js` 尚未跑完），这里会抛 `TypeError: Cannot read properties of undefined`。而安装事件恰恰是最早发生的——**存在首装时埋点自身崩溃的竞态**，见 TECH-13 §7。

### 5.2 Segment 事件全表（`kru_*`）

按 `segment-tracking-service.js:516-565` 的导出清单与 `Tracker` 类整理：

| 事件名 | 定义行 | properties | 触发场景 |
|---|---|---|---|
| `kru_install_application` | :121 | `kr_campaign_source`, `user` | 首次安装（install.js:23） |
| `kru_uninstall_application` | :144 | — | **实际未被调用**（卸载走 uninstallURL，见 §5.5） |
| `kru_close_application` | :148 | — | 关闭 panel |
| `kru_login` | :152 | — | 登录成功（actions.js:65） |
| `kru_signin_btn_click` | :156 | — | 点击登录按钮 |
| `kru_signup` | :160 | — | 注册成功 |
| `kru_record` | :164 | — | 开始录制 |
| `kru_create_test_case` | :172 | `source`, `test_case_id` | 新建用例 |
| `kru_create_test_suite` | :185 | `source`, `test_suite_id`, `type?` | 新建套件 |
| `kru_open_test_case` | :265 | `test_case_id` | **已被主动禁用**（:199-200 注释：重复触发） |
| `kru_save_test_case` | :273 | `source`, `test_case_id` | 保存用例 |
| `kru_save_test_suite` | :281 | `source`, `test_suite_id` | 保存套件 |
| `kru_add_test_step` | :288 | `source` | 增加步骤 |
| `kru_delete_test_step` | :295 | `source` | 删除步骤 |
| `kru_copy_test_step` | :302 | `source` | 复制步骤 |
| `kru_paste_test_step` | :309 | `source` | 粘贴步骤 |
| `kru_select_target_element` | :313 | — | 点 Select 拾取元素 |
| `kru_highlight_target_element` | :317 | — | 点 Find 高亮元素 |
| `kru_execute_test_case` | :336 | `test_case_id`, `status`, `is_self_healing_triggered`, `data-driven` | 回放单用例 |
| `kru_execute_test_suite` | :358 | `test_suite_id`, `no_successed_test_case`, `no_failed_test_case`, `is_self_healing_triggered`, `is_console`, `type?` | 回放套件 |
| `kru_execute_all` | :371 | `no_successed_test_case`, `no_failed_test_case`, `is_self_healing_triggered` | 回放全部 |
| `kru_pause` | :375 | — | 暂停 |
| `kru_open_testops_report` | :379 | — | 打开 TestOps 报告 |
| `kru_open_export` | :383 | — | 打开导出对话框 |
| `kru_export_test_case` | :390 | `source` | 导出 |
| `kru_open_help` | :394 | — | 帮助 |
| `kru_open_adjust_speed` | :398 | — | 调速 |
| `kru_open_github` | :402 | — | GitHub 链接 |
| `kru_open_setting` | :406 | — | 打开设置面板 |
| `kru_open_extended_features` | :410 | — | 扩展功能 |
| `kru_open_daily_usage` | :414 | — | 日用量 |
| `kru_nps_score` | :422 | `score`, `review` | NPS 提交（popup-rate-us.js） |
| `kru_web_store_review_click` | :429 | `browser` | 点击去商店评分 |
| `kru_open_user_manual` | :433 | — | 用户手册 |
| `kru_total_tutorials_completed` | :440 | `completedTutorials` | 教程完成数 |
| `kru_replay_getting_started` | :444 | — | 重放引导 |
| `kru_closed_user_manual_did_nothing` | :448 | — | 关手册未操作 |
| `kru_completed_tutorial` | :456 | `tutorialId` | 完成单个教程 |
| `kru_clicked_tutorial` | :464 | `tutorialId` | 点击教程 |
| `kru_skip_the_tour` | :468 | — | 跳过导览 |
| `kru_complete_the_tour` | :472 | — | 完成导览 |
| `kru_skip_step` | :479 | `stepId` | 跳过某步 |
| `kru_upload_artifact` | :488（Tracker） | `artifact_type`, `trigger_path` | 上传自定义关键字文件 |
| `kru_open_application` | :496（Tracker） | `num_custom_keyword_files` | 打开 panel |
| `kru_ui_action` | :500（Tracker） | `ui_part`, `action`, `trigger_path` | 通用 UI 行为 |
| `kru_backup_data_to_testops` | test-ops.js:22,28 | `success` | 点击备份按钮 |
| `kru_rate_self_healing` | self-healing-rating.js:64 | `userAnswer` | 自愈满意度 |

> 共约 **46 个显式事件** + `kru_ui_action` 这一通用槽（`Tracker.uiAction`，可携带任意 `ui_part`）。

### 5.3 上报字段的隐私视角 —— 关键结论

**逐字段核对 `properties` 的所有取值来源后的结论是：Segment 上报里不含被测网站的 URL，也不含任何选择器（locator）字符串。**

论据：

1. `test_case_id` 这个字段名极具误导性，它**装的是用例名的字符串**，不是 URL：
   ```js
   // segment-tracking-service.js:193
   let title = $(getSelectedCase()).children("span").text();
   // :196
   trackingCreateTestCase(source, title);      // ← 第二参形参名叫 testCaseId
   ```
   同理 `trackingExecuteTestCase(title, ...)`（:203）传的也是 `title`。用户如果把用例命名成 `登录 https://内网.com`，那才会泄露——**取决于命名，不是取决于代码**。

2. `test_suite_id` 同样是名字：`generate-test-case-context-menu` 侧走 `testSuite.name`（segment-tracking-service.js:224）。

3. `is_self_healing_triggered` 只是布尔，不带被治愈的 locator。对比 TECH-02 里自愈本身会把新旧 locator 写进**本地** `logcontainer`，但**没有**走 Segment。

4. `data-driven` 由 `testCase.commands.some(c => c.name === "loadVars")` 推导（:327-329）——只看有没有这个命令，不看参数。

5. 唯一携带路径类信息的是 `Tracker.uiAction` 的 `trigger_path`，但实测传入值都是**代码里写死的字符串常量**，例如 `popupPromoteSignup("create-second-test-case")`（testCase-grid-test-case-listener.js:87）、`popupPromoteSignup("save-first-test-case")`（generate-test-case-context-menu.js:142）——是 UI 触发点标识，不是 URL 路径。

**所以埋点体系的隐私问题不在"内容"，而在"身份"**：见下节。

### 5.4 匿名 ID 的三级持久化 —— 真正的追踪能力

```js
// common/persistent-store.js:3-4
const PERSISTENT_STORE_URL = "http://katalon-persistent-domain.com/";
const PERSISTENT_STORE_DOMAIN = ".katalon-persistent-domain.com";
```

读取优先级（persistent-store.js:13-40，注释就写在 :11）：`内存 cache → storage.local → storage.sync → cookie → 生成新值`。

写入是**三写**（:44-54）：

```js
await Promise.allSettled([
    browser.storage.local.set({ [key]: value }),
    browser.storage.sync.set({ [key]: value }),     // ← 跟着 Chrome 账号跨设备同步
    browser.cookies.set({
      url: PERSISTENT_STORE_URL,
      domain: PERSISTENT_STORE_DOMAIN,
      name: getPersistentCookieName(key),
      value: encodeURIComponent(JSON.stringify(value)),
      expirationDate: new Date("9999-12-31").getTime() / 1000,   // ← 永不过期
    }),
]);
```

这套设计的追踪能力等级：

| 用户行为 | anonymousId 是否存活 |
|---|---|
| 清 `storage.local` | ✅ 存活（sync + cookie 兜底） |
| 卸载重装扩展 | ✅ 存活（storage.sync 跟随 Google 账号；cookie 独立于扩展） |
| 清浏览器 cookie | ✅ 存活（local/sync 兜底） |
| 换一台电脑登同一 Chrome 账号 | ✅ 存活（sync 同步） |
| **同时**清 local+sync+cookie | ❌ 重置 |

`katalon-persistent-domain.com` 是一个**不需要真实存在的域名**——`cookies.set` 只要 `url` 形式合法就能写入浏览器 cookie 存储，不发生任何网络请求。这是一个经典的 "evercookie / zombie cookie" 手法。

叠加上 FingerprintJS 的 `visitorId`（`browser_id_2`，get-browser-fingerprint-background.js:31-37），即便三处全清，指纹仍能把新旧身份关联起来。`browser_id_2_confidence` 是 FingerprintJS 给出的置信度分数（:10）。

FingerprintJS 只能在有 DOM 的环境跑，所以 MV3 下走 offscreen 文档：

```js
// common/get-browser-fingerprint-background.js:7-8
fingerprintPromise = getPersistentValue("visitor", async () => {
      return sendMessageToOffscreenDocument("get-fingerprint-visitor");
```

```js
// common/offscreen-server.js:46-48
await chrome.offscreen.createDocument({
      url: "panel/offscreen.html",
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
```

**`offscreen` 权限（manifest.json:64）与整个 offscreen 机制，在 KR 里只服务于两件事：取指纹、取 browserName**（全仓 `sendMessageToOffscreenDocument` 只有 2 个调用点）。裁剪掉埋点后，`offscreen` 权限可以从 manifest 里删掉。

### 5.5 卸载 URL：把身份带出扩展

```js
// background/install.js:45-62
const configUninstallUrl = debounce(async () => {
  browser.storage.local.get("segment").then(async function (result) {
    const uninstallUrl = new URL(`https://katalon.com/katalon-recorder-ide/tell-us-why`);
    if (result.segment) {
      uninstallUrl.searchParams.append("userId", segment.userId || "");
      uninstallUrl.searchParams.append("user", segment.user || "");
    }
    const browserIds = await getTrackingBrowserIds();
    uninstallUrl.searchParams.append("browser_name", await getBrowserName());
    Object.entries(browserIds).forEach(([key, value]) => {
      uninstallUrl.searchParams.append(key, value || "");
    });
    browser.runtime.setUninstallURL(uninstallUrl.toString());
  });
}, 1000);
```

卸载后浏览器会自动打开这个 URL，query 里带着 **anonymousId + email + 浏览器指纹**。这条路径**完全绕过 `setting.tracking` 开关**——关掉埋点也照样生效。

刷新时机同样激进：

```js
// background/install.js:64-80
browser.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  ...
  if (message?.target !== "offscreen-server" && message?.target !== "offscreen") {
    configUninstallUrl();      // ← 任何一条 runtime 消息都会触发（1 秒 debounce）
  }
```

即：**扩展内每一条 runtime 消息都会顺带刷新一次卸载 URL**。注释（:76）说明排除 offscreen 消息是为了避免 `getTrackingBrowserIds` 递归调用自己造成死循环——从侧面印证这个函数调用极其频繁。

### 5.6 一个额外的数据出口：社交分享上传截图

```js
// content-marketing/panel/popup-sharing.js:462
let urlEndpoint = 'https://backend.katalon.com/api/upload-kr';
```
```js
// content-marketing/panel/popup-sharing.js:481-499
function convertHTMLtoPNG() {
    let imageConvert = $('#capture-img');
    return html2canvas(imageConvert[0]).then(function(canvas) {
        var imgData = canvas.toDataURL('image/png', 1.0);
        const formData = new FormData();
        formData.append('file', dataURItoBlob(imgData), 'sharing-img.png');
        return fetch(`${urlEndpoint}`, { method: 'POST', body: formData })
```

用 html2canvas（即 `converttosimage.js`，19 行是压缩后的 1.0.0-rc.7）把 `#capture-img` 卡片渲染成 PNG，**上传到 Katalon 服务器换一个 key**，再把 `${urlEndpoint}/${rs.key}` 作为 og:url 分享到 Facebook/Twitter/LinkedIn（:503-511）。这是用户主动点击才触发的，但上传的图片**公网可访问且无过期**（未在源码中找到过期设置，推测：服务端策略未知）。

---

## 6. 门禁与营销弹窗

### 6.1 7.1.0 的重大变化：**硬门禁已被全部注释**

这是本次逆向最出人意料的发现。所有 `checkLoginOrSignupUser*` 门禁的调用点在 7.1.0 里**全部被注释掉**，注释里标着 Jira 单号 `KR-522`：

| 门禁函数 | 定义处 | 调用点 | 状态 |
|---|---|---|---|
| `checkLoginOrSignupUserForCreateTestCase` | login-inapp.js:617 | `record-actions.js:16`<br>`testCase-grid-test-case-listener.js:48`<br>`testCase-grid-test-suite-listener.js:103` | ❌ 三处**全注释** |
| `checkLoginOrSignupUserForPlayTestSuite` | popup-play-suite-quota.js:69 | `play-actions.js:126`<br>`play-actions.js:141`<br>`generate-test-case-context-menu.js:82` | ❌ 三处**全注释** |
| `checkLoginOrSignupUserForCreateDynamicTestSuite` | popup-create-dynamic-test-suite.js:5 | `dynamic-test-suite.js:36` | ❌ 注释 |
| `checkLogin` / `checkLoginAndRecord` / `checkLoginAndPlay` | website-login.js:18/24/43 | **无任何外部调用点** | ❌ 整个文件死代码 |

对应的 `import` 语句也被一并注释（`play-actions.js:43`、`record-actions.js:1`、`dynamic-test-suite.js:4`、`testCase-grid-test-case-listener.js:1`、`testCase-grid-test-suite-listener.js:13`、`generate-test-case-context-menu.js:24`）。

被保留的注释样本：

```js
// panel/js/UI/controllers/testcase-grid/testCase-grid-test-case-listener.js:46-51
      /*** Comment out for KR-522 ***/
      // make sure user login and sign up after threshold before making new test case
      // if (!(await checkLoginOrSignupUserForCreateTestCase())) {
      //   return;
      // }
      /*** Comment out for KR-522 ***/
```

**结论：7.1.0 没有任何功能是被登录门禁挡住的。** 唯一"只有登录才能用"的是 TestOps 备份/上传（因为它需要服务端 session，不是前端 if 判断）。

> 这也意味着：**如果你只是想"去掉门禁"，7.1.0 已经不用改代码了**。本模块的裁剪价值在于删掉埋点与追踪，而非解锁功能。

### 6.2 仍然活跃的两个劝导弹窗

只剩 `popupPromoteSignup` 一个函数，被 2 处调用：

**触发点 1 — 当天首次「保存用例」**

```js
// panel/js/UI/view/testcase-grid/generate-test-case-context-menu.js:135-144
const user = await userService.getLoginInfo();
if (!user.hasLoggedIn) {
    await usageWatcher.countSavingTestCase();
    const promoteSignUpUsage = await usageWatcher.loadUsageRecord(UsageKey.PROMOTE_SIGN_UP);
    if (isNewDay(promoteSignUpUsage.lastTime)) {
      popupPromoteSignup("save-first-test-case");
    }
}
```

**触发点 2 — 当天创建第 2 个用例**

```js
// panel/js/UI/controllers/testcase-grid/testCase-grid-test-case-listener.js:77-89
if (!user.hasLoggedIn) {
    const createTestCaseUsage = await usageWatcher.countCreatingTestCase();
    const promoteSignUpUsage = await usageWatcher.loadUsageRecord(UsageKey.PROMOTE_SIGN_UP);
    if (createTestCaseUsage.count >= 2 && isNewDay(promoteSignUpUsage.lastTime)) {
      popupPromoteSignup("create-second-test-case");
    }
}
```

节流机制是 `isNewDay`（UsageWatcher.js:9-11）：

```js
export function isNewDay(time = 0) {
  return new Date(time).toDateString() !== new Date().toDateString();
}
```

按**自然日字符串**比较，不是 24 小时窗口——所以 23:59 弹一次、00:01 可以再弹一次。而 `countPromoteSignUp()` 在 `popupPromoteSignup` 开头就调用（popup-promote-signup.js:6），更新 `lastTime`，从而实现「每天最多一次」。

注意 `createTestCaseUsage.count` 是**累计值不清零**（UsageWatcher.js:48-54 只 `count++`），所以第 2 天开始只要建任何一个用例（count 早已 ≥2）就会弹。「create-second-test-case」这个名字只在第一天准确。

弹窗本体是 jQuery 拼的 toast（popup-promote-signup.js:17-79），按钮走 `AuthService.openUniversalLoginUrl()`（:101），三个交互分支各发一条 `kru_ui_action`（:85/:93/:102/:107）。

### 6.3 其余弹窗的触发阈值（全部与登录无关，纯营销）

| 弹窗 | 阈值条件 | 源码 |
|---|---|---|
| **自愈满意度** | `playbackTracking.selfHealing` **恰好等于 10** 的那一刻 | self-healing-rating.js:69-81 |
| **NPS 评分** | `ratePoints.successfulExc / 20 == 1`（即恰好第 20 次成功执行）且 `score<=7` 且 `reviews==''` | popup-rate-us.js:178 |
| **套件配额**（死） | `!isActived && playSuite>=1 && onBoardingUserChoice.use_case 含 "Kickstart test automation"` | popup-play-suite-quota.js:69-84 |

自愈弹窗的实现方式很典型——**监听 storage 变化而不是直接调用**：

```js
// content-marketing/panel/self-healing-rating.js:69-80
function eventHandler(changes) {
  const threshold = 10;
  if (changes.playbackTracking) {
    let changedValue = getChangedProperty(changes.playbackTracking.oldValue, changes.playbackTracking.newValue);
    if (changedValue === "selfHealing" && newValue.selfHealing === threshold) {
      popupSelfHealingRating();
      browser.storage.onChanged.removeListener(eventHandler);
    }
  }
}
```

用 `=== threshold` 而不是 `>= threshold`，配合 `removeListener` 实现「一辈子只弹一次」。但如果用户在第 10 次自愈发生时没打开 panel（监听器不存在），**这个弹窗就永远不会出现**——是有意还是 bug，未在源码中找到说明，推测：设计如此（能容忍漏弹）。

NPS 的 `numb / 20 == 1` 同理是精确等于 20，第 40 次不会再弹。

---

## 7. 隐晦知识点与坑

### 7.1 `Math.random()` 生成 PKCE verifier（安全）

`utils/generatePKCE.js:19`。见 §3.2.2 坑 A。RFC 7636 要求密码学随机源。

### 7.2 OAuth 缺 `state` 参数（安全）

`auth-service.js:17` 的 URL 里只有 `code_challenge`，没有 `state`。PKCE ≠ CSRF 防护。攻击者理论上可诱导用户的浏览器用攻击者的 code 完成登录（登录 CSRF）。

### 7.3 `new URLSearchParams(tab.url)` 解析整个 URL（正确性）

`actions.js:148`。应为 `new URL(tab.url).searchParams`。当前写法把 `chrome-extension://xxx/katalon/authenticated.html?code` 整段当第一个 key，**只是恰好能取到值**。

### 7.4 `tab.url` 可能是 `undefined`（稳定性）

`actions.js:147` 的 `tab.url.startsWith(...)` 在监听到特权页更新时会抛 `TypeError`。因为 `tabs.onUpdated` 是全局监听，用户切任何 tab 都会触发。

### 7.5 OAuth 回调监听器绑在 panel 上（架构）

`actions.js:70` 的 `$(() => {...})` 意味着监听器随 panel 生命周期。**关掉 panel 再登录，code 永远无人接收**。正规做法应放在 SW，但 §3.2.2 坑 B 说明 `generatePKCE` 用了 `window.crypto` 上不了 SW——两个问题互为因果。

### 7.6 `settingData.setting.tracking` 无可选链（稳定性）

`segment-tracking-service.js:50` 与 `background/segment-tracking-services.js:17`、`hubspot-tracking-service.js:31` 三处都是裸访问。`setting` 键在首装未初始化时为 `undefined`，直接 TypeError。而 `load-setting-data.js` 只在 panel 里跑（TECH-13 §7），SW 里的安装埋点比它早——**首装必现的竞态**。

### 7.7 安装事件绕过 tracking 开关（合规）

`segment-tracking-service.js:50-52` 的 `||` 让 `kru_install_application` 无视用户选择。卸载 URL（install.js:45-62）同理，且连 `||` 判断都没有。

### 7.8 `getLoggedInUserAPI` 的 `user.email.email` 双层解构（正确性）

```js
// segment-tracking-service.js:16-18
if (data.user_info) { user = { email: data.user_info }; }
// :78
result.segment.user = user.email.email;
```
第 18 行构造的是 `{email: data.user_info}`，第 78 行却取 `.email.email`——只有当 `data.user_info` 本身是 `{email: "..."}` 对象时才成立。同一文件里 `trackingInstallApp`（:134）、`hubspot-tracking-service.js:71` 也是这个写法，但 `actions.js` 走的是 JWT 解码路径（`newValue.payload.email`，:55-56）**不经过这里**。这条 legacy WordPress API 路径（`wp-json/restful_api/v1/auth/kr/me`）实际上在 7.1.0 里几乎不会返回有效数据——它是 Keycloak 之前的旧鉴权体系残留。

### 7.9 `trackingSegment` 里 `browser.storage.local.set(result)` 的越界写入

```js
// segment-tracking-service.js:97-102
} else {
      let user = await getLoggedInUserAPI();
      if (user.email) { ... }
      browser.storage.local.set(result);      // ← 在 if 外面
}
```
即使 `getLoggedInUserAPI` 返回空对象，也会把 `result`（整个 `{segment: {...}}`）重写一遍。每一次未登录状态下的埋点都会产生一次无意义的 storage 写。埋点在全仓有 204 处调用——这是可观的 I/O 浪费。

### 7.10 `kru_uninstall_application` 事件定义了但从不调用

`segment-tracking-service.js:143-145` 定义了 `trackingUninstallApp`，也在 :519 导出，但全仓无调用点（扩展被卸载时 JS 已停止，本来也发不出去）。真正的卸载追踪走 `setUninstallURL`。死代码。

### 7.11 `socket-io.min.js` 526 行完全无人引用

`content-marketing/socket-io/socket-io.min.js` 在全仓（含 `bundles/`）无任何 `import`/`<script>` 引用。历史遗留。

### 7.12 `trackingTestCase` / `trackingTestSuite` 的 500ms 魔法延时

```js
// segment-tracking-service.js:189
setTimeout(() => { const selectedTestCaseElement = getSelectedCase(); ... }, 500);
```
埋点要读 DOM 里"当前选中的用例名"，但调用时机可能早于 DOM 更新，于是硬编码延时 500ms。**这是埋点耦合 UI 渲染的典型症状**——也是它值得整体删除而不是"改造"的理由之一：它把业务逻辑和 DOM 时序绑在了一起。

### 7.13 `homepage_url` 被当作 API base

`manifest.json:51` 的 `homepage_url` 是 `https://web-api.katalon.com/`（不是给用户看的主页），被 `getKatalonEndpoint()` 读出来拼 API 路径（segment-tracking-service.js:30-33、website-login.js:13-16、hubspot-tracking-service.js:1-4，共 4 处重复定义同名函数）。用 manifest 字段当配置中心是个小巧思，但把 `homepage_url` 语义挪用了。

### 7.14 `kit:kit` 硬编码（安全）

`panel/js/katalon/kar.js:31` 的 `Basic ${btoa("kit:kit")}`。TestOps 的 OAuth client 凭据明文在前端。

---

## 8. 删除清单（可直接执行）

### 8.1 整目录 / 整文件删除

| 路径 | 行数 | 备注 |
|---|---|---|
| `content-marketing/` （整目录） | **2588** | 含 socket-io 526 行死代码 |
| `panel/js/UI/services/tracking-service/` （整目录） | **969** | 7 个文件 |
| `panel/js/UI/services/auth-service/` | 64 | |
| `panel/js/UI/services/user-services/` | 26 | |
| `panel/js/UI/services/test-ops-service/` | 9 | |
| `panel/js/UI/controllers/tracking/add-tracking-handler.js` | 159 | |
| `panel/js/UI/controllers/dialog/welcome-tracking.js` | 63 | |
| `panel/js/UI/controllers/other-listeners/test-ops.js` | 33 | |
| `panel/js/background/website-login.js` | 143 | 全文件死代码 |
| `panel/js/katalon/kar-upload.js` | 286 | |
| `background/segment-tracking-services.js` | 91 | |
| `utils/generatePKCE.js` | 45 | |
| `common/browser-fingerprint2.js` | **9346** | FingerprintJS |
| `common/get-browser-fingerprint.js` | 29 | |
| `common/get-browser-fingerprint-background.js` | 37 | |
| `common/get-anonymous-id.js` | 16 | |
| `common/persistent-store.js` | 68 | |
| `common/offscreen-server.js` | 75 | 只服务指纹 |
| `common/offscreen.js` | 29 | |
| `panel/offscreen.html` | 4 | |
| `common/jwtJsDecode.js` | 1（压缩） | |
| `katalon/authenticated.html` + `katalon/images/authenticated.png` | 30 | |
| **合计** | **≈ 14,111 行** | |

> 若同时保留「浏览器名」检测（`common/get-browser-name-background.js`、`content/bowser.js`），需注意 `get-browser-name-background.js:3` 也依赖 `sendMessageToOffscreenDocument`。TECH-13 §9.1 已指出 `bowser` 在设置面板里的缺失问题；裁剪后建议直接用 `navigator.userAgentData` 或干脆去掉浏览器判断。

### 8.2 需要**改行**的引用清理点

| 文件:行 | 内容 | 处理 |
|---|---|---|
| `manifest.json:46-50` | `externally_connectable` 整块 | **删** |
| `manifest.json:53` | `hubspot_url` | 删 |
| `manifest.json:63` | `options_page` | 删（TECH-13 §10） |
| `manifest.json:64` | `permissions` 中的 `"cookies"`、`"offscreen"`、`"notifications"` | 删这 3 项 |
| `manifest.json:68` | `segment_url` | 删 |
| `manifest.json:73` | `web_accessible_resources` 中 `"katalon/authenticated.html"` | 删该项 |
| `manifest.json:34-40` | 第 4 段 content_script（`bundles/content.2.bundle.js`，facebook/twitter/linkedin 分享） | **整段删** |
| `worker_wrapper.js:4` | `"background/segment-tracking-services.js"` | 删 |
| `worker_wrapper.js:7` | `"common/jwtJsDecode.js"` | 删 |
| `worker_wrapper.js:8` | `"common/browser-fingerprint2.js"` | 删 |
| `worker_wrapper.js:9-11` | persistent-store / get-anonymous-id / get-browser-fingerprint-background | 删 3 行 |
| `worker_wrapper.js:13` | `"common/offscreen-server.js"` | 删 |
| `background/install.js:23` | `trackingInstallApp();` | 删 |
| `background/install.js:35-62` | `debounce` + `configUninstallUrl` | 删 |
| `background/install.js:75-78` | `configUninstallUrl()` 调用 | 删 |
| `background/kar.js:265-322` | `externalCapabilities` + `onMessageExternal` + `getExternalCapabilities` | 删 |
| `panel/index.html:125` | `<script src="../common/jwtJsDecode.js">` | 删 |
| `panel/index.html:230-231` | `#login-button` / `#login-user` 按钮 | 删 |
| `panel/index.html:534` | `#test-ops-back-up-data` 按钮 | 删 |
| `panel/index.html:890` | `welcome-tracking.js` | 删 |
| `panel/index.html:931` | `add-tracking-handler.js` | 删 |
| `panel/index.html:967` | `other-listeners/test-ops.js` | 删 |
| `panel/index.html:1007` | `js/background/website-login.js` | 删 |
| `panel/index.html:1017` | `converttosimage.js`（html2canvas） | 删 |
| `panel/index.html:1018-1021` | `popup-sharing.js` | 删 |
| `panel/index.html:1022-1025` | `self-healing-rating.js` | 删 |
| `panel/index.html:1026-1027` | 两行已注释的 script | 删 |
| `panel/index.html:1028-1031` | `popup-rate-us.js` | 删 |
| `panel/index.html:1034` | `js/katalon/kar-upload.js` | 删 |
| `panel/js/katalon/kar.js:1-41` | `testOpsEndpoint` / `testOpsUrls` / `updateTestOpsLoginToken` | 删 |
| `panel/js/UI/controllers/top-toolbar/actions.js:1-68` | 所有 import + `logout` + `setUserAfterLogin` | 删 |
| `panel/js/UI/controllers/top-toolbar/actions.js:105-170` | 启动检查 + onChanged + 登录按钮 + OAuth 回调 | 删 |
| `panel/js/UI/controllers/top-toolbar/actions.js:71-104` | **保留**（play 按钮分发逻辑） | 留 |
| `play-actions.js:730-747` | `switchPS()` 里的 TestOps 自动上传块 | **删**（保留 :717-729 的按钮状态切换与 :728 的窗口聚焦） |
| `testCase-grid-test-case-listener.js:1,24,46-51,77-89` | 门禁注释 + `popupPromoteSignup` import 与调用 | 删 |
| `generate-test-case-context-menu.js:22,24,82,135-144` | 同上 | 删 |
| `testCase-grid-test-suite-listener.js:13,103` | 已注释的门禁 | 删 |
| `record-actions.js:1,16` | 已注释 | 删 |
| `dynamic-test-suite.js:4,36` | 已注释 | 删 |
| **全仓 59 处 `from ".../tracking-service/..."` import** | 分布在 47 个文件 | 逐个删 import + 删调用（共 204 处调用） |

### 8.3 清理顺序建议

埋点调用点有 204 处、分布 24 个文件，逐个删容易漏。**推荐两段式**：

1. **第一阶段（保证能跑）**：不动调用点，先把 `segment-tracking-service.js` 换成一个 **no-op 桩**（见 §9.2），确认插件正常工作。
2. **第二阶段（彻底清理）**：用 `grep -rn "tracking\|Tracker\." panel/` 逐文件删调用与 import，删完再删桩文件。

如果只想快速裁剪，**停在第一阶段就已经切断了全部网络上报**，这是最低成本的合规化路径。

---

## 9. 裁剪建议

### 9.1 三档裁剪方案

| 档位 | 做法 | 删除量 | 剩余风险 |
|---|---|---|---|
| **A 最小合规（1 小时）** | 只做 3 件事：① `segment-tracking-service.js` 换 no-op 桩；② `background/install.js` 删 `trackingInstallApp()` 与 `configUninstallUrl`；③ manifest 删 `externally_connectable` | ~0 行（改 3 处） | 代码仍在，但无任何外发 |
| **B 标准剥离（推荐）** | 执行 §8.1 + §8.2 全表，保留 panel UI 骨架 | ≈14,100 行 | 需处理 47 个文件的 import |
| **C 彻底重写** | 按 §10 的 MVP 从零搭鉴权/埋点层（即：不搭） | — | — |

### 9.2 no-op 桩（方案 A 的核心文件）

把 `panel/js/UI/services/tracking-service/segment-tracking-service.js` 整体替换为：

```js
// segment-tracking-service.js —— no-op 桩，保持 API 形状，不发任何请求
const noop = () => Promise.resolve();

export class Tracker {
  static upload()                 { return noop(); }
  static uploadKeyword()          { return noop(); }
  static openApplication()        { return noop(); }
  static uiAction()               { return noop(); }
  static promoteSignUpPopupAction(){ return noop(); }
  static track()                  { return noop(); }
}

// 与原文件 :516-565 导出清单逐一对齐，全部指向 noop
export const trackingInstallApp = noop,   trackingUninstallApp = noop,
             trackingCloseApp = noop,     trackingLogin = noop,
             trackingSignin = noop,       trackingSignup = noop,
             trackingRecord = noop,       trackingTestCase = noop,
             trackingTestSuite = noop,    trackingCreateTestCase = noop,
             trackingCreateTestSuite = noop, trackingOpenTestCase = noop,
             trackingSaveTestCase = noop, trackingSaveTestSuite = noop,
             trackingAddTestStep = noop,  trackingDeleteTestStep = noop,
             trackingCopyTestStep = noop, trackingPasteTestStep = noop,
             trackingSelectTargetElement = noop,
             trackingHightlightTargetElement = noop,
             trackingExecuteTestCase = noop, trackingExecuteTestSuite = noop,
             trackingExecuteTestSuites = noop, trackingExecuteAll = noop,
             trackingPause = noop,        trackingOpenTestOpsReport = noop,
             trackingOpenExport = noop,   trackingExportTestCase = noop,
             trackingOpenHelp = noop,     trackingOpenAdjustSpeed = noop,
             trackingOpenGithub = noop,   trackingOpenSetting = noop,
             trackingOpenExtendedFeatures = noop, trackingOpenDialyUsage = noop,
             trackingSegment = noop,      trackingNPSScore = noop,
             trackingNPSWebStrore = noop, trackingOpenedUserManual = noop,
             trackingCompletedTutorials = noop, trackingReplayGettingStarted = noop,
             trackingTickedDoneTutorial = noop, trackingClickedTutorial = noop,
             trackingCloseUserManualWithoutDoingAnything = noop,
             trackingSkippedTheTour = noop, trackingCompletedTheTour = noop,
             trackingSkippedStep = noop,  setSegmentUser = noop;
```

**注意**：`trackingTestCase` 原本还有副作用（`playback-local-tracking.js` 的本地计数），若你还想留自愈满意度弹窗就不能直接 noop。但既然要删营销，一并 noop 即可。

### 9.3 删除后必须验证的功能点

| 功能 | 为何可能被误伤 |
|---|---|
| 回放结束后按钮状态恢复 | `switchPS()` 里 TestOps 块和按钮切换在**同一个函数**（play-actions.js:717-749），删的时候别把 :718-729 一起删了 |
| panel 窗口聚焦 | `browser.windows.update(extensionId, {focused: true})` 在 play-actions.js:728，紧挨着要删的 TestOps 块 |
| 顶栏 play 按钮下拉分发 | `actions.js:73-103`，与要删的 OAuth 代码在同一个 `$(() => {...})` 里 |
| `firstTime` 键 | `install.js:24` 写、`kar-upload.js:34` 也写。删 kar-upload 后要确认没有别处依赖它为 `false` |
| 保存用例右键菜单 | `generate-test-case-context-menu.js:127-147` 的 click handler 里混着营销逻辑，`saveData()`/`removeDirtyMarks()` 必须保留 |
| 「新建用例」 | `testCase-grid-test-case-listener.js:40-91`，营销代码在函数尾部 :77-89，前面全是业务逻辑 |

### 9.4 权限收缩收益

删完本模块后，`manifest.json:64` 的 permissions 可以从 12 项减到 8 项：

```jsonc
// 原（manifest.json:64）
["tabs","activeTab","contextMenus","downloads","webNavigation",
 "notifications","cookies","storage","unlimitedStorage","debugger","scripting","offscreen"]

// 裁剪后
["tabs","activeTab","contextMenus","downloads","webNavigation",
 "storage","unlimitedStorage","debugger","scripting"]
```

| 移除项 | 原用途 | 移除后影响 |
|---|---|---|
| `cookies` | persistent-store 三级持久化、`kr_campaign_source` 归因 | 无 |
| `offscreen` | 只用于 FingerprintJS + browserName | 需替换 browserName 获取方式（或删掉） |
| `notifications` | 仅 `install.js:86-97` 的 `notificationUpdate`，而该函数的唯一调用点已被注释（:31） | 无 |

**这是给用户的最直观信号**：Chrome 商店的权限提示会从「读取和更改你在所有网站上的数据 + 读取 cookie + 显示通知」缩短。

---

## 10. 最小可用实现（个人插件：零鉴权、零埋点）

### 10.1 设计原则

个人录制回放插件**不需要账号体系**。所有 KR 用登录解锁的东西，本地替代方案都更好：

| KR 的云端能力 | 本地替代 | 实现成本 |
|---|---|---|
| TestOps 15 分钟全量备份 | `chrome.storage.local` + 手动「导出 JSON」按钮 | 已有（TECH-08 的 marshall/unmarshall） |
| TestOps 报告上传 | 「保存日志」按钮下载 `.log` / `.html` | 已有（TECH-12） |
| 跨设备同步 | `chrome.storage.sync`（限 100KB）或用户自己放网盘 | 20 行 |
| 用户身份 | 不需要 | 0 行 |

### 10.2 替代文件 1：`identity.js`（约 20 行，可选）

如果你的 UI 里有若干处 `userService.getLoginInfo()` 不想全删，给一个恒定未登录的桩：

```js
// panel/js/services/identity.js —— 恒定"单机用户"，不联网
export const userService = {
  async getLoginInfo() {
    return { hasLoggedIn: false, isActived: false, user: "" };
  },
};

// 兼容 UsageWatcher 调用点：什么都不记
export const usageWatcher = {
  async countPromoteSignUp()   {},
  async countSavingTestCase()  {},
  async countCreatingTestCase(){},
  async loadUsageRecord(key)   { return { key, count: 0, lastTime: Date.now() }; },
};
export const UsageKey = { SAVE_TEST_CASE: "s", CREATE_TEST_CASE: "c", PROMOTE_SIGN_UP: "p" };
export const isNewDay = () => false;    // ← 永远返回 false，弹窗逻辑自然短路
```

> `isNewDay` 恒 `false` 是一个优雅的短路：`generate-test-case-context-menu.js:141` 和 `testCase-grid-test-case-listener.js:85` 两处判断直接失败，弹窗永不出现，**一行代码不用改**。

### 10.3 替代文件 2：`local-backup.js`（约 45 行，替代整个 TestOps）

```js
// panel/js/services/local-backup.js
// 替代 kar-upload.js(286) + test-ops-service.js(9) + test-ops.js(33)

const BACKUP_KEY_PREFIX = "__backup__";
const MAX_SNAPSHOTS = 5;

/** 导出全部数据为 JSON 文件（用户手动触发） */
export async function exportAll() {
  const all = await browser.storage.local.get(null);
  // 过滤内部快照键，避免嵌套自增长
  const clean = Object.fromEntries(
    Object.entries(all).filter(([k]) => !k.startsWith(BACKUP_KEY_PREFIX))
  );
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  await browser.downloads.download({
    url,
    filename: `recorder-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.json`,
    saveAs: true,
  });
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** 从文件恢复 */
export async function importAll(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  await browser.storage.local.set(data);
  location.reload();
}

/** 本地滚动快照：每 15 分钟存一份到 storage，只留 5 份 */
export function startLocalSnapshot(intervalMs = 15 * 60 * 1000) {
  setInterval(async () => {
    const all = await browser.storage.local.get(null);
    const clean = Object.fromEntries(
      Object.entries(all).filter(([k]) => !k.startsWith(BACKUP_KEY_PREFIX))
    );
    const keys = Object.keys(all).filter((k) => k.startsWith(BACKUP_KEY_PREFIX)).sort();
    if (keys.length >= MAX_SNAPSHOTS) {
      await browser.storage.local.remove(keys.slice(0, keys.length - MAX_SNAPSHOTS + 1));
    }
    await browser.storage.local.set({ [`${BACKUP_KEY_PREFIX}${Date.now()}`]: clean });
  }, intervalMs);
}
```

与 KR 版本的差异对照：

| 维度 | KR（kar-upload.js） | 本 MVP |
|---|---|---|
| 数据去向 | S3 预签名 URL → TestOps | 本地 `storage.local` / 用户选择的下载目录 |
| 触发 | 定时 15 分钟 **静默** | 定时快照（本地）+ 手动导出（有 `saveAs` 弹窗） |
| 内容 | `storage.local.get(null)` **含 refreshToken/codePKCE** | 已过滤内部键；且本 MVP 根本不存 token |
| 依赖 | jQuery `$.ajax` × 3 层嵌套回调 | `fetch` 无、纯 storage API |
| 需要权限 | 网络 + 登录态 | `downloads`（已有） |
| 行数 | 286 | 45 |
| 快照数量上限 | 无（服务端管） | 5 份滚动 |

### 10.4 `unlimitedStorage` 的注意事项

MVP 用 `storage.local` 存 5 份全量快照，会明显放大占用。KR 已经申请了 `unlimitedStorage`（manifest.json:64），**保留这一项**。若你想去掉它，把 `MAX_SNAPSHOTS` 降到 1、或改用 IndexedDB。

### 10.5 顶栏 UI 的删减

`panel/index.html:230-231` 那两个元素删掉后，顶栏右侧会空出来。可以放：

```html
<!-- 替代 #login-button / #login-user 的位置 -->
<button id="export-all"  class="sub_btn" title="导出全部数据">⭳</button>
<button id="import-all"  class="sub_btn" title="导入备份">⭱</button>
<input type="file" id="import-file" accept="application/json" style="display:none" />
```

绑定（约 10 行）：

```js
import { exportAll, importAll, startLocalSnapshot } from "../services/local-backup.js";
$("#export-all").click(exportAll);
$("#import-all").click(() => $("#import-file").click());
$("#import-file").on("change", (e) => e.target.files[0] && importAll(e.target.files[0]));
startLocalSnapshot();
```

**总计：MVP 用 ~75 行替代了 KR 的 ~14,100 行。**

---

## 11. 复刻检查清单

裁剪完成后，逐条打勾：

- [ ] `grep -rn "backend.katalon.com\|web-api.katalon.com\|login.katalon.com\|testops.katalon.io\|katalon-persistent-domain" --include=*.js --include=*.html .` **零结果**
- [ ] `grep -rn "tracking-service\|segment\|hubspot\|fingerprint\|anonymousId" --include=*.js panel background common` **零结果**
- [ ] `manifest.json` 中 `externally_connectable`、`segment_url`、`hubspot_url`、`options_page` 已删
- [ ] `manifest.json` permissions 不含 `cookies` / `offscreen` / `notifications`
- [ ] `worker_wrapper.js` 的 importScripts 列表中不含 segment / fingerprint / persistent-store / offscreen / jwtJsDecode
- [ ] 装载扩展后，SW 控制台 **零报错**（重点看 `setting.tracking` 的 TypeError 是否已随文件删除而消失）
- [ ] DevTools → Network 面板，完成一次「录制 → 回放 → 保存」全流程，**无任何跨域请求**（只应有被测站点自身的请求）
- [ ] `chrome://extensions` → 详情 → 权限描述里不再出现「读取和更改你的 Cookie」
- [ ] 卸载扩展，**不弹出 tell-us-why 页面**
- [ ] `chrome.storage.local.get(null)` 检查：无 `segment` / `hubspot` / `checkLoginData` / `anonymousId` / `visitor` / `codePKCE` / `refreshToken` 键
- [ ] 回放结束后 stop 按钮正确恢复为 play 按钮（验证 `switchPS` 没删坏）
- [ ] 新建用例 / 保存用例流程完整（验证营销代码从函数尾部剥离干净）
- [ ] 导出 / 导入备份 JSON 往返一致
- [ ] 自愈功能仍工作（它只依赖 `setting["self-healing"]`，与本模块无关 — 见 TECH-02、TECH-13）

---

## 附：本模块与其他模块的边界

| 相邻模块 | 边界说明 |
|---|---|
| **TECH-12（报告截图）** | 报告的**生成**属 M12；报告的**上传到 TestOps** 属本模块（§3.4.3）。裁剪时 M12 保留、上传删除 |
| **TECH-13（设置系统）** | `setting.tracking` 这个字段的**读写与 UI** 属 M13（PrivacySettingTab）；它的**消费者**属本模块。删埋点后 M13 的 Privacy Tab 也应一并删除 |
| **TECH-02（定位器与自愈）** | 自愈的 `is_self_healing_triggered` 只是一个上报布尔；自愈本身与登录、账号完全无关 |
| **TECH-08（数据模型）** | `storage.local` 的用例/套件序列化格式属 M08；本模块只是把它整个 `get(null)` 传走 |
