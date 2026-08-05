# TECH-13 · 设置面板与配置系统（技术蒸馏）

> 适用对象：想把 Katalon Recorder 7.1.0（MV3）逆向裁剪为个人录制回放插件的工程师。
> 文档纪律：所有结论均来自只读源码目录 `KatalonRecorder/7.1.0_0`，引用格式为 `文件路径:行号`，并附真实片段。找不到的事实显式标注「未在源码中找到，推测：…」。
> 关联文档：TECH-02（定位器与自愈，本文 §6 为其配置侧）、TECH-12（报告与截图）、TECH-14（鉴权埋点剥离，本文 §4 中 `tracking` 项由其消费）。

---

## 1. 一句话概括

Katalon Recorder 的「配置系统」是一个**只有约 6 个真实配置项、却分散在 3 套存储约定里的极简系统**：绝大多数配置塞在 `storage.local` 的单个 `setting` 键下（嵌套对象），端口配置单独占一个顶层键 `katalonServerPortStorage`，还有一批一次性 UI 状态（`testExecutionTab`、`firstTime`、`onBoardingUserChoice`…）散落成十几个顶层键。设置 UI 是一个 `windows.create` 出来的**独立 popup 窗口**（`setting-panel/index.html`），由 4 个实现同一个鸭子类型接口 `ISettingTab` 的 Tab 类拼装而成；**它与主面板之间没有任何变更广播**——每个消费方都在用到的那一刻现读 `storage.local`，因此「保存即生效」纯粹是靠「下次读取」实现的。

---

## 2. 关键文件清单

| 文件 | 行数 | 职责 | 裁剪建议 |
|---|---|---|---|
| `setting-panel/index.html` | 41 | 设置窗口骨架：左侧 `#menu-tree-view`、右侧 `#content`、底部 Save/Close | **保留**（可大幅精简） |
| `setting-panel/js/setting-panel.js` | 111 | 装配 4 个 Tab、脏标记、Save/Close、首屏 Tab 选择 | **保留**，核心 |
| `setting-panel/js/setting-tabs/ISettingTab.js` | 5 | 接口定义：`["display","saveData","getContent","initialize"]` | 保留（或删掉换真接口） |
| `interface/Interface.js` | 36 | 手写的「接口」实现，`Interface.ensureImplement` 运行时鸭子类型检查 | 可删（TS 里没必要） |
| `setting-panel/js/setting-tabs/self-healing-setting-tab.js` | 217 | 自愈 Tab：enable / locator 优先级列表 / excludeCommands | **保留**，核心 |
| `setting-panel/js/setting-tabs/KS-port-setting-tab.js` | 54 | Katalon Studio 端口 Tab（含大段「关于本扩展」广告文案） | **删除**（外部集成） |
| `setting-panel/js/setting-tabs/privacy-setting-tab.js` | 44 | 埋点开关 Tab（`setting.tracking`） | **删除**（见 TECH-14） |
| `setting-panel/js/setting-tabs/test-execution-setting-tab.js` | 61 | 失败后「停止 / 继续」二选一 | **保留** |
| `setting-panel/js/UI/menu-tree.js` | 48 | jqtree 菜单树数据 + 点击分发 | 保留（可换 `<ul>`） |
| `setting-panel/js/UI/confirm-close-dialog.js` | 42 | 关闭时「是否保存」三按钮确认框 | 保留（可选） |
| `setting-panel/js/third-party/tree.jquery.js` | 1342 | jqtree 第三方树控件（唯一用途就是画 4 个菜单项） | **删除**，性价比极低 |
| `setting-panel/css/jqtree.css` | 199 | jqtree 样式 | 随上删除 |
| `setting-panel/css/setting-panel.css` | 160 | 设置面板布局样式 | 保留 |
| `panel/js/background/load-setting-data.js` | 29 | 默认值兜底：`setting` 不存在时写入默认对象 | **保留**，核心（需改写，见 §7） |
| `katalon/chrome_common.js` | 34 | `getKatalonServerPort` / `setKatalonServerPort`（独立键） | 删除（随端口 Tab） |
| `katalon/chrome_variables_default.js` | 5 | 端口默认值 50000/50001 | 删除 |
| `chrome_variables_init.js` | 7 | 端口与热键覆盖值（根目录，被 SW importScripts） | 删除大部分 |
| `katalon/options.html` | 30 | **遗留** options_page，只有端口设置，与新面板重复 | **删除** |
| `panel/js/UI/services/self-healing-service/utils.js` | 86 | 配置消费方：`isSelfHealingEnable` / `getPossibleTargetList` 等 | **保留**，核心（TECH-02） |
| `panel/js/UI/view/dialog/test-execution-dialog.js` | 161 | 失败弹窗，**在运行时反写** `setting.testExecution` | 保留 |
| `panel/js/background/playback/service/actions/play/play-actions.js:1530-1552` | — | `executionDialog()`：配置消费方 | 保留 |
| `panel/js/katalon/kar.js:229-259` | — | 主面板 `#settings` 按钮 → `windows.create` 打开设置窗口 | **保留**，核心 |
| `panel/js/UI/controllers/other-listeners/panel-setting.js:6-8` | — | `#options` 按钮 → `browser.runtime.openOptionsPage()`（遗留） | 删除 |
| `panel/index.html:263` | — | `<button id="settings" class="sub_btn">` | 保留 |
| `panel/index.html:1001` | — | `<script type="module" src="js/background/load-setting-data.js">` | 保留 |
| `playback/index.js:36` | — | CLI 回放通道也 `import("../panel/js/background/load-setting-data.js")` | 视是否保留 CLI |
| `manifest.json:63` | — | `"options_page": "katalon/options.html"` | 删除或改指向新面板 |

---

## 3. 核心机制逐层拆解

### 3.1 两套并存的设置入口（历史包袱）

源码里同时存在**两个设置 UI**，功能重叠：

**A · 遗留 options_page**（`manifest.json:63`）：

```json
"options_page": "katalon/options.html",
```

`katalon/options.html:11-28` 只有一个端口输入框和一堆产品广告文案，由 `panel/js/UI/controllers/other-listeners/panel-setting.js:6-8` 的 `#options` 按钮触发：

```js
$("#options").click(function() {
  browser.runtime.openOptionsPage();
});
```

> 注意：`#options` 这个按钮 **在 `panel/index.html` 中已经不存在了**（grep `id="options"` 无结果，只匹配到 `id="settings"`）。也就是说这段监听是**死代码**，遗留的 options 页只能通过 Chrome 扩展管理页的「扩展程序选项」进入。

**B · 新设置面板**（`panel/js/katalon/kar.js:229-259`）：

```js
var settingWindowID;
$(function () {
  function openPanel() {
    let height = 740;
    let width = 820;
    browser.windows
      .create({
        url: browser.runtime.getURL("setting-panel/index.html"),
        type: "popup",
        height: height,
        width: width,
        focused: true,
      })
      .then((panel) => (settingWindowID = panel.id));
  }
  $("#settings").on("click", function () {
    if (settingWindowID === undefined) {
      openPanel();
    } else {
      browser.windows
        .update(settingWindowID, { focused: true })
        .catch(function () {
          settingWindowID = undefined;
          openPanel();
        });
    }
  });
});
```

要点：
1. **不是 options_page，而是一个 `type: "popup"` 的独立浏览器窗口**，尺寸写死 820×740。
2. 用模块级变量 `settingWindowID` 做「单例窗口」：已存在就 `windows.update({focused:true})` 聚焦；`update` 抛错（窗口已被关闭）时清空 ID 并重开。
3. `test-execution-dialog.js:99-127` **复制了一份一模一样的 `openPanel` 逻辑**（连变量名 `settingWindowID` 都一样），两处各持一个变量副本 → 从失败弹窗打开的设置窗口和从工具条打开的设置窗口**互相不知道对方存在**，可以同时开两个。这是真实缺陷，见 §9.6。

### 3.2 设置面板的装配时序

`setting-panel/js/setting-panel.js` 是整个面板的装配器。启动顺序（`setting-panel.js:102-108`）：

```js
$(document).ready(function () {
  generateUI().then(() => {
    attachButtonEvent();
    initialize().then(displayTab);
  });
});
```

拆开看：

