# TECH-02 · 元素定位器生成 + Self-Healing 自愈模块（技术蒸馏）

> 适用对象：想把 Katalon Recorder 7.1.0（MV3）逆向裁剪为个人录制回放插件的工程师。
> 文档纪律：所有结论均来自只读源码目录，引用格式为 `文件路径:行号`，并附片段。找不到的事实会显式标注「未在源码中找到」。

---

## 1. 一句话概括

Katalon Recorder 的「灵魂」是**定位器（Locator）**：录制时由生成器把手点元素变成一串可回放的字符串（如 `id=foo`、`xpath=...`）；回放时再把这些字符串还原成 DOM 元素。当首选定位器在页面改版后失效时，**Self-Healing（自愈）** 模块按设置里配置的有序优先级，从同一元素曾经生成过的「候选定位器列表」里逐个尝试替换，命中后用新定位器继续回放，并把「断裂的 / 推荐的新定位器」上报到 UI 供用户确认写回。

---

## 2. 脆弱性的本质

Web 自动化最痛的点：录制的定位器与页面 DOM 强耦合。页面一旦改版（加一层 `<div>`、改 `id`、换标签名），原定位器就找不到元素，回放中断。

源码里体现「脆弱」的两个层面：

- **结构脆弱**：`xpath:position`、`xpath:idRelative` 这类**依赖 DOM 路径/层级**的定位器，一旦祖先节点变动即失效。
  - `content/locatorBuilders.js:495` `LocatorBuilders.add('xpath:idRelative', ...)` 基于父节点拼接相对路径；
  - `content/locatorBuilders.js:547` `add('xpath:position', ...)` 基于同层索引 `xpath=//div[3]`。
- **属性脆弱**：`id`/`name`/`css` 依赖页面作者不改动这些属性。

Self-Healing 不是「让定位器更稳」，而是「**定位器坏了之后能自动换一个继续跑**」，核心是录制阶段就为每个元素生成**多种候选定位器**并都存档下来（`parser.js:94` 的 `<datalist>`），回放阶段再按优先级重试。

---

## 3. 双轨架构：LocatorBuilders vs KULocatorBuilders

Katalon 在 Selenium IDE 原版 `LocatorBuilders` 基础上，扩展出一个 `KULocatorBuilders`。两者**同时存在、分别被不同 Recorder 实例化**，这是理解整个模块的关键。

| 维度 | 原版 `LocatorBuilders` | Katalon 版 `KULocatorBuilders` |
|---|---|---|
| 源码文件 | `content/locatorBuilders.js` | `katalon/ku-locatorBuilders.js` |
| 实例化位置 | `content/recorder.js:36` `this.locatorBuilders = new LocatorBuilders(window)` | `katalon/ku-recorder.js:23` `this.ku_locatorBuilders = new KULocatorBuilders(window)` |
| `buildAll` 返回类型 | **数组** `[ [locator, finderName], ... ]` | **对象** `{ finderName: [locator,...], ... }` |
| 首选顺序 `_preferredOrder` | 普通排序（无 neighbor 置顶） | `katalon/ku-locatorBuilders.js:577` `KULocatorBuilders._preferredOrder = ['xpath:neighbor'];` |
| `xpath:neighbor` 注册 | `content/locatorBuilders.js:515` | `katalon/ku-locatorBuilders.js:579`（置顶优先） |
| 邻居生成器入参 | `getXpathsByNeighbors(e, false)` | `getXpathsByNeighbors(e, true)`（带 `xpath=` 前缀） |

### 3.1 返回形状差异（直接影响下游消费方式）

原版（数组）——`content/locatorBuilders.js` `buildAll`：
```js
// 返回 locators: [[locator, name], ...]
locators.push([thisLocator, finderName]);
```

Katalon 版（对象）——`katalon/ku-locatorBuilders.js:136-139`：
```js
if(!locators[finderName]){
    locators[finderName]=[]
}
locators[finderName].push(thisLocator);
```
即 `locators = { 'id':['id=foo'], 'xpath:neighbor':['xpath=...'], ... }`。

> 裁剪提示：如果你只保留一套生成器，建议保留 Katalon 版「对象形态 + xpath:neighbor 置顶」，因为 neighbor 对结构改版最鲁棒（见第 6 节）。

---

## 4. 策略逐个详解（以 `.add(` 注册为准，禁止臆测）

### 4.1 原版 `content/locatorBuilders.js` 注册清单

