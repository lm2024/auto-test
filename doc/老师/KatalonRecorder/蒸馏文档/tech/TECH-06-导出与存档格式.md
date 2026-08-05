# TECH-06 · 导出（代码生成）与存档格式

> 覆盖：19 种导出格式的插件式架构 · 新旧两套 formatter 体系 · `.krecorder` 存档格式 · `.side` 导入 · Katalon Studio 项目 ZIP 导出
> 全部结论带 `文件路径:行号`。

---

## 0. 一句话结论

**KR 有两套并存的 formatter 体系：① 继承自 Selenium IDE 的"旧式"体系（全局函数 `format()/formatCommand()/formatHeader()/formatFooter()` + `SeleneseMapper.remap` + `WDAPI` 语言适配层，靠动态 `<script>` 注入按需加载）；② 自研"新式" `newFormatters[id](name, commands) → {content, extension, mimetype}`（纯函数、无全局污染、启动即全部加载）。第三条路是把命令数组 `sendMessage` 给外部扩展代劳。存档用"Selenium IDE HTML 表格 + `<datalist>` 候选定位器 + `data-tags` 标签"的私有增强格式。**

---

## 1. 支持的导出格式全清单

### 下拉 1 —— 单用例导出（Export Test Case as Script）
`panel/index.html:779-805`，**只含新式 formatter**（8 项）：

| value | 显示名 | 实现文件 |
|---|---|---|
| `new-formatter-dynatrace` | JSON (Dynatrace Synthetics) | `newformatters/dynatrace.js` |
| `new-formatter-nrsynthetics` | Node (New Relic Synthetics) | `newformatters/nrsynthetics.js` |
| `new-formatter-protractorts` | Protractor (Typescript) | `newformatters/protractorts.js` |
| `new-formatter-webdriver` | WebDriver.io | `newformatters/webdriver.js` |
| `new-formatter-sample` | Sample for new formatters | `newformatters/sample.js` |
| `new-formatter-puppeteer` | Puppeteer | `newformatters/puppeteer.js` |
| `new-formatter-puppeteer_w_comment` | Puppeteer w Comments | 同上 |
| `new-formatter-puppeteer_json` | JSON (puppeteer) | 同上 |

> `puppeteer.js` 一个文件注册 3 个键，所以 6 个文件 → 8 个选项。

### 下拉 2 —— 整项目导出（Export to Katalon Studio）
`panel/js/UI/view/KS-export/KS-export-dialog.js:38-58`，**新旧全含（19 项）**：

| value | 显示名 | 体系 |
|---|---|---|
| `katalon` | Katalon Studio | 旧式 |
| `java-wd-testng` | Java (WebDriver + TestNG) | 旧式 |
| `java-wd-junit` | Java (WebDriver + JUnit) | 旧式 |
| `java-rc-junit` | Java (WebDriver-backed RC + JUnit) | 旧式 |
| `python2-wd-unittest` | Python 2 (WebDriver + unittest) | 旧式 |
| `cs-wd-mstest` | C# (WebDriver + MSTest) | 旧式 |
| `cs-wd-nunit` | C# (WebDriver + NUnit) | 旧式 |
| `python-appdynamics` | Python (AppDynamics) | 旧式 |
| `robot` | Robot Framework | 旧式 |
| `ruby-wd-rspec` | Ruby (WebDriver + RSpec) | 旧式 |
| `xml` | XML | 旧式 |
| `new-formatter-*` ×8 | 同上表 | 新式 |

### 磁盘上的 formatter 文件

```
panel/js/katalon/selenium-ide/
├── format/
│   ├── csharp/   cs-mstest-wd.js  cs-rc.js  cs-wd.js
│   ├── java/     java-advance-junit.js  java-advance-testng.js  java-backed-junit4.js
│   │             java-rc.js  java-rc-junit4.js  java-rc-testng.js
│   │             webdriver-junit4.js  webdriver-testng.js
│   ├── katalon/  katalon.js
│   ├── python/   python2-rc.js  python2-wd.js  python-advance-unittest.js  python-appdynamics.js
│   ├── robot/    robot.js
│   ├── ruby/     ruby-rc.js  ruby-rc-rspec.js  ruby-wd.js  ruby-wd-rspec.js
│   └── xml/      XML-formatter.js
├── formatCommandOnlyAdapter.js     ← 通用 format() 骨架
├── iedoc-core.xml                  ← Selenium API 命令元数据
├── remoteControl.js                ← RC 语义层
├── testCase.js                     ← TestCase/Command 模型
└── webdriver.js                    ← WebDriver 语义层（846 行，语言无关）

panel/js/katalon/newformatters/
    dynatrace.js  nrsynthetics.js  protractorts.js  puppeteer.js  sample.js  webdriver.js
```

