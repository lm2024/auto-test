# TECH-07 · 设置面板与配置系统

> 本文覆盖 KR 7.1.0 最后一块基础设施：**用户配置从哪里来、存在哪、怎么传到录制器 / 回放引擎 / 埋点**。
> 全部结论带 `文件路径:行号`。附录列 18 条缺陷（S1–S18），每条给出「复刻时怎么做」。
> 只读分析，未修改任何扩展源码。

---

## 0. 一句话结论 + 阅读指引

**KR 的设置系统是「一个真设置页 + 一个僵尸设置页 + 一个死按钮」：`manifest.json:63` 声明的 `options_page` 指向 2018 年遗留的 `katalon/options.html`（只有端口一项），而用户真正看到的设置页 `setting-panel/index.html` 靠 Panel 里 `windows.create({type:"popup"})` 手工开窗（`panel/js/katalon/kar.js:231-259`）；持久化只用 `chrome.storage.local`，核心是单个 `setting` 聚合对象（`panel/js/background/load-setting-data.js:7-18` 写默认值），但**没有任何 `storage.onChanged` 监听 `setting`**——所有消费方靠"每次用时重读 storage"来拿最新值，属于「无广播 + 读放大」模式。**

阅读指引：

| 你想知道 | 看哪节 |
|---|---|
| 设置页怎么被打开、页面怎么起来的 | A |
| 到底有几个设置项、存的什么 key | B |
| 存在哪、默认值谁写的、跨窗口怎么同步 | C |
| 改了一个开关后到底怎么生效的 | D |
| 做纯本地插件时哪些能整块删 | E |
| 布局与样式怎么组织的 | F |
| 有哪些坑 | 附录 S1–S18 |

---

# A. 入口与生命周期

## A.1 文件清单（12 个文件，自有代码 774 行）

`setting-panel/` 目录全量（行数为 `wc -l` 实测）：

| 文件 | 行数 | 职责 |
|---|---:|---|
| `setting-panel/index.html` | 40 | 页面骨架：左树 + 右内容 + 底部 Save/Close；11 个 `<script>` 的加载顺序是硬约束 |
| `setting-panel/js/setting-panel.js` | 110 | 主控制器：实例化 4 个 Tab、接口校验、生成 UI、统一保存、脏标志、首屏 Tab 路由 |
| `setting-panel/js/setting-tabs/ISettingTab.js` | 4 | 鸭子接口声明，要求实现 `display/saveData/getContent/initialize` |
| `setting-panel/js/setting-tabs/KS-port-setting-tab.js` | 53 | Katalon Studio 端口设置 + About 文案（云耦合，可整块删） |
| `setting-panel/js/setting-tabs/self-healing-setting-tab.js` | 216 | 自愈开关 + 定位器优先级拖拽排序 + 排除命令增删（**唯一有实际交互复杂度的 Tab**） |
| `setting-panel/js/setting-tabs/privacy-setting-tab.js` | 43 | 埋点开关（云耦合，可整块删） |
| `setting-panel/js/setting-tabs/test-execution-setting-tab.js` | 60 | 失败时「停止 / 继续」二选一 |
| `setting-panel/js/UI/menu-tree.js` | 47 | 左侧 4 条菜单的数据与点击分发 |
| `setting-panel/js/UI/confirm-close-dialog.js` | 41 | 关闭前「是否保存」jQuery UI 模态框，Promise 化 |
| `setting-panel/js/third-party/tree.jquery.js` | 1342 | jqtree 第三方库，**只为渲染 4 条扁平菜单**（见 S14） |
| `setting-panel/css/setting-panel.css` | 160 | CSS 变量 + 暗色 media query + flex 两栏布局 |
| `setting-panel/css/jqtree.css` | 199 | jqtree 第三方样式 |

自有代码合计 `40+110+4+53+216+43+60+47+41+160 = 774` 行；第三方 `1342+199 = 1541` 行。**第三方占 67%。**

## A.2 三个"入口"，只有一个是真的

### 入口 ①（真）：Panel 工具栏 Settings 按钮

按钮定义 `panel/index.html:263-266`：
```html
<button id="settings" class="sub_btn">
  <em class="fa"></em>
  <span>Settings</span>
</button>
```

处理 `panel/js/katalon/kar.js:231-259`：
```js
$(function () {
  function openPanel() {
    let height = 740;
    let width = 820;
    browser.windows
      .create({
        url: browser.runtime.getURL("setting-panel/index.html"),   // :237
        type: "popup",
        height: height,
        width: width,
        focused: true,
      })
      .then((panel) => (settingWindowID = panel.id));
  }
  $("#settings").on("click", function () {
    if (settingWindowID === undefined) { openPanel(); }
    else {
      browser.windows.update(settingWindowID, { focused: true })
        .catch(function () { settingWindowID = undefined; openPanel(); });
    }
  });
});
```
`settingWindowID` 是模块级变量（`panel/js/katalon/kar.js:229`），窗口复用靠 `windows.update` 失败回退新开——与 TECH-05 里 Panel 主窗口的开窗逻辑是同一套模式。

### 入口 ②（真）：回放失败弹框里的 "go to Settings"

`panel/js/UI/view/dialog/test-execution-dialog.js:100-111`：
```js
function openPanel() {
    browser.storage.local.set({ testExecutionTab: true });   // :101 ← 用 storage 当"函数参数"
    let height = 740;
    let width = 820;
    browser.windows.create({
      url: browser.runtime.getURL("setting-panel/index.html"),  // :105
      type: "popup", height, width, focused: true,
    }).then(window => settingWindowID = window.id);
}
```
它比入口 ① 多做一件事：**先往 `storage.local` 写一个顶级 key `testExecutionTab: true`，用来告诉即将打开的设置页"请默认停在 Test Execution 这一页"**（见 A.4）。这是典型的「用持久化存储传递一次性调用参数」，见 S9。