```
document.ready
   │
   ├─ generateUI()                              (setting-panel.js:27-33)
   │    ├─ generateMenuTree()                   ← jqtree 画左侧 4 个菜单项
   │    ├─ container.append(selfHealingTab.getContent())     ← 同步，返回字符串
   │    ├─ container.append(portTab.getContent())            ← 同步
   │    ├─ container.append(await privacyTab.getContent())   ← 异步！要先读 storage
   │    └─ container.append(await testExecutionTab.getContent())  ← 异步！
   │
   ├─ attachButtonEvent()                       (setting-panel.js:42-66)
   │    ├─ #save-btn  → setIsChange(false) → saveData() → alert("Save successfully")
   │    └─ #close-btn → 脏则弹确认框，否则 window.close()
   │
   ├─ initialize()                              (setting-panel.js:68-73)
   │    ├─ portTab.initialize()        ← 同步（回调式 getKatalonServerPort）
   │    ├─ await selfHealingTab.initialize()   ← sortable + 事件 + 渲染列表
   │    ├─ await privacyTab.initialize()       ← 只绑 click
   │    └─ await testExecutionTab.initialize() ← 只绑 click
   │
   └─ displayTab()                              (setting-panel.js:82-100)
        读 storage.local.testExecutionTab
          ├─ true  → 选中 "testExecution" 节点并 display()
          └─ false → 选中 "KSPort" 节点并 display()
        最后强制 set({ testExecutionTab: false }) 复位
```

**关键设计点：`getContent()` 与 `initialize()` 分离。** `getContent()` 只返回 HTML 字符串（不接触 DOM），`initialize()` 才在 DOM 已插入后绑事件、填数据。这是这个面板唯一像样的架构决策。

但两个 Tab 破坏了这个分离：
- `privacy-setting-tab.js:14-26` 的 `getContent()` **自己去读了 storage** 来决定 checkbox 的 `checked` 属性；
- `test-execution-setting-tab.js:18-38` 同理。

而 `self-healing-setting-tab.js` 是正确做法：`getContent()` 返回空表格（157-192），`initialize()` 里调 `renderDataSetting()` 填数据（150-155）。**同一份代码里两种风格并存**，复刻时选后者。

### 3.3 `ISettingTab`：手写的运行时接口检查

`setting-panel/js/setting-tabs/ISettingTab.js`（全文 5 行）：

```js
import { Interface } from "../../../interface/Interface.js";

const ISettingTab = new Interface("ISettingTab", ["display", "saveData", "getContent", "initialize"]);

export { ISettingTab }
```

`interface/Interface.js:17-34` 是一个手写的鸭子类型断言：

```js
Interface.ensureImplement = function (object, interfaces) {
    if (arguments.length < 2) { throw new Error(...); }
    interfaces.forEach(inter => {
        if (inter.constructor !== Interface) { throw new Error(...); }
        inter.methods.forEach(method => {
            if (!object[method] || typeof object[method] !== 'function') {
                throw new Error(`Function Interface.ensureImplements: object
								does not implement the ${inter.name}
								interface. Method ${method} was not found.`);
            }
        });
    });
}
```

在 `setting-panel.js:16-19` 于模块加载期立刻断言 4 个 Tab：

```js
Interface.ensureImplement(portSettingTab, [ISettingTab]);
Interface.ensureImplement(selfHealingSettingTab, [ISettingTab]);
Interface.ensureImplement(privacySettingTab, [ISettingTab]);
Interface.ensureImplement(testExecutionTab, [ISettingTab]);
```

注意 `SelfHealingSettingTab`、`KSPortSettingTab`、`PrivacySettingTab` 的类声明上方都写着注释 `//Implements ISettingTab`（`self-healing-setting-tab.js:145`、`KS-port-setting-tab.js:3`、`privacy-setting-tab.js:3`），而 `TestExecutionTab` 写在类体内（`test-execution-setting-tab.js:4`）——注释是唯一的「声明」，真正的约束只有这个运行时断言。

**复刻建议：** 用 TypeScript `interface SettingTab { display(): void; saveData(): Promise<void>; getContent(): string | Promise<string>; initialize(): Promise<void>; }` 直接替掉 `interface/Interface.js` 和 `ISettingTab.js`，净删 41 行。

### 3.4 菜单树与 `display()` 的「全隐藏再显示」

`setting-panel/js/UI/menu-tree.js:3-20` 定义树数据：

```js
const treeDataStructure = [
  { id: "KSPort",       name: "Katalon Studio Port" },
  { id: "selfHealing",  name: "Self Healing" },
  { id: "privacy",      name: "Privacy" },
  { id: "testExecution",name: "Test Execution" },
];
```

`menu-tree.js:22-45` 用 jqtree 渲染并硬编码 `switch` 分发：

```js
$("#menu-tree-view").tree({ data: treeDataStructure });
$('#menu-tree-view').on('tree.click', function (event) {
  switch (event.node.id) {
    case "KSPort":        portSettingTab.display();      break;
    case "selfHealing":   selfHealingSettingTab.display(); break;
    case "privacy":       privacySettingTab.display();   break;
    case "testExecution": testExecutionTab.display();    break;
  }
});
```

每个 Tab 的 `display()` 都是同一套模板（以 `self-healing-setting-tab.js:209-214` 为例）：

```js
display() {
  for (let child of $(this.containerElement).children()) {
    $(child).hide();
  }
  $("#self-healing-content").show();
}
```

即：**先把 `#content` 下所有子元素 `hide()`，再 `show()` 自己那个固定 ID 的 div。** 所以 4 个 Tab 的内容 HTML 是**一次性全部渲染进 DOM**的（`getContent()` 里都带 `style="display: none"`），切 Tab 只是 CSS 显隐。

代价：`menu-tree.js` 与 4 个 Tab 类**双向硬耦合**（`menu-tree.js:1` 从 `setting-panel.js` import 4 个实例，`setting-panel.js:3` 又 import `generateMenuTree`——**循环 import**）。ESM 能跑是因为 `generateMenuTree()` 在 `document.ready` 之后才调用，那时循环已解开。这是很脆的写法。

### 3.5 脏标记 `isChange` 与关闭确认

`setting-panel.js:21-25`：

```js
let isChange = false;
const setIsChange = (value) => { isChange = value; }
```

`setIsChange(true)` 被 4 个 Tab 在**每一个用户交互**处调用：
- `self-healing-setting-tab.js:24`（拖拽排序 update）、76（enable checkbox）、87/97（上移/下移）、104（删除排除项）、131（新增排除项）
- `KS-port-setting-tab.js:35`（端口输入 `on("input")`）
- `privacy-setting-tab.js:10`（tracking checkbox）
- `test-execution-setting-tab.js:11/14`（两个 radio）

关闭逻辑（`setting-panel.js:50-65`）：

```js
$("#close-btn").click(function () {
  if (!isChange) { window.close(); return; }
  displayConfirmCloseDialog().then(async (result) => {
    switch (result) {
      case "yes": await saveData(); window.close(); break;
      case "no":  window.close();
    }
  });
});
```

`confirm-close-dialog.js:7-40` 返回一个 Promise，Yes/No 各 `resolve`，**Cancel 分支只 `close` 对话框、不 resolve** —— Promise 永久 pending。这在这里无害（只是不再往下走），但如果复刻时把它包在 `await` 后面接了清理逻辑，就会静默漏执行。

> **坑**：`isChange` 只在点 Save 时 `setIsChange(false)`（`setting-panel.js:44`），而用户直接点窗口右上角 × 关闭（不是 `#close-btn`）时**没有任何拦截**——`beforeunload` 未注册（grep 全库无 `beforeunload`）。所以「未保存提示」只对面板自己的 Close 按钮生效。

---

## 4. 设置项完整清单

### 4.1 三层存储约定

| 层 | 存储位置 | 谁在用 | 特点 |
|---|---|---|---|
| L1 · 主配置 | `storage.local` 的**单键** `setting`（值是嵌套对象） | 自愈、埋点、失败执行策略 | 有默认值兜底（`load-setting-data.js`） |
| L2 · 独立配置键 | `storage.local.katalonServerPortStorage` | Katalon Studio 端口 | 独立于 `setting`，有自己的 get/set 函数 |
| L3 · UI 状态 / 计数 | `storage.local` 十几个顶层键 | 引导、弹窗节流、埋点计数 | 无默认值、无 schema、随处 set |

### 4.2 L1：`setting` 对象完整字段表

默认值来源 `panel/js/background/load-setting-data.js:7-18`：

```js
async function setDefaultSettingData(){
    browser.storage.local.set({
        setting: {
            "self-healing":{
                enable: true,
                locator: ["id", "xpath", "css"],
                excludeCommands: ["verifyElementPresent", "verifyElementNotPresent", "assertElementPresent", "assertElementNotPresent"],
            },
            "tracking": true,
        }
    });
}
```