---

## 2. 架构一：旧式 Selenium-IDE formatter

### 2.1 依赖是"层叠覆盖"式的

后加载的脚本覆盖前者定义的全局函数/对象。`loadScripts()` 用一个巨型 switch 给出每种语言的**精确加载序列**：

`panel/js/katalon/kar-generateScript.js:25-143`
```js
function loadScripts() {
    var language = $("#select-script-language-id").val();
    var scriptNames = [];
    var isExternalCapability = false;
    var newFormatter = null;
    switch (language) {
        case 'cs-wd-nunit':
            scriptNames = [
                'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
                'js/katalon/selenium-ide/remoteControl.js',
                "js/katalon/selenium-ide/format/csharp/cs-rc.js",
                'js/katalon/selenium-ide/webdriver.js',
                "js/katalon/selenium-ide/format/csharp/cs-wd.js"
            ];
            break;
        case 'java-wd-testng':
            scriptNames = [
                'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
                'js/katalon/selenium-ide/remoteControl.js',
                "js/katalon/selenium-ide/format/java/java-rc.js",
                "js/katalon/selenium-ide/format/java/java-rc-junit4.js",
                "js/katalon/selenium-ide/format/java/java-rc-testng.js",
                'js/katalon/selenium-ide/webdriver.js',
                "js/katalon/selenium-ide/format/java/webdriver-testng.js",
                "js/katalon/selenium-ide/format/java/java-advance-testng.js",
            ];
            break;
        case 'robot':
            scriptNames = [
                'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
                'js/katalon/selenium-ide/format/robot/robot.js'
            ];
            break;
        ...
        default:
            if (language.indexOf('new-formatter') >= 0) {
                var newFormatterId = language.replace('new-formatter-', '');
                newFormatter = newFormatters[newFormatterId];
            } else {
                isExternalCapability = true;     // 落到第三方扩展
            }
    }
```

**注意加载顺序的含义**：`java-rc.js` → `java-rc-junit4.js` → `java-rc-testng.js` → `webdriver.js` → `webdriver-testng.js` → `java-advance-testng.js`，每一层覆盖上一层的部分全局函数，最终形态是六层叠加的结果。**这是一种极其脆弱的"继承"实现。**

### 2.2 动态注入实现

`panel/js/katalon/kar-generateScript.js:150-171`
```js
$("[id^=formatter-script-language-id-]").remove();
var j = 0;
for (var i = 0; i < scriptNames.length; i++) {
    var script = document.createElement('script');
    script.id = "formatter-script-language-id-" + language + '-' + i;
    script.src = scriptNames[i];
    script.async = false; // This is required for synchronous execution
    script.onload = function() { j++; }
    document.head.appendChild(script);
}
var interval = setInterval(function() {
    if (j == scriptNames.length) { clearInterval(interval); generateScripts(isExternalCapability, language); }
}, 100);
```

`async = false` 保证按序执行，计数器 + 轮询等全部 onload。

### 2.3 三条出口分支

`panel/js/katalon/kar-generateScript.js:181-251`
```js
function generateScripts(isExternalCapability, language, newFormatter) {
    let commands = getCommandsToGenerateScripts();
    var name = getTestCaseName();
    ...
    if (isExternalCapability) {                                       // ① 委托外部扩展
        var option = $('#' + language);
        var extensionId = option.data('extensionId');
        var capabilityId = option.data('capabilityId');
        window.options = { defaultExtension: 'txt', mimetype: 'text/plain' };
        browser.runtime.sendMessage(extensionId, {
                type: 'katalon_recorder_export',
                payload: { capabilityId: capabilityId, name: name, commands: commands }
        }).then(function(response) {
            var payload = response.payload;
            if (response.status) {
                options = { defaultExtension: payload.extension, mimetype: payload.mimetype };
                displayOnCodeMirror(language, payload.content);
            } else { throw (payload); }
        }).catch(function(err) { ... });
    } else if (newFormatter) {                                        // ② 新式 formatter
        var payload = newFormatter(name, commands);
        options = { defaultExtension: payload.extension, mimetype: payload.mimetype };
        displayOnCodeMirror(language, payload.content);
    } else {                                                          // ③ 旧式 formatter
        var testCase = new TestCase(name);
        testCase.commands = commands;
        testCase.formatLocal(name).header = "";
        testCase.formatLocal(name).footer = "";
        displayOnCodeMirror(language, format(testCase, name));

        $("[id^=formatter-script-language-id-]").remove();
        var script = document.createElement('script');
        script.id = "formatter-script-language-id-" + language;
        script.src = 'js/background/formatCommand.js';
        script.async = false;
        document.head.appendChild(script);          // ★ 恢复被覆盖的 formatCommand（回放用）
    }
}
```

