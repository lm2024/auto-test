# PRD-07 · 设置面板与配置系统（产品需求文档）

> 产品视角，给「个人录制回放插件」的**配置层**定范围：有哪些设置、存在哪、怎么改、改完怎么生效。
> 所有功能点均有源码依据（见 `实现位置` 列），依据来自 `_distill/tech/TECH-07-设置面板与配置系统.md`。
> 优先级约定：P0=必备，P1=重要，P2=可选。

---

## 1. 背景与目标

**背景**：KR 7.1.0 的设置系统是整个插件里最"随手写"的一块。它有 **7 个用户可见设置项**，却分散在 **2 个 storage key**（`setting` 聚合对象 + 孤儿 `katalonServerPortStorage`）里，由 **4 个 Tab 各自独立地「读-改-写」同一个 `setting` 对象**（`self-healing-setting-tab.js:203-206`、`privacy-setting-tab.js:31-33`、`test-execution-setting-tab.js:43-50`），且写入**不 await**——保存时后一个 Tab 会读到前一个 Tab 尚未落盘的旧值再整体覆盖回去，导致丢更新。同时**全项目没有一处 `storage.onChanged` 监听 `setting`**，所有消费方靠「用的时候现读」，一次自愈判定就要打 3 次 `storage.local.get("setting")`（`panel/js/UI/services/self-healing-service/utils.js:2,18,28`）。默认值只在 `setting` 整体缺失时写入一次（`panel/js/background/load-setting-data.js:20-25`），没有版本号、没有字段补齐，所以后加的 `testExecution` 字段对老用户永远是 `undefined`。

**产品判断（本 PRD 的核心决策）**：个人插件的设置系统必须做成
> **单一 `Settings` 对象 + `chrome.storage.local` 单 key + `storage.onChanged` 单向广播**

而**不是**原版那种散落多 key、多处直读的写法。理由：

| 理由 | 对应原版痛点 |
|---|---|
| ① **只有一次读、一次写，物理上消灭丢更新** | 原版四个 Tab 各自读-改-写且不 await（`self-healing-setting-tab.js:206`、`test-execution-setting-tab.js:50`、`privacy-setting-tab.js:33`） |
| ② **只有一个类型定义，字段缺失可以被 deepMerge 一次性补齐** | 原版每个消费点自己写 `?? {}` 兜底（`test-execution-setting-tab.js:20-24`、`play-actions.js:1532-1533,1551`） |
| ③ **一个 `schemaVersion` 就能承载所有历史迁移** | 原版无版本号，`testExecution` 对老用户永远 undefined（`load-setting-data.js:7-18` 里没有它） |
| ④ **广播 + 进程内缓存把热路径的异步读变成同步 getter** | 原版回放热路径上每条失败命令 3 次异步 storage 读（`utils.js:2,18,28`） |
| ⑤ **单 key 便于整体导出/导入/重置**，个人插件常见诉求 | 原版 17 个散落顶级 key，没有任何前缀约定 |

**目标**：用 ≤200 行自有代码，做出一个只有 2 个分组、5 个设置项的设置页，类型安全、可迁移、可广播、无云耦合。

**成功标准**：
- 保存操作对 storage 是 **1 次 `get` + 1 次 `set`**，无论有多少个 Tab。
- 任意上下文（Panel / 回放引擎 / Service Worker）读设置是**同步的**（读进程内缓存），首次加载除外。
- 在 A 窗口改设置，B 窗口的设置页/Panel **无需刷新**即可看到新值。
- 从旧版本（无 `schemaVersion`）升级后，所有新增字段自动补齐为默认值，用户已改过的字段不被覆盖。
- 网络面板全程无对外请求。

---

## 2. 名词表

