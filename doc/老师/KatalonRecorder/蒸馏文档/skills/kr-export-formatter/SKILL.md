---
name: kr-export-formatter
version: 1.0.0
description: >-
  理解并复刻 Katalon Recorder 7.1.0（MV3）的导出与存档格式：两代 formatter 并存
  （旧式 Selenium IDE 全局函数层叠 vs 新式纯函数 newFormatters[id](name, commands) →
  {content, extension, mimetype}）、三条导出出口（外部扩展 / 新式纯函数 / 旧式需重注入
  formatCommand.js）、window.newFormatters 裸全局注册表与下拉写死、.krecorder 存档 =
  HTML 表格 + <datalist> 候选定位器 + data-tags，以及 marshall/unmarshall 与 .side 仅导入不导出等缺陷。面向想裁剪个人本地录制回放插件的工程师。
type: reverse-engineering
domain: browser-extension / code-export-and-archive
source-version: Katalon Recorder 7.1.0 (Manifest V3)
related-skills:
  - kr-panel-ui
  - kr-locator-selfhealing
tags:
  - katalon-recorder
  - formatter
  - code-export
  - archive
  - krecorder
  - selenium-ide
  - marshall
---

# kr-export-formatter · Katalon Recorder 导出与存档格式

本技能帮助你在**不修改扩展源码**的前提下，逆向吃透 Katalon Recorder 的导出代码生成与
`.krecorder` / `.side` 存档格式，并据此裁剪出自己的纯本地录制回放插件。

## 何时使用

- 用户问「导出代码怎么生成的」「为什么导出后还要重新加载 script」「mimetype 是干嘛的」。
- 用户要复刻：代码导出架构选型、formatter 注册表、定位器候选持久化、`.krecorder` 存档读写。
- 用户在做导出缺陷排查（代码跑不起来、存档丢候选定位器、中文乱码、下载文件名非法），或是 Java 背景
  需要把 formatter / 注册表 / 序列化翻译成熟悉的概念。

## 核心事实（务必先建立的心智模型）

1. **【总钥匙】两代 formatter 并存，复刻只抄新式那代。** `panel/js/katalon/kar-generateScript.js:25-143`
   的 `loadScripts()` 用同一个 `switch` 把「旧式 `scriptNames` 注入」和「新式 `newFormatters[...]`」
   混在一起分发；`kar-generateScript.js:138-139` 是分界：`language` 以 `new-formatter-` 开头才走新式，
   否则落回旧式或外部扩展。`panel/index.html:779-805` 把 9 个 `new-formatter-*` 写死在 `<select>`，
   `panel/index.html:1049-1073` 又把 6 个新 formatter 文件逐一 `<script>` 静态引入。旧式
   （`selenium-ide/formatCommandOnlyAdapter.js:34-52` 的 `format()`）是 Selenium IDE 遗产，
   **全局函数层叠、调试时不知哪个文件覆盖了哪个函数、导出后还必须重新注入 `formatCommand.js`
   还原被覆盖的全局**（`kar-generateScript.js:244-249`）——个人插件一律不抄。

2. **新式契约是纯函数 `newFormatters[id](name, commands) → {content, extension, mimetype}`。**
   调用点 `kar-generateScript.js:229-235`：`var payload = newFormatter(name, commands);` 取
   `payload.extension / payload.mimetype / payload.content`。范本 `newformatters/webdriver.js:2`
   定义、`newformatters/webdriver.js:58-62` 返回三字段。零全局状态、可单测、可平迁到任意语言。

3. **注册表只是 `window.newFormatters = {}` 裸全局对象——要改。**
   `panel/js/UI/index.js:18`。没有模块化、没有去重、`<script>` 顺序决定谁后注册谁覆盖；
   `newformatters/puppeteer.js:225,287,349` 就是往这个全局里挂 `puppeteer / puppeteer_w_comment /
   puppeteer_json` 三个键。复刻应换成模块级 `Map` + 显式注册。

4. **三条导出出口，只有一条值得保留。** `kar-generateScript.js:181-251` 的 `generateScripts()`：
   ①外部扩展分支 `:194-228`（`browser.runtime.sendMessage` 发给别的扩展）；②新式纯函数分支 `:229-235`；
   ③旧式分支 `:236-249`，导出完毕必须 `appendChild` 重注入 `js/background/formatCommand.js`（`:247`）
   还原全局。复刻只留②。

5. **`.krecorder` 存档 = HTML 表格 + `<datalist>` 候选定位器 + `data-tags`。**
   `parser.js:92-131`：`marshallCommand`（`:92-95`）把 `command.targets` 渲染成 `<option>` 塞进
   `<datalist>`，`marshallTestCase`（`:102-111`）用 `<table>` 的 `data-tags` 存标签，`marshall`
   （`:118-131`）包成 XHTML 文档。**定位器自愈的候选列表就靠这个 `<datalist>` 持久化**，且刻意兼容
   Selenium IDE 的 HTML 套件格式。