### 入口 ③（假）：manifest 的 options_page

`manifest.json:63`：
```json
"options_page": "katalon/options.html",
```
指向的是一个 **30 行的 2018 年遗留页面**（`katalon/options.html:1-30`），内容只有 Katalon Studio 端口输入框 + About 文案，逻辑在 `katalon/options.js:1-14`。它与 `setting-panel` 里的 KS Port Tab 是**同一份内容的两个副本**（对比 `katalon/options.html:12-27` 与 `setting-panel/js/setting-tabs/KS-port-setting-tab.js:11-25`，文案逐字相同）。

而唯一调用 `openOptionsPage()` 的地方是 `panel/js/UI/controllers/other-listeners/panel-setting.js:6-8`：
```js
$("#options").click(function() {
    browser.runtime.openOptionsPage();
});
```
**全项目 grep `id="options"` 无任何结果** —— 这个按钮不存在，这段是死代码（S2）。

结论：`options_page` 这条声明的唯一实际效果，是让用户在 `chrome://extensions` 页面点「扩展选项」时看到一个残缺的老页面。

> **未在源码中找到**：`options_ui`、`chrome.runtime.openOptionsPage()` 的有效调用、iframe 内嵌设置页。

## A.3 页面初始化顺序

`setting-panel/index.html:28-36` 的脚本顺序是硬约束：
```html
<script src="../common/browser-polyfill.js"></script>          <!-- 提供 browser.* Promise API -->
<script src="../katalon/constants.js"></script>                <!-- 全局常量 -->
<script src="../katalon/chrome_variables_default.js"></script> <!-- 端口默认值 50000/50001 -->
<script src="../katalon/chrome_variables_init.js"></script>    <!-- 覆盖为 59844 -->
<script src="../katalon/chrome_common.js"></script>            <!-- get/setKatalonServerPort -->
<script type="text/javascript" src="../common/jquery-3.2.1.min.js"></script>
<script type="text/javascript" src="../panel/js/lib/jquery-ui.min.js"></script>
<script type="text/javascript" src="js/third-party/tree.jquery.js"></script>
<script type="module" src="js/setting-panel.js"></script>
```
**注意这里没有加载 `bowser.js`**，但 `chrome_common.js:18` 里用到了 `bowser.name` —— 这是 S3。

启动流程 `setting-panel/js/setting-panel.js:102-108`：
```js
$(document).ready(function () {
  generateUI().then(() => {
    attachButtonEvent();
    initialize().then(displayTab);
  });
});
```

三段的内容：

```
generateUI()                        setting-panel.js:27-33
  ├─ generateMenuTree()             menu-tree.js:22-45   建 jqtree + tree.click 分发
  ├─ append(selfHealing.getContent())    同步模板串
  ├─ append(port.getContent())           同步模板串
  ├─ append(await privacy.getContent())  ★ async：要先读 storage 决定 checkbox 的 checked
  └─ append(await testExecution.getContent())  ★ async：同上（radio）
        │
attachButtonEvent()                 setting-panel.js:42-66  绑 #save-btn / #close-btn
        │
initialize()                        setting-panel.js:68-73
  ├─ port.initialize()              读端口填入 input + 绑 input 事件
  ├─ selfHealing.initialize()       makeTableSortable ×2 + 绑按钮 + renderDataSetting()
  ├─ privacy.initialize()           只绑 click → setIsChange(true)
  └─ testExecution.initialize()     只绑 click → setIsChange(true)
        │
displayTab()                        setting-panel.js:82-100  读 testExecutionTab 决定首屏
```

**两种渲染风格并存**：`privacy`/`testExecution` 把「读 storage → 决定 checked」放在 `getContent()`（`privacy-setting-tab.js:15-16`、`test-execution-setting-tab.js:19-24`），而 `selfHealing` 把它放在 `initialize()` 的 `renderDataSetting()`（`self-healing-setting-tab.js:66-72`）。同一个页面两套约定，复刻时应统一。

## A.4 首屏 Tab 路由

`setting-panel/js/setting-panel.js:82-100`：
```js
async function displayTab() {
  let tabId = await browser.storage.local.get("testExecutionTab");
  console.log("Panel: ", tabId.testExecutionTab);         // :84 生产代码里的调试日志
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
  browser.storage.local.set({ testExecutionTab: false });  // :99 读完立刻复位
}
```
注意 `setting-panel.js:75-80` 还留着一个**从未被调用**的 `displayFirstTab()`，是 `displayTab()` 的前身。

Tab 切换本身没有路由，就是 `display()` 里「遍历容器所有子节点 hide，再 show 自己」，四个 Tab 各写了一遍一模一样的 4 行（`self-healing-setting-tab.js:209-214`、`KS-port-setting-tab.js:39-44`、`privacy-setting-tab.js:36-41`、`test-execution-setting-tab.js:53-58`）。

## A.5 保存与关闭

`setting-panel/js/setting-panel.js:35-66`：
```js
async function saveData() {
  portSettingTab.saveData();              // :36 ← 同步方法，未 await（它写的是另一个 key）
  await selfHealingSettingTab.saveData(); // :37
  await privacySettingTab.saveData();     // :38
  await testExecutionTab.saveData();      // :39
}

$("#save-btn").click(function () {
  setIsChange(false);
  saveData().then(() => { alert("Save successfully"); });   // :46 原生 alert
});

$("#close-btn").click(function () {
  if (!isChange) { window.close(); return; }
  displayConfirmCloseDialog().then(async (result) => {      // :55
    switch (result) {
      case "yes": await saveData(); window.close(); break;
      case "no":  window.close();
    }
  });
});
```
`isChange` 脏标志由各 Tab 通过循环 import 回来的 `setIsChange` 置位（`setting-panel.js:23-25,110`），四个 Tab 各自 `import { setIsChange } from "../setting-panel.js"`（`self-healing-setting-tab.js:1`、`KS-port-setting-tab.js:1`、`privacy-setting-tab.js:1`、`test-execution-setting-tab.js:1`），而 `setting-panel.js` 又 import 这四个模块——**循环依赖**（S16）。