> ⚠️ **最后那段是必要的副作用清理**：旧式 formatter 覆盖了全局 `formatCommand`，而回放引擎（`panel/js/background/formatCommand.js:73`）也用同名函数，不恢复就会污染回放。
> **这是全局函数式 formatter 的最大代价 —— 导出一次代码，回放引擎的函数就被换掉了，必须手动换回来。**

---

## 3. 旧式 formatter 的三层结构

### 第 1 层：通用适配器（提供 `format()` 骨架）

`panel/js/katalon/selenium-ide/formatCommandOnlyAdapter.js:34-52`
```js
function format(testCase, name) {
    var result = '';
    var header = "";
    var footer = "";
    this.commandCharIndex = 0;
    if (this.formatHeader) { header = formatHeader(testCase); }
    result += header;
    this.commandCharIndex = header.length;
    testCase.formatLocal(this.name).header = header;
    result += formatCommands(testCase.commands);
    if (this.formatFooter) { footer = formatFooter(testCase); }
    result += footer;
    testCase.formatLocal(this.name).footer = footer;
    return result;
}
```

**AndWait 拆分 + postFilter 钩子**：`formatCommandOnlyAdapter.js:54-76`
```js
function filterForRemoteControl(originalCommands) {
    if (this.remoteControl) {
        var commands = [];
        for (var i = 0; i < originalCommands.length; i++) {
            var c = originalCommands[i];
            if (c.type == 'command' && c.command.match(/AndWait$/)) {
                var c1 = c.createCopy();
                c1.command = c.command.replace(/AndWait$/, '');
                commands.push(c1);
                commands.push(new Command("waitForPageToLoad", options['global.timeout'] || "30000"));
            } else { commands.push(c); }
        }
        if (this.postFilter) {
            commands = this.postFilter(commands);
        }
        return commands;
    } else { return originalCommands; }
}
```

即：`clickAndWait` → `click` + `waitForPageToLoad 30000` 两条。

**逐条派发 + 缩进**：`formatCommandOnlyAdapter.js:84-113`
```js
function formatCommands(commands) {
    commands = filterForRemoteControl(commands);
    if (this.lastIndent == null) { this.lastIndent = ''; }
    var result = '';
    for (var i = 0; i < commands.length; i++) {
        var line = null;
        var command = commands[i];
        if (command.type == 'line') { line = command.line; }
        else if (command.type == 'command') {
            line = formatCommand(command);
            if (line != null) line = addIndent(line);
            command.line = line;
        } else if (command.type == 'comment' && this.formatComment) {
            line = formatComment(command);
            if (line != null) line = addIndent(line);
            command.line = line;
        }
        command.charIndex = this.commandCharIndex;
        if (line != null) { line = line + "\n"; result += line; this.commandCharIndex += line.length; }
    }
    return result;
}
```

### 第 2 层：WebDriver 语义层（`webdriver.js`，846 行，语言无关）

**postFilter 剥掉 `waitForPageToLoad`**（WebDriver 有隐式等待）：`webdriver.js:5-20`
```js
/* @override
  * This function filters the command list and strips away the commands we no longer need
  * or changes the command to another one.
  */
this.postFilter = function(originalCommands) {
  var commands = [];
  var commandsToSkip = { 'waitForPageToLoad' : 1, };
  ...
```

**`SeleneseMapper` 把 `*TextPresent` 重映射为对 `css=BODY` 的文本断言**：`webdriver.js:39-56`
```js
SeleneseMapper.remap = function(cmd) {
  if (SeleneseMapper.IsTextPresent.isDefined(cmd)) {
    return SeleneseMapper.IsTextPresent.convert(cmd);
  }
  return null;
};

SeleneseMapper.IsTextPresent = {
  isTextPresentRegex: /^(assert|verify|waitFor)Text(Not)?Present$/,
  isPatternRegex: /^(regexp|regexpi|regex):/,
  exactRegex: /^exact:/,
```

**命令派发主循环**（按 `assert`/`verify`/`store`/`waitFor` 前缀 × `isXXX`/`getXXX` 两类访问器分发）：`webdriver.js:415-450`
```js
function formatCommand(command) {
  var line = null;
  try {
    var call; var i; var eq; var method;
    if (command.type == 'command') {
      var def = command.getDefinition();          // ← 来自 iedoc-core.xml
      if (def && def.isAccessor) {
        call = new CallSelenium(def.name);
        for (i = 0; i < def.params.length; i++) {
          call.rawArgs.push(command.getParameterAt(i));
          call.args.push(xlateArgument(command.getParameterAt(i)));
        }
        var extraArg = command.getParameterAt(def.params.length);
        if (def.name.match(/^is/)) { // isXXX
          if (command.command.match(/^assert/) || ...) {
            line = (def.negative ? assertFalse : assertTrue)(call);
          } else if (command.command.match(/^verify/)) {
            line = (def.negative ? verifyFalse : verifyTrue)(call);
          } else if (command.command.match(/^store/)) {
            addDeclaredVar(extraArg);
            line = statement(assignToVariable('boolean', extraArg, call, command));
          } else if (command.command.match(/^waitFor/)) {
            line = waitFor(def.negative ? call.invert() : call);
          }
        } else { // getXXX
          ...
```

