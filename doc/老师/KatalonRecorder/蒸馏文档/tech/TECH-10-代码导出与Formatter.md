# TECH-10 代码导出与 Formatter 体系

> 一句话概括：Katalon Recorder 的代码导出是**两套并存的 Formatter 体系**——旧的 Selenium IDE 插件式体系（动态注入 4~7 个脚本，靠"同名函数后加载覆盖先加载"实现继承，把 Selenese 命令经 `CommandDefinition → CallSelenium → SeleniumWebDriverAdaptor → WDAPI` 四级映射翻译成 11 种语言），与新的 `window.newFormatters` 体系（一个函数 `(name, commands) => {content, extension, mimetype}` 即可注册一门语言）；个人插件只需保留后者。

---

## 一、关键文件清单

### 1.1 旧体系（Selenium IDE 血统）

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---:|---|---|
| `panel/js/katalon/selenium-ide/formatCommandOnlyAdapter.js` | 127 | 【地基】提供 `format()` / `formatCommands()` / `addIndent()` / `indent()` 主循环，只要求子 formatter 实现 `formatCommand()` | **替换**（30 行可重写） |
| `panel/js/katalon/selenium-ide/remoteControl.js` | 378 | RC 通用层：`formatHeader`/`formatFooter`/`xlateArgument`/`string`/`CallSelenium` 的 RC 版本 | 删除 |
| `panel/js/katalon/selenium-ide/webdriver.js` | 846 | 【核心】WebDriver 通用层：`formatCommand()` 主分发、`xlateArgument()` 变量翻译、`SeleniumWebDriverAdaptor`（Selenese→WebDriver 语义适配，约 60 个方法）、`SeleneseMapper` 命令重映射 | **保留思想，重写**（MVP 用 150 行 map 表替代） |
| `panel/js/katalon/selenium-ide/testCase.js` | 523 | `Command` / `CommandDefinition` 类、`Command.loadAPI()` 解析 iedoc-core.xml、`getDefinition()` 命令名反解析 | 删除（元数据表硬编码即可） |
| `panel/js/katalon/selenium-ide/iedoc-core.xml` | — | 160 个 `<function>` 命令定义（参数名、返回类型、注释） | 删除 |
| `panel/js/katalon/kar-loadCommand.js` | 98 | `:79-88` 用 `$.ajax` 同步加载 iedoc-core.xml 到 `Command.apiDocuments` | 删除 |
| `panel/js/katalon/kar-generateScript.js` | 422 | 旧导出对话框控制器：`loadScripts()` switch 注入脚本、`generateScripts()` 三分支、`displayOnCodeMirror()` | **替换**（80 行重写） |

### 1.2 各语言 formatter（`panel/js/katalon/selenium-ide/format/`）

| 文件 | 行数 | 层级 | 裁剪去留 |
|---|---:|---|---|
| `java/java-rc.js` | 231 | Java 语法基元层（`statement`/`assignToVariable`/`assertTrue`/`waitFor`/`array`） | 删除 |
| `java/java-rc-junit4.js` | 239 | JUnit4 断言方言 | 删除 |
| `java/java-rc-testng.js` | 41 | TestNG 断言方言 | 删除 |
| `java/java-backed-junit4.js` | 286 | WebDriverBackedSelenium（RC 风格，`selenium.click(...)`） | 删除 |
| `java/webdriver-junit4.js` | 535 | Java WDAPI 实现（`By.id(...)` / `driver.findElement(...)`）+ `options.header` 模板 | 删除 |
| `java/webdriver-testng.js` | 528 | 同上 TestNG 版 | 删除 |
| `java/java-advance-junit.js` | 304 | 【KR 私货层】`storeEval`/`runScript`/`if`/`while`/变量类型推断/缩进级别 | **重点参考**，见 §3.9 |
| `java/java-advance-testng.js` | 303 | 同上 TestNG 版 | 删除 |
| `python/python2-rc.js` | 225 | Python 语法基元层 | 删除 |
| `python/python2-wd.js` | 535 | Python WDAPI（`find_element_by_id(...)`） | 删除 |
| `python/python-advance-unittest.js` | 294 | Python KR 私货层 | 删除 |
| `python/python-appdynamics.js` | 584 | AppDynamics 专用 | 删除 |
| `csharp/cs-rc.js` | 224 | C# 语法基元层 | 删除 |
| `csharp/cs-wd.js` | 584 | C# WDAPI（`By.Id(...)`） | 删除 |
| `csharp/cs-mstest-wd.js` | 602 | MSTest 方言 | 删除 |
| `ruby/ruby-rc.js` / `ruby-rc-rspec.js` / `ruby-wd.js` / `ruby-wd-rspec.js` | 217/248/515/585 | Ruby 全家桶（`:id, "btn"`） | 删除 |
| `robot/robot.js` | 293 | Robot Framework（**不走 WebDriver 层，直接字符串处理**） | 删除（但结构值得抄，见 §3.10） |
| `xml/XML-formatter.js` | 260 | XML 序列化（唯一实现了 `parse()` 反序列化的 formatter） | 删除 |
| `katalon/katalon.js` | 562 | 【最复杂】Katalon Studio Groovy 导出，含 `loadVars`/`GlobalVariable`/`TestObject` 转换 | 删除（除非要对接 KS） |

### 1.3 新体系 newFormatters

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---:|---|---|
| `panel/js/UI/index.js:18` | — | `window.newFormatters = {}` 注册表初始化 | **保留** |
| `panel/js/katalon/newformatters/sample.js` | 68 | 【模板】最简 formatter，60 行，输出 `cmd \| target \| value` | **保留为脚手架** |
| `panel/js/katalon/newformatters/puppeteer.js` | 413 | Puppeteer 导出，`seleneseCommands` 纯映射对象 | **保留为参考实现** |
| `panel/js/katalon/newformatters/webdriver.js` | 230 | WebDriver.io | 删除 |
| `panel/js/katalon/newformatters/protractorts.js` | 280 | Protractor TypeScript | 删除 |
| `panel/js/katalon/newformatters/dynatrace.js` | 645 | Dynatrace JSON | 删除 |
| `panel/js/katalon/newformatters/nrsynthetics.js` | 489 | New Relic Synthetics | 删除 |

### 1.4 导出 UI 与打包

| 文件 | 行数 | 职责 | 裁剪去留 |
|---|---:|---|---|
| `panel/js/UI/view/KS-export/KS-export-dialog.js` | 306 | 【真正的导出主界面】语言下拉框 19 项 + Export 按钮 switch 分发 | 替换（简化为 40 行） |
| `panel/js/UI/services/KS-export-service/katalon-studio-script-service.js` | 147 | `loadParserScripts(id)` / `unloadParserScripts()`：动态 `<script>` 注入与清理 | 删除 |
| `panel/js/UI/services/KS-export-service/generate-exported-script.js` | 71 | 单个 test case → 脚本文本，含 `${GlobalVariable.x}` 转换 | 保留骨架 |
| `panel/js/UI/services/KS-export-service/generate-katalon-studio-project-zip-file.js` | 527 | 生成完整 KS 项目 zip（.prj/Test Cases/Data Files/Profiles） | 删除 |
| `panel/js/UI/services/KS-export-service/generate-java-junit-project-zip-file.js` | 159 | Maven + JUnit 项目 zip | 删除 |
| `panel/js/UI/services/KS-export-service/generate-java-testng-project-zip-file.js` | 201 | Maven + TestNG 项目 zip | 删除 |
| `panel/js/UI/services/KS-export-service/generate-python-unitest-project-zip-file.js` | 66 | Python 项目 zip | 删除 |
| `panel/js/UI/services/KS-export-service/generate-default-project-zip-file.js` | 58 | 兜底：所有脚本平铺打包 | **保留**（改造成 MVP 的批量导出） |
| `panel/js/UI/services/KS-export-service/check-unsupported-commands.js` | 6 | 检查命令是否在 `window.unsupportedCommands` | 保留（3 行） |
| `panel/js/UI/view/KS-export/render-KS-script.js` | 22 | CodeMirror 渲染预览 | 保留 |
| `panel/js/UI/models/KR-export/user-choice.js` | 163 | 用户勾选的 suites/testcases/dataFiles/profiles | 简化 |
| `panel/js/katalon/codemirror-5.31.0/` | — | CodeMirror 5.31.0 + 7 个 mode（clike/groovy/javascript/php/python/ruby/xml） | **替换**（只留 javascript 或换 highlight.js） |

---

## 二、核心机制逐层拆解

### 2.1 全景：两个入口、三条路径

7.1.0 里有**两个导出对话框**，很多人只知道其一：

| 入口 | DOM id | 提供的语言 | 代码位置 |
|---|---|---|---|
| 主面板 "Export"（旧对话框） | `#select-script-language-id` | **只有 8 个 new-formatter-\*** | `panel/index.html:780-805` |
| "Export to Katalon Studio"（新对话框） | `#export-to-KS-select-script-language` | **19 个（11 旧 + 8 新）** | `KS-export-dialog.js:38-58` |

`panel/index.html:785-804` 的下拉框全部是 `new-formatter-*`：

```html
<option value="new-formatter-dynatrace" selected>...</option>
<option value="new-formatter-nrsynthetics">...</option>
<option value="new-formatter-protractorts">...</option>
<option value="new-formatter-webdriver">WebDriver.io</option>
<option value="new-formatter-sample">...</option>
<option value="new-formatter-puppeteer">Puppeteer</option>
<option value="new-formatter-puppeteer_w_comment">...</option>
<option value="new-formatter-puppeteer_json">...</option>
```

而 `kar-generateScript.js:30-143` 的 `loadScripts()` 里那一大堆 `case 'java-wd-junit'` **在旧对话框里已经是死代码**——因为下拉框里根本没有这些 value。它们只在新对话框通过 `katalon-studio-script-service.js:2-98` 的同名 switch 被使用。

> **裁剪结论 1**：`kar-generateScript.js` 的 `loadScripts()` 与 `katalon-studio-script-service.js` 的 `getParserScripts()` 是**两份重复代码**（逐字复制，只有 `katalon` 分支顺序不同）。个人插件保留一份即可。

三条执行路径在 `kar-generateScript.js:181-251` `generateScripts()` 中分叉：

```javascript
// kar-generateScript.js:194
if (isExternalCapability) {
    // 路径A：转发给外部扩展（browser.runtime.sendMessage(extensionId, {...})）
} else if (newFormatter) {
    // 路径B：newFormatters 体系
    var payload = newFormatter(name, commands);
    options = { defaultExtension: payload.extension, mimetype: payload.mimetype };
    displayOnCodeMirror(language, payload.content);
} else {
    // 路径C：旧 Selenium IDE 体系
    var testCase = new TestCase(name);
    testCase.commands = commands;
    testCase.formatLocal(name).header = "";
    testCase.formatLocal(name).footer = "";
    displayOnCodeMirror(language, format(testCase, name));
}
```

---

### 2.2 旧体系的"继承"：脚本堆叠 + 同名函数覆盖

这是整个模块**最反直觉**的设计。旧 formatter 没有 class、没有 prototype 链、没有 import，全靠**按顺序往 `document.head` 插 `<script>`，后加载的同名全局函数覆盖先加载的**。

