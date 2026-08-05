# PRD-06 · 代码导出（Formatter）+ 本地存档格式（产品需求文档）

> 产品视角，给「个人录制回放插件」的**导出**与**存档**两件事定范围。所有功能点均有源码依据（见 `实现位置` 列）。
> 优先级约定：P0=必备，P1=重要，P2=可选/不做。
> 核心判断：**旧式三层层叠 formatter 体系整体判为 P2/不做，只采用新式纯函数契约（P0）；`.krecorder` 存档格式原样保留（P0）。**

---

## 1. 背景与目标

**背景**：录制回放工具的价值有一半在「录完之后」——脚本得能存下来，也得能转成真代码跑进 CI。原 Katalon Recorder 在这两件事上给出了质量两极的答案：

- **导出**：两套体系并存。旧式继承自 Selenium IDE，靠「全局函数 + 动态 `<script>` 注入 + 后加载覆盖先加载」实现多语言，`java-wd-testng` 要按序叠六个文件才成型（`kar-generateScript.js:99-110`）；更糟的是它覆盖了回放引擎共用的全局 `formatCommand`，导出完必须再注入一次原文件把函数「换回来」（`kar-generateScript.js:244-249`）。新式则只是一个纯函数：`(name, commands) => {content, extension, mimetype}`（`kar-generateScript.js:229-235`）。
- **存档**：`.krecorder` 只有 144 行实现（`panel/js/UI/services/helper-service/parser.js`），却同时做到「人可读 + 机器可解析 + 与 Selenium IDE 生态兼容」，并用 `<datalist>` 与 `data-tags` 两个「旧解析器会自动忽略」的扩展点无损承载了自愈候选定位器与标签。

**目标**：① 导出侧只保留新式契约 + 显式注册表，做到「加一种语言 = 新增 1 个文件 + 1 张模板表」；② 存档侧原样复刻 `.krecorder`，修掉三处已知缺陷；③ 全程纯本地，无网络请求。

**成功标准**：
- 新增一种导出语言 ≤ 1 个文件 + 注册一行，**零全局变量**，可脱离浏览器单测。
- 命令数组 → 存档 → 读回，`name / defaultTarget / targets / value / tags` **逐条相等**（往返等价）。
- 未支持的命令降级为注释，而不是让整次导出失败。
- 存档用 Chrome 直接打开是一张可读三列表格；用 Selenium IDE 打开能读到 `defaultTarget`。

---

## 2. 名词表

| 名词 | 含义 |
|---|---|
| Formatter | 把命令数组翻译成某种目标语言源码的模块 |
| 新式 formatter | 纯函数 `(name, commands) => {content, extension, mimetype}`（`kar-generateScript.js:229-235`） |
| 旧式 formatter | Selenium IDE 遗产：全局 `format()/formatCommand()/formatHeader()/formatFooter()` 层叠覆盖（`formatCommandOnlyAdapter.js:34-52`） |
| 注册表 | id → formatter 映射；KR 现为裸全局对象 `window.newFormatters = {}`（`panel/js/UI/index.js:18`） |
| 模板表 | 命令名 → 代码字符串模板的字典，如 `seleneseCommands`（`newformatters/webdriver.js:111-157`） |
| unsupportedCommands | formatter 声明的不支持命令清单；KR 挂在全局 `window` 上（`newformatters/sample.js` 内） |
| marshall | 内存对象 → 存档字符串（`parser.js:92-131`） |
| unmarshall | 存档字符串 → 内存对象（`parser.js:67-84`） |
| defaultTarget | 命令首选定位器；存档时是 `<td>` 的第一个文本节点（`parser.js:26`） |
| datalist 候选 | `<td>` 内 `<datalist><option>` 承载的候选定位器数组（`parser.js:93`） |
| data-tags | 用例标签，挂在 `<thead>` 的 `<td>` 上（写 `parser.js:106`，读 `parser.js:43-45`） |
| `.krecorder` | KR 原生存档扩展名，内容是 XHTML（`download-suite.js:41`） |
| `.side` | Selenium IDE 3.x 的 JSON 工程文件，KR **只导入不导出**（`panel/index.html:143`） |
| mimetype / extension | formatter 返回字段。extension 决定另存后缀（`kar-generateScript.js:276`）；mimetype 实际只喂给 CodeMirror 当高亮 mode（`:313`），**不参与下载** |

---

## 3. 用户故事

