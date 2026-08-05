# TECH-08 · 测试用例数据模型与持久化

> 蒸馏对象：Katalon Recorder 7.1.0（MV3）
> 源码根目录：`C:\Users\Li\Downloads\GitHub\auto-test\doc\老师\KatalonRecorder\7.1.0_0`
> 本文所有结论均标注 `文件:行号`，无法追溯的部分显式标注「推测」。

---

## 一、一句话概括

Katalon Recorder 的测试数据是一棵 **`TestData → TestSuite[] → TestCase[] → TestCommand[]` 的四层纯内存对象树**，挂在 `window.KRData` 上（`panel/js/UI/index.js:19`）；它用 **UUID v4** 做套件/用例主键、用 **HTML `<table>` 字符串**（Selenium IDE 遗产格式）做磁盘序列化格式、用 **`<datalist><option>`** 在同一份 HTML 里夹带候选定位器数组，最终整棵树被 `JSON.stringify` 成一个对象塞进 `browser.storage.local` 的 `data` 键（`panel/js/UI/services/data-service/save-data.js:10-16`）——而所谓「Untitled Test Case」**根本不是识别出来的，它是录制第一条命令时发现没有选中用例，于是调用 `createTestCase("Untitled Test Case", testSuite)` 兜底创建出来的默认字符串常量**（`panel/js/UI/view/records-grid/add-command.js:36-39`）。

---

## 二、关键文件清单

### 2.1 数据模型层（models/test-model）

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---|---|---|
| `panel/js/UI/models/test-model/test-data.js` | 62 | 顶级容器 `TestData`，持有 `testSuites[]`，提供跨套件查找/删除 | **保留**（可简化为普通数组） |
| `panel/js/UI/models/test-model/test-suite.js` | 50 | `TestSuite`：`id/name/status/testCases/query` | **保留**（删 `query`、`status==='dynamic'` 分支） |
| `panel/js/UI/models/test-model/test-case.js` | 49 | `TestCase`：`id/name/commands/tags` | **保留**（可删 `tags`） |
| `panel/js/UI/models/test-model/test-command.js` | 34 | `TestCommand`：`name/defaultTarget/targets/value/status/state` | **保留**（核心，一个字段都别删） |

### 2.2 数据服务层（services/data-service）

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---|---|---|
| `panel/js/UI/services/data-service/test-suite-service.js` | 142 | 套件 CRUD + 标签聚合 `getTagsData`/`auditTags` | **保留 CRUD，删标签与 dynamic 相关** |
| `panel/js/UI/services/data-service/test-case-service.js` | 66 | 用例 CRUD，**「Untitled Test Case」默认值的真正出处** | **保留** |
| `panel/js/UI/services/data-service/test-command-service.js` | 10 | 仅一个 `setTestCommandStatus`（回放着色用） | **保留**（10 行，无成本） |
| `panel/js/UI/services/data-service/load-data.js` | 60 | 启动时从 `storage.local` 装载 + 旧格式兼容 + 首次备份 | **保留，删旧格式分支** |
| `panel/js/UI/services/data-service/save-data.js` | 49 | 落盘 `storage.local.set({data: KRData})` | **保留** |

### 2.3 序列化层（services/helper-service）

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---|---|---|
| `panel/js/UI/services/helper-service/parser.js` | 143 | `marshall`/`unmarshall`：TestSuite ⇄ HTML `<table>` 字符串 | **保留**（若换 JSON 格式则整体替换） |
| `panel/js/UI/services/helper-service/utils.js` | 30 | `generateUUID()`（UUID v4）、`removeObjectAtIndexes` | **替换**为 `crypto.randomUUID()` |
| `panel/js/UI/services/helper-service/make-text-file.js` | 28 | 生成 `blob:` URL 供 `downloads.download` 使用 | **保留** |

### 2.4 文件导入导出层（services/html-service + controllers）

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---|---|---|
| `panel/js/UI/services/html-service/download-suite.js` | 85 | 导出 `.krecorder`（HTML）或 `.json`（dynamic 套件） | **保留，删 dynamic 分支** |
| `panel/js/UI/services/html-service/load-html-file.js` | 43 | 读 `.krecorder`/`.html`/`.json` → `unmarshall` | **保留** |
| `panel/js/UI/services/html-service/read-suite-from-string.js` | 10 | 从字符串直接建套件（外部消息注入用） | **删除** |
| `panel/js/UI/controllers/other-listeners/import-html-file.js` | 45 | `<input type=file>` 监听 | **保留** |
| `panel/js/UI/controllers/other-listeners/import-selenium.js` | 71 | `.side`（Selenium IDE 项目）导入 | **删除**（除非要兼容 SIDE） |
| `panel/js/UI/services/selenium-service/selenium-ide-parser.js` | 133 | `.side` → KR 命令的语义转换 | **删除** |
| `panel/js/UI/services/selenium-service/command-converter-service.js` | 201 | 不兼容命令黑名单 + 逐条改写规则 | **删除** |
| `panel/js/UI/services/selenium-service/mapping-selenium-test-bbject-to-kr-test-object.js` | 26 | Selenium 对象 → KR 对象映射（注意文件名拼写错误 `bbject`） | **删除** |

### 2.5 UI ⇄ 内存桥接层（view/controllers）

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---|---|---|
| `panel/js/UI/view/records-grid/add-command.js` | 158 | **录制入口**，「Untitled」兜底创建的调用现场 | **保留**（重写渲染部分） |
| `panel/js/UI/view/records-grid/render-command-element.js` | 50 | DOM 建 `<tr>` + 挂 `<datalist>` | **保留** |
| `panel/js/UI/view/records-grid/render-test-case-to-record-grid.js` | 57 | 用 innerHTML 拼整张网格（含 datalist） | **替换**（innerHTML 拼串风险高） |
| `panel/js/UI/view/records-grid/record-utils.js` | 41 | 从 `<tr>` 反读命令名/目标/候选/值 | **保留** |
| `panel/js/UI/view/testcase-grid/utils.js` | 44 | `saveOldCase()`：UI → 内存反向同步 | **保留**（但见第五章坑 #3） |
| `panel/js/UI/controllers/other-listeners/storage.js` | 42 | 启动 `loadData()`、`beforeunload` 时 `saveData()` | **保留** |
| `panel/js/UI/controllers/testcase-grid/testCase-grid-test-case-listener.js` | 115 | 手动「新建用例」按钮，prompt 默认值也是 "Untitled Test Case" | **保留**（删登录/埋点） |
| `panel/js/UI/index.js` | 44 | `window.KRData = new TestData()` 全局初始化 | **保留** |

### 2.6 权限与配置

| 文件 | 行号 | 内容 |
|---|---|---|
| `manifest.json` | `:64` | `"permissions": ["tabs","activeTab","contextMenus","downloads","webNavigation","notifications","cookies","storage","unlimitedStorage","debugger","scripting","offscreen"]` |
| `manifest.json` | `:52` | `"host_permissions": ["http://*/","https://*/","<all_urls>"]` |

> `unlimitedStorage` 是关键：`storage.local` 默认配额约 5 MB（MV3 下 `chrome.storage.local` 为 10 MB），一个几百条命令、每条 5 个候选定位器的项目很容易撑爆，KR 直接申请了无限配额。

### 2.7 单元测试（作为「规格说明书」使用）

| 文件 | 行数 | 价值 |
|---|---|---|
| `tests/panel/js/UI/services/data-service/test-case-service.spec.js` | 98 | `:26`/`:33` 断言 null/undefined → `"Untitled Test Case"`；`:40` 断言无套件抛错 |
| `tests/panel/js/UI/services/data-service/test-suite-service.spec.js` | 141 | `:97`/`:103` 断言 null/undefined → `"Untitled Test Suite"` |
| `tests/panel/js/UI/services/helper-service/parser.spec.js` | 260+ | 提供 marshall/unmarshall 的**逐字节期望字符串**，是复刻格式的最佳参考 |
| `tests/panel/js/UI/services/data-service/load-data.spec.js` | — | 装载路径覆盖 |
| `tests/panel/js/UI/services/html-service/load-html-file.spec.js` | — | 文件读取路径覆盖 |

---

## 三、核心机制逐层拆解

### 3.1 四层数据模型：用例 = 命令数组的容器

整个数据模型极其朴素，没有任何 ORM、没有 Proxy、没有响应式，就是四个普通 class。

#### 3.1.1 顶层 `TestData`

```js
// panel/js/UI/models/test-model/test-data.js:4-11
class TestData {
    constructor(testSuites = []) {
        this.testSuites = testSuites;
    }
```

它唯一的字段就是 `testSuites` 数组。**没有 id**——因为它是单例，全局只有一个，挂在 window 上：

```js
// panel/js/UI/index.js:19
window.KRData = new TestData();
```

注意 `panel/js/UI/index.js:18-34` 一口气往 `window` 上挂了十几个全局（`newFormatters`、`profileData`、`formalCommands`、`Log`…）。这是 KR 的历史包袱：ES Module 与旧的全局脚本混用，模块内 `import` 的东西必须再手动挂到 `window` 上，才能被非模块脚本（如 `kar-loadCommand.js`）访问。

`TestData` 提供了四个跨套件的操作，全是 O(n²) 线性扫描：

```js
// panel/js/UI/models/test-model/test-data.js:31-41
removeTestCase(testCaseID) {
    for (const testSuite of this.testSuites) {
        for (let i = 0; i < testSuite.getTestCaseCount(); i++) {
            const testCase = testSuite.testCases[i];
            if (testCase.id === testCaseID) {
                testSuite.testCases.splice(i, 1);
                return testCase;
            }
        }
    }
}
```

```js
// panel/js/UI/models/test-model/test-data.js:55-60
findTestSuiteByTestCaseID(testCaseID) {
    return this.testSuites.find(testSuite => {
        let testCase = testSuite.testCases.find(testCase => testCase.id === testCaseID);
        return testCase !== undefined;
    });
}
```

> **为什么能容忍 O(n²)**：单个 KR 会话里套件数通常是个位数、用例数几十，线性扫描完全够。个人插件可以照抄，不必上索引。

#### 3.1.2 `TestSuite`

```js
// panel/js/UI/models/test-model/test-suite.js:14-23
constructor(name = "", status = "", testCases = [], query = "") {
    if (testCases === undefined) {
        testCases = [];
    }
    this.id = generateUUID();
    this.name = name;
    this.status = status;
    this.testCases = testCases;
    this.query = query;
}
```

四个字段的语义：

| 字段 | 类型 | 语义 |
|---|---|---|
| `id` | string(UUID v4) | 主键，同时**直接用作 DOM 元素 id**（见 3.4） |
| `name` | string | 显示名，也是导出文件名（`download-suite.js:41`） |
| `status` | `"normal"` \| `"dynamic"` | `dynamic` 是「按标签动态聚合的虚拟套件」，不含真实用例 |
| `testCases` | TestCase[] | 子节点 |
| `query` | string | 仅 `dynamic` 套件用，存标签查询表达式 |

`:15-17` 那个 `if (testCases === undefined) testCases = []` 是**冗余代码**——ES6 默认参数已经处理了 undefined。留着不碍事，裁剪时可删。

#### 3.1.3 `TestCase` —— 「用例 = 命令数组的容器」

```js
// panel/js/UI/models/test-model/test-case.js:14-19
constructor(name = "", commands = [], tags = []) {
    this.id = generateUUID();
    this.name = name;
    this.commands = commands;
    this.tags = tags;
}
```

**这就是全部。** 一个 TestCase 除了「名字 + 命令数组 + 标签」什么都没有：

- 没有「基础 URL」字段（`open` 命令自带完整 URL）
- 没有「前置/后置条件」
- 没有「参数化数据源」（数据驱动走独立的 `data-file-service`）
- 没有「上次运行结果」（结果只存在 `TestCommand.status` 的瞬时状态里）

命令数组的操作也只有三个：

```js
// panel/js/UI/models/test-model/test-case.js:25-35
getTestCommandCount() {
    return this.commands.length;
}

insertCommandToIndex(index, testCommand) {
    this.commands.splice(index, 0, testCommand);
}

removeCommandAtIndex(index) {
    return this.commands.splice(index, 1)[0];
}
```

> **蒸馏结论**：「测试用例」在 KR 里没有任何魔法，它就是一个 `{id, name, commands[]}`。复刻时你完全可以用一个普通对象字面量代替这个 class，唯一要保留的是 **id 必须在构造时自动生成**。

#### 3.1.4 `TestCommand` —— 六个字段，两个是运行时状态

```js
// panel/js/UI/models/test-model/test-command.js:13-20
constructor(name = "", defaultTarget = "", targets = [], value = "") {
    this.name = name;
    this.defaultTarget = defaultTarget;
    this.targets = targets;
    this.value = value;
    this.status = null;
    this.state = null;
}
```

