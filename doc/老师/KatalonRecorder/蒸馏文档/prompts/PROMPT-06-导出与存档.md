# PROMPT-06 · 代码导出（Formatter）与 `.krecorder` 存档格式（提示词包）

> 用途：把 KR 7.1.0 的两套 formatter 体系与存档序列化反向讲给 LLM，辅助「裁剪个人插件的导出模块」或「排查导出/存档故障」。
> 纪律：所有结论必须带 `路径:行号`，禁止臆测；formatter 清单以 `newFormatters.<id> =` 注册与 `<option value>` 为准，不以目录文件数猜测。

---

## 一、用法说明

本文件包含：
1. **主提示词（自包含，可直接粘贴）**：让 LLM 扮演测试工具架构师，产出「导出模块 + 存档格式」裁剪方案。
2. **变体 A**：偏「代码生成」（注册表 + 两个 formatter + marshall/unmarshall 模块）。
3. **变体 B**：偏「问题诊断」（代码跑不起来 / 存档丢候选定位器 / 中文乱码 / 文件名非法）。
4. **调试提示词 T1-T5**：针对常见故障的定向追问模板。

粘贴时请替换 `{{SRC_DIR}}` 为你的源码根目录（默认 `7.1.0_0`）。

---

## 二、主提示词（自包含，可直接粘贴）

```
你是一位资深测试工具架构师 + 技术文档作者。我要把 Chrome 扩展 Katalon Recorder 7.1.0（MV3）
的代码导出（formatter）与本地存档格式，逆向裁剪成一个纯本地个人录制回放插件的导出模块。

【源码目录】{{SRC_DIR}}

【必读文件】
- panel/js/katalon/kar-generateScript.js（导出总控：加载序列 / 动态注入 / 三条出口分支）
- panel/js/katalon/newformatters/sample.js（新式契约最小实现）与 webdriver.js（模板表驱动范本）
- panel/js/UI/services/helper-service/parser.js（★ .krecorder marshall/unmarshall，144 行）
- panel/js/UI/services/html-service/{download-suite,load-html-file,make-text-file}.js（存档 IO）
- panel/index.html（:779-805 下拉硬编码；:1049-1073 新式静态引入）、panel/js/UI/index.js（:18 裸全局）
- panel/js/UI/models/test-model/{test-command,test-case,test-suite}.js（数据结构）
- panel/js/UI/controllers/other-listeners/import-selenium.js（.side 导入）
- 仅供「确认要删掉什么」、禁止照抄：selenium-ide/formatCommandOnlyAdapter.js、selenium-ide/webdriver.js、
  selenium-ide/format/java/webdriver-testng.js、KS-export-dialog.js

【硬性纪律】
1. 禁止臆测：每个结论必须带 `文件路径:行号` + 片段；找不到写「未在源码中找到」。
2. formatter 清单以 `newFormatters.<id> =` 与 `<option value=...>` 为准（puppeteer.js 一文件注册
   3 个 id，文件数 ≠ 格式数）。3. 明确区分「新式」与「旧式」两代，代码建议须声明基于哪一代。
4. 全部简体中文。

【关键事实（已核实，可直接引用）】
A. 【总钥匙】两套 formatter 体系并存，价值天差地别。旧式是 Selenium IDE 遗产，靠全局函数
   format()/formatCommand()/formatHeader()/formatFooter() + 后加载脚本覆盖先加载脚本来实现
   「继承」，加载序列硬编码在 kar-generateScript.js:25-143 的巨型 switch（java-wd-testng 要按序
   叠 6 个文件，:99-110）；新式是 newFormatters[id](name, commands) → {content,extension,mimetype}，
   纯函数、零全局污染，panel/index.html:1049-1073 启动时一次性静态引入。
   => 复刻只抄新式那代；旧式整体判为不做。

B. 新式契约（唯一要复刻的东西）：newFormatters[id] = function(name, commands) { return
   { content: String, extension: String, mimetype: String } }。调用点 kar-generateScript.js:229-235；
   最小实现 newformatters/sample.js（注册 :2，约 20 行，输出「命令 | target | value」三列文本）。
   另有可选全局 window.unsupportedCommands。

C. 三条出口分支都在 kar-generateScript.js:181-251 的 generateScripts()：① 外部扩展 :194-228
   （sendMessage(extensionId,{type:'katalon_recorder_export',payload:{...}})）；② 新式 :229-235
   （直接调纯函数）；③ 旧式 :236-249（new TestCase + format()），【收尾必须再注入一次
   js/background/formatCommand.js 把被覆盖的全局函数换回来】(:244-249)。分支③的收尾动作说明
   一切：导出一次代码，回放引擎的 formatCommand 就被换掉了。

D. 旧式三层层叠（反面教材，理解即可，不要复刻）：
   L1 骨架 formatCommandOnlyAdapter.js:34-52 format()、:54-76 clickAndWait 拆成
      click + waitForPageToLoad、:84-113 逐条派发 + 缩进；
   L2 语义 selenium-ide/webdriver.js:5-20 postFilter 剥掉 waitForPageToLoad、:39-56
      SeleneseMapper.remap 把 *TextPresent 重映射为对 css=BODY 的断言、:415-450 按
      assert/verify/store/waitFor × isXXX/getXXX 派发（元数据来自 iedoc-core.xml）；
   L3 语言 format/java/webdriver-testng.js:270-278 options、:280-310 header、:312-356 footer、
      :386-401 WDAPI 适配、:358-384 XUL configForm（Firefox 遗迹，Chrome 无效）。
   变量插值 xlateArgument() 在 panel/js/background/formatCommand.js:5-47，与回放引擎共用同一份
   全局函数——这就是「用完必须恢复」的根因，也导致调试时无法知道当前生效的是哪一层的哪一版。

E. 新式的正确写法 =「命令表驱动 + 字符串模板」，范本 newformatters/webdriver.js：:69-89
   locatorType 表（xpath/css/id/link/name/tag_name → 目标语言选择器）；:111-157 seleneseCommands
   模板表（25 条，如 "click": "$(_BY_LOCATOR_).click();"）；:158 header、:163 footer、:165
   formatter()；:172-181 命令不在表中则追加 `// WARNING: unsupported command X`（:178）且导出
   不中断；:195-206 替换链、:214-222 locator()。⚠️ 复刻必须修掉两个缺陷：① _VALUE_STR_ 必须
   先于 _VALUE_ 替换，KR 的 :203 恰在 :204 前，属侥幸正确 → 改一次性
   replace(/_([A-Z_]+)_/g,(m,k)=>map[k])；② :214-222 的 let locType = target.split("=",1) 是
   【数组】却被当 key 用，靠隐式 toString() 侥幸工作。