- **US-1（录制者）**：录完一段脚本，我要一键存成本地文件，下次原样读回，包括自愈候选定位器。→ FR-11/FR-12/FR-14/FR-15
- **US-2（工程师）**：我要把录制结果导出成 Playwright 或 pytest 代码，直接放进项目跑。→ FR-1/FR-2/FR-6/FR-8
- **US-3（扩展者）**：我要能自己加一种导出语言，不用读懂整个插件。→ FR-2/FR-3/FR-4
- **US-4（排错者）**：遇到不支持的命令，我要看到明确标记，而不是静默丢失或整体失败。→ FR-5
- **US-5（协作者）**：存档发给用 Selenium IDE 的同事，他至少能读到主定位器；反过来我也要能导入他的 `.side`。→ FR-12/FR-13/FR-19/FR-20
- **US-6（裁剪者）**：我不要 19 种语言和整项目 ZIP，只要 2-3 种能跑的。→ §10

---

## 4. 功能需求（FR）

| 编号 | 优先级 | 需求 | 实现位置（源码） |
|---|---|---|---|
| FR-1 | P0 | 单用例「导出为脚本」：取当前用例命令数组 → formatter → 预览对话框 | `kar-generateScript.js:4-11` handleGenerateToScript、`:13-23` getCommandsToGenerateScripts、`:181-251` generateScripts |
| FR-2 | P0 | 采用新式 formatter 纯函数契约 `(name, commands) => {content, extension, mimetype}` | `kar-generateScript.js:229-235`；最小样例 `newformatters/sample.js:2,62` |
| FR-3 | P0 | 显式 formatter 注册表（id → {显示名, extension, mimetype, format}） | KR 现状是裸全局对象 `panel/js/UI/index.js:18`；各 formatter 自注册于 `newformatters/*.js:2`（`puppeteer.js:225,287,349` 一文件注册 3 个 id） |
| FR-4 | P0 | 格式下拉列表由注册表渲染，不得硬编码 | KR 硬编码 8 个 `<option>`：`panel/index.html:779-805`（**这是要改掉的现状**） |
| FR-5 | P0 | 未支持命令降级为注释并计入 unsupported 清单，不中断导出 | `newformatters/webdriver.js:172-181`（`:178` 输出 `// WARNING: unsupported command ...`） |
| FR-6 | P0 | 命令 → 代码由「命令名 → 模板」字典驱动 | `newformatters/webdriver.js:111-157`（25 条模板）、`:158` header、`:163` footer、`:165` formatter |
| FR-7 | P0 | 定位器前缀（`id=/css=/xpath=/name=/link=`）转成目标语言选择器 | `newformatters/webdriver.js:69-89` locatorType 表、`:214-222` locator() |
| FR-8 | P0 | 预览区支持复制到剪贴板与另存为文件 | `kar-generateScript.js:266-271` copyToClipboard、`:273-280` saveToFile、`:283-290` saveAsFileOfTestCase |
| FR-9 | P1 | 记住上次选择的导出格式 | `kar-generateScript.js:255-264`（写 `browser.storage.local.language`） |
| FR-10 | P1 | 预览区语法高亮，mode 由 formatter 的 mimetype 决定 | `kar-generateScript.js:307-313`（`:313` `mode = window.options.mimetype`） |
| FR-11 | P0 | 存档 marshall：TestSuite → XHTML（一个用例一张 `<table>`） | `parser.js:92-95` 命令、`:102-111` 用例、`:118-131` 套件 |
| FR-12 | P0 | 候选定位器以 `<datalist><option>` 随命令存档 | `parser.js:93-94` |
| FR-13 | P0 | 用例标签以 `data-tags` 存档 | 写 `parser.js:106`；读 `parser.js:43-45`（含 `,` 则 split） |
| FR-14 | P0 | 读档 unmarshall：XHTML → TestSuite | `parser.js:67-84`（DOMParser + `getElementsByTagName("table")`）、`:39-59`、`:25-31` |
| FR-15 | P0 | 存档下载为 `<套件名>.krecorder` | `download-suite.js:41-50`（`browser.downloads.download`，`saveAs:true`） |
| FR-16 | P0 | 读入 `.krecorder` / `.html` / `.json` | `load-html-file.js:10` 校验、`:25-32` 分支解析 |
| FR-17 | P1 | 读档时反转义 `&amp; &quot; &lt; &gt;` | `parser.js:5-18`；⚠️ **写侧 `parser.js:92-95` 未做对称转义，本插件必须补上** |
| FR-18 | P1 | 套件名从 `<title>` 解析，缺失时用文件名兜底 | `parser.js:138-142`；兜底 `load-html-file.js:19-23` |
| FR-19 | P2 | 导入 Selenium IDE `.side`（只读） | `panel/index.html:143`、`import-selenium.js:36-48`、`selenium-ide-parser.js:21-26`、`mapping-selenium-test-bbject-to-kr-test-object.js:13-25` |
| FR-20 | P2 | 导入时列出不兼容命令并弹窗确认，不静默丢弃 | `command-converter-service.js:2-32`、`import-selenium.js:38-41` |
| FR-21 | **P2 / 不做** | 旧式三层层叠 formatter 体系（11 种旧语言） | `kar-generateScript.js:25-143`、`:150-171`、`formatCommandOnlyAdapter.js:34-52`、`selenium-ide/webdriver.js:415-450`、`format/java/webdriver-testng.js:270-401` |
| FR-22 | **P2 / 不做** | 整项目导出 ZIP | `KS-export-dialog.js:6`、`:20-23`、`panel/index.html:73-74`（jszip + FileSaver） |
| FR-23 | **P2 / 不做** | 委托外部扩展导出（`katalon_recorder_export` 协议） | `kar-generateScript.js:194-228` |

