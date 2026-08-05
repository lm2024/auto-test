# TECH-04｜Katalon Recorder 7.1.0（MV3）Panel 编辑器 UI 与日志面板技术文档

> 逆向对象：Chrome 扩展 Katalon Recorder 7.1.0（Manifest V3）。
> 视角：Java 背景工程师，想裁剪出自己的个人录制回放插件。
> 纪律：所有结论均带 `文件路径:行号` + 代码片段；找不到处显式标注「未在源码中找到」。
> 设计模式一律用 Java 类比（设计模式/Spring/集合框架等）。

---

## 1. 模块总览与文件地图

Panel 编辑器 UI 与日志面板是 Katalon Recorder 的「脸面」：用户能点的几乎所有东西都集中在这里。它本质是一个 **独立浏览器 popup 窗口**（`chrome.windows.create({type:"popup"})` 打开 `panel/index.html`），同时这个窗口又兼任真正的「后台」——`panel/js/background/` 下的脚本也跑在这个窗口里。

对 Java 工程师的类比：Panel 窗口 ≈ 一个内嵌 Swing `JFrame` 的桌面程序，但它本身还兼当应用服务器（后台逻辑同进程运行）。

核心文件地图（仅列本文涉及者，路径均相对扩展根目录）：

| 文件 | 角色 | 行数 |
|---|---|---|
| `panel/index.html` | UI 骨架：所有 DOM id 的源头 | ~1100 |
| `panel/js/UI/index.js` | 全局单例 `window.sideex_log`/`window.help_log` 挂载 | 38 |
| `panel/js/UI/models/logger/logger.js` | `Log` 类：日志对象本体 | 58 |
| `panel/js/UI/view/records-grid/render-command-element.js` | 命令行「双层 div」渲染 | 48 |
| `panel/js/UI/view/records-grid/re-assign-id.js` | 行 id 重排 | 71 |
| `panel/js/UI/view/records-grid/add-command.js` | 新增命令行 | 157 |
| `panel/js/UI/controllers/records-grid/records-grid-sortable-ui.js` | 拖拽排序 + 同步 `testCase.commands` | 82 |
| `panel/js/UI/view/records-grid/attach-event.js` | 每行事件绑定（点击/多选/右键） | 311 |
| `panel/js/UI/view/records-grid/input-command.js`/`input-target.js`/`input-value.js` | 行内编辑三件套 | — |
| `panel/js/UI/view/records-grid/record-utils.js` | 取真实值/显示值/候选定位器节点 | 40 |
| `panel/js/UI/view/records-grid/set-color.js` | 行着色（成功/失败/断点） | 35 |
| `panel/js/UI/services/records-grid-service/command-history.js` | 撤销/重做双栈 | 52 |
| `panel/js/UI/models/command/reversible-command-decorator.js` | 命令装饰器（Command 模式） | 43 |
| `panel/js/UI/services/records-grid-service/command-generators.js` | 各类「可撤销命令」工厂 | 139 |
| `panel/js/UI/services/records-grid-service/state-actions.js` | 从表格提取状态 / 还原状态 | 168 |
| `panel/js/UI/services/records-grid-service/actions.js` | 增删改/复制/粘贴/断点等动作 | 327 |
| `panel/js/UI/controllers/records-grid/hotkeys-command.js` | 快捷键（Ctrl+I 加行等） | 375 |
| `panel/js/UI/view/records-grid/button-selected-row.js` | 选中行工具栏按钮组 | 237 |
| `panel/js/UI/controllers/records-grid/context-menu.js` | 命令表格自身右键菜单 | 66 |
| `panel/js/katalon/kar.js` | 标签页切换 / Show-Hide / 变量面板 / 日志头 | — |
| `panel/js/katalon/kar-screenshot.js` | Screenshots 标签页 | 30 |
| `panel/js/background/doc.js` | Reference 数据源之一（硬编码数组） | 80 |
| `panel/js/katalon/kar-loadCommand.js` | Reference 数据源之二（iedoc-core.xml） | 98 |
| `panel/js/UI/controllers/records-grid/command-reference.js` | 命令变更时刷新 Reference | 16 |
| `panel/js/UI/view/self-healing/self-healing-tab.js` | Self-healing 标签页 | 148 |
| `content/recorder-handlers.js` | 页面右键 → 生成命令（content 侧） | 610 |
| `background/background.js` | Service Worker：17 项原生右键菜单 + port 桥接 | — |

---

## 2. Panel 窗口架构（popup + 内置后台）

Panel 窗口由 `background/background.js` 的 `openPanel()` 创建：

```js
// background/background.js:51-60
var f = function (height, width) {
  const url = "panel/index.html";
  browser.windows.create({
    url: browser.runtime.getURL(url),
    type: "popup",
    height: height,
    width: width,
    focused: !noFocus,
  })
```

创建后会做两件事（`background/background.js:81-97`）：
1. 把 `master[contentWindowId] = panelWindowInfo.id` 登记为「主控窗口」；
2. 向 Panel 的 tab 发 `{selfWindowId, commWindowId}` 桥接消息。

**关键架构事实**：`panel/js/background/` 目录下的脚本（如 `editor.js`、`playback/index.js`、`recorder.js`）虽然是「background」命名，但它们**运行在 Panel 这个 popup 窗口里**，不是 MV3 的 Service Worker。真正的 Service Worker 是根目录的 `background/background.js`。这是理解整个 UI 的前提：你看到的编辑器界面和驱动它的业务逻辑是**同一个窗口上下文**，所以 UI 代码可以 `import` 后台逻辑、后台逻辑也可以直接 `document.getElementById("logcontainer")` 操作 DOM——它们共享 `window`。

