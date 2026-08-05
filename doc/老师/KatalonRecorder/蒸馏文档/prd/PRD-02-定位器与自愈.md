# PRD-02 · 元素定位器生成 + Self-Healing 自愈模块（产品需求文档）

> 产品视角，给「个人录制回放插件」的定位器与自愈能力定范围。所有功能点均有源码依据（见 `实现位置` 列）。
> 优先级约定：P0=必备，P1=重要，P2=可选。

---

## 1. 背景与目标

**背景**：录制回放工具依赖「定位器」把用户操作绑定到页面元素。页面改版会让定位器失效，导致回放中断。原 Katalon Recorder 通过「录制时生成多候选定位器 + 回放时按序自愈重试」解决该问题。

**目标**：在个人裁剪插件中，保留一套精简、可维护、对结构改版鲁棒的定位器生成与自愈机制，剔除云端上报等无关逻辑。

**成功标准**：
- 录制时每个元素自动生成 ≥3 种候选定位器并随命令存档。
- 首选定位器失效时，自愈能在不中断回放的前提下换用候选并继续。
- 自愈结果可审计、可一键写回命令。

---

## 2. 名词表

| 名词 | 含义 |
|---|---|
| Locator（定位器） | `finderName=value` 字符串，如 `id=foo`、`xpath=...` |
| LocatorBuilder | 把 DOM 元素生成一个定位器的函数，注册到生成器 |
| Candidate Targets（候选定位器） | 一个元素录制时生成的所有定位器数组，存于命令 `targets` |
| defaultTarget | 命令首选定位器，回放默认用它 |
| Self-Healing（自愈） | 首选失效时换用候选定位器继续回放 |
| Broken Locator | 回放时失效的原始定位器 |
| Propose Locator | 自愈命中后推荐替换的新定位器 |
| Preferred Order | 生成器产出顺序偏好，Katalon 版为 `['xpath:neighbor']` |

---

## 3. 用户故事

- **US-1（录制者）**：作为录制者，我希望点选元素后自动得到多种候选定位器，以便回放更稳。→ FR-1/FR-2
- **US-2（回放者）**：作为回放者，我希望首选失效时自动换用其他定位器而不中断。→ FR-5/FR-6
- **US-3（维护者）**：作为维护者，我希望自愈结果可见、可确认写回，避免悄悄改脚本。→ FR-7/FR-8
- **US-4（配置者）**：作为配置者，我希望配置自愈开关、定位器优先级、排除命令。→ FR-3/FR-4
- **US-5（裁剪者）**：作为裁剪者，我希望删掉云端上报，数据不外传。→ FR-9

---

## 4. 功能需求（FR）

| 编号 | 优先级 | 需求 | 实现位置（源码） |
|---|---|---|---|
| FR-1 | P0 | 录制时为元素生成多候选定位器，至少含 id/name/css/xpath:neighbor | `katalon/ku-locatorBuilders.js:352-579` `.add` 注册 |
| FR-2 | P0 | 候选定位器随命令以 `<datalist><option>` 存档 | `panel/js/UI/services/helper-service/parser.js:92-95` |
| FR-3 | P0 | 提供自愈总开关 `enable`（默认 true）| `panel/js/background/load-setting-data.js:7-18` |
| FR-4 | P0 | 提供有序 `locator` 优先级与 `excludeCommands` 排除列表，可配置 | `setting-panel/js/setting-tabs/self-healing-setting-tab.js`（`renderLocatorList:44`、`saveData:194`）|
| FR-5 | P0 | 回放失败（not found / Invalid xpath）时触发自愈 | `panel/js/background/playback/service/actions/play/play-actions.js:1321-1326` |
| FR-6 | P0 | 按 `getPossibleTargetList` 排序逐个递归重试候选 | `panel/js/UI/services/self-healing-service/utils.js:55-78`；`play-actions.js:1330-1341` |
| FR-7 | P1 | 自愈命中后记录 Broken/Propose 到 UI 列表 | `panel/js/UI/view/self-healing/self-healing-tab.js:46` `addBrokenLocator` |
| FR-8 | P1 | 用户 Approve 后把 Propose 写回 `command.defaultTarget` | `panel/js/UI/services/self-healing-service/self-healing-tab-command-actions.js:57-44` |
| FR-9 | P1 | 可关闭云端 DOM 上报（个人插件应默认关闭）| `katalon/dom_collector.js`、`katalon/dom_inspector.js`、`katalon/common.js:35-36` |
| FR-10 | P2 | 录制/校验时悬停高亮元素并回调 | `content/targetSelecter.js:3,48,64` |