### 4.1 为什么旧式 formatter 判为「不做」——三条硬理由

1. **全局函数污染，且必须靠副作用「还原」**。旧式定义的全局 `formatCommand` 与回放引擎的 `js/background/formatCommand.js` 同名同域；导出一次就把回放用的函数覆盖了，所以 `kar-generateScript.js:244-249` 必须在导出后再注入一次原文件换回来——**一个导出动作会破坏回放能力**。同类坑还有 `testClassName`：`saveToFile()`（`:277`）用它生成文件名，而定义散落在 `newformatters/dynatrace.js:1`、`format/java/webdriver-testng.js:17`、`format/python/python2-wd.js:5` 等处，**当前生效哪一个取决于最后加载了哪个脚本**。
2. **层叠覆盖不可调试**。`java-wd-testng` 需按序加载 6 个文件（`kar-generateScript.js:99-110`），最终行为是六层覆盖的叠加结果，想知道走的哪一版只能靠加载顺序心算。
3. **动态 `<script>` 注入 + 轮询等待**。`kar-generateScript.js:150-171` 建 `<script>` 塞进 `document.head`，靠 `async=false` 保序，再用 `setInterval` 每 100ms 轮询 onload 计数。MV3 下 CSP 更严、时序更不可控，且完全无法单测。

对照新式契约：纯函数、入参出参都是普通对象、启动即静态引入（`panel/index.html:1049-1073`）、零全局副作用、可在 Node 里直接断言。**结论：只抄新式那代。**

### 4.2 为什么 `.krecorder` 判为「必留」

144 行代码同时满足三个通常互斥的目标：**人可读**（就是一张 `<table>`，`parser.js:104-110`）、**机器可解析**（`new DOMParser().parseFromString(...)` 一行，`parser.js:73`）、**生态兼容**（`<datalist>` 与 `data-tags` 都是旧解析器会忽略的扩展点，Selenium IDE 读到的仍是标准三列表格，`parser.js:93`、`:106`）。代价只有「HTML 比 JSON 冗长」一条，相对于候选定位器无损存储 + 生态兼容可以忽略。**直接抄，只改 §8 列出的三处缺陷。**

---

## 5. 非功能需求（NFR）

| 编号 | 需求 |
|---|---|
| NFR-1 | formatter 必须是**纯函数**：不读写全局、不碰 DOM、不依赖加载顺序，可在 Node 单测（KR 新式已基本满足，但 `window.unsupportedCommands` 破了纯度——改为返回值字段） |
| NFR-2 | 所有 formatter **启动时静态引入**，禁止运行时动态注入 `<script>`（反面教材 `kar-generateScript.js:150-171`） |
| NFR-3 | 存档读写必须**往返等价**：`unmarshall(marshall(s))` 与 `s` 在五个字段上逐条相等（KR 现状不满足，见 §8 E-1） |
| NFR-4 | 统一 UTF-8。存档头有 `<meta charset=UTF-8>`（`parser.js:124`），但下载 Blob 用 `type:'text/*'`（`make-text-file.js:5`）**未声明 charset**，须补 |
| NFR-5 | 1000 条命令导出应在 200ms 内完成（经验值，**未在源码中找到基准测试**）；避免循环内重复编译正则 |
| NFR-6 | 文件名须过滤非法字符（Windows 下 `\ / : * ? " < > \|`）；KR 直接拼套件名（`download-suite.js:41`），过滤逻辑**未在源码中找到** |
| NFR-7 | 导出与存档全程本地：不发起任何网络请求、不上传脚本内容 |
| NFR-8 | 不得每个 formatter 复制一份 50+ 条 `unsupportedCommands`（KR 现状如 `newformatters/dynatrace.js:6` 起），抽为共享常量 |