> **`command.getDefinition()` 的数据源是 `panel/js/katalon/selenium-ide/iedoc-core.xml`** —— Selenium API 的 XML 元数据（每个命令的参数个数、类型、是否 accessor、是否 negative）。这也是 Reference 标签页的数据源。

### 第 3 层：具体语言模板（以 `webdriver-testng.js` 为例，528 行）

**配置项**：`format/java/webdriver-testng.js:270-278`
```js
this.options = {
  receiver: "driver",
  packageName: "com.example",
  indent:    '2',
  initialIndents:    '2',
  showSelenese: 'false',
  defaultExtension: "java",
  driverPath: "",
};
```

**Header 模板**（`${...}` 占位符在 `formatHeader` 里替换）：`webdriver-testng.js:280-310`
```js
options.header =
    "package ${packageName};\n" + "\n" +
        "import java.util.regex.Pattern;\n" +
        "import java.util.concurrent.TimeUnit;\n" +
        "import org.testng.annotations.*;\n" +
        "import static org.testng.Assert.*;\n" +
        "import org.openqa.selenium.*;\n" +
        "import org.openqa.selenium.chrome.ChromeDriver;\n" +
        ...
        "public class ${className} {\n" +
        indents(1) + "private WebDriver driver;\n" +
        indents(1) + "private String baseUrl;\n" +
        indents(1) + "private boolean acceptNextAlert = true;\n" +
        indents(1) + "private StringBuffer verificationErrors = new StringBuffer();\n" +
        indents(1) + "private JavascriptExecutor js;\n" +
        indents(1) + "@BeforeClass(alwaysRun = true)\n" +
        indents(1) + "public void setUp() throws Exception {\n" +
        indents(2) + "System.setProperty(\"webdriver.chrome.driver\", \"${driverPath}\");\n" +
        indents(2) + "driver = new ChromeDriver();\n" +
        indents(2) + "baseUrl = \"${baseURL}\";\n" +
        indents(2) + "driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(30));\n" +
        indents(2) + "js = (JavascriptExecutor) driver;\n" +
        indents(1) + "}\n" +
        indents(1) + "@Test\n" +
        indents(1) + "public void ${methodName}() throws Exception {\n";
```

**Footer** 含三个辅助方法（`isElementPresent` / `isAlertPresent` / `closeAlertAndGetItsText`）：`webdriver-testng.js:312-356`

**语言 API 适配层 `WDAPI`**：`webdriver-testng.js:386-401`
```js
WDAPI.Driver = function() { this.ref = options.receiver; };

WDAPI.Driver.searchContext = function(locatorType, locator) {
  var locatorString = xlateArgument(locator);
  switch (locatorType) {
    case 'xpath': return 'By.xpath('        + locatorString + ')';
    case 'css':   return 'By.cssSelector('  + locatorString + ')';
    case 'id':    return 'By.id('           + locatorString + ')';
    case 'link':  return 'By.linkText('     + locatorString + ')';
    case 'name':  ...
```

**XUL 配置表单**（Firefox 时代遗迹，现代 Chrome 完全无用）：`webdriver-testng.js:358-384`
```js
this.configForm =
    '<description>Variable for Selenium instance</description>' +
        '<textbox id="options_receiver" />' + ...
```

**变量插值** `xlateArgument(value)` 在 `panel/js/background/formatCommand.js:5-47`，把 `${var}` 转成目标语言的字符串拼接表达式（旧式导出与回放共用同一函数——这就是必须"用完恢复"的原因）。

---

## 4. 架构二：新式 formatter（推荐复刻对象）

### 4.1 契约

```js
newFormatters[id] = function(name, commands) {
    return {
        content:   String,   // 生成的代码全文
        extension: String,   // 文件扩展名，如 'js'
        mimetype:  String    // 如 'text/javascript'
    };
}
```

另可选设置 `window.unsupportedCommands`（数组），供 UI 提前警告。

新式 formatter 在 `panel/index.html:1049-1073` 一次性全部 `<script>` 引入，无需动态加载。

### 4.2 完整示例 1：`newformatters/sample.js`（最小实现）

