# PRD-04｜Katalon Recorder Panel 编辑器 UI 与日志面板（产品需求文档）

> 读者：Java 背景工程师，计划裁剪出自己的个人录制回放插件。
> 来源：对 Katalon Recorder 7.1.0（MV3）`panel/`、`content/`、`background/` 源码的逆向取证。
> 纪律：功能需求均标注对应源码落点（`文件路径:行号`）；接口用 TypeScript 描述，便于 Java 工程师转译。

---

## 1. 产品定位与范围

**目标产品**：一个浏览器扩展的「录制脚本编辑面板」+「执行日志/辅助面板」。用户可在面板中看到录制的事件序列（命令表格），调整顺序，并在底部五个标签页中查看日志、截图、变量、命令文档与自愈提案。

**范围边界**：
- 纳入：命令表格（增删/拖拽/行内编辑/着色）、工具栏按钮、撤销重做、五个标签页、日志对象、页面右键生成命令、顶部播放控制、对话框、存档格式、CSS 着色。
- 不纳入（本文不展开，详见 TECH-01/02）：录制引擎的事件捕获、定位器生成算法、回放执行器内核。

**关键事实**（逆向确认）：Panel 是一个 `chrome.windows.create({type:"popup"})` 打开的 `panel/index.html`，其 `panel/js/background/` 脚本与该 UI **同窗口同 `window` 运行**（`background/background.js:51-60`）；真正的 Service Worker 是根目录 `background/background.js`。

---

## 2. 用户角色与术语

| 角色 | 说明 |
|---|---|
| 录制者（QA/开发者） | 操作 Record 按钮、查看命令表格、调整顺序、审阅日志 |
| 个人插件开发者（本文目标读者） | 裁剪 KR 源码，构建最小化自用工具 |

| 术语 | 定义 | 源码锚点 |
|---|---|---|
| 命令（Command） | 一行录制动作，如 `click`/`type` | `TestCommand` 模型 |
| 命令表格 | 中部 `#records-grid` 的 `<tbody>` | `panel/index.html` |
| 行 id | `records-N`，N 从 1 起，与 `commands[N-1]` 偏移 +1 | `re-assign-id.js` |
| 双层 div | 每单元格「真实值(display:none) + 显示值(截断)」 | `render-command-element.js` |
| 标签页 | 底部 Log/Screenshots/Variables/Reference/Self-healing | `kar.js:setActiveTab` |
| 可撤销命令 | 包了状态快照的命令对象 | `reversible-command-decorator.js` |

---

## 3. 用户故事（User Stories）

- **US-1（查看事件）**：作为录制者，我希望在面板中看到按顺序排列的录制事件（命令名/定位器/值），以便回顾我做了什么。→ 对应命令表格渲染（§5, TECH）。
- **US-2（调整顺序）**：作为录制者，我希望拖拽某一行改变其顺序，且底层数据模型同步更新。→ `records-grid-sortable-ui.js`。
- **US-3（就地编辑）**：作为录制者，我希望点击某单元格直接改命令名/定位器/值，而不弹窗。→ `input-command/target/value.js`。
- **US-4（撤销/重做）**：作为录制者，我希望 Ctrl+Z/Ctrl+Y 撤销误删或误拖拽。→ `command-history.js` + `reversible-command-decorator.js`。
- **US-5（看日志）**：作为录制者，我希望回放时在 Log 页看到逐条 `[info]/[error]` 与环境信息。→ `logger.js` + `kar.js:logStartTime`。
- **US-6（存日志/截图）**：作为录制者，我希望把日志保存成 HTML、把截图批量下载。→ `save-log.js` + `kar-screenshot.js`。
- **US-7（看变量）**：作为录制者，我希望在执行后看到 `declaredVars` 里所有变量。→ `kar.js:handleDisplayVariables`。
- **US-8（查命令文档）**：作为录制者，我希望选中命令后自动显示它的参数说明。→ `doc.js` + `kar-loadCommand.js` + `command-reference.js`。
- **US-9（自愈审议）**：作为录制者，我希望看到定位器失效的修复提案，勾选后写回表格。→ `self-healing-tab.js` + `self-healing-listener.js`。
- **US-10（页面右键加断言）**：作为录制者，我希望在网页上右键直接加 `verifyText` 等断言命令。→ `background/background.js:createKrMenus` + `content/recorder-handlers.js:contextMenu`。
- **US-11（折叠日志区）**：作为录制者，我希望收起底部面板以扩大命令表格区域。→ `kar.js:show-hide-bottom-panel`。