F. 注册表与下拉都是「硬编码 + 裸全局」，这是要改掉的现状：panel/js/UI/index.js:18 裸对象
   window.newFormatters = {}，各 formatter 自注册于 newformatters/*.js:2（puppeteer.js:225,287,349
   一文件 3 个 id）；下拉 panel/index.html:779-805 硬编码 8 个 <option>（仅新式），整项目导出下拉
   KS-export-dialog.js:38-58 硬编码 19 项；unsupportedCommands 挂 window 且每个 formatter 各抄
   一份 50+ 条（如 dynatrace.js:6 起）。=> 应改为显式注册表
   Map<id,{displayName,extension,mimetype,format}>、下拉由注册表渲染、unsupported 改返回值字段、
   50+ 条清单抽为共享常量。

G. .krecorder marshall（★ 全工程性价比最高的设计，直接抄），parser.js：
   :92-95 marshallCommand → <tr><td>name</td>
     <td>defaultTarget<datalist><option>×N</datalist></td><td>value</td></tr>（:93-94 候选定位器）；
   :102-111 一个用例一张 <table>，<thead> 的 <td data-tags="...">name（:106）；
   :118-131 XHTML 外壳：xml 声明(:120) + DOCTYPE + <meta charset=UTF-8>(:124) + <title>(:125)。
   精妙点：<datalist> 与 data-tags 都是 Selenium IDE 旧解析器【会自动忽略】的扩展点，同一文件
   既无损承载自愈候选定位器与标签，又保持标准三列表格的生态兼容。

H. .krecorder unmarshall，parser.js：:67-84 DOMParser.parseFromString(s,"text/html")(:73) +
   getElementsByTagName("table")(:74)，空串或任何异常统一 throw "Incorrect format"（:68-70、
   :80-82，真实错误被吞）；:39-59 thead>tr>td.innerHTML → name(:40-41)、dataset.tags 含逗号则
   split(:43-45)、遍历 tbody tr(:49) 取 td[0]→name(:52) td[2]→value(:53) td[1]→parseTarget(:54)；
   :25-31 childNodes[0].data → defaultTarget(:26)【脆弱：假定首子节点必是文本节点】+
   querySelectorAll("option")→targets(:27-29)；:5-18 实体反转义表；:138-142 套件名从 <title>
   正则抠（结果未判空）。🔴 读侧反转义但【写侧 :92-95 完全不转义】，转义不对称 → 往返不等价，
   含 `<` 的 target 会被 DOMParser 当标签吃掉。

I. 存档 IO 与三处落地缺陷：download-suite.js:20-30 status==='dynamic' 改存 JSON；:41
   fileName = suite.name + ".krecorder"【无非法字符过滤，过滤逻辑未在源码中找到】；:45-50
   downloads.download({saveAs:true})；:52-69 落盘后用实际文件名回写套件名。load-html-file.js:10
   扩展名校验（不匹配 reject "Wrong file format"）、:13 readAsText、:25-32 分支解析、:19-23
   文件名兜底套件名。make-text-file.js:3-6 Blob type 只写 'text/*'【未带 ;charset=utf-8】→ 乱码。

J. .side 只导入不导出；extension 与 mimetype 语义错位：入口 panel/index.html:143（accept=".side"）
   → import-selenium.js:36-48 → selenium-ide-parser.js 的 parseToRecorderTestSuites → :16-27
   appendSuitesToGrid；targets 映射见 mapping-selenium-test-bbject-to-kr-test-object.js:13-25
   （targets = command.targets.map(t=>t[0])，为空用 command.target 兜底 :18）；不兼容命令弹窗确认
   而非静默丢弃（command-converter-service.js:2-32 + import-selenium.js:38-41），好设计照抄。
   ⚠️【无版本校验】，`.version` 引用未在源码中找到；.side 导出路径未在源码中找到。
   extension 真正决定另存后缀（:276-277）；mimetype【完全不参与下载】，只喂 CodeMirror 当高亮
   mode（:313），下载 Blob type 写死在 make-text-file.js:5 —— 契约里叫 mimetype 名不副实。
   其余出口：copyToClipboard :266-271、saveToFile :273-280、saveAsFileOfTestCase :283-290、
   记住上次选择的语言 :255-264（storage.local.language）。

【任务：请输出】
1. 「两代 formatter 对照表」：契约形态 / 加载方式 / 全局污染 / 可单测性 / 调试难度 / 新增语言成本
   / 副作用，每格带 `路径:行号`，末尾给一句取舍结论。
2. 「新式契约规格表」：字段 / 类型 / 真实用途 / KR 实现行号 / 本插件是否修改，重点标注
   mimetype 名不副实、unsupportedCommands 载体错误两项。
3. 用 6 条命令（open/click/type/select/assertText/pause）推演 newformatters/webdriver.js:111-157
   的模板表驱动流程，展示占位符替换顺序，并演示 `_VALUE_STR_` 晚于 `_VALUE_` 会产出什么。
4. `.krecorder` 完整格式规格（XHTML 骨架 + 三列表格 + `<datalist>` + `data-tags`），解释这两个
   扩展点为何能同时做到「承载候选定位器」与「Selenium IDE 仍能读」；附一个含 3 条命令、每条
   4 个候选定位器、用例带 2 个标签的完整样例文件。
5. 「存档往返等价性缺陷清单」：覆盖 转义不对称 / childNodes[0] 假设 / 缺 <title> / Blob 无
   charset / 文件名非法字符 五项，每项给「原状 → 触发条件 → 修法」+ 行号。
6. 一段 ≤120 行最小导出模块骨架：显式注册表 + 一个 Playwright formatter + marshall/unmarshall
   两个纯函数，每个函数上方一行注释标明对应源码 `路径:行号`。
```

---

## 三、变体 A · 代码生成型（注册表 + 2 个 formatter + 存档模块）

```
基于上述关键事实 A–J，请【只产出代码】，不要解释。产出 4 个文件，原生 ESM、零第三方依赖：

1. `src/export/registry.js` —— 显式 formatter 注册表
   formatters: Map；registerFormatter(id,{displayName,extension,editorMode,format})；
   listFormatters()（供下拉渲染，替代 panel/index.html:779-805 硬编码的 8 个 <option>）；
   runFormatter(id,name,commands) → {content, extension, editorMode, unsupported[]}。
   【改进1】裸全局 window.newFormatters（panel/js/UI/index.js:18）→ 模块级 Map；
   【改进2】mimetype 改名 editorMode（原版 kar-generateScript.js:313 只当 CodeMirror mode 用）；
   【改进3】unsupported 走返回值而非 window.unsupportedCommands，50+ 条清单抽为共享常量
   UNSUPPORTED_BASE（原版每个 formatter 各抄一份，如 dynatrace.js:6 起）。

2. `src/export/formatters/playwright.js` —— Playwright (JS)
   严格遵循 (name, commands) => {content, extension, editorMode, unsupported}（对照 :229-235）；
   定位器前缀表 id/name/css/link/xpath（对照 newformatters/webdriver.js:69-89）；模板表至少覆盖
   open/click/clickAndWait/doubleClick/type/sendKeys/select/pause/refresh/goBack/assertText/
   verifyText/assertTitle/waitForElementPresent/waitForVisible（对照 :111-157 的 25 条）；
   不支持命令 → `// TODO unsupported: cmd | target | value` 并收进 unsupported[]（对照 :178）；
   输出 import { test, expect } from '@playwright/test'; + test(name, async ({page}) => {...})。
   【改进】占位符一次性替换 replace(/_([A-Z_]+)_/g,(m,k)=>map[k])（原版 :195-206 是 6 次链式）；
   插值统一 q = s => JSON.stringify(String(s ?? ''))，不再各写各的引号 replace。

3. `src/export/formatters/pytest.js` —— pytest + Selenium
   同契约，extension 'py'，editorMode 'text/x-python'；header 生成 import + driver fixture；缩进用
   4 空格常量，不用全局 indents()（反面教材 format/java/webdriver-testng.js:280-310）；定位器 →
   By.XPATH / By.CSS_SELECTOR / By.ID / By.NAME / By.LINK_TEXT；方法名由用例名转 snake_case，
   禁止依赖全局 testClassName（原版 kar-generateScript.js:277 依赖它，定义却散落在
   newformatters/dynatrace.js:1、format/java/webdriver-testng.js:17、format/python/python2-wd.js:5，
   最后加载的赢，行为不可预测）。

4. `src/archive/krecorder.js` —— .krecorder 序列化
   escapeEntity / unescapeEntity：& " < > 四个，【双向对称】（原版只有读侧 parser.js:5-18）；
   marshallCommand / marshallTestCase / marshall 严格对齐 parser.js:92-95 / :102-111 / :118-131 的
   产物结构（xml 声明 :120、meta charset :124、title :125、data-tags :106、datalist :93-94）；
   unmarshall 对齐 parser.js:67-84 / :39-59 / :25-31；safeFileName(name) 过滤 \ / : * ? " < > | 与
   首尾空格点号（原版 download-suite.js:41 直拼）；makeBlob(content, mime) 的 type 必须带
   ;charset=utf-8（原版 make-text-file.js:5 未带）；roundTrip(testSuite) 断言五字段逐条相等。
   【改进】parseTarget 用 td.firstChild?.nodeType === 3 ? td.firstChild.data : '' 替代原版 :26 的
   childNodes[0].data（原版对无 datalist 的手工文件抛 TypeError，再被 :80-82 吞成
   "Incorrect format"，整文件读不进来）；异常改按 空内容/非 HTML/无 table/表结构不符 分类报错。

要求：每个函数上方一行注释标明对应源码 `路径:行号`，改进处用 `// 【改进】原版 xxx:行号 的问题是…`；
禁止臆测，未找到的写「未在源码中找到」；禁止定义任何全局函数/全局变量，formatter 必须能在 Node 里
import 后直接断言、不依赖 DOM；禁止复刻旧式体系任何部分（format()/formatCommand()/formatHeader()/
formatFooter()/WDAPI/SeleneseMapper/iedoc-core.xml/动态 <script> 注入）。
```

---

## 四、变体 B · 问题诊断型（代码跑不起来 / 丢候选定位器 / 乱码 / 文件名非法）

```
我的个人插件导出与存档模块出故障，请按以下决策树逐项核对，给出最可能的 1 个根因。

【症状一：导出的代码粘进项目跑不起来】
1. 命令名根本不在模板表里？原版只输出注释不报错，极易忽略 —— newformatters/webdriver.js:172-181
   （:178 输出 `// WARNING: unsupported command`）。
2. 占位符替换顺序错了？_VALUE_STR_ 必须先于 _VALUE_，否则 _VALUE_ 先吃掉前缀、残留 "STR_"—— :195-206。
3. 定位器前缀解析？原版 locator() 的 let locType = target.split("=",1) 是【数组】当 key 用 —— :214-222；
   前缀未知时兜底原样返回并把 ' 换成 "。
4. target/value 含引号或换行？各 formatter 转义规则不统一（css 把 "→'，xpath 转义 '）—— :69-89、:190-192。
5. 你复刻的是旧式那代？旧式产物依赖全局 xlateArgument（panel/js/background/formatCommand.js:5-47）
   与 iedoc-core.xml 元数据（selenium-ide/webdriver.js:415-450），脱离插件环境不可复现。

【症状二：存档读回来命令丢了候选定位器】
6. 写侧真写了 <datalist> 吗（parser.js:93-94，targets 为空只写空 datalist）？读侧取的是
   querySelectorAll("option") 吗（:27-29）？
7. defaultTarget 被挤走了？原版靠 childNodes[0].data 取首个文本节点（parser.js:26），若 <td> 首节点
   不是文本（手工编辑过 / Selenium IDE 原生文件），.data 为 undefined → TypeError → 被 :80-82 吞掉
   → 整文件报 "Incorrect format"。
8. target 含 `<`？写侧 parser.js:92-95【不转义】被 DOMParser 当标签吃掉；读侧 :5-18 却反转义。
9. 是 dynamic 套件？download-suite.js:20-30 走 JSON 分支，根本不经过 marshall。

【症状三：中文乱码】
10. Blob type 带 charset 了吗？make-text-file.js:5 只写 'text/*'；存档头的 <meta charset=UTF-8>
    （parser.js:124）只影响渲染不影响落盘字节 —— 两处都要对。
11. 读入侧 FileReader.readAsText 指定编码了吗（load-html-file.js:13）？导出的代码文件走同一坑。

【症状四：下载文件名非法 / 下载静默失败】
12. 套件名含 \ / : * ? " < > | ？download-suite.js:41 直接拼接，过滤逻辑未在源码中找到；
    单用例另存文件名来自 kar-generateScript.js:276-277，后缀取 formatter 返回的 extension。
13. 文件名依赖全局 testClassName？定义散落在 newformatters/dynatrace.js:1、
    format/java/webdriver-testng.js:17、format/python/python2-wd.js:5，最后加载的赢。
14. saveAs:true 时用户改了名怎么办？原版有回写逻辑 download-suite.js:52-69。

请输出：
- 一棵「排查决策树」（症状 → 分支 → 结论），每个节点标注 `路径:行号`；
- 每种症状给出最可能的 1 个根因 + 最小验证方法（≤5 行，可在 Node 或 DevTools 直接跑）。
```

---

## 五、调试提示词（T1-T5 定向故障模板）

**T1 · 新写的 formatter 在下拉框里看不见**

```
我照着 newformatters/sample.js 新写了一个 formatter，但导出下拉框里没有它。请检查：
- 下拉是硬编码的：panel/index.html:779-805 写死 8 个 <option>，新增文件不会自动出现；整项目
  导出下拉是另一处硬编码 KS-export-dialog.js:38-58（19 项）。
- 脚本静态引入了吗？新式 formatter 全在 panel/index.html:1049-1073 逐个 <script> 引入；原版注册
  都包在 $(document).ready 里（newformatters/*.js:2）。
- id 拼对了吗？下拉 value 是 `new-formatter-<id>`，kar-generateScript.js:119-121 用
  language.replace('new-formatter-','') 取 id 查 newFormatters[id]；查不到会落到
  isExternalCapability = true 分支（:122-124），转去发外部扩展消息（:194-228）并报连接失败
  —— 现象与「formatter 写错」完全不像，极易误判。
输出：一份「硬编码下拉 → 注册表驱动」的最小改造方案，含 registry.js 接口与下拉渲染函数。
```

**T2 · 导出的代码语法错误 / 占位符残留**

```
我的 formatter 产出的代码里出现残留字符串（如 "STR_" 或 "undefined"）。请检查：
- 替换顺序：_VALUE_STR_ 必须先于 _VALUE_、_TARGET_STR_ 必须先于 _TARGET_
  （newformatters/webdriver.js:195-206，原版 :203 恰在 :204 前，属侥幸正确）。
- _SEND_KEY_ 取自 specialKeyMap[value]（表见 :91-108，替换见 :204 附近），value 不在表里就是
  undefined 直接插进代码；_SELECT_OPTION_ 取自 value.trim().split("=",2)[1]，不含 "=" 时同样如此。
输出：① 一次性替换实现 replace(/_([A-Z_]+)_/g, (m,k)=> k in map ? map[k] : `/*MISSING:${k}*/`)，
把「缺占位符」从静默 undefined 变成显式可见；② 针对上述三个坑的单元测试用例（Node，不依赖浏览器）。
```