---

## 6. 数据结构（TypeScript）

```ts
// ── 单条命令（panel/js/UI/models/test-model/test-command.js:13-20）
export interface TestCommand {
  name: string;            // 命令名，如 click / type / open
  defaultTarget: string;   // 首选定位器，如 "xpath=//button[@id='login']"
  targets: string[];       // 候选定位器数组（自愈弹药库，存档进 <datalist>）
  value: string;           // 第三列参数
  status?: unknown;        // 运行态：执行结果（:18）
  state?: unknown;         // 运行态：UI 状态（:19）
}

// ── 用例（test-case.js:14-19）
export interface TestCase {
  id: string;              // UUID，generateUUID() 生成
  name: string; commands: TestCommand[];
  tags: string[];          // 存档进 data-tags
}

// ── 套件（test-suite.js:14-22）
export interface TestSuite {
  id: string;
  name: string;            // 存档进 <title>
  status: string;          // 'dynamic' 时改存 JSON（download-suite.js:20-30）
  testCases: TestCase[]; query: string;   // query 仅 dynamic 套件使用
}

// ── ★ 新式 formatter 契约（kar-generateScript.js:229-235）
export type FormatterResult = {
  content: string;         // 生成的代码全文
  extension: string;       // 文件后缀，如 'spec.js'（saveToFile 用，kar-generateScript.js:276）
  mimetype: string;        // KR 实际只用作 CodeMirror mode（kar-generateScript.js:313）
  unsupported?: string[];  // ★ 本插件新增：替代 KR 的 window.unsupportedCommands 全局
};
export type Formatter = (name: string, commands: TestCommand[]) => FormatterResult;

// ── ★ 注册表条目（KR 现状仅 window.newFormatters = {}，panel/js/UI/index.js:18）
export interface FormatterEntry {
  id: string; displayName: string; extension: string; mimetype: string; format: Formatter;
}
export type FormatterRegistry = Map<string, FormatterEntry>;
```

### 6.1 `.krecorder` 的 HTML 结构（marshall 产物，`parser.js:92-131`）

```
<?xml version="1.0" encoding="UTF-8"?>                       ← parser.js:120
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" ...>
<html><head>
  <meta content="text/html; charset=UTF-8" ...>              ← :124
  <title>{TestSuite.name}</title>                            ← 写 :125 / 读 :138-142
</head><body>
  <table cellpadding="1" cellspacing="1" border="1">         ← 一个用例一张表，:104
    <thead><tr><td rowspan="1" colspan="3"
            data-tags="{tags.toString()}">{name}</td></tr></thead>   ← :106
    <tbody>
      <tr>                                                   ← 一条命令一行，:94
        <td>{command.name}</td>
        <td>{command.defaultTarget}                          ← 必须是第一个文本节点！:26
            <datalist><option>{targets[i]}</option>…</datalist>   ← 候选定位器，:93
        </td>
        <td>{command.value}</td>
      </tr>
    </tbody>
  </table>  … 更多 <table> …
</body></html>
```

### 6.2 `.side` JSON 结构（导入侧，只读）

```ts
// 依据 import-selenium.js:16-27 与 mapping-selenium-test-bbject-to-kr-test-object.js:13-25
interface SideProject {
  id: string; name: string; url?: string;
  tests: SideTest[];                                    // import-selenium.js:18
  suites: { id: string; name: string; tests: string[] /* testID 引用 */ }[];  // :17,19-21
  urls?: string[]; plugins?: unknown[];
  // 注：Selenium IDE 规范含 version 字段，但 KR **未做任何版本校验**
  //     （selenium-service/ 与 import-selenium.js 中未找到 .version 引用）
}
interface SideTest {
  id: string; name: string;
  commands: { id: string; comment?: string; command: string;
              target: string;              // → TestCommand.defaultTarget
              targets: [string, string][]; // [[定位器, 类型], ...]
              value: string; }[];
}
// 映射规则（mapping-…js:16-20）：targets = command.targets.map(t => t[0])；
//                              若为空则塞入 command.target 兜底（:18）
```