| 配置键（路径） | 类型 | 默认值 | 作用 | 写入点 | 读取点 |
|---|---|---|---|---|---|
| `setting["self-healing"].enable` | boolean | `true` | 自愈总开关 | `self-healing-setting-tab.js:194-207` | `self-healing-service/utils.js:17-25` `isSelfHealingEnable()` |
| `setting["self-healing"].locator` | string[] | `["id","xpath","css"]` | **定位器重试优先级顺序**（数组下标即优先级） | 同上（`getElementList("locatorList")` 按 DOM 顺序读回） | `utils.js:1-9` `getSelfHealingSettingLocatorsList()` → `utils.js:55-78` `getPossibleTargetList()` |
| `setting["self-healing"].excludeCommands` | string[] | `["verifyElementPresent","verifyElementNotPresent","assertElementPresent","assertElementNotPresent"]` | 不参与自愈的命令名（**按正则匹配**） | 同上 | `utils.js:27-48` `isCommandExcluded()` |
| `setting.tracking` | boolean | `true` | Segment / HubSpot 埋点总开关 | `privacy-setting-tab.js:28-34`；`onboarding-dialog.js:109-119`（引导页 Yes/No 直接改） | `segment-tracking-service.js:48-52`；`background/segment-tracking-services.js:14-18`；`hubspot-tracking-service.js:30` |
| `setting.testExecution.stopExecution` | boolean | **无默认值**（`undefined`） | 失败后停止执行 | `test-execution-setting-tab.js:40-51`；`test-execution-dialog.js:131-138` | 仅用于回显 radio |
| `setting.testExecution.continueExecution` | boolean | **无默认值**（`undefined`） | 失败后继续执行 | 同上（`test-execution-dialog.js:140-147`） | `play-actions.js:1551` `return testExecution.continueExecution ?? true;` |
| `setting.testExecution.hideExecutionDialog` | boolean | **无默认值**（`undefined`） | 不再弹「是否继续」对话框 | `test-execution-dialog.js:149-153` | `play-actions.js:1535` |

> 注意 `testExecution` 整个子对象**不在默认值里**。它是运行时由 Tab 或弹窗第一次写入才出现的，所有读取点都必须写 `?? {}` 兜底——源码里确实都写了（`test-execution-setting-tab.js:20-21`、`test-execution-dialog.js:3-4`、`play-actions.js:1532-1533`），但 `self-healing` 的读取点**没有**任何兜底（见 §7.2）。

### 4.3 L2：端口配置（独立键）

`katalon/chrome_common.js:1-25`：

```js
var katalonServerPortStorage = "katalonServerPortStorage";

function setKatalonServerPort(port) {
    chrome.storage.local.set({ katalonServerPortStorage : port }, function() { ... });
}

function getKatalonServerPort(callback) {
    chrome.storage.local.get(katalonServerPortStorage, function(result) {
        var port;
        if (!(katalonServerPortStorage in result)) {
            port = (bowser.name == "Chrome") ? (katalonServerPort ? katalonServerPort : katalonServerPortForChrome) : katalonServerPortForFirefox;
            setKatalonServerPort(port);
        } else {
            port = result[katalonServerPortStorage];
        }
        callback(port);
    })
}
```

默认值链条：

| 全局变量 | 定义处 | 值 |
|---|---|---|
| `katalonServerPortForChrome` | `katalon/chrome_variables_default.js:4` | `"50000"` |
| `katalonServerPortForFirefox` | `katalon/chrome_variables_default.js:3` | `"50001"` |
| `katalonServerPort` | `chrome_variables_init.js:3`（根目录） | `undefined`（可被打包脚本覆盖） |

即：**Chrome 用 50000，Firefox 用 50001，`chrome_variables_init.js` 可以整体覆盖。** 这三个 `.js` 都是**裸全局变量赋值**（没有 `var`），靠 `<script>` 顺序注入（`setting-panel/index.html:29-32`、`worker_wrapper.js` 的 `importScripts`）。

依赖 `bowser.name` —— `bowser` 由 `content/bowser.js` 提供，在 SW 里由 `worker_wrapper.js` 第 4 行 importScripts，在设置面板里**没有引入**！`setting-panel/index.html:28-36` 的脚本列表里没有 bowser。因此设置面板首次打开（storage 里还没有该键）时，`getKatalonServerPort` 会在 `bowser.name` 处抛 `ReferenceError`，端口输入框留空。见 §9.1。

### 4.4 L3：其余 `storage.local` 顶层键全表

按 `grep -rn "storage\.local\.set(" --include=*.js` 结果整理（排除 `bundles/`、polyfill）：

| 键 | 写入点 | 用途 | 裁剪 |
|---|---|---|---|
| `setting` | `load-setting-data.js:8`、4 个 Tab、`onboarding-dialog.js:112/117`、`test-execution-dialog.js:135/144/152` | 主配置（§4.2） | 保留 |
| `katalonServerPortStorage` | `chrome_common.js:4` | KS 端口 | 删 |
| `testExecutionTab` | `test-execution-dialog.js:101` (true) / `setting-panel.js:99` (false) | **一次性跳转标记**：让设置窗口打开时直接定位到 Test Execution 页 | 保留（很巧妙） |
| `firstTime` | `background/install.js:24` (true)、`kar-upload.js`、`onboarding-dialogs.js`、`other-listeners/storage.js` | 首次安装引导 | 删 |
| `tracking` | `background/install.js:26-30` | `{isUpdated:true}`，**与 `setting.tracking` 完全不同的键**，只在升级时写 | 删 |
| `segment` | `segment-tracking-service.js`、`login-inapp.js` | `{userId, user}` 埋点身份 | 删（TECH-14） |
| `hubspot` | `login-inapp.js:445-455` | `{user}` | 删（TECH-14） |
| `checkLoginData` | `website-login.js:72/81/86`、`login-inapp.js:612`、`top-toolbar/actions.js:26/62` | `{recordTimes,playTimes,hasLoggedIn,user,isActived,testCreated,createTestCaseThreshold}` | 删（TECH-14） |
| `refreshToken` | `top-toolbar/actions.js:160` | OAuth refresh token | 删（TECH-14） |
| `codePKCE` | `utils/generatePKCE.js:31-36` | PKCE verifier/challenge | 删（TECH-14） |
| `anonymousId` / `visitor` | `common/persistent-store.js:45`（经 `getPersistentValue`） | 匿名 ID / 浏览器指纹 | 删（TECH-14） |
| `playbackTracking` | `playback-local-tracking.js:15/…` | 本地计数 `{recordNum, playTestCase*, selfHealing, playSuite}` | 删 |
| `leftSidePanelTracking` / `popupTracking` / `usage` | `left-side-panel-tracking.js`、`popup-tracking.js`、`UsageWatcher.js` | 本地埋点计数 | 删 |
| `onBoardingUserChoice` | `onboarding-dialogs.js`、`user-manual-dialog.js`、`new-onboarding.js` | 引导问卷答案，**被门禁逻辑读取**（`popup-play-suite-quota.js:72-81`） | 删 |
| `tutorialStates` / `tutorialsCompleted` / `doUserManual` / `finnishOnboarding` / `addSample` | 各引导服务 | 教程进度 | 删 |
| `extensions` | `kar-extensionScript.js` | 自定义关键字脚本 | 视需求 |
| `profileData` | `globla-profile-local-storage.js`（注意文件名拼写错误 `globla`） | 全局变量 Profile | 保留（TECH-08） |
| 测试数据 / 用例 / 套件相关键 | `data-service/save-data.js` 等 | 见 TECH-08 | 保留 |

> **规模判断：** 真正的「用户可配置项」只有 6 个（enable / locator / excludeCommands / tracking / stopExecution+continueExecution / port）。其余全是状态。裁剪后应该只剩 3~4 个。

---

## 5. 配置读写与「广播」（真相：没有广播）

### 5.1 写：整对象覆盖，无原子性

四个 Tab 的 `saveData()` 是同一个模式——**读整个 `setting`、改一个子字段、整个写回**。以 `test-execution-setting-tab.js:40-51` 为例：

```js
async saveData() {
  const stopExecution = $("#stop-execution").prop("checked");
  const continueExecution = $("#continue-execution").prop("checked");
  let settingData = await browser.storage.local.get("setting");
  settingData = settingData.setting ?? {};
  let testExecution = settingData.testExecution ?? {};
  testExecution.stopExecution = stopExecution;
  testExecution.continueExecution = continueExecution;

  settingData.testExecution = testExecution;
  browser.storage.local.set({ setting: settingData });
}
```

而 `setting-panel.js:35-40` 的 `saveData()` **顺序串行**调用 4 个：

```js
async function saveData() {
  portSettingTab.saveData();          // ← 注意：没有 await（同步函数，无妨）
  await selfHealingSettingTab.saveData();
  await privacySettingTab.saveData();
  await testExecutionTab.saveData();
}
```