Java 类比：`panel/index.html` 既是前端页面也是后端进程，相当于把 Spring Boot 内嵌 Tomcat 和 Thymeleaf 模板塞进了同一个 Jar 里，且共用同一 JVM 堆（这里共用同一 `window` 全局对象）。

---

## 3. DOM 骨架：index.html 分区全景

`panel/index.html` 把所有可交互区域用固定 id 铺好，后续 JS 全部靠这些 id 找节点（典型的 jQuery 时代「选择器驱动」风格，等价于 Java 里用 `ById` 查 `Component`）。

主要分区（行号取自 `panel/index.html` 结构）：

- **顶部工具栏** `#toolbar-container`：`#record`、`#playback`、`#playSuite`、`#playSuites`、`#pause`、`#resume`、`#stop`（以及登录态 `#login-button`/`#login-user`）。
- **左侧套件树** `#tree-section` → `#testCase-container` → `#testCase-grid`；动态套件 `#testCase-filter`；数据文件 `#data-files-list`；扩展 `#extensions-list`；全局 Profile `#profile-list`。
- **中部命令表格** `#command-container` → `table#command-grid` → `tbody#records-grid`；下方 `.record-bottom`（约 627 行）即 `+ Add new row (Cmd/Ctrl + I)`。
- **底部日志区** `#log-section`：
  - 二级标签 `ul.tabs2`（`#history-log`/`#screenshot`/`#variable-log`/`#reference-log`/`#self-healing`，约 638–642 行）；
  - 操作按钮 `ul.tabs`（`#ka-open` Dashboard、`#save-log`、`#clear-log`、`#download-all`、`#select-self-healing-test-status`、`#show-hide-bottom-panel` Show/Hide，约 645–684 行）；
  - 五个内容容器：`#logcontainer`、`#screenshotcontainer`、`#variablecontainer`（`#variable-grid`）、`#refercontainer`、`#selfHealingContainer`（`#selfHealingList` + `#self-healing-approve-btn`，约 687–733 行）。

> 事实勘误（与常见预设不符）：套件树**不是** jqTree，而是 `render-new-test-suite.js`/`render-new-test-case.js` 用自定义 `<div class="message">`/`<p class="test-case-title">`/`<strong class="test-suite-title">` 手搓 DOM。

---

## 4. 命令数据模型（TestCommand / TestCase / TestSuite）

UI 不直接操作 DOM 文本，而是维护一份内存模型，再渲染到表格。三件套（`panel/js/UI/models/`）：

- `TestCommand(name, defaultTarget, targets[], value, status, state)`：单行命令。
- `TestCase(id=UUID, name, commands[], tags[])`：`insertCommandToIndex` / `removeCommandAtIndex`。
- `TestSuite(id=UUID, name, status, testCases[], query)`。

`TestData(testSuites[])` 提供 `findTestCaseById` 等导航。

Java 类比：`TestCommand` ≈ 一个不可变 DTO（POJO），`TestCase` ≈ `List<TestCommand>` 的聚合根（Aggregate Root），`TestData` ≈ 内存 `HashMap<UUID, TestCase>` 仓储。表格只是这份模型的「视图」，拖拽/增删改都先改模型再重渲（类似 JavaFX 的 `ObservableList` + 绑定）。

注意行 id 规则是 `records-N`（N 从 1 开始），与 `testCase.commands[i]` 的索引 `i` 存在 **+1 偏移**：`records-3` 对应 `commands[2]`。这是后续所有 `parseInt(id.split("-")[1]) - 1` 的根源。

---

## 5. 命令表格（核心 · 占全文最大篇幅）

命令表格是用户最关心的部分：「显示的就是我的事件，还能调整顺序」。本节拆解其渲染、行 id、增删、拖拽、行内编辑、着色、事件绑定六个子机制。

### 5.1 双层 div 渲染：真实值 vs 显示值

每一行由 `renderCommandElement` 生成，每个单元格塞**两个** `<div>`：

```js
// panel/js/UI/view/records-grid/render-command-element.js（约 10–40 行）
div_show.style = "overflow:hidden;height:15px;";   // 显示值，截断高度
div_hidden.style = "display:none;";                // 真实值，隐藏
```

- `td[1]`（第 1 列）存 `name`（命令名）；
- `td[2]`（第 2 列）存 `defaultTarget`（定位器），其末尾会 `append` 一个 `<datalist>` 提供候选定位器 `<option>`；
- `td[3]`（第 3 列）存 `value`，`class="value"`。

为什么要双层？因为**显示值做了截断/格式化（如只显示第一个定位器），但真实值（如全部候选定位器数组）需完整保留**供回放与序列化使用。类比 Java：一个 `JLabel` 只显示 `toString()` 摘要，而底层对象字段保持完整——这里用两个 DOM 节点分别承载「展示态」与「持久态」。

取这两个节点的工具在 `record-utils.js`：

```js
// panel/js/UI/view/records-grid/record-utils.js（1–40 行）
function getTdRealValueNode(node, index) { return node.childNodes[index].childNodes[0]; } // div_hidden
function getTdShowValueNode(node, index) { return node.childNodes[index].childNodes[1]; } // div_show
function getTargetDatalist(node)          { return node.childNodes[2].childNodes[1]; }    // 第2列 datalist
function getCommandTargets(datalist)      { /* 收集 datalist 下 option 文本数组 */ }
```

### 5.2 行 id 重排：reAssignId / reAssignIdForDelete

增删行后，行 id 必须保持连续 `records-1,2,3...`，否则后续 `records-N → commands[N-1]` 的映射会错位。`re-assign-id.js` 提供两个函数：

```js
// panel/js/UI/view/records-grid/re-assign-id.js（1–71 行）
function reAssignId(start, end) {            // 把 [start,end] 区间行重新编号
  let records = getRecordsArray();
  for (let i = start; i <= end; i++) {
    let record = document.getElementById("records-" + i);
    // 解析原 id 数字 → 重新设 id 与 odd/even 类
  }
}
function reAssignIdForDelete(delete_ID, count) { // 删除后整体前移
  for (let i = delete_ID + 1; i <= count; i++) {
    // records-i → records-(i-1)
  }
}
```