---

## 7. 流程图

### 7.1 单用例导出链路（新式 formatter）

```
用户点「Export Test Case as Script」
   │
   ▼ handleGenerateToScript()                  ← kar-generateScript.js:4-11（未选用例则 alert :9）
   ▼ 读下拉选中的 formatter id                  ← :26
   ▼ getCommandsToGenerateScripts()            ← :13-23（从 #records-grid 逐行取 name/target/value）
   ▼ registry.get(id).format(caseName, cmds)   ← 契约 :229-235（KR: newFormatters[id](name, commands)）
   │     ├─ 命令在模板表 → 替换占位符          ← newformatters/webdriver.js:111-157, :195-206
   │     └─ 不在        → 追加 // WARNING 注释 ← newformatters/webdriver.js:178
   ▼ {content, extension, mimetype, unsupported}
   │
   ├─→ displayOnCodeMirror(mode = mimetype)    ← :307-313（预览 + 高亮）
   ├─→ copyToClipboard()                       ← :266-271
   └─→ saveToFile()                            ← :273-280
          fileName = 用例名 + '.' + extension   ← :276-277
          makeTextFile(content) → Blob URL      ← make-text-file.js:3-14（type:'text/*'）
          browser.downloads.download            ← :285-289
```

### 7.2 存档 marshall 链路（内存 → `.krecorder`）

```
用户点「保存套件」
   ▼ downloadSuite(suiteElement)               ← download-suite.js:14
   ├─ status === 'dynamic' ? ─是─→ JSON.stringify + ".json"   ← :20-30
   │                          否
   ▼ marshall(testSuite)                       ← parser.js:118-131
   │   ├─ 每个 TestCase → marshallTestCase     ← :102-111（<thead> 写 name + data-tags :106）
   │   └─ 每条 Command → marshallCommand       ← :92-95
   │         <td>name</td>
   │         <td>defaultTarget<datalist><option>×N</datalist></td>   ← :93-94
   │         <td>value</td>
   │         ⚠️ KR 此处未做 HTML 实体转义（缺陷 E-1）
   ▼ 拼 XHTML 外壳（xml 声明 + DOCTYPE + <title>）  ← :120-130
   ▼ makeTextFile(html) → Blob URL             ← make-text-file.js:3-14
   ▼ browser.downloads.download({saveAs:true}) ← download-suite.js:45-50
        fileName = suite.name + ".krecorder"   ← :41
   ▼ 下载完成回调：用实际落盘文件名回写套件名    ← :52-69
```

### 7.3 读档 unmarshall 链路（`.krecorder` → 内存）

```
用户选文件
   ▼ loadHTMLFile(file)                        ← load-html-file.js:8
   │   扩展名校验 .krecorder/.html/application/json ← :10（不匹配 → reject "Wrong file format"）
   ▼ FileReader.readAsText                     ← :13
   ├─ .json → JSON.parse                       ← :29-32
   └─ .htm/.krecorder ─→ unmarshall(name, html)  ← :25 → parser.js:67-84
         │   空串 → throw "Incorrect format"     ← :68-70
         ▼ new DOMParser().parseFromString(s,"text/html") ← :73
         ▼ 遍历 getElementsByTagName("table")   ← :74-78
         ▼ parseTestCase(tableEl)               ← :39-59
              thead>tr>td.innerHTML → name      ← :40-41
              dataset.tags → tags（含逗号则 split） ← :43-45
              遍历 tbody tr（:49）：td[0]→name（反转义 :52）、td[2]→value（:53）
                 td[1] → parseTarget()          ← :54
                     ├─ childNodes[0].data → defaultTarget   ← :26 ⚠️脆弱
                     └─ querySelectorAll("option") → targets ← :27-29
                 new TestCommand(...)           ← :55
         ▼ TestSuite{testCases:[…]}；任何异常 → catch → throw "Incorrect format" ← :80-82
   ▼ 渲染到命令表格
```

---

## 8. 边界与异常