`displayConfirmCloseDialog()`（`confirm-close-dialog.js:7-40`）用 jQuery UI dialog 包了个 Promise，三个按钮 Yes/No/Cancel，其中 **Cancel 分支不 resolve**（`:26-28`），Promise 永久 pending。这里没造成泄漏是因为对话框已被 `close` 回调 remove（`:31-33`），但 `saveData` 链路上挂的 `.then` 永远不会执行——语义上是对的（取消就是什么都不做），实现上是个悬挂 Promise。

---

# B. 设置项全清单

真正暴露给用户的设置项只有 **7 个**（其中 1 个藏在回放弹框里）。

| # | 分组 | 显示名 | 控件 | storage key（`storage.local`） | 默认值 | 影响面 | 源码行号 |
|---|---|---|---|---|---|---|---|
| 1 | Katalon Studio Port | Katalon Studio Server Port | `input[type=text]#KS-port` | **顶级 key** `katalonServerPortStorage` | `"59844"`（Chrome，来自 `chrome_variables_init.js:1`）；无该文件时 `"50000"` | Object Spy 与 KS 桌面端的 WebSocket 地址 | UI `KS-port-setting-tab.js:15`；读 `:31-33`；写 `:47`；读写实现 `katalon/chrome_common.js:1-25`；默认 `katalon/chrome_variables_default.js:3-4`、`chrome_variables_init.js:1` |
| 2 | Self Healing | Enable self-healing execution | `input[type=checkbox]#enable-self-healing` | `setting["self-healing"].enable` | `true` | 回放失败时是否走自愈重试 | UI `self-healing-setting-tab.js:162`；渲染 `:39-42`；保存 `:195`；默认 `panel/js/background/load-setting-data.js:11`；消费 `panel/js/UI/services/self-healing-service/utils.js:17-25` |
| 3 | Self Healing | 定位器优先级（可拖拽 + Move up/down） | 可排序 `<table>#locatorList` | `setting["self-healing"].locator` | `["id","xpath","css"]` | 自愈候选定位器的重试顺序 | UI `self-healing-setting-tab.js:171-177`；渲染 `:44-53`；排序 `:3-27,79-98`；保存 `:196`；默认 `load-setting-data.js:12`；消费 `utils.js:1-9,55-78` |
| 4 | Self Healing | 排除命令（Add / Remove） | 可编辑 `<table>#excludeCommandList` | `setting["self-healing"].excludeCommands` | `["verifyElementPresent","verifyElementNotPresent","assertElementPresent","assertElementNotPresent"]` | 这些命令失败时不触发自愈 | UI `self-healing-setting-tab.js:184-190`；渲染 `:55-64`；增删 `:99-134`；保存 `:197`；默认 `load-setting-data.js:13`；消费 `utils.js:27-48`（**正则匹配**） |
| 5 | Privacy | Enable tracking | `input[type=checkbox]#enable-tracking` | `setting.tracking` | **`true`（默认开启埋点）** | Segment / HubSpot 上报开关 | UI `privacy-setting-tab.js:21`；渲染 `:15-16`；保存 `:30-33`；默认 `load-setting-data.js:15`；消费 `panel/js/UI/services/tracking-service/segment-tracking-service.js:48-52`、`hubspot-tracking-service.js:30-31`、`background/segment-tracking-services.js:14-18` |
| 6 | Test Execution | Stop test execution | `input[type=radio]#stop-execution` | `setting.testExecution.stopExecution` | **未定义**（默认值对象里没有 `testExecution`） | 与 #7 组成"失败后行为" | UI `test-execution-setting-tab.js:31`；渲染 `:23`；保存 `:41,46`；也被弹框直接写 `panel/js/UI/view/dialog/test-execution-dialog.js:131-138` |
| 7 | Test Execution | Continue test execution | `input[type=radio]#continue-execution` | `setting.testExecution.continueExecution` | **未定义**，消费侧 `?? true` 兜底 | 回放遇失败是暂停还是继续 | UI `test-execution-setting-tab.js:33`；渲染 `:24`；保存 `:42,47`；消费 `panel/js/background/playback/service/actions/play/play-actions.js:1551` |
| 8 | （无设置页 UI，只在弹框内） | Do not show this message again | `input[type=checkbox]#hide-execution-dialog` | `setting.testExecution.hideExecutionDialog` | 未定义 → falsy | 是否再弹「继续执行？」对话框 | UI `test-execution-dialog.js:31`；保存 `:149-153`；消费 `play-actions.js:1535` |

另有 1 个**非设置的路由标志**：

| key | 类型 | 写 | 读 + 复位 |
|---|---|---|---|
| `testExecutionTab` | boolean | `test-execution-dialog.js:101` | `setting-panel.js:83,99` |

## B.1 用户问到但**源码中不存在**的设置项