`classifyRecords` 还会给奇偶行打 `odd`/`even` 类，CSS 据此做斑马纹。

### 5.3 新增命令行：addCommand 三兄弟

```js
// panel/js/UI/view/records-grid/add-command.js（1–157 行）
function addCommand(name, target_array, value, auto, insertCommand) {
  // 1) 若没有套件/用例，自动建 "Untitled Test Suite"/"Untitled Test Case"
  // 2) renderCommandElement → 插入 DOM
  // 3) reAssignId → attachEvent 绑定事件
  // 4) auto 为真：插到「选中行之后」；否则 push 到末尾
}
export { addCommand, addCommandManu, addCommandAuto, addCommandBeforeLastCommand }
```

- `addCommandManu`：手动添加（用于粘贴/右键菜单），不带自动定位（约 144 行）；
- `addCommandAuto`：录制时自动添加，插到当前录制位置；
- `addCommandBeforeLastCommand`：用于「双击行插入」「store 命令在 prompt 之前」等场景。

> 注意 `addCommand` 不负责写 `testCase.commands` 外的撤销栈——撤销逻辑在 `command-generators.js` 的 `generateAddCommand` 包装里（见 §7）。

### 5.4 拖拽排序：sortable + 重建 commands

这是用户「调整顺序」的来源。核心是 jQuery UI 的 `sortable`：

```js
// panel/js/UI/controllers/records-grid/records-grid-sortable-ui.js（56–62 行）
$("#records-grid").sortable({
  axis: "y",
  items: "tr",
  helper: cloneRow,           // 拖拽时克隆行
  connectWith: "#records-grid",
  update: dragAndDropAction
});
```

`dragAndDropAction` 的关键不是「交换两行 DOM」那么简单，而是**完全重建内存模型**：

```js
// panel/js/UI/controllers/records-grid/records-grid-sortable-ui.js（30–46 行）
function dragAndDropAction(event, ui) {
  // 标记 modified
  let testCase = getSelectedCase();
  testCase.commands = [];                                  // 清空
  const commandElements = $('#records-grid').find("tr");
  commandElements.each(function () {
    const commandPartElements = this.childNodes;
    const name  = parsePredefinedEntity(commandPartElements[1]); // 解析 name
    const target = parseTarget(commandPartElements[2]);         // 解析 defaultTarget
    const value = parsePredefinedEntity(commandPartElements[3]); // 解析 value
    testCase.commands.push(new TestCommand(name, target, ..., value, ...));
  });
  reAssignId(start_ID, end_ID);
}
```

`start` 时还会 `generateDragAndDropCommand().execute()` 把这次拖拽压入撤销栈（约 20–28 行）。

Java 类比：这很像用 `Collections.sort()` 后**重新 `new` 一个 `ArrayList` 并逐个 `add`**，而不是在原列表上 `swap`——保证了模型与视图彻底一致，但代价是每次拖拽都重建对象（对中小规模用例无感知）。

### 5.5 行内编辑：input-command / input-target / input-value

点击某单元格即就地变成输入框：

- command 列：`#command-command`（`<input>`），`autocomplete` 来自 `_loadSeleniumCommands()`（见 §10）；
- target 列：`#command-target`（`input`）+ `#action1` + `#target-dropdown`（候选定位器下拉）；
- value 列：`#command-value`（`<textarea>`，Shift+Enter 换行，Enter 提交）。

提交走 `changeTdOfTable`，它同时写「真实值节点」和「显示值节点」并同步模型：

```js
// 来自 input-*.js 的通用模式
changeTdOfTable(index, realValue, showValue);
testCase.commands[index].defaultTarget = realValue;  // 同步模型
saveWhenInsideInput();  // 捕获 Ctrl+S
```

`saveWhenInsideInput` 还会拦截 Ctrl+S 防止浏览器保存网页。`record-utils.js` 的 `getTdRealValueNode`/`getTdShowValueNode` 在此被复用。

### 5.6 行着色：setColor（成功/失败/断点）

执行回放时，每行会按状态变色：

```js
// panel/js/UI/view/records-grid/set-color.js（1–35 行）
function setColor(index, state) {
  $("#records-" + index).className = state;  // success / fail / break
  if (state === "fail") {
    $("#img-" + index).src = "fail.svg";     // 改状态图标
    // 刷新 #result-failures 计数
  }
  setRecordScrollTop(index);                 // 自动滚动到该行
}
```

对应 CSS（`panel/css/records-table.css`）：

```css
/* records-table.css:222-232 */
#records-grid tr.fail.selectedRecord td div { color: #D63031; }
#records-grid tr.success.selectedRecord td div { color: #008000; }
/* records-table.css:57-64 选中态蓝色描边 */
#command-grid .selectedRecord td { border: 1px solid #276EF1; }
/* records-table.css:125-132 删除悬停态橙红 */
#command-grid .removeRecord td { background-color: #FFEDE6; }
```

### 5.7 事件绑定：attachEvent（点击/多选/右键）

`attachEvent(start, end)` 为每行绑定三类交互：

```js
// panel/js/UI/view/records-grid/attach-event.js（1–311 行）
function attachEvent(start, end) {
  for (let i = start; i <= end; i++) {
    let record = document.getElementById("records-" + i);
    record.firstChild.addEventListener("click", rowClickHandler); // 含 ctrl/shift 多选 → selectedRecord
    record.addEventListener("contextmenu", ...);
    // td[1]/td[2]/td[3] 点击分别触发 inputCommand/inputTarget/inputValue
    // 并注入对应 toolbar btn
  }
}
function addToolbarAndContextmenuForTd(...) {
  // 注入 toolbar-btn / toolbar-command-btn / toolbar-target-btn / toolbar-value-btn 及 ctm 菜单
}
```

