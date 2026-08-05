# PRD-00 · 产品总纲

> **本文定义的不是 Katalon Recorder，而是你要做的那个插件。**
> 其余 7 份 PRD 是模块级需求，本文是它们的**上位文档**：定范围、定原则、定数据模型、定验收。
> 所有"参考实现"列均指向 KR 7.1.0 源码 `文件路径:行号`，可回溯。

---

## 1. 背景与目标

### 1.1 背景

现有方案都不完全合适：

| 方案 | 问题 |
|---|---|
| **Katalon Recorder 7.1.0** | 能力全，但夹带大量商业闭环：埋点（FingerprintJS 277 KB）、账号登录、TestOps 云、营销弹窗、抗卸载 Cookie；约 700 文件 / 8 MB；且存在明文 RPC 密钥等安全缺陷 |
| **Selenium IDE** | 生态好但演进停滞，自愈能力弱 |
| **Playwright Codegen** | 录制质量高，但必须跑在本地 Node 进程里，不是浏览器插件，非技术同学用不了 |

**机会点**：把 KR 的核心机制（DOM 语义录制 + 多候选定位器 + 自愈回放 + 存档兼容）抽出来，做成一个**纯本地、零联网、无账号、约 60 文件 / 400 KB** 的个人插件。

### 1.2 产品一句话

> **一个装在 Chrome 里、把你的浏览器操作翻译成可回放的语义命令表、并能导出成自动化测试代码的纯本地录制器。**

### 1.3 目标

| 编号 | 目标 | 成功标准 |
|---|---|---|
| G1 | 录得准 | 在测试页面集合上录制"填表单 → 提交 → 断言"，命令数与人类预期一致（敲 10 个字符只产 1 条 `type`），无冗余命令 |
| G2 | 放得稳 | 同一份用例连续回放 10 次全绿；页面局部改版（改 class 名）后靠自愈仍能通过 |
| G3 | 看得懂 | 命令表格可拖拽排序、可编辑、可撤销；日志分级清晰，失败能定位到具体命令行 |
| G4 | 存得住 | 存档格式人可读、可 Git diff、可被 Selenium IDE 打开 |
| G5 | 出得去 | 至少 1 种语言的代码导出，导出结果**开箱可运行** |
| G6 | 干净 | 零联网请求、零埋点、权限 ≤ 6 项、总体积 ≤ 500 KB |

### 1.4 非目标（明确不做）

云同步、账号体系、团队协作、TestOps/报告上传、埋点分析、19 种语言全量导出、Katalon Studio 联动（Object Spy / socket 回放引擎）、移动端。

---

## 2. 目标用户与场景

| 角色 | 场景 | 关键诉求 |
|---|---|---|
| **主要：你自己（Java 背景开发/测试）** | 回归测试、重复性表单操作、Bug 复现步骤留档 | 快、准、可改、能导出成代码接进现有测试工程 |
| 次要：非技术同事 | 提 Bug 时录一段复现步骤 | 装上就能用，不用配环境 |

---

## 3. 产品原则（架构级决策，不可动摇）

| # | 原则 | 理由 | 违反的后果 |
|---|---|---|---|
| **P1** | **后台大脑放在 Panel 独立窗口，不放 Service Worker** | MV3 的 SW 空闲 30s 被回收、无 DOM、无 `window.prompt()` | 录制状态机随时丢失 |
| **P2** | **录制工作在 DOM 事件层，不碰 network 层** | 用户要的是"我点了登录按钮"，不是 47 条 XHR | 产出的是流量日志不是测试用例 |
| **P3** | **一次交互只产一条命令** | 靠白名单 + 入口守卫 + 状态机三层收敛 | 敲 10 个字符出 10 条 `type` |
| **P4** | **定位器必须多候选，不能单值** | 自愈的前提；单定位器脚本一改版就全挂 | 无法实现 G2 |
| **P5** | **状态存在单一 store，不存在 DOM 里** | KR 用"双层 div 存 real/show 值"把 DOM 当数据源，是它最大的技术债 | 排序/撤销/导出各写一套读取逻辑 |
| **P6** | **导出只用纯函数契约 `(name, commands) => {content, extension, mimetype}`** | 旧式全局函数层叠体系无法调试 | 加一种语言污染全局 |
| **P7** | **零联网** | 个人插件不需要任何服务端 | 隐私与合规风险 |
| **P8** | **TypeScript，命令模型与消息协议必须有类型** | 系统的复杂度全在这两个模型上 | 改一处炸三处 |