```js
$(document).ready(function(){
  newFormatters.sample = function(name, commands) {
    window.unsupportedCommands = ["ajaxWait", "break", "domWait", "editContent",
      "pageWait", "prePageWait", "showElement", "waitPreparation",
      "gotoIf", "gotoLabel", "label", "writeToCSV", "appendToCSV", "appendToJSON",
      "storeCsv", "endLoadVars", "loadVars", "addSelection",
      "captureEntirePageScreenshot", "getEval", "runScript",
      "if", "else", "endIf", "elseIf", "while", "endWhile",
      "selectWindow", "storeEval"
      /* …源码里共 50+ 条… */ ]

    var content = '';
    for (var i = 0; i < commands.length; i++) {
      var command = commands[i];
      content += command.command + ' | ' + command.target + ' | ' + command.value + '\n';
    }
    return {
      content: content,
      extension: 'txt',
      mimetype: 'text/plain'
    }
  }
})
```

> **这 20 行就是最小可用 formatter。** 想加一种导出格式，照着改 `content` 的生成逻辑即可。

### 4.3 完整示例 2：`newformatters/webdriver.js`（WebDriver.io，231 行）

注册壳（`:1-64`）：
```js
$(document).ready(function(){
  newFormatters.webdriver = function (name, commands) {
    window.unsupportedCommands = [ /* 同 sample */ ]
    let content = newWebDriver(name).formatter(commands);
    return { content: content, extension: 'js', mimetype: 'text/javascript' }
  }
})
```