`Ctrl`/`Shift` 多选把行累加进 `selectedRecord` 集合（`window` 级全局），供「删除选中」「复制选中」使用。

### 5.8 快捷键与命令表格的联动

`hotkeys-command.js`（1–375 行）把键盘操作也接到命令表格上，全部走同一套 `generateXxxCommand().execute()`：

- `Ctrl+I`：在选中行后插入新行（即界面上 `+ Add new row (Cmd/Ctrl + I)` 的键盘等价）；
- `Ctrl+Z` / `Ctrl+Y`：撤销 / 重做（§7）；
- `Ctrl+A`：全选所有行；`Ctrl+B`：给选中行打/取消断点；
- `Ctrl+C` / `Ctrl+V` / `Ctrl+X`：复制 / 粘贴 / 剪切删除（写入 `tempCommand` 剪贴板）；
- `Ctrl+R`：拦截浏览器刷新（录制中防止误关）；
- `Tab`：在 command→target→value 三列输入框间跳转；上下方向键 + `Shift`/`Ctrl` 做多选导航。

要点：快捷键**不另起炉灶**，而是复用 §6/§7 的「可撤销命令」生成器，因此键盘操作同样可撤销。

### 5.9 小结：命令表格的心智模型

把以上串起来，命令表格 = **「模型（TestCommand[]）+ 双层 div 视图 + 连续行 id」** 三者循环：
1. 增删/拖拽/编辑 → 改 `testCase.commands`；
2. `renderCommandElement`/`reAssignId` → 重渲 DOM；
3. `attachEvent` → 重新绑定交互；
4. 用户操作再次触发第 1 步，并可选压入撤销栈（§7）。

Java 类比：这就是 MVC——`TestCommand[]` 是 Model，`records-grid` 表格是 View，`attachEvent`+各 `action` 是 Controller；双层 div 相当于 View 里的「展示对象（VO）」与「实体（Entity）」分离。

---

## 6. 工具栏按钮组（button-selected-row）

选中某行后，首列出现一组浮动按钮（`button-selected-row.js` 的 `toolbarBtn(i)`），每个按钮触发一个「可撤销命令」：

```js
// panel/js/UI/view/records-grid/button-selected-row.js（1–237 行）
// add / copy / cut / paste / undo / redo / delete 按钮
// 各自调用 generateXxxCommand().execute()
```

例如：
- 删除按钮 → `generateDeleteSelectedCommand().execute()`；
- 复制 → `generateCopyCommand()`；粘贴 → `generatePasteCommand()`；
- 撤销/重做 → `generateUndoCommand()` / `generateRedoCommand()`。

这些 `generateXxxCommand` 全部来自 `command-generators.js`（§7）。按钮图标定位由 CSS `records-table.css:71-99` 控制（各 `toolbar-*-btn` 绝对定位到列上方）。

> 事实：`.record-bottom` 行的「+ Add new row」按钮在 `command-toolbar-button.js` 中绑定，点击触发 `generateAddCommand().execute()` 并加 `active` 类（`panel-setting.js` 负责 `tablesorter`/`colResizable` 初始化与 `genCommandDatalist()` 注入 `#command-dropdown`）。

---

## 7. 撤销 / 重做双栈（装饰器 + CommandHistory）

命令表格能做到「撤销拖拽、撤销删除」，靠的是经典 **Command 模式 + 装饰器**。这是 Java 工程师最熟悉的套路。

### 7.1 Command 与双栈

```js
// panel/js/UI/models/command/command.js
function Command(action, ...params) { this.execute = () => action(...params); }

// panel/js/UI/services/records-grid-service/command-history.js（1–52 行）
class CommandHistory {
  constructor() { this.limit = 100; this.undoStack = []; this.redoStack = []; }
  pushToUndoStack(cmd) { this.undoStack.push(cmd); this.redoStack = []; } // 新操作清空 redo
  popFromUndoStack() { return this.undoStack.pop(); }
  popFromRedoStack()  { return this.redoStack.pop(); }
  reset() { this.undoStack = []; this.redoStack = []; }
}
export const commandHistory = new CommandHistory();
export const selfHealingCommandHistory = new CommandHistory(); // 自愈独立栈
```

### 7.2 装饰器：ReversibleCommandDecorator

```js
// panel/js/UI/models/command/reversible-command-decorator.js（1–43 行）
function ReversibleCommandDecorator(command, commandHistory, extractStateFunction, restoreStateFunction) {
  this.execute = function () {
    const undoState = extractStateFunction();   // 执行前快照
    command.execute();
    commandHistory.pushToUndoStack({ undo: () => restoreStateFunction(undoState), redo: ... });
  };
  this.undo = function () { /* 存 redoState → restoreStateFunction(undoState) */ };
  this.redo = function () { /* 反向 */ };
}
```

`extractStateFunction` 取自 `state-actions.js` 的 `extractInformationFromRecordGrid`——它遍历 `#records-grid` 的 `tr`，抽出每行的 `{id, command, target, value, isBreakpoint, isSelected, selectedTd}`（跳过 `ui-sortable-placeholder`/`helper`）。

`restoreRecords(recordState)`（同文件，1–168 行）是还原的核心：**先 `deleteCommand` 清空全部行，再 `addCommand` 逐行重建**（带上 breakpoint/selected 状态）。这正是撤销/重做的「时间倒流」机制——不是 diff 修补，而是整表重建。

### 7.3 生成器工厂

`command-generators.js`（1–139 行）把所有动作包成可撤销命令：