| 编号 | 场景 | KR 现状 | 本插件应做 | 依据 |
|---|---|---|---|---|
| E-1 | target/value 含 `<` `&` `"` `>` | **写不转义、读反转义，往返不等价**；含 `<` 的 target 会被 DOMParser 当标签吃掉 | marshall 侧补对称 `escapeEntity` | 写 `parser.js:92-95` vs 读 `:5-18` |
| E-2 | target 为空且 `<td>` 无 `<datalist>`（手工编辑 / Selenium IDE 原生文件） | `childNodes[0]` 为 undefined → 取 `.data` 抛 TypeError → 被 catch 吞掉 → **整文件报 "Incorrect format"** | 改 `td.firstChild?.nodeType===3 ? … : ''`，或用显式 `<span class="default-target">` | `parser.js:26` + `:80-82` |
| E-3 | value 含换行 | HTML 中合法保留，但导出时会撑破单行模板 | 导出侧对 value 统一 `JSON.stringify` 转义 | 模板直接插值 `newformatters/webdriver.js:195-206` |
| E-4 | target 含单/双引号 | 各 formatter 自行 replace，规则不一致（css 把 `"`→`'`，xpath 转义 `'`） | 统一 `q = s => JSON.stringify(String(s ?? ''))` | `newformatters/webdriver.js:69-89`、`:190-192` |
| E-5 | 命令名不在模板表中 | 输出 `// WARNING: unsupported command X`，导出继续 | 保留该策略，命令名收进返回值 `unsupported[]` | `newformatters/webdriver.js:174-180` |
| E-6 | 候选定位器数组为空 | 仍写空 `<datalist></datalist>`；读回 `targets=[]` | 保持，回放侧自愈自然降级 | `parser.js:93`、`:27-29` |
| E-7 | 定位器无 `=` 前缀或前缀未知 | `locator()` 兜底原样返回并把 `'`→`"` | 保留兜底，但记 warning | `newformatters/webdriver.js:214-221` |
| E-8 | 存档缺 `<title>` | `pattern.exec(...)[1]` 对 null 取下标 → TypeError | 用文件名兜底（已有该逻辑） | `parser.js:138-142`；兜底 `load-html-file.js:19-23` |
| E-9 | `.side` 版本不兼容 | **无版本校验**，只按字段名硬解，缺字段即静默出错 | 导入前校验 version 与必需字段，缺失明确报错 | `import-selenium.js:36-48`；`.version` 引用**未在源码中找到** |
| E-10 | `.side` 含不兼容命令 | 弹窗列出并让用户确认后再导入（**好设计，照抄**） | 保留 | `command-converter-service.js:22-32`、`import-selenium.js:38-41` |
| E-11 | 套件名含 `\ / : * ? " < > \|` | 直接拼进 `filename` 交给 downloads，可能失败或被改名 | 落盘前替换非法字符 | `download-suite.js:41`；过滤**未在源码中找到** |
| E-12 | 中文内容乱码 | 下载 Blob 声明 `type:'text/*'`，**未带 `;charset=utf-8`** | 改 `{type:'text/html;charset=utf-8'}` | `make-text-file.js:3-6` |
| E-13 | mimetype 与实际下载类型不符 | mimetype **完全不参与下载**，只喂 CodeMirror 当 mode | 要么真正用于 Blob type，要么契约里改名 `editorMode` | `kar-generateScript.js:313` vs `make-text-file.js:5` |
| E-14 | 文件名依赖全局 `testClassName` | 由「最后加载的 formatter 文件」定义，行为不可预测 | 文件名生成收进注册表条目 | `kar-generateScript.js:277`；定义散落 `newformatters/dynatrace.js:1`、`format/java/webdriver-testng.js:17`、`format/python/python2-wd.js:5` |
| E-15 | 大用例（1000+ 命令）导出 | 每命令 6 次链式 `String.replace`，且 `_VALUE_STR_` 必须先于 `_VALUE_` 才不出错 | 改一次性 `replace(/_([A-Z_]+)_/g, (m,k)=>map[k])` | `newformatters/webdriver.js:198-206`（`:203` 在 `:204` 前，顺序对但极脆弱） |
| E-16 | 导出一次后立即回放 | 旧式路径覆盖全局 `formatCommand`，需重注入才能恢复 | **不采用旧式体系即天然规避** | `kar-generateScript.js:244-249` |

---

## 9. 验收用例

