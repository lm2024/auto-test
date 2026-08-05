# 90 · 裁剪清单与 MVP 路线图

> **这是"把 Katalon Recorder 变成你自己的插件"的作战地图。**
> 分级：🟥 可删 · 🟩 需保留 · 🟨 需改写

---

## 0. 先看结论

**要复刻的核心其实只有四块：**

| # | 核心机制 | 对应文件 | 代码量 |
|---|---|---|---|
| ① | **独立窗口 Panel + `master` 映射**的弹框架构 | `background/background.js` | ~120 行 |
| ② | **广播上行 / 定向下行 + frameLocation 差分**通信协议 | `content/recorder.js` ↔ `panel/js/background/recorder.js` | ~400 行 |
| ③ | **HTML 表格 + datalist 候选定位器 + data-tags** 存档格式 | `panel/js/UI/services/helper-service/parser.js` | 144 行 |
| ④ | **`newFormatters[id](name, commands) → {content, extension, mimetype}`** 导出契约 | `panel/js/katalon/newformatters/*.js` | 每个 20-230 行 |

**其余约 40% 的文件体积在纯净复刻中可以整块移除**：FingerprintJS 277KB、content-marketing、tracking-service、login/auth、旧式 Selenium-IDE formatter 全家桶、Katalon Studio Object Spy。

---

## 1. 🟥 可删清单（含连锁处理）

### 1.1 完全零引用（删了什么都不会发生）

| 路径 | 体量 | 证据 |
|---|---|---|
| `content-marketing/socket-io/` | 1 文件 | 全仓 grep 零匹配 |
| `content-marketing/panel/popup-sample-data.js` | 82 行 | 全仓 grep 零匹配 |
| `manifest.bak.json` | — | 构建残留（**但分析价值极高，建议先归档再删**） |
| `tests/` | 13 文件 | 仅示例数据 |
| `panel/index.html:52` 的 `html5shim.googlecode.com` | 1 行 | 域名早已失效 |

### 1.2 已被注释掉（官方自己在解耦）

| 路径 | 注释位置 |
|---|---|
| `content-marketing/panel/popup-chrome-store.js` | `panel/index.html:1026` 已注释 |
| `content-marketing/panel/popup-what-are-you-automating.js` | `panel/index.html:1027` 已注释 |
| `content-marketing/panel/popup-create-dynamic-test-suite.js` | 唯一 import 点 `dynamic-test-suite.js:4` 已注释 |
| `content-marketing/panel/popup-play-suite-quota.js` | 仅被上一项引用 |

### 1.3 营销弹窗（需同步删引用）

| 路径 | 行数 | ⚠️ 必须同步处理 |
|---|---|---|
| `popup-promote-signup.js` | 108 | **删 `testCase-grid-test-case-listener.js:24` 与 `generate-test-case-context-menu.js:22` 的 import 与调用**，否则模块加载即报错 |
| `popup-rate-us.js` | 200 | 删 `panel/index.html:1028-1031` |
| `popup-sharing.js` | 533 | 删 `panel/index.html:1018-1021` |
| `self-healing-rating.js` | 83 | 删 `panel/index.html:1022-1025` |
| `converttosimage.js` | 19 | 删 `panel/index.html:1017`（仅服务 popup-sharing） |
| `content-marketing/content/sharing-social.js` | — | 删 `manifest.json:34-39` 整个 content_scripts 项 + `bundles/content.2.bundle.js` |

### 1.4 登录体系

| 路径 | 说明 |
|---|---|
| `content-marketing/panel/login-inapp.js`（660 行） | 需先删两个 import 方（`popup-create-dynamic-test-suite.js:1`、`popup-play-suite-quota.js:2`） |
| `panel/js/UI/services/auth-service/`（65 行） | Keycloak OIDC。删 `top-toolbar/actions.js` 登录逻辑、`pages/welcome/welcome.js:10-11`、`manifest.json:73` 的 `katalon/authenticated.html` |
| `utils/generatePKCE.js` | 仅登录用 |

### 1.5 埋点与追踪（体积大头）