| 字段 | 语义 | 是否持久化 |
|---|---|---|
| `name` | 命令名，如 `click`/`type`/`assertText` | ✔ |
| `defaultTarget` | **当前生效**的定位器字符串，如 `id=username` | ✔ |
| `targets` | **候选定位器数组**，录制时由 LocatorBuilders 生成的全部方案 | ✔（存进 `<datalist>`） |
| `value` | 命令第二参数（输入文本、断言期望值…） | ✔ |
| `status` | 回放结果着色：`"success"` / `"fail"` / `null` | ✔（JSON 序列化会带上，但语义无效） |
| `state` | 命令行状态（如断点、当前执行行） | ✔（同上） |

关键观察：**`defaultTarget` 和 `targets` 是两个独立字段，`defaultTarget` 不保证是 `targets[0]`。**

录制时它们是相等的：

```js
// panel/js/UI/view/records-grid/add-command.js:45-47
const targetList = command_target_array.map(target => target[0]);
const testCommand = new TestCommand(command_name, targetList[0], targetList, command_value);
```

但用户在 UI 上从下拉框换了一个定位器后，`defaultTarget` 就变成 `targets[k]`；自愈（Self-Healing，见 TECH-02）成功后也会改写 `defaultTarget`。这就是 **`<datalist>` 存档机制存在的全部意义**：把「所有候选」和「当前选择」一起持久化，让用户/自愈随时能回退切换。

`setTestCommand` 是一个奇怪的「反序列化构造器」：

```js
// panel/js/UI/models/test-model/test-command.js:22-32
setTestCommand(command) {
    let keys = ['name', 'defaultTarget', 'targets', 'value', 'status', 'state'];
    let newCommand = new TestCommand();

    for (const key of keys) {
        if (command[key]) {
            newCommand[key] = command[key];
        }
    }
    return newCommand;
}
```

它**不是** setter，而是「把一个纯 JSON 对象白名单拷贝成 TestCommand 实例」。调用方式很反直觉：`new TestCommand().setTestCommand(jsonObj)`——先造一个空实例，再用它当工厂。`TestCase.setTestCase`（`test-case.js:37-47`）、`TestSuite.setTestSuite`（`test-suite.js:37-47`）三处同一套路。

> **坑（见第五章 #1）**：`if (command[key])` 是 truthy 判断，`value: ""`、`status: 0`、`targets: []` 这类 falsy 值会被**静默丢弃**，回落到构造函数默认值。对 `value` 来说结果恰好一样（默认也是 `""`），但语义上是个定时炸弹。

---

### 3.2 「Untitled Test Case」到底是怎么来的？

这是本模块最容易被误解的地方。很多人以为 KR 有一段「检测当前页面/标题，生成用例名」的逻辑——**没有**。`"Untitled Test Case"` 是一个硬编码字符串常量，出现在三个层次：

#### 层次 1：服务层默认参数（真正的「兜底」）

```js
// panel/js/UI/services/data-service/test-case-service.js:10-20
const createTestCase = (title = "Untitled Test Case", testSuite) => {
    title = title !== null ? title : "Untitled Test Case";
    if (!testSuite) {
        throw "Null or undefined test suite"
    }

    const testCase = new TestCase(title);
    testSuite.testCases.push(testCase);
    return testCase;

}
```

两重保险：
1. **`title = "Untitled Test Case"` 默认参数** → 处理 `createTestCase(undefined, suite)`
2. **`title = title !== null ? title : "..."` 三元** → 处理 `createTestCase(null, suite)`（ES6 默认参数对 `null` 不生效！）

套件侧完全对称：

```js
// panel/js/UI/services/data-service/test-suite-service.js:29-35
const createTestSuite = (title = "Untitled Test Suite", status) => {
    title = title !== null ? title : "Untitled Test Suite";
    status = status !== undefined ? status : "normal";
    const testSuite = new TestSuite(title, status);
    KRData.testSuites.push(testSuite);
    return testSuite;
}
```

单元测试把这个契约钉死了：

```js
// tests/panel/js/UI/services/data-service/test-case-service.spec.js:26
expect(testCase.name).toEqual("Untitled Test Case");   // 传 null
// :33
expect(testCase.name).toEqual("Untitled Test Case");   // 传 undefined
```

```js
// tests/panel/js/UI/services/data-service/test-suite-service.spec.js:97 / :103
expect(testSuite.name).toEqual("Untitled Test Suite");
```

#### 层次 2：录制入口显式传参（实际触发现场）

用户点「录制」后在页面上点了一下，`recorder` → `background` → panel 的 `addCommand()`：

```js
// panel/js/UI/view/records-grid/add-command.js:21-43
function addCommand(command_name, command_target_array, command_value, auto, insertCommand) {
    // create default test suite and case if necessary
    const selectedTestSuite = getSelectedSuite()
    const selectedTestCase = getSelectedCase();

    let testSuite;
    let testCase;
    if (!selectedTestSuite) {
        testSuite = createTestSuite("Untitled Test Suite");
        renderNewTestSuite("Untitled Test Suite", testSuite.id);
        trackingCreateTestSuite('Record', 'Untitled Test Case');
    } else {
        const testSuiteID = selectedTestSuite.id;
        testSuite = findTestSuiteById(testSuiteID);
    }
    if (!selectedTestCase) {
        testCase = createTestCase("Untitled Test Case", testSuite);
        renderNewTestCase("Untitled Test Case", testCase.id);
        trackingCreateTestCase('Record', 'Untitled Test Case');
    } else {
        const testCaseID = selectedTestCase.id;
        testCase = findTestCaseById(testCaseID);
    }
```

**逻辑就三行注释能说清**：

1. `getSelectedSuite()` 读的是 DOM 上带 `.selectedSuite` class 的元素（`view/testcase-grid/selected-suite.js`）。**没有任何选中态 = 用户从没建过套件**。
2. 没套件 → `createTestSuite("Untitled Test Suite")` 且立刻 `renderNewTestSuite` 渲染到左侧树。
3. 没用例 → `createTestCase("Untitled Test Case", testSuite)` 且立刻 `renderNewTestCase`。

注意 `:31` 那个埋点参数写错了（`trackingCreateTestSuite('Record', 'Untitled Test Case')` —— 套件事件却传了 Test **Case** 字符串）。这是源码里的一个笔误，不影响功能，但说明这块代码是复制粘贴出来的。

#### 层次 3：手动新建时的 prompt 默认值

```js
// panel/js/UI/controllers/testcase-grid/testCase-grid-test-case-listener.js:40-44
$("#add-testCase").click(async function () {
    const testCaseTitle = prompt(
      "Please enter the Test Case's name",
      "Untitled Test Case"
    );
```

这里走的是 `prompt()` 的第二参数（预填值），用户可以改。改完之后**不走 `createTestCase`，而是直连模型**：

```js
// panel/js/UI/controllers/testcase-grid/testCase-grid-test-case-listener.js:66-74
let index = testSuite.getTestCaseCount();
const selectedTestCaseElement = getSelectedCase();
if (selectedTestCaseElement) {
  index = testSuite.findTestCaseIndexByID(selectedTestCaseElement.id) + 1;
}
const testCase = new TestCase(testCaseTitle);
testSuite.insertNewTestCase(index, testCase);

renderNewTestCase(testCaseTitle, testCase.id);
```

> **注意这是一个架构不一致**：`add-command.js` 走 service（`createTestCase`），`testCase-grid-test-case-listener.js` 走 model（`new TestCase` + `insertNewTestCase`）。两条路径都能往树里塞用例。复刻时应统一到一条。

#### 结论（一句话版）

> **"Untitled Test Case" 不是识别出来的，是「录制第一条命令时发现 DOM 上没有 `.selectedCase`，于是用硬编码常量兜底新建一个用例」的结果。** 判定依据是 **UI 选中态**（DOM class），不是数据状态。

这也解释了一个常见现象：用户明明左侧树里有用例，但没点选它就开始录制，KR 又新建了一个「Untitled Test Case」——因为判定的是「有没有选中」，不是「有没有用例」。

---

### 3.3 ID 生成策略：手写 UUID v4

```js
// panel/js/UI/services/helper-service/utils.js:22-29
const generateUUID = () => {
  let d = new Date().getTime();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    let r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

标准的「时间戳 + Math.random 混合」UUID v4 实现：
- 模板里第 13 位固定 `4` → version 4
- `y` 位经 `(r & 0x3 | 0x8)` → variant 位为 `8/9/a/b`
- 时间戳 `d` 每消耗一个字符右移 4 bit（`d = Math.floor(d/16)`），保证同一毫秒内多次调用也不同

调用点只有两个：`TestSuite` 构造（`test-suite.js:18`）、`TestCase` 构造（`test-case.js:15`）。
**`TestCommand` 没有 id**——命令的身份由「所属用例 + 数组下标」隐式决定。这个设计后果见 3.5 与第五章坑 #3。

第三个调用点在 `.side` 导入时给 Default Suite 造 id：

```js
// panel/js/UI/services/selenium-service/selenium-ide-parser.js:44-51
let defaultSuite = {
  "id": generateUUID(),
  "name": "Default Suite",
  ...
}
```

> **裁剪建议**：MV3 扩展页面（`chrome-extension://`）是 secure context，`crypto.randomUUID()` 直接可用，一行替换掉这 8 行。

#### ID 的第二重身份：DOM 元素 id

这是必须警惕的耦合点。`TestSuite.id` / `TestCase.id` 被**直接用作 HTML 元素的 `id` 属性**：

```js
// panel/js/UI/services/html-service/download-suite.js:16-17
const testSuiteID = testSuiteContainerElement.id;
const testSuite = findTestSuiteById(testSuiteID);
```

```js
// panel/js/UI/controllers/other-listeners/storage.js:23
const firstTestSuiteElement = document.getElementById(firstTestSuite.id);
```

UUID v4 的第一个字符可能是数字（如 `3f2a...`），HTML5 允许 id 以数字开头，但 **CSS 选择器 `#3f2a...` 是非法的**——所以 KR 全程用 `document.getElementById()` 而不是 `querySelector('#'+id)`。`add-command.js:91` 里的 `$(selected_ID)` 用的是 `"#records-" + n` 这种带前缀的 id，规避了这个问题。

命令行的 DOM id 用的是**序号前缀**：

```js
// panel/js/UI/view/records-grid/add-command.js:76
const index = parseInt(selected_ID.substring(8));   // 剥掉 "records-"
// :86
reAssignId("records-" + selected_ID, "records-" + count);
// :110
document.getElementById("records-" + count).scrollIntoView(false);
```

所以每次插入/删除命令都要 **重排后续所有行的 DOM id**（`reAssignId`）。这是「命令无 id」的直接代价。

---

### 3.4 增删改查 API 全表

#### 套件层（`test-suite-service.js`）

| 函数 | 行号 | 行为 | 备注 |
|---|---|---|---|
| `createTestSuite(title, status)` | `:29-35` | 新建并 push 到 `KRData.testSuites` | 默认名 "Untitled Test Suite"，默认 status "normal" |
| `addTestSuite(testSuite)` | `:43-48` | 直接 push 已有实例（导入用） | null 检查抛 `"Null or undefined test suite"` |
| `deleteTestSuite(testSuiteID)` | `:16-22` | 委托 `KRData.removeTestSuite` | null 检查抛 `"Null or undefined testSuiteID"` |
| `deleteAllTestSuite()` | `:7-9` | 清空 | |
| `getTestSuiteCount()` | `:50-52` | | |
| `getTextSuiteByIndex(index)` | `:54-56` | 注意函数名拼写错误：**Text**Suite | |
| `findTestSuiteById(id)` | `:58-60` | `Array.find` | |
| `getAllTestSuites()` | `:62-64` | **过滤掉 `status === 'dynamic'`** | |
| `getAllDynamicTestSuites()` | `:66-68` | 只要 dynamic | |
| `findTestSuiteIndexByID(id)` | `:120-122` | | |
| `insertNewTestSuiteAtIndex(i, ts)` | `:124-126` | splice 插入 | |
| `getTagsData()` | `:70-88` | 扁平化所有非 dynamic 用例的标签并去重 | |
| `getAllTestCases()` | `:90-102` | **副作用警告**：给每个 testCase 挂了 `testSuiteName` 字段 | 见坑 #5 |
| `auditTags()` | `:104-118` | 标签 → 用例列表的倒排索引 | dynamic 套件功能用 |

`getAllTestCases` 的副作用值得单独拎出来：

```js
// panel/js/UI/services/data-service/test-suite-service.js:90-102
const getAllTestCases = () => {
    let testCases = [];
    for (const testSuite of KRData.testSuites) {
        if (testSuite.status !== 'dynamic') {
            testSuite.testCases.find(e => {
                e.testSuiteName = testSuite.name;    // ← 污染模型对象
                testCases.push(e);
            });
        }
    }
    testCases = testCases.flat(1);
    return testCases;
}
```

两个问题：
1. 用 `Array.find` 当 `forEach` 用（回调永远返回 undefined，find 会遍历完整个数组）——**能跑，但语义错误**。
2. 往 TestCase 实例上动态加 `testSuiteName` 字段。这个字段会被 `JSON.stringify(KRData)` **一起写进 storage.local**，然后在 `TestCase.setTestCase` 的白名单里（`['name','commands','tags']`）被过滤掉——所以下次加载时消失。是一个「写得进去、读不出来」的幽灵字段。