| 期望的设置项 | 结论 |
|---|---|
| 截图开关 | **未在源码中找到**设置项。`panel/index.html:639` 的 `#screenshot` 是日志区的一个 Tab，不是开关 |
| Timeout / 超时时间 | **未在源码中找到**用户可配置项。回放侧的重试上限是硬编码 `retryUntilSuccess(fn, 60, 500)`（见 TECH-05） |
| 语言 / i18n | **未在源码中找到**。项目根目录**没有 `_locales`**，全英文硬编码 |
| 主题（亮/暗） | **无用户开关**，只跟随系统：`setting-panel/css/setting-panel.css:30` `@media (prefers-color-scheme: dark)`；Panel 侧同样模式 `panel/css/kar.css:122,178` |
| 快捷键自定义 | **未在源码中找到**。快捷键在 `panel/js/UI/controllers/**/hotkeys-*.js` 里硬编码，manifest 也没有 `commands` 段 |
| 录制时是否记录 mouseover | **未在源码中找到**开关。`mouseover` 只作为右键菜单项存在（`katalon/constants.js:42-43`） |
| 账号登录 | 不在设置页，在 Panel 顶栏：`panel/js/UI/controllers/top-toolbar/actions.js:106-144` |
| TestOps 集成 | **未在设置页找到**任何 TestOps 配置项 |
| 回放速度 | `panel/js/UI/controllers/other-listeners/panel-setting.js:41-48` 的 jQuery UI slider，`value: 0` 写死，**未持久化** |

---

# C. 持久化与跨上下文同步机制

## C.1 存储介质：只有 `chrome.storage.local`

- **没有 `chrome.storage.sync`**：全项目 grep `storage.sync` 无业务调用（只在 `browser-polyfill` 的 API 元数据表里出现）。
- **没有 `localStorage`**：`panel/` 目录 grep `localStorage.getItem|setItem` 无结果。
- manifest 同时申请了 `storage` 与 `unlimitedStorage`（`manifest.json:64`）。

## C.2 两套 API 混用

| 用法 | API 风格 | 位置 |
|---|---|---|
| 设置页四个 Tab | `browser.storage.local.get/set` → Promise | `self-healing-setting-tab.js:67,203,206`、`privacy-setting-tab.js:15,31,33`、`test-execution-setting-tab.js:19,43,50` |
| KS 端口 | `chrome.storage.local.get/set` → callback | `katalon/chrome_common.js:4-11,15-24` |

同一个页面里两种 API 风格并存，原因是 `chrome_common.js` 是从 Object Spy 老代码直接复用的（文件头注释 `chrome_variables_default.js:1-2` 明说「for Object spy chrome extensions」）。

## C.3 Key 命名：一个聚合对象 + 16 个散落顶级 key

实测（对 `panel/ background/ content-marketing/ katalon/ common/ pages/ setting-panel/ playback/` 做 `storage.local.set({key` 统计）共 17 个顶级 key：

```
setting(8次)  playbackTracking(5)  onBoardingUserChoice(5)  firstTime(4)
leftSidePanelTracking(3)  doUserManual(3)  tutorialStates(2)  testExecutionTab(2)
popupTracking(2)  usage(1)  tutorialsCompleted(1)  segment(1)  refreshToken(1)
profileData(1)  katalonServerPortStorage(1)  finnishOnboarding(1)  addSample(1)
```

**没有任何命名前缀约定**：`setting` 是聚合对象，`katalonServerPortStorage` 是"也算设置但没进聚合对象"的孤儿，其余是运行时状态/营销标志。

`setting` 内部结构（由默认值决定，`panel/js/background/load-setting-data.js:7-18`）：
```js
browser.storage.local.set({
    setting: {
        "self-healing": {                                   // :10  ← 连字符 key，只能用 ["..."] 访问
            enable: true,                                   // :11
            locator: ["id", "xpath", "css"],                // :12
            excludeCommands: ["verifyElementPresent", "verifyElementNotPresent",
                              "assertElementPresent", "assertElementNotPresent"],  // :13
        },
        "tracking": true,                                   // :15
    }
});
```
**注意 `testExecution` 不在默认值里** —— 它是后来加的功能，只在用户第一次操作时才被创建（`test-execution-setting-tab.js:49-50` 或 `test-execution-dialog.js:134-135`）。这是 S7 的直接证据。

## C.4 默认值写入时机

`panel/js/background/load-setting-data.js:20-27`：
```js
const loadSettingData = async () => {
    let settingData = await browser.storage.local.get("setting");
    if (isObjectEmpty(settingData)){      // :22  ← 只判断"整个结果对象是否为空"
        await setDefaultSettingData();
    }
}
export {loadSettingData}
loadSettingData();                        // :29  模块加载即执行
```
`isObjectEmpty`（`:1-5`）判断的是 `storage.local.get("setting")` 的**返回包裹对象**：key 不存在时返回 `{}` → true → 写默认值；key 存在时返回 `{setting: {...}}` → keys 长度 1 → false → **一个字段都不补**。

两个触发点：
- `panel/index.html:1001` —— `<script type="module" src="js/background/load-setting-data.js">`，Panel 每次打开都跑一次；
- `playback/index.js:35-37` —— 无头回放模式里显式 `await loadSettingData.loadSettingData()`。

## C.5 跨上下文同步：**没有广播**

全项目 `storage.onChanged` 只有 10 处：

| 位置 | 监听的 key |
|---|---|
| `panel/js/UI/controllers/top-toolbar/actions.js:116-128` | `checkLoginData`（登录态） |
| `panel/js/UI/controllers/onboarding/contextual-onboarding-listener.js:113` | 新手引导 |
| `content-marketing/panel/self-healing-rating.js:77,83` | 营销弹窗 |
| `content-marketing/panel/popup-what-are-you-automating.js:90,97` | 营销弹窗 |
| `content-marketing/panel/popup-sample-data.js:74,82` | 营销弹窗 |
| `content-marketing/panel/popup-rate-us.js:190` | 营销弹窗 |
| `content-marketing/panel/popup-chrome-store.js:103` | 营销弹窗 |

**没有一处监听 `setting`。** 设置页保存后不发任何消息、不触发任何广播。

那为什么改了设置还能生效？因为**所有消费方都是「用的时候现读」**：