| 名词 | 含义 |
|---|---|
| `Settings` | 唯一的配置聚合对象，整体存在 `storage.local` 的单个 key 下 |
| SETTINGS_KEY | 该单 key 的名字，本 PRD 定为 `"settings"`（原版是 `"setting"`，`load-setting-data.js:9`） |
| `schemaVersion` | 配置结构版本号，用于迁移。**原版没有** |
| deepMerge 补齐 | 用 `DEFAULT_SETTINGS` 递归填补用户配置中缺失的字段，已有值不覆盖 |
| 单向广播 | 写只发生在设置页；其他上下文只通过 `storage.onChanged` 被动刷新缓存，不反向写 |
| 进程内缓存 | 每个上下文（Panel / SW / 回放）内存里的一份 `Settings` 副本，由广播保持新鲜 |
| Tab | 设置页左侧一个菜单项对应的一块内容区（原版 4 个，见 `menu-tree.js:3-20`） |
| collect | Tab 从自己的 DOM 收集出 `Partial<Settings>`，**不直接写 storage** |
| 脏标志 | `isChange`，用于关闭时提示保存（原版 `setting-panel.js:21-25`） |
| 自愈排除命令 | 失败时不触发自愈的命令名列表（原版按未锚定正则匹配，`utils.js:37-39`） |
| onFailure | 回放遇失败的行为枚举，替代原版两个独立布尔 |

---

## 3. 用户故事

- **US-1（使用者）**：作为使用者，我想从一个明确的入口打开设置，无论是插件面板里点、还是浏览器扩展管理页点，都进同一个页面。→ FR-1/FR-2
- **US-2（回放者）**：作为回放者，我想配置「自愈开关 / 定位器优先级 / 排除哪些命令」，让回放更稳。→ FR-6/FR-7/FR-8
- **US-3（回放者）**：作为回放者，我想决定脚本失败时是暂停还是继续，并能勾掉那个烦人的确认弹框。→ FR-9/FR-10
- **US-4（使用者）**：作为使用者，我点 Save 之后所有改动都要真的存进去，不能出现「勾了自愈开关又改了排除列表，结果只存了一个」。→ FR-11/FR-12
- **US-5（使用者）**：作为使用者，我在设置页改了值，正在录制的 Panel 窗口应该立刻用新值，不用我重启插件。→ FR-13/FR-14
- **US-6（升级者）**：作为升级者，我从旧版本升上来，老配置要保留，新字段要自动有默认值，不能整个配置丢了。→ FR-15/FR-16
- **US-7（隐私关注者）**：作为隐私关注者，我不希望插件里存在任何埋点开关——因为根本不应该有埋点。→ FR-18（Out of Scope）
- **US-8（维护者）**：作为维护者，我希望加一个新设置项只需要改一处类型定义 + 一个 Tab 文件，不用去 5 个地方补 `?? 默认值`。→ FR-4/FR-5

---

## 4. 功能需求（FR）

### 4.1 入口与页面

| 编号 | 优先级 | 需求 | 实现位置（源码） |
|---|---|---|---|
| FR-1 | P0 | 设置页**只有一份**。`options_page` 必须指向它，同时 Panel 工具栏按钮也打开它。原版存在两个页面，`options_page` 指向的是 2018 年遗留的端口页 | 遗留页：`manifest.json:63` → `katalon/options.html:1-30` + `katalon/options.js:1-14`；真页：`panel/js/katalon/kar.js:237` `getURL("setting-panel/index.html")` |
| FR-2 | P0 | Panel 侧按钮开窗用 `windows.create({type:"popup"})`，并做窗口复用（已开则 `windows.update` 聚焦，失败回退新开） | `panel/index.html:263-266`（按钮）；`panel/js/katalon/kar.js:229,231-259`（开窗+复用） |
| FR-3 | P1 | 支持"深链到某个 Tab"（如回放弹框里的 "go to Settings" 直达 Test Execution）。**必须用 URL query 传参**，不得用 storage 顶级 key 当函数参数 | 原版反例：写 `panel/js/UI/view/dialog/test-execution-dialog.js:101` `set({testExecutionTab:true})`；读+复位 `setting-panel.js:83,99` |
| FR-4 | P0 | 每个 Tab 实现统一接口：`render(settings)` / `collect(): Partial<Settings>` / `show()`。**Tab 不得自己读写 storage** | 原版接口思路可借鉴：`setting-panel/js/setting-tabs/ISettingTab.js:3` + `interface/Interface.js:17-34`；但原版 Tab 自己读写（`self-healing-setting-tab.js:203-206` 等） |
| FR-5 | P1 | 启动时用运行时接口校验（fail-fast），Tab 少实现一个方法立刻抛错而不是等到点击 | `setting-panel/js/setting-panel.js:16-19` `Interface.ensureImplement(...)` |

### 4.2 设置项