#### 用例层（`test-case-service.js`）

| 函数 | 行号 | 行为 |
|---|---|---|
| `createTestCase(title, testSuite)` | `:10-20` | 见 3.2 |
| `deleteTestCase(testCaseID)` | `:27-32` | 委托 `KRData.removeTestCase`（跨套件扫描） |
| `findTestCaseById(testCaseID)` | `:39-46` | **只在非 dynamic 套件里找** |
| `getAllTestCaseCount()` | `:52-58` | 注意：这个函数**没过滤 dynamic**，与 `findTestCaseById` 不一致 |
| `getTag(testCaseID)` | `:60-64` | 过滤空串标签 |

```js
// panel/js/UI/services/data-service/test-case-service.js:39-46
const findTestCaseById = (testCaseID) => {
    const normalTestSuites = KRData.testSuites.filter(e => e.status !== "dynamic");
    for (const testSuite of normalTestSuites) {
        const testCase = testSuite.testCases.find(testCase => testCase.id === testCaseID);
        if (testCase !== undefined) return testCase;
    }
    return null;
}
```

> 与 `TestData.findTestCaseById`（`test-data.js:47-53`）功能重复，唯一差别是这个版本过滤了 dynamic。**两套查找 API 并存**是典型的历史债。

#### 命令层（`test-command-service.js`，全文 10 行）

```js
// panel/js/UI/services/data-service/test-command-service.js:3-9
const setTestCommandStatus = (testCaseID, commandIndex, state) => {
  const testCase = findTestCaseById(testCaseID);
  if (commandIndex >= testCase.commands.length){
    return;
  }
  testCase.commands[commandIndex].status = state;
}
```

命令的增删改**全部绕过 service，直接操作模型**：
- 增：`testCase.commands.push(...)`（`add-command.js:102`）或 `testCase.insertCommandToIndex(...)`（`:78/:82/:99`）
- 改：`saveOldCase()` 批量覆写（见 3.5）
- 删：`testCase.removeCommandAtIndex(i)`（`test-case.js:33-35`）

---

### 3.5 UI ⇄ 内存双向同步：`saveOldCase()` 的全量覆写

KR 的编辑模型是「**DOM 是唯一真相源，内存对象是它的快照**」——这与现代前端完全相反，但理解它才能看懂持久化时序。

#### 方向 A：内存 → DOM（渲染）

选中一个用例时调 `renderTestCaseToRecordGrid`：

```js
// panel/js/UI/view/records-grid/render-test-case-to-record-grid.js:35-55
function generateRecordGridHTML(testCase) {
    let output = "";
    testCase.commands.forEach(command => {
        let htmlOptionList = generateHTMLOptionList(command.targets);
        let commandClass = "", commandStateClass = "";
        if (command.status !== null) {
            commandClass = `class=${command.status}`;
        }
        if (command.state) {
            commandStateClass = `class=${command.state}`;
        }
        let new_tr = `<tr ${commandClass}>` + `<td></td><td ${commandStateClass}><div style="display: none;">` + command.name + '</div><div style="overflow:hidden;height:15px;">' + command.name + ' </div></td>' +
            '<td><div style="display: none;">' + command.defaultTarget + '</div><div style="overflow:hidden;height:15px;">' + command.defaultTarget + '</div>\n' + '<datalist>' + htmlOptionList + '</datalist>' + '</td>' +
            '<td><div style="display: none;">' + command.value + '</div><div class="value" style="display:flex">' + command.value + '</div></td>' + '</tr>';
        output = output + new_tr;
    });

    output = '<input id="records-count" value="' + ((!testCase.commands) ? 0 : testCase.commands.length) + '" type="hidden">' + output;
    return output;
}
```

每一行 `<tr>` 有 4 个 `<td>`：

| td 下标 | 内容 |
|---|---|
| 0 | 空（删除按钮的占位） |
| 1 | 命令名：`div[0]` 隐藏真值 + `div[1]` 显示值 |
| 2 | 定位器：`div[0]` 隐藏真值 + `div[1]` 显示值 + **`<datalist>` 候选列表** |
| 3 | 参数值：`div[0]` 隐藏真值 + `div[1]` 显示值 |

**双 div 结构**是核心技巧：`div[0]`（`display:none`）存**完整原始文本**，`div[1]`（`overflow:hidden;height:15px`）存**可能被截断的显示文本**。读取时按需选择：

```js
// panel/js/UI/view/records-grid/record-utils.js:1-7
function getTdRealValueNode(node, index) {
    return node.getElementsByTagName("td")[index].getElementsByTagName("div")[0];
}

function getTdShowValueNode(node, index) {
    return node.getElementsByTagName("td")[index].getElementsByTagName("div")[1];
}
```

```js
// panel/js/UI/view/records-grid/record-utils.js:20-25
function getCommandTarget(tr, for_show) {
    if (for_show) {
        return getTdShowValueNode(tr, 2).textContent;
    }
    return getTdRealValueNode(tr, 2).textContent;
}
```

而 `add-command.js` 走的是 DOM API 而非 innerHTML：

```js
// panel/js/UI/view/records-grid/render-command-element.js:37-46
// append datalist to target
const targets = document.createElement("datalist");
for (const target of testCommand.targets) {
    const option = document.createElement("option");
    // use textNode to avoid tac's tag problem (textNode's content will be pure text, does not be parsed as html)
    option.appendChild(document.createTextNode(target));
    option.text = target;
    targets.appendChild(option);
}
new_record.getElementsByTagName("td")[2].appendChild(targets);
```

那句注释点出了关键：**TAC（智能定位器）生成的 `d-XPath` 字符串里可能含有尖括号**，用 `createTextNode` 才不会被当 HTML 解析。而 `render-test-case-to-record-grid.js:47-49` 那条 innerHTML 拼串路径**没有这层保护**，只在 `:15` 用 `escapeHTML()`（`common/escape.js:186`，一个白名单标签过滤器）兜了一道。**两条渲染路径的转义强度不一致**，这是坑 #6。

#### 方向 B：DOM → 内存（`saveOldCase`）

```js
// panel/js/UI/view/testcase-grid/utils.js:13-33
//TODO: move saveOldCase() to service
const saveOldCase = () => {
    const selectedCase = getSelectedCase();
    if (selectedCase) {
        const testCaseID = selectedCase.id;
        const testCase = findTestCaseById(testCaseID);
        const recordElements = getRecordsArray();
        for (let i = 0; i < recordElements.length; i++) {
            const testCommand = testCase.commands[i];
            const UICommandName = getCommandName(recordElements[i]);
            const UICommandDefaultTarget = getCommandTarget(recordElements[i]);
            const UICommandValue = getCommandValue(recordElements[i]);
            const UICommandTargets = getCommandTargets(recordElements[i])
            testCommand.name = UICommandName;
            testCommand.defaultTarget = UICommandDefaultTarget;
            testCommand.targets = UICommandTargets;
            testCommand.value = UICommandValue;

        }
    }
}
```

**按下标逐行覆写**。这里有三个隐患：

1. **`testCase.commands[i]` 可能是 undefined**（如果 DOM 行数 > 内存命令数），会抛 `TypeError`。源码没有任何防护。
2. **只同步当前选中的用例**。切换用例前必须先调 `saveOldCase()`，否则编辑丢失。
3. 候选定位器从 `<datalist>` 反读：

```js
// panel/js/UI/view/records-grid/record-utils.js:34-39
function getCommandTargets(tr) {
    if (tr === undefined || !getTargetDatalist(tr)) {
        return [];
    }
    return [...getTargetDatalist(tr).getElementsByTagName("option")].map(ele => ele.textContent);
}
```

**如果某一行的 `<datalist>` 因为任何原因缺失，`targets` 会被覆写成空数组 `[]`，候选定位器永久丢失。**

`saveOldCase()` 的调用点：
- `panel/js/UI/services/data-service/save-data.js:11`（每次落盘前）
- `panel/js/UI/view/records-grid/add-command.js:140`（每录一条命令后）
- 切换用例、切换套件的各个 listener 中

---

### 3.6 HTML `<table>` 序列化：Selenium IDE 的历史遗产

KR 的磁盘格式（`.krecorder` / `.html`）是一份**合法的 XHTML 文档**，每个测试用例是一个 `<table>`。这直接继承自 Selenium IDE 1.x 的 `.html` 格式，好处是「双击能用浏览器打开看」，坏处是解析全靠 DOMParser。

#### 3.6.1 序列化（marshall）：三层嵌套

**第一层 · 命令 → `<tr>`**

```js
// panel/js/UI/services/helper-service/parser.js:92-95
function marshallCommand(command) {
    let targetListHTML = command.targets.map(target => `<option>${target}</option>`).join('');
    return `<tr><td>${command.name}</td><td>${command.defaultTarget}<datalist>${targetListHTML}</datalist></td><td>${command.value}</td></tr>`
}
```

产物形如：

```html
<tr><td>click</td><td>id=login<datalist><option>id=login</option><option>css=#login</option><option>xpath=//button[@id='login']</option></datalist></td><td></td></tr>
```

三个 `<td>`：命令名 / 定位器（含 datalist）/ 值。**注意 `defaultTarget` 是 `<td>` 的第一个文本子节点，`<datalist>` 紧随其后**——这个结构决定了反序列化的读法。

**第二层 · 用例 → `<table>`**

```js
// panel/js/UI/services/helper-service/parser.js:102-111
function marshallTestCase(testCase) {
    let commandsHTMLString = testCase.commands.map(command => marshallCommand(command)).join('\n');
    return `<table cellpadding="1" cellspacing="1" border="1">
<thead>
<tr><td rowspan="1" colspan="3" data-tags="${testCase.tags.toString()}">${testCase.name}</td></tr>
</thead>
<tbody>
${commandsHTMLString}
</tbody></table>`
}
```

- **用例名放在 `<thead><tr><td>` 的文本内容里**
- **标签放在同一个 `<td>` 的 `data-tags` 属性**，多标签用 `Array.toString()` 逗号连接
- `<tbody>` 里是命令行

**第三层 · 套件 → 完整 XHTML 文档**

```js
// panel/js/UI/services/helper-service/parser.js:118-131
const marshall = (testSuite) => {
    let testCasesHTMLString = testSuite.testCases.map(testCase => marshallTestCase(testCase)).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
<meta content="text/html; charset=UTF-8" http-equiv="content-type" />
<title>${testSuite.name}</title>
</head>
<body>
${testCasesHTMLString}
</body>
</html>`
}
```

**套件名藏在 `<title>` 里**。这是唯一存放套件名的地方（`TestSuite.id` 和 `status` 都不落这个格式的盘）。

单元测试给出了逐字节的期望产物（`tests/panel/js/UI/services/helper-service/parser.spec.js:209-234`），复刻时直接对拍即可。

#### 3.6.2 反序列化（unmarshall）

```js
// panel/js/UI/services/helper-service/parser.js:67-84
const unmarshall = (suiteName, suiteHTLMString) => {
    if (!suiteHTLMString) {
        throw "Incorrect format";
    }
    try {
        let testSuite = new TestSuite(suiteName);
        const doc = new DOMParser().parseFromString(suiteHTLMString, "text/html");
        const testCaseElements = doc.getElementsByTagName("table");
        for (const testCaseElement of testCaseElements) {
            const testCase = parseTestCase(testCaseElement);
            testSuite.testCases.push(testCase);
        }
        return testSuite;
    } catch (e) {
        throw "Incorrect format";
    }

}
```

关键点：
- **套件名不是从 `<title>` 读的**，而是由调用方作为参数传入（通常是文件名去后缀，见 `load-html-file.js:19-23`）。`parseSuiteName` 是单独的函数，只在 `load-data.js:32` 处理旧格式时用。
- **用 `"text/html"` 而不是 `"text/xml"` 解析**，所以那个 XHTML DOCTYPE 其实是装饰品，容错率更高。
- **所有异常统一吞成 `"Incorrect format"` 字符串**（不是 Error 对象），调试时定位困难。

用例解析：

```js
// panel/js/UI/services/helper-service/parser.js:39-59
function parseTestCase(testCaseElement) {
    const testCasetd = testCaseElement.querySelector("thead>tr>td");
    const testCaseTitle = testCasetd.innerHTML;
    let testCaseTags=[];
    if(testCasetd.dataset.tags){
        testCaseTags = testCasetd.dataset.tags.indexOf(',') > -1 ? testCasetd.dataset.tags.split(',') : [testCasetd.dataset.tags];
    }
    const testCase = new TestCase();
    testCase.name=testCaseTitle;
    testCase.tags = testCaseTags.filter(e => e !== "");
    const commandElements = testCaseElement.querySelectorAll("tbody tr");
    for (const commandElement of commandElements) {
        const commandPartElements = commandElement.querySelectorAll("td");
        const commandName = parsePredefinedEntity(commandPartElements[0].innerHTML);
        const commandValue = parsePredefinedEntity(commandPartElements[2].innerHTML);
        const { defaultTarget: commandDefaultTarget, targetList: commandTargetList } = parseTarget(commandPartElements[1]);
        const command = new TestCommand(commandName, commandDefaultTarget, commandTargetList, commandValue);
        testCase.commands.push(command);
    }
    return testCase;
}
```

- `new TestCase()` 后再赋值 name/tags → **每次导入都会生成新的 UUID**，原文件里没存 id（见坑 #4）。
- 用例名用的是 `innerHTML` 而非 `textContent`——如果名字里含 `<`，会被 DOMParser 解析成标签然后 innerHTML 还原不回来。

定位器解析（`defaultTarget` 与 `targets` 的分离读取）：

```js
// panel/js/UI/services/helper-service/parser.js:25-31
function parseTarget(targetElement) {
    const commandDefaultTarget = parsePredefinedEntity(targetElement.childNodes[0].data ?? "");
    const commandTargetList = [...targetElement.querySelectorAll("option")].map(element => {
        return parsePredefinedEntity(element.innerHTML);
    });
    return { defaultTarget: commandDefaultTarget, targetList: commandTargetList }
}
```

**`targetElement.childNodes[0].data`** —— 直接取 `<td>` 的第一个子节点（文本节点）的 `.data`。这依赖 marshall 时「defaultTarget 文本在前、datalist 在后」的严格顺序。如果 `defaultTarget` 为空串，`childNodes[0]` 就变成了 `<datalist>` 元素，`.data` 是 undefined，靠 `?? ""` 兜底。

实体解码是手写的四元素表：

```js
// panel/js/UI/services/helper-service/parser.js:5-18
const predefinedEntityMap = {
    "&amp;": "&",
    "&quot;": `"`,
    "&lt;": "<",
    "&gt;": ">"
}