`kar-generateScript.js:73-84` 的 `java-wd-junit`：

```javascript
case 'java-wd-junit':
    scriptNames = [
        'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',   // ① 主循环
        'js/katalon/selenium-ide/remoteControl.js',              // ② RC 通用
        "js/katalon/selenium-ide/format/java/java-rc.js",        // ③ Java 语法基元
        "js/katalon/selenium-ide/format/java/java-rc-junit4.js", // ④ JUnit 断言
        "js/katalon/selenium-ide/format/java/java-rc-testng.js", // ⑤ (被⑥覆盖，无意义)
        'js/katalon/selenium-ide/webdriver.js',                  // ⑥ WD 通用（覆盖②的 formatCommand）
        "js/katalon/selenium-ide/format/java/webdriver-junit4.js",// ⑦ Java WDAPI
        "js/katalon/selenium-ide/format/java/java-advance-junit.js", // ⑧ KR 私货（覆盖③的 statement/assignToVariable）
    ];
```

加载靠 `script.async = false` 保证顺序 + 计数器轮询（`:157-170`）：

```javascript
script.async = false; // This is required for synchronous execution
script.onload = function() { j++; }
document.head.appendChild(script);
...
var interval = setInterval(function() {
    if (j == scriptNames.length) { clearInterval(interval); generateScripts(...); }
}, 100);
```

覆盖关系举例（`statement` 函数）：

| 定义位置 | 实现 |
|---|---|
| `java-rc.js:115` | `return expression.toString() + ';';` |
| `java-advance-junit.js:247` | 先 `switch(command?.command)` 处理 `runScript`/`while`/`if`/`else`/`endIf` 等控制流，命中则返回专用代码；未命中才 `expression.toString() + ';'` |

最终 `statement` 指向 `java-advance-junit.js:247`。同理 `CallSelenium.prototype.toString` 被覆盖 3 次（`remoteControl.js` → `java-rc.js:133` → `webdriver.js:393` → `java-advance-junit.js:284`）。

> **坑**：这些脚本用完必须**卸载**，否则会污染下一次导出。`katalon-studio-script-service.js:130-145` 的 `unloadParserScripts()` 做了三件事：删掉所有 `[id^=formatter-script-language-id-]` 的 `<script>` 标签、重新注入 `js/background/formatCommand.js`（恢复被覆盖的 `xlateArgument`/`string`）、重置 7 个 window 全局变量。**删 `<script>` 标签并不能撤销它定义的全局函数**——所以才需要重新注入 `formatCommand.js` 覆盖回去。这是一个非常脆的设计。

---

### 2.3 约定函数契约（Formatter 插件接口）

一个旧 formatter 需要（或可选）提供以下全局函数/变量。这是**隐式契约，源码中无任何接口定义文件**，只能从 `formatCommandOnlyAdapter.js` 和 `webdriver.js` 的调用点反推：

| 名称 | 必需 | 调用点 | 说明 |
|---|:--:|---|---|
| `this.name` | ✅ | `formatCommandOnlyAdapter.js:24` | formatter 标识，用于 `testCase.formatLocal(name)` |
| `this.options` | ✅ | `webdriver.js:97,104,125` | `{receiver, indent, initialIndents, defaultExtension, ...}` |
| `options.header` / `options.getHeader()` | ✅ | `webdriver.js:97` | 文件头模板，支持 `${className}`/`${methodName}`/`${baseURL}` 及任意 `${optionKey}` |
| `options.footer` | ✅ | `webdriver.js:111` | 文件尾 |
| `formatCommand(command)` | ✅ | `formatCommandOnlyAdapter.js:96` | 单条命令 → 一行（或多行）代码 |
| `formatHeader(testCase)` | ⭕ | `formatCommandOnlyAdapter.js:39-41` | 有则调用，否则 header 为空 |
| `formatFooter(testCase)` | ⭕ | `formatCommandOnlyAdapter.js:46-48` | 同上 |
| `formatComment(comment)` | ⭕ | `formatCommandOnlyAdapter.js:99-100` | 注释行 |
| `statement(expression, command)` | ✅ | `webdriver.js:439,451,468,487,505` | 表达式 → 语句（加分号/处理控制流） |
| `assignToVariable(type, var, expr, cmd)` | ✅ | `webdriver.js:439,451,468` | `store*` 命令的赋值语句 |
| `assertTrue/assertFalse/verifyTrue/verifyFalse` | ✅ | `webdriver.js:434,436` | 断言 |
| `waitFor(expression)` | ✅ | `webdriver.js:441,455` | 轮询等待 |
| `ifCondition(expr, cb)` | ✅ | `webdriver.js:637` | if 块 |
| `indents(num)` | ✅ | `webdriver.js:115` | 缩进（`options.indent == 'tab'` 或数字） |
| `string(value)` | ✅ | `webdriver.js:357` | 字符串字面量 + 转义 |
| `nonBreakingSpace()` | ✅ | `webdriver.js:294` | `${nbsp}` 的目标语言表示 |
| `pause(ms)` / `echo(msg)` | ⭕ | `webdriver.js:463,465` | 需 `this.pause = true` / `this.echo = true` |
| `WDAPI.Driver` / `WDAPI.Element` / `WDAPI.ElementList` / `WDAPI.Utils` | ✅（WD 类） | `webdriver.js:644 等` | 目标语言的 WebDriver API 生成器 |
| `window.unsupportedCommands` | ⭕ | `check-unsupported-commands.js:2` | 不支持命令名数组，UI 显示警告图标 |
| `window.codeBlockCommands` / `window.indentLevel` | ⭕ | `webdriver.js:542-547` | 控制 if/while 块的缩进 |
| `parse(testCase, source)` | ⭕ | 仅 XML-formatter 实现 | 反序列化（导入） |

---

### 2.4 主循环：`format()` → `formatCommands()` → `formatCommand()`

`formatCommandOnlyAdapter.js:34-52`：

```javascript
function format(testCase, name) {
    var result = '';
    var header = "";
    var footer = "";
    this.commandCharIndex = 0;
    if (this.formatHeader) { header = formatHeader(testCase); }
    result += header;
    this.commandCharIndex = header.length;
    testCase.formatLocal(this.name).header = header;
    result += formatCommands(testCase.commands);      // ← 主体
    if (this.formatFooter) { footer = formatFooter(testCase); }
    result += footer;
    testCase.formatLocal(this.name).footer = footer;
    return result;
}
```

`formatCommandOnlyAdapter.js:84-113`：

```javascript
function formatCommands(commands) {
    commands = filterForRemoteControl(commands);      // ← 命令预处理
    if (this.lastIndent == null) { this.lastIndent = ''; }
    var result = '';
    for (var i = 0; i < commands.length; i++) {
        var line = null;
        var command = commands[i];
        if (command.type == 'line')          { line = command.line; }
        else if (command.type == 'command')  { line = formatCommand(command); if (line != null) line = addIndent(line); command.line = line; }
        else if (command.type == 'comment' && this.formatComment) { line = formatComment(command); if (line != null) line = addIndent(line); command.line = line; }
        command.charIndex = this.commandCharIndex;
        if (line != null) { line = line + "\n"; result += line; this.commandCharIndex += line.length; }
    }
    return result;
}
```

`addIndent` 用正则对每一行加前缀（`:78-82`）：

```javascript
function addIndent(lines) {
    return lines.replace(/.+/mg, function(str) { return indent() + str; });
}
```

`indent()` 返回 `this.lastIndent`，由 `formatHeader` 在 `webdriver.js:104` 设定：`this.lastIndent = indents(parseInt(options.initialIndents, 10));`。

**命令预处理 `filterForRemoteControl`**（`formatCommandOnlyAdapter.js:54-76`）：把 `xxxAndWait` 拆成 `xxx` + `waitForPageToLoad`，然后调 `this.postFilter`。`webdriver.js:10-32` 的 `postFilter` 又把 `waitForPageToLoad` 丢掉（WebDriver 不需要），并调用 `SeleneseMapper.remap` 把 `assertTextPresent` 重写成 `assertText | css=BODY | glob:*xxx*`（`webdriver.js:56-85`）：

```javascript
// webdriver.js:80-82
var remappedCmd = new Command(cmd.command.replace(this.isTextPresentRegex, "$1$2Text"), 'css=BODY', pattern);
remappedCmd.remapped = cmd;
return [new Comment('Warning: ' + cmd.command + ' may require manual changes'), remappedCmd];
```

---

### 2.5 命令元数据：iedoc-core.xml → CommandDefinition

`kar-loadCommand.js:79-88` 在 panel 启动时**同步** AJAX 加载 XML：

```javascript
$(function() {
    $.ajax({
        url: 'js/katalon/selenium-ide/iedoc-core.xml',
        success: function (document) { Command.apiDocuments = new Array(document); },
        async: false,
        dataType: 'xml'
    });
});
```

`testCase.js:75-154` `Command.loadAPI()` 把 XML 解析成 `{commandName: CommandDefinition}` 字典，关键规则：

```javascript
// testCase.js:91-145
var functionElements = document.documentElement.getElementsByTagName("function");
for (var i = 0; i < functionElements.length; i++) {
    var def = new CommandDefinition(String(element.attributes.getNamedItem('name').value));
    // <return type="string"> → def.returnType（"string"→"String", "number"→"Number"）
    // <param name="x">      → def.params.push({name, description})
    // <comment>             → def.comment
    functions[def.name] = def;
    if (def.name.match(/^(is|get)/)) {
        def.isAccessor = true;                             // ← 关键标志
        functions["!" + def.name] = def.negativeAccessor(); // 生成否定版
    }
    if (def.name.match(/^assert/)) {  // 只有 assertSelected 命中
        var verifyDef = new CommandDefinition(def.name);
        verifyDef.params = def.params;
        functions["verify" + def.name.substring(6)] = verifyDef;
    }
}
```

`Command.prototype.getDefinition()`（`testCase.js:258-283`）是**命令名反解析器**，把 `assertNotTextPresent` 拆回 `!isTextPresent`：

```javascript
var commandName = this.command.replace(/AndWait$/, '');
var r = /^(assert|verify|store|waitFor)(.*)$/.exec(commandName);
if (r) {
    var suffix = r[2]; var prefix = "";
    if ((r = /^(.*)NotPresent$/.exec(suffix)) != null)  { suffix = r[1] + "Present"; prefix = "!"; }
    else if ((r = /^Not(.*)$/.exec(suffix)) != null)    { suffix = r[1];             prefix = "!"; }
    var booleanAccessor = api[prefix + "is" + suffix];   if (booleanAccessor) return booleanAccessor;
    var accessor        = api[prefix + "get" + suffix];  if (accessor)        return accessor;
}
return api[commandName];
```

**这解释了为什么 XML 里只有 160 个 function，却能支撑 400+ 条 Selenese 命令**：`getText` 一条定义自动派生出 `assertText`/`assertNotText`/`verifyText`/`verifyNotText`/`storeText`/`waitForText`/`waitForNotText`/`assertTextAndWait`… 共 14 种变体。

---