| ID | 用例 | 预期 | 对应 FR |
|---|---|---|---|
| AC-1 | 录 5 条命令，选 Playwright 导出 | 预览区出现完整 spec，含 `test('用例名', async ({page}) => {…})` | FR-1/FR-2/FR-6 |
| AC-2 | 脚本含自定义命令 `myFooBar` | 该行降级为注释，其余正常，`unsupported` 含 `myFooBar` | FR-5 |
| AC-3 | 新增一个 pytest formatter | 只新建 1 文件 + 注册一行，下拉框自动多一项，不改任何既有文件 | FR-3/FR-4 |
| AC-4 | 点「另存为」 | 文件名 = `用例名.spec.js`，内容与预览一致 | FR-8 |
| AC-5 | 切换格式后重开插件 | 下拉框停留在上次选择 | FR-9 |
| AC-6 | 保存含 3 条命令、每条 4 个候选定位器的套件 | `.krecorder` 中可见 `<datalist>` 内 4 个 `<option>` | FR-11/FR-12 |
| AC-7 | 把 AC-6 文件读回 | 3 条命令四字段与保存前逐条相等（往返等价） | FR-14/NFR-3 |
| AC-8 | 用例带 2 个标签 | 存档 `<td data-tags="a,b">`；读回 `tags=['a','b']` | FR-13 |
| AC-9 | 用 Chrome 直接打开 `.krecorder` | 渲染为可读三列表格 | FR-11 |
| AC-10 | target 写成 `xpath=//a[text()='<b>粗体</b>']` | 存档读回完全一致，不丢标签、不报 "Incorrect format" | FR-17/E-1 |
| AC-11 | value 为中文「登录成功」 | 存档、读回、导出三处均不乱码 | NFR-4/E-12 |
| AC-12 | 套件名写成 `登录/注册` | 文件名中 `/` 被安全替换，下载成功 | NFR-6/E-11 |
| AC-13 | 导入含不兼容命令的 `.side` | 弹窗列出不兼容命令，确认后其余正常导入 | FR-19/FR-20 |
| AC-14 | 导入 `.side` 后检查命令 | `targets` 取自 `command.targets[i][0]`；为空时用 `command.target` 兜底 | FR-19 |
| AC-15 | 导出 1000 条命令的用例 | 无卡顿、无栈溢出，输出行数 = 1000（阈值 200ms，未在源码中找到基准） | NFR-5/E-15 |
| AC-16 | 导出后立即回放；并在 Node 里对同一 formatter 做单测 | 回放正常无「函数被覆盖」错误；无需浏览器即可 `format('t', cmds)` 并断言 content | E-16/NFR-1 |

---

## 10. Out of Scope（不在本次范围）

- **19 种语言全支持不做**。旧式体系覆盖的 Java(TestNG/JUnit/RC)、C#(MSTest/NUnit)、Python2、Ruby(RSpec)、Robot、XML、Katalon Studio 等 11 种（`KS-export-dialog.js:38-58`）一律不移植。个人插件默认给 2-3 种（建议 Playwright JS + pytest + 原始三列文本），其余交给用户按契约自行添加。
- **Katalon Studio 整项目 ZIP 导出不做**。涉及 5 个项目模板生成器（`KS-export-dialog.js:6`、`:20-23`）+ jszip + FileSaver（`panel/index.html:73-74`），产出的是 Katalon Studio 工程结构，与「纯本地个人插件」无关。
- **云端 TestOps 上传不做**；**`.side` 导出不做**（KR 本身也只导入不导出，未在源码中找到 `.side` 导出路径，Selenium IDE 已停更）。
- **外部扩展导出协议不做**。`katalon_recorder_export` 消息 + `externally_connectable`（`kar-generateScript.js:194-228`）是插件生态设计，整块删除。
- **`iedoc-core.xml` 命令元数据不做**。它是旧式 `command.getDefinition()` 的数据源（`selenium-ide/webdriver.js:415-450` 依赖），随旧式体系一并删除；但注意 Reference 标签页也依赖它（见 TECH-04）。旧式 XUL `configForm`（`format/java/webdriver-testng.js:358-384`）同理，Firefox 遗迹，在 Chrome 完全无效。
- **导出结果的语法校验 / 试运行不做**。生成代码能否运行由用户目标框架决定，插件不负责编译校验。

---

*文档完。功能点均可在 `7.1.0_0` 源码按「实现位置」列核对；标注「未在源码中找到」的四处为确认缺失项，非遗漏。*