---

## 4. 功能范围（分期矩阵）

图例：✅ 做 · ⬜ 暂不做 · ❌ 永不做

| 能力 | MVP-1 | MVP-2 | MVP-3 | 模块 PRD |
|---|:---:|:---:|:---:|---|
| 点击插件图标开出 Panel 独立窗口 | ✅ | ✅ | ✅ | PRD-05 |
| 录制 click / type / select / submit | ✅ | ✅ | ✅ | PRD-01 |
| 录制 check / uncheck / mouseOver / dragdrop | ⬜ | ✅ | ✅ | PRD-01 |
| 单一定位器（id > css > xpath） | ✅ | — | — | PRD-02 |
| **多候选定位器数组** | ⬜ | ✅ | ✅ | PRD-02 |
| `xpath:neighbor` 邻居定位器 | ⬜ | ⬜ | ✅ | PRD-02 |
| **Self-healing 自愈** | ⬜ | ✅ | ✅ | PRD-02 |
| 12 条 P0 命令回放 | ✅ | ✅ | ✅ | PRD-03 |
| **命令元编程**（doXxx 派生 assert/verify/store/waitFor/AndWait） | ⬜ | ✅ | ✅ | PRD-03 |
| `${var}` 变量插值 + storeXxx | ⬜ | ✅ | ✅ | PRD-03 |
| **iframe 支持**（frameLocation 差分） | ⬜ | ✅ | ✅ | PRD-05 |
| **多窗口支持**（`win_ser_N` 别名） | ⬜ | ✅ | ✅ | PRD-05 |
| 命令表格：增删改 | ✅ | ✅ | ✅ | PRD-04 |
| 命令表格：**拖拽排序** | ⬜ | ✅ | ✅ | PRD-04 |
| 撤销 / 重做 | ⬜ | ✅ | ✅ | PRD-04 |
| 日志面板（info/error/debug 分级） | ✅ | ✅ | ✅ | PRD-04 |
| 截图（回放失败自动抓图） | ⬜ | ⬜ | ✅ | PRD-04 |
| `.krecorder` 存档读写 | ⬜ | ✅ | ✅ | PRD-06 |
| `.side` 导入 | ⬜ | ⬜ | ✅ | PRD-06 |
| 代码导出（1 种语言） | ⬜ | ✅ | ✅ | PRD-06 |
| 代码导出（第 2 种语言） | ⬜ | ⬜ | ✅ | PRD-06 |
| 设置面板（超时 / 自愈开关 / 录制选项） | ⬜ | ✅ | ✅ | PRD-07 |
| 测试套件（多用例批量跑） | ⬜ | ⬜ | ✅ | PRD-03 |
| 文件上传（CDP `debugger`） | ⬜ | ⬜ | ⬜ | 决策题 D3 |
| 流程控制 if / while | ⬜ | ⬜ | ⬜ | 决策题 D9 |
| 账号 / 云同步 / 埋点 / TestOps | ❌ | ❌ | ❌ | — |
| Katalon Studio 联动 | ❌ | ❌ | ❌ | — |

**MVP-1 验收线**：在本地测试页上录一段填表提交，保存到内存，点 Play 能重放成功。约 1500 行。

---

## 5. 全局用户故事