### 2.6 四级映射：Selenese → 目标语言

以 `click | id=btn` 为例（Java JUnit）：

```
① formatCommand(command)                       webdriver.js:415
     ↓ def = command.getDefinition()  → CommandDefinition{name:'click', params:[locator]}
     ↓ def.isAccessor === false → 走 :488 分支
② call = new CallSelenium('click')             webdriver.js:494
     call.rawArgs = ['id=btn']
     call.args    = [xlateArgument('id=btn')] = ['"id=btn"']
③ line = statement(call, command)              java-advance-junit.js:247
     ↓ switch 未命中 → expression.toString()
④ CallSelenium.prototype.toString(command)     java-advance-junit.js:284
     ↓ adaptor = new SeleniumWebDriverAdaptor(['id=btn'])
     ↓ adaptor['click']()                      webdriver.js:651
         locator = this._elementLocator('id=btn')  → {type:'id', string:'btn'}
         driver  = new WDAPI.Driver()               → ref = options.receiver = 'driver'
         driver.findElement('id','btn')             webdriver-junit4.js:424
             → new WDAPI.Element('driver.findElement(' + WDAPI.Driver.searchContext('id','btn') + ')')
             → WDAPI.Driver.searchContext            webdriver-junit4.js:397
                 case 'id': return 'By.id(' + xlateArgument('btn') + ')'  → 'By.id("btn")'
             → WDAPI.Element{ref: 'driver.findElement(By.id("btn"))'}
         .click()                                    → 'driver.findElement(By.id("btn")).click()'
⑤ statement 加分号 → 'driver.findElement(By.id("btn")).click();'
⑥ addIndent → '\t\tdriver.findElement(By.id("btn")).click();'
```

其中 `_elementLocator`（`webdriver.js:559-594`）是 **locator 前缀 → 策略枚举**的守门人，它**显式拒绝**四种策略：

```javascript
if (sel1Locator.match(/^document/) || locator.type == 'dom')  throw 'Error: Dom locators are not implemented yet!';
if (locator.type == 'ui')          throw 'Error: UI locators are not supported!';
if (locator.type == 'identifier')  throw 'Error: locator strategy [identifier] has been deprecated...';
if (locator.type == 'implicit')    throw 'Error: locator strategy either id or name must be specified explicitly.';
```

抛出的异常在 `formatCommand` 的 catch（`webdriver.js:512-527`）被吃掉，变成注释：

```javascript
line = formatComment(new Comment('ERROR: Caught exception [' + e + ']'));
```

> **坑**：录制器默认产出的 locator 常常是 `implicit`（无前缀，如 `btn`）。导出到 Java 会直接变成一行 `// ERROR: Caught exception [Error: locator strategy either id or name must be specified explicitly.]`。这是 KR 用户最常见的导出投诉。

---

### 2.7 locator → 各语言 By 的完整对照

| Selenese 前缀 | Java (`webdriver-junit4.js:397-414`) | Python (`python2-wd.js:377-394`) | Python args 版 (`:396-413`) | Ruby (`ruby-wd.js:376-393`) | C# (`cs-wd.js:446-463`) | Puppeteer (`puppeteer.js:12-41`) |
|---|---|---|---|---|---|---|
| `xpath=` | `By.xpath(s)` | `_by_xpath(s` | `By.XPATH, s` | `:xpath, s` | `By.XPath(s)` | 原样 |
| `css=` | `By.cssSelector(s)` | `_by_css_selector(s` | `By.CSS_SELECTOR, s` | `:css, s` | `By.CssSelector(s)` | **css2xpath(s)** |
| `id=` | `By.id(s)` | `_by_id(s` | `By.ID, s` | `:id, s` | `By.Id(s)` | `//*[@id="s"]` |
| `link=` | `By.linkText(s)` | `_by_link_text(s` | `By.LINK_TEXT, s` | `:link, s` | `By.LinkText(s)` | `//a[contains(text(),'s')]` |
| `name=` | `By.name(s)` | `_by_name(s` | `By.NAME, s` | `:name, s` | `By.Name(s)` | `//*[@name="s"]` |
| `tag_name=` | `By.tagName(s)` | `_by_tag_name(s` | `By.TAG_NAME, s` | `:tag_name, s` | `By.TagName(s)` | 注释掉了 |
| 其他 | `throw` | `throw` | `throw` | `throw` | `throw` | 原样返回 target |

Python 有两套是因为 `find_element_by_id("x")`（旧 API，方法名拼接）和 `is_element_present(By.ID, "x")`（辅助函数，需要 By 常量）需要不同形式。注意 Python 版 `searchContext` **故意不闭合括号**，闭合在调用点（`python2-wd.js:424`）：

```javascript
return new WDAPI.Element(this.ref + ".find_element" + WDAPI.Driver.searchContext(locatorType, locator) + ")");
```

Katalon Studio 版最特殊，locator 转成 `TestObject` 对象（`katalon.js:382-419`）：

```javascript
case "id":
    result += `${objectName}.setSelectorValue(SelectorMethod.CSS,"#${locatorObject.string}")\n`
    result += `${objectName}.setSelectorMethod(SelectorMethod.CSS)\n`
    break;
```

注意 `:412` 有一个**真实 bug**——模板字符串写成了普通字符串：

```javascript
result += "${objectName}.setSelectorMethod(SelectorMethod.XPATH)\n";  // 双引号！不会插值
```

导出的 Groovy 里会残留字面量 `${objectName}`。

---

### 2.8 同一条命令的跨语言导出对照表

输入：`click | id=btn`

| 语言 | 输出 | 生成链路 |
|---|---|---|
| Java (WebDriver + JUnit) | `driver.findElement(By.id("btn")).click();` | `webdriver.js:651` → `webdriver-junit4.js:397` |
| Java (WebDriver + TestNG) | `driver.findElement(By.id("btn")).click();` | 同上，`webdriver-testng.js` |
| Java (RC-backed + JUnit) | `selenium.click("id=btn");` | `java-rc.js:133` `CallSelenium.toString`，`options.receiver='selenium'` |
| Python 2 (WD + unittest) | `driver.find_element_by_id("btn").click()` | `python2-wd.js:377,424` |
| C# (WD + NUnit) | `driver.FindElement(By.Id("btn")).Click();` | `cs-wd.js:446,474` |
| C# (WD + MSTest) | 同上（仅 header/断言不同） | `cs-mstest-wd.js` |
| Ruby (WD + RSpec) | `@driver.find_element(:id, "btn").click` | `ruby-wd.js:376,404` |
| Katalon Studio (Groovy) | `selenium.click("id=btn")` | `katalon.js:149-181`（**无分号**，Groovy 风格） |
| Robot Framework | `    click  id=btn` | `robot.js:44-92`（**纯字符串替换，把 `\|` 换成两个空格**） |
| XML | `<selenese><command>click</command><target>id=btn</target><value/></selenese>` | `XML-formatter.js` |
| Puppeteer | ``element = await page.$x(`//*[@id="btn"]`);``<br>``  await element[0].click();`` | `puppeteer.js:115` |

输入：`type \| name=q \| ${keyword}`（假设 `keyword` 已被 `store` 声明）

| 语言 | 输出 |
|---|---|
| Java JUnit | `driver.findElement(By.name("q")).sendKeys(keyword);`（`java-advance-junit.js:83-92` 会按类型决定要不要 `String.valueOf()`） |
| Katalon | `selenium.type("name=q", (keyword).toString())`（`katalon.js:167-177`：`type` 命令的最后一个参数若不是纯字面量则包 `().toString()`） |
| Python | `driver.find_element_by_name("q").send_keys(keyword)` |
| Puppeteer | ``await element[0].type(`${keyword}`);``（**不做变量解析，原样透传**） |

---

### 2.9 变量与 `${...}` 在导出时的处理

`webdriver.js:262-307` `xlateArgument(value, type)` 是导出侧变量翻译器，三种输入形态：

```javascript
// ① javascript{...} → 转成 getEval 调用
if ((r = /^javascript\{([\d\D]*)\}$/.exec(value))) {
    var js = r[1]; var prefix = "";
    while ((r2 = /storedVars\['(.*?)'\]/.exec(js))) {
        parts.push(string(prefix + js.substring(0, r2.index) + "'"));
        parts.push(variableName(r2[1]));           // ← storedVars['x'] 变成裸变量 x
        js = js.substring(r2.index + r2[0].length); prefix = "'";
    }
    parts.push(string(prefix + js));
    return new CallSelenium("getEval", [concatString(parts)]);
}
// ② 含 ${...}
else if ((r = /\$\{/.exec(value))) {
    var regexp = /\$\{(.*?)\}/g; var lastIndex = 0;
    while (r2 = regexp.exec(value)) {
        var key = xlateKeyVariable(r2[1]);                       // ${KEY_ENTER} → Keys.ENTER
        if (key || (this.declaredVars && this.declaredVars[r2[1]])) {  // ★ 必须已声明
            if (r2.index - lastIndex > 0) parts.push(string(value.substring(lastIndex, r2.index)));
            parts.push(key ? key : variableName(r2[1]));
            lastIndex = regexp.lastIndex;
        } else if (r2[1] == "nbsp") { ... parts.push(nonBreakingSpace()); ... }
    }
    if (lastIndex < value.length) parts.push(string(value.substring(lastIndex, value.length)));
    return (type && type.toLowerCase() == 'args') ? toArgumentList(parts) : concatString(parts);
}
// ③ 普通字符串
else { return string(value); }
```

**★ 关键判定**：`this.declaredVars[name]` 必须为真，`${name}` 才会被翻译成裸变量拼接（`"a" + name + "b"`）；否则**原样保留为字符串字面量** `"a${name}b"`。`declaredVars` 由 `addDeclaredVar()`（`webdriver.js:336-341`）在遇到 `store*` 命令时写入（`webdriver.js:438,450,467`）。

这意味着：**变量必须在使用前有 `store` 命令，否则导出的代码里 `${x}` 就是死字符串**。`generate-exported-script.js:24-37` 的 `addGlobalVariable()` 针对 Global Profile 变量做了补偿——把 `${GlobalVariable.xxx}` 提前 `addDeclaredVar` 注册：

```javascript
function addGlobalVariable(KRTestCase){
  const regex = /^\${GlobalVariable\./g
  for (const command of KRTestCase.commands) {
    if (regex.test(command.defaultTarget)){
      const variable = convertGlobalVariableToKSFormat(command.defaultTarget.replace("${", "").replace("}",""));
      addDeclaredVar(variable);
    }
    ...
  }
}
```

`convertGlobalVariableToKSFormat`（`:20-22`）把 `-` 和空格换成 `_`（Groovy 标识符不允许连字符）：

```javascript
const convertGlobalVariableToKSFormat = (value) => value.replace(/-/g, "_").replace(/ /g, '_');
```

#### 变量类型推断（Java）

`java-advance-junit.js:106-160` `assignToVariable` 是**最有技术含量的一段**——Java 是静态类型，必须推断出 `long`/`double`/`String`：