```js
function generateDragAndDropCommand() {
  return new ReversibleCommandDecorator(
    new Command(dragAndDropAction),         // 见 §5.4
    commandHistory,
    extractInformationFromRecordGrid,        // 快照
    restoreRecords                           // 还原
  );
}
// 另有 generateAddCommand / generateDeleteSelectedCommand /
//         generatePasteCommand / generateSetBreakpointCommand /
//         generateUndoCommand / generateRedoCommand ...
```

`UndoCommand`/`RedoCommand`（同 models/command 下）只是从栈里 `pop` 出来调 `.undo()`/`.redo()`。

Java 类比：这与 `javax.swing.undo.UndoManager` + `AbstractUndoableEdit` 几乎同构；`ReversibleCommandDecorator` 相当于给 `Runnable` 包了一层「before/after」环绕通知，等价于 Spring AOP 的 `@Around` 切面捕获前后状态。

---

## 8. 五个标签页（核心 · 占全文最大篇幅）

用户原话：「日志显示，日志旁边还有好多功能」。这「好多功能」就是底部 `#log-section` 的五个标签页：**Log / Screenshots / Variables / Reference / Self-healing**。本节逐标签拆解实现。

### 8.1 标签切换机制：setActiveTab

五个标签由 `kar.js` 的 `setActiveTab` 统一调度，本质是「显隐五个容器 + 切换操作按钮可见性」：

```js
// panel/js/katalon/kar.js（约 185–225 行）
function setActiveTab(tabName) {
  // 控制 #logcontainer / #refercontainer / #variablecontainer /
  //        #screenshotcontainer / #selfHealingContainer 的显隐
  // 以及 save / clear / download / select 按钮的可见性
}
```

`ul.tabs2`（`#history-log`/`#screenshot`/`#variable-log`/`#reference-log`/`#self-healing`）点击即切 `setActiveTab`。注意这**不是**浏览器的 `chrome.tabs`，而是纯 DOM 的 `display` 切换——类比 Java 里 `CardLayout` 切卡片。

### 8.2 标签页一：Log（默认页）

`#logcontainer` 由全局日志对象驱动。`window.sideex_log` 在 `index.js` 挂载：

```js
// panel/js/UI/index.js（36–37 行）
window.sideex_log = new Log(document.getElementById("logcontainer"));
window.help_log   = new Log(document.getElementById("refercontainer")); // Reference 复用同一类
```

`Log` 类（`logger.js`，1–58 行）API：

```js
class Log {
  info(str)  { this._write("[info] "  + str, "log-info"); }
  error(str) { this._write("[error] " + str, "log-error"); }
  _write(str, className) {
    const h4 = document.createElement("h4");
    h4.className = className;
    h4.textContent = str;
    this.container.appendChild(h4);
    h4.scrollIntoView(false);             // 自动滚到底
  }
  logHTML(html)   { this.container.innerHTML += html; }
  logScreenshot(src, title) { /* 生成 a > img.thumbnail 追加 */ }
  appendA(href, text) { /* 生成超链接 */ }
}
```

录制/回放开始时会写环境信息：

```js
// panel/js/katalon/kar.js（约 513–529 行）logStartTime()
sideex_log.info("Browser: " + bowser.name + " Version: " + bowser.version);
// 以及 OS / 扩展版本等
```

**保存日志**（`#save-log`）：`panel/js/UI/controllers/other-listeners/log.js`（1–10 行）绑定 → `saveLog()`：

```js
// panel/js/UI/services/html-service/save-log.js（1–37 行）
function saveLog() {
  const html = "<html>...<body>" + document.getElementById("logcontainer").innerHTML + "</body></html>";
  const blob = makeTextFile(html);
  browser.downloads.download({ url: blob, filename: "年-月-日-时-分-秒.html" });
}
```

**清空日志**（`#clear-log`）：直接 `logcontainer.innerHTML = ""`。

### 8.3 标签页二：Screenshots

`#screenshotcontainer` 由 `kar-screenshot.js` 维护：

```js
// panel/js/katalon/kar-screenshot.js（1–30 行）
function addToScreenshot(imgSrc, title) {
  const ul = document.querySelector("#screenshotcontainer ul");
  const li = document.createElement("li");
  li.innerHTML = `<a class="downloadable-screenshot" href="${imgSrc}" download>
                    <img class="thumbnail" src="${imgSrc}" title="${title}"></a>`;
  ul.appendChild(li);
}
// #download-all 点击 → 遍历所有 .downloadable-screenshot 逐个 download
// clearScreenshotContainer() → 清空
```

`#download-all` 按钮即批量下载所有缩略图原图。注意缩略图本身也由 `Log.logScreenshot` 在 Log 页嵌一份（双写），但 Screenshots 页是专门画廊。

### 8.4 标签页三：Variables

`#variablecontainer` 内含 `#variable-grid`（一个 `tbody`）。变量在回放时由全局 `declaredVars` 收集，UI 在 `handleDisplayVariables` 渲染：

```js
// panel/js/katalon/kar.js（约 381–399 行）
function handleDisplayVariables() {
  const tbody = document.querySelector("#variable-grid tbody");
  tbody.innerHTML = "";
  for (const [name, info] of Object.entries(declaredVars)) {
    // 每行：Variable | Format | Value 三列
    tbody.appendChild(buildRow(name, info.format, info.value));
  }
}
```

即变量面板是「全局变量表的内存快照视图」，回放中每次变量变化会触发刷新。

### 8.5 标签页四：Reference（命令文档）

Reference 是选中命令后弹出的「这是什么命令 / 参数怎么填」说明。**存在两套数据源**（与常见预设「只有 iedoc-core.xml」不符）：

**源 A（硬编码数组）**——`panel/js/background/doc.js`（1–80 行）：