```js
// panel/js/UI/services/self-healing-service/utils.js
const getSelfHealingSettingLocatorsList = async () => {
  let settingData = await browser.storage.local.get("setting");   // :2
  ...
}
const isSelfHealingEnable = async () => {
  let settingData = await browser.storage.local.get("setting");   // :18
  ...
}
const isCommandExcluded = async (commandName) => {
  let settingData = await browser.storage.local.get("setting");   // :28
  ...
}
```
**一次自愈判定就要打 3 次独立的 `storage.local.get("setting")`**（`utils.js:2,18,28`），而回放的每条命令失败都会走一遍。这是「用读放大换掉广播机制」的典型反模式（S8）。

好处是简单且天然跨上下文一致（Panel、回放引擎、Service Worker 读的都是同一份 storage）；代价是没有缓存、没有类型、没有变更钩子，且**同一个逻辑判定内部的三次读之间理论上可以被并发写打断**。

---

# D. 设置 → 运行时的传导链路

## D.1 链路一：Self-healing 开关 → 回放引擎

```
用户在设置页勾掉 "Enable self-healing execution"
  │  self-healing-setting-tab.js:162  <input id="enable-self-healing">
  ▼
点击 Save → setting-panel.js:43-48 → saveData()
  │  setting-panel.js:37  await selfHealingSettingTab.saveData()
  ▼
self-healing-setting-tab.js:194-207
  ├─ :195  enable = $("#enable-self-healing").prop("checked")
  ├─ :196  locator = getElementList("locatorList")           ← 读 DOM 顺序
  ├─ :197  excludeCommands = getElementList("excludeCommandList")
  ├─ :203  settingData = await storage.local.get("setting")
  ├─ :205  Object.assign(settingData["self-healing"], self_healing)   ★ 注意：漏了 .setting（S5）
  └─ :206  browser.storage.local.set({ setting: settingData })        ★ 未 await（S4）
  ▼
（无广播，无消息）
  ▼
下一次回放命令失败时：
play-actions.js 自愈分支
  ├─ await isSelfHealingEnable()      utils.js:17-25  → 现读 storage
  ├─ await isCommandExcluded(cmd)     utils.js:27-48  → 现读 storage
  └─ await getPossibleTargetList()    utils.js:55-78  → 现读 storage（第 3 次）
  ▼
按 setting["self-healing"].locator 顺序排出候选队列 → 逐个重试
```

**关键点**：设置变更**不需要**重启 Panel，因为回放引擎是在每条失败命令上现读；但也**不会**通知任何已渲染的 UI。

## D.2 链路二：Privacy tracking → 埋点上报

```
用户在设置页勾掉 "Enable tracking"
  │  privacy-setting-tab.js:21
  ▼
Save → privacy-setting-tab.js:28-34
  ├─ :29   debugger;                  ★ 生产代码里的断点（S6）
  ├─ :30   enable = $("#enable-tracking").prop("checked")
  ├─ :31   settingData = await storage.local.get("setting")
  ├─ :32   settingData.setting.tracking = enable
  └─ :33   browser.storage.local.set({ setting: settingData.setting })   ← 未 await
  ▼
（无广播）
  ▼
任意埋点发生时，三个消费方各自现读：
  ├─ Panel 侧  segment-tracking-service.js:48-52
  │      if (settingData.setting.tracking || data.event === "kru_install_application")
  ├─ Panel 侧  hubspot-tracking-service.js:30-31
  │      if (settingData.setting.tracking) { fetch(...) }
  └─ SW  侧   background/segment-tracking-services.js:14-18
         if (data.event === "kru_install_application" || settingData.setting.tracking)
  ▼
POST ${manifest.segment_url}/segment-kr/tracking       ← manifest.json:68
POST ${manifest.homepage_url}wp-json/.../hubspot/...   ← manifest.json:51,53
```

**这条链路上有一个隐私缺陷**：`kru_install_application` 事件**用 `||` 绕过了开关**（`background/segment-tracking-services.js:16-18`、`segment-tracking-service.js:50-51`），即无论用户是否同意，安装事件必上报。而且默认值就是 `tracking: true`（`load-setting-data.js:15`），是 opt-out 而非 opt-in。见 S10。

另外，`tracking` 还有第二个写入方（不经设置页）：新手引导弹框的 Yes/No 按钮 `panel/js/UI/view/dialog/onboarding-dialog.js:109-119` 直接改 `settingData.setting.tracking`。

## D.3 链路三：Test Execution → 回放暂停/继续（**双向**）

这条链路特殊：**设置页和回放弹框互相写同一组 key**。

```
                    setting.testExecution
                    ┌────────────────────┐
   设置页写 ────────►│ stopExecution      │◄──────── 弹框写
   test-execution-  │ continueExecution  │   test-execution-dialog.js
   setting-tab.js   │ hideExecutionDialog│   :131-138 / :140-147 / :149-153
   :40-51           └─────────┬──────────┘
                              │ 现读
                              ▼
        play-actions.js:1530-1552  executionDialog()
          ├─ :1531  settingData = await storage.local.get("setting")
          ├─ :1535  if (!testExecution?.hideExecutionDialog) → 弹框
          │            :1544  browser.windows.update(extensionId,{focused:true})
          │            :1546  await testExecutionDialog(...)
          └─ :1551  return testExecution.continueExecution ?? true
                    ★ 「无配置时默认继续」，与代码上方注释
                      "By default, if no configuration exists, pause execution"（:1549-1550）自相矛盾
```

`stopExecution` 与 `continueExecution` 是**两个独立布尔**（`test-execution-setting-tab.js:46-47`），不是一个枚举，因此完全可以同时为 `true` 或同时为 `false`；而消费侧只看 `continueExecution`（`play-actions.js:1551`），`stopExecution` 在回放逻辑里**从未被读取**——它只用于设置页回显自己（`test-execution-setting-tab.js:23`）。见 S11。