```javascript
function assignToVariable(type, variable, expression, command) {
  if (!type) type = "def";
  let varName = variable.replace(/ /g, '_').replace(/\./g, '_');   // KR 允许变量名带空格，Java 不允许
  let varValue = expression.toString(command);
  try {
    if (!isNaN(parseFloat(eval(varValue)))) {     // ← 对生成的代码字符串跑 eval！
      varValue = eval(varValue); isLiteral = true;
      type = (varValue % 1 === 0) ? "long" : "double";
    }
  } catch (e) {}
  if (command?.command.includes("Eval")) {        // storeEval 特判：varValue 已是 Java 代码，改看 command.target
    try { if (!isNaN(parseFloat(eval(command?.target)))) { type = (eval(command?.target) % 1 === 0) ? "long" : "double"; } } catch (e) {}
  }
  if (this.javaJunitStoredVars[varName]) {        // 已声明 → 赋值 + 强转
    type = this.javaJunitStoredVars[varName];
    if (!isLiteral) return `${varName} = ${getTypeConversion(type)}${varValue}`;
    return varName + " = " + varValue;
  }
  this.javaJunitStoredVars[varName] = type;       // 首次 → 声明
  if (!isLiteral || type === "String") return type + " " + varName + " = " + getTypeConversion(type) + varValue;
  return type + " " + varName + " = " + varValue;
}
```

`window.javaJunitStoredVars`（`java-advance-junit.js:1`）是**变量名 → 类型**的注册表，同名变量第二次赋值不再声明。同类结构在其它 formatter 里叫 `katalonStudioStoredVars`（`katalon.js:4`）、`pythonUnittestVars`。它们在 `unloadParserScripts()`（`katalon-studio-script-service.js:139-143`）里被重置。

#### storeEval / runScript 的导出

`storeEval` 需要把 KR 运行时的变量表**注入到目标语言执行的 JS 字符串里**。`java-advance-junit.js:199-213`：

```javascript
function expandForStoreEvalCommand() {
  let variables = '';
  for (let i in this.javaJunitStoredVars) {
    if (isVarName(i)) { variables += `var ${i} = \\"" + ${i} + "\\";` }   // 拼成 Java 字符串串接
  }
  if (Object.keys(this.javaJunitStoredVars).length !== 0) {
    let str = `{ ${Object.keys(this.javaJunitStoredVars).map(key => `'${key}': ${key}`)} }`;
    variables += `var storedVars = ${str};`
  }
  return variables;
}
// :70-72
SeleniumWebDriverAdaptor.prototype.getEval = function(element, label){
  return `js.executeScript("${expandForStoreEvalCommand()} return " + ${xlateArgument(this.rawArgs[0])} + "")`;
}
```

导出结果形如：

```java
long total = (long) js.executeScript("var price = \"" + price + "\";var qty = \"" + qty + "\";var storedVars = { 'price': price,'qty': qty }; return " + "price * qty" + "");
```

Katalon 版走 `WebUI.executeJavaScript`（`katalon.js:202-225`）：

```groovy
String result = WebUI.executeJavaScript("document.title", null)
```

`convertRunScript` 有个细节（`katalon.js:215`, `java-advance-junit.js:188`）：如果脚本里含 `$`，外层引号改用单引号，避免 Groovy/Java 的 GString 插值把 `$` 吃掉：