| 行号 | finderName | 说明 |
|---|---|---|
| `content/locatorBuilders.js:351` | `ui` | UI 元素定位（基于 `getCSSSubPath` 等） |
| `content/locatorBuilders.js:356` | `id` | `id=...` |
| `content/locatorBuilders.js:363` | `link` | `<a>` 文本链接 |
| `content/locatorBuilders.js:373` | `name` | `name=...` |
| `content/locatorBuilders.js:404` | `dom:name` | `dom=document...name` |
| `content/locatorBuilders.js:432` | `xpath:link` | 基于链接文本的 xpath |
| `content/locatorBuilders.js:442` | `xpath:img` | 基于图片 `alt/src` 的 xpath |
| `content/locatorBuilders.js:455` | `xpath:attributes` | 基于多属性组合的 xpath |
| `content/locatorBuilders.js:495` | `xpath:idRelative` | 相对父 `id` 的 xpath（结构脆弱） |
| `content/locatorBuilders.js:515` | `xpath:neighbor` | 邻居锚点 xpath（核心，见第 6 节） |
| `content/locatorBuilders.js:519` | `xpath:href` | 基于 `href` 的 xpath |
| `content/locatorBuilders.js:532` | `dom:index` | `dom=document...[index]` |
| `content/locatorBuilders.js:547` | `xpath:position` | 同层索引 xpath（结构脆弱） |
| `content/locatorBuilders.js:569` | `css` | `css=...` |

> 共 **14 条** `.add` 注册（含 `ui`）。注意 Katalon 版把 `xpath:neighbor` 移到了 `579` 行且**置顶**。

### 4.2 Katalon 版 `katalon/ku-locatorBuilders.js` 注册清单

| 行号 | finderName | 与原版差异 |
|---|---|---|
| `:352` `ui` | 同 | |
| `:357` `id` | 同 | |
| `:364` `link` | 同 | |
| `:374` `name` | 同 | |
| `:405` `dom:name` | 同 | |
| `:433` `xpath:link` | 同 | |
| `:443` `xpath:img` | 同 | |
| `:456` `xpath:attributes` | 同 | |
| `:496` `xpath:idRelative` | 同 | |
| `:516` `xpath:href` | 同 | |
| `:529` `dom:index` | 同 | |
| `:544` `xpath:position` | 同 | |
| `:566` `css` | 同 | |
| `:579` `xpath:neighbor` | **置顶**（因 `_preferredOrder=['xpath:neighbor']`） | |

### 4.3 关键子算法（仅在 `content/locatorBuilders.js`）

- `preciseXPath`（唯一性校验）`content/locatorBuilders.js:332-345`：用 `XPathResult.ORDERED_NODE_SNAPSHOT_TYPE` 遍历候选，给不唯一路径追加索引 `[n]`，确保精确命中单个元素。
- `attributeValue` `:246`、`getCSSSubPath` `:313`、`relativeXPathFromParent` `:288`、`getXPath` 拼接 xpath 前缀 `:101-103`。

---

## 5. xpath:neighbor 重点（结构鲁棒的定位器）

`xpath:neighbor` 不依赖目标元素自身的属性，也不依赖它到根的路径，而是**用「身边有稳定文本的邻居」当锚点**反推目标。这是 Katalon 首选它的原因。

### 5.1 算法入口

- 原版：`content/locatorBuilders.js:515` → `neighborXpathsGenerator.getXpathsByNeighbors(e, false)`
- Katalon：`katalon/ku-locatorBuilders.js:579` → `getXpathsByNeighbors(e, true)`

### 5.2 邻居算法源码（`content/neighbor-xpaths-generator.js`）

排除标签 `excludedTags`（`content/neighbor-xpaths-generator.js:4`）：
```js
["main","noscript","script","style","header","head","footer","meta",
 "body","title","ul","iframe","link","svg","path","nav","p","option","br"]
```
> 这些标签被认为「没有稳定可读文本 / 非可视」，不当锚点。

主流程 `getXpathsByNeighbors` `:17`：
```js
var usefulNeighbors = neighborXpathsGenerator.getUsefulNeighbors(clickedElement, 2, 2); // 前后各取2个有用邻居
```
对**每个有用邻居**生成形如：
```
(.//*[normalize-space(text()) and normalize-space(.)='邻居文本'])[offset]
  /preceding::目标标签[offset]     // 或 /following::目标标签[offset]
```
计算三要素：