```js
// doc.js（19–43 行）
const commandTd = [ ["open", "url", "Open a URL..."], ... ];   // 命令名/参数/说明
const targetTd  = [ ... ];
const valueTd   = [ ... ];
function scrape(word) {
  // 在 #refercontainer 内渲染 Command/Target/Value 三栏说明
}
```

**源 B（iedoc-core.xml AJAX）**——`panel/js/katalon/kar-loadCommand.js`（1–98 行）：

```js
// kar-loadCommand.js（79–88 行）
$(function () {
  $.ajax({
    url: "js/katalon/selenium-ide/iedoc-core.xml",
    success: (xml) => { Command.apiDocuments = parse(xml); }  // 用 iedoc 生成文档
  });
});
// _loadSeleniumCommands()（2–76 行）：遍历 Selenium.prototype 的 doXxx/assertXxx/getXxx/isXxx
// 生成命令自动补全列表（供 §5.5 的 command 输入框 autocomplete）
```

刷新触发点：`command-reference.js`（1–16 行）——用户编辑命令列时：

```js
// panel/js/UI/controllers/records-grid/command-reference.js
$("#command-command").on("input", function () {
  scrape($("#command-command").val());   // 拉起 Reference 渲染
});
```

> 结论：Reference 是「硬编码速查表」+「iedoc 官方文档 XML」双轨；命令自动补全列表单独来自 `_loadSeleniumCommands()`（扫描 `Selenium.prototype`）。

### 8.6 标签页五：Self-healing（自愈）

当回放中某定位器失效、插件用备选定位器救活时，会把「断掉的原定位器 + 提议的新定位器」登记到自愈面板：

```js
// panel/js/UI/view/self-healing/self-healing-tab.js（1–148 行）
function addBrokenLocator(testCaseID, brokenLocator, proposedLocator) {
  // 去重后 addBrokenLocatorToSelfHealingTab
  // 在 #selfHealingList 追加 <tr>，内含隐藏 input：
  //   testcaseID / broken_locator / propose_locator + checkbox #approve-change-locator
}
```

用户勾选若干行后点 `#self-healing-approve-btn`：

```js
// panel/js/UI/controllers/self-healing/self-healing-listener.js
$("#self-healing-approve-btn").click(() => generateApproveChangeCommand().execute());
// approveSelfHealingProposalAction：遍历勾选行
//   对选中用例 changeLocatorOnRecordGrid（改 realValue/showValue 及 testCase.commands[i].defaultTarget）
//   未选中用例仅改内存
// filterSelfHealingProposalByTestCaseStatusAction：按 Passed/Failed 过滤
```

即自愈面板是「待审议的修复提案列表」，批准后**直接写回命令表格的模型与 DOM**（二次利用 §5 的双层 div 写入逻辑）。

### 8.7 Show / Hide 底部面板

`#show-hide-bottom-panel`（约 112–129 行，`kar.js`）切换 `#log-section` 高度，`toggle` `#tab4` 类的显隐，等价于「折叠日志区」。

### 8.8 标签操作按钮的细节

`ul.tabs`（约 645–684 行，`index.html`）除切换类按钮外还有两类特殊按钮：

- `#ka-open`：打开 Katalon TestOps Dashboard（外部链接，与录制无直接数据耦合）；
- `#select-self-healing-test-status`：在 Self-healing 标签下按 `Passed`/`Failed` 过滤提案
  （对应 `filterSelfHealingProposalByTestCaseStatusAction`）。

注意 `setActiveTab`（§8.1）会随当前标签**联动显隐**这些按钮：例如切到 Variables 时隐藏 save/clear/download，切到 Self-healing 时才露出 `#select-self-healing-test-status` 与 `#self-healing-approve-btn`。这正是「标签不仅是视图切换，也是工具栏上下文」的设计。

### 8.9 五个标签页小结

| 标签 | 容器 id | 数据源 / 驱动 | 关键文件 |
|---|---|---|---|
| Log | `#logcontainer` | `window.sideex_log`（Log 类） | `logger.js` / `index.js` / `save-log.js` |
| Screenshots | `#screenshotcontainer` | `addToScreenshot` 累积 | `kar-screenshot.js` |
| Variables | `#variablecontainer` | 全局 `declaredVars` | `kar.js:handleDisplayVariables` |
| Reference | `#refercontainer` | `doc.js` + `iedoc-core.xml` 双源 | `doc.js` / `kar-loadCommand.js` |
| Self-healing | `#selfHealingContainer` | 回放自愈提案 | `self-healing-tab.js` / `self-healing-listener.js` |

Java 类比：五个标签就是五个 `JPanel` 放进一个 `JTabbedPane`，各自绑定一个 `TableModel`/`ListModel`；区别是 KR 用 `display:none` 而非真正的组件树切换。

---

## 9. 日志对象与日志面板（Log 类、saveLog、screenshot）

日志对象在本文 §8.2 已展开。`Log` 类本身是极简的「追加式 DOM 写入器」：每条日志是一个 `<h4 class="log-info|log-error">`。它没有级别过滤、没有持久化，纯靠 `appendChild` + `scrollIntoView` 滚到底。

`logScreenshot` 与 Screenshots 标签复用同一批截图 URL（§8.3），即在 Log 页内联缩略图、在 Screenshots 页做画廊，二者数据源一致，渲染位置不同。

> 裁剪建议：若只做个人插件，可把 `Log` 类直接复用，但建议加「清空按钮」与「按级别过滤」——原版 `#clear-log` 只清 DOM 不清 `commandHistory`，二者生命周期独立。

---

## 10. Reference 数据源（doc.js + iedoc-core.xml 双源）

已在 §8.5 完整说明。补充：`_loadSeleniumCommands()` 扫描 `Selenium.prototype` 的 `do/assert/verify/store/waitFor` + `AndWait` 变体，生成命令自动补全候选。这正是 §5.5 中 command 输入框 `autocomplete` 的来源。