工厂函数核心（`:67-229`）—— **这是"命令表驱动 + 字符串模板"的典型写法**：
```js
const newWebDriver = function (scriptName) {
  let _scriptName = scriptName || "";

  // ① 定位器类型 → 目标语言选择器表达式
  const locatorType = {
    xpath:    (target) => `'${target.replace(/'/g, "\\\'")}'`,
    css:      (target) => `'${target.replace(/"/g, "\'")}'`,
    id:       (target) => `'#${target.replace(/"/g, "\'")}'`,
    link:     (target) => `'=${target.replace(/"/g, "\'")}'`,
    name:     (target) => `'[name="${target.replace(/"/g, "\'")}"]'`,
    tag_name: (target) => `'${target.replace(/"/g, "\'")}'`
  };

  // ② 特殊键映射（W3C WebDriver keyboard actions）
  const specialKeyMap = {
    '\${KEY_LEFT}': 'ArrowLeft',   '\${KEY_UP}': 'ArrowUp',
    '\${KEY_RIGHT}': 'ArrowRight', '\${KEY_DOWN}': 'ArrowDown',
    '\${KEY_PAGE_UP}': 'PageUp',   '\${KEY_PAGE_DOWN}': 'PageDown',
    '\${KEY_BACKSPACE}': 'Backspace', '\${KEY_DEL}': 'Delete',
    '\${KEY_ENTER}': 'Key.ENTER',  '\${KEY_TAB}': 'Tab',
    '\${KEY_HOME}': 'Home',        '\${KEY_END}': 'End'
  };

  // ③ 命令 → 代码模板（共 25 条）
  const seleneseCommands = {
    "open":  "browser.url('_TARGET_');",
    "click": "$(_BY_LOCATOR_).click();",
    "clickAndWait":
      "const el__STEP_ = $(_BY_LOCATOR_);\n" +
      "\t\tel__STEP_.waitForClickable();\n" +
      "\t\tel__STEP_.click();",
    "doubleClick": "$(_BY_LOCATOR_).doubleClick();",
    "type":  "$(_BY_LOCATOR_).setValue('_VALUE_');",
    "pause": "browser.pause(_VALUE_);",
    "refresh": "browser.refresh();",
    "sendKeys": "await $(_BY_LOCATOR_).sendKeys(_SEND_KEY_);",
    "select": "$(_BY_LOCATOR_).selectByVisibleText('_SELECT_OPTION_');",
    "goBack": "browser.back();",
    "assertConfirmation": "browser.acceptAlert()",
    "verifyText":  "expect( $(_BY_LOCATOR_)).toHaveTextContaining(`_VALUE_STR_`);",
    "verifyTitle": "expect( browser).toHaveTitle(`_VALUE_STR_`);",
    "assertText":  "expect( $(_BY_LOCATOR_)).toHaveTextContaining(`_VALUE_STR_`);",
    "waitForElementPresent": "$(_BY_LOCATOR_).waitForExist();",
    "waitForValue":
      "const el__STEP_ = $(_BY_LOCATOR_);\n" +
      "\t\tbrowser.waitUntil(() => el__STEP_.getValue() === `_VALUE_STR_`);",
    "waitForVisible": "$(_BY_LOCATOR_).waitForDisplayed();",
    // ...
  };

  const header =
    "var assert = require('assert');\n\n" +
    "describe('_SCRIPT_NAME_', function() {\n\n" +
    "\tit('should do something', function() {\n";
  const footer = "\t});\n\n});";

  function formatter(commands) {
    return header.replace(/_SCRIPT_NAME_/g, _scriptName) +
      commandExports(commands).content + footer;
  }

  // ④ reduce 遍历，不支持的命令降级为注释
  function commandExports(commands) {
    return commands.reduce((accObj, commandObj) => {
      let { command, target, value } = commandObj;
      let cmd = seleneseCommands[command];
      if (typeof (cmd) == "undefined") {
        accObj.content += `\n\n\t// WARNING: unsupported command ${command}. Object= ${JSON.stringify(commandObj)}\n\n`;
        return accObj;
      }
      let funcStr = cmd;
      let targetStr = target.trim().replace(/'/g, "\\'").replace(/"/g, '\\"');
      let valueStr  = value.trim().replace(/'/g, "\\'").replace(/"/g, '\\"');
      let selectOption = value.trim().split("=", 2)[1];
      let locatorStr = locator(target);

      funcStr = funcStr.replace(/_STEP_/g, accObj.step)
        .replace(/_TARGET_STR_/g, targetStr)
        .replace(/_BY_LOCATOR_/g, locatorStr)
        .replace(/_TARGET_/g, target)
        .replace(/_SEND_KEY_/g, specialKeyMap[value])
        .replace(/_VALUE_STR_/g, valueStr)
        .replace(/_VALUE_/g, value)
        .replace(/_SELECT_OPTION_/g, selectOption);

      accObj.step += 1;
      accObj.content += `\t\t${funcStr}\n`
      return accObj;
    }, { step: 1, content: "" });
  }

  function locator(target) {
    let locType = target.split("=", 1);
    let selectorStr = target.substr(target.indexOf("=") + 1, target.length);
    let locatorFunc = locatorType[locType];
    if (typeof (locatorFunc) == 'undefined') {
      return `'${target.replace(/'/g, '"')}'`;
    }
    return locatorFunc(selectorStr);
  }

  return { formatter, locator };
}
```

> ⚠️ **两个可复刻时应修正的缺陷**：
> 1. `_VALUE_STR_` 必须在 `_VALUE_` **之前**替换，否则 `_VALUE_` 会先吃掉 `_VALUE_STR_` 的前缀。KR 的顺序（`:198-205`）碰巧是对的，但极其脆弱。→ 改用一次性 `replace(/_([A-Z_]+)_/g, (m,k)=>map[k])`。
> 2. `locator()` 里 `let locType = target.split("=", 1)` 得到的是**数组**，却被当 key 用（`locatorType[locType]`），靠 JS 隐式 `Array.toString()` 侥幸工作。→ 改 `const [locType] = target.split("=", 1)`。

---

## 5. 整项目导出（Export to Katalon Studio → ZIP）

命令模型转换：`panel/js/UI/services/KS-export-service/generate-exported-script.js`（72 行）
- KR 命令 → Script 命令映射（含 `${GlobalVariable.` 转换）
- 两条 formatter 分支（新式 `:51-60`；旧式 `format()` `:67`）

四个 ZIP 项目模板：`panel/js/UI/view/KS-export/KS-export-dialog.js:20-23`
```js
import { generateJavaJunitProjectZipFile }      from ".../generate-java-junit-project-zip-file.js";
import { generateJavaTestNGProjectZipFile }     from ".../generate-java-testng-project-zip-file.js";
import { generatePythonUnittestProjectZipFile } from ".../generate-python-unitest-project-zip-file.js";
import { generateDefaultProjectZipFile }        from ".../generate-default-project-zip-file.js";
```
外加 Katalon Studio 专用：`KS-export-dialog.js:6` 的 `generateKatalonStudioProjectZipFile`。

ZIP 打包库：`panel/index.html:73-74`
```html
<script type="text/javascript" src="js/lib/jszip.min.js"></script>
<script type="text/javascript" src="js/lib/FileSaver.js"></script>
```

**不支持命令的预警 UI**：`KS-export-dialog.js:65-68`
```html
<div id="export-to-KS-warning">
    <img src="/katalon/images/SVG/export-warning-icon.svg" />
    <span>Some selected test cases contain unsupported commands</span>
</div>
```

保存单文件：`kar-generateScript.js:273-279`；记住上次选择的语言：`kar-generateScript.js:255-264`（存 `storage.local.language`）。

---

## 6. 存档格式：`.krecorder` / `.html` / `.json`（★ 强烈建议抄）

**这是 KR 的原生存档格式，读写双向齐全**，实现在 `panel/js/UI/services/helper-service/parser.js`（144 行）。

### 6.1 写（marshall）

`parser.js:92-131`
```js
function marshallCommand(command) {
    let targetListHTML = command.targets.map(target => `<option>${target}</option>`).join('');
    return `<tr><td>${command.name}</td><td>${command.defaultTarget}<datalist>${targetListHTML}</datalist></td><td>${command.value}</td></tr>`
}

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

### 6.2 格式设计的精妙之处

KR 在 Selenium IDE 的三列表格基础上加了**两个私有字段**：

| 扩展点 | 承载内容 | 向后兼容性 |
|---|---|---|
| `<datalist><option>` | **候选定位器数组**（self-healing 用） | Selenium IDE 旧解析器会忽略 `<datalist>`，只读到裸文本的 `defaultTarget` |
| `data-tags` | 用例标签 | HTML5 data-* 属性，旧解析器忽略 |

**一个存档文件长这样**：
```html
<tr>
  <td>click</td>
  <td>xpath=//button[@id='login']
      <datalist>
        <option>xpath=//button[@id='login']</option>
        <option>css=#login</option>
        <option>id=login</option>
        <option>xpath:neighbor=//label[text()='用户名']/following::button[1]</option>
      </datalist>
  </td>
  <td></td>
</tr>
```

> 💡 **这是整个工程里性价比最高的设计**：60 行代码，既保持了与 Selenium IDE 二十年生态的双向兼容，又无损承载了自愈所需的候选定位器数组和标签。**直接抄。**

### 6.3 读（unmarshall）

`parser.js:67-84`
```js
const unmarshall = (suiteName, suiteHTLMString) => {
    if (!suiteHTLMString) { throw "Incorrect format"; }
    try {
        let testSuite = new TestSuite(suiteName);
        const doc = new DOMParser().parseFromString(suiteHTLMString, "text/html");
        const testCaseElements = doc.getElementsByTagName("table");
        for (const testCaseElement of testCaseElements) {
            const testCase = parseTestCase(testCaseElement);
            testSuite.testCases.push(testCase);
        }
        return testSuite;
    } catch (e) { throw "Incorrect format"; }
}
```

`parser.js:39-59`
```js
function parseTestCase(testCaseElement) {
    const testCasetd = testCaseElement.querySelector("thead>tr>td");
    const testCaseTitle = testCasetd.innerHTML;
    let testCaseTags=[];
    if(testCasetd.dataset.tags){
        testCaseTags = testCasetd.dataset.tags.indexOf(',') > -1
            ? testCasetd.dataset.tags.split(',') : [testCasetd.dataset.tags];
    }
    const testCase = new TestCase();
    testCase.name = testCaseTitle;
    testCase.tags = testCaseTags.filter(e => e !== "");
    const commandElements = testCaseElement.querySelectorAll("tbody tr");
    for (const commandElement of commandElements) {
        const commandPartElements = commandElement.querySelectorAll("td");
        const commandName  = parsePredefinedEntity(commandPartElements[0].innerHTML);
        const commandValue = parsePredefinedEntity(commandPartElements[2].innerHTML);
        const { defaultTarget: commandDefaultTarget, targetList: commandTargetList }
              = parseTarget(commandPartElements[1]);
        const command = new TestCommand(commandName, commandDefaultTarget, commandTargetList, commandValue);
        testCase.commands.push(command);
    }
    return testCase;
}
```

`parser.js:25-31`
```js
function parseTarget(targetElement) {
    const commandDefaultTarget = parsePredefinedEntity(targetElement.childNodes[0].data ?? "");
    const commandTargetList = [...targetElement.querySelectorAll("option")].map(element => {
        return parsePredefinedEntity(element.innerHTML);
    });
    return { defaultTarget: commandDefaultTarget, targetList: commandTargetList }
}
```

> ⚠️ `targetElement.childNodes[0].data` —— 靠"第一个子节点必是文本节点"取默认定位器。脆但有效；复刻时建议改成显式的 `<span class="default-target">`。

实体反转义表（`&amp; &quot; &lt; &gt;` 四个）：`parser.js:5-18`
套件名从 `<title>` 抠：`parser.js:138-142`

**配套 IO**：
| 文件 | 作用 |
|---|---|
| `panel/js/UI/services/html-service/download-suite.js` | `browser.downloads.download`，扩展名 `.krecorder` / `.json` |
| `panel/js/UI/services/html-service/load-html-file.js` | 解析 `.htm/.html/.krecorder/.json` |
| `panel/js/UI/services/html-service/read-suite-from-string.js` | 字符串直读 |

---

## 7. `.side` 导入（Selenium IDE 3.x JSON）

**只读不写** —— 未找到 `.side` 导出路径。

入口（`accept=".side"`）：`panel/index.html:143` 的隐藏 `<input id="import-selenium-hidden">`

`panel/js/UI/controllers/other-listeners/import-selenium.js:36-48`
```js
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

`import-selenium.js:16-27`
```js
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

命令转换在 `panel/js/UI/services/selenium-service/selenium-ide-parser.js` 的 `parseToRecorderTestSuites`：
1. 深拷贝
2. `modifyByAddingOrphanTestsToDefaultSuite` —— 把游离 test 归入默认 suite
3. `parseToRecorderCommands` —— 逐条转换 `open/assert*/verify*/if/while/executeScript/waitFor*/selectWindow`
4. 剔除 `INCOMPATIBLE_COMMANDS`

> 💡 **好设计**：导入时用"不兼容命令弹窗确认"（`displayWarningIncompatibleCommands`）而不是静默丢弃。用户知道自己丢了什么。

---

## 8. 复刻要点总结

| # | 要点 | 理由 |
|---|---|---|
| 1 | **只抄新式 formatter 契约** `(name, commands) => {content, extension, mimetype}` | 纯函数、零全局污染、可单测、可并行加载。旧式的"全局函数层叠 + 动态注入 + 用完恢复"是必须抛弃的技术债 |
| 2 | **模板引擎别用 `String.replace` 链** | 前缀吞噬风险。改用一次性正则回调或 tagged template |
| 3 | **`unsupportedCommands` 改成返回值字段** | KR 写 `window.unsupportedCommands` 全局，方向对但载体错。改 `{content, extension, mimetype, unsupported: []}` |
| 4 | **存档格式抄"HTML 表格 + datalist + data-tags"** | 60 行代码换来 Selenium IDE 生态兼容 + 候选定位器无损存储 |
| 5 | **`.side` 只导入不导出是合理取舍** | Selenium IDE 已停更 |
| 6 | **外部扩展导出协议可整块删** | 不做插件生态就删掉 `externally_connectable` + `onMessageExternal` |
| 7 | **`iedoc-core.xml` 与旧式体系同生共死** | 删旧式体系时一并删（但注意 Reference 标签页依赖它） |
| 8 | **每个 formatter 重复一份 50+ 项 `unsupportedCommands`** | 抽成共享常量 |

---

## 9. 最小可用复刻：一个 60 行的导出模块

```js
// formatters/registry.js —— 注册表
export const formatters = new Map();
export function registerFormatter(id, meta, fn) {
  formatters.set(id, { id, ...meta, format: fn });
}

// formatters/playwright.js —— 一个具体 formatter
import { registerFormatter } from './registry.js';

const TEMPLATES = {
  open:        ({ target })        => `await page.goto(${q(target)});`,
  click:       ({ locator })       => `await page.locator(${q(locator)}).click();`,
  type:        ({ locator, value })=> `await page.locator(${q(locator)}).fill(${q(value)});`,
  select:      ({ locator, value })=> `await page.locator(${q(locator)}).selectOption(${q(value)});`,
  assertText:  ({ locator, value })=> `await expect(page.locator(${q(locator)})).toHaveText(${q(value)});`,
  pause:       ({ value })         => `await page.waitForTimeout(${Number(value) || 1000});`,
};

const q = s => JSON.stringify(String(s ?? ''));

// 把 "xpath=//div" / "css=#id" / "id=foo" 统一成 Playwright 选择器
function toSelector(target) {
  const i = target.indexOf('=');
  if (i < 0) return target;
  const type = target.slice(0, i), body = target.slice(i + 1);
  switch (type) {
    case 'id':   return `#${body}`;
    case 'name': return `[name="${body}"]`;
    case 'css':  return body;
    case 'link': return `text=${body}`;
    case 'xpath':
    default:     return body.startsWith('//') ? `xpath=${body}` : body;
  }
}

registerFormatter('playwright', { name: 'Playwright (JS)', extension: 'spec.js', mimetype: 'text/javascript' },
  (name, commands) => {
    const unsupported = [];
    const body = commands.map(c => {
      const tpl = TEMPLATES[c.command];
      if (!tpl) { unsupported.push(c.command); return `  // TODO unsupported: ${c.command} | ${c.target} | ${c.value}`; }
      return '  ' + tpl({ target: c.target, locator: toSelector(c.target), value: c.value });
    }).join('\n');

    return {
      content: `import { test, expect } from '@playwright/test';\n\n`
             + `test(${q(name)}, async ({ page }) => {\n${body}\n});\n`,
      extension: 'spec.js',
      mimetype: 'text/javascript',
      unsupported: [...new Set(unsupported)],
    };
  });
```

**加一种新语言 = 新增一个文件 + 一张 TEMPLATES 表。** 这就是新式契约的价值。