1. **邻居文本锚点** `getImmediateText` `:202`：取邻居的可见文本（长度 1–100、非纯数字，见 `usefulElement` `:294`）。
2. **相对前缀** `getRelativePrefix` `:149`：比较目标与邻居的 `getIndexPath` 路径，哪层先分叉决定用 `preceding` 还是 `following`。
3. **偏移 offset** `getCorrectOffset` `:164`：用 `document.evaluate` 跑 XPath 快照，数到第几个才是目标元素；**注意 `:164` 里 `if(xpath.includes("preceding"))` 反向计数**（从后往前数）。

### 5.3 两版 neighbor 生成器差异（重要，裁剪决定）

- **`content/neighbor-xpaths-generator.js`**（407 行，可读源码）：用 `/` 轴，无 `generateTextLocator`。
- **`katalon/neighbor-xpaths-generator.min.js`**（8915 字节，压缩且**功能更多**）：
  - 额外函数：`generateTextLocator`（生成 `//*/text()[normalize-space(.)='...']/parent::*`）、`getElementTagNameOrSvgName`（svg 处理）、`getUsefulNeighborsText`（被 `katalon/common.js:36` 云端上报调用）。
  - `getXpathsByNeighbors` 用 `//` 轴且**末尾追加 `generateTextLocator(clickedElement)`** 作为兜底文本定位器。

> 裁剪结论：若只保留一套，**用 `katalon/neighbor-xpaths-generator.min.js`**，它生成的候选项更丰富（多一个文本兜底），且 `xpathPrefix=true` 时直接带 `xpath=` 前缀。

### 5.4 推演示例

**示例 A**：页面
```html
<label>用户名</label><input id="u1">
```
点 `<input>` 录制时，`邻居=label(文本"用户名")`，目标在邻居 `following` 方向第 1 个 `input`：
```
xpath=(.//*[normalize-space(text()) and normalize-space(.)='用户名'])[1]/following::input[1]
```
即使外层包了新 `<div>`，只要 `label` 文本不变、仍是相邻 input，仍可命中 —— **对结构改版鲁棒**。

**示例 B**：页面
```html
<div>提交</div><button>Go</button>
```
点 `<button>`，`邻居=div(文本"提交")`，目标在 `following`：
```
xpath=(.//*[normalize-space(text()) and normalize-space(.)='提交'])[1]/following::button[1]
```

---

## 6. 唯一性校验（preciseXPath）

回放前生成的 xpath 可能匹配多个元素。`preciseXPath`（`content/locatorBuilders.js:332-345`）通过快照遍历加索引保证唯一：
```js
var snapShot = document.evaluate(xpath, ... XPathResult.ORDERED_NODE_SNAPSHOT_TYPE ...);
// 若多个，给路径追加 [index+1]
```
> 该函数在「定位器生成」阶段被调用以产出精确 xpath；回放查找阶段另由 `selenium-browserbot` / `selenium-api` 的 `locateElementByXPath` 执行实际查找（文件存在：`content/selenium-browserbot.js`、`content/selenium-api.js`，逐行未在本次蒸馏范围，确认存在）。

---

## 7. 字符串格式协议（Locator 字符串协议）

定位器统一为 `finderName=value` 字符串，回放时按 `=` 前分派 strategy：

- `id=foo` → `locateElementById`
- `name=bar` → `locateElementByName`
- `css=div.x` → `locateElementByCss`
- `xpath=...` / `xpath:link=...` / `xpath:neighbor=...` → `locateElementByXPath`（前缀统一归一为 `xpath`）
- `dom=...` → `locateElementByDom`
- `link=文本` → `locateElementByLinkText`

命令 target 的数据结构（`panel/js/UI/models/test-model/test-command.js:13`）：
```js
class TestCommand {
  constructor(name, defaultTarget, targets = [], value) { ... }
}
```
即 `{ defaultTarget, targets: [...] }`。`targets` 就是「候选定位器数组」——Self-Healing 的弹药库。

---

## 8. 回放查找链路（find → locate → strategy）

回放时命令的 target 字符串被解析后，交给浏览器 bot 查找：
`findElement(cmd)` → `locateElementBy{finderName}(locator)` → 各 strategy（实现于 `content/selenium-browserbot.js`、`content/selenium-api.js`）。

> 文件确认存在（行数已统计 `selenium-browserbot.js` 2932 / `selenium-api.js` 3954），逐行未在本次蒸馏范围。核心事实：**查找失败会抛出含特定文案的异常**，Self-Healing 据此判定（见第 9 节）。