function parsePredefinedEntity(value){
    let changedValue = value;
    for (const entity of Object.keys(predefinedEntityMap)){
        changedValue = changedValue.replaceAll(entity, predefinedEntityMap[entity]);
    }
    return changedValue;
}
```

> **不对称警告**：解码有 `parsePredefinedEntity`，**编码侧完全没有对应函数**。`marshallCommand` 是裸模板字符串拼接。所以一个含 `<` 的定位器（如 `xpath=//div[text()<'5']`）写盘后读回来会错乱。见坑 #6。

#### 3.6.3 `<datalist>` 存档：候选定位器的载体

`<datalist>` 在这里被**滥用为纯数据容器**——它原本是给 `<input list=...>` 做自动补全用的 HTML5 元素，KR 借用了它「浏览器默认不渲染」的特性，把候选定位器数组直接塞进 DOM 又不影响视觉。

数据流全链路：

```
录制端 LocatorBuilders.buildAll(element)        [content/locatorBuilders.js]
   ↓  返回 [[locator, strategyName], ...] 二维数组
add-command.js:45   targetList = arr.map(t => t[0])         → string[]
add-command.js:47   new TestCommand(name, targetList[0], targetList, value)
   ↓
render-command-element.js:38-45   <datalist><option>×N</option></datalist>
   ↓  （用户可能改 defaultTarget，或自愈改写）
record-utils.js:34-39  getCommandTargets(tr)  ← 从 <option> 反读
   ↓
utils.js:28   testCommand.targets = UICommandTargets
   ↓
parser.js:93  `<option>${target}</option>`     → 写盘
   ↓
parser.js:27-29  querySelectorAll("option")    → 读盘
```

这个 `<datalist>` 就是 TECH-02 自愈模块的**输入源**：自愈发生时，回放引擎按顺序尝试 `targets[]` 里的其它定位器，命中后把 `defaultTarget` 换掉。

---

### 3.7 持久化落地：storage.local 的单键大对象

#### 3.7.1 写：一次性整树覆盖

```js
// panel/js/UI/services/data-service/save-data.js:10-16
const saveData = () => {
    saveOldCase();
    const data = {
        data: KRData
    };
    browser.storage.local.set(data);
};
```

**五行代码，三个要点**：

1. `saveOldCase()` 先把当前选中用例的 DOM 编辑刷回内存（3.5）。
2. `browser.storage.local.set({data: KRData})` —— 整棵树作为**一个键 `data`** 写入。Chrome 内部会 `JSON.stringify` 它（结构化克隆 → JSON）。
3. **不是 async/await，不等 Promise**。`beforeunload` 里调用时（`storage.js:39-41`）能否写完是运气问题——见坑 #7。

`JSON.stringify(KRData)` 的产物形状：

```json
{
  "testSuites": [
    {
      "id": "3f2a1b4c-....",
      "name": "Untitled Test Suite",
      "status": "normal",
      "testCases": [
        {
          "id": "8c7d2e5f-....",
          "name": "Untitled Test Case",
          "commands": [
            {
              "name": "open",
              "defaultTarget": "https://example.com/",
              "targets": ["https://example.com/"],
              "value": "",
              "status": null,
              "state": null
            },
            {
              "name": "click",
              "defaultTarget": "id=login",
              "targets": ["id=login", "css=#login", "xpath=//button[@id='login']"],
              "value": "",
              "status": "success",
              "state": null
            }
          ],
          "tags": []
        }
      ],
      "query": ""
    }
  ]
}
```

> **注意**：`status: "success"` 这种上一次回放的结果**会被持久化**，下次打开面板时命令行还带着绿色/红色。这不是刻意设计，是「模型字段全量序列化」的副作用。

#### 3.7.2 读：三分支 + 首次备份

```js
// panel/js/UI/services/data-service/load-data.js:43-59
const loadData = async() => {
    let result = await browser.storage.local.get(null);
    if (result.data) {
        if (result.data instanceof Array) {
            mappingOldSaveFormat(result.data);
        } else {
            mappingDataObject(result.data);
        }
        if (!result.backup) {
            let backupData = getAllTestSuites().map(testSuite => marshall(testSuite));
            let data = {
                backup: backupData
            };
            browser.storage.local.set(data);
        }
    }
}
```

三条分支：

| 条件 | 处理 | 说明 |
|---|---|---|
| `result.data` 是 Array | `mappingOldSaveFormat` | **KR 6.x 及更早**：`data` 是 HTML 字符串数组，每个元素一个套件 |
| `result.data` 是 Object | `mappingDataObject` | **KR 7.x**：`data` 是 `{testSuites:[...]}` |
| `!result.backup` | 生成 `backup` | **一次性迁移备份**，把当前所有套件 marshall 成 HTML 存进 `backup` 键 |

```js
// panel/js/UI/services/data-service/load-data.js:30-36
function mappingOldSaveFormat(htmlArray) {
    for (const htmlString of htmlArray) {
        const suiteName = parseSuiteName(htmlString);
        const testSuite = unmarshall(suiteName, htmlString);
        addTestSuite(testSuite);
    }
}
```

`parseSuiteName` 是唯一用正则（而非 DOMParser）解析 HTML 的地方：

```js
// panel/js/UI/services/helper-service/parser.js:138-142
const parseSuiteName = (htmlString) => {
    const pattern = /<title>(.*)<\/title>/gi;
    const suiteName = pattern.exec(htmlString)[1];
    return suiteName;
}
```

没有 null 检查——文件里没有 `<title>` 就直接 `TypeError: Cannot read property '1' of null`。

新格式的重建：

```js
// panel/js/UI/services/data-service/load-data.js:11-22
function mappingDataObject(data) {
    data.testSuites.map(testSuite => {
        const testCases = testSuite.testCases?.map(testCase => {
            const commands = testCase.commands?.map(command => new TestCommand().setTestCommand(command));
            testCase.commands=commands;
            return new TestCase().setTestCase(testCase);
        });
        testSuite.testCases= testCases ? testCases : [];
        const KRTestSuite = new TestSuite().setTestSuite(testSuite);
        addTestSuite(KRTestSuite);
    });
}
```

**三层 `new X().setX(json)` 工厂调用**，白名单拷贝字段。注意 `TestSuite.setTestSuite` 的白名单是 `['name','status','testCases','query']`（`test-suite.js:38`）——**`id` 不在白名单里！**

这意味着：**每次冷启动，所有套件和用例都会拿到全新的 UUID。** 持久化里存的 id 完全是白存的。这个行为的后果见坑 #4。

#### 3.7.3 时机：启动加载 + 关闭保存

```js
// panel/js/UI/controllers/other-listeners/storage.js:11-36
$(document).ready(function () {
  loadData().then(() => {
    const testSuiteCount = getTestSuiteCount();
    for (let i = 0; i < testSuiteCount; i++) {
      displayNewTestSuite(getTextSuiteByIndex(i));
    }
    if (testSuiteCount > 0){
      $('.command-section').css("min-height","30%")
      //expand test explorer to the first test case
      testSuitContainerOpen();
      const firstTestSuite = getTextSuiteByIndex(0);
      if (firstTestSuite){
        const firstTestSuiteElement = document.getElementById(firstTestSuite.id);
        const testSuiteDropdown = firstTestSuiteElement.getElementsByClassName("dropdown")[0];
        $(testSuiteDropdown).click();
      }
    } else {
        $('.command-section').css("min-height","100%")
    }
    ...
  });
});

// :38-42
// save test suite before exiting
$(window).on('beforeunload', function (e) {
  saveData();
  browser.storage.local.set({ firstTime: false});
});
```

**只有两个持久化时机**：面板打开时读，面板关闭时写。中间的所有编辑都只在内存 + DOM 里。这意味着：

- 浏览器崩溃 / 扩展被 reload / 面板被强杀 → **本次所有编辑全部丢失**
- 没有自动保存、没有 debounce 落盘、没有 IndexedDB 事务

`:23-25` 那段「自动展开第一个套件」用的是 **模拟点击 dropdown**（`$(testSuiteDropdown).click()`）而不是直接调渲染函数，是典型的 UI 驱动式代码。

#### 3.7.4 storage.local 里到底有哪些键

从源码里能确认的键（`browser.storage.local.set/get` 的调用）：

| 键 | 写入处 | 内容 |
|---|---|---|
| `data` | `save-data.js:15` | 整棵 `KRData` |
| `backup` | `load-data.js:56` | 首次迁移时的 HTML 字符串数组 |
| `language` | 读于 `storage.js:30` | 导出脚本语言选择 |
| `firstTime` | `storage.js:41` | 首次启动标记 |
| `extensions` | 读于 `content/command-receiver.js:31` | 用户自定义扩展脚本 |
| `checkLoginData` | `testCase-grid-test-case-listener.js:27-29` | 登录引导计数 |

> `backup` 键**只在第一次加载时写一次**（`if (!result.backup)`），之后永远不更新。它是 6.x→7.x 升级时的一次性快照，不是滚动备份。这是一个容易误解的设计：**它不能用来做「上一次的数据」恢复**。

---

### 3.8 导入导出全路径

#### 3.8.1 导出：`.krecorder`（HTML）与 `.json`（dynamic）

```js
// panel/js/UI/services/html-service/download-suite.js:19-43
let output, fileName, link;
if (testSuite.status === 'dynamic') {
    output = JSON.stringify({
        id: testSuite.id,
        name: testSuite.name,
        status: testSuite.status,
        testCases: [],
        query: testSuite.query
    });
    setSelectedSuite(testSuiteContainerElement.id);
    fileName = testSuite.name + ".json";
    link = makeTextFileJSON(output);
} else {
    output = marshall(testSuite);
    let old_case = getSelectedCase();

    if (old_case) {
        setSelectedCase(old_case.id);
    } else {
        setSelectedSuite(testSuiteContainerElement.id);
    }

    fileName = testSuite.name + ".krecorder";
    link = makeTextFile(output);
}
```

- **普通套件** → `marshall()` → `.krecorder` 文件（内容就是 XHTML）
- **dynamic 套件** → JSON，且 `testCases: []` 硬编码为空（它本来就没有实体用例，只有 query）

下载后还有一段「用实际保存的文件名反向改套件名」的逻辑：

```js
// panel/js/UI/services/html-service/download-suite.js:52-69
const result = function(id) {
    browser.downloads.onChanged.addListener(function downloadCompleted(downloadDelta) {
        if (downloadDelta.id === id && downloadDelta.state &&
            downloadDelta.state.current === "complete") {
            browser.downloads.search({ id: downloadDelta.id }).then(function(download) {
                download = download[0];
                fileName = download.filename.split(/\\|\//).pop();
                testSuite.name = fileName.substring(0, fileName.lastIndexOf("."));
                $(testSuiteContainerElement).find(".modified").removeClass("modified");
                closeConfirm(false);
                testSuiteContainerElement.getElementsByTagName("STRONG")[0].textContent = testSuite.name;
                ...
```

用户在「另存为」对话框里改了文件名，套件名会跟着变。同时清掉 `.modified` 脏标记。

> `saveAs: true` + `conflictAction: 'overwrite'`（`:48-49`）——总是弹「另存为」对话框。

#### 3.8.2 导入：三种文件格式