6. **`.krecorder` 读回 = `unmarshall` 反解析 HTML。** `parser.js:67-84`：`new DOMParser()
   .parseFromString(html, "text/html")` → 遍历 `<table>` → `parseTestCase` 还原；`<datalist><option>`
   被还原成 `command.targets` 候选定位器。注意 `parseTestCase` 假设每个单元格 `childNodes[0]` 是文本。

7. **`.side` 只导入不导出。** `panel/index.html:143` 的文件选择器 `accept=".side"` 仅用于导入
   Selenium IDE 项目；导出通道里没有任何生成 `.side` 的代码。复刻若需 `.side` 互导，要自己补 marshall。

8. **`mimetype` 名不副实——只喂 CodeMirror 高亮，不参与下载。** `kar-generateScript.js:307` 的
   `displayOnCodeMirror` 用 `window.options.mimetype`（`:313`）选 CodeMirror mode；下载走 `makeTextFile`
   （`make-text-file.js:3-14`），其 Blob `type` 固定 `text/*`（`:5`），**无 charset、不区分语言**。
   所以乱码多半不是编码错，而是导出/下载两端都没真正用 mimetype。

9. **下载与文件名存在真实缺陷，复刻要修。** `make-text-file.js:5` Blob `type:'text/*'` 无 charset；
   `download-suite.js`（`panel/js/UI/services/html-service/download-suite.js`）拼文件名未过滤
   `\ / : * ? " < > |` 等非法字符，中文用例名在 Windows 上会下载失败。

10. **转义不对称是导出共病。** `parser.js:92-95` 的 `marshallCommand` 把 `name/target/value` 直接插进
    HTML 字符串，而 `unmarshall` 端靠 `DOMParser` 解析——手工拼接与 DOM 解析不对称，命令值含 `<`、`&`
    时存档会被破坏。复刻应改用 `textContent` / 属性转义，杜绝字符串拼接。

## 取证锚点（修改/复刻时优先读这些文件）

| 主题 | 文件 | 关键行 |
|---|---|---|
| 两代分发总开关 | `panel/js/katalon/kar-generateScript.js` | 25-143 |
| 新式桥接（id 查表） | `panel/js/katalon/kar-generateScript.js` | 138-139 |
| 新式契约调用点 | `panel/js/katalon/kar-generateScript.js` | 229-235 |
| 三出口 | `panel/js/katalon/kar-generateScript.js` | 181-251（194-228 外部 / 229-235 新式 / 236-249 旧式） |
| 旧式需重注入 formatCommand.js | `panel/js/katalon/kar-generateScript.js` | 247 |
| 注册表（裸全局） | `panel/js/UI/index.js` | 18 |
| 下拉写死 | `panel/index.html` | 779-805 |
| 新式静态引入 | `panel/index.html` | 1049-1073 |
| 新式范本注册 | `panel/js/katalon/newformatters/webdriver.js` | 2 |
| 新式范本返回三字段 | `panel/js/katalon/newformatters/webdriver.js` | 58-62 |
| 范本：定位器映射 | `panel/js/katalon/newformatters/webdriver.js` | 69-89 |
| 范本：命令模板映射 | `panel/js/katalon/newformatters/webdriver.js` | 111-157 |
| 范本：模板字符串替换 | `panel/js/katalon/newformatters/webdriver.js` | 195-206 |
| 范本：定位器解析 | `panel/js/katalon/newformatters/webdriver.js` | 214-222 |
| 多 formatter 注册 | `panel/js/katalon/newformatters/puppeteer.js` | 225、287、349 |
| marshall | `panel/js/UI/services/helper-service/parser.js` | 92-131 |
| unmarshall | `panel/js/UI/services/helper-service/parser.js` | 67-84 |
| mimetype 仅高亮 | `panel/js/katalon/kar-generateScript.js` | 307、313 |
| 下载 Blob 无 charset | `panel/js/UI/services/helper-service/make-text-file.js` | 3-14（type 见 5） |
| .side 仅导入 | `panel/index.html` | 143 |
| 旧式骨架（勿抄） | `panel/js/katalon/selenium-ide/formatCommandOnlyAdapter.js` | 34-52 |

## 工作流

1. **先亮总钥匙**：任何回答第一句点明「两代 formatter 并存，复刻只抄新式纯函数那代」，并给出
   `kar-generateScript.js:25-143` + `138-139` 与 `selenium-ide/formatCommandOnlyAdapter.js:34-52`
   的对照。用户若带着「照抄 Selenium IDE 那套」的默认假设，后面全跑偏。