---

## 9. Self-Healing 完整链路

### 9.1 设置（Settings）

默认配置 `panel/js/background/load-setting-data.js:7-18`：
```js
"self-healing": {
  enable: true,
  locator: ["id","xpath","css"],          // 有序优先级
  excludeCommands: ["verifyElementPresent","verifyElementNotPresent",
                    "assertElementPresent","assertElementNotPresent"]
}
```
- `enable`：总开关。
- `locator`：候选定位器**按此顺序**进入重试队列。
- `excludeCommands`：这些命令**不触发**自愈（即便 `enable=true`）。

设置 UI：`setting-panel/js/setting-tabs/self-healing-setting-tab.js`（`makeTableSortable:3` 可拖拽排序、`renderLocatorList:44`、`saveData:194` 写回 `setting["self-healing"]`、`getContent:157` 渲染结构）。

### 9.2 候选列表排序算法 `getPossibleTargetList`

`panel/js/UI/services/self-healing-service/utils.js:55-78` 是自愈的**核心调度算法**：
```js
const getPossibleTargetList = async (currentCommand) => {
  let locatorList = await getSelfHealingSettingLocatorsList(); // 取 setting 的 locator 顺序
  // 按 locator 前缀分组：new RegExp('^'+locator)
  let groups = currentCommand.targets.reduce((acc, t) => {
    for (const locator of locatorList) {
      if (new RegExp('^' + locator).exec(t)) { (acc[locator] = acc[locator]||[]).push(t); break; }
    }
    return acc;
  }, {});
  let result = [];
  locatorList.forEach(l => result.push(...(groups[l]||[])));   // 按设置顺序排前面
  // 剩余未归组的（如 xpath:neighbor）追加到末尾
  currentCommand.targets.forEach(t => { if (!result.includes(t)) result.push(t); });
  // 剔除当前正在失败的那条
  return result.filter(t => t !== currentCommand.target);
};
```

### 9.3 回放失败 → 自愈重试

`panel/js/background/playback/service/actions/play/play-actions.js`：

- `doCommand` `:935`：`possibleTargets = await getPossibleTargetList(testCommand)` `:944`
- 自愈命中判定 `:953-962`：若回放结果 `result.commandTarget` 落在 `optionList` 且与原始 `commandTarget` 不同 → `isSelfHealingInvoke=true` `:958`，并 `addBrokenLocator(testCaseID, commandTarget, result.commandTarget)` `:961`（记录断裂）。
- `runCommand` `:965`：`enableSelfHealing = await isSelfHealingEnable()` `:975`
- 失败处理 `:1316-1370`：
  ```js
  // :1321-1323 识别失败文案
  if (/Element.*not found|Unrecognised locator type|Invalid xpath/.test(errMsg)) {
    let isCommandExcludedResult = await isCommandExcluded(commandName); // :1325
    if (enableSelfHealing && !isCommandExcludedResult) {                 // :1326
      if (possibleTargets.length > 0) {                                  // :1330
        let nextTarget = possibleTargets.shift();                       // :1331 取下一个候选
        return runCommand(..., nextTarget, ...);                         // 递归重试
      }
    }
  }
  ```
  即：**递归 `runCommand` 逐个消耗 `possibleTargets`，直到命中或耗尽**。耗尽则按普通失败处理（rerun / 报错）。

### 9.4 断裂上报 UI

- `panel/js/UI/view/self-healing/self-healing-tab.js`：
  - `addBrokenLocatorToSelfHealingTab:18` → `addBrokenLocator:46`：去重后向 `#selfHealingList` 写入一行，含隐藏字段 `testcaseID / broken_locator / propose_locator`。
  - `updateTestCaseStatusUI:79`、`attachEvent:99`。

### 9.5 用户确认写回（Approve）

`panel/js/UI/services/self-healing-service/self-healing-tab-command-actions.js`：
- `approveSelfHealingProposalAction:57` → `changeLocatorOnRecordGrid:22` / `changeLocatorOnInMemoryDataObject:44`
- 两函数均执行 **`command.defaultTarget = brokerLocatorItem.proposeLocator`**（把推荐定位器写回命令的默认 target，永久修复）。

> 自愈闭环：录制存多候选 → 回放失败 → 按序重试 → 命中记断裂 → UI 展示 → 用户 Approve → 写回 defaultTarget。