```js
// panel/js/UI/services/html-service/load-html-file.js:8-32
const loadHTMLFile = (file) => {
    return new Promise((resolve, reject) => {
        if ((!file.name.includes(".krecorder") && !file.name.includes(".html")) && file.type !== "application/json") reject("Wrong file format");

        const reader = new FileReader();
        reader.readAsText(file);

        reader.onload = function() {
            let testSuiteHTMLString = reader.result;
            let suiteName;
            if (file.name.lastIndexOf(".") >= 0) {
                suiteName = file.name.substring(0, file.name.lastIndexOf("."));
            } else {
                suiteName = file.name;
            }
            try {
                if (file.name.includes(".htm") || file.name.includes(".krecorder")) {
                    const testSuite = unmarshall(suiteName, testSuiteHTMLString);
                    resolve(testSuite);
                }
                if (file.name.includes(".json") && file.type === "application/json") {
                    const testSuite = JSON.parse(testSuiteHTMLString);
                    resolve(testSuite);
                }
            } catch (error) {
                reject(error);
            }
        };
```

**套件名 = 文件名去后缀**（`:19-23`）。这是套件名的第二个来源（第一个是 `<title>`，只在旧格式路径用）。

注意 `:10` 的判断用 `includes` 而不是 `endsWith`——文件名 `my.html.backup.txt` 也会被接受。

`panel/index.html` 里的两个 file input：

| 行号 | accept |
|---|---|
| `:143` | `.side` |
| `:147` | `.html,.krecorder,application/json` |

#### 3.8.3 `.side` 导入：Selenium IDE 项目转换

这是三条导入路径里最复杂的，因为要做**命令语义转换**。

入口：

```js
// panel/js/UI/controllers/other-listeners/import-selenium.js:36-48
async function loadSideFile(file) {
  let seleniumTestData = await readJsonFromFile(file);
  let incompatibleCommands = getIncompatibleCommands(seleniumTestData);
  let result = "true";
  if (incompatibleCommands.length > 0) {
    result = await displayWarningIncompatibleCommands(incompatibleCommands);
  }
  if (result === "true") {
    seleniumTestData = parseToRecorderTestSuites(seleniumTestData);
    appendSuitesToGrid(seleniumTestData);
  }
  return seleniumTestData.tests.length;
}
```

**`.side` 的数据结构**（Selenium IDE 4.x 项目格式）：
- `data.tests[]` —— **扁平**的用例列表，每个有 `id`
- `data.suites[]` —— 套件列表，`suite.tests` 是 **id 引用数组**
- `data.urls[]` —— 项目级 base URL 列表

第一步：孤儿用例收容

```js
// panel/js/UI/services/selenium-service/selenium-ide-parser.js:36-55
function modifyByAddingOrphanTestsToDefaultSuite(data) {
  data = JSON.parse(JSON.stringify(data));
  let testsInSuites = data.suites.reduce((testsInSuites, suite) => {
    return [...testsInSuites, ...suite.tests]
  }, []);
  let testIDs = data.tests.map(test => test.id);
  let testsNotInSuites = testIDs.filter(id => !testsInSuites.includes(id));
  if (testsNotInSuites.length !== 0) {
    let defaultSuite = {
      "id": generateUUID(),
      "name": "Default Suite",
      ...
      "tests": testsNotInSuites
    }
    data.suites.push(defaultSuite);
  }
  return data;
}
```

> **注释直接说明了 KR 的模型约束**：`In Selenium, test cases can exist without belonging to a test suite. KR doesn't permit that.`（`:29-30`）——**KR 的用例必须有父套件**，这与 `createTestCase` 里 `if (!testSuite) throw` 的约束一致。

第二步：命令逐条转换

```js
// panel/js/UI/services/selenium-service/selenium-ide-parser.js:74-127
commands.forEach((command, index, commands) => {
  switch (command.command) {
    case "open":       commands[index] = convertOpenCommand(command, urls); break;
    case "assert":     commands[index] = convertAssertCommand(command); break;
    case "verify":     commands[index] = convertVerifyCommand(command); break;
    case "end":        commands[index] = convertEndCommand(command, stack);
                       let popCommand = stack.pop();
                       while (popCommand?.command === "elseIf") { ... }
                       break;
    case "while":      stack.push(command); break;
    case "if":         commands[index] = convertIfCommand(command); stack.push(command); break;
    case "elseIf":     commands[index] = convertIfCommand(command); stack.push(command); break;
    case "executeScript":
    case "executeAsyncScript":
                       commands[index] = convertExecuteScriptCommand(command); break;
    case "waitForElementEditable":
    ... 6 个 waitFor 变体
                       commands[index] = convertWaitForCommand(command); break;
    case "":           commands[index] = convertEmptyCommand(command); break;
    case "selectWindow":
                       commands[index] = convertSelectWindowCommand(command, selectWindowMap); break;
    default:
      if (INCOMPATIBLE_COMMANDS.includes(command.command) || command.command.includes("//")) {
        incompatibleCommandIndexList.push(index);
      }
  }
});
testCase.commands = removeObjectAtIndexes(commands, incompatibleCommandIndexList);
```

不可转换的命令黑名单：

```js
// panel/js/UI/services/selenium-service/command-converter-service.js:1-13
//these commands that we can not convert in anyways
const INCOMPATIBLE_COMMANDS = [
    "debugger", "do", "forEach", "repeatIf", "run",
    "setWindowSize", "storeJson", "storeWindowHandle", "times", "webdriver"
];
```

典型转换示例（`assert` 无对应命令 → 降级为 `assertEval`）：

```js
// panel/js/UI/services/selenium-service/command-converter-service.js:69-75
function convertAssertCommand(command) {
    command = JSON.parse(JSON.stringify(command));
    command.command = "assertEval";
    command.target = '"${' + command.target + '}"==="' + command.value + '"';
    command.value = "true"
    return command;
}
```

`open` 命令的 URL 补全（Selenium 把 base URL 单独存在 `data.urls`）：

```js
// panel/js/UI/services/selenium-service/command-converter-service.js:45-60
function convertOpenCommand(command, urls) {
    command = JSON.parse(JSON.stringify(command));
    if (command.target.indexOf("/") === 0) {
        command.targets.push(...urls.map(url => {
            if (url[url.length - 1] === "/") {
                return url + command.target.substring(1);
            }
            return url + command.target;
        }));
        command.target = command.targets[0];
    } else if (command.target === "") {
        command.targets = [...urls.map(url => url)];
        command.target = urls[0];
    }
    return command;
}
```

**把所有可能的 base URL 都塞进 `targets[]`**，让用户在下拉框里选——巧妙复用了候选定位器机制。

第三步：映射到 KR 对象

```js
// panel/js/UI/services/selenium-service/mapping-selenium-test-bbject-to-kr-test-object.js:13-25
const mappingSeleniumTestObjectToKRTestObject = (seleniumIDESuite, seleniumIDETestCases) => {
    let KRTestSuite = new TestSuite(seleniumIDESuite.name);
    for (const seleniumIDETestCase of seleniumIDETestCases) {
        let KRCommands = seleniumIDETestCase.commands.map(command => {
            const targets = command.targets.map(targetArray => targetArray[0]);
            if (targets.length === 0) targets.push(command.target);
            return new TestCommand(command.command, command.target, targets, command.value);
        });
        let testCase = new TestCase(seleniumIDETestCase.name, KRCommands);
        KRTestSuite.testCases.push(testCase);
    }
    return KRTestSuite;
}
```

- `command.targets` 在 Selenium 里是 `[[locator, strategy], ...]` 二维数组，取 `[0]` 拿定位器字符串——**与 KR 录制端 `add-command.js:45` 的处理完全一致**。
- `if (targets.length === 0) targets.push(command.target)` —— 保证 `targets` 至少有一个元素，否则 datalist 为空、自愈无候选。
- **Selenium 的 id 全部丢弃**，全部重新生成 UUID。

最后挂到树上：

```js
// panel/js/UI/controllers/other-listeners/import-selenium.js:16-27
function appendSuitesToGrid(obj) {
  let testSuites = obj.suites;
  let testCases = obj.tests;
  testSuites.forEach(suite => {
    let suiteTestCases = suite.tests.map(testID => {
      return testCases.find(testCase => testCase.id === testID);
    });
    const KRTestSuite = mappingSeleniumTestObjectToKRTestObject(suite, suiteTestCases);
    addTestSuite(KRTestSuite);
    displayNewTestSuite(KRTestSuite);
  });
}
```

**id 引用 → 实体对象的解引用**在 `:20-22`。注意：**同一个用例被多个套件引用时，会被复制成两份独立的 TestCase**（因为 `mappingSelenium...` 每次都 `new TestCase`）。Selenium 的引用语义在 KR 里变成了值语义。

---

## 四、数据结构 / 状态机 / 时序图

### 4.1 内存对象树

```
window.KRData : TestData                          [panel/js/UI/index.js:19]
└── testSuites : TestSuite[]                      [test-data.js:10]
    └── TestSuite                                 [test-suite.js:6]
        ├── id        : string  (UUID v4)         [test-suite.js:18]
        ├── name      : string  ("Untitled Test Suite")
        ├── status    : "normal" | "dynamic"
        ├── query     : string  (仅 dynamic 用)
        └── testCases : TestCase[]
            └── TestCase                          [test-case.js:6]
                ├── id       : string (UUID v4)   [test-case.js:15]
                ├── name     : string ("Untitled Test Case")
                ├── tags     : string[]
                └── commands : TestCommand[]
                    └── TestCommand               [test-command.js:4]
                        ├── name          : string   "click"
                        ├── defaultTarget : string   "id=login"      ← 当前生效
                        ├── targets       : string[] ["id=login",...] ← 候选池
                        ├── value         : string   ""
                        ├── status        : "success"|"fail"|null    ← 运行时
                        └── state         : string|null              ← 运行时
```

### 4.2 磁盘 / storage 三种表示的对照

| 层 | 载体 | 套件名 | 用例名 | 标签 | 命令 | id |
|---|---|---|---|---|---|---|
| 内存 | JS 对象 | `TestSuite.name` | `TestCase.name` | `TestCase.tags[]` | `TestCommand{}` | UUID |
| storage.local | JSON（键 `data`） | `.name` | `.name` | `.tags` | 对象数组 | **存了但加载时被丢弃** |
| `.krecorder` 文件 | XHTML | `<title>` | `<thead><tr><td>` 文本 | `data-tags` 属性 | `<tbody><tr>` | **完全不存** |

### 4.3 一条命令从录制到落盘的完整时序

```
[页面] 用户点击某元素
   │
   ├─ content/recorder-handlers.js  捕获事件
   ├─ content/locatorBuilders.js    buildAll(element) → [[loc,strategy],...]
   │
   ▼ browser.runtime.sendMessage
[background] panel/js/background/recorder.js  转发
   │
   ▼
[panel] addCommand(name, target_array, value, auto, insert)      add-command.js:21
   │
   ├─ getSelectedSuite()  ────────── null? ──► createTestSuite("Untitled Test Suite")   :29
   │                                            renderNewTestSuite(...)                :30
   ├─ getSelectedCase()   ────────── null? ──► createTestCase("Untitled Test Case", ts) :37
   │                                            renderNewTestCase(...)                 :38
   │
   ├─ targetList = target_array.map(t => t[0])                                          :45
   ├─ new TestCommand(name, targetList[0], targetList, value)                           :47
   │
   ├─ modifyCaseSuite()        ← 打脏标记                                                :51
   ├─ renderCommandElement(testCommand)  → <tr> + <datalist>                            :54
   │
   ├─ [有选中行] testCase.insertCommandToIndex(idx, cmd)                                 :78/:82
   │  [无选中行] testCase.commands.push(cmd)                                             :102
   │
   ├─ reAssignId(...) / attachEvent(...)   ← 重排 DOM id                                 :86/:106
   ├─ 填充 div_show 文本（d-XPath → "auto-located-by-tac"）                              :120-138
   └─ saveOldCase()            ← DOM 反刷内存                                            :140
   
                       …… 用户继续操作 ……

[panel] window beforeunload                                     storage.js:39
   │
   ▼ saveData()                                                 save-data.js:10
   ├─ saveOldCase()                                             save-data.js:11
   └─ browser.storage.local.set({data: KRData})                 save-data.js:15
```

### 4.4 冷启动装载时序

```
$(document).ready                                    storage.js:11
   │
   ▼ await loadData()                                load-data.js:43
   ├─ browser.storage.local.get(null)                          :44
   ├─ result.data instanceof Array?
   │    ├─ Y → mappingOldSaveFormat()                          :47
   │    │        └─ 每个 HTML 串: parseSuiteName + unmarshall   :30-36
   │    └─ N → mappingDataObject()                             :49
   │             └─ new TestSuite().setTestSuite(              :19
   │                  { testCases: new TestCase().setTestCase( :16
   │                      { commands: new TestCommand()
   │                                    .setTestCommand(c) }) })  :14
   │                ⚠ id 不在白名单 → 全部重新生成 UUID
   │
   └─ !result.backup?  → 一次性 marshall 备份                    :51-57
   
   .then(() => {
       for i in testSuites: displayNewTestSuite(...)            storage.js:14-16
       模拟点击第一个套件的 dropdown 展开                          storage.js:23-25
   })
```