因为串行了，所以「后写覆盖前写」的丢失不会发生**在面板内部**。但注意每个 `saveData()` 内部的 `browser.storage.local.set(...)` **都没有 await**（`self-healing-setting-tab.js:206`、`privacy-setting-tab.js:33`、`test-execution-setting-tab.js:50`）——它们返回 Promise 但被丢弃。于是：

```
selfHealing.saveData()  → get(旧A) → set(A+自愈)   [未 await，飞行中]
privacy.saveData()      → get(???) → set(???+隐私)
```

`await selfHealingSettingTab.saveData()` 只等到函数体跑完，**不等 set 落盘**。下一个 Tab 的 `get` 可能读到旧值 → **隐私 Tab 的写会抹掉自愈 Tab 刚写的改动**。这是真实存在的竞态（Chrome 的 storage.local 实际是串行队列，`get` 排在 `set` 之后会读到新值，所以现实中大概率不出问题——但这属于**依赖实现细节**，复刻时必须 `await`）。

### 5.2 读：每次现取，零缓存

全库对 `setting` 的读取（`grep 'storage\.local\.get("setting"'`，排除 bundles）共 **17 处**：

| 文件:行 | 场景 |
|---|---|
| `setting-panel/js/setting-tabs/test-execution-setting-tab.js:19` / `:43` | 渲染 / 保存 |
| `setting-panel/js/setting-tabs/self-healing-setting-tab.js:67` / `:203` | 渲染 / 保存 |
| `setting-panel/js/setting-tabs/privacy-setting-tab.js:15` / `:31` | 渲染 / 保存 |
| `background/segment-tracking-services.js:14` | SW 埋点门禁 |
| `panel/js/UI/services/tracking-service/segment-tracking-service.js:48` | 面板埋点门禁 |
| `panel/js/UI/services/tracking-service/hubspot-tracking-service.js:30` | HubSpot 门禁 |
| `panel/js/UI/services/self-healing-service/utils.js:2` / `:18` / `:28` | **自愈：每次都重新读 storage** |
| `panel/js/background/playback/service/actions/play/play-actions.js:1531` | 失败弹窗策略 |
| `panel/js/background/load-setting-data.js:21` | 默认值兜底 |
| `panel/js/UI/view/dialog/onboarding-dialog.js:110` / `:115` | 引导页改 tracking |
| `panel/js/UI/view/dialog/test-execution-dialog.js:2` | 弹窗读策略 |

**没有任何内存缓存、没有任何 `storage.onChanged` 监听 `setting` 键**（全库 `storage.onChanged` 共 8 处，见下表，**没有一处监听 `setting`**）：

| 文件:行 | 监听的键 |
|---|---|
| `content-marketing/panel/popup-chrome-store.js:103` | 营销弹窗节流 |
| `content-marketing/panel/popup-rate-us.js:190` | 评分弹窗 |
| `content-marketing/panel/popup-sample-data.js:82` | 示例数据 |
| `content-marketing/panel/popup-what-are-you-automating.js:97` | 问卷 |
| `content-marketing/panel/self-healing-rating.js:83` | 自愈评分 |
| `panel/js/UI/controllers/onboarding/contextual-onboarding-listener.js:113` | 引导 |
| `panel/js/UI/controllers/top-toolbar/actions.js:116` | `checkLoginData`（登录态刷新头像） |

所以：**「保存生效」= 下一次读取时拿到新值**。自愈设置改完立刻生效（因为 `utils.js` 每次调用都重读）；`hideExecutionDialog` 也立刻生效。这个设计的代价是**每一步命令失败都要打一次 storage IO**（`utils.js` 的三个函数在一次自愈里会被各调一遍，`getPossibleTargetList` 内部还会再读一次），高频回放时是可观的开销。

> **裁剪建议：** 加一层内存缓存 + `storage.onChanged` 失效即可，代码量 <20 行，见 §11 MVP。

### 5.3 唯一的「跨窗口通信」：`testExecutionTab` 一次性标记

设置面板是独立窗口，主面板无法直接调它的函数。KR 用了一个很轻的技巧来实现「从失败弹窗跳到设置的 Test Execution 页」：

`test-execution-dialog.js:100-111`：

```js
function openPanel() {
  browser.storage.local.set({ testExecutionTab: true });   // ① 打标记
  browser.windows.create({ url: browser.runtime.getURL("setting-panel/index.html"), ... })
}
```

`setting-panel.js:82-100`：

```js
async function displayTab() {
  let tabId = await browser.storage.local.get("testExecutionTab");   // ② 读标记
  const menuTree = $("#menu-tree-view");
  if (tabId.testExecutionTab) {
    const node = menuTree.tree('getNodeById', "testExecution");
    menuTree.tree('selectNode', node);
    testExecutionTab.display();
  } else {
    const node = menuTree.tree('getNodeById', "KSPort");
    menuTree.tree('selectNode', node);
    portSettingTab.display();
  }
  // Reset to default
  browser.storage.local.set({ testExecutionTab: false });            // ③ 用完即焚
}
```

**用 storage 当一次性消息队列。** 优点是不用建 port、不用管窗口生命周期；缺点是如果窗口打开失败，标记会残留到下次（下次打开会错误地落在 Test Execution 页）。另外 `displayFirstTab()`（`setting-panel.js:75-80`）是 `displayTab` 的旧版本，**已无任何调用点，是死代码**。

---

## 6. 自愈优先级配置（衔接 TECH-02）

这是整个配置系统里**唯一有真实业务语义**的部分。TECH-02 讲的是「自愈怎么跑」，这里讲「配置怎么变成跑法」。

### 6.1 UI：拖拽顺序 = 数组顺序 = 重试顺序

`self-healing-setting-tab.js:44-53` 渲染 locator 列表——**一行一个 `<tr>`，顺序就是数组顺序**：

```js
function renderLocatorList(dataSetting) {
  let locator = dataSetting.locator;
  locator.forEach(locator => {
    let tr = $(`<tr class='ui-sortable-handle'><td>${locator}</td></tr>`);
    tr.click(function () { clickElementInListHandler("locatorList", this); });
    $("#locatorList").append(tr);
  });
}
```

用户有两种改顺序的方式：

**A · jQuery UI sortable 拖拽**（`self-healing-setting-tab.js:3-27`）：

```js
function makeTableSortable(tbodyID) {
  $(`#${tbodyID}`).sortable({
    axis: "y", items: "tr", scroll: true, revert: 200, scrollSensitivity: 20,
    helper: function (e, tr) {
      let $originals = tr.children();
      let $helper = tr.clone();
      $helper.children().each(function (index) { $(this).width($originals.eq(index).width()); });
      return $helper;      // ← clone 时手动复制列宽，否则拖拽中表格会塌
    },
    update: function (event, ui) {
      let element = ui.item;
      let selectedElement = getSelectedElement(tbodyID);
      $(selectedElement).removeClass("selected");
      $(element).addClass("selected");
      setIsChange(true);
    }
  });
}
```

**B · Move up / Move down 按钮**（`self-healing-setting-tab.js:79-98`）——纯 DOM 操作，`insertBefore` / `insertAfter`：

```js
$("#locator-move-up-btn").click(function () {
  let selectedElement = getSelectedElement("locatorList");
  if (selectedElement) {
    let prevSibling = selectedElement.previousElementSibling;
    if (prevSibling) { $(selectedElement).insertBefore(prevSibling); }
  }
  setIsChange(true);
});
```

保存时**从 DOM 顺序读回数组**（`self-healing-setting-tab.js:137-143`）：

```js
function getElementList(listID) {
  let resultList = [];
  $(`#${listID}`).children().each((i, element) => {
    resultList.push(element.innerText)
  });
  return resultList;
}
```

> **DOM 即数据模型** —— 和 TECH-12 里报告用 `#logcontainer.innerHTML` 做数据源是同一种风格。用 `element.innerText` 读回来意味着：如果 CSS 里给 `<td>` 加了 `::before` 伪元素内容，或者 locator 名里有前后空格，读回来的字符串会被污染。

### 6.2 消费：`getPossibleTargetList` 把顺序变成重试队列

`panel/js/UI/services/self-healing-service/utils.js:55-78`（全文）：

```js
const getPossibleTargetList = async (currentCommand) => {
  let possibleCommandTargets = [];
  //get data from user setting
  let locatorList = await getSelfHealingSettingLocatorsList();
  //get option base on priority in locator list
  possibleCommandTargets = locatorList.reduce((prev, locator) => {
    let reg = new RegExp(`^${locator}`);
    let filterOptionList = currentCommand.targets.filter(opt => reg.exec(opt)?.length);
    prev.push(...filterOptionList);
    return prev;
  }, []);
  //push other options to the end
  let otherOptionList = currentCommand.targets.filter(option => {
    return !possibleCommandTargets.includes(option);
  });
  possibleCommandTargets.push(...otherOptionList);
  // remove current target from possible target list
  let currentCommandTarget = currentCommand.target;
  let index = possibleCommandTargets.indexOf(currentCommandTarget);
  if (index !== -1) {
    possibleCommandTargets.splice(index, 1);
  }
  return possibleCommandTargets;
}
```