| 路径 | 体量 | 连锁处理 |
|---|---|---|
| `common/browser-fingerprint2.js` | **277 KB** | 删 `worker_wrapper.js:8`、`panel/index.html:872`、`panel/offscreen.html` |
| `panel/js/UI/services/tracking-service/`（整目录） | — | 摘掉约 10 处 import：`panel/js/background/recorder.js:5`、`import-selenium.js:1`、`KS-export-dialog.js:14`、`top-toolbar/actions.js` 等 |
| `background/segment-tracking-services.js` | — | 删 `worker_wrapper.js:4` |
| `common/get-browser-fingerprint.js` / `-background.js` | 小 | 删 `worker_wrapper.js:11`、`panel/index.html:873` |
| `common/get-anonymous-id.js` | 小 | 删 `worker_wrapper.js:10`、`panel/index.html:871` |
| `common/persistent-store.js` | 68 行 | **抗卸载追踪**（local + sync + 万年 Cookie）。删 `worker_wrapper.js:9`、`panel/index.html:870`；manifest 去掉 `cookies` 权限 |
| `common/offscreen.js` / `offscreen-server.js` / `panel/offscreen.html` | 小 | 仅服务埋点。manifest 去掉 `offscreen` 权限 |
| `background/install.js:45-62` 的 `configUninstallUrl` | 18 行 | 卸载回访 URL |

> **删除建议顺序（零风险三步走）**
> 1. 先把 `setting.tracking` 默认改 `false`，跑一遍验证功能无损
> 2. 把所有 `trackingXxx()` 替换成空函数 `const trackingXxx = () => {}`（保留调用点，零改动）
> 3. 再物理删除文件与权限

### 1.6 Katalon Studio 联动（Object Spy）

| 路径 | 说明 |
|---|---|
| `katalon/`（179 文件，去掉 images 后约 24 个 js） | 删 `worker_wrapper.js:17-21` 五行 import |
| `playback/`（7 文件） | 外部 socket 驱动的第二套回放引擎 |
| `setting-panel/js/setting-tabs/KS-port-setting-tab.js` | 端口设置 Tab |
| `katalon/options.html` + `katalon/options.js` | 与 KS Port Tab 重复的旧版页面。删 `manifest.json:63` 的 `options_page` |

### 1.7 导出体系裁剪

| 路径 | 裁剪方式 |
|---|---|
| `panel/js/katalon/selenium-ide/`（旧式体系全家桶） | 建议**整块废弃**，只保留新式 formatter。若要保留部分语言，同步删 `kar-generateScript.js:30-143` 的对应 case + 两个下拉的 `<option>` |
| `panel/js/katalon/newformatters/` 中不需要的 | 同步删 `panel/index.html:1049-1073` 与下拉 `<option>` |
| `iedoc-core.xml` | 与旧式体系同生共死（⚠️ 但 Reference 标签页依赖它，若要保留 Reference 则不能删） |
| 外部扩展导出协议 | `manifest.json:46-50` + `background/kar.js:265-322` + `kar-generateScript.js:194-228` |

### 1.8 联网域名总表（删了这些就完全离线）

| 域名 | 用途 | 出处 |
|---|---|---|
| `backend.katalon.com/api` | Segment 埋点 | `manifest.json:68` |
| `web-api.katalon.com` | HubSpot + 用户信息 | `manifest.json:51,53` |
| `login.katalon.com` | Keycloak OIDC | `auth-service.js:7` |
| `api.katalon.com/auth` | 旧版鉴权 | `login-inapp.js:281` |
| `my.katalon.com/profile` | 账号页外链 | `login-inapp.js:244` |
| `testops.katalon.io` | 报告/备份上传 | `panel/js/katalon/kar.js:5` |
| `analytics.katalon.com` | TestOps 外链 | `kar-upload.js:184` |
| `katalon.com/.../tell-us-why` | 卸载回访 | `background/install.js:48` |
| `katalon-persistent-domain.com` | **虚构域名**，仅用于种 Cookie 做跨设备识别 | `common/persistent-store.js:3-4` |
| facebook/twitter/linkedin | 社交分享 | `manifest.json:38` |

### 1.9 收益估算

| 删除项 | 体积收益 | 权限收益 |
|---|---|---|
| `browser-fingerprint2.js` | −277 KB | — |
| `content-marketing/` | −约 40 KB | — |
| `tracking-service/` + 相关 common | −约 15 KB | −`cookies`、−`offscreen` |
| `katalon/` + `playback/` | −约 200 KB（含图标） | −`debugger`（若也不要文件上传） |
| 旧式 formatter 全家佣 | −约 300 KB | — |
| **合计** | **≈ −830 KB** | `permissions` 从 12 项 → 6-8 项 |