### 4.5 「Untitled」判定的决策树

```
              addCommand() 被调用
                     │
        ┌────────────┴────────────┐
        │  DOM 中有 .selectedSuite ?│
        └────────────┬────────────┘
             否 │            │ 是
                ▼            ▼
  createTestSuite(          findTestSuiteById(
   "Untitled Test Suite")     selectedTestSuite.id)
                │            │
                └─────┬──────┘
                      ▼
        ┌────────────┴────────────┐
        │  DOM 中有 .selectedCase ? │
        └────────────┬────────────┘
             否 │            │ 是
                ▼            ▼
  createTestCase(           findTestCaseById(
   "Untitled Test Case",      selectedTestCase.id)
   testSuite)
                │            │
                └─────┬──────┘
                      ▼
              命令挂到 testCase.commands
```

> 判定条件是 **DOM 选中态**，不是「数据里有没有用例」。这是理解 KR 行为的关键。

---

## 五、隐晦知识点与坑

### 坑 #1 · `setTestCommand` 的 truthy 白名单会吞掉合法的 falsy 值

```js
// panel/js/UI/models/test-model/test-command.js:26-30
for (const key of keys) {
    if (command[key]) {          // ← truthy 判断
        newCommand[key] = command[key];
    }
}
```

| 原值 | 是否被拷贝 | 结果 |
|---|---|---|
| `value: ""` | ✘ | 回落默认 `""`，**恰好正确** |
| `value: "0"` | ✔ | 正确（非空字符串是 truthy） |
| `targets: []` | ✘ | 回落默认 `[]`，**恰好正确** |
| `status: 0` | ✘ | 回落 `null`——语义变了 |
| `state: false` | ✘ | 回落 `null` |

目前恰好没出事，因为所有 falsy 值的默认值语义一致。但**只要将来加一个 `enabled: boolean` 字段，`enabled: false` 就会被静默变成 undefined**。

**修法**：改成 `if (key in command)` 或 `if (command[key] !== undefined)`。

同样的问题存在于 `TestCase.setTestCase`（`test-case.js:42`）和 `TestSuite.setTestSuite`（`test-suite.js:42`）。

---

### 坑 #2 · `createTestCase` 的 `null` 与 `undefined` 走两条不同的路

```js
// panel/js/UI/services/data-service/test-case-service.js:10-11
const createTestCase = (title = "Untitled Test Case", testSuite) => {
    title = title !== null ? title : "Untitled Test Case";
```

- `createTestCase(undefined, ts)` → ES6 默认参数生效 → `"Untitled Test Case"`
- `createTestCase(null, ts)` → 默认参数**不生效**（只对 undefined 生效）→ 靠 `:11` 三元兜住

如果只写默认参数不写三元，`null` 会直接变成用例名。单元测试 `test-case-service.spec.js:26` 专门守着这个行为。

**另一个副作用**：`createTestCase("", ts)` 会创建一个**名字是空串**的用例（空串既不是 null 也不是 undefined）。UI 上显示为空白行。

---

### 坑 #3 · TestCommand 没有 id，一切靠数组下标

`saveOldCase()` 按下标一一对应：

```js
// panel/js/UI/view/testcase-grid/utils.js:20-21
for (let i = 0; i < recordElements.length; i++) {
    const testCommand = testCase.commands[i];
```

**只要 DOM 行数与内存命令数不一致，就会错位或崩溃**：
- DOM 行 > 内存命令 → `testCommand` 是 undefined → `TypeError: Cannot set property 'name' of undefined`
- DOM 行 < 内存命令 → 尾部命令保留旧值（不会被删）

`add-command.js:96-100` 那个 `insertCommand` 分支尤其可疑：

```js
// panel/js/UI/view/records-grid/add-command.js:96-101
if (insertCommand) {
    //insert before last command
    const index = testCase.getTestCommandCount() - 2;
    testCase.insertCommandToIndex(index, testCommand);
    document.getElementById("records-grid").insertBefore(new_record, getRecordsArray()[index]);
}
```

`getTestCommandCount() - 2`：当命令数为 0 或 1 时，index 是 -2 或 -1。`splice(-1, 0, x)` 会插到**倒数第一个之前**，`splice(-2, 0, x)` 在长度 0 时等价 `splice(0,...)`。行为可用但极难推理。

**复刻建议**：给每个 command 加 UUID，DOM 上用 `data-cmd-id` 关联，彻底告别下标同步。

---

### 坑 #4 · 持久化里的 id 是"写了但不读"的死字段

```js
// panel/js/UI/models/test-model/test-suite.js:37-47
setTestSuite(testsuite) {
    let keys = ['name', 'status', 'testCases', 'query'];   // ← 没有 'id'
    let testSuite = new TestSuite();                       // ← 构造时已生成新 UUID
    ...
}
```

```js
// panel/js/UI/models/test-model/test-case.js:37-47
setTestCase(testcase) {
    let keys = ['name', 'commands', 'tags'];               // ← 没有 'id'
```

**每次冷启动，所有 id 重新生成。** 后果：

1. 任何存了套件/用例 id 的外部引用（比如「上次选中的用例」、URL 参数、日志里的 id）在重启后全部失效。
2. `.json` 格式导出的 dynamic 套件里带了 `id`（`download-suite.js:22`），导入回来也不会被采用。
3. 如果你想做「跨设备同步」或「云端项目」，**必须先把 id 加进白名单**，否则每台设备的 id 都不一样。

**验证方式**：打开面板 → 记下某套件 DOM 元素的 id → 关闭 → 重开 → id 变了。

---

### 坑 #5 · `getAllTestCases()` 会往模型对象里塞幽灵字段

```js
// panel/js/UI/services/data-service/test-suite-service.js:94-97
testSuite.testCases.find(e => {
    e.testSuiteName = testSuite.name;    // ← 写进了 TestCase 实例
    testCases.push(e);
});
```

`testSuiteName` 会被 `JSON.stringify(KRData)` 一并写进 storage.local，但因为不在 `setTestCase` 白名单（`['name','commands','tags']`）里，重启后消失。这是一个「会撑大存储、但永远读不出来」的字段。

同时这里用 `Array.find` 当 `forEach` 用——回调返回 undefined，find 会遍历完全部元素后返回 undefined，**功能上等价 forEach 但语义完全错误**，代码审查时极易误读为「只处理第一个」。

`getTagsData()`（`:74-78`）也是同样的 `find` 滥用。

---

### 坑 #6 · marshall 侧没有 HTML 转义，与 unmarshall 侧不对称

**解码有**：

```js
// panel/js/UI/services/helper-service/parser.js:12-18
function parsePredefinedEntity(value){
    let changedValue = value;
    for (const entity of Object.keys(predefinedEntityMap)){
        changedValue = changedValue.replaceAll(entity, predefinedEntityMap[entity]);
    }
    return changedValue;
}
```

**编码没有**：

```js
// panel/js/UI/services/helper-service/parser.js:92-95
function marshallCommand(command) {
    let targetListHTML = command.targets.map(target => `<option>${target}</option>`).join('');
    return `<tr><td>${command.name}</td><td>${command.defaultTarget}<datalist>${targetListHTML}</datalist></td><td>${command.value}</td></tr>`
}
```

含尖括号的定位器/值写盘后会破坏 HTML 结构。举例：

```
value = "<b>hi</b>"
→ 写盘: <td><b>hi</b></td>
→ 读回: commandPartElements[2].innerHTML === "<b>hi</b>"   （碰巧还原了）

value = "a < b"
→ 写盘: <td>a < b</td>
→ DOMParser 把 "< b</td>" 当成不合法标签处理，读回可能是 "a "
```

`parsePredefinedEntity` 之所以还能工作，是因为 **DOMParser 在读 `innerHTML` 时会自动把裸文本里的 `&` 编码成 `&amp;`**，解码表是在补这一步的偏差，而不是在补 marshall 的偏差。

**渲染侧也不对称**：`render-command-element.js:42` 用 `createTextNode`（安全），`render-test-case-to-record-grid.js:47-49` 用 innerHTML 拼串 + `escapeHTML()`（`common/escape.js:186`，白名单标签过滤）。**两条路径的行为在含特殊字符时会不一致。**

**修法**：在 marshall 侧加一个对称的 `escapePredefinedEntity()`，把 `& < > "` 编码。注意顺序：`&` 必须先编码。

---

### 坑 #7 · `beforeunload` 里调 `storage.local.set` 不保证写完

```js
// panel/js/UI/controllers/other-listeners/storage.js:39-42
$(window).on('beforeunload', function (e) {
  saveData();
  browser.storage.local.set({ firstTime: false});
});
```

```js
// panel/js/UI/services/data-service/save-data.js:15
browser.storage.local.set(data);     // 没有 await，没有 .then
```

`chrome.storage.local.set` 是**异步**的。`beforeunload` 返回后页面即被销毁，未完成的写入可能被丢弃。数据量越大（几百条命令 × 每条 5 个候选定位器）越容易丢。

MV3 下面板是 side panel / popup 页面，关闭时机不受控，这个问题被放大。

**修法（三选一）**：
1. 编辑时 debounce 落盘（每 2 秒或每 N 次编辑写一次），不依赖 beforeunload。
2. 用 `chrome.storage.session` + service worker 中转（SW 生命周期比页面长）。
3. 改用 IndexedDB（`transaction.commit()` 有更明确的持久化语义）。

---

### 坑 #8 · `backup` 键只写一次，不是滚动备份

```js
// panel/js/UI/services/data-service/load-data.js:51-57
if (!result.backup) {
    let backupData = getAllTestSuites().map(testSuite => marshall(testSuite));
    let data = { backup: backupData };
    browser.storage.local.set(data);
}
```

`if (!result.backup)` —— **只要 `backup` 键存在，永远不再更新**。它是 6.x→7.x 升级时的一次性快照。用户以为「有备份」，实际上备份可能是几个月前的。

而且这份备份还会**永久占用配额**（HTML 格式比 JSON 大很多）。这是 `unlimitedStorage` 权限的隐藏原因之一。

---

### 坑 #9 · 两套并存的查找 API，过滤规则不一致

| API | 位置 | 是否过滤 dynamic |
|---|---|---|
| `TestData.findTestCaseById` | `test-data.js:47-53` | ✘ |
| `test-case-service.findTestCaseById` | `test-case-service.js:39-46` | ✔ |
| `TestData.findTestSuiteById` | `test-data.js:43-45` | ✘ |
| `test-suite-service.findTestSuiteById` | `test-suite-service.js:58-60` | ✘ |
| `test-case-service.getAllTestCaseCount` | `test-case-service.js:52-58` | ✘ **（不一致）** |

`getAllTestCaseCount` 统计时把 dynamic 套件也算进去了，而 `findTestCaseById` 找不到 dynamic 里的用例。计数与查找口径不一致。

（实践中 dynamic 套件的 `testCases` 恒为空数组，所以暂时没暴露。）

---

### 坑 #10 · 用例名用 `innerHTML` 读，含 HTML 会被吞

```js
// panel/js/UI/services/helper-service/parser.js:40-41
const testCasetd = testCaseElement.querySelector("thead>tr>td");
const testCaseTitle = testCasetd.innerHTML;      // ← 不是 textContent
```

用例名叫 `<Login> Flow` 时，DOMParser 会把 `<Login>` 当成未知标签，`innerHTML` 返回 `<login> Flow</login>`。名字被永久污染。

命令名和值走的是 `commandPartElements[0].innerHTML` + `parsePredefinedEntity`（`:52-53`），同样的问题。

---

### 坑 #11 · 「拖拽排序」与内存的同步依赖 `saveOldCase` 的全量重刷

`view/testcase-grid/make-case-sortable.js` 用 jQuery UI sortable 做用例拖拽。命令行的拖拽排序**只改 DOM 顺序**，靠后续的 `saveOldCase()`（按下标全量覆写）把新顺序刷回内存。

这意味着：**拖拽后如果没有触发任何 `saveOldCase()` 就关闭面板，顺序不会保存**——但 `beforeunload → saveData → saveOldCase` 恰好兜住了。这是一个「靠巧合正确」的设计。

---

### 坑 #12 · `.side` 导入的引用语义变值语义

```js
// panel/js/UI/controllers/other-listeners/import-selenium.js:20-23
let suiteTestCases = suite.tests.map(testID => {
  return testCases.find(testCase => testCase.id === testID);
});
const KRTestSuite = mappingSeleniumTestObjectToKRTestObject(suite, suiteTestCases);
```

Selenium 里一个用例可以被多个套件引用（共享）。KR 的 `mappingSeleniumTestObjectToKRTestObject` 每次都 `new TestCase(...)`（`mapping-...js:21`），所以**同一个用例被复制成 N 份独立副本**，改一份不影响另一份。

导入 5 个套件共享 1 个用例的 `.side` 文件，会得到 5 个同名用例。