| 编号 | 优先级 | 需求 | 实现位置（源码） |
|---|---|---|---|
| FR-6 | P0 | 自愈总开关 `selfHealing.enable`，默认 `true` | UI `self-healing-setting-tab.js:162`；默认 `panel/js/background/load-setting-data.js:11`；消费 `panel/js/UI/services/self-healing-service/utils.js:17-25` |
| FR-7 | P0 | 定位器优先级 `selfHealing.locatorOrder`，有序数组，默认 `["id","xpath","css"]`，支持拖拽与上/下移 | UI `self-healing-setting-tab.js:171-177`；排序 `:3-27,79-98`；默认 `load-setting-data.js:12`；消费 `utils.js:1-9,55-78` |
| FR-8 | P0 | 排除命令 `selfHealing.excludeCommands`，默认 4 条 `verify/assertElement(Not)Present`；**匹配方式改为精确字符串**，不得沿用未锚定正则 | UI `self-healing-setting-tab.js:184-190,99-134`；默认 `load-setting-data.js:13`；原版正则缺陷 `utils.js:37-39` |
| FR-9 | P0 | 失败时行为 `playback.onFailure`，枚举 `'pause' \| 'continue'`，默认 `'pause'`。**用单枚举替代原版两个独立布尔** | 原版双布尔 `test-execution-setting-tab.js:46-47`；消费侧只读其一 `panel/js/background/playback/service/actions/play/play-actions.js:1551` |
| FR-10 | P1 | 失败确认弹框开关 `playback.hideFailureDialog`，默认 `false`；弹框内的"不再提示"勾选与设置页双向一致 | 弹框内勾选 `test-execution-dialog.js:31,149-153`；消费 `play-actions.js:1535` |
| FR-11 | P2 | 提供「恢复默认设置」按钮：一次 `set(DEFAULT_SETTINGS)` | 原版**未在源码中找到**该功能 |
| FR-12 | P2 | 提供「导出 / 导入设置 JSON」：单 key 结构使其只需 1 行 | 原版**未在源码中找到**该功能 |

### 4.3 持久化与同步

| 编号 | 优先级 | 需求 | 实现位置（源码） |
|---|---|---|---|
| FR-13 | **P0** | **一次保存 = 一次 `get` + 一次 `set`**。主控制器聚合所有 Tab 的 `collect()` 结果后统一写入，且 `await` 写入完成再提示成功 | 原版反例：`setting-panel.js:35-40` 四个 Tab 串行调用，但每个 Tab 内部的 `set` 都**没有 await**（`self-healing-setting-tab.js:206`、`privacy-setting-tab.js:33`、`test-execution-setting-tab.js:50`） |
| FR-14 | **P0** | 用 `storage.onChanged` 做**单向广播**：设置页写 → 各上下文刷新进程内缓存；消费方用同步 getter 读缓存 | 原版**无任何 `setting` 的 onChanged 监听**；现有 10 处 onChanged 全部服务于登录态与营销弹窗（`panel/js/UI/controllers/top-toolbar/actions.js:116-128` 等） |
| FR-15 | P0 | 启动时 `loadSettings()` 执行 `deepMerge(DEFAULT_SETTINGS, raw)`，缺失字段补齐后写回，保证任何调用方拿到的都是完整对象 | 原版只在整体缺失时写（`load-setting-data.js:20-25`），字段级永不补齐 |
| FR-16 | P0 | `Settings.schemaVersion` + `migrate(raw)` 逐版本升级链 | 原版**无版本号**（`load-setting-data.js:7-18` 无该字段） |
| FR-17 | P1 | 只用 `storage.local`，**不使用 `storage.sync`**（避免跨设备冲突与 8KB/项配额） | 原版同样只用 local（全项目无 `storage.sync` 业务调用），此项为沿用 |
| FR-18 | P1 | 所有设置**必须**收敛到单 key，不得再出现"孤儿设置 key" | 原版孤儿：`katalonServerPortStorage`（`katalon/chrome_common.js:1,4,15`）；路由脏 key：`testExecutionTab`（`test-execution-dialog.js:101`） |

---

## 5. 非功能需求（NFR）