```javascript
let bracket = target.includes("$") ? `'` : `"`;
```

#### 控制流（if / while）的缩进

`java-advance-junit.js:2-8` 定义：

```javascript
window.indentLevel = 0;
window.codeBlockCommands = ["while", "if", "else", "elseIf"];
```

`statement()`（`:254-275`）在进入块时 `indentLevel++`，退出时 `--`。`formatCommand` 末尾（`webdriver.js:542-547`）按级别补缩进：

```javascript
if (window.codeBlockCommands === undefined) return line;
if (window.codeBlockCommands.includes(command.command)) {
    return line.split("\n").map(line => indents(window.indentLevel - 1) + line).join("\n");
}
return line.split("\n").map(line => indents(window.indentLevel) + line).join("\n");
```

`if`/`while` 自身用 `indentLevel - 1`（左对齐到外层），块内语句用 `indentLevel`。

条件表达式转换 `convertConditionExpression`（`java-advance-junit.js:215-229`）：

```javascript
if (/"\${/.test(expression)) {                                   // "${a}" == "${b}"
    expression = expression.replaceAll('"${', "").replaceAll('}"', ".toString()");
    if (/ == /.test(expression)) return expression.replaceAll(" == ",".equals(") + ")";   // a.toString().equals(b.toString())
    if (/ != /.test(expression)) return "!" + expression.replaceAll(" != ",".equals(") + ")";
}
return expression.replaceAll("${", "").replaceAll("}", "");      // ${a} > 5  →  a > 5
```

这是**纯字符串替换**，没有 AST。`${a} == "${b}" && ${c}` 这类复合表达式会翻车。

---

### 2.10 不走 WebDriver 层的两个特例

**Robot Framework**（`robot/robot.js`）完全绕过 `formatCommand`——它重定义了 `format()` 和 `formatCommands()`，直接对 `String(command)` 做字符串处理（`:44-81`）：

```javascript
function filterForRemoteControl(originalCommands) {
    var commands = [];
    for (var i = 0; i<originalCommands.length;i++) {
        var c = originalCommands[i];
        c1 = String(c);                                       // Command.prototype.toString() → "click | id=btn | "
        if (c1.match("|")) { c1 = c1.replace("|","  ").replace("|","  "); }   // 只替换前两个 |
        if (c1.match("label=")) { c1 = c1.replace(/label=/g,""); }
        var temp = c1.indexOf("//");
        if (temp != -1 && c1.charAt(temp-1) == " ") { c1 = c1.replace("//","xpath=//"); }
        if (c1.indexOf("/html") == 0) { c1 = "xpath=" + c1; }
        var key_str_start = c1.search(/\${KEY_.*}/)          // ${KEY_ENTER} → ENTER
        if (key_str_start != -1) {
            var key_str_stop  = c1.indexOf("}",key_str_start+6);
            var key_str = c1.slice(key_str_start+6,key_str_stop);
            c1 = c1.replace(/\${KEY_.*}/,key_str);
        }
        commands.push(c1);
    }
    return commands;
}
```

**XML**（`xml/XML-formatter.js`）是唯一实现 `parse()`（`:57+`，用 `DOMParser` + XPath）的 formatter，即**支持双向**（导出 + 导入）。

---

### 2.11 新体系 newFormatters

注册表在 `panel/js/UI/index.js:18`：

```javascript
window.newFormatters = {};
```

脚本在 `panel/index.html:1051-1072` 静态引入（不是动态注入）：

```html
<script src="js/katalon/newformatters/sample.js"></script>
<script src="js/katalon/newformatters/nrsynthetics.js"></script>
<script src="js/katalon/newformatters/protractorts.js"></script>
<script src="js/katalon/newformatters/dynatrace.js"></script>
<script src="js/katalon/newformatters/webdriver.js"></script>
<script src="js/katalon/newformatters/puppeteer.js"></script>
```

**完整契约就一句话**：`newFormatters[id] = function(name, commands) → {content, extension, mimetype}`。

`sample.js`（68 行）是官方脚手架：

```javascript
$(document).ready(function(){
  newFormatters.sample = function(name, commands) {
    window.unsupportedCommands = [ /* 50 个命令名 */ ];
    var content = '';
    for (var i = 0; i < commands.length; i++) {
      var command = commands[i];
      content += command.command + ' | ' + command.target + ' | ' + command.value + '\n';
    }
    return { content: content, extension: 'txt', mimetype: 'text/plain' };
  }
})
```

调用点两处：
- `kar-generateScript.js:137-139`（旧对话框）：`newFormatter = newFormatters[language.replace('new-formatter-', '')]`
- `generate-exported-script.js:51-60`（新对话框）：同样的 id 解析

`puppeteer.js` 展示了成熟写法——`seleneseCommands` 是**纯映射对象**，key 为小写命令名，value 为 `(command) => codeString`（`puppeteer.js:112-131`）：

```javascript
const seleneseCommands = {
    open: (x) => `await page.goto(\`${locator(x.target)}\`, { waitUntil: 'networkidle0' });`,
    click: (x) => `element = await page.$x(\`${locator(x.target)}\`);\n\tawait element[0].click();${waitForNavigationIfNeeded(x)}`,
    type: (x) => `element = await page.$x(\`${locator(x.target)}\`);\n\tawait element[0].type(\`${x.value}\`);`,
    pause: (x) => `await page.waitFor(parseInt('${locator(x.target)}'));`,
    mouseover: (x) => `await page.hover(\`${locator(x.target)}\`);`,
    echo: (x) => `console.log(\`${locator(x.target)}\`, \`${x.value}\`);`,
    ...
};
```

它把所有 locator 统一转成 XPath（内嵌了一份 [css2xpath](http://code.google.com/p/css2xpath/) 压缩实现，`puppeteer.js:10`），并把 `${KEY_*}` 映射成 Puppeteer 键名（`:66-82`）。

同一个文件注册了三个 formatter（`:342-409`）：

```javascript
newFormatters.puppeteer            → {content: puppeteer(name).formatter(commands), extension:'js'}
newFormatters.puppeteer_w_comment  → {content: puppeteer(name, true).formatter(commands), extension:'js'}
newFormatters.puppeteer_json       → {content: JSON.stringify(commands), extension:'json'}
```

---

### 2.12 CodeMirror 接入

`panel/index.html:87-115` 静态引入 CodeMirror 5.31.0 主库 + 7 个 mode：

```html
<script src="js/katalon/codemirror-5.31.0/lib/codemirror.js"></script>
<script src="js/katalon/codemirror-5.31.0/mode/clike/clike.js"></script>      <!-- java / csharp -->
<script src="js/katalon/codemirror-5.31.0/mode/groovy/groovy.js"></script>    <!-- katalon -->
<script src="js/katalon/codemirror-5.31.0/mode/javascript/javascript.js"></script>
<script src="js/katalon/codemirror-5.31.0/mode/php/php.js"></script>
<script src="js/katalon/codemirror-5.31.0/mode/python/python.js"></script>
<script src="js/katalon/codemirror-5.31.0/mode/ruby/ruby.js"></script>
<script src="js/katalon/codemirror-5.31.0/mode/xml/xml.js"></script>
```

mode 选择在 `kar-generateScript.js:307-360` `displayOnCodeMirror`：

```javascript
var mode = window.options && window.options.mimetype;    // ← newFormatter 返回的 mimetype 优先
if (!mode) {
    switch (language) {
        case 'cs-wd-nunit': case 'cs-wd-mstest':                        mode = 'text/x-csharp'; break;
        case 'katalon':                                                 mode = 'text/x-groovy'; break;
        case 'java-wd-testng': case 'java-wd-junit': case 'java-rc-junit': mode = 'text/x-java'; break;
        case 'python-appdynamics': case 'python2-wd-unittest':          mode = 'text/x-python'; break;
        case 'robot':                                                   break;              // ← 无 mode
        case 'ruby-wd-rspec':                                           mode = 'text/x-ruby'; break;
        case 'xml':                                                     mode = 'application/xml'; break;
        default:                                                        mode = 'text/plain';
    }
}
var cm = CodeMirror.fromTextArea(textarea, {lineNumbers:true, matchBrackets:true, readOnly:true, lineWrapping:true, mode: mode});
```

新对话框的预览（`render-KS-script.js:10`）**硬编码 groovy**，不管选了什么语言：

```javascript
const codeMirrorOptions = { lineNumbers: true, matchBrackets: true, readOnly: true, lineWrapping: true, mode: 'text/x-groovy' };
```

**销毁-重建模式**（`kar-generateScript.js:186-191` / `render-KS-script.js:12-18`）：CodeMirror 实例存在 jQuery data 里，切语言时先 `cm.toTextArea()` 还原成 `<textarea>`，再重新 `fromTextArea`。

---

### 2.13 Katalon Studio 专有导出

`KS-export-dialog.js:184-210` 的 Export 按钮按语言分发到 4 个 zip 生成器：

```javascript
switch (languageId) {
    case "katalon":            zipFile = await generateKatalonStudioProjectZipFile(self.userChoice, "KR Exported Studio Project"); break;
    case "java-wd-junit":      zipFile = await generateJavaJunitProjectZipFile(...,   "KR-exported-java-junit-maven-project");     break;
    case "java-wd-testng":     zipFile = await generateJavaTestNGProjectZipFile(...,  "KR-exported-java-testNG-maven-project");    break;
    case "python2-wd-unittest":zipFile = await generatePythonUnittestProjectZipFile(...,"KR-exported-python-unitest-project");     break;
    default:                   zipFile = await generateDefaultProjectZipFile(...,     "KR-exported");
}
blob = await zipFile.generateAsync({ type: "blob" });
saveAs(blob, `${projectTitle}.zip`);
```

`generate-katalon-studio-project-zip-file.js`（527 行）生成一整套 KS 工程目录结构：`.prj` 项目文件、`Test Cases/*.groovy` + `*.tc`、`Test Suites/*.ts`、`Data Files/*.dat`、`Profiles/*.glbl`、`Object Repository/`。这是 KR 作为 Katalon 生态引流工具的核心，个人插件**没有任何理由保留**。

`katalon.js` 的 header（`:61-100`）是一大坨固定 import + 初始化：

```groovy
import static com.kms.katalon.core.testdata.TestDataFactory.findTestData
import internal.GlobalVariable as GlobalVariable
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.testdata.CSVData
...
SoftAssert softAssertion = new SoftAssert();
WebUI.openBrowser('${baseURL}')
def driver = DriverFactory.getWebDriver()
String baseUrl = "${baseURL}"
selenium = new WebDriverBackedSelenium(driver, baseUrl)
```

注意最后一行——**Katalon 导出本质上仍是 WebDriverBackedSelenium 的 RC 风格代码**，只有少数命令（`runScript`/`captureEntirePageScreenshot`/`upload`/`dragAndDrop`/`loadVars`）被 `statement()`（`:323-378`）特化成 `WebUI.*` 关键字。

header 模板占位符替换在 `webdriver.js:97-103`：

```javascript
var header = (options.getHeader ? options.getHeader() : options.header).
    replace(/\$\{className\}/g,  className).
    replace(/\$\{methodName\}/g, methodName).
    replace(/\$\{baseURL\}/g,    testCase.getBaseURL()).
    replace(/\$\{([a-zA-Z0-9_]+)\}/g, function(str, name) { return options[name]; });   // ← 任意 options 键
```

最后一条通配规则让 `${packageName}`、`${driverPath}`、`${superClass}` 都能被替换。`${driverPath}` 由 `KS-export-dialog.js:293-297` 的输入框写入 `window.options.driverPath`。

---

## 三、数据结构与流程

### 3.1 核心数据结构

```
Command                                  (testCase.js:17)
├── type      : 'command' | 'comment' | 'line'
├── command   : 'click' | 'assertText' | ...
├── target    : 'id=btn'
├── value     : ''
├── line      : (生成后回填的代码文本)
├── charIndex : (生成后回填的字符偏移，用于点击代码定位命令)
└── remapped  : Command?   (被 SeleneseMapper 改写时保留原命令)

CommandDefinition                        (testCase.js:156)
├── name           : 'getText'
├── params         : [{name, description}, ...]
├── returnType     : 'String' | 'Number' | 'boolean' | 'String[]'
├── isAccessor     : boolean            ← name 匹配 /^(is|get)/
├── negative       : boolean            ← "!getText" 版本
├── comment / alternatives / deprecated : string

CallSelenium                             (webdriver.js:371)
├── message  : 'click'                  ← 规范命令名（def.name）
├── args     : ['"id=btn"']             ← 已经过 xlateArgument
├── rawArgs  : ['id=btn']               ← 原始文本，给 adaptor 用
└── negative : boolean

WDAPI.Driver / Element / ElementList     (各语言 *-wd.js 各自实现)
└── ref : string                        ← 目标语言的表达式文本

window 级全局（导出期间）
├── options                : {receiver, header, footer, indent, initialIndents, defaultExtension, mimetype, driverPath, ...}
├── declaredVars           : {varName: true}          webdriver.js:336
├── javaJunitStoredVars    : {varName: 'long'|'String'|...}   java-advance-junit.js:1
├── katalonStudioStoredVars: {varName: type}          katalon.js:4
├── katalonStudioStoreCSVFile : {fileName: 'data_0'}  katalon.js:6
├── unsupportedCommands    : [commandName, ...]
├── codeBlockCommands      : ['while','if','else','elseIf']
├── indentLevel            : number
└── newFormatters          : {id: fn}                 UI/index.js:18
```

### 3.2 旧体系导出流程图

```
用户选语言
   │
   ├─ 旧对话框: kar-generateScript.js:395 change → handleGenerateToScript() → loadScripts()
   └─ 新对话框: KS-export-dialog.js:254 change → unloadParserScripts() → loadParserScripts(id)
   │
   ▼
loadScripts(): switch(language) → scriptNames[4~8]
   │  逐个 document.createElement('script') + async=false + append
   │  setInterval 轮询 j == scriptNames.length
   ▼
全局函数被逐层覆盖（后加载者胜）
   │
   ▼
generateScripts() / generateExportedScript()
   │  new TestCase(name); testCase.commands = commands
   ▼
format(testCase, name)                       formatCommandOnlyAdapter.js:34
   │
   ├─ formatHeader(testCase)                 webdriver.js:87
   │     └─ options.header 的 ${xxx} 替换 + this.lastIndent = indents(initialIndents)
   │
   ├─ formatCommands(commands)               formatCommandOnlyAdapter.js:84
   │     ├─ filterForRemoteControl()         :54  (AndWait 拆分)
   │     │     └─ postFilter()               webdriver.js:10  (丢 waitForPageToLoad + SeleneseMapper.remap)
   │     └─ 逐条 formatCommand(command)      webdriver.js:415
   │           ├─ def = command.getDefinition()          testCase.js:258
   │           ├─ if def.isAccessor:
   │           │     ├─ /^is/  + assert/verify → assertTrue/verifyTrue(call)
   │           │     ├─ /^is/  + store         → assignToVariable('boolean', ...)
   │           │     ├─ /^get/ + assert/verify → seleniumEquals(returnType, ...).assert()
   │           │     ├─ /^get/ + store         → assignToVariable(returnType, ...)
   │           │     └─ waitFor                → waitFor(eq)
   │           ├─ elif command == 'store'   → assignToVariable('String', ...)
   │           ├─ elif command == '#'       → formatComment
   │           ├─ elif command == 'setTimeout' → setTimeoutCommand
   │           ├─ else (普通动作)            → statement(new CallSelenium(def.name), command)
   │           │        └─ CallSelenium.toString()
   │           │              └─ SeleniumWebDriverAdaptor[message]()      webdriver.js:642+
   │           │                    └─ WDAPI.Driver/Element               各语言 *-wd.js
   │           ├─ catch(e) → formatComment('ERROR: Caught exception [...]')
   │           └─ 按 indentLevel 补缩进        webdriver.js:542-547
   │
   └─ formatFooter(testCase)                 webdriver.js:109
   │
   ▼
displayOnCodeMirror(language, text)          kar-generateScript.js:307
   └─ CodeMirror.fromTextArea(textarea, {mode})
   │
   ▼
Copy to Clipboard / Save As File / Export zip
```

### 3.3 新体系流程（极简）

```
language = "new-formatter-puppeteer"
   ↓ language.replace('new-formatter-','')  → "puppeteer"
newFormatters["puppeteer"](name, commands)
   ↓
{ content, extension, mimetype }
   ↓
displayOnCodeMirror(language, content)   // mode 取自 mimetype
```

---

## 四、隐晦知识点与坑

### 4.1 `this` 在全局函数里指向 `window`

`formatCommandOnlyAdapter.js`、`webdriver.js` 等文件里大量使用 `this.declaredVars`、`this.lastIndent`、`this.name`、`this.options`。这些脚本以经典 `<script>`（非 module、非 strict）加载，顶层 `this === window`。所以：

- `this.name = "java-rc"` 实际上是给 `window.name` 赋值（**会污染 `window.name`，这是浏览器内置属性**）；
- `this.declaredVars` 就是 `window.declaredVars`；
- 在 Selenium IDE 原始设计中这些脚本通过 `mozIJSSubScriptLoader.loadSubScript(url, this)` 加载到一个隔离的 sandbox 对象上，`this` 是 formatter 实例。移植到 Chrome 扩展后失去了沙箱，全部塌陷成 `window`。

> **裁剪要点**：这是整个旧体系不可维护的根因。个人插件千万不要复刻。

### 4.2 `xlateArgument` 有三份不同实现

| 位置 | 用途 | 行为差异 |
|---|---|---|
| `webdriver.js:262` | 导出时（WebDriver 系） | `${x}` → 拼接表达式；需 `declaredVars[x]` 存在；返回 `CallSelenium` 或字符串 |
| `remoteControl.js` | 导出时（RC 系） | 类似但 `getEval` 处理不同 |
| `panel/js/background/formatCommand.js:5` | 运行时（background） | `${x}` → 实际值替换；合并 `storedVars`+`declaredVars` |

`unloadParserScripts()` 之所以要重新注入 `formatCommand.js`，就是为了把 `xlateArgument` 恢复成运行时版本，否则回放会用到导出版的实现而彻底错乱。

### 4.3 `assignToVariable` 里对生成代码跑 `eval()`

`java-advance-junit.js:116`：

```javascript
if (!isNaN(parseFloat(eval(varValue)))) { ... }
```

`varValue` 此时是**已生成的 Java 代码字符串**，例如 `driver.findElement(By.id("x")).getText()`。对它 `eval` 会抛 `ReferenceError: driver is not defined`，被 catch 吞掉——所以 99% 情况下类型推断走不到，默认 `String`。只有当 `varValue` 恰好是 `"123"` 这种纯字面量时 eval 才成功。

这段代码依赖 MV3 manifest 的 `content_security_policy.extension_pages` 包含 `unsafe-eval`。若个人插件不开 `unsafe-eval`，这里会直接抛 `EvalError` 并被同一个 catch 吞掉，行为反而"正常"。

### 4.4 `regex.test()` 与 `g` 标志的经典陷阱

`generate-exported-script.js:3`：

```javascript
const regex = /^\${GlobalVariable\./g      // ← 带 g
...
if (regex.test(commandTarget)) { ... }
if (regex.test(commandValue))  { ... }     // ← 第二次调用从 lastIndex 继续，结果不可预期
```

带 `g` 的正则对象在 `.test()` 之间会保留 `lastIndex`。循环里对不同字符串反复 `test` 同一个 regex 对象，**会交替返回 true/false**。这是一个真实存在的 bug，导致部分 `${GlobalVariable.x}` 没被转换。

同样的写法在 `:25` `addGlobalVariable` 里又出现一次。

### 4.5 `katalon.js:412` 的模板字符串写成了普通字符串

```javascript
case "implicit":
    if (locatorObject.string.startsWith('//')) {
        result += `${objectName}.setSelectorValue(SelectorMethod.XPATH,"${locatorObject.string}")\n`
        result += "${objectName}.setSelectorMethod(SelectorMethod.XPATH)\n";     // ← 双引号
        break;
    }
default:                          // ← 且 implicit 不以 // 开头时会 fall through 到 default
    result = null;
```

双重问题：字面量泄漏 + 有意/无意的 fall-through。

### 4.6 `unsupportedCommands` 是"声明式谎言"

每个 formatter 都定义了一份 50 项左右的 `unsupportedCommands` 数组（`java-advance-junit.js:9-50`、`katalon.js:8-46`、`sample.js:3-55`、`puppeteer.js:300-340`），内容**几乎完全一样**（复制粘贴）。它只用于 UI 显示警告（`check-unsupported-commands.js`）：

```javascript
const checkUnsupportedCommands = (commandName) => window.unsupportedCommands?.includes(commandName);
```

**它不阻止导出**。`katalon.js:333-335` 会把它变成注释；其它 formatter 则直接尝试生成，失败后由 `formatCommand` 的 catch 变成 `// ERROR: Caught exception [...]`。

### 4.7 `robot.js` 的 `filterForRemoteControl` 只替换前两个 `|`

```javascript
if (c1.match("|")) { c1 = c1.replace("|","  ").replace("|","  "); }
```

`String.prototype.replace(string, ...)` 只替换第一个匹配。连调两次 = 替换前两个。如果 target 或 value 本身含 `|`（例如 CSS 选择器 `a|b`），第三个及以后的 `|` 会残留在 Robot 脚本里造成语法错误。

### 4.8 `${KEY_*}` 的四套不同处理

| 场景 | 位置 | 结果 |
|---|---|---|
| Java/C#/Ruby 导出 | `webdriver.js:251-260` `xlateKeyVariable` + `this.sendKeysMaping`（注意拼写 Maping） | `Keys.ENTER` |
| Katalon 导出 | `katalon.js:305-321` `convertSendKeys`，正则 `/(?<=\${KEY_).+?(?=})/g` | `Keys.ENTER`（只支持 ENTER/SHIFT/CTRL 三个） |
| Robot 导出 | `robot.js:71-77` 字符串切片 | 裸文本 `ENTER` |
| Puppeteer 导出 | `puppeteer.js:66-105` `keyDictionary` + `puppeteerReplaceAll` | `ArrowLeft` / `Enter` 等 |

`webdriver.js:249` 的 `this.sendKeysMaping = {}` 是**空对象**，由各语言 formatter 填充；如果某个 formatter 忘了填，`${KEY_ENTER}` 会被当成未声明变量原样保留成字符串。

### 4.9 `formatCommand` 的隐藏输出：`command.line` 和 `command.charIndex`

`formatCommandOnlyAdapter.js:98,102,104` 把生成结果**写回 Command 对象**。这是 Selenium IDE 用来实现"点击代码行 → 高亮对应命令"的双向定位。KR 7.1.0 的 UI 没有使用这个能力（预览是 readOnly），属于遗留代码。

### 4.10 `newFormatters` 注册时机依赖 jQuery ready

`sample.js:1` 和 `puppeteer.js` 结尾都是 `$(document).ready(function(){ ... })`。而 `window.newFormatters = {}` 在 `UI/index.js:18`（ES module，`panel/index.html:999` 引入）。ES module 默认 defer，`$(document).ready` 在 DOMContentLoaded 后触发——**顺序恰好正确但完全是巧合**。如果把 `newformatters/*.js` 改成 `defer` 或 module，就可能在 `newFormatters` 未定义时崩溃。

### 4.11 `generateDefaultProjectZipFile` 是唯一的通用兜底

`KS-export-dialog.js:207-209` 的 `default` 分支对所有 new-formatter 语言都调用 `generateDefaultProjectZipFile`（58 行），把每个 test case 生成的脚本平铺打进 zip。**这是个人插件最应该保留的那个函数**。

---

## 五、裁剪建议

### 5.1 保留（直接复用思想或代码）

| 项 | 理由 | 成本 |
|---|---|---|
| `window.newFormatters` 注册表模式 | 一个函数注册一门语言，零耦合 | 1 行 |
| `newFormatters[id](name, commands) → {content, extension, mimetype}` 契约 | 极简且够用 | 0 |
| `sample.js` 的结构 | 现成脚手架 | 直接抄 |
| `puppeteer.js` 的 `seleneseCommands` 映射对象模式 | 命令→代码 的最佳组织形式 | 直接抄 |
| `unsupportedCommands` 数组 + UI 警告 | 提前告知用户哪些命令导不出 | 5 行 |
| `generate-default-project-zip-file.js` 的批量打包 | JSZip + saveAs 平铺输出 | 50 行 |
| `render-KS-script.js` 的 CodeMirror 销毁-重建模式 | 避免实例泄漏 | 20 行 |
| `webdriver.js:87-103` 的 header 模板 `${xxx}` 替换 | 简单有效 | 5 行 |
| `_elementLocator` 的 locator 前缀解析逻辑 | 复用 `parse_locator` | 已有 |

### 5.2 删除（个人插件完全不需要）

| 项 | 行数 | 理由 |
|---|---:|---|
| `format/csharp/**` | 1410 | C# 用户极少 |
| `format/ruby/**` | 1565 | 同上 |
| `format/python/python-appdynamics.js` | 584 | APM 厂商专用 |
| `format/robot/**` | 293 | 小众 |
| `format/xml/**` | 260 | Selenese XML 已被 `.side`/JSON 取代 |
| `format/katalon/**` + `generate-katalon-studio-project-zip-file.js` | 1089 | 商业生态引流 |
| `format/java/**`（8 文件） | 2465 | 若不需 Java，全删 |
| `newformatters/dynatrace.js` / `nrsynthetics.js` / `protractorts.js` | 1414 | 特定 SaaS |
| `selenium-ide/testCase.js` + `iedoc-core.xml` + `kar-loadCommand.js:79-88` | 621+ | 元数据表可硬编码 20 行 |
| `selenium-ide/remoteControl.js` | 378 | RC 协议已死 |
| `kar-generateScript.js` 的 `loadScripts()` switch | 113 | 动态脚本注入体系整体废弃 |
| `katalon-studio-script-service.js` | 147 | 同上（且与前者重复） |
| `UI/models/KR-export/user-choice.js` 的 profiles 分支 | ~40 | 若不做 Global Profile |
| CodeMirror 的 clike/groovy/php/ruby/xml mode | ~4000 | 只留 javascript / python |

### 5.3 替换（用现代等价物重写）

| 原实现 | 替换方案 | 收益 |
|---|---|---|
| 动态 `<script>` 注入 + 同名函数覆盖（`loadScripts`） | ES module `import()` 动态导入 formatter 模块 | 无全局污染，可 tree-shake |
| `this.xxx`（实为 `window.xxx`）传状态 | formatter 实例对象 / 闭包 context | 可并发、可测试 |
| `CommandDefinition` + iedoc-core.xml | 一个 `const COMMAND_META = {click:{params:1}, type:{params:2}, ...}` 常量对象 | 621 行 → 30 行 |
| `SeleniumWebDriverAdaptor`（60 个 prototype 方法）+ `WDAPI.*`（每语言一套） | 每语言一个 `{commandName: (cmd)=>string}` 映射对象 | 每语言 2500 行 → 150 行 |
| `assignToVariable` 的 `eval` 类型推断 | 目标语言选 JS/Python（动态类型），无需推断 | 删除 55 行 + 去掉 `unsafe-eval` |
| `xlateArgument` 三份实现 | 单一 `interpolate(text, declaredVars, mode)` | 见 MVP |
| CodeMirror 5 全家桶（~1.2 MB） | `highlight.js` 单文件 / `<pre>` + 手写 tokenizer | 包体 -1 MB |
| `formatCommandOnlyAdapter.js` 的 `format/formatCommands/addIndent` | 20 行 `commands.map(fmt).join('\n')` | 127 行 → 20 行 |
| `unloadParserScripts()` 的全局变量重置 | 每次导出新建 context 对象 | 删除 16 行 |

---

## 六、最小可用实现（MVP）

### 6.1 Formatter 注册与调度（约 60 行）

```javascript
// src/export/registry.js
// ------------------------------------------------------------------
// 唯一契约：formatter(commands, ctx) => { content, extension, mimetype }
//   commands : [{command, target, value}]
//   ctx      : { name, baseUrl }
// ------------------------------------------------------------------
const registry = new Map();

export function registerFormatter(id, meta) {
  // meta = { label, extension, mimetype, cmMode, unsupported: [], format(commands, ctx) }
  registry.set(id, meta);
}

export function listFormatters() {
  return [...registry.entries()].map(([id, m]) => ({ id, label: m.label }));
}

export function runFormatter(id, commands, ctx) {
  const m = registry.get(id);
  if (!m) throw new Error(`Unknown formatter: ${id}`);
  const unsupported = new Set(m.unsupported || []);
  const skipped = commands.filter(c => unsupported.has(c.command)).map(c => c.command);
  return {
    content:   m.format(commands, ctx),
    extension: m.extension,
    mimetype:  m.mimetype,
    cmMode:    m.cmMode || 'text/plain',
    skipped:   [...new Set(skipped)],
  };
}

// ---- 公共工具（替代 xlateArgument / string / addIndent）----

/** 转义为目标语言的双引号字符串字面量（对应 webdriver.js:357 string()） */
export function q(v, quote = '"') {
  if (v == null) return quote + quote;
  const s = String(v)
    .replace(/\\/g, '\\\\')
    .replace(new RegExp(quote, 'g'), '\\' + quote)
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return quote + s + quote;
}