---

## 5. 非功能需求（NFR）

| 编号 | 需求 |
|---|---|
| NFR-1 | 定位器生成应在录制点击事件的同步回调内完成，无明显卡顿（<50ms/元素，经验值，未在源码中找到基准测试） |
| NFR-2 | 自愈重试必须**有界**：候选耗尽即停止，不得无限递归（`play-actions.js:1330` 依赖 `possibleTargets` 长度天然有界） |
| NFR-3 | 数据隐私：默认不向外部 URL 上报页面 DOM（裁剪后删除 `dom_collector`/`dom_inspector`） |
| NFR-4 | 配置持久化于 `browser.storage.local` 的 `setting["self-healing"]` |
| NFR-5 | 排除命令匹配需支持正则（`utils.js:27-48`） |

---

## 6. 数据结构（TypeScript）

```ts
// 单条命令（panel/js/UI/models/test-model/test-command.js:13）
export interface TestCommand {
  name: string;                 // 命令名，如 click
  defaultTarget: string;        // 首选定位器，自愈 Approve 后会被改写
  targets: string[];            // 候选定位器数组（自愈弹药库）
  value?: string;
}

// 自愈设置（panel/js/background/load-setting-data.js:7-18）
export interface SelfHealingSetting {
  enable: boolean;                              // 总开关，默认 true
  locator: LocatorType[];                       // 有序优先级，默认 ["id","xpath","css"]
  excludeCommands: string[];                    // 正则字符串数组
}
export type LocatorType = 'id' | 'name' | 'css' | 'xpath' | 'dom' | 'link';

// 断裂记录（self-healing-tab.js:46 写入 UI 行）
export interface BrokenLocatorRecord {
  testCaseID: string;
  brokenLocator: string;     // 失效的原定位器
  proposeLocator: string;    // 自愈推荐的新定位器
}

// 生成器返回（katalon/ku-locatorBuilders.js:136-139 对象形态）
export type BuiltLocators = Record<string, string[]>; // { id:['id=x'], 'xpath:neighbor':[...] }
```

---

## 7. 流程图

### 7.1 录制：生成候选定位器
```
用户点击元素
   │
   ▼
KULocatorBuilders.buildAll(element)        ← katalon/ku-locatorBuilders.js:584 实例化
   │  逐 .add 策略生成
   ▼
BuiltLocators 对象 {finderName: [locator,...]}
   │  xpath:neighbor 置顶（_preferredOrder）
   ▼
TestCommand{ defaultTarget, targets:[...] }  ← test-command.js:13
   │
   ▼
parser.marshallCommand → <tr>...<datalist><option>  ← parser.js:92-95
```

### 7.2 回放：自愈重试闭环
```
runCommand(cmd, target, possibleTargets)     ← play-actions.js:965
   │
   ├─ findElement(target) 成功 → 执行动作
   │
   └─ 抛错 (not found / Invalid xpath)        ← play-actions.js:1321
         │
         ├─ enableSelfHealing? && !isExcluded(cmd)?   ← :1325-1326
         │     │ 否 → 按普通失败处理
         │     ▼ 是
         ├─ possibleTargets.length>0 ?        ← :1330
         │     │ 否 → 失败终止
         │     ▼ 是
         ├─ next = possibleTargets.shift()    ← :1331
         ├─ 递归 runCommand(cmd, next, ...)    ← 自愈重试
         └─ 命中 → addBrokenLocator(tcID, broken, propose)  ← :961
                          │
                          ▼
              UI 列表展示（self-healing-tab.js:46）
                          │
                          ▼
              用户 Approve → command.defaultTarget = propose  ← command-actions.js:44
```