| 编号 | 需求 |
|---|---|
| NFR-1 | **正确性**：并发保存不得丢更新。任何 Tab 都不得独立写 storage（根因见 `self-healing-setting-tab.js:203-206`） |
| NFR-2 | **性能**：回放热路径读设置必须是同步的（进程内缓存）。原版一次自愈判定 3 次异步读（`utils.js:2,18,28`），一条命令失败即触发 |
| NFR-3 | **健壮性**：storage 被清空、字段类型被手工改坏时，`loadSettings()` 必须能回退到默认值而不抛异常（原版会 `TypeError`，`privacy-setting-tab.js:16,32`、`self-healing-setting-tab.js:205`） |
| NFR-4 | **可维护性**：新增一个设置项只需改「类型定义 + 默认值常量 + 一个 Tab 文件」三处，不得要求在消费侧补 `?? 默认值` |
| NFR-5 | **无外部依赖**：设置页不得引入 jqtree（原版 `setting-panel/js/third-party/tree.jquery.js` 1342 行，只为渲染 4 条扁平菜单，见 `menu-tree.js:3-20`），左侧菜单用原生 `<ul>` + 事件委托 |
| NFR-6 | **无云耦合**：设置页不得出现任何外部 URL（原版硬编码 `KS-port-setting-tab.js:12,21,23,25`），不得存在埋点开关 |
| NFR-7 | **安全性**：用户输入（排除命令名）渲染时用 `textContent`，禁止拼进 HTML 模板（原版 `self-healing-setting-tab.js:122` 直接拼接） |
| NFR-8 | **资源引用**：扩展内资源统一 `browser.runtime.getURL()`，不用相对路径（原版 `KS-port-setting-tab.js:18` 多写一层 `../`，靠浏览器 clamp 才没 404） |
| NFR-9 | **代码卫生**：禁止 `debugger`（原版 `privacy-setting-tab.js:29`）、禁止生产 `console.log`（原版 `setting-panel.js:84`）、禁止未调用的死函数（原版 `setting-panel.js:75-80` `displayFirstTab`） |
| NFR-10 | **无循环依赖**：脏标志与 Tab 注册表抽独立模块，依赖单向（原版五个模块与 `setting-panel.js` 互相 import，见 `menu-tree.js:1`、四个 Tab 的 `:1`） |

---

## 6. 数据结构（TypeScript）