---

## 2. 🟩 必须保留清单

| 路径 | 作用 | 不可删的理由 |
|---|---|---|
| `worker_wrapper.js` | SW 入口 | MV3 唯一后台入口 |
| `background/background.js` | 开窗 / 右键菜单 / Port | 弹框架构的全部 |
| `background/kar.js` | CDP 上传+按键、截图、窗口尺寸 | 文件上传/特殊按键无替代方案 |
| `background/install.js` | 安装引导 / `open-panel` 消息 | 保留 `open-panel`/`focus-panel` 分支即可 |
| `common/browser-polyfill*.js`（3 份） | `browser.*` Promise 化 | 全项目 API 基础 |
| `common/remote-object-helper-*.js`（97 KB × 2） | MAIN↔ISOLATED RPC | MAIN world 录制的必需品 |
| `common/chrome-polyfill.js` / `-server.js` | 同上应用层 | 同上 |
| `common/promise-utils.js` | `retryUntilSuccess` | 通信重试 |
| `common/escape.js` | 转义 | Selenium API 依赖 |
| `bundles/content.1.bundle.js` | 全部录制/回放内容脚本 | 核心 |
| `content/`（除 sharing-social） | 录制器 / Selenium API / 定位器源文件 | 核心（运行时不加载但重新打包需要） |
| `panel/index.html` + `panel/js/background/` | 真·后台 | 核心 |
| `panel/js/UI/services/helper-service/parser.js` | `.krecorder` 存档读写 | 存档格式 |
| `panel/js/UI/services/helper-service/SandboxEvaluator.js` + `panel/sandbox.*` | 合规 `eval` | `storeEval`/`runScript` |
| `panel/js/UI/services/self-healing-service/` | 自愈定位 | 核心卖点 |
| `panel/js/UI/services/selenium-service/` | `.side` 导入 | 可选但推荐 |
| `panel/js/background/formatCommand.js` | `${var}` 插值 | 回放 + 导出双用途 |
| `page/prompt.js` / `page/runScript.js` | web_accessible 注入脚本 | 回放 alert/script |
| `setting-panel/`（除 Privacy Tab） | 设置面板 | 自愈优先级配置 |
| `interface/Interface.js` | `ISettingTab` 契约 | 设置面板依赖 |

---

## 3. 🟨 必须改写清单