### 7.3 候选排序（getPossibleTargetList）
```
currentCommand.targets
   │  按 setting.locator 顺序用 new RegExp('^'+locator) 分组
   ▼
[ 按 id/xpath/css 序的候选 ... ] + [未分组候选(如 xpath:neighbor) ]
   │  剔除 currentCommand.target（正在失败的那条）
   ▼
possibleTargets（有序重试队列）
```

---

## 8. 边界与异常

| 场景 | 行为 | 依据 |
|---|---|---|
| 首选定位器失效但候选全部失败 | 回放报错终止，记录失败 | `play-actions.js:1330` 候选耗尽 |
| 命令在 `excludeCommands` 中 | 不触发自愈，直接失败 | `utils.js:27-48`、`play-actions.js:1325` |
| `enable=false` | 不触发自愈 | `play-actions.js:1326` |
| 邻居全是 excludedTags（如只有 `p`/`ul`）| `xpath:neighbor` 候选为空，降级到其他定位器 | `content/neighbor-xpaths-generator.js:4,294` |
| `currentCommand.target` 本身在 targets 中 | 排序时被剔除，避免重试同一条 | `utils.js:55-78` |
| `excludeCommands` 含正则元字符 | 可能误匹配（已知缺陷）| `utils.js:27-48` |
| 多元素匹配同一 xpath | 生成阶段 `preciseXPath` 加索引保证唯一 | `content/locatorBuilders.js:332-345` |
| 云端上报开启（未裁剪） | 页面 DOM/邻居文本外传 | `katalon/common.js:35-36`、`dom_collector.js` |

---

## 9. 验收用例

| ID | 用例 | 预期 | 对应 FR |
|---|---|---|---|
| AC-1 | 点击带 `id` 的按钮录制 | `targets` 含 `id=`、`css=`、`xpath:neighbor=` 至少 3 条 | FR-1/FR-2 |
| AC-2 | 回放时手动改 `id` 使原定位失效 | 自愈换用 `xpath:neighbor` 成功点击，不中断 | FR-5/FR-6 |
| AC-3 | `enable=false` 时失效 | 不自愈，直接报错 | FR-3 |
| AC-4 | 对 `verifyElementPresent` 失效 | 不自愈（在 excludeCommands）| FR-4 |
| AC-5 | 自愈命中后查看 UI | 列表出现一行 Broken/Propose | FR-7 |
| AC-6 | 点击 Approve | `command.defaultTarget` 变为 Propose，下次回放用新定位器 | FR-8 |
| AC-7 | 裁剪后录制 | 网络无 `qAutomate_server_url` 上报请求 | FR-9 |
| AC-8 | 悬停元素 | 元素高亮，点击触发回调 | FR-10 |

---

## 10. Out of Scope（不在本次范围）

- 云端 SaaS 自愈服务（`dom_collector` / `dom_inspector` 上报与分析）——个人插件应剔除。
- `selenium-browserbot` / `selenium-api` 内部各 `locateElementBy*` 的逐行实现（仅确认存在，未蒸馏）。
- 跨 iframe / Shadow DOM 定位（源码中 `excludedTags` 含 `iframe`，未专门处理）。
- 多窗口 / 多 tab 上下文定位。
- 定位器「智能打分排序」模型（当前仅依赖设置顺序，见 TECH-02 §12 改进建议）。

---

*文档完。功能点均可在 `7.1.0_0` 源码按实现位置列核对。*