```ts
/* ─────────── 6.1 唯一的配置聚合对象 ─────────── */
// 存储位置：chrome.storage.local，单 key = SETTINGS_KEY
// 对照原版：panel/js/background/load-setting-data.js:7-18（原版 key 为 "setting"，且无 schemaVersion）
export const SETTINGS_KEY = 'settings' as const;

export interface Settings {
  /** 配置结构版本号。原版无此字段 —— 这是 testExecution 对老用户永远 undefined 的根因
   *  （load-setting-data.js:7-18 里没有 testExecution） */
  schemaVersion: number;

  selfHealing: SelfHealingSettings;
  playback: PlaybackSettings;
  ui: UiSettings;
}

/* ─────────── 6.2 自愈 ─────────── */
// 对照原版 setting["self-healing"]（连字符 key，只能 ["..."] 访问，load-setting-data.js:10）
export interface SelfHealingSettings {
  /** 总开关。原版默认 true（load-setting-data.js:11）；消费 utils.js:17-25 */
  enable: boolean;

  /** 定位器重试优先级，有序。原版字段名 locator（load-setting-data.js:12）
   *  此处改名 locatorOrder 以体现"有序"语义；消费 utils.js:1-9,55-78 */
  locatorOrder: LocatorType[];

  /** 这些命令失败时不触发自愈。原版 excludeCommands（load-setting-data.js:13）
   *  【改进】原版用未锚定正则匹配（utils.js:37-39），"click" 会误伤 clickAndWait；
   *  本设计改为精确字符串匹配 */
  excludeCommands: string[];
}

export type LocatorType = 'id' | 'name' | 'css' | 'xpath' | 'link' | 'dom';

/* ─────────── 6.3 回放 ─────────── */
export interface PlaybackSettings {
  /** 【改进】原版是两个独立布尔 stopExecution / continueExecution
   *  （test-execution-setting-tab.js:46-47），可同时为 true 形成非法状态，
   *  且 stopExecution 在回放逻辑里从未被读取（消费侧只看 continueExecution，
   *  play-actions.js:1551）。此处收敛为单枚举。 */
  onFailure: 'pause' | 'continue';

  /** 是否隐藏"继续执行？"确认弹框。
   *  原版 setting.testExecution.hideExecutionDialog
   *  写 test-execution-dialog.js:149-153；读 play-actions.js:1535 */
  hideFailureDialog: boolean;
}

/* ─────────── 6.4 UI ─────────── */
export interface UiSettings {
  /** 主题。原版无用户开关，只跟随系统 @media (prefers-color-scheme: dark)
   *  （setting-panel/css/setting-panel.css:30）。此处保留 'system' 为默认。 */
  theme: 'system' | 'light' | 'dark';

  /** 设置页上次停留的 Tab id，用于下次打开时恢复。
   *  【改进】替代原版用 storage 顶级 key testExecutionTab 传参的做法
   *  （写 test-execution-dialog.js:101，读+复位 setting-panel.js:83,99） */
  lastTab: string;
}

/* ─────────── 6.5 默认值常量 ─────────── */
// 逐字段对照原版 panel/js/background/load-setting-data.js:7-18
export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 2,                                   // 原版无此字段
  selfHealing: {
    enable: true,                                     // ← load-setting-data.js:11
    locatorOrder: ['id', 'xpath', 'css'],             // ← load-setting-data.js:12
    excludeCommands: [                                // ← load-setting-data.js:13
      'verifyElementPresent',
      'verifyElementNotPresent',
      'assertElementPresent',
      'assertElementNotPresent',
    ],
  },
  playback: {
    // 原版默认值缺失，消费侧兜底为 continue（play-actions.js:1551 `?? true`），
    // 但同文件 :1549-1550 的注释写的是 "By default ... pause execution" —— 自相矛盾。
    // 本设计取注释语义：默认 pause。
    onFailure: 'pause',
    hideFailureDialog: false,                         // 原版默认值缺失（falsy）
  },
  ui: {
    theme: 'system',
    lastTab: 'selfHealing',
  },
};

/* ─────────── 6.6 模块契约 ─────────── */
export interface SettingsModule {
  /** 首次加载：读 storage → migrate → deepMerge 默认值 → 写回 → 填充缓存 */
  load(): Promise<Settings>;
  /** 同步读缓存。load() 之后可用；热路径专用（替代 utils.js:2,18,28 的三次异步读） */
  get(): Settings;
  /** 唯一写入口：一次 get + 一次 set（对照 FR-13） */
  save(patch: DeepPartial<Settings>): Promise<Settings>;
  /** 订阅变更；内部由 storage.onChanged 驱动（对照 FR-14） */
  subscribe(fn: (next: Settings, prev: Settings) => void): () => void;
  /** 恢复默认（FR-11） */
  reset(): Promise<Settings>;
}

/* 原版没有以上任何一项 —— 四个 Tab 各自 import browser 直接读写 storage。 */
```

**原版实际结构（供迁移参照）**：
```ts
// 原版 storage.local 里真实存在的形状（load-setting-data.js:7-18 + 后续代码追加）
interface LegacySetting {
  'self-healing': { enable: boolean; locator: string[]; excludeCommands: string[] };
  tracking: boolean;                                   // ← 埋点，本设计整块删除
  testExecution?: {                                    // ← 不在默认值里，可能不存在
    stopExecution?: boolean;
    continueExecution?: boolean;
    hideExecutionDialog?: boolean;
  };
}
// 另有孤儿 key：katalonServerPortStorage: string（katalon/chrome_common.js:1,4,15）
```

---

## 7. 流程图

### 7.1 设置读取与初始化（任意上下文启动时）