---

## 10. TargetSelecter（回放/录制时的元素高亮选择）

`content/targetSelecter.js`：
- 构造 `TargetSelecter(callback, cleanupCallback)` `:3`，监听 `mousemove` `:20` 高亮、`click` 调回调。
- `handleEvent` `:48`：`mousemove` 时高亮 `:50`；`click` 且左键 `evt.button==0` 时 `this.callback(this.e, this.win)` `:54-55` 并 `preventDefault` + `cleanup`。
- `highlight` `:64`：用 `div` 盒阴影高亮当前悬停元素。

> 用途：UI 里让用户手动点选/校验元素时高亮，并提供回调（如替换 target）。与自愈的「自动替换」互补。

---

## 11. 云端上报（可裁剪项）

Katalon 版录制时会把页面 DOM 结构与邻居文本上报云端，用于其 SaaS 自愈服务：
- `katalon/common.js` `treeHTML:3`：调用 `ku_locatorBuilders.buildAll(element)` 写入 `object['xpaths']`，并 `neighborXpathsGenerator.getUsefulNeighborsText(element)` `:35-36`（上报邻居文本）。
- `katalon/dom_collector.js` `startDomCollector`：定时 `postDomMap(qAutomate_server_url, createDomMap())` 上报。
- `katalon/dom_inspector.js`：DOM 变更监听上报。

> **裁剪建议**：个人插件应**删除** `dom_collector.js` / `dom_inspector.js` 及 `common.js` 中 `getUsefulNeighborsText` 上报调用，避免把页面数据外传。`qAutomate_server_url` 在 `katalon/common.js` 定义（未逐行定位，确认存在）。

---

## 12. 缺陷与改进（裁剪 roadmap）

### 12.1 已知缺陷
1. **双轨冗余**：`LocatorBuilders` 与 `KULocatorBuilders` 两套几乎重复，仅 `xpath:neighbor` 置顶与返回形态不同，维护成本高。
2. **neighbor 盲区**：`excludedTags` 把 `p`、`ul`、`option` 等排除为锚点（`content/neighbor-xpaths-generator.js:4`），若页面只有这些邻居则降级。
3. **正则 replace 无锚点**：`isCommandExcluded` 用 `new RegExp(command).exec(commandName)`（`utils.js:27-48`），若 `excludeCommands` 含未转义正则元字符可能误匹配。
4. **递归重试无深度保护**：`play-actions.js:1331` 递归 `runCommand`，候选多时无显式深度上限（依赖 `possibleTargets` 长度天然有界）。
5. **隐私外传**：云端上报（第 11 节）默认开启相关逻辑，个人插件需关闭。

### 12.2 改进建议
- 合并为单一生成器，保留 Katalon 版「对象形态 + neighbor 置顶」+ `katalon/neighbor-xpaths-generator.min.js` 的丰富候选。
- 自愈候选列表可引入「**加权打分**」（neighbor > id > css > position），而非单纯依赖设置顺序。
- 为 `excludeCommands` 增加「整词匹配 / 转义」开关，避免正则误伤。

---

## 附录：150 行定位器 + 自愈最小骨架（可直接落地）

> 以下为裁剪版核心骨架，引用前述源码的等价逻辑，可直接作为个人插件起点。