---

## 4. 功能需求总览（Functional Requirements）

| 编号 | 功能 | 优先级 | 源码落点 |
|---|---|---|---|
| FR-UI-01 | 渲染命令表格（双层 div、连续行 id） | P0 | `render-command-element.js`、`re-assign-id.js` |
| FR-UI-02 | 新增命令行（手动/自动/末前插入） | P0 | `add-command.js` |
| FR-UI-03 | 拖拽排序并重建 `testCase.commands` | P0 | `records-grid-sortable-ui.js` |
| FR-UI-04 | 行内编辑三列并同步模型 | P0 | `input-command/target/value.js` |
| FR-UI-05 | 行着色（成功/失败/断点） | P1 | `set-color.js`、`records-table.css` |
| FR-UI-06 | 选中行工具栏（增/复制/剪切/粘贴/撤销/重做/删） | P1 | `button-selected-row.js` |
| FR-UI-07 | 撤销/重做双栈（上限 100） | P0 | `command-history.js` |
| FR-UI-08 | 可撤销命令装饰器 | P0 | `reversible-command-decorator.js` |
| FR-UI-09 | 快捷键（Ctrl+I/Z/Y/A/B/C/V/X/R） | P1 | `hotkeys-command.js` |
| FR-UI-10 | 命令表格右键菜单（Play from/to here 等） | P2 | `context-menu.js` |
| FR-UI-11 | 五个标签页切换 | P0 | `kar.js:setActiveTab` |
| FR-UI-12 | Log 面板（写/保存/清空） | P0 | `logger.js`、`save-log.js`、`other-listeners/log.js` |
| FR-UI-13 | Screenshots 画廊 + 批量下载 | P1 | `kar-screenshot.js` |
| FR-UI-14 | Variables 面板 | P1 | `kar.js:handleDisplayVariables` |
| FR-UI-15 | Reference 双源文档 | P2 | `doc.js`、`kar-loadCommand.js` |
| FR-UI-16 | Self-healing 提案审议 | P2 | `self-healing-tab.js`、`self-healing-listener.js` |
| FR-UI-17 | Show/Hide 底部面板 | P2 | `kar.js:show-hide-bottom-panel` |
| FR-UI-18 | 页面右键 17 项断言菜单 | P2 | `background/background.js`、`content/recorder-handlers.js` |
| FR-UI-19 | 顶部播放控制（record/play/stop/...） | P0 | `playback/index.js` |
| FR-UI-20 | 通用对话框 | P2 | `generic-dialog.js` |
| FR-UI-21 | 存档序列化/反序列化 | P1 | `parser.js` |

---

## 5. 核心流程

### 5.1 调整顺序流程
用户拖拽行 → `sortable.update` 触发 `dragAndDropAction` → 清空 `testCase.commands` → 遍历 `#records-grid tr` 用 `parseTarget`/`parsePredefinedEntity` 重建 → `reAssignId` → 同时 `generateDragAndDropCommand().execute()` 入撤销栈（`records-grid-sortable-ui.js:30-46`）。

### 5.2 撤销流程
`generateUndoCommand().execute()` → `UndoCommand` 从 `undoStack.pop()` → 调 `.undo()` → `restoreRecords(undoState)` 先 `deleteCommand` 全清、再 `addCommand` 逐行重建（`state-actions.js`、`reversible-command-decorator.js`）。

### 5.3 页面右键加命令流程
网页右键 → content `runtime.connect()` 建 port → SW 弹 17 项原生菜单 → 选中 → SW `port.postMessage({cmd})` → content `record(cmd,...)` → `BackgroundRecorder.addCommandMessageHandler` 写入选中用例（`background/background.js:228-235`、`content/recorder-handlers.js:472-492`、`recorder.js:175-344`）。

---

## 6. 数据模型（TypeScript 接口）