| ID | 故事 | 对应 FR |
|---|---|---|
| US-1 | 作为使用者，我点一下插件图标就能开出录制面板，不用记快捷键 | FR-G1 |
| US-2 | 作为使用者，我点 Record 后在页面上正常操作，面板里逐条出现我**能看懂的命令**，而不是网络请求 | FR-G2, FR-G3 |
| US-3 | 作为使用者，我在输入框里敲一整句话，只希望产生**一条** `type` 命令 | FR-G3 |
| US-4 | 作为使用者，录完发现第 5 步和第 6 步顺序反了，我想直接拖一下调整 | FR-G6 |
| US-5 | 作为使用者，我点 Play 能看到当前跑到第几条、成功还是失败、失败原因是什么 | FR-G4, FR-G7 |
| US-6 | 作为使用者，页面改版后脚本挂了，我希望它能自动换个定位器继续跑，并告诉我它换了什么 | FR-G5 |
| US-7 | 作为使用者，我要把用例存成文件，明天打开继续用，也能提交到 Git 里看 diff | FR-G8 |
| US-8 | 作为使用者，我要把用例导出成代码，粘进我现有的测试工程里直接跑 | FR-G9 |
| US-9 | 作为使用者，被测页面有 iframe，我不希望录制在这里断掉 | FR-G10 |
| US-10 | 作为使用者，我希望这个插件不联网、不上报任何数据 | FR-G11 |

---

## 6. 全局功能需求

| FR | 优先级 | 需求 | 参考实现（KR 源码） | 模块 |
|---|---|---|---|---|
| FR-G1 | P0 | 点击扩展图标 → `chrome.action.onClicked` → `chrome.windows.create({type:"popup"})` 开出 Panel 窗口；重复点击聚焦已有窗口 | `background/background.js:29-106` | 05 |
| FR-G2 | P0 | 在 capture 阶段监听白名单事件，**不申请 `webRequest` 权限** | `content/recorder.js`，manifest permissions 无 webRequest | 01 |
| FR-G3 | P0 | 三层收敛（白名单 → 入口守卫 → 状态机）：`input` 只记指针不产命令，`change` 才落 `type` | `content/recorder.js:102-118` | 01 |
| FR-G4 | P0 | 回放主循环逐条取命令 → `${var}` 插值 → 定向下发 → 收结果写日志 | `panel/js/background/window-controller.js:142-156` | 03 |
| FR-G5 | P1 | 定位失败时按候选列表依次重试，成功后记入自愈表供人工 Approve | `panel/js/UI/services/self-healing-service/` | 02 |
| FR-G6 | P1 | 命令表格支持拖拽排序，拖完重排编号并同步数据模型 | `panel/js/UI/` records-grid | 04 |
| FR-G7 | P0 | 日志分级 `[info]/[error]/[debug]`，回放开始输出浏览器信息行 | `panel/js/katalon/kar.js:513-529` | 04 |
| FR-G8 | P1 | 存档为 `.krecorder`（HTML 表格 + `<datalist>` 候选定位器 + `data-tags`），可 unmarshall 读回 | `helper-service/parser.js:92-131` / `:67-84` | 06 |
| FR-G9 | P1 | 导出走纯函数契约 `newFormatters[id](name, commands) → {content, extension, mimetype}` | `panel/js/katalon/newformatters/*.js` | 06 |
| FR-G10 | P1 | 上行消息携带 `frameLocation`，Panel 侧做差分，跨 frame 时自动补 `selectFrame` | `panel/js/background/recorder.js:271-293` | 05 |
| FR-G11 | P0 | 无任何外部域名请求；`host_permissions` 不含 katalon 系域名 | 对照 90 号 §1.8 域名总表逐条清除 | — |
| FR-G12 | P0 | MAIN world 的 `chrome.*` 代理**必须用随机 nonce**，`postMessage` 必须校验 origin | 反面教材：`common/remote-object-helper-page.js` 明文 `"pandoraboz"` | 05 |
| FR-G13 | P1 | 配置用**单一 `Settings` 对象 + `chrome.storage.local` 单 key + `storage.onChanged` 广播** | 反面教材：KR 散落多 key、多处直读 | 07 |
| FR-G14 | P2 | 命令元编程：定义 `doXxx` 自动派生 `assertXxx`/`verifyXxx`/`storeXxx`/`waitForXxx`/`xxxAndWait` | `content/selenium-api.js` + `selenium-commandhandlers.js` | 03 |