| 位置 | 问题 | 改法 |
|---|---|---|
| `manifest.json:44` | `default_popup` 指向不存在目录且位置错误（当前"靠 bug 工作"） | **直接删除该行** |
| `manifest.json:42` | CSP 写了 `unsafe-eval; unsafe-inline;`（无效关键字，整条被忽略） | 恢复 `"script-src 'self'; object-src 'self'"` |
| `manifest.json:48` | `externally_connectable.ids: ["*"]` 任意扩展可连 | 白名单或删除 |
| `manifest.json:52` | `host_permissions` 冗余列三项 | 只留 `<all_urls>` 或收窄 |
| `window-controller.js:328-331` | `getBackgroundPage()` MV3 已移除，无 catch | 改消息通知 SW 更新 `master` |
| `window-controller.js:322,337,346` | 硬编码 `https://www.google.com` 兜底首页 | 改 `about:blank` 或配置项 |
| `katalon/background.js:138-179` | SW 中 `new XMLHttpRequest()` | 改 `fetch`（调用点已注释，是随时会炸的地雷） |
| `background/background.js:228-235` | `port` 单变量、无判空、多 Panel 覆盖 | `Map<windowId, Port>` + `onDisconnect` 清理 |
| `background/background.js:93,110-120` | `popupWindowIDs` 只 push 不 splice | `onRemoved` 同步清理 |
| `background/background.js:61-91` | 500ms×100 轮询等 Panel ready | Panel 主动 `sendMessage({panelReady:true})` |
| `background/background.js:105` vs `kar.js:2` | `getWindowSize` 传 2 参收 1 参 | 统一签名 |
| `load-setting-data.js:20-25` | 只在 `setting` 完全不存在时写默认值，字段缺失不补齐 | schema 版本号 + deep-merge 迁移 |
| `self-healing-setting-tab.js:205` | `Object.assign(settingData["self-healing"], ...)` 未初始化会 TypeError | `{...(x ?? {}), ...y}` |
| `privacy-setting-tab.js:29` | 生产代码里的 `debugger;` 语句 | 删除 |
| `test-execution-setting-tab.js:34` | HTML 笔误 `for="continue":` | 修正 |
| `katalon/chrome_common.js:14-24` + 3 个 `chrome_variables_*.js` | 端口游离在 `setting` 外；SW 侧默认 50000、内容脚本侧默认 59844，**不一致** | 并入 `setting.ksPort`，单一默认值来源 |
| `remote-object-helper-*.js` | 明文密钥 `"pandoraboz"` + `postMessage(*, "*")`，同页脚本可劫持 `chrome.storage` | 随机 nonce（ISOLATED 侧通过 DOM 属性下发）+ origin 校验 |
| `utils/generatePKCE.js:14-22` | PKCE `code_verifier` 用 `Math.random()` | `crypto.getRandomValues` |
| `common/get-browser-name.js:43-60` | Edge 永远被识别为 Chrome | 调整判定顺序或用 `userAgentData` |
| `bowser.js:278`（3 份副本） | 版本正则只取两段，Chrome 150.0.7204 → `150.0` | `/([\d.]+)/` 或 `userAgentData.getHighEntropyValues` |
| `kar-generateScript.js:244-249` | 旧式 formatter 覆盖全局 `formatCommand` 后需重新注入恢复 | 全面迁移到 `newFormatters` 契约 |
| `newformatters/*.js` | 每个文件重复一份 50+ 项 `unsupportedCommands` | 抽共享常量，改返回值字段 |
| `newformatters/webdriver.js:198-205` | `_VALUE_STR_`/`_VALUE_` 替换顺序敏感 | 一次性 `replace(/_([A-Z_]+)_/g, ...)` |
| `newformatters/webdriver.js:215-217` | `target.split("=",1)` 得数组当 key 用 | `const [locType] = target.split("=", 1)` |
| `self-healing-service/utils.js`（4 处） | 每函数独立 `await storage.get`，单条命令读 3-4 次 | 内存缓存 + `storage.onChanged` 失效 |
| `segment-tracking-service.js:51` | `kru_install_application` 绕过 tracking 开关 | 删该 `\|\|` 条件（若保留埋点） |
| `background/install.js:75-78` | 每条 runtime 消息都重算卸载 URL | 只在登录态变化时算 |

---

## 4. MVP 路线图：四个阶段

### 阶段 0 · 准备（半天）

- [ ] 归档 `manifest.bak.json`（它是官方的架构说明书）
- [ ] 复制一份原始扩展做 baseline，用于对照测试
- [ ] 建一个测试页面集合：普通表单页 / 含 iframe 页 / SPA 页 / 会开新窗口的页
- [ ] 决策题（见 `91-你还缺什么.md`）：要不要文件上传？要不要多语言导出？要不要自愈？

### 阶段 1 · 最小可跑通（MVP-1，目标 ~1500 行）

**能力范围**：单标签页 · 无 iframe · 12 条 P0 命令 · 单一定位器 · 内存存储

```
my-recorder/
├── manifest.json                  ← 权限只要 tabs / activeTab / storage / scripting
├── sw.js                          ← 只做：action.onClicked → windows.create
├── content/
│   └── recorder.js                ← 事件捕获 + 简单定位器（id > css > xpath）
├── panel/
│   ├── index.html                 ← 一个 table + 三个按钮（Record/Play/Stop）
│   ├── recorder-backend.js        ← 接收命令消息，addCommand 到表格
│   └── player.js                  ← 主循环 + sendCommand
└── content/
    └── executor.js                ← 接收命令，findElement + 执行
```

**12 条 P0 命令**：`open` `click` `type` `select` `sendKeys` `pause` `assertText` `verifyText` `assertTitle` `waitForElementPresent` `waitForVisible` `echo`

**验收**：在测试页面上录制"填表单 → 提交 → 断言结果"，保存后重放成功。

→ 用 `prompts/PROMPT-00-总控.md` 一次性生成骨架

### 阶段 2 · 工程化（MVP-2，目标 ~4000 行）