2. **按主题取证**：用上方锚点逐文件读取，所有结论带 `文件路径:行号` + 代码片段。架构判断只认
   `switch` 分支与 `<script>` 引入清单，不靠文件名猜测是「新」还是「旧」。
3. **区分三条出口**：外部扩展（发给别的扩展）/ 新式纯函数（自己算）/ 旧式（算完还要重注入
   `formatCommand.js`）。回答前先判定问题落在哪一条。
4. **Java 类比**（用户是 Java 背景，主动做映射）：
   - 新式 formatter `newFormatters[id](name, commands)` → **`Function<TestCase,String>`**（无状态纯函数，输入输出明确，可单测可缓存）；
   - 旧式层叠（`formatCommandOnlyAdapter.js` → `selenium-ide/webdriver.js` → 语言模板）→ **模板方法模式 + 继承覆盖 + 全局函数污染**（子类靠覆盖父类函数改行为，且这些函数挂在全局，谁后加载谁覆盖，调试时根本不知道当前生效的是哪一份）；
   - `marshall` / `unmarshall`（`parser.js`）→ **JAXB / Jackson 的 `@XmlRootElement` 序列化与反序列化**（对象 ↔ XML 互转）；
   - `window.newFormatters = {}` 注册表 → **JDK `SPI` / `ServiceLoader`**（按 id 发现实现；原版用裸全局 + `<script>` 顺序，等于把 `META-INF/services` 换成了「文件加载先后」，后到覆盖先到）；
   - `.krecorder` 的 HTML 表格 → **既是数据又是视图**，类似 XHTML 时代 **XSLT** 的思路（一份 XML 既能被程序解析、又能直接当页面渲染，候选定位器用 `<datalist>` 内嵌）。
5. **裁剪建议给分层结论**：
   - **必留**：新式纯函数契约、模块级 `Map` 注册表（替代裸全局）、`marshall/unmarshall`、`marshallCommand` 的 `<datalist>` 候选持久化、下拉改为动态从注册表生成。
   - **必改**：裸全局 `window.newFormatters`（`index.js:18`）→ 模块级 `Map` + 显式注册；Blob `type:'text/*'`（`make-text-file.js:5`）→ 真实 `mimetype` + `charset=utf-8`；下载文件名过滤非法字符；`marshallCommand` 字符串拼接 → `textContent`/属性转义。
   - **必删**：旧式三层层叠（`formatCommandOnlyAdapter.js` 整支 + 导出后重注入 `formatCommand.js`）、外部扩展导出分支（`kar-generateScript.js:194-228`）、`.side` 导出（本就不存在）。
6. **给可验证的最小实验**：每个结论配一条可跑命令，例如在 DevTools 控制台打印
   `Object.keys(window.newFormatters)` 看注册了几个、分别来自哪些 `<script>`；或读 `parser.js:92-95`
   后用 `marshallCommand` 生成一个含 `<` 的命令值，验证 `<datalist>` 是否被破。
7. **绝不修改扩展源文件**：只产出文档/提示词/技能，或在用户自有项目里新建文件。

## 配套产物

- 技术文档：`_distill/tech/TECH-06-导出与存档格式.md`（两代 formatter 架构、19 种格式清单、新式契约、
  `.krecorder` marshall/unmarshall、`.side` 导入、复刻要点与缺陷表）。
- 需求文档：`_distill/prd/PRD-06-导出与存档.md`（FR/NFR、边界、验收用例；明确旧式判 P2 不做、新式与
  `.krecorder` 判 P0）。
- 提示词：`_distill/prompts/PROMPT-06-导出与存档.md`（自包含主提示词 + 代码生成/问题诊断两变体 + T1-T5
  调试模板）。
- 相邻技能：`kr-panel-ui`（导出对话框与下拉 UI 落地）、`kr-locator-selfhealing`（`<datalist>` 候选定位器
  的消费方）。

## 红线

- **不臆测行号**：找不到的写「未在源码中找到」，绝不编造 `路径:行号`。
- **不改动被分析的扩展源码**：所有产出只写进 `_distill/` 或用户自有项目。
- **绝不复刻旧式全局函数层叠体系**：`formatCommandOnlyAdapter.js` 三层层叠 + 导出后重注入
  `formatCommand.js` 恢复被覆盖全局——这是 Selenium IDE 遗产的最大坑，个人插件必须改用新式纯函数；
  也不得保留外部扩展导出分支（`kar-generateScript.js:194-228`，把命令发给别的扩展，与本地目标相悖，直接删除）。
- **必须显式点出四个易错点**：① 两代并存只抄新式纯函数；② `mimetype` 只喂 CodeMirror 高亮、不喂下载；
  ③ `.side` 只导入不导出（无对应导出代码）；④ `window.newFormatters` 是裸全局、靠 `<script>` 顺序覆盖，
  复刻必须换成模块注册。