```ts
// 命令模型（对应 TestCommand）
interface TestCommand {
  name: string;                       // 命令名，如 "click"
  defaultTarget: string;              // 主定位器
  targets: string[][];                // 候选定位器数组（双层 div 真实值）
  value: string;
  status?: string;                    // 回放状态
  state?: string;                     // success/fail/break
}

interface TestCase {
  id: string;                         // UUID
  name: string;
  commands: TestCommand[];
  tags: string[];
  insertCommandToIndex(i: number, c: TestCommand): void;
  removeCommandAtIndex(i: number): void;
}

interface TestSuite {
  id: string;
  name: string;
  status: "static" | "dynamic";
  testCases: TestCase[];
  query?: string;
}

// 行状态快照（撤销/重做用，对应 state-actions.extractInformationFromRecordGrid）
interface RecordGridState {
  id: string;
  command: string;
  target: string;
  value: string;
  isBreakpoint: boolean;
  isSelected: boolean;
  selectedTd: number;
}

// 日志对象（对应 logger.Log）
interface Log {
  info(s: string): void;
  error(s: string): void;
  logHTML(html: string): void;
  logScreenshot(src: string, title: string): void;
  appendA(href: string, text: string): void;
}

// 自愈提案（对应 self-healing-tab.addBrokenLocator）
interface SelfHealingProposal {
  testCaseID: string;
  brokenLocator: string;
  proposedLocator: string;
  approved: boolean;
}
```

---

## 7. 非功能性需求

- **NF-1 一致性**：拖拽/增删后 `testCase.commands` 必须与 DOM 行顺序严格一致（偏移 +1 规则）。
- **NF-2 撤销上限**：双栈上限 100，超出丢弃最旧（`command-history.js:limit=100`）。
- **NF-3 零持久化**：`commandHistory` 仅存内存，Panel 刷新即丢（裁剪时需迁入 `storage.local`）。
- **NF-4 渲染性能**：拖拽重建为整表 new，建议用例行数 < 500（否则增量 diff）。
- **NF-5 跨端解耦**：content/Panel/SW 三端通过 `runtime.connect`/`runtime.onMessage` 通信，不直接共享 DOM。

---

## 8. UI 组件清单

| 组件 | DOM id | 行为 |
|---|---|---|
| 命令表格 | `#records-grid` | 渲染/拖拽/编辑 |
| 加行按钮 | `.record-bottom` | `generateAddCommand().execute()` |
| 选中工具条 | `toolbar-btn` 系列 | 增/删/复制/粘贴/撤销/重做 |
| 标签栏 | `ul.tabs2` | 五标签切换 |
| 操作按钮 | `ul.tabs` | save/clear/download/show-hide |
| 日志容器 | `#logcontainer` | `window.sideex_log` 写入 |
| 变量表 | `#variable-grid` | `handleDisplayVariables` |
| 自愈列表 | `#selfHealingList` | 提案 + 审批按钮 |
| 顶部播放 | `#record/#playback/#stop/#pause/#resume/#playSuite/#playSuites` | `commandFactory` |

---

## 9. 验收标准（Acceptance Criteria）

- AC-1：拖拽任一行后，刷新页面经存档再载入，顺序与拖拽后一致（验证模型同步）。
- AC-2：连续 Ctrl+Z 100+ 次不崩，第 101 次旧状态被丢弃。
- AC-3：选中命令后 Reference 页在 100ms 内显示该命令参数说明。
- AC-4：页面右键出现 17 项断言菜单，选中 `verifyText` 后当前用例末行新增对应命令。
- AC-5：回放失败时对应行变红（`#records-grid tr.fail`），Log 出现 `[error]`。
- AC-6：`#save-log` 产出 `年-月-日-时-分-秒.html` 且内容含全部日志条目。

---

## 10. 裁剪路线图（个人插件）

1. **MVP**：FR-UI-01/02/03/04/07/11/12/19 + 数据模型 → 一个能录、能看、能拖、能撤的面板。
2. **增强**：FR-UI-05/06/09/13/14 + 存档（FR-UI-21）→ 接近日常可用。
3. **可选**：FR-UI-08/10/15/16/17/18/20 → 文档/自愈/右键断言等高级能力。

---

## 11. 风险与开放问题

- **R-1 行 id 偏移**：`records-N` ↔ `commands[N-1]` 易错，建议在裁剪版用 `Map<rowId, index>` 替代。
- **R-2 整表重建**：拖拽/撤销均重建对象，大用例有性能风险。
- **R-3 内存撤销栈**：刷新即失，需权衡是否持久化。
- **O-1**：`render-new-test-suite.js` 用自定义 DOM 而非 jqTree，裁剪时可换成更符合直觉的树组件。
- **O-2**：Reference 双源（硬编码 + iedoc）存在维护冗余，个人插件可只保留其一。

> 所有 FR 编号均对应 TECH-04 章节与源码 `文件路径:行号`；接口为 TypeScript 描述，Java 侧可直接映射为 POJO + Repository。