- [ ] **多候选定位器** + `.krecorder` 存档格式（抄 `parser.js`，60 行）
- [ ] **iframe 支持**：frameLocation 差分（抄 `recorder.js:271-293`）
- [ ] **多窗口支持**：`win_ser_local` 别名表（抄 `recorder.js:212-224`）
- [ ] **命令表格增强**：拖拽排序、增删行、撤销重做、自动补全
- [ ] **日志面板**：`[info]/[error]` 分级 + 自动滚动
- [ ] **变量系统** `${var}` + `storeXxx`
- [ ] **设置面板**：超时、自愈开关

### 阶段 3 · 差异化（MVP-3）

按你自己的需求挑选，**不要照搬 KR 的全集**：

| 能力 | 建议 | 理由 |
|---|---|---|
| Self-healing 自愈 | ✅ 强烈推荐 | 22 行的 `getPossibleTargetList` 换来巨大实用价值 |
| 流程控制 if/while | ⚠️ 视需求 | 实现复杂度中等，但会让"测试脚本"变成"编程语言" |
| 代码导出 | ✅ 推荐 1-2 种 | 用新式 formatter 契约，每种 50 行 |
| 截图 | ✅ 推荐 | `tabs.captureVisibleTab`，30 行 |
| 文件上传 | ❌ 除非必需 | 需要 `debugger` 权限，浏览器会挂调试横幅 |
| 数据驱动 CSV | ⚠️ 视需求 | 需要 papaparse |
| 云端同步/报告 | ❌ 不建议 | 个人插件不需要 |
| 埋点 | ❌ 坚决不要 | — |

### 阶段 4 · 打磨

- [ ] 用 TypeScript 重写（KR 全是裸 JS，类型全靠猜）
- [ ] 加单元测试（尤其是定位器生成器和 formatter，都是纯函数好测）
- [ ] 换掉 jQuery（KR 用 jQuery + jQuery UI，现代方案用原生 + 一个轻量拖拽库）
- [ ] 用 Vite/esbuild 做真正的打包（KR 是纯文本拼接）

---

## 5. 技术选型建议（对照 KR 的选择）

| 维度 | KR 的选择 | 建议 | 理由 |
|---|---|---|---|
| 语言 | 裸 JS（ES5 + 少量 ES6） | **TypeScript** | 命令模型、消息协议的类型约束价值极大 |
| Panel UI | jQuery + jQuery UI | **原生 + dnd-kit / Sortable.js**，或 React | jQuery UI 已停止维护 |
| 打包 | 文本拼接 | **Vite + @crxjs/vite-plugin** | 支持 HMR，MV3 友好 |
| 状态管理 | 全局变量 + DOM 当数据源 | **单一 store（Zustand / 自写）** | KR 的"DOM 即数据源"是最大痛点（双层 div 存 real/show 值） |
| 存档 | HTML 表格（Selenium IDE 兼容） | **保持 HTML 表格** | 生态兼容性无可替代 |
| polyfill | webextension-polyfill × 3 副本 | **一份 + 构建复制** | — |
| 浏览器检测 | bowser 1.x | **navigator.userAgentData** | 准确且无需依赖 |
| eval | sandbox iframe | **保持 sandbox iframe** | MV3 下唯一合规路径 |
| 通信 | 广播 + 定向 | **保持** | 已验证的最佳实践 |

---

## 6. 一张图看懂裁剪后的形态

```
原版 KR 7.1.0                        你的插件（MVP-2）
─────────────────────────           ─────────────────────────
manifest.json (12 权限)      →      manifest.json (5 权限)
worker_wrapper.js (22 imports) →    sw.js (~150 行)
background/ (4 文件)          →      sw.js 内联
common/ (20 文件)             →      common/ (5 文件：polyfill/rpc/utils)
content/ (22 文件)            →      content/ (4 文件)
katalon/ (179 文件)           →      ❌ 删除
content-marketing/ (13 文件)  →      ❌ 删除
playback/ (7 文件)            →      ❌ 删除
panel/ (424 文件)             →      panel/ (~30 文件)
  ├ js/background/            →        ├ backend/ (recorder + player)
  ├ js/UI/ (200+ 文件)         →        ├ ui/ (~15 文件)
  ├ js/katalon/selenium-ide/  →        └ formatters/ (2-3 个)
  └ js/katalon/newformatters/ →
setting-panel/ (12 文件)      →      settings/ (3 文件)
─────────────────────────           ─────────────────────────
≈ 700 文件 / ≈ 8 MB                  ≈ 60 文件 / ≈ 400 KB
```
