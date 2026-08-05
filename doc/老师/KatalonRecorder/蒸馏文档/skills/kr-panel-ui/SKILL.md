---
name: kr-panel-ui
version: 1.0.0
description: >-
  理解并复刻 Katalon Recorder 7.1.0（MV3）的 Panel 编辑器 UI 与日志面板：命令表格（双层 div /
  行 id 重排 / 拖拽重建 / 行内编辑 / 着色）、撤销重做双栈（Command 模式 + 装饰器）、底部五个标签页
  （Log / Screenshots / Variables / Reference / Self-healing）、日志对象、页面右键 17 项断言菜单
  的 content↔ServiceWorker port 链路、顶部播放控制与对话框体系。面向想裁剪个人录制回放插件的工程师。
type: reverse-engineering
domain: browser-extension / ui-architecture
source-version: Katalon Recorder 7.1.0 (Manifest V3)
related-skills:
  - kr-recorder-engine
  - kr-locator-selfhealing
tags:
  - katalon-recorder
  - panel-ui
  - command-grid
  - undo-redo
  - logger
  - context-menu
---

# kr-panel-ui · Katalon Recorder Panel UI 与日志面板

本技能帮助你在**不修改扩展源码**的前提下，逆向吃透 Katalon Recorder 的 Panel 编辑界面与日志面板，
并据此裁剪出自己的个人录制回放插件。

## 何时使用
- 用户想理解「为什么界面上能点的东西背后是这些代码」。
- 用户要复刻：命令表格、拖拽排序、撤销重做、五个标签页、日志面板、右键加断言。
- 用户是 Java 背景，需要把前端模式翻译成 Command / Decorator / Factory / MVC 等熟悉概念。

## 核心事实（务必先建立的心智模型）
1. **Panel 是 popup 窗口，且兼当后台**：`background/background.js:51-60` 用 `chrome.windows.create({type:"popup"})`
   打开 `panel/index.html`；`panel/js/background/*` 脚本与 UI **同窗口同 `window`**，可直接操作 DOM。
   真正的 Service Worker 是根目录 `background/background.js`。
2. **命令表格 = MVC**：`TestCommand[]`（Model）+ `#records-grid`（View）+ `attachEvent`/`actions`（Controller）。
3. **双层 div**：每单元格含「真实值(display:none)」+「显示值(截断)」两个节点
   （`panel/js/UI/view/records-grid/render-command-element.js`）。
4. **行 id 偏移**：`records-N` ↔ `commands[N-1]`（+1 偏移），所有解析都靠此规则。
5. **撤销=整表快照重建**：`state-actions.restoreRecords` 先清空再逐行 `addCommand` 重建
   （`panel/js/UI/services/records-grid-service/state-actions.js`）。
6. **五标签是 display 切换**：`kar.js:setActiveTab` 显隐五个容器 + 操作按钮，等价于 CardLayout。
7. **右键断言跨三端**：content `runtime.connect()` port → SW 17 项 `contextMenus` →
   `port.postMessage({cmd})` 回传 → content `record(cmd)`（`background/background.js:123-235`、
   `content/recorder-handlers.js:472-492`）。

## 取证锚点（修改/复刻时优先读这些文件）
| 主题 | 文件 | 关键行 |
|---|---|---|
| 双层 div 渲染 | `panel/js/UI/view/records-grid/render-command-element.js` | 10-40 |
| 行 id 重排 | `panel/js/UI/view/records-grid/re-assign-id.js` | 1-71 |
| 新增行 | `panel/js/UI/view/records-grid/add-command.js` | 1-157 |
| 拖拽重建 | `panel/js/UI/controllers/records-grid/records-grid-sortable-ui.js` | 30-62 |
| 事件绑定 | `panel/js/UI/view/records-grid/attach-event.js` | 1-311 |
| 取真实/显示值 | `panel/js/UI/view/records-grid/record-utils.js` | 1-40 |
| 行着色 | `panel/js/UI/view/records-grid/set-color.js` + `panel/css/records-table.css` | 1-35 / 222-232 |
| 撤销栈 | `panel/js/UI/services/records-grid-service/command-history.js` | 1-52 |
| 命令装饰器 | `panel/js/UI/models/command/reversible-command-decorator.js` | 1-43 |
| 快照/还原 | `panel/js/UI/services/records-grid-service/state-actions.js` | 1-168 |
| 快捷键 | `panel/js/UI/controllers/records-grid/hotkeys-command.js` | 1-375 |
| 选中工具条 | `panel/js/UI/view/records-grid/button-selected-row.js` | 1-237 |
| 日志对象 | `panel/js/UI/models/logger/logger.js` + `panel/js/UI/index.js` | 1-58 / 36-37 |
| 标签切换 | `panel/js/katalon/kar.js` | 185-225 |
| 截图标签 | `panel/js/katalon/kar-screenshot.js` | 1-30 |
| 变量标签 | `panel/js/katalon/kar.js:handleDisplayVariables` | 381-399 |
| Reference 双源 | `panel/js/background/doc.js` + `panel/js/katalon/kar-loadCommand.js` | 19-43 / 79-88 |
| 自愈标签 | `panel/js/UI/view/self-healing/self-healing-tab.js` | 1-148 |
| 右键菜单链 | `background/background.js` + `content/recorder-handlers.js` | 123-235 / 472-492 |
| 播放控制 | `panel/js/background/playback/index.js` | 23-56 |
| 通用对话框 | `panel/js/UI/view/dialog/generic-dialog.js` | 56-98 |
| 存档序列化 | `panel/js/UI/services/helper-service/parser.js` | 1-143 |

## 工作流
1. **先确认架构**：说明 Panel 窗口兼后台这一关键事实，避免用户误以为 UI 与逻辑分离。
2. **按主题取证**：用上方锚点逐文件读取，所有结论带 `文件路径:行号` + 代码片段。
3. **Java 类比**：Command 模式→`Runnable`；撤销栈→`javax.swing.undo.UndoManager`；
   装饰器→Spring AOP `@Around`；Factory→`BeanFactory.getBean`；五标签→`CardLayout`；
   双层 div→VO/Entity 分离；port 链路→RPC stub。
4. **裁剪建议**：MVP = 命令表格 + 撤销 + 五标签中的 Log/Screenshots/Variables + 播放控制；
   高级 = Reference/Self-healing/右键断言。提醒 `commandHistory` 仅内存、拖拽整表重建的性能边界。
5. **绝不修改扩展源文件**：只产出文档/提示词/技能，或在用户自有项目里新建文件。

## 配套产物
- 技术文档：`_distill/tech/TECH-04-PanelUI与日志.md`（§5 命令表格、§8 五个标签页占全文一半以上）。
- 需求文档：`_distill/prd/PRD-04-PanelUI与日志.md`（11 节，含 TS 接口与验收标准）。
- 提示词：`_distill/prompts/PROMPT-04-PanelUI与日志.md`（自包含 + 3 变体 + 调试提示词）。

## 红线
- 不臆测：找不到的写「未在源码中找到」，不编行号。
- 不改动被分析的扩展源码。
- 行 id 偏移（+1）与「拖拽=整表重建」是两大易错点，回答时必须显式点出。