逐行语义：

| 步骤 | 行 | 做什么 |
|---|---|---|
| ① 取配置顺序 | 58 | `["id","xpath","css"]` |
| ② 按前缀正则分桶 | 60-65 | 对每个 locator 名构造 `^id` / `^xpath` / `^css`，从 `command.targets`（候选定位器全集，形如 `"id=username"`、`"xpath=//input[1]"`）里筛出匹配的，**按配置顺序依次 push** |
| ③ 兜底追加 | 67-70 | `targets` 里没被任何 locator 前缀匹配到的（例如 `linkText=`、`name=`），**统统追加到末尾** |
| ④ 剔除当前值 | 72-76 | 把已经失败的那个 target 从队列里删掉 |

**关键结论（TECH-02 的配置侧答案）：**
- `setting["self-healing"].locator` 数组里的字符串，被当作**候选 target 字符串的前缀正则**使用，不是枚举白名单。
- 因此写 `"id"` 会同时匹配到 `id=xxx` 和 `idXyz=xxx`（如果存在这种前缀）；写 `"css"` 匹配 `css=...`。
- **不在数组里的定位器不会被排除，只会排到最后。** 想真正禁用某种定位器，光从这个列表里删掉是没用的。这是最容易误解的一点。
- 数组里出现了 `targets` 中不存在的名字（例如用户手打了 `"foo"`），只是产生一个空桶，无害。

### 6.3 `excludeCommands` 是正则，不是字符串等值

`utils.js:27-48`：

```js
const isCommandExcluded = async (commandName) => {
  let settingData = await browser.storage.local.get("setting");
  if (isObjectEmpty(settingData)) { return false; }
  settingData = settingData.setting;
  let selfHealingSetting = settingData["self-healing"];
  let excludedCommands = selfHealingSetting.excludeCommands;
  for (let command of excludedCommands) {
    try {
      let regExp = new RegExp(command);
      if (regExp.exec(commandName) !== null) { return true; }
    } catch (e) {
      if (command === commandName) { return true; }
    }
  }
  return false;
}
```

- 每一项先尝试 `new RegExp(command)` 做**非锚定**匹配（`exec` 不加 `^$`）。
- **默认值 `"verifyElementPresent"` 会同时命中 `verifyElementPresentXyz`**，也会命中包含它的任何命令名。
- 只有当字符串**不是合法正则**（例如用户输入 `verify(`）时才退化为字符串等值比较。
- UI 侧（`self-healing-setting-tab.js:106-134`）新增排除项就是一个 `<input>` + Enter 键，**不做任何校验**，用户可以输入任意正则。

> **裁剪建议：** 如果你不需要正则能力，把它改成 `excludedCommands.includes(commandName)`，省掉 try/catch 与不可预期的模糊匹配。如果保留正则，UI 上要给个提示。

### 6.4 三个 setting 读取点缺兜底

`utils.js:1-9 / 17-25 / 27-48` 三个函数都是这个套路：

```js
let settingData = await browser.storage.local.get("setting");
if (isObjectEmpty(settingData)) { return [] /* or false */; }
settingData = settingData.setting;
let selfHealingSetting = settingData["self-healing"];
return selfHealingSetting.locator;      // ← 这里没有任何保护
```

`isObjectEmpty`（`utils.js:11-15`，与 `load-setting-data.js:1-5` 重复定义）只判断「`get` 返回的包装对象是不是 `{}`」。所以：

- `setting` 完全不存在 → `get` 返回 `{}` → `isObjectEmpty` 为 `true` → 安全返回。
- `setting` 存在但**没有 `self-healing` 子对象**（例如从更老的版本升级上来，或某次 `privacy-setting-tab.js:33` 写入时把 `setting` 覆盖成了只有 `tracking` 的对象）→ `isObjectEmpty` 为 `false` → `selfHealingSetting` 是 `undefined` → **`undefined.locator` 抛 TypeError**，整个自愈链路崩掉。

这是本模块最危险的一处（见 §9.2 的完整触发路径）。

---

## 7. 默认值兜底与版本迁移

### 7.1 兜底逻辑只有 9 行，且只在「完全没有」时触发

`panel/js/background/load-setting-data.js:20-29`（全文尾部）：

```js
const loadSettingData = async () => {
    let settingData = await browser.storage.local.get("setting");
    if (isObjectEmpty(settingData)){
        await setDefaultSettingData();
    }
}

export {loadSettingData}

loadSettingData();     // ← 模块加载即执行（副作用式初始化）
```

调用点只有两个：
- `panel/index.html:1001`：`<script type="module" src="js/background/load-setting-data.js"></script>` —— 面板打开就跑；
- `playback/index.js:36`：`import("../panel/js/background/load-setting-data.js");` —— CLI/socket 回放通道动态 import。

**没有在 Service Worker 里跑**（`worker_wrapper.js` 的 importScripts 列表里没有它）。所以：如果用户从没打开过面板，SW 里的 `background/segment-tracking-services.js:14-18` 读 `settingData.setting.tracking` 会**在 `settingData.setting` 为 `undefined` 时抛错**。实际不出问题是因为 `install.js:23` 的 `trackingInstallApp()` 分支被 `data.event === "kru_install_application"` 短路在前面（`background/segment-tracking-services.js:16`），走的是 `||` 的第一个操作数。这是**巧合式安全**。

### 7.2 没有 schema 版本、没有 deep-merge

`setDefaultSettingData()` 是**整键覆盖**式写入，`loadSettingData()` 又只在整键缺失时触发。结论：

| 场景 | 行为 |
|---|---|
| 全新安装 | 写入默认对象 ✅ |
| 新版本新增了配置项（例如加了 `setting.timeout`） | **不会补齐**，老用户永远读到 `undefined` ❌ |
| 用户手动清了 `setting["self-healing"]` | 不会恢复，且触发 §6.4 的 TypeError ❌ |
| 降级到老版本 | 老版本读到不认识的字段，直接忽略（无害） |

**复刻必须补上的能力：**

```js
const SETTING_SCHEMA_VERSION = 1;
const DEFAULTS = { __v: 1, selfHealing: {...}, testExecution: {...} };

function deepMergeDefaults(current, defaults) {
  const out = { ...defaults, ...current };
  for (const k of Object.keys(defaults)) {
    if (defaults[k] && typeof defaults[k] === 'object' && !Array.isArray(defaults[k])) {
      out[k] = deepMergeDefaults(current?.[k] ?? {}, defaults[k]);
    }
  }
  return out;
}
```

注意**数组不要 merge**（`locator` 是有序集合，merge 会破坏用户排序），只在整体缺失时用默认数组。

### 7.3 「默认值定义」散落在 4 个地方

| 配置 | 默认值定义处 |
|---|---|
| `self-healing.*` / `tracking` | `panel/js/background/load-setting-data.js:7-18` |
| `testExecution.*` | **没有集中定义**，靠各读取点的 `?? {}` 与 `?? true`（`play-actions.js:1551`） |
| 端口 | `katalon/chrome_variables_default.js:3-4` + `chrome_variables_init.js:1-3` |
| `checkLoginData` 初值 | `website-login.js:31-38` 与 `content-marketing/panel/login-inapp.js:600-610` **两份不同的定义**（后者多了 `isActived`/`testCreated`/`createTestCaseThreshold`） |

> 最后一行是真实的一致性事故：同一个键有两个初始化模板，先跑到哪个就用哪个。裁剪时这两个文件都删（TECH-14），问题自然消失。

---

## 8. `third-party` 目录内容

`setting-panel/js/third-party/` 只有一个文件：