```
上下文启动（Panel / 回放引擎 / Service Worker）
        │
        ▼
settings.load()
        │
        ├─ raw = await storage.local.get(SETTINGS_KEY)
        │        ★ 原版对应 load-setting-data.js:21
        │
        ├─ raw 为空？
        │     │ 是 → 写 DEFAULT_SETTINGS，缓存，结束
        │     │      ★ 原版对应 load-setting-data.js:22-24（但只判整体缺失）
        │     ▼ 否
        │
        ├─ migrate(raw)  按 schemaVersion 逐版本升级
        │     v0(无版本，原版结构) → v1: setting['self-healing'] → selfHealing
        │                            setting.testExecution.{stop,continue}Execution
        │                              → playback.onFailure 枚举
        │                            丢弃 setting.tracking（本设计不做埋点）
        │     v1 → v2: 新增 ui.theme / ui.lastTab
        │     ★ 原版无此步骤，这正是 testExecution 对老用户永远 undefined 的原因
        │
        ├─ merged = deepMerge(DEFAULT_SETTINGS, migrated)   ← 字段级补齐（FR-15）
        │
        ├─ 若 merged ≠ raw → await storage.local.set({[SETTINGS_KEY]: merged})
        │
        ├─ cache = merged                                    ← 进程内缓存
        │
        └─ 注册 storage.onChanged 监听（见 7.2）
                │
                ▼
        之后所有读都是同步的 settings.get()
        ★ 替代原版 utils.js:2,18,28 的三次异步 storage 读
```

### 7.2 设置变更广播到各上下文（单向）

```
        ┌──────────────── 设置页（唯一写入方）────────────────┐
        │                                                    │
        │  用户点 Save                                        │
        │     │                                              │
        │     ├─ patch = {}                                   │
        │     ├─ for (tab of tabs) Object.assign(patch, tab.collect())
        │     │      ★ Tab 只收集，不写 storage（FR-4）        │
        │     │        原版反例：每个 Tab 自己 set，且不 await   │
        │     │        (self-healing-setting-tab.js:206 等)     │
        │     │                                              │
        │     └─ await settings.save(patch)                   │
        │            ├─ cur = await storage.local.get(KEY)     ← 唯一一次 get
        │            ├─ next = deepMerge(cur, patch)           │
        │            └─ await storage.local.set({[KEY]: next}) ← 唯一一次 set（FR-13）
        │                                                    │
        └──────────────────────┬─────────────────────────────┘
                               │ Chrome 自动派发
        ┌──────────────────────┼──────────────────────┬──────────────────┐
        ▼                      ▼                      ▼                  ▼
   Panel 上下文           回放引擎上下文          Service Worker      另一个设置页窗口
        │                      │                      │                  │
   storage.onChanged      storage.onChanged      storage.onChanged   storage.onChanged
        │                      │                      │                  │
   changes[KEY]?          changes[KEY]?          changes[KEY]?       changes[KEY]?
        │ 是                   │ 是                   │ 是                │ 是
        ▼                      ▼                      ▼                  ▼
   cache = newValue       cache = newValue       cache = newValue    cache = newValue
   通知订阅者刷新 UI        下一条命令直接用         —                  重新 render(cache)
        │                      │                                        │
        └── 各上下文【只读缓存，绝不反向写】────────────────────────────┘
             ★ 单向：写只发生在设置页；避免原版
               "设置页与回放弹框互相写 testExecution"
               (test-execution-setting-tab.js:40-51 ↔ test-execution-dialog.js:131-153)
               造成的双写竞争
```

### 7.3 保存时的 Tab 协作（对比原版）

```
【原版】丢更新路径                        【本设计】
                                        
Save 点击                                Save 点击
  │                                        │
  ├─ selfHealing.saveData()                ├─ p1 = selfHealingTab.collect()
  │    get("setting")  ← 读到 A            ├─ p2 = playbackTab.collect()
  │    set({setting: A'})  ← 未 await      ├─ patch = merge(p1, p2)   ← 纯内存
  │                                        │
  ├─ privacy.saveData()                    └─ await settings.save(patch)
  │    get("setting")  ← 可能仍读到 A            get ×1 → merge → set ×1
  │    set({setting: A''}) ← A' 被覆盖 ✗          storage 只被触碰两次 ✓
  │
  └─ testExecution.saveData() ... 同上
```

---

## 8. 边界与异常