---

## 11. 页面右键生成命令链路（17 项 context menu → port → record）

这是用户提到的「页面右键 → 生成命令」的完整链路，横跨 content / Service Worker / 录制器三端。

### 11.1 Content 侧：监听右键并连 port

```js
// content/recorder-handlers.js（472–492 行）
Recorder.addEventHandler('contextMenu', 'contextmenu', async function (event) {
  var myPort = await browser.runtime.connect();       // 连到扩展（SW）
  const eventTarget = getEventTarget(event);
  var tmpText = this.locatorBuilders.buildAll(eventTarget);  // 生成候选定位器
  var tmpVal  = getText(eventTarget);
  var tmpTitle = normalizeSpaces(eventTarget.ownerDocument.title);
  myPort.onMessage.addListener(function portListener(m) {
    if (m.cmd.includes("Text"))   self.record(m.cmd, tmpText, tmpVal);
    else if (m.cmd.includes("Title")) self.record(m.cmd, [[tmpTitle]], '');
    else if (m.cmd.includes("Value")) self.record(m.cmd, tmpText, getInputValue(eventTarget));
    else if (m.cmd.includes('waitFor')) self.record(m.cmd, tmpText, '');
    myPort.onMessage.removeListener(portListener);
  });
}, true);
```

即：右键时先 `runtime.connect()` 建立一个长连接 port，然后**等待** SW 把用户选中的命令名通过 port 发回来，再用录制器的 `record()` 落命令。

### 11.2 Service Worker 侧：17 项原生菜单 + port 桥接

```js
// background/background.js（123–226 行）createKrMenus()
browser.contextMenus.create({ id: "verifyText",   title: "verifyText",   ... });
browser.contextMenus.create({ id: "verifyTitle",  title: "verifyTitle",  ... });
browser.contextMenus.create({ id: "verifyValue",  title: "verifyValue",  ... });
browser.contextMenus.create({ id: "assertText",   title: "assertText",   ... });
browser.contextMenus.create({ id: "assertTitle",  title: "assertTitle",  ... });
browser.contextMenus.create({ id: "assertValue",  title: "assertValue",  ... });
browser.contextMenus.create({ id: "storeText",    title: "storeText",    ... });
browser.contextMenus.create({ id: "storeTitle",   title: "storeTitle",   ... });
browser.contextMenus.create({ id: "storeValue",   title: "storeValue",   ... });
browser.contextMenus.create({ id: "waitForElementPresent", ... });
browser.contextMenus.create({ id: "waitForElementNotPresent", ... });
browser.contextMenus.create({ id: "waitForTextPresent", ... });
browser.contextMenus.create({ id: "waitForTextNotPresent", ... });
browser.contextMenus.create({ id: "waitForValue", ... });
browser.contextMenus.create({ id: "waitForNotValue", ... });
browser.contextMenus.create({ id: "waitForVisible", ... });
browser.contextMenus.create({ id: "waitForNotVisible", ... });
// 共 17 项
```

这 17 项在**首个 Panel 窗口打开时**才创建（`background/background.js:82-84`：`if (Object.keys(master).length === 1) createKrMenus();`），窗口关闭时 `browser.contextMenus.removeAll()`（110–120 行）。

port 桥接：

```js
// background/background.js（228–235 行）
var port;
browser.contextMenus.onClicked.addListener(function (info, tab) {
  port.postMessage({ cmd: info.menuItemId });   // 把选中的命令名发回 content
});
browser.runtime.onConnect.addListener(function (m) { port = m; }); // content 连上来时存 port
```

### 11.3 链路串起来

1. 用户在网页右键 → content 的 `contextmenu` 处理器 `runtime.connect()` 拿到 port，挂 `onMessage` 监听；
2. 浏览器原生弹出 17 项菜单（由 SW 预先 `createKrMenus` 注册）；
3. 用户选 `verifyText` → SW `contextMenus.onClicked` 触发 → `port.postMessage({cmd:"verifyText"})`；
4. content 的 `portListener` 收到 → `self.record("verifyText", tmpText, tmpVal)`；
5. `record()` 进入录制器，最终经 `BackgroundRecorder.addCommandMessageHandler`（`panel/js/background/recorder.js:175-344`）写入当前用例的命令表格（走的是 `addCommandAuto` → §5.3）。

Java 类比：这是**发布-订阅 + 远程过程调用**的混合——content 像客户端 stub，SW 像注册中心，原生右键菜单像服务端暴露的 17 个 API；`port.postMessage` 等价于一次单向 RPC 回调。

> 注：`katalon/ku-recorder-event-handlers.js:503-520` 是 Katalon 自研录制器（`KURecorder`）的同构实现，多了 `VerifyElementText`/`MouseOver` 分支，逻辑一致，可视为另一套录制器实现。

---

## 12. 顶部工具栏与播放控制按钮

顶部 `#toolbar-container` 的按钮不是散绑的，而是统一走**命令工厂**：

```js
// panel/js/background/playback/index.js（23–56 行）
$("#record").click(()   => commandFactory.createCommand("record").execute());
$("#playback").click(() => setTimeout(() => commandFactory.createCommand("playTestCase").execute(), 500));
$("#stop").click(()     => commandFactory.createCommand("stop").execute());
$("#pause").click(()    => commandFactory.createCommand("pause").execute());
$("#resume").click(()   => commandFactory.createCommand("resume").execute());
$("#playSuite").click(()=> setTimeout(() => commandFactory.createCommand("playTestSuite").execute(), 500));
$("#playSuites").click(()=>setTimeout(() => commandFactory.createCommand("playAll").execute(), 500));
```