| 文件 | 行数 | 是什么 | 用在哪 | 判断 |
|---|---|---|---|---|
| `tree.jquery.js` | 1342 | [jqTree](https://github.com/mbraak/jqTree)，jQuery 树形控件（含拖拽、懒加载、节点增删改、键盘导航等全套能力） | 只在 `menu-tree.js:23-25` 用来画 4 个**没有层级**的菜单项 | **删除**。1342 行换 4 个 `<li>` |
| （配套）`setting-panel/css/jqtree.css` | 199 | jqtree 样式 | 同上 | 随之删除 |

引入方式（`setting-panel/index.html:35`）：

```html
<script type="text/javascript" src="js/third-party/tree.jquery.js"></script>
```

用到的 jqtree API 只有 4 个：
- `$(el).tree({ data })` —— 建树（`menu-tree.js:23`）
- `.on('tree.click', handler)` —— 点击（`menu-tree.js:26`）
- `.tree('getNodeById', id)` —— 找节点（`setting-panel.js:77/88/93`）
- `.tree('selectNode', node)` —— 选中高亮（`setting-panel.js:78/89/94`）

**替换成本极低**（见 §11 MVP 的 15 行原生实现）。

设置面板还从主面板借了 4 个 CSS + 2 个 JS 库（`setting-panel/index.html:7-10, 33-34`）：

```html
<link rel="stylesheet" href="../panel/css/font-awesome.min.css">
<link rel="stylesheet" href="../panel/css/jquery-ui.min.css">
<link rel="stylesheet" href="../panel/css/layout.css">
<link rel="stylesheet" href="../panel/css/kar.css">
...
<script type="text/javascript" src="../common/jquery-3.2.1.min.js"></script>
<script type="text/javascript" src="../panel/js/lib/jquery-ui.min.js"></script>
```

`jquery-ui` 是必需的（`sortable`、`dialog`）；`font-awesome`/`layout.css`/`kar.css` 在设置面板里几乎没用到，属于顺手引入。

---

## 9. 隐晦知识点与坑

### 9.1 设置面板缺 `bowser`，首次打开端口框为空

`chrome_common.js:18` 依赖全局 `bowser.name`：

```js
port = (bowser.name == "Chrome") ? (katalonServerPort ? katalonServerPort : katalonServerPortForChrome) : katalonServerPortForFirefox;
```

但 `setting-panel/index.html:28-36` 的脚本清单里**没有 `content/bowser.js`**。因此在 `katalonServerPortStorage` 尚未写入时（全新安装 + 从未打开过面板/SW 未初始化过端口），`getKatalonServerPort` 的回调分支会抛 `ReferenceError: bowser is not defined`，`KS-port-setting-tab.js:31-33` 的 `callback` 永不执行，输入框留空。

之所以线上很少见，是因为 SW（`worker_wrapper.js` 第 4 行 importScripts `content/bowser.js`）在其他路径上先调过一次 `getKatalonServerPort` 把键写进去了。**跨上下文的隐式初始化依赖**，典型的祖传坑。

### 9.2 `Object.assign(undefined, …)` 崩溃路径（自愈 Tab）

`self-healing-setting-tab.js:203-206`：

```js
let settingData = await browser.storage.local.get("setting");
settingData = settingData.setting ?? {};
Object.assign(settingData["self-healing"], self_healing);   // ← 若 setting 存在但无 self-healing 子对象
browser.storage.local.set({ setting: settingData });
```

`settingData["self-healing"]` 为 `undefined` 时，`Object.assign(undefined, …)` 抛 `TypeError: Cannot convert undefined or null to object`。触发路径真实存在：

1. `privacy-setting-tab.js:31-33` 写 `setting` 时用的是 `settingData.setting.tracking = enable; set({setting: settingData.setting})` —— 如果那一刻 `settingData.setting` 是 `undefined`，这行本身就先抛错了；
2. 但 `onboarding-dialog.js:110-112` 也做同样的事：`settingData.setting.tracking = true`，同样依赖 `setting` 已存在；
3. 任何第三方/手工清理 `setting["self-healing"]` 的操作都会让自愈 Tab 保存崩溃，且**没有 try/catch**，`saveData()` 的 Promise reject 会让 `setting-panel.js:45-47` 的 `.then(() => alert("Save successfully"))` 不执行——**用户点了 Save 但什么都没发生，也没有错误提示**。

正确写法：

```js
settingData["self-healing"] = { ...(settingData["self-healing"] ?? {}), ...self_healing };
```

### 9.3 生产代码里留了 `debugger;`

`setting-panel/js/setting-tabs/privacy-setting-tab.js:28-30`：

```js
async saveData() {
    debugger;
    const enable = $("#enable-tracking").prop("checked");
```

只要用户打开了 DevTools 并点 Save，就会在这里断住。这是 7.1.0 发布版里实实在在存在的调试残留。

### 9.4 HTML 语法错误：`for="continue":`

`test-execution-setting-tab.js:34`：

```html
<label for="continue":>Continue test execution</label><br>
```

`for="continue":` 多了个冒号（会被解析成一个名为 `:` 的空属性），而且 `for` 值 `continue` / `pause`（第 32 行）**跟 input 的 `id`（`stop-execution` / `continue-execution`）对不上**——点击文字标签不会选中 radio。两个 radio 的 `value="pause"` / `value="continue"` 也从未被读取（`saveData` 读的是 `prop("checked")`）。

### 9.5 首次进入时两个 radio 都不选中，且注释与代码矛盾

`test-execution-setting-tab.js:23-24`：

```js
const stopExecution = testExecution.stopExecution ? "checked" : "";
const continueExecution = testExecution.continueExecution ? "checked" : "";
```

`testExecution` 不存在时两者都是 `""` → **两个 radio 都不选中**。用户如果直接点 Save，会写入 `{stopExecution:false, continueExecution:false}`。

然后 `play-actions.js:1549-1551`：

```js
/*** By default, if no configuration exists, pause execution
 * Else, follow configuration */
return testExecution.continueExecution ?? true;
```

- 注释说「无配置时暂停执行」，代码 `?? true` 却是**继续执行**——注释与代码相反。
- 而一旦用户点过一次 Save，`continueExecution` 就是 `false`（不是 `undefined`），`??` 不生效 → 返回 `false` → 停止。
- 所以真实行为是：**从未保存过 → 失败后继续；保存过一次（哪怕没选）→ 失败后停止。** 极其反直觉。

### 9.6 `settingWindowID` 被声明了两次，两个副本互不感知

- `panel/js/katalon/kar.js:229`：`var settingWindowID;`（全局，`#settings` 按钮用）
- `panel/js/UI/view/dialog/test-execution-dialog.js:99`：`var settingWindowID;`（函数内局部，失败弹窗的「go to Settings」用）

后者是 `testExecutionDialog()` **函数体内的局部变量**，每次弹窗都是新的 `undefined` → 每次点「go to Settings」都会 `openPanel()` 开新窗口。加上前者，一个用户可以攒出任意多个设置窗口，且它们**各自持有 4 个 Tab 实例、各自读写同一份 `setting`** → 后关闭的窗口保存时会覆盖先关闭的。

### 9.7 `getContent()` 的同步/异步不一致

```js
container.append(selfHealingSettingTab.getContent());        // 同步：返回字符串
container.append(portSettingTab.getContent());               // 同步
container.append(await privacySettingTab.getContent());      // 异步：返回 Promise<string>
container.append(await testExecutionTab.getContent());       // 异步
```
（`setting-panel.js:29-32`）

`ISettingTab` 只约定「有 `getContent` 方法」，不约定返回类型。如果哪天有人忘了 `await`，jQuery 会把 `[object Promise]` 当字符串塞进 DOM——**静默失败，无报错**。复刻时统一成同步 `getContent(): string` + 异步 `initialize()` 填数据。

### 9.8 `#save-btn` 只有成功提示，没有失败提示

`setting-panel.js:43-48`：

```js
$("#save-btn").click(function () {
  setIsChange(false);          // ← 先清脏标记
  saveData().then(() => {
    alert("Save successfully");
  });
});
```

两个问题：
1. **`setIsChange(false)` 在保存之前**就执行了。若 `saveData()` 抛错（§9.2），脏标记已清，用户点 Close 不会被提示，改动直接丢失。
2. 没有 `.catch()`，失败时只是 `alert` 不弹，用户完全无感知。

### 9.9 `menu-tree.js` ↔ `setting-panel.js` 循环 import

```js
// setting-panel.js:3
import { generateMenuTree } from "./UI/menu-tree.js";
// menu-tree.js:1
import { portSettingTab, privacySettingTab, selfHealingSettingTab, testExecutionTab } from "../setting-panel.js";
```

ESM 的 live binding 让它能跑（`menu-tree.js` 在 `generateMenuTree()` 被调用时才真正取值，那时 `setting-panel.js` 已执行完 export）。但只要有人把 `generateMenuTree()` 提前到模块顶层调用，就会拿到 `undefined`。复刻时改成「`generateMenuTree(tabs)` 接收参数」即可解耦。

### 9.10 死代码清单

| 位置 | 说明 |
|---|---|
| `setting-panel.js:75-80` `displayFirstTab()` | 无调用点，被 `displayTab()` 取代 |
| `panel/js/UI/controllers/other-listeners/panel-setting.js:6-8` `#options` 监听 | `panel/index.html` 中已无 `id="options"` 元素 |
| `katalon/options.html` + `katalon/options.js` | 只能从 Chrome 扩展管理页进入的遗留端口页 |
| `test-execution-setting-tab.js` radio 的 `value="pause"/"continue"` | 从未被读取 |
| `KS-port-setting-tab.js:20-25` | 「About this extension」「Acknowledgments」纯广告文案，占 Tab 内容的一半 |

---

## 10. 裁剪建议

### 10.1 文件级处置表

| 路径 | 处置 | 理由 / 替代 |
|---|---|---|
| `setting-panel/js/third-party/tree.jquery.js` (1342) | **删** | 4 个静态菜单项，用 `<ul>` + 事件委托，15 行 |
| `setting-panel/css/jqtree.css` (199) | **删** | 同上 |
| `setting-panel/js/setting-tabs/KS-port-setting-tab.js` (54) | **删** | Katalon Studio 桌面端集成，个人插件无需 |
| `katalon/chrome_common.js` (34) | **删** | 端口 get/set + `chromePostData`（后者仅 KS 通道用） |
| `katalon/chrome_variables_default.js` / `chrome_variables_init.js` | **删** | 端口默认值 + 热键（热键若要保留，迁到新配置） |
| `katalon/options.html` / `katalon/options.js` | **删** | 遗留重复页 |
| `manifest.json:63` `"options_page"` | **改或删** | 改指向 `setting-panel/index.html` 可省掉 `windows.create` 那套单例窗口逻辑 |
| `setting-panel/js/setting-tabs/privacy-setting-tab.js` (44) | **删** | 埋点整体剥离，见 TECH-14 |
| `interface/Interface.js` (36) + `ISettingTab.js` (5) | **删** | TS interface 替代 |
| `setting-panel/js/UI/confirm-close-dialog.js` (42) | 可留 | 42 行、依赖 jquery-ui dialog；不想引 jquery-ui 就用原生 `confirm()` |
| `setting-panel/js/setting-tabs/self-healing-setting-tab.js` (217) | **保留 + 修** | 修 §9.2 的 `Object.assign` |
| `setting-panel/js/setting-tabs/test-execution-setting-tab.js` (61) | **保留 + 修** | 修 §9.4 / §9.5 |
| `panel/js/background/load-setting-data.js` (29) | **重写** | 加 schema 版本 + deep-merge（§7.2） |
| `panel/js/UI/services/self-healing-service/utils.js` (86) | **保留 + 加缓存** | 见 §11 |

### 10.2 引用清理点（`文件:行号`）

删掉端口 Tab 后需要同步清理：

| 文件:行 | 需要改成 |
|---|---|
| `setting-panel/js/setting-panel.js:1` | 删 `import { KSPortSettingTab }` |
| `setting-panel/js/setting-panel.js:12` | 删 `const portSettingTab = new KSPortSettingTab(container);` |
| `setting-panel/js/setting-panel.js:16` | 删 `Interface.ensureImplement(portSettingTab, …)` |
| `setting-panel/js/setting-panel.js:30` | 删 `container.append(portSettingTab.getContent());` |
| `setting-panel/js/setting-panel.js:36` | 删 `portSettingTab.saveData();` |
| `setting-panel/js/setting-panel.js:69` | 删 `portSettingTab.initialize();` |
| `setting-panel/js/setting-panel.js:77-79, 93-95` | 首屏 Tab 改成 `selfHealing` |
| `setting-panel/js/setting-panel.js:111` | 从 export 列表移除 `portSettingTab` |
| `setting-panel/js/UI/menu-tree.js:1, 4-7, 30-32` | 删 import、树节点、switch 分支 |
| `setting-panel/index.html:29-32` | 删 `constants.js` / `chrome_variables_*.js` / `chrome_common.js` 四个 `<script>` |

删掉隐私 Tab 后（TECH-14 会一并处理）：

| 文件:行 | 需要改成 |
|---|---|
| `setting-panel/js/setting-panel.js:7, 13, 18, 31, 38, 71, 111` | 同上模式，移除 `privacySettingTab` |
| `setting-panel/js/UI/menu-tree.js:1, 12-15, 36-38` | 移除 `privacy` 节点与分支 |
| `panel/js/background/load-setting-data.js:15` | 删 `"tracking": true,` |
| `panel/js/UI/view/dialog/onboarding-dialog.js:109-119` | 整段删（引导页改 tracking） |

删掉 jqtree 后：

| 文件:行 | 需要改成 |
|---|---|
| `setting-panel/index.html:6` | 删 `<link rel="stylesheet" href="css/jqtree.css"/>` |
| `setting-panel/index.html:35` | 删 `<script src="js/third-party/tree.jquery.js">` |
| `setting-panel/js/UI/menu-tree.js:23-25` | 换成原生 `<ul>` 渲染 |
| `setting-panel/js/setting-panel.js:76-79, 85-95` | `tree('getNodeById')` / `tree('selectNode')` 换成 class 切换 |

### 10.3 裁剪后的配置模型（建议）

```js
// settings-schema.js
export const SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS = {
  __v: SETTINGS_VERSION,
  selfHealing: {
    enable: true,
    locator: ["id", "css", "xpath"],          // 顺序即优先级（把 css 提前，比 xpath 稳）
    excludeCommands: [
      "verifyElementPresent", "verifyElementNotPresent",
      "assertElementPresent", "assertElementNotPresent",
    ],
    excludeMode: "exact",                     // "exact" | "regex"，显式化 §6.3 的歧义
  },
  testExecution: {
    onFailure: "stop",                        // "stop" | "continue"，取代互斥的两个 boolean
    hideDialog: false,
  },
  report: {
    captureOnFailure: true,                   // 衔接 TECH-12
    autoDownload: false,
  },
};
```

三点改进：
1. `onFailure` 用**枚举字符串**取代两个互斥 boolean → 消灭 §9.5 的「两个都 false」态。
2. `excludeMode` 显式声明匹配语义 → 消灭 §6.3 的隐式正则。
3. `__v` 字段让 §7.2 的迁移成为可能。

---

## 11. 最小可用实现（MVP，约 150 行）

目标：一个**无第三方树控件、无 Interface 反射、有默认值兜底与内存缓存**的设置系统。

### 11.1 `settings.js` —— 配置内核（约 55 行）

```js
// settings.js —— 唯一的配置读写入口
const KEY = "settings";
export const SETTINGS_VERSION = 1;

export const DEFAULTS = {
  __v: SETTINGS_VERSION,
  selfHealing: {
    enable: true,
    locator: ["id", "css", "xpath"],
    excludeCommands: ["verifyElementPresent", "verifyElementNotPresent",
                      "assertElementPresent", "assertElementNotPresent"],
    excludeMode: "exact",
  },
  testExecution: { onFailure: "stop", hideDialog: false },
  report: { captureOnFailure: true, autoDownload: false },
};

let cache = null;

function merge(cur, def) {
  if (Array.isArray(def)) return Array.isArray(cur) ? cur : [...def];   // 数组整体替换，不 merge
  if (def && typeof def === "object") {
    const out = {};
    for (const k of new Set([...Object.keys(def), ...Object.keys(cur ?? {})])) {
      out[k] = k in def ? merge(cur?.[k], def[k]) : cur[k];
    }
    return out;
  }
  return cur === undefined ? def : cur;
}

export async function getSettings() {
  if (cache) return cache;
  const raw = (await chrome.storage.local.get(KEY))[KEY];
  cache = merge(raw ?? {}, DEFAULTS);
  cache.__v = SETTINGS_VERSION;                       // 迁移点：将来按 raw.__v 做逐版本转换
  if (JSON.stringify(raw) !== JSON.stringify(cache)) {
    await chrome.storage.local.set({ [KEY]: cache }); // 补齐缺失字段并回写
  }
  return cache;
}

export async function patchSettings(patch) {          // 浅层路径合并
  const cur = await getSettings();
  const next = merge(patch, cur);                     // patch 优先
  await chrome.storage.local.set({ [KEY]: next });    // ← 必须 await（修 §5.1 竞态）
  cache = next;
  return next;
}

// 跨窗口失效：设置窗口写、主面板读（修 §5.2 无缓存/无广播）
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[KEY]) cache = changes[KEY].newValue;
});
```

### 11.2 `self-healing-config.js` —— 配置消费（约 25 行）

```js
import { getSettings } from "./settings.js";

export async function isSelfHealingEnabled() {
  return (await getSettings()).selfHealing.enable;
}

export async function isCommandExcluded(commandName) {
  const { excludeCommands, excludeMode } = (await getSettings()).selfHealing;
  if (excludeMode === "exact") return excludeCommands.includes(commandName);
  return excludeCommands.some((p) => {
    try { return new RegExp(p).test(commandName); } catch { return p === commandName; }
  });
}

/** 把 locator 优先级顺序变成 target 重试队列（等价于 KR utils.js:55-78） */
export async function getPossibleTargetList(command) {
  const { locator } = (await getSettings()).selfHealing;
  const buckets = locator.flatMap((loc) => {
    const re = new RegExp(`^${loc}=`);                 // ← 加 "=" 锚定，修 §6.2 的前缀误匹配
    return command.targets.filter((t) => re.test(t));
  });
  const rest = command.targets.filter((t) => !buckets.includes(t));
  return [...buckets, ...rest].filter((t) => t !== command.target);
}
```

### 11.3 `setting-panel.js` —— 面板装配（约 70 行）

```html
<!-- setting-panel/index.html（精简后） -->
<div id="main">
  <ul id="menu"></ul>
  <div id="content"></div>
</div>
<footer><button id="save">Save</button><button id="close">Close</button></footer>
<script type="module" src="setting-panel.js"></script>
```

```js
import { getSettings, patchSettings } from "./settings.js";

/** 每个 Tab = { id, name, render(s):string, bind(), collect():object } */
const TABS = [
  {
    id: "selfHealing", name: "Self Healing",
    render: (s) => `
      <h1>Self Healing</h1>
      <label><input type="checkbox" id="sh-enable" ${s.selfHealing.enable ? "checked" : ""}> Enable self-healing</label>
      <h3>Locator priority (drag to reorder)</h3>
      <ul id="sh-locators">${s.selfHealing.locator.map((l) => `<li draggable="true">${l}</li>`).join("")}</ul>
      <h3>Excluded commands (one per line)</h3>
      <textarea id="sh-exclude" rows="6">${s.selfHealing.excludeCommands.join("\n")}</textarea>`,
    bind() {
      const ul = document.getElementById("sh-locators");
      let dragging = null;
      ul.addEventListener("dragstart", (e) => (dragging = e.target));
      ul.addEventListener("dragover", (e) => {
        e.preventDefault();
        const over = e.target.closest("li");
        if (over && over !== dragging) {
          const after = over.getBoundingClientRect().top + over.offsetHeight / 2 < e.clientY;
          ul.insertBefore(dragging, after ? over.nextSibling : over);
        }
      });
    },
    collect: () => ({
      selfHealing: {
        enable: document.getElementById("sh-enable").checked,
        locator: [...document.querySelectorAll("#sh-locators li")].map((li) => li.textContent.trim()),
        excludeCommands: document.getElementById("sh-exclude").value
          .split("\n").map((s) => s.trim()).filter(Boolean),
      },
    }),
  },
  {
    id: "testExecution", name: "Test Execution",
    render: (s) => `
      <h1>On test failure</h1>
      <label><input type="radio" name="onFailure" value="stop"     ${s.testExecution.onFailure === "stop" ? "checked" : ""}> Stop execution</label><br>
      <label><input type="radio" name="onFailure" value="continue" ${s.testExecution.onFailure === "continue" ? "checked" : ""}> Continue execution</label><br>
      <label><input type="checkbox" id="te-hide" ${s.testExecution.hideDialog ? "checked" : ""}> Do not show the dialog</label>`,
    bind() {},
    collect: () => ({
      testExecution: {
        onFailure: document.querySelector('input[name="onFailure"]:checked').value,
        hideDialog: document.getElementById("te-hide").checked,
      },
    }),
  },
];

let dirty = false;
document.addEventListener("input", () => (dirty = true));
window.addEventListener("beforeunload", (e) => { if (dirty) e.preventDefault(); });  // 修 §3.5

const $menu = document.getElementById("menu");
const $content = document.getElementById("content");

function show(id) {
  [...$content.children].forEach((c) => (c.hidden = c.dataset.tab !== id));
  [...$menu.children].forEach((li) => li.classList.toggle("active", li.dataset.tab === id));
}

(async function boot() {
  const s = await getSettings();
  $menu.innerHTML = TABS.map((t) => `<li data-tab="${t.id}">${t.name}</li>`).join("");
  $content.innerHTML = TABS.map((t) => `<section data-tab="${t.id}" hidden>${t.render(s)}</section>`).join("");
  TABS.forEach((t) => t.bind());
  $menu.addEventListener("click", (e) => e.target.dataset.tab && show(e.target.dataset.tab));

  // 一次性跳转标记（等价于 KR 的 testExecutionTab，见 §5.3）
  const { jumpTo } = await chrome.storage.local.get("jumpTo");
  show(jumpTo && TABS.some((t) => t.id === jumpTo) ? jumpTo : TABS[0].id);
  await chrome.storage.local.remove("jumpTo");

  document.getElementById("save").onclick = async () => {
    try {
      for (const t of TABS) await patchSettings(t.collect());
      dirty = false;                                   // ← 成功后才清脏标记（修 §9.8）
      document.getElementById("save").textContent = "Saved ✓";
      setTimeout(() => (document.getElementById("save").textContent = "Save"), 1500);
    } catch (err) {
      alert("Save failed: " + err.message);            // ← 失败要提示
    }
  };
  document.getElementById("close").onclick = () => window.close();
})();
```

### 11.4 与 KR 原实现的差异对照

| 维度 | KR 7.1.0 | MVP |
|---|---|---|
| 菜单树 | jqtree 1342 行 | 原生 `<ul>` + 事件委托，5 行 |
| 接口约束 | `Interface.ensureImplement` 运行时反射，41 行 | 普通对象字面量 `{render, bind, collect}` |
| Tab 数量 | 4（含端口 / 隐私） | 2 |
| 默认值 | 只在整键缺失时写入，无版本 | `__v` + deep-merge，每次 `getSettings` 自动补齐 |
| 读取 | 17 处各自 `storage.local.get`，无缓存 | 单一 `getSettings()` + 内存缓存 + `onChanged` 失效 |
| 写入 | 4 个 Tab 各自 read-modify-write，`set` 未 await | `patchSettings` 统一入口，`await` 落盘 |
| 失败策略 | 两个互斥 boolean，可同时为 false | `onFailure: "stop" \| "continue"` 枚举 |
| 排除命令 | 隐式正则（不合法时退化等值） | `excludeMode` 显式声明 |
| 脏标记 | 只拦 `#close-btn`，Save 前就清 | `beforeunload` + 成功后才清 |
| locator 匹配 | `^id`（前缀，会误匹配） | `^id=`（锚定分隔符） |
| 代码量 | ≈1900 行（含 jqtree） | ≈150 行 |

---

## 12. 复刻检查清单

- [ ] 配置只有**一个** storage 键、**一个**读函数、**一个**写函数（KR 是 3 层存储 + 17 处直读）
- [ ] `DEFAULTS` 常量 + `__v` 版本号 + deep-merge 兜底，**每次读都补齐**（对照 `load-setting-data.js:20-25` 的「只在整键缺失时写」）
- [ ] 数组类配置（`locator`）**整体替换，不 merge**，否则会破坏用户排序
- [ ] 所有 `storage.local.set` **必须 await**（对照 `self-healing-setting-tab.js:206`、`privacy-setting-tab.js:33`、`test-execution-setting-tab.js:50` 三处未 await）
- [ ] 加 `storage.onChanged` 让跨窗口的缓存失效（KR 完全没有）
- [ ] Tab 的 `getContent()`/`render()` **统一同步**，数据填充放 `initialize()`/`bind()`（对照 §9.7）
- [ ] 互斥选项用**枚举字符串**，不要用两个 boolean（对照 §9.5 的「都 false」态）
- [ ] locator 前缀正则要**锚定分隔符** `^${loc}=`（对照 `utils.js:61` 的 `^${locator}`）
- [ ] `excludeCommands` 的匹配语义要**显式声明**（对照 `utils.js:37` 的隐式 `new RegExp`）
- [ ] 所有读 `setting[x].y` 的地方都要有兜底，或统一走 `getSettings()`（对照 `utils.js:8/24/34` 三处裸访问）
- [ ] 设置窗口**单例化**：优先用 `options_page` + `chrome.runtime.openOptionsPage()`（浏览器自带单例语义），别自己维护 `settingWindowID`（对照 §9.6 的两份副本）
- [ ] 脏标记用 `beforeunload`，且**保存成功后**才清（对照 `setting-panel.js:44`）
- [ ] 保存失败要有可见反馈（对照 `setting-panel.js:45-47` 无 `.catch`）
- [ ] 删掉 jqtree / Interface.js / 端口 Tab / options.html，净删约 1600 行
- [ ] 全库搜一遍 `debugger;` 再发版（对照 `privacy-setting-tab.js:29`）