## D.4 链路四：KS Port → WebSocket（云/桌面端耦合）

```
设置页 input#KS-port
  │  KS-port-setting-tab.js:47  setKatalonServerPort($('#KS-port').val())
  ▼
katalon/chrome_common.js:3-12   chrome.storage.local.set({ katalonServerPortStorage: port })
  ▼
katalon/background.js:210-215   （Service Worker 内）
     getKatalonServerPort(function (port) {
         var socketUrl = "ws://localhost:" + port + "/";
         new WebSocket(socketUrl);   ← 连接 Katalon Studio 桌面端
     })
```
读取侧还有 `katalon/chrome_setup.js:6` 与 `bundles/content.1.bundle.js:35815`（`getKatalonServerPort(initKatalonServerUrl)`）。

---

# E. 云服务耦合面（可整块删除的部分）

做纯本地个人插件时，下表左列可以**整块物理删除**：

| 可删对象 | 涉及文件 / 行号 | 删除后的连带动作 |
|---|---|---|
| **Privacy Tab（埋点开关）** | `setting-panel/js/setting-tabs/privacy-setting-tab.js`（全 43 行）；`setting-panel.js:7,13,18,31,38,71,111`；`menu-tree.js:12-15,36-38` | 同时删 `setting.tracking` 字段（`load-setting-data.js:15`） |
| **埋点消费方** | `panel/js/UI/services/tracking-service/segment-tracking-service.js`、`hubspot-tracking-service.js`、`background/segment-tracking-services.js`、`common/offscreen*.js` | 删 manifest 的 `segment_url`(`manifest.json:68`)、`hubspot_url`(`:53`)、`homepage_url`(`:51`)、`offscreen` 权限(`:64`)、`cookies` 权限(`:64`，仅 `trackingInstallApp` 用，`background/segment-tracking-services.js:61-63`) |
| **KS Port Tab** | `setting-panel/js/setting-tabs/KS-port-setting-tab.js`（全 53 行）；`setting-panel.js:1,12,16,30,36,69,111`；`menu-tree.js:4-7,30-32` | 连带删 `katalon/chrome_common.js`、`chrome_variables_default.js`、`chrome_variables_init.js`、`katalon/constants.js` 的 SERVER 段（`:1-7`）、`katalon/background.js` 的 WebSocket 段（`:203-230`）、`katalon/chrome_setup.js` |
| **僵尸 options 页** | `katalon/options.html`（30 行）、`katalon/options.js`（14 行）、`manifest.json:63` 的 `options_page` | 若仍想保留 `chrome://extensions` 的「扩展选项」入口，把 `options_page` 改指向 `setting-panel/index.html` |
| **死按钮监听** | `panel/js/UI/controllers/other-listeners/panel-setting.js:6-8` | 直接删掉这 3 行 |
| **硬编码外链** | `KS-port-setting-tab.js:12`（`https://www.katalon.com/`）、`:21-23`（About 文案 + `mailto:info@katalon.com`）、`:25`（`https://docs.katalon.com/x/pwHR`）、`:18`（图片 `port-setting.png`） | 随 KS Port Tab 一起删 |
| **新手引导对 tracking 的写入** | `panel/js/UI/view/dialog/onboarding-dialog.js:109-119` | 随 onboarding 整块删 |

删完之后，设置页**只剩 2 组、5 个设置项**（自愈 3 项 + 失败行为 2 项），加上弹框里的 `hideExecutionDialog`。这也正好说明：**个人插件的设置系统本来就该很小**，原版 774 行自有代码里有约 100 行是纯云耦合。

---

# F. UI 结构与样式组织

## F.1 布局形态：左侧树 + 右侧内容 + 固定底栏

`setting-panel/index.html:14-26`：
```html
<div id="main-section">
    <div id="scroll-container">
        <div id="menu-tree-view"></div>     <!-- 左：jqtree 渲染 -->
    </div>
    <div id="content"></div>                <!-- 右：4 个 Tab 的 div 全部塞在这里 -->
</div>
<div id="footer">
    <div style="float: right">
        <button id="save-btn" class="ui-button">Save</button>
        <button id="close-btn" class="ui-button">Close</button>
    </div>
</div>
```

对应 CSS（`setting-panel/css/setting-panel.css:76-125`）：
```css
#main-section{ display: flex; height: 95%; }
#scroll-container { overflow-y: scroll; display: flex; height: 100%; width: 20%; }
#content{ margin-left: 5px; width: 80%; overflow-y: auto; padding: 10px; }
#footer{ position: absolute; height: 5%; width: calc(100% - 10px); bottom: 2px; }
```
**不是标签页，是"全部渲染 + display 切换"**：4 个 Tab 的 DOM 在 `generateUI()` 时一次性全部 append 进 `#content`（`setting-panel.js:29-32`），初始都带 `style="display: none"`（各 `getContent()` 的根 div），切换时靠 `display()` 方法逐个 hide 再 show 目标。

## F.2 主题：CSS 变量 + 系统暗色，与 Panel 共用一套变量名

`setting-panel/css/setting-panel.css:1-59` 定义了 28 个 CSS 变量并在 `@media (prefers-color-scheme: dark)`（`:30`）里整体覆写。变量名（`--main-bg-color`、`--header-bg`、`--selected-bg-color`、`--ui-button-bg-color` 等）与 `panel/css/kar.css:122,178` 是同一套，但**两份文件各自复制了一遍定义**，没有抽公共文件。

设置页还直接引用了 Panel 的 4 个样式表（`setting-panel/index.html:7-10`）：
```html
<link rel="stylesheet" href="../panel/css/font-awesome.min.css">
<link rel="stylesheet" href="../panel/css/jquery-ui.min.css">
<link rel="stylesheet" href="../panel/css/layout.css">
<link rel="stylesheet" href="../panel/css/kar.css">
```
即设置页样式**强耦合到 `panel/` 目录**，裁剪 Panel 样式时要同步验证设置页。