**T3 · 存档读回报 "Incorrect format" 或候选定位器丢失**

```
我的 .krecorder 读回时报 "Incorrect format"，或读进来了但 targets 是空数组。请检查：
- 异常被整体吞掉：parser.js:80-82 把 try 块内任何异常统一 throw "Incorrect format"，真实错误
  （往往是 TypeError）看不到，先临时打印 e。
- defaultTarget：parser.js:26 的 childNodes[0].data 假定 <td> 首子节点必是文本节点；手工编辑过的
  文件或 Selenium IDE 原生文件不满足该假设 → undefined.data → TypeError。
- targets：读 parser.js:27-29，写 :93-94。转义：写侧 :92-95 不转义、读侧 :5-18 反转义，含 `<`
  的 target 会被 DOMParser 当标签吃掉。套件名：:138-142 从 <title> 正则抠，缺 <title> 时对 null
  取下标 TypeError，兜底在 load-html-file.js:19-23。
输出：① 带对称 escapeEntity/unescapeEntity 的 marshall/unmarshall 实现；② roundTrip 断言
（name/defaultTarget/targets/value/tags 五字段逐条相等）；③ 回归用例集：target =
`xpath=//a[text()='<b>粗体</b>']`、value 含换行、targets 为空、无 <datalist> 的手工表格、缺 <title>。
```

**T4 · 中文乱码与文件名非法**

```
我的存档里中文变成乱码，套件名叫「登录/注册」时下载还失败了。请检查：
- Blob type：make-text-file.js:3-6 只写 'text/*'，未带 ;charset=utf-8；存档内容里的
  <meta content="text/html; charset=UTF-8">（parser.js:124）只管渲染，不管落盘字节。