/**
 * ${var} 插值（对应 webdriver.js:262 xlateArgument 的 ② 分支，但简化）
 * 返回目标语言的表达式文本。declared 为已声明变量集合。
 */
export function interpolate(text, declared, { tpl = false } = {}) {
  if (text == null) return q('');
  if (!/\$\{/.test(text)) return tpl ? '`' + text.replace(/`/g, '\\`') + '`' : q(text);
  if (tpl) {
    // JS/TS 目标语言：直接用模板字符串，${x} 天然生效
    return '`' + text.replace(/`/g, '\\`') + '`';
  }
  // 非模板语言：拆成 "a" + x + "b"
  const parts = []; let last = 0; const re = /\$\{(.*?)\}/g; let m;
  while ((m = re.exec(text))) {
    const name = m[1];
    if (!declared || declared.has(name)) {
      if (m.index > last) parts.push(q(text.slice(last, m.index)));
      parts.push(name.replace(/[ .-]/g, '_'));
      last = re.lastIndex;
    }
  }
  if (last < text.length) parts.push(q(text.slice(last)));
  return parts.length ? parts.join(' + ') : q(text);
}

/** locator 前缀解析（对应 webdriver.js:559 _elementLocator） */
export function parseLocator(raw) {
  if (!raw) return { type: 'implicit', value: '' };
  if (raw.startsWith('//') || raw.startsWith('(/')) return { type: 'xpath', value: raw };
  const m = /^([a-zA-Z_]+)=([\s\S]*)$/.exec(raw);
  if (!m) return { type: 'implicit', value: raw };
  const type = m[1].toLowerCase();
  return { type: type === 'linktext' ? 'link' : type, value: m[2] };
}

export const indent = (n, unit = '  ') => unit.repeat(Math.max(0, n));
```

### 6.2 完整可用的 Playwright Formatter（约 170 行）

```javascript
// src/export/formatters/playwright.js
import { registerFormatter, q, interpolate, parseLocator, indent } from '../registry.js';

// -------- locator: Selenese → Playwright selector --------
function sel(raw) {
  const { type, value } = parseLocator(raw);
  switch (type) {
    case 'xpath':    return value;                       // Playwright 原生支持裸 xpath
    case 'css':      return value;
    case 'id':       return `#${cssEscape(value)}`;
    case 'name':     return `[name=${q(value, '"')}]`;
    case 'class':    return `.${cssEscape(value)}`;
    case 'link':     return `text=${value.replace(/^exact:/, '')}`;
    case 'tag_name': return value;
    case 'implicit': return value.startsWith('//') ? value : `#${cssEscape(value)}`;
    default:         return value;
  }
}
const cssEscape = s => s.replace(/([ !"#$%&'()*+,./:;<=>?@[\]^`{|}~])/g, '\\$1');

// -------- ${KEY_*} → Playwright key names --------
const KEY = {
  ENTER: 'Enter', TAB: 'Tab', ESC: 'Escape', ESCAPE: 'Escape',
  BKSP: 'Backspace', BACKSPACE: 'Backspace', DEL: 'Delete', DELETE: 'Delete',
  UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight',
  PGUP: 'PageUp', PAGE_UP: 'PageUp', PGDN: 'PageDown', PAGE_DOWN: 'PageDown',
  HOME: 'Home', END: 'End', SHIFT: 'Shift', CTRL: 'Control', ALT: 'Alt',
};
const toKey = v => {
  const m = /^\$\{KEY_(\w+)\}$/.exec((v || '').trim());
  return m ? (KEY[m[1]] || m[1]) : null;
};

// -------- option locator: label=/value=/index= --------
function selectArg(v) {
  const m = /^(label|value|index|id)=([\s\S]*)$/.exec(v || '');
  if (!m) return `{ label: ${q(v)} }`;
  const map = { label: 'label', value: 'value', index: 'index', id: 'value' };
  return m[1] === 'index' ? `{ index: ${parseInt(m[2], 10)} }` : `{ ${map[m[1]]}: ${q(m[2])} }`;
}

// -------- 命令映射表（核心）--------
// 每项: (cmd, S) => string | string[]，S 为共享状态 {declared, level}
const MAP = {
  open:        (c) => `await page.goto(${interpolate(c.target, null, { tpl: true })});`,
  get:         (c) => `await page.goto(${interpolate(c.target, null, { tpl: true })});`,
  click:       (c) => `await page.click(${q(sel(c.target))});`,
  clickat:     (c) => `await page.click(${q(sel(c.target))});`,
  doubleclick: (c) => `await page.dblclick(${q(sel(c.target))});`,
  check:       (c) => `await page.check(${q(sel(c.target))});`,
  uncheck:     (c) => `await page.uncheck(${q(sel(c.target))});`,
  mouseover:   (c) => `await page.hover(${q(sel(c.target))});`,
  mousedown:   (c) => `await page.hover(${q(sel(c.target))});`,
  submit:      (c) => `await page.locator(${q(sel(c.target))}).evaluate(f => f.submit());`,
  refresh:     ()  => `await page.reload();`,
  goback:      ()  => `await page.goBack();`,
  close:       ()  => `await page.close();`,
  pause:       (c) => `await page.waitForTimeout(${parseInt(c.target || c.value || 0, 10)});`,
  settimeout:  (c) => `page.setDefaultTimeout(${parseInt(c.target || c.value || 30000, 10)});`,
  echo:        (c, S) => `console.log(${interpolate(c.target, S.declared, { tpl: true })});`,
  selectframe: (c) => c.target === 'relative=top'
      ? `frame = page;`
      : `frame = page.frame({ name: ${q(parseLocator(c.target).value)} }) || page;`,
  deleteallvisiblecookies: () => `await context.clearCookies();`,
  capturescreenshot:           (c) => `await page.screenshot({ path: ${q((c.target || 'shot') + '.png')} });`,
  captureentirepagescreenshot: (c) => `await page.screenshot({ path: ${q((c.target || 'shot') + '.png')}, fullPage: true });`,

  type: (c, S) => {
    const k = toKey(c.value);
    return k ? `await page.press(${q(sel(c.target))}, ${q(k)});`
             : `await page.fill(${q(sel(c.target))}, ${interpolate(c.value, S.declared, { tpl: true })});`;
  },
  sendkeys: (c, S) => {
    const k = toKey(c.value);
    return k ? `await page.press(${q(sel(c.target))}, ${q(k)});`
             : `await page.type(${q(sel(c.target))}, ${interpolate(c.value, S.declared, { tpl: true })});`;
  },
  select:       (c) => `await page.selectOption(${q(sel(c.target))}, ${selectArg(c.value)});`,
  addselection: (c) => `await page.selectOption(${q(sel(c.target))}, ${selectArg(c.value)});`,

  // --- 断言 ---
  asserttext:        (c, S) => `expect(await page.textContent(${q(sel(c.target))})).toBe(${interpolate(c.value, S.declared, { tpl: true })});`,
  verifytext:        (c, S) => MAP.asserttext(c, S),
  assertvalue:       (c, S) => `expect(await page.inputValue(${q(sel(c.target))})).toBe(${interpolate(c.value, S.declared, { tpl: true })});`,
  verifyvalue:       (c, S) => MAP.assertvalue(c, S),
  asserttitle:       (c, S) => `expect(await page.title()).toBe(${interpolate(c.target, S.declared, { tpl: true })});`,
  verifytitle:       (c, S) => MAP.asserttitle(c, S),
  assertelementpresent:    (c) => `expect(await page.locator(${q(sel(c.target))}).count()).toBeGreaterThan(0);`,
  assertelementnotpresent: (c) => `expect(await page.locator(${q(sel(c.target))}).count()).toBe(0);`,
  assertvisible:     (c) => `await expect(page.locator(${q(sel(c.target))})).toBeVisible();`,
  assertnotvisible:  (c) => `await expect(page.locator(${q(sel(c.target))})).toBeHidden();`,
  assertchecked:     (c) => `await expect(page.locator(${q(sel(c.target))})).toBeChecked();`,
  assertnotchecked:  (c) => `await expect(page.locator(${q(sel(c.target))})).not.toBeChecked();`,

  // --- 等待 ---
  waitforelementpresent: (c) => `await page.waitForSelector(${q(sel(c.target))});`,
  waitforvisible:        (c) => `await page.waitForSelector(${q(sel(c.target))}, { state: 'visible' });`,
  waitfornotvisible:     (c) => `await page.waitForSelector(${q(sel(c.target))}, { state: 'hidden' });`,
  waitforpagetoload:     ()  => `await page.waitForLoadState('networkidle');`,

  // --- 变量 ---
  store:      (c, S) => (S.declared.add(vn(c.value)), `${decl(S, c.value)} = ${interpolate(c.target, S.declared, { tpl: true })};`),
  storetext:  (c, S) => (S.declared.add(vn(c.value)), `${decl(S, c.value)} = await page.textContent(${q(sel(c.target))});`),
  storevalue: (c, S) => (S.declared.add(vn(c.value)), `${decl(S, c.value)} = await page.inputValue(${q(sel(c.target))});`),
  storetitle: (c, S) => (S.declared.add(vn(c.value)), `${decl(S, c.value)} = await page.title();`),
  storeeval:  (c, S) => (S.declared.add(vn(c.value)), `${decl(S, c.value)} = await page.evaluate(() => { return ${c.target}; });`),
  runscript:  (c, S) => c.value
      ? (S.declared.add(vn(c.value)), `${decl(S, c.value)} = await page.evaluate(() => { return ${c.target}; });`)
      : `await page.evaluate(() => { ${c.target} });`,

  // --- 控制流（缩进由外层统一处理）---
  if:       (c) => `if (${cond(c.target)}) {`,
  elseif:   (c) => `} else if (${cond(c.target)}) {`,
  else:     ()  => `} else {`,
  endif:    ()  => `}`,
  while:    (c) => `while (${cond(c.target)}) {`,
  endwhile: ()  => `}`,

  '#':      (c) => `// ${c.target}`,
  comment:  (c) => `// ${c.target}`,
};

const vn   = n => String(n || '').replace(/[ .-]/g, '_');
const decl = (S, n) => (S.seen.has(vn(n)) ? vn(n) : (S.seen.add(vn(n)), `let ${vn(n)}`));
const cond = expr => String(expr || '').replace(/\$\{(.*?)\}/g, (_, n) => vn(n));

const OPEN  = new Set(['if', 'while']);
const CLOSE = new Set(['endif', 'endwhile']);
const MID   = new Set(['else', 'elseif']);

// -------- 主 format --------
function format(commands, ctx = {}) {
  const S = { declared: new Set(), seen: new Set() };
  const body = [];
  let level = 2;

  for (const c of commands) {
    const key = String(c.command || '').toLowerCase().replace(/andwait$/, '');
    const fn = MAP[key];
    let text;
    if (!fn) {
      text = `// [unsupported] ${c.command} | ${c.target} | ${c.value}`;
    } else {
      try { text = fn(c, S); } catch (e) { text = `// [error] ${c.command}: ${e.message}`; }
    }
    if (text == null) continue;

    if (CLOSE.has(key) || MID.has(key)) level--;
    body.push(String(text).split('\n').map(l => indent(level) + l).join('\n'));
    if (OPEN.has(key) || MID.has(key)) level++;

    if (String(c.command || '').endsWith('AndWait')) {
      body.push(indent(level) + `await page.waitForLoadState('networkidle');`);
    }
  }

  const name = (ctx.name || 'recorded').replace(/[^\w]/g, '_');
  return `import { test, expect } from '@playwright/test';

test(${q(ctx.name || 'recorded test')}, async ({ page, context }) => {
  let frame = page;
${body.join('\n')}
});
`;
}

registerFormatter('playwright', {
  label: 'Playwright (JavaScript)',
  extension: 'spec.js',
  mimetype: 'application/javascript',
  cmMode: 'text/javascript',
  unsupported: ['loadVars', 'endLoadVars', 'storeCsv', 'writeToCSV', 'appendToCSV',
                'appendToJSON', 'gotoIf', 'gotoLabel', 'label', 'break',
                'editContent', 'showElement', 'pageWait', 'ajaxWait', 'domWait'],
  format,
});
```

**导出示例**。输入命令序列：

```
open        | https://example.com |
type        | id=q                | ${keyword}
click       | css=button.search   |
waitForVisible | id=result        |
storeText   | id=result           | txt
assertText  | id=result           | ${txt}
```

输出：

```javascript
import { test, expect } from '@playwright/test';

test("recorded test", async ({ page, context }) => {
  let frame = page;
    await page.goto(`https://example.com`);
    await page.fill("#q", `${keyword}`);
    await page.click("button.search");
    await page.waitForSelector("#result", { state: 'visible' });
    let txt = await page.textContent("#result");
    expect(await page.textContent("#result")).toBe(`${txt}`);
});
```

### 6.3 Python + Selenium Formatter（约 90 行，展示非模板语言的差异）

```javascript
// src/export/formatters/python-selenium.js
import { registerFormatter, q, interpolate, parseLocator, indent } from '../registry.js';

const BY = { xpath: 'XPATH', css: 'CSS_SELECTOR', id: 'ID', name: 'NAME',
             link: 'LINK_TEXT', tag_name: 'TAG_NAME', class: 'CLASS_NAME' };

function by(raw) {
  const { type, value } = parseLocator(raw);
  const t = BY[type] || (value.startsWith('//') ? 'XPATH' : 'ID');
  return `By.${t}, ${q(value)}`;
}
const find = raw => `driver.find_element(${by(raw)})`;
const vn   = n => String(n || '').replace(/[ .-]/g, '_');
// Python 无模板字符串插值到局部变量，用 f-string
const val  = (t, S) => /\$\{/.test(t || '')
  ? `f${q(String(t).replace(/\$\{(.*?)\}/g, (_, n) => '{' + vn(n) + '}'))}`
  : q(t);

const MAP = {
  open:        (c, S) => `driver.get(${val(c.target, S)})`,
  click:       (c)    => `${find(c.target)}.click()`,
  doubleclick: (c)    => `ActionChains(driver).double_click(${find(c.target)}).perform()`,
  type:        (c, S) => [`${find(c.target)}.clear()`, `${find(c.target)}.send_keys(${val(c.value, S)})`],
  sendkeys:    (c, S) => `${find(c.target)}.send_keys(${val(c.value, S)})`,
  check:       (c)    => `el = ${find(c.target)}\nif not el.is_selected(): el.click()`,
  uncheck:     (c)    => `el = ${find(c.target)}\nif el.is_selected(): el.click()`,
  select:      (c)    => `Select(${find(c.target)}).select_by_visible_text(${q((c.value || '').replace(/^label=/, ''))})`,
  submit:      (c)    => `${find(c.target)}.submit()`,
  mouseover:   (c)    => `ActionChains(driver).move_to_element(${find(c.target)}).perform()`,
  refresh:     ()     => `driver.refresh()`,
  goback:      ()     => `driver.back()`,
  close:       ()     => `driver.close()`,
  pause:       (c)    => `time.sleep(${(parseInt(c.target || c.value || 0, 10) / 1000).toFixed(3)})`,
  echo:        (c, S) => `print(${val(c.target, S)})`,
  capturescreenshot: (c) => `driver.save_screenshot(${q((c.target || 'shot') + '.png')})`,

  store:      (c, S) => `${vn(c.value)} = ${val(c.target, S)}`,
  storetext:  (c)    => `${vn(c.value)} = ${find(c.target)}.text`,
  storevalue: (c)    => `${vn(c.value)} = ${find(c.target)}.get_attribute("value")`,
  storetitle: (c)    => `${vn(c.value)} = driver.title`,
  storeeval:  (c)    => `${vn(c.value)} = driver.execute_script(${q('return ' + c.target)})`,
  runscript:  (c)    => c.value ? `${vn(c.value)} = driver.execute_script(${q('return ' + c.target)})`
                                : `driver.execute_script(${q(c.target)})`,

  asserttext:  (c, S) => `assert ${find(c.target)}.text == ${val(c.value, S)}`,
  verifytext:  (c, S) => MAP.asserttext(c, S),
  assertvalue: (c, S) => `assert ${find(c.target)}.get_attribute("value") == ${val(c.value, S)}`,
  asserttitle: (c, S) => `assert driver.title == ${val(c.target, S)}`,
  assertelementpresent:    (c) => `assert len(driver.find_elements(${by(c.target)})) > 0`,
  assertelementnotpresent: (c) => `assert len(driver.find_elements(${by(c.target)})) == 0`,

  waitforelementpresent: (c) => `WebDriverWait(driver, 30).until(EC.presence_of_element_located((${by(c.target)})))`,
  waitforvisible:        (c) => `WebDriverWait(driver, 30).until(EC.visibility_of_element_located((${by(c.target)})))`,
  waitforpagetoload:     ()  => `WebDriverWait(driver, 30).until(lambda d: d.execute_script("return document.readyState") == "complete")`,

  if:       (c) => `if ${cond(c.target)}:`,
  elseif:   (c) => `elif ${cond(c.target)}:`,
  else:     ()  => `else:`,
  endif:    ()  => null,          // Python 靠缩进，无闭合符号
  while:    (c) => `while ${cond(c.target)}:`,
  endwhile: ()  => null,
  '#':      (c) => `# ${c.target}`,
};

const cond  = e => String(e || '').replace(/\$\{(.*?)\}/g, (_, n) => vn(n))
                                  .replace(/&&/g, ' and ').replace(/\|\|/g, ' or ').replace(/!(?!=)/g, ' not ');
const OPEN  = new Set(['if', 'elseif', 'else', 'while']);
const CLOSE = new Set(['endif', 'endwhile']);
const MID   = new Set(['elseif', 'else']);

function format(commands, ctx = {}) {
  const S = {}; const body = []; let level = 2;
  for (const c of commands) {
    const key = String(c.command || '').toLowerCase().replace(/andwait$/, '');
    const fn = MAP[key];
    if (CLOSE.has(key)) { level--; continue; }
    if (MID.has(key))   { level--; }
    let out;
    try { out = fn ? fn(c, S) : `# [unsupported] ${c.command} | ${c.target} | ${c.value}`; }
    catch (e) { out = `# [error] ${c.command}: ${e.message}`; }
    if (out != null) {
      for (const line of [].concat(out)) {
        body.push(String(line).split('\n').map(l => indent(level, '    ') + l).join('\n'));
      }
    }
    if (OPEN.has(key)) level++;
  }
  const cls = (ctx.name || 'Recorded').replace(/[^\w]/g, '');
  return `import time, unittest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class Test${cls}(unittest.TestCase):
    def setUp(self):
        self.driver = webdriver.Chrome()
        self.driver.implicitly_wait(30)

    def test_${cls.toLowerCase()}(self):
        driver = self.driver
${body.join('\n')}

    def tearDown(self):
        self.driver.quit()


if __name__ == "__main__":
    unittest.main()
`;
}

registerFormatter('python-selenium', {
  label: 'Python (Selenium + unittest)',
  extension: 'py', mimetype: 'text/x-python', cmMode: 'text/x-python',
  unsupported: ['loadVars', 'endLoadVars', 'storeCsv', 'writeToCSV', 'gotoIf', 'gotoLabel', 'label'],
  format,
});
```

### 6.4 UI 接线（约 40 行）

```javascript
// src/export/dialog.js
import { listFormatters, runFormatter } from './registry.js';
import './formatters/playwright.js';
import './formatters/python-selenium.js';

let cm = null;

export function initExportDialog() {
  const $sel = document.querySelector('#export-language');
  $sel.innerHTML = listFormatters()
    .map(f => `<option value="${f.id}">${f.label}</option>`).join('');
  $sel.addEventListener('change', preview);
  document.querySelector('#export-copy').addEventListener('click', () => navigator.clipboard.writeText(cm.getValue()));
  document.querySelector('#export-save').addEventListener('click', save);
  preview();
}

function currentCommands() { /* 从你的 test case model 取 [{command,target,value}] */ }
function currentName()     { /* 取当前用例名 */ }

function preview() {
  const id = document.querySelector('#export-language').value;
  const r  = runFormatter(id, currentCommands(), { name: currentName() });
  const ta = document.querySelector('#export-script');
  if (cm) { cm.toTextArea(); cm = null; }          // 销毁-重建，见 §2.12
  ta.value = r.content;
  cm = CodeMirror.fromTextArea(ta, { lineNumbers: true, readOnly: true, lineWrapping: true, mode: r.cmMode });
  const warn = document.querySelector('#export-warning');
  warn.style.display = r.skipped.length ? 'block' : 'none';
  warn.textContent = r.skipped.length ? `Unsupported: ${r.skipped.join(', ')}` : '';
  window.__lastExport = r;
}

async function save() {
  const r = window.__lastExport;
  const url = URL.createObjectURL(new Blob([r.content], { type: r.mimetype }));
  await chrome.downloads.download({
    filename: `${currentName().replace(/[^\w]/g, '_')}.${r.extension}`,
    url, saveAs: true, conflictAction: 'overwrite',
  });
  URL.revokeObjectURL(url);
}
```

### 6.5 新增一门语言的成本

按上面的骨架，新增一门语言 = **写一个 `MAP` 对象 + 一个 `format()` 包壳 + 一行 `registerFormatter`**，典型 120~180 行，不需要碰任何公共代码。对比旧体系需要写 4~5 个文件、2500+ 行、还要处理全局函数覆盖顺序。

**核心指标对比**：

| 项 | 原版 | MVP |
|---|---:|---:|
| 导出体系总代码 | ~16000 行（含 11 语言 + CodeMirror） | ~500 行（2 语言） |
| 新增一门语言 | 2500 行 / 5 文件 | 150 行 / 1 文件 |
| 全局变量污染 | 12+ 个 window 变量 | 0 |
| 依赖 `unsafe-eval` | 是（`assignToVariable`） | 否 |
| CodeMirror 体积 | ~1.2 MB（7 mode） | ~180 KB（1 mode）或 0 |

---

## 附：命令覆盖度自查清单

MVP formatter 至少应覆盖以下 30 条命令（按 KR 录制产出频率排序），其余可先落 `// [unsupported]`：

`open` `click` `clickAndWait` `type` `sendKeys` `select` `check` `uncheck` `submit` `mouseOver` `doubleClick` `pause` `refresh` `goBack` `close` `selectFrame` `selectWindow` `echo` `store` `storeText` `storeValue` `storeTitle` `storeEval` `runScript` `assertText` `assertValue` `assertTitle` `assertElementPresent` `assertVisible` `waitForElementPresent` `waitForVisible` `if` `else` `elseIf` `endIf` `while` `endWhile` `captureScreenshot` `deleteAllVisibleCookies` `setTimeout`