`commandFactory.createCommand(...)` 位于 `panel/js/background/playback/service/command/CommandFactory.js`，按字符串分派到 `recordAction`/`playTestCase` 等（`recordAction` 在 `record-actions.js`，切换 `isRecording` 并广播 `attachRecorder`）。

播放/套件按钮点击还会先 `resetTable()` 收起所有行内输入框（`action-table.js:19-37`）。

`top-toolbar/actions.js` 主要承载**登录/登出/TestOps**逻辑（`#login-button`/`#logout-user`/`chrome.tabs.onUpdated` 处理 OAuth 回调），与录制按钮解耦。

> 裁剪建议：`commandFactory` 是很好的扩展点——新增按钮只需在工厂注册一个 command 类，UI 与逻辑零耦合。

---

## 13. 对话框体系（GenericDialog）

所有弹窗统一由 `GenericDialog` 封装 jQuery UI `dialog`：

```js
// panel/js/UI/view/dialog/generic-dialog.js（56–98 行）
async render() {
  this.dialog = $(`<div id=${this.id}></div>`)
    .html(this.html)
    .dialog({
      autoOpen: true, dialogClass: "newStyleDialog",
      resizable: true, height, width,
      modal: this.modal, draggable: false, appendTo: this.appendTo,
      open:  () => $('.ui-widget-overlay').addClass("dim-overlay"),
      close: () => self.close(),
    });
  if (this.draggable) this.dialog.parent().draggable();
}
async close() { $(`#${this.id}`).dialog('destroy').remove(); this.isOpen = false; }
```

构造参数：`{id, html, buttons, message, title, width, height, draggable, modal, appendTo}`（1–28 行）。其余 `wizard-dialog.js`/`test-execution-dialog.js`/`onboarding-dialog.js` 等都是它的子类或调用方。

Java 类比：`GenericDialog` ≈ 一个 `AbstractDialog<T>` 基类，用建造者参数配置标题/按钮/内容，底层委托给 Swing `JDialog`——这里委托给 jQuery UI。

---

## 14. 存档 / 导入导出 与 CSS 着色

### 14.1 存档格式（parser）

命令表格 ↔ 文件 的序列化在 `parser.js`：

```js
// panel/js/UI/services/helper-service/parser.js（1–143 行）
function marshallCommand(cmd) {
  return `<tr><td>${cmd.name}</td>
           <td>${cmd.defaultTarget}<datalist>...候选定位器 options...</datalist></td>
           <td>${cmd.value}</td></tr>`;
}
function marshallTestCase(tc) { /* 用 data-tags 携带标签 */ }
function unmarshall(html) { /* 解析回 TestCommand[] */ }
function parseTarget(str) / parsePredefinedEntity(str) { /* §5.4 拖拽重建时复用 */ }
```

扩展名支持 `.krecorder`/`.html`/`.json`。这解释了 §5.4 拖拽重建时为什么调用 `parseTarget`/`parsePredefinedEntity`——反序列化与拖拽重建共用同一套解析器。

### 14.2 CSS 着色速查

`panel/css/records-table.css` 关键类：
- 选中态 `#command-grid .selectedRecord td` 蓝色描边（57–64）；
- 删除悬停 `#command-grid .removeRecord td` 橙红（125–132）；
- 执行结果 `#records-grid tr.fail/success.selectedRecord td div` 红/绿（222–232）；
- 工具栏按钮绝对定位（71–99）。

---

## 15. 设计模式与 Java 工程师裁剪建议

### 15.1 用到的设计模式（Java 映射）

| 模式 | KR 落点 | Java 等价 |
|---|---|---|
| **Command** | `command.js` + `ReversibleCommandDecorator` | `Runnable` / `Command` 接口 |
| **Command + Memento（撤销）** | `command-history.js` 双栈 + `state-actions.restoreRecords` | `javax.swing.undo.UndoManager` |
| **Decorator** | `ReversibleCommandDecorator` 包 `Command` | 装饰器模式 / AOP `@Around` |
| **Factory** | `CommandFactory.createCommand(str)` | 工厂方法 / Spring `BeanFactory.getBean` |
| **Observer / 事件总线** | `browser.runtime.onMessage` 各监听器 | `EventListener` / `ApplicationEvent` |
| **MVC** | `TestCommand[]`（M）+ `records-grid`（V）+ `attachEvent`/`actions`（C） | Spring MVC |
| **Bridge / Port** | content↔SW `runtime.connect` port | RPC stub / Socket |
| **Strategy** | 双击/录制/粘贴各自 `generateXxxCommand` | 策略模式 |

### 15.2 个人插件裁剪路线

1. **最小可用 UI**：复用 `render-command-element.js` 的双层 div + `TestCommand` 模型 + `addCommand`，即可获得「显示事件列表 + 增行」。
2. **撤销/重做**：直接搬 `command-history.js` + `reversible-command-decorator.js` + `state-actions.js`，这是最独立、最值得复用的模块。
3. **日志面板**：`Log` 类 + `logger.js` 可直接复用；五个标签中 **Log/Screenshots/Variables** 是高频刚需，**Reference/Self-healing** 可后置。
4. **右键生成命令**：若不做「页面右键加断言」，可省掉 `background/background.js` 的 17 项 `contextMenus` + port 链路，仅保留 content 录制事件即可。
5. **避坑**：
   - 行 id `records-N` 与 `commands[N-1]` 的 +1 偏移极易写错，建议封装 `idToIndex`/`indexToId`；
   - 拖拽重建是「整表 new」，大数据量用例需改增量 diff；
   - Panel 窗口兼后台，刷新页面会丢 `commandHistory`（仅存内存），如需持久化应迁入 `storage.local`。

---

> 文档结论均源自对上述源文件的逐行取证；凡涉及跨文件链路（如右键菜单）已给出 content / SW / Panel 三端行号。未在本扩展源码中定位到的内容已显式标注。