- 文件名：download-suite.js:41 直接拼 suite.name + ".krecorder" 交给 downloads.download，非法
  字符过滤逻辑未在源码中找到；单用例导出文件名在 kar-generateScript.js:276-277；落盘后回写套件名
  见 download-suite.js:52-69（用户在 saveAs 对话框改名后同步回来）。
输出：① makeBlob(content, mime) 正确实现（type 带 charset）；② safeFileName(name)：替换 Windows
非法字符 \ / : * ? " < > |、去首尾空格与结尾点号、限长、空名兜底；③ 文件名用例集：`登录/注册`、
`a:b`、`  x  `、`CON`、超长名、空字符串。
```

**T5 · 导出一次之后回放就坏了**

```
我在插件里点了一次「导出为脚本」，之后回放开始报错 / 变量插值不对。请检查：
- 你是不是复刻了旧式 formatter？旧式定义的全局 formatCommand 与回放引擎的
  panel/js/background/formatCommand.js 同名同域，导出一次就把回放用的函数覆盖了。原版的补丁是
  kar-generateScript.js:244-249 在旧式分支收尾时再注入一次该文件把函数「换回来」——
  这是副作用清理，不是设计。
- 同类坑：全局 testClassName 决定另存文件名（:277），定义散落在 newformatters/dynatrace.js:1、
  format/java/webdriver-testng.js:17、format/python/python2-wd.js:5，最后加载的赢。
- 层叠序列 :25-143（java-wd-testng 按序叠 6 个文件，:99-110），最终行为是六层覆盖的叠加结果，
  调试时根本无法知道当前生效的是哪个文件里的哪一版函数；动态注入 + 轮询 :150-171 建 <script>
  塞 document.head，async=false 保序，setInterval 每 100ms 轮询 onload 计数 —— MV3 下 CSP 更严、
  时序更不可控，且完全无法单测。
输出：① 「旧式体系拆除清单」：要删的文件/目录 + 全局函数名 + 连带依赖（iedoc-core.xml、WDAPI、
SeleneseMapper、XUL configForm、动态注入与轮询），注明 iedoc-core.xml 还被 Reference 标签页依赖
（见 TECH-04），删除前需确认；② 「新式纯函数契约迁移指南」：如何把一个旧式语言模板改写成
(name, commands) => {content, extension, editorMode, unsupported} 的单文件 formatter。
```

---

*提示词包完。所有引用均可在 `7.1.0_0` 按 路径:行号 核对；完整机制见 `_distill/tech/TECH-06-导出与存档格式.md`，需求范围见 `_distill/prd/PRD-06-导出与存档.md`。*