---

## 7. 非功能需求

| NFR | 要求 | 度量 |
|---|---|---|
| NFR-1 | 录制时对被测页面无感知影响 | 事件监听全部 passive/capture，不 `preventDefault`；录制浮层元素统一带标识并在录制时过滤自身 |
| NFR-2 | 单条命令下发到执行结果返回 ≤ 500 ms（不含页面等待） | — |
| NFR-3 | 500 条命令的用例，表格渲染与滚动不卡顿 | 超过 200 条启用虚拟滚动（KR 未做，见 91 号 U4） |
| NFR-4 | 权限最小化 | `permissions` ≤ 6 项：`tabs` `activeTab` `storage` `scripting` `downloads`（+ 可选 `debugger`） |
| NFR-5 | 总体积 ≤ 500 KB | — |
| NFR-6 | 零联网 | DevTools Network 面板在扩展上下文下无任何外部请求 |
| NFR-7 | 类型安全 | `TestCommand` / 消息协议 / `Settings` 全部有 TS 类型，`strict: true` |
| NFR-8 | 可测试 | 定位器生成器、formatter 为纯函数，单测覆盖 ≥ 80% |

---

## 8. 全局数据模型

> 这三个模型是整个系统的骨架，**先定这个，再写任何代码**。

```typescript
// ── 命令：整个系统的原子单位 ───────────────────────────────
// 参考 KR 的表格行模型（panel/js/UI/ records-grid 双层 div 存 real/show 值 —— 本设计弃用该做法）
interface TestCommand {
  id: string;                 // 稳定唯一 id（KR 用 DOM 的 records-N，重排就变，是缺陷）
  command: string;            // "click" | "type" | "assertText" | ...
  target: Locator;            // 主定位器 + 候选列表
  value: string;              // 参数（type 的文本、select 的选项、assert 的期望值）
  comment?: string;
  tags?: string[];            // 对应 .krecorder 的 data-tags（parser.js:92-131）
  breakpoint?: boolean;
  disabled?: boolean;
}

// ── 定位器：多候选是自愈的前提（原则 P4） ────────────────────
interface Locator {
  /** 当前生效的定位器，形如 "xpath=//button[@id='login']" */
  value: string;
  /** 候选列表，按可靠性降序；对应 .krecorder 的 <datalist><option> */
  candidates: LocatorCandidate[];
}
interface LocatorCandidate {
  value: string;              // "css=#login"
  strategy: string;           // "id" | "css" | "xpath:attributes" | "xpath:neighbor" | ...
}

// ── 用例与套件 ──────────────────────────────────────────
interface TestCase {
  name: string;
  commands: TestCommand[];
}
interface TestSuite {
  name: string;
  cases: TestCase[];
}

// ── 导出契约（原则 P6，对应 newformatters/*.js） ──────────────
type Formatter = (name: string, commands: TestCommand[]) => {
  content: string;
  extension: string;          // ".js" | ".py"
  mimetype: string;           // "text/plain"
};

// ── 回放上下文 ─────────────────────────────────────────
interface PlaybackContext {
  variables: Record<string, unknown>;   // ${var} 的运行时值
  currentIndex: number;
  status: "idle" | "running" | "paused" | "stopped";
  tabId: number;
  frameId: number;
  windowAlias: string;                  // "win_ser_local" | "win_ser_1"（recorder.js:212-224）
}
```

---

## 9. 全局架构图