```js
// ===== locator-builders.js =====
// 单轨生成器：对象形态 + neighbor 置顶
const LocatorBuilders = {
  _preferredOrder: ['xpath:neighbor'],
  _strategies: {},
  add(name, fn) { this._strategies[name] = fn; },
  buildAll(el) {
    const locators = {};
    for (const name in this._strategies) {
      const v = this._strategies[name](el);
      if (v) { (locators[name] = locators[name] || []).push(v); }
    }
    return locators; // { id:['id=x'], 'xpath:neighbor':['xpath=...'] }
  }
};
LocatorBuilders.add('id', e => e.id ? `id=${e.id}` : null);
LocatorBuilders.add('name', e => e.name ? `name=${e.name}` : null);
LocatorBuilders.add('css', e => cssPath(e));
LocatorBuilders.add('xpath:neighbor',
  e => neighborXpathsGenerator.getXpathsByNeighbors(e, true)[0]); // 置顶首选

// ===== neighbor-xpaths-generator.js =====
const neighborXpathsGenerator = {
  excludedTags: ["script","style","head","meta","svg","path","br","option"],
  getXpathsByNeighbors(clicked, withPrefix) {
    const neighbors = this.getUsefulNeighbors(clicked, 2, 2);
    const out = [];
    for (const n of neighbors) {
      const text = this.getImmediateText(n);
      if (!text) continue;
      const anchor = `(.//*[normalize-space(text()) and normalize-space(.)=${text}])`;
      const offByText = this.getCorrectOffset(n, anchor);
      const prefix = this.getRelativePrefix(clicked, n); // preceding/following
      const partial = `${anchor}[${offByText}]/${prefix}::${clicked.tagName.toLowerCase()}`;
      const offByTag = this.getCorrectOffset(clicked, partial);
      out.push(withPrefix ? `xpath=${partial}[${offByTag}]` : `${partial}[${offByTag}]`);
    }
    return out;
  },
  getUsefulNeighbors(el, pL, fL) {
    const all = [...document.getElementsByTagName('*')];
    const i = all.indexOf(el); const res = [];
    for (let j = i-1; j>=0 && res.length<pL; j--)
      if (this.usefulElement(all[j])) res.push(all[j]);
    for (let k = i+1; k<all.length && res.length<(pL+fL); k++)
      if (this.usefulElement(all[k])) res.push(all[k]);
    return res;
  },
  getRelativePrefix(el, n) {
    const ep = getIndexPath(el), np = getIndexPath(n);
    for (let i=0;i<Math.max(ep.length,np.length);i++)
      if (ep[i]!==np[i]) return ep[i]-np[i]<0 ? 'preceding' : 'following';
  },
  getCorrectOffset(el, xpath) {
    const snap = document.evaluate(xpath, document, null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const fromEnd = xpath.includes('preceding');
    for (let i=0;i<snap.snapshotLength;i++){
      const idx = fromEnd ? snap.snapshotLength-1-i : i;
      if (snap.snapshotItem(idx)===el) return i+1;
    }
    return snap.snapshotLength+1;
  },
  getImmediateText(el) {
    const t = [...el.childNodes].filter(n=>n.nodeType===3)
      .map(n=>n.textContent.trim()).join(' ').trim();
    return (t.length>1 && t.length<=100 && isNaN(parseInt(t))) ? `'${t}'` : '';
  },
  usefulElement(el){ return el && !this.excludedTags.includes(el.tagName.toLowerCase())
    && this.getImmediateText(el) && el.getAttribute('type')!=='hidden'
    && el.getAttribute('aria-hidden')!=='true'; }
};

// ===== self-healing.js =====
const SelfHealing = {
  setting: { enable:true, locator:['id','xpath','css'],
    excludeCommands:['verifyElementPresent','assertElementPresent'] },
  isEnable: () => SelfHealing.setting.enable,
  isExcluded(cmd){ return SelfHealing.setting.excludeCommands
    .some(c => new RegExp(c).test(cmd)); },
  getPossibleTargetList(currentCommand){
    const order = SelfHealing.setting.locator;
    const groups = {};
    currentCommand.targets.forEach(t=>{
      const hit = order.find(l => new RegExp('^'+l).test(t));
      if (hit) (groups[hit]=groups[hit]||[]).push(t);
    });
    let res = []; order.forEach(l=>res.push(...(groups[l]||[])); 
    currentCommand.targets.forEach(t=>{ if(!res.includes(t)) res.push(t); });
    return res.filter(t=>t!==currentCommand.target); // 剔除正在失败的那条
  }
};

// ===== playback.js =====
async function runCommand(cmd, target, possibleTargets){
  try {
    const el = findElement(target);   // 交给 selenium-api/browserbot
    return doAction(cmd, el);
  } catch(e){
    if (/not found|Invalid xpath/.test(e.message)
        && SelfHealing.isEnable() && !SelfHealing.isExcluded(cmd.name)
        && possibleTargets.length) {
      const next = possibleTargets.shift();
      return runCommand(cmd, next, possibleTargets); // 递归重试
    }
    throw e;
  }
}
```

> 骨架对应源码映射：生成器 `katalon/ku-locatorBuilders.js`；neighbor `content/neighbor-xpaths-generator.js` / `katalon/neighbor-xpaths-generator.min.js`；排序 `panel/js/UI/services/self-healing-service/utils.js:55`；重试 `panel/js/background/playback/service/actions/play/play-actions.js:1330`。

---

*文档完。所有引用均可在只读源码目录 `7.1.0_0` 中按 `路径:行号` 核对。*