| 场景 | 期望行为 | 原版行为 / 依据 |
|---|---|---|
| 首次安装，storage 无该 key | 写入 `DEFAULT_SETTINGS` 并缓存 | 原版同（`load-setting-data.js:22-24`） |
| `setting` 存在但缺 `self-healing` 子对象 | deepMerge 自动补齐 | 原版 `Object.assign(settingData["self-healing"], ...)` **抛 TypeError**（`self-healing-setting-tab.js:205`） |
| `setting` 存在但缺 `testExecution` | deepMerge 补齐为默认 | 原版靠每个消费点 `?? {}` 兜底（`test-execution-setting-tab.js:20-24`、`play-actions.js:1532-1533`） |
| 用户手工把 `locatorOrder` 改成字符串 | 类型校验失败 → 该字段回退默认值，其余保留，控制台警告 | 原版无校验，`utils.js:60` 的 `locatorList.reduce` 会抛 |
| 两个设置页窗口同时点 Save | 后写覆盖先写（last-write-wins）；但因为是"整对象 merge"，只会覆盖冲突字段。可选：`save()` 前重读做乐观校验 | 原版同一页面内的四个 Tab 之间就已经丢更新（NFR-1） |
| 一个 Tab 保存失败（storage 异常） | 整体回滚（因为只有一次 set，天然原子） | 原版四次独立 set，可能只成功一半 |
| storage 配额 | `storage.local` 默认 ~10MB，且 manifest 已申请 `unlimitedStorage`（`manifest.json:64`）。`Settings` 体积 < 1KB，无风险 | — |
| **不使用 `storage.sync`** | 明确不做跨设备同步：`sync` 单项 8KB / 总 100KB / 每分钟 120 次写限制，且会引入跨设备冲突合并问题，对本地插件无收益 | 原版同样只用 local（全项目无 `storage.sync` 业务调用） |
| 旧版本升级（无 `schemaVersion`） | `migrate()` 识别为 v0，按 7.1 的迁移链升级；用户已改过的值保留 | 原版**无迁移**，新字段永远 undefined（`load-setting-data.js:20-25`） |
| 迁移中途失败 | 保留原始 raw 到 `settings_backup_v{n}` key，写入默认值，提示用户 | 原版**未在源码中找到**任何备份机制 |
| 排除命令填入 `.` 或 `click` | 精确匹配语义下只排除同名命令 | 原版正则未锚定，`click` 误伤 `clickAndWait`/`doubleClick`（`utils.js:37-39`） |
| 排除命令重复添加 | 去重后忽略 | 原版无去重（`self-healing-setting-tab.js:119-129` 直接 prepend） |
| 排除命令输入后未按 Enter 就切 Tab | 输入被丢弃或自动提交（需明确其一） | 原版只监听 Enter（`:113-133`），`#temp-row` 残留在 DOM 里 |
| 关闭设置页时有未保存改动 | 弹确认框：保存 / 不保存 / 取消；**取消必须 resolve** | 原版 Cancel 分支不 resolve，Promise 永久 pending（`confirm-close-dialog.js:26-28`） |
| 回放进行中修改设置 | 下一条命令生效（缓存已被广播刷新）；**不得**中途改变已开始命令的行为 | 原版靠现读 storage，行为相同但每次都打 IO |
| 深链 Tab 不存在 | 回退到 `ui.lastTab`，再回退到第一个 Tab | 原版 `menuTree.tree('getNodeById', ...)` 返回 undefined 时 `selectNode(undefined)` 行为未定义（`setting-panel.js:88-95`） |

---

## 9. 验收用例

| ID | 用例 | 预期 | 对应 FR |
|---|---|---|---|
| AC-1 | 从 `chrome://extensions` 点「扩展选项」 | 打开与 Panel 内 Settings 按钮**完全相同**的页面 | FR-1 |
| AC-2 | Panel 里连点两次 Settings | 只有一个设置窗口，第二次是聚焦 | FR-2 |
| AC-3 | 回放弹框点 "go to Settings" | 设置页打开并**直接停在** Playback 分组；storage 中**不出现**任何临时路由 key | FR-3 |
| AC-4 | 同一次会话里改「自愈开关」+「排除命令」+「失败行为」三项后点 Save | 三项全部生效；DevTools 观察 storage 操作次数 = 1 次 get + 1 次 set | FR-13 / NFR-1 |
| AC-5 | 打开两个设置页窗口，在 A 里改自愈开关并保存 | B 窗口**无需刷新**，开关状态自动同步 | FR-14 |
| AC-6 | Panel 正在录制时，在设置页关掉自愈并保存 | 下一条失败命令不再自愈；无需重启 Panel | FR-14 |
| AC-7 | 手工把 storage 里的 `settings` 删掉一半字段后重开设置页 | 缺失字段自动补齐为默认值，已有字段保留，页面不报错 | FR-15 / NFR-3 |
| AC-8 | 构造一份"旧版结构"（`setting['self-healing']` + `testExecution.continueExecution=true`）写入 storage，然后启动 | 自动迁移为新结构，`playback.onFailure === 'continue'`，自愈配置原样保留 | FR-16 |
| AC-9 | 排除命令填 `click`，回放中 `clickAndWait` 失败 | **仍然触发自愈**（精确匹配，不误伤） | FR-8 |
| AC-10 | 改了值直接点 Close | 弹确认框；点 Cancel 后停留在设置页，可继续编辑；点 No 直接关闭且不保存 | FR-4 / 边界表 |
| AC-11 | 点「恢复默认设置」 | 所有项回到 `DEFAULT_SETTINGS`，其他上下文同步刷新 | FR-11 |
| AC-12 | 全流程录制 + 回放 + 改设置 | 网络面板**零对外请求**；设置页 DOM 中无任何 `katalon.com` 链接 | NFR-6 |
| AC-13 | 设置页排除命令填 `<img src=x onerror=alert(1)>` | 原样显示为文本，不执行 | NFR-7 |
| AC-14 | 全局搜索设置模块代码 | 无 `debugger`、无生产 `console.log`、无未调用函数、无循环 import | NFR-9 / NFR-10 |