```
┌────────────────────────────────────────────────────────────────┐
│  Service Worker（sw.ts，~150 行）—— 只做"权限跑腿"               │
│  · action.onClicked → windows.create({type:"popup"})           │
│  · tabs.captureVisibleTab（截图）                               │
│  · （可选）chrome.debugger CDP —— 决策题 D3/D4                   │
└──────────────────────────┬─────────────────────────────────────┘
                           │ 开窗后一次性握手
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  Panel 独立窗口（原则 P1）—— 真正的后台大脑                       │
│  ┌──────────────┬──────────────┬────────────────────────────┐  │
│  │ RecorderCore │ PlayerCore   │  Store（单一数据源，原则 P5） │  │
│  │ 上行消息 →   │ 主循环 +     │  TestSuite / Settings /     │  │
│  │ 命令合并     │ 变量插值     │  PlaybackContext            │  │
│  └──────────────┴──────────────┴────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ UI：命令表格（拖拽/编辑/撤销） · 日志面板 · 设置 · 导出     │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────┬──────────────────────────────────▲────────────────────┘
         │ 下行（定向）                      │ 上行（广播 + tabId 分流）
         │ tabs.sendMessage(tabId,·,{frameId})│ runtime.sendMessage
         ▼                                   │
┌────────────────────────────────────────────┴───────────────────┐
│  被测页面                                                        │
│  ISOLATED world ──── nonce RPC（FR-G12）────► MAIN world         │
│  · polyfill                                  · 事件捕获（录制）   │
│  · RPC server                                · 定位器生成        │
│                                              · 命令执行（回放）   │
└────────────────────────────────────────────────────────────────┘
```

---

## 10. 权限清单与申请理由

| 权限 | 必需 | 用途 | 不申请的后果 |
|---|:---:|---|---|
| `tabs` | ✅ | 拿 tabId、监听 tab 创建/关闭（多窗口别名） | 无法定向下发命令 |
| `activeTab` | ✅ | 当前页注入 | — |
| `storage` | ✅ | 存 Settings、自愈记录 | 配置无法持久化 |
| `scripting` | ✅ | 动态注入 content script | 只能靠 manifest 静态注入，覆盖不全 |
| `downloads` | ✅ | 导出文件、保存 `.krecorder` | 只能用 `<a download>` 兜底 |
| `debugger` | ⚠️ 可选 | 文件上传 / 原生按键（D3/D4） | **浏览器会常驻黄色调试横幅**，建议默认不申请 |
| ~~`webRequest`~~ | ❌ | — | **原则 P2：本产品不碰 network 层** |
| ~~`cookies`~~ | ❌ | KR 用它做抗卸载追踪 | — |
| ~~`offscreen`~~ | ❌ | KR 只用于埋点 | — |

**manifest 三个必须避开的坑**（KR 现存缺陷，见 90 号 §3）：
1. 不写指向不存在文件的 `default_popup`（KR `manifest.json:44` 靠 bug 工作）
2. CSP 不写 `unsafe-eval`/`unsafe-inline`（KR `manifest.json:42` 写了无效关键字导致整条被忽略）；需要 `eval` 就用 sandbox iframe
3. `externally_connectable.ids` 不要写 `["*"]`（KR `manifest.json:48`，任意扩展可连）

---

## 11. 端到端验收用例