---

### 坑 #13 · `d-XPath` 的显示替换只在 UI，不在数据

```js
// panel/js/UI/view/records-grid/add-command.js:126-129
string = command_target_array[0][0].toString();
if (string.includes("d-XPath")) {
    string = "auto-located-by-tac";
}
```

只替换了 `div_show`（可见层）的文本，`div_hidden`（真值层）和 `TestCommand.defaultTarget` 里仍是原始 `d-XPath` 字符串。回放时 `browserbot.findElement` 有专门的特判：

```js
// content/selenium-browserbot.js:1622-1626
if (locator.includes("d-XPath")) {
    throw new SeleniumError("Element located by TAC not found");
} else if (locator == "auto-located-by-tac") {
    throw new SeleniumError("The value \"auto-located-by-tac\" only can be automatically generated when recording a command");
}
```

**如果用户手动把显示文本 `auto-located-by-tac` 复制到另一行，回放必然报第二个错。**

---

## 六、裁剪建议

### 6.1 保留（原样或轻改）

| 模块 | 文件 | 理由 |
|---|---|---|
| 四层模型类 | `models/test-model/*.js`（195 行） | 极简、无依赖，直接抄。**唯一必改**：`setXxx` 白名单加 `id`、truthy 改 `in` |
| 用例/套件 CRUD | `data-service/test-case-service.js`、`test-suite-service.js` | 删掉 tag/dynamic 相关后约 60 行 |
| 「Untitled」兜底逻辑 | `add-command.js:28-43` | 这段 16 行就是整个「默认用例」特性的全部，直接抄 |
| 序列化 | `helper-service/parser.js` | 若坚持 HTML 格式则保留，**必须补 marshall 侧转义** |
| `<datalist>` 候选存档 | `render-command-element.js:37-46` + `record-utils.js:34-39` | 自愈的数据基础，必须保留 |
| 双 div（真值/显示值）结构 | `record-utils.js:1-7` | 长文本截断 + 保真的巧妙解法 |
| storage 读写 | `load-data.js` + `save-data.js` | 删旧格式分支后约 40 行 |
| 导入导出 | `download-suite.js` + `load-html-file.js` | 删 dynamic 分支后约 70 行 |

### 6.2 删除

| 模块 | 文件 | 理由 |
|---|---|---|
| dynamic 测试套件 | `test-suite-service.js:66-118`、`view/dynamic-test-suite/*` | 「按标签动态聚合」是企业特性，个人插件用不上 |
| 标签系统 | `TestCase.tags`、`getTagsData`、`auditTags`、`getTag` | 与 dynamic 强绑定 |
| `.side` 导入全套 | `import-selenium.js`、`selenium-service/*`（360 行） | 除非明确要兼容 Selenium IDE 项目 |
| 旧格式兼容 | `load-data.js:30-36`、`parseSuiteName` | 你的插件没有历史用户 |
| `backup` 一次性备份 | `load-data.js:51-57` | 一次性迁移逻辑，且实现有缺陷（见坑 #8） |
| 埋点 | `trackingCreateTestCase`/`trackingCreateTestSuite`/`trackingSegment` | |
| 登录引导 | `testCase-grid-test-case-listener.js:26-30, 77-89`、`userService`、`usageWatcher`、`popupPromoteSignup` | |
| `read-suite-from-string.js` | 10 行 | 外部消息注入通道，安全风险 > 收益 |
| `getAllTestCases` 的 `testSuiteName` 副作用 | `test-suite-service.js:95` | 幽灵字段 |
| `TestSuite` 构造里的冗余 undefined 检查 | `test-suite.js:15-17` | ES6 默认参数已覆盖 |

### 6.3 替换

| 原实现 | 替换为 | 理由 |
|---|---|---|
| `generateUUID()`（`utils.js:22-29`，8 行） | `crypto.randomUUID()` | MV3 扩展页是 secure context，原生可用 |
| **命令无 id，靠数组下标同步** | 每个 TestCommand 加 `id: crypto.randomUUID()`，DOM 用 `data-cmd-id` | 根治坑 #3、免掉 `reAssignId` |
| **DOM 为真相源 + `saveOldCase` 全量覆写** | 内存为真相源，DOM 编辑触发单条 patch | 根治坑 #3、#11 |
| **HTML `<table>` 序列化** | JSON（`.json` / `.krjson`） | 无转义坑、可读、体积小、`JSON.parse` 天然安全 |
| **`beforeunload` 时才落盘** | debounce 500ms 自动落盘 + `visibilitychange` 兜底 | 根治坑 #7 |
| `browser.storage.local`（单键大对象） | 单键仍可，但**每个套件一个键**（`suite:<uuid>`） | 避免每次改一条命令重写整棵树；配额压力也小 |
| `render-test-case-to-record-grid.js` 的 innerHTML 拼串 | 统一走 `render-command-element.js` 的 DOM API 路径 | 根治坑 #6 的渲染侧不一致 |
| `setXxx` 的 truthy 白名单 | `Object.assign` + 显式 id 保留 | 根治坑 #1、#4 |
| 异常抛裸字符串（`throw "Incorrect format"`） | `throw new Error(...)` | 保留栈信息 |
| `getAllTestCases` 里的 `Array.find` 滥用 | `forEach` / `flatMap` | 语义正确 |

### 6.4 裁剪后的体量估算

| 分类 | 原行数 | 裁剪后 |
|---|---|---|
| 模型层 | 195 | ~150（加 command id、修白名单） |
| 服务层（CRUD） | 267 | ~90（删 tag/dynamic） |
| 序列化 | 143 | ~50（改 JSON） |
| 持久化 | 109 | ~60（加 debounce、删旧格式） |
| 导入导出 | 138 | ~80 |
| `.side` 支持 | 360 | 0 |
| UI 桥接 | ~350 | ~200 |
| **合计** | **~1560** | **~630** |

---

## 七、最小可用实现（MVP 代码骨架）

以下是可直接落地的重写版本，**不追求与 KR 逐行等价，而是保留其全部有效设计、修掉全部已知坑**。

### 7.1 `model.js` —— 四层模型（含 command id）

```js
// src/data/model.js
const uid = () => crypto.randomUUID();

export class TestCommand {
  /**
   * @param {string} name          命令名，如 "click" / "type" / "assertText"
   * @param {string} defaultTarget 当前生效的定位器，如 "id=login"
   * @param {string[]} targets     候选定位器池（自愈用）
   * @param {string} value         第二参数
   */
  constructor(name = '', defaultTarget = '', targets = [], value = '') {
    this.id = uid();                 // ★ KR 没有，是坑 #3 的根源
    this.name = name;
    this.defaultTarget = defaultTarget;
    this.targets = targets.length ? targets : (defaultTarget ? [defaultTarget] : []);
    this.value = value;
    this.status = null;              // 'success' | 'fail' | null（运行时，不落盘）
  }

  static fromJSON(o) {
    const c = new TestCommand(o.name, o.defaultTarget, o.targets ?? [], o.value ?? '');
    if (o.id) c.id = o.id;           // ★ 保留 id，修坑 #4
    return c;
  }

  toJSON() {
    // 运行时状态不落盘，修「上次结果被持久化」的副作用
    const { id, name, defaultTarget, targets, value } = this;
    return { id, name, defaultTarget, targets, value };
  }
}

export class TestCase {
  constructor(name = 'Untitled Test Case', commands = []) {
    this.id = uid();
    this.name = name;
    this.commands = commands;
  }

  get commandCount() { return this.commands.length; }

  insertAt(index, cmd) { this.commands.splice(index, 0, cmd); }
  removeAt(index)      { return this.commands.splice(index, 1)[0]; }
  removeById(cmdId) {
    const i = this.commands.findIndex(c => c.id === cmdId);
    return i < 0 ? null : this.commands.splice(i, 1)[0];
  }
  findById(cmdId) { return this.commands.find(c => c.id === cmdId) ?? null; }

  static fromJSON(o) {
    const tc = new TestCase(o.name ?? 'Untitled Test Case',
                            (o.commands ?? []).map(TestCommand.fromJSON));
    if (o.id) tc.id = o.id;
    return tc;
  }
}

export class TestSuite {
  constructor(name = 'Untitled Test Suite', testCases = []) {
    this.id = uid();
    this.name = name;
    this.testCases = testCases;
  }

  get caseCount() { return this.testCases.length; }
  indexOfCase(caseId) { return this.testCases.findIndex(tc => tc.id === caseId); }
  insertCaseAt(index, tc) { this.testCases.splice(index, 0, tc); }

  static fromJSON(o) {
    const ts = new TestSuite(o.name ?? 'Untitled Test Suite',
                             (o.testCases ?? []).map(TestCase.fromJSON));
    if (o.id) ts.id = o.id;
    return ts;
  }
}

export class TestData {
  constructor(testSuites = []) { this.testSuites = testSuites; }

  get suiteCount() { return this.testSuites.length; }

  findSuite(suiteId) { return this.testSuites.find(s => s.id === suiteId) ?? null; }

  findCase(caseId) {
    for (const s of this.testSuites) {
      const tc = s.testCases.find(c => c.id === caseId);
      if (tc) return tc;
    }
    return null;
  }

  findSuiteOfCase(caseId) {
    return this.testSuites.find(s => s.testCases.some(c => c.id === caseId)) ?? null;
  }

  removeSuite(suiteId) {
    const i = this.testSuites.findIndex(s => s.id === suiteId);
    return i < 0 ? null : this.testSuites.splice(i, 1)[0];
  }

  removeCase(caseId) {
    const s = this.findSuiteOfCase(caseId);
    if (!s) return null;
    return s.testCases.splice(s.indexOfCase(caseId), 1)[0];
  }

  static fromJSON(o) {
    return new TestData((o?.testSuites ?? []).map(TestSuite.fromJSON));
  }
}
```

### 7.2 `store.js` —— 单例状态 + debounce 持久化

```js
// src/data/store.js
import { TestData, TestSuite, TestCase } from './model.js';

const STORAGE_KEY = 'krmini:data';
const SAVE_DEBOUNCE_MS = 500;

/** @type {TestData} */
export let db = new TestData();

let saveTimer = null;
let savePending = false;

/** 标记数据已变更，触发 debounce 落盘 */
export function markDirty() {
  savePending = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, SAVE_DEBOUNCE_MS);
}

/** 立即落盘（返回 Promise，可 await） */
export async function flush() {
  if (!savePending) return;
  savePending = false;
  clearTimeout(saveTimer);
  await chrome.storage.local.set({ [STORAGE_KEY]: JSON.parse(JSON.stringify(db)) });
}

export async function load() {
  const res = await chrome.storage.local.get(STORAGE_KEY);
  db = TestData.fromJSON(res[STORAGE_KEY]);
  return db;
}

// 兜底：页面隐藏 / 卸载时同步冲刷
// 修坑 #7：不再只依赖 beforeunload
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});
window.addEventListener('pagehide', () => { flush(); });
```

> **进阶（可选）**：把 `STORAGE_KEY` 拆成 `suite:<uuid>` 分键存储，改一条命令只重写一个套件。代价是要维护一个 `suiteIndex` 键。

### 7.3 `services.js` —— CRUD + 「Untitled」兜底（本模块的灵魂 15 行）

```js
// src/data/services.js
import { db, markDirty } from './store.js';
import { TestSuite, TestCase, TestCommand } from './model.js';

export const DEFAULT_SUITE_NAME = 'Untitled Test Suite';
export const DEFAULT_CASE_NAME  = 'Untitled Test Case';

export function createSuite(name) {
  // 同时兜住 undefined / null / ''，比 KR 更严
  const ts = new TestSuite(name || DEFAULT_SUITE_NAME);
  db.testSuites.push(ts);
  markDirty();
  return ts;
}

export function createCase(name, suite) {
  if (!suite) throw new Error('createCase: suite is required');
  const tc = new TestCase(name || DEFAULT_CASE_NAME);
  suite.testCases.push(tc);
  markDirty();
  return tc;
}

export function deleteSuite(suiteId) { const r = db.removeSuite(suiteId); markDirty(); return r; }
export function deleteCase(caseId)   { const r = db.removeCase(caseId);   markDirty(); return r; }

/** 更新单条命令的某个字段（替代 KR 的 saveOldCase 全量覆写） */
export function patchCommand(caseId, cmdId, patch) {
  const tc = db.findCase(caseId);
  const cmd = tc?.findById(cmdId);
  if (!cmd) return false;
  Object.assign(cmd, patch);
  markDirty();
  return true;
}
```

### 7.4 `recording.js` —— 「Untitled Test Case」的兜底调用链

**这是 M08 最核心的 20 行**，完整对应 `add-command.js:21-47`：