## F.3 可复用模式（值得抄的）

| 模式 | 位置 | 评价 |
|---|---|---|
| `ISettingTab` 鸭子接口 + 运行时校验 | `ISettingTab.js:3`、`setting-panel.js:16-19`、`interface/Interface.js:17-34` | **值得抄**。JS 没有 interface，用一个 4 行的声明 + `ensureImplement` 在启动时 fail-fast，比等到点击时报错好。Java 背景的人会很熟悉 |
| Tab 自带 `getContent()` 模板串 | 各 Tab | 中性。好处是 Tab 自洽可拆；坏处是 HTML 写在 JS 里无高亮、无 XSS 防护（`self-healing-setting-tab.js:122` 直接把用户输入拼进模板） |
| Promise 化的确认对话框 | `confirm-close-dialog.js:37-39` | **值得抄**，但要修 Cancel 分支不 resolve 的问题 |
| 拖拽排序表格 | `self-healing-setting-tab.js:3-27` | 可抄。jQuery UI sortable + clone helper 保持列宽 |
| 「读 storage → 决定 checked」放在 `getContent()` | `privacy-setting-tab.js:14-16` | **不要抄**。渲染与数据加载混在一起，且与 selfHealing 的做法不一致 |

---

# 附录 · 缺陷清单（S1–S18）