| AC | 场景 | 步骤 | 通过标准 | 阶段 |
|---|---|---|---|---|
| AC-1 | 开面板 | 点击扩展图标 | Panel 窗口打开；再点一次是聚焦而非重复开窗 | MVP-1 |
| AC-2 | 基础录制 | Record → 填 3 个输入框 → 选下拉 → 提交 | 恰好 5 条命令（3 type + 1 select + 1 click），无冗余 | MVP-1 |
| AC-3 | 输入合并 | 在输入框连敲 10 个字符后失焦 | 只产生 1 条 `type`，value 为完整字符串 | MVP-1 |
| AC-4 | 基础回放 | 对 AC-2 的用例点 Play | 全部命令绿色通过，日志无 error | MVP-1 |
| AC-5 | 拖拽排序 | 把第 5 行拖到第 2 行 | 编号重排，回放顺序与新顺序一致 | MVP-2 |
| AC-6 | iframe | 在含两层 iframe 的页面上录制并回放 | 自动插入 `selectFrame`，回放通过 | MVP-2 |
| AC-7 | 多窗口 | 录制一段会 `window.open` 的流程 | 自动插入 `selectWindow win_ser_1`，回放通过 | MVP-2 |
| AC-8 | 自愈 | 录完后把目标元素的 id 改掉，再回放 | 自动切候选定位器通过；自愈表出现 1 条待 Approve 记录 | MVP-2 |
| AC-9 | 存档往返 | 保存 `.krecorder` → 关闭 → 重新打开导入 | 命令数、候选定位器、tags 全部无损；文件用浏览器直接打开可读 | MVP-2 |
| AC-10 | 导出可运行 | 导出成目标语言 → 粘进测试工程 → 执行 | 无需手改即可跑通 | MVP-2 |
| AC-11 | 零联网 | 全流程操作，观察扩展上下文的 Network | 无任何外部域名请求 | MVP-1 |
| AC-12 | 变量 | 用 `storeText` 存值，后续命令用 `${var}` | 插值正确，Variables 面板显示实时值 | MVP-2 |
| AC-13 | 失败定位 | 故意写一个定位不到的元素 | 日志 `[error]` 指明命令行号与失败原因，表格该行标红 | MVP-1 |

---

## 12. 风险登记册

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | Panel 窗口被用户关闭 → 录制状态全丢 | 高 | 命令变更时增量持久化到 `storage.local`，重开时提示恢复 |
| R2 | Shadow DOM 场景定位失败 | 中 | **KR 本身就弱**（见 91 号 §4.1）；需自行设计穿透方案，或先在文档里声明不支持 |
| R3 | SPA 页面 DOM 频繁重建导致定位器失效 | 中 | 多候选 + 自愈；优先生成语义性强的定位器（`data-testid` > id > 文本 > 结构 xpath） |
| R4 | 长用例表格性能 | 中 | NFR-3 虚拟滚动 |
| R5 | Chrome 后续版本收紧 MV3（如 `windows.create` 行为变化） | 低 | 通信层做薄适配层隔离 |
| R6 | 直接照抄 KR 的 RPC 实现把 `pandoraboz` 一起抄进来 | **高（安全）** | FR-G12 强制随机 nonce + origin 校验；Code Review 必查项 |
| R7 | 不小心把 tracking 调用点一起抄过来 | 中 | 按 90 号 §1.5 的"零风险三步走"清除，不要边抄边删 |

---

## 13. Out of Scope

明确不在本产品范围内：账号登录与鉴权 · 云端存储与同步 · TestOps/报告上传 · 任何形式的埋点与用户行为分析 · 营销弹窗/评分/分享 · Katalon Studio 联动（Object Spy、socket 回放引擎） · 19 种语言全量导出 · 旧式 Selenium-IDE 层叠 formatter 体系 · 移动端录制 · 性能/压力测试能力 · 多人协作与权限管理。

---

## 14. 模块 PRD 索引

| 模块 | PRD | 技术依据 | 实现提示词 | Agent Skill |
|---|---|---|---|---|
| 录制引擎 | PRD-01 | TECH-01 | PROMPT-01 | `kr-recorder-engine` |
| 定位器与自愈 | PRD-02 | TECH-02 | PROMPT-02 | `kr-locator-selfhealing` |
| 回放引擎 | PRD-03 | TECH-03 | PROMPT-03 | `kr-playback-engine` |
| Panel UI 与日志 | PRD-04 | TECH-04 | PROMPT-04 | `kr-panel-ui` |
| 通信与兼容层 | PRD-05 | TECH-05 | PROMPT-05 | `kr-mv3-messaging` |
| 导出与存档 | PRD-06 | TECH-06 | PROMPT-06 | `kr-export-formatter` |
| 设置面板 | PRD-07 | TECH-07 | PROMPT-07 | — |
| **总控** | **本文** | 00-架构总览 | **PROMPT-00-总控** | `kr-mvp-blueprint` |

> 动手前请先读 `91-你还缺什么.md` §3，把 D1-D11 十一道决策题拍板。