---

## 10. Out of Scope（明确不做）

| 不做的东西 | 理由 | 原版位置（供确认删干净） |
|---|---|---|
| **账号登录 / 登出** | 个人插件不需要账号体系；纯本地无服务端 | `panel/js/UI/controllers/top-toolbar/actions.js:106-144`、`utils/generatePKCE.js`、storage key `refreshToken`/`segment`/`checkLoginData` |
| **TestOps / Katalon Studio 集成** | 云与桌面端集成整块砍掉。设置页里的「Katalon Studio Port」Tab 一并删除 | `setting-panel/js/setting-tabs/KS-port-setting-tab.js`（全 53 行）、`katalon/chrome_common.js`、`katalon/chrome_variables_default.js`、`chrome_variables_init.js`、`katalon/background.js:203-230`（WebSocket）、`katalon/options.html`/`options.js` |
| **埋点开关（Privacy Tab）** | 不做埋点，所以不需要开关。原版默认 `tracking:true` 且安装事件用 `\|\|` 绕过开关，属于反面教材 | `setting-panel/js/setting-tabs/privacy-setting-tab.js`（全 43 行）、默认值 `load-setting-data.js:15`、消费 `panel/js/UI/services/tracking-service/*.js`、`background/segment-tracking-services.js:14-18`、manifest `segment_url:68` / `hubspot_url:53` |
| **多语言 / i18n 全量** | 单人使用，全中文或全英文即可。原版本身也没有 `_locales` 目录 | 项目根**无 `_locales`**；全部文案硬编码 |
| **`chrome.storage.sync` 跨设备同步** | 配额小（8KB/项）、写频限制、冲突合并复杂，对本地插件无收益 | 原版也未使用 |
| **自定义快捷键设置项** | 原版快捷键就是硬编码，无 manifest `commands` 段，做设置项属于新增需求 | `panel/js/UI/controllers/**/hotkeys-*.js`（硬编码）；manifest 无 `commands` |
| **回放速度 / Timeout 设置项** | 原版 slider `value:0` 写死且未持久化；超时是硬编码重试（TECH-05）。若后续要做，按 FR-4 追加一个字段即可 | `panel/js/UI/controllers/other-listeners/panel-setting.js:41-48` |
| **截图开关、mouseover 录制开关** | **未在原版源码中找到**对应设置项，不属于"复刻"范围 | — |
| **新手引导 / 营销弹窗相关的 storage 标志** | 整块删除（`onBoardingUserChoice` / `popupTracking` / `tutorialStates` / `addSample` 等 10+ 个顶级 key） | `content-marketing/panel/*.js`、`panel/js/UI/view/dialog/onboarding-dialog.js` |
| **设置项的服务端下发 / 远程配置** | 纯本地 | — |

---

*文档完。功能点均可在 `7.1.0_0` 源码按实现位置列核对；机制细节见 `_distill/tech/TECH-07-设置面板与配置系统.md`，落地提示词见 `_distill/prompts/PROMPT-07-设置面板.md`。*