| 编号 | 现象 | 位置 | 影响 | 复刻时怎么做 |
|---|---|---|---|---|
| **S1** | 存在两个设置页：`options_page` 指向 2018 年遗留的端口页，用户实际看到的是另一个 | `manifest.json:63` vs `panel/js/katalon/kar.js:237` | 从 `chrome://extensions` 点「扩展选项」进去只有端口一项，用户困惑；两份 About 文案逐字重复（`katalon/options.html:12-27` ≡ `KS-port-setting-tab.js:11-25`） | 只保留一个设置页，`options_page` 直接指向它；这样图标右键、扩展管理页、Panel 按钮三个入口归一 |
| **S2** | `$("#options").click(...)` 绑定一个不存在的元素 | `panel/js/UI/controllers/other-listeners/panel-setting.js:6-8`（全项目无 `id="options"`） | 死代码，误导后来者以为设置页是走 `openOptionsPage()` 的 | 删；或者把 Panel 的 Settings 按钮真正改成 `openOptionsPage()` |
| **S3** | 设置页未加载 `bowser.js`，但依赖它的 `chrome_common.js` 用了 `bowser.name` | 缺失：`setting-panel/index.html:28-36`；使用：`katalon/chrome_common.js:18`；同样问题 `katalon/options.html:4-8` | **首次打开设置页且 `katalonServerPortStorage` 不存在时抛 `ReferenceError: bowser is not defined`**，端口输入框空白且 `initialize()` 后续中断 | 端口这类"默认值需要判断环境"的逻辑不要依赖全局脚本；改成纯函数 + 显式 import；本模块建议直接删（见 E） |
| **S4** | 保存竞态 / 丢更新：`storage.local.set` 未 await | `self-healing-setting-tab.js:206`、`test-execution-setting-tab.js:50`、`privacy-setting-tab.js:33` 均无 `await`；调用方 `setting-panel.js:36-39` 以为自己在串行 | 前一个 Tab 的写还没落盘，后一个 Tab 就 `get("setting")` 读到旧值，再整体 `set` 回去 → **前一个 Tab 的改动被静默覆盖**。四个 Tab 各自做「读-改-写」是根因 | **一次点击只做一次读、一次写**：主控制器读出整个 `Settings`，让每个 Tab 只负责 `collect(): Partial<Settings>`，合并后统一 `await set()` |
| **S5** | 空值路径未防御 | `self-healing-setting-tab.js:205` `Object.assign(settingData["self-healing"], ...)` —— 少了 `.setting`，实际是给包裹对象加属性；`privacy-setting-tab.js:16,32` `settingData.setting.tracking` 在 `setting` 缺失时 `TypeError` | 存储被清空 / 首次安装竞态时设置页整页崩，且崩在 Save 之后（用户以为存了） | 读写统一走一个 `loadSettings()`，内部 `deepMerge(DEFAULT_SETTINGS, raw)`，保证调用方拿到的永远是完整对象 |
| **S6** | 生产代码里残留 `debugger;` | `privacy-setting-tab.js:29` | 用户开着 DevTools 点 Save 时，浏览器直接断在这里 | 上线前 lint 规则 `no-debugger` |
| **S7** | 默认值只在 `setting` 整体缺失时写入，无版本号、无字段级补齐 | `load-setting-data.js:20-25`（`isObjectEmpty` 判的是包裹对象）；反例：`testExecution` 从未出现在默认值 `:7-18` 里 | **老用户升级后新增字段永远是 `undefined`**，只能靠每个消费点写 `?? 默认值`（如 `play-actions.js:1551`、`test-execution-setting-tab.js:20-24` 满屏 `?? {}`） | `Settings` 加 `schemaVersion`，启动时 `migrate(raw)` 逐版本升级 + `deepMerge` 补齐缺失字段，然后写回 |
| **S8** | 无 `storage.onChanged` 广播，靠"每次用时现读"，且读放大 | 全项目 `onChanged` 10 处无一监听 `setting`；`utils.js:2,18,28` 一次自愈判定读 3 次 | 已渲染的 UI 不会响应设置变更；回放热路径上每条失败命令产生 3 次异步 storage 读 | 单一 `settings.js` 模块：进程内缓存 + `storage.onChanged` 单向广播刷新缓存 + 同步 getter。见 PRD-07 §7.2 |
| **S9** | 用 storage 顶级 key 当"跨窗口函数参数"，读完立刻复位 | 写 `test-execution-dialog.js:101`；读+复位 `setting-panel.js:83,99` | 竞态（两个入口同时开设置页时标志被抢）；脏 key 常驻 storage；`setting-panel.js:84` 还留着 `console.log` | 用 URL query 传：`getURL("settings.html?tab=execution")`，页面侧 `new URLSearchParams(location.search)` |
| **S10** | 埋点默认开启，且安装事件绕过开关 | 默认 `load-setting-data.js:15` `tracking: true`；绕过 `background/segment-tracking-services.js:16-18`、`segment-tracking-service.js:50-51` 的 `data.event === "kru_install_application" \|\|` | opt-out 而非 opt-in；关掉开关仍会上报一次安装事件（含 `kr_campaign_source` cookie，`segment-tracking-services.js:61-64`） | 个人插件整块删除埋点（见 E）；若保留，必须 opt-in 且无任何 `\|\|` 旁路 |
| **S11** | 互斥选项用两个独立布尔表示，且其中一个从未被消费 | `test-execution-setting-tab.js:46-47` 存 `stopExecution` / `continueExecution`；回放侧只读 `continueExecution`（`play-actions.js:1551`） | 可出现 `{stop:true, continue:true}` 的非法状态；`stopExecution` 只用于回显自己，是冗余字段 | 用枚举 `onFailure: 'pause' \| 'continue'` 单字段表示 |
| **S12** | 排除命令用未锚定的正则匹配命令名 | `utils.js:37-39` `new RegExp(command)` + `regExp.exec(commandName)` | 用户填 `click` 会同时排除 `clickAndWait`、`doubleClick`、`clickAt`；填 `.` 排除全部命令 | 默认按**精确字符串**匹配；确需正则时要求用户显式加 `/.../ ` 包裹，并在 UI 上标注 |
| **S13** | 排除命令的增删 UI 脆弱 | 只监听 Enter 键（`self-healing-setting-tab.js:113-133`），点击别处则输入丢失且 `#temp-row` 残留；保存时用 `element.innerText` 回读（`:137-143`），模板里的换行缩进（`:119-125`）会带进值里；无去重、无空值校验；用户输入直接拼进 HTML 模板（`:122`） | 存进去的 `excludeCommands` 可能带空白字符导致正则不匹配；理论上可注入 HTML | 用受控数据数组做 single source of truth，DOM 只是投影；保存时从数组取值不从 DOM 取；渲染用 `textContent` 不用模板串 |
| **S14** | 引入 1342 行第三方库只为渲染 4 条扁平菜单 | `setting-panel/js/third-party/tree.jquery.js`（1342 行）+ `css/jqtree.css`（199 行）；数据 `menu-tree.js:3-20` 只有 4 个无子节点的项 | 第三方代码占设置模块总量的 67%；`tree('getNodeById')` / `tree('selectNode')` 的 API 依赖（`setting-panel.js:77-78,88-95`）让首屏路由也绑死在这个库上 | 一个 `<ul>` + 十几行 CSS + 一个 `click` 委托即可，顺便去掉 jqtree 与 jQuery UI 依赖 |
| **S15** | 死代码：`displayFirstTab()` 从未被调用 | `setting-panel.js:75-80` | 与 `displayTab()`（`:82-100`）重复，维护者会误改错的那个 | 删 |
| **S16** | 循环依赖 | `setting-panel.js:1-8` import 四个 Tab + `menu-tree.js`；这五个模块又都 `import ... from "../setting-panel.js"`（`self-healing-setting-tab.js:1`、`KS-port-setting-tab.js:1`、`privacy-setting-tab.js:1`、`test-execution-setting-tab.js:1`、`menu-tree.js:1`） | 靠"被导入的绑定只在运行时（事件回调里）才使用"侥幸成立；一旦有人在 Tab 模块顶层使用 `setIsChange` 就会踩 TDZ | 脏标志、Tab 注册表抽成独立模块（如 `store.js`），让依赖变成单向：`setting-panel.js → tabs → store` |
| **S17** | 图片相对路径多了一层 `../`，靠浏览器把越界路径 clamp 到根目录才碰巧能显示 | `KS-port-setting-tab.js:18` `src="../../../katalon/images/port-setting.png"`，而模板是注入到 `setting-panel/index.html` 里解析的（只需 `../`） | 路径明显是从 `js/setting-tabs/` 层级复制过来没改；换成打包/自定义 base 就会 404 | 扩展内资源一律 `browser.runtime.getURL("...")`，不用相对路径 |
| **S18** | 设置页样式强耦合 Panel 目录，且 CSS 变量两处重复定义 | `setting-panel/index.html:7-10` 引 `../panel/css/{font-awesome,jquery-ui,layout,kar}.css`；变量在 `setting-panel.css:1-59` 与 `panel/css/kar.css:122,178` 各定义一份 | 改 Panel 主题会连带影响设置页；两份变量表容易漂移 | 抽 `common/theme.css` 单一来源，设置页与 Panel 都只引这一份 |

---

## 复刻建议（一句话版）

**把 `setting` 从「4 个 Tab 各自读-改-写的散装对象」改成「单一 `Settings` 类型 + 单 key + 一个 `settings.js` 模块（load / save / subscribe / migrate）」**，Tab 只负责 `render(settings)` 和 `collect(): Partial<Settings>`，主控制器负责唯一一次读写；跨上下文用 `storage.onChanged` 单向广播刷新进程内缓存，消费方用同步 getter。这样 S4/S5/S7/S8/S11 五个缺陷一次性消失。

---

*文档完。所有结论均可在 `7.1.0_0` 按 `路径:行号` 核对。产品侧范围见 `_distill/prd/PRD-07-设置面板.md`，提示词见 `_distill/prompts/PROMPT-07-设置面板.md`。*