```js
// src/data/recording.js
import { db, markDirty } from './store.js';
import { createSuite, createCase, DEFAULT_SUITE_NAME, DEFAULT_CASE_NAME } from './services.js';
import { TestCommand } from './model.js';
import { getSelection, selectSuite, selectCase } from '../ui/selection.js';

/**
 * 录制端送来一条命令时的唯一入口。
 *
 * @param {string} name          命令名
 * @param {Array<[string,string]>} targetPairs  LocatorBuilders 产物 [[locator, strategy], ...]
 * @param {string} value
 * @param {{insertAfterSelected?: boolean}} opt
 */
export function addRecordedCommand(name, targetPairs, value, opt = {}) {
  // ─── 1. 兜底：确保有套件 ───────────────────────────────
  // 判定依据是「当前是否有选中」，不是「数据里有没有」
  // 这正是 KR 的行为（add-command.js:28-35）
  let { suiteId, caseId } = getSelection();
  let suite = suiteId ? db.findSuite(suiteId) : null;
  if (!suite) {
    suite = createSuite(DEFAULT_SUITE_NAME);   // ← "Untitled Test Suite" 出生地
    selectSuite(suite.id);
  }

  // ─── 2. 兜底：确保有用例 ───────────────────────────────
  let tcase = caseId ? db.findCase(caseId) : null;
  if (!tcase || db.findSuiteOfCase(tcase.id) !== suite) {
    tcase = createCase(DEFAULT_CASE_NAME, suite); // ← "Untitled Test Case" 出生地
    selectCase(tcase.id);
  }

  // ─── 3. 候选定位器：二维数组 → 一维字符串数组 ─────────────
  const targets = targetPairs.map(pair => pair[0]);          // 对应 add-command.js:45
  const cmd = new TestCommand(name, targets[0] ?? '', targets, value);

  // ─── 4. 插入 ─────────────────────────────────────────
  if (opt.insertAfterSelected && opt.selectedCmdId) {
    const i = tcase.commands.findIndex(c => c.id === opt.selectedCmdId);
    tcase.insertAt(i + 1, cmd);
  } else {
    tcase.commands.push(cmd);
  }
  markDirty();
  return cmd;
}
```

> **对照结论**：`"Untitled Test Case"` 的全部逻辑就是上面第 2 步的 4 行。没有任何识别、推断、页面标题解析。

### 7.5 `serialize.js` —— JSON 格式（推荐）+ HTML 格式（兼容 KR）

```js
// src/data/serialize.js
import { TestSuite, TestCase, TestCommand } from './model.js';

/* ══════════════ 方案 A：JSON（推荐） ══════════════ */

export function toJSONFile(suite) {
  return JSON.stringify({ version: 1, suite }, null, 2);
}

export function fromJSONFile(text) {
  const o = JSON.parse(text);
  return TestSuite.fromJSON(o.suite ?? o);
}

/* ══════════ 方案 B：HTML <table>（与 KR .krecorder 兼容） ══════════ */

// ★ 修坑 #6：补上 marshall 侧的转义（KR 完全没有）
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ESC[ch]);

function marshallCommand(c) {
  const opts = c.targets.map(t => `<option>${esc(t)}</option>`).join('');
  return `<tr><td>${esc(c.name)}</td>`
       + `<td>${esc(c.defaultTarget)}<datalist>${opts}</datalist></td>`
       + `<td>${esc(c.value)}</td></tr>`;
}

function marshallTestCase(tc) {
  const body = tc.commands.map(marshallCommand).join('\n');
  return `<table cellpadding="1" cellspacing="1" border="1">
<thead>
<tr><td rowspan="1" colspan="3">${esc(tc.name)}</td></tr>
</thead>
<tbody>
${body}
</tbody></table>`;
}

export function marshall(suite) {
  const tables = suite.testCases.map(marshallTestCase).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
<meta content="text/html; charset=UTF-8" http-equiv="content-type" />
<title>${esc(suite.name)}</title>
</head>
<body>
${tables}
</body>
</html>`;
}

function parseTarget(td) {
  // defaultTarget 是 <td> 的第一个文本节点；候选在 <datalist><option>
  const first = td.childNodes[0];
  const defaultTarget = (first && first.nodeType === Node.TEXT_NODE) ? first.data : '';
  const targets = [...td.querySelectorAll('option')].map(o => o.textContent);
  return { defaultTarget, targets };
}

function parseTestCase(table) {
  const head = table.querySelector('thead>tr>td');
  // ★ 修坑 #10：用 textContent 而不是 innerHTML
  const tc = new TestCase(head ? head.textContent : 'Untitled Test Case', []);
  for (const tr of table.querySelectorAll('tbody tr')) {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 3) continue;
    const { defaultTarget, targets } = parseTarget(tds[1]);
    tc.commands.push(new TestCommand(tds[0].textContent, defaultTarget, targets, tds[2].textContent));
  }
  return tc;
}

export function unmarshall(suiteName, html) {
  if (!html) throw new Error('unmarshall: empty input');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const suite = new TestSuite(suiteName);
  for (const table of doc.getElementsByTagName('table')) {
    suite.testCases.push(parseTestCase(table));
  }
  return suite;
}

export function parseSuiteName(html) {
  const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
  return m ? m[1] : 'Untitled Test Suite';   // ★ 修 KR 的 null 解引用
}
```

### 7.6 `io.js` —— 导入导出

```js
// src/data/io.js
import { db, markDirty } from './store.js';
import { TestSuite } from './model.js';
import { marshall, unmarshall, parseSuiteName, toJSONFile, fromJSONFile } from './serialize.js';

const EXT = '.krmini';

export async function exportSuite(suiteId, format = 'json') {
  const suite = db.findSuite(suiteId);
  if (!suite) throw new Error('suite not found');

  const [text, mime, ext] = format === 'html'
    ? [marshall(suite), 'text/html', '.krecorder']
    : [toJSONFile(suite), 'application/json', EXT];

  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  try {
    await chrome.downloads.download({
      filename: `${suite.name}${ext}`,
      url, saveAs: true, conflictAction: 'overwrite'
    });
  } finally {
    // Blob URL 及时释放，KR 没做这一步
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export async function importFile(file) {
  const text = await file.text();
  const base = file.name.replace(/\.[^.]+$/, '');
  let suite;

  if (/\.(krecorder|html?)$/i.test(file.name)) {
    // 优先用 <title>，回落到文件名（KR 只用文件名）
    suite = unmarshall(parseSuiteName(text) || base, text);
  } else {
    suite = fromJSONFile(text);
    if (!suite.name) suite.name = base;
  }

  db.testSuites.push(suite);
  markDirty();
  return suite;
}
```

### 7.7 `grid-binding.js` —— DOM ⇄ 内存（单条 patch，不再全量覆写）

```js
// src/ui/grid-binding.js
import { db } from '../data/store.js';
import { patchCommand } from '../data/services.js';

/** 渲染一条命令为 <tr>，全程 DOM API（不用 innerHTML，修坑 #6） */
export function renderCommandRow(cmd) {
  const tr = document.createElement('tr');
  tr.dataset.cmdId = cmd.id;              // ★ 用 id 关联，不用下标（修坑 #3）
  if (cmd.status) tr.classList.add(cmd.status);

  const mk = (text, withDatalist) => {
    const td = document.createElement('td');
    const real = document.createElement('div');   // div[0] 真值（隐藏）
    real.style.display = 'none';
    real.appendChild(document.createTextNode(text));
    const show = document.createElement('div');   // div[1] 显示值（可截断）
    show.style.cssText = 'overflow:hidden;height:15px';
    show.appendChild(document.createTextNode(text));
    td.append(real, show);
    if (withDatalist) {
      const dl = document.createElement('datalist');
      for (const t of cmd.targets) {
        const op = document.createElement('option');
        // createTextNode：避免定位器里的尖括号被当 HTML 解析
        op.appendChild(document.createTextNode(t));
        op.value = t;
        dl.appendChild(op);
      }
      td.appendChild(dl);
    }
    return td;
  };

  tr.append(
    document.createElement('td'),        // 0: 操作列占位
    mk(cmd.name, false),                 // 1: 命令名
    mk(cmd.defaultTarget, true),         // 2: 定位器 + 候选 datalist
    mk(cmd.value, false),                // 3: 值
  );
  return tr;
}

/** 从 <tr> 反读候选定位器 */
export function readTargets(tr) {
  const dl = tr.children[2].querySelector('datalist');
  return dl ? [...dl.querySelectorAll('option')].map(o => o.textContent) : [];
}

const realText = (tr, i) => tr.children[i].querySelector('div').textContent;

/**
 * 单元格编辑完成时调用 —— 只 patch 这一条命令。
 * 替代 KR 的 saveOldCase() 全量按下标覆写。
 */
export function commitCellEdit(tr, caseId) {
  patchCommand(caseId, tr.dataset.cmdId, {
    name:          realText(tr, 1),
    defaultTarget: realText(tr, 2),
    targets:       readTargets(tr),
    value:         realText(tr, 3),
  });
}
```

### 7.8 `boot.js` —— 启动装配

```js
// src/boot.js
import { load } from './data/store.js';
import { renderSuiteTree } from './ui/tree.js';

(async function main() {
  const data = await load();
  renderSuiteTree(data.testSuites);
  // 无套件时不预建 —— 保持 KR 的「录第一条命令才兜底创建」语义
})();
```

### 7.9 MVP 与 KR 的行为对照检查表

| 行为 | KR 7.1.0 | MVP | 一致？ |
|---|---|---|---|
| 无套件时录制 → 自动建 "Untitled Test Suite" | `add-command.js:29` | `recording.js` 第 1 步 | ✔ |
| 无用例时录制 → 自动建 "Untitled Test Case" | `add-command.js:37` | `recording.js` 第 2 步 | ✔ |
| 判定依据是 UI 选中态而非数据存在性 | `getSelectedSuite()`/`getSelectedCase()` | `getSelection()` | ✔ |
| 候选定位器存 `<datalist><option>` | `render-command-element.js:38-45` | `renderCommandRow` | ✔ |
| `defaultTarget` 独立于 `targets[0]` | `test-command.js:15-16` | 同 | ✔ |
| 命令有稳定 id | ✘（靠下标） | ✔ | **改进** |
| 持久化保留 id | ✘（白名单剔除） | ✔ | **改进** |
| marshall 侧 HTML 转义 | ✘ | ✔ | **改进** |
| 落盘时机 | 仅 `beforeunload` | debounce + visibilitychange | **改进** |
| 序列化格式 | HTML `<table>` | JSON（可选 HTML 兼容） | **改进** |
| 运行时 `status` 落盘 | ✔（副作用） | ✘（`toJSON` 剔除） | **改进** |

---

## 附录 A · 快速定位索引

| 我想找… | 去看 |
|---|---|
| "Untitled Test Case" 的字符串常量 | `test-case-service.js:10-11`、`add-command.js:37`、`testCase-grid-test-case-listener.js:43` |
| "Untitled Test Suite" 的字符串常量 | `test-suite-service.js:29-30`、`add-command.js:29-30`、`testCase-grid-test-case-listener.js:58-59` |
| 兜底创建的调用现场 | `add-command.js:28-43` |
| UUID 生成 | `utils.js:22-29` |
| 内存树根 | `panel/js/UI/index.js:19` |
| 落盘 | `save-data.js:10-16` |
| 装载 | `load-data.js:43-59` |
| HTML 序列化 | `parser.js:92-131` |
| HTML 反序列化 | `parser.js:25-84` |
| `<datalist>` 写 | `render-command-element.js:37-46`、`parser.js:93` |
| `<datalist>` 读 | `record-utils.js:34-39`、`parser.js:27-29` |
| DOM → 内存同步 | `view/testcase-grid/utils.js:14-33` |
| 导出 | `download-suite.js:14-84` |
| 导入 HTML | `load-html-file.js:8-42` |
| 导入 `.side` | `import-selenium.js:36-48` → `selenium-ide-parser.js:21-26` |
| 不兼容命令黑名单 | `command-converter-service.js:2-13` |
| 存储权限 | `manifest.json:64`（`unlimitedStorage`） |
| 行为规格（单测） | `tests/panel/js/UI/services/data-service/*.spec.js`、`.../helper-service/parser.spec.js` |

## 附录 B · 与其它模块的接口

| 对接模块 | 接口点 | 说明 |
|---|---|---|
| **TECH-01 录制引擎** | `addCommand(name, target_array, value, auto, insert)` | 录制端唯一入口，`target_array` 是 `[[locator, strategy], ...]` |
| **TECH-02 定位器与自愈** | `TestCommand.targets[]` / `defaultTarget` | 自愈读 `targets` 逐个尝试，命中后改写 `defaultTarget` |
| **TECH-03 回放引擎** | `TestCase.commands[]`、`setTestCommandStatus(caseId, idx, state)` | 回放遍历 commands，逐条回写 status 着色 |
| **TECH-04 Panel UI 与日志** | `renderTestCaseToRecordGrid`、`displayNewTestSuite` | 树与网格渲染 |
| **TECH-09 命令库** | `TestCommand.name` 必须落在 `_loadSeleniumCommands()` 产生的清单内 | 见 `panel/js/katalon/kar-loadCommand.js:2-76` |

---

*本文档基于 Katalon Recorder 7.1.0（MV3）源码静态分析撰写，未修改任何源码。*
