# PROMPT-02 · 元素定位器生成 + Self-Healing 自愈模块（提示词包）

> 用途：把 KR 7.1.0 的定位器/自愈源码反向讲给 LLM，辅助「裁剪个人录制回放插件」或「排查自愈不生效」。
> 纪律：所有结论必须带 `路径:行号`，禁止臆测；策略清单以 `.add(` 注册为准。

---

## 一、用法说明

本文件包含：
1. **主提示词（自包含，可直接粘贴）**：让 LLM 扮演架构师，产出定位器+自愈模块的裁剪方案。
2. **变体 A**：偏「代码生成」（直接产出可运行骨架）。
3. **变体 B**：偏「问题诊断」（排查自愈为什么不触发）。
4. **调试提示词**：针对常见故障的定向追问模板。

粘贴时请替换 `{{SRC_DIR}}` 为你的源码根目录（默认 `7.1.0_0`）。

---

## 二、主提示词（自包含，~320 行等价信息密度，压缩为可执行指令）

```
你是一位资深测试工具架构师 + 技术文档作者。我要把 Chrome 扩展 Katalon Recorder 7.1.0（MV3）
的定位器生成 + Self-Healing 自愈模块，逆向裁剪成一个个人录制回放插件。

【源码目录】{{SRC_DIR}}
【必读文件】
- content/locatorBuilders.js          （原版生成器，.add 注册清单）
- katalon/ku-locatorBuilders.js       （Katalon 版，xpath:neighbor 置顶）
- content/neighbor-xpaths-generator.js（邻居算法，可读版）
- katalon/neighbor-xpaths-generator.min.js（邻居算法，丰富版，含 generateTextLocator）
- panel/js/UI/services/self-healing-service/utils.js（getPossibleTargetList 排序算法）
- panel/js/background/load-setting-data.js（自愈默认设置）
- panel/js/background/playback/service/actions/play/play-actions.js（回放重试链路）
- panel/js/UI/view/self-healing/self-healing-tab.js（断裂列表 UI）
- panel/js/UI/services/self-healing-service/self-healing-tab-command-actions.js（Approve 写回）
- panel/js/UI/services/helper-service/parser.js（targets 存档为 <datalist>）
- content/targetSelecter.js（悬停高亮）
- katalon/common.js、katalon/dom_collector.js、katalon/dom_inspector.js（云端上报，可裁剪）

【硬性纪律】
1. 禁止臆测：每个结论必须带 `文件路径:行号` + 片段；找不到写「未在源码中找到」。
2. 策略清单必须以源码 `.add(` 注册为准（见 locatorBuilders.js:351-569 与 ku-locatorBuilders.js:352-579）。
3. 全部简体中文。

【关键事实（已核实，可直接引用）】
A. 双轨生成器：
   - 原版 LocatorBuilders.buildAll 返回数组 [ [locator,name], ... ]（content/locatorBuilders.js）。
   - KULocatorBuilders.buildAll 返回对象 { finderName:[locator,...] }（ku-locatorBuilders.js:136-139）。
   - KULocatorBuilders._preferredOrder = ['xpath:neighbor']（ku-locatorBuilders.js:577）。
B. 策略注册（以 .add 为准）：
   原版 14 条：ui:351 id:356 link:363 name:373 dom:name:404 xpath:link:432 xpath:img:442
     xpath:attributes:455 xpath:idRelative:495 xpath:neighbor:515 xpath:href:519
     dom:index:532 xpath:position:547 css:569
   Katalon 版顺序不同，xpath:neighbor 在:579 且置顶。
C. target 结构：TestCommand{ defaultTarget, targets:[] }（test-command.js:13）；
   存档为 <tr>...<td>defaultTarget<datalist><option>...</datalist></td>...（parser.js:92-95）。
D. 自愈默认：enable:true, locator:["id","xpath","css"],
   excludeCommands:["verifyElementPresent","verifyElementNotPresent","assertElementPresent","assertElementNotPresent"]
   （load-setting-data.js:7-18）。
E. 排序算法 getPossibleTargetList（utils.js:55-78）：按 setting.locator 顺序用
   new RegExp('^'+locator) 分组排前，未分组（如 xpath:neighbor）追加末尾，剔除 currentCommand.target。
F. 回放重试（play-actions.js）：doCommand:935 调 getPossibleTargetList:944；
   命中判定 isSelfHealingInvoke=true:958 并 addBrokenLocator:961；
   runCommand:965 取 enableSelfHealing:975；失败处理:1321-1326 识别 not found/Invalid xpath，
   若 enableSelfHealing && !isCommandExcluded 且 possibleTargets.length>0 则
   next=possibleTargets.shift():1331 递归 runCommand 重试:1330-1341。
G. Approve 写回：approveSelfHealingProposalAction:57 → changeLocatorOnRecordGrid:22 /
   changeLocatorOnInMemoryDataObject:44，均执行 command.defaultTarget = proposeLocator。
H. 邻居算法：excludedTags（neighbor-xpaths-generator.js:4）；getXpathsByNeighbors:17；
   getUsefulNeighbors:102（前后各2）；getRelativePrefix:149；getCorrectOffset:164
   （preceding 反向计数）；katalon 版多 generateTextLocator 与 // 轴兜底。
I. 云端上报（可裁剪）：common.js:35-36 调 neighborXpathsGenerator.getUsefulNeighborsText；
   dom_collector.js startDomCollector 定时 postDomMap(qAutomate_server_url,...)。

【任务：请输出】
1. 一张「双轨生成器差异表」（数组 vs 对象、neighbor 置顶、入参 false/true）。
2. 一张「策略注册清单表」（finderName / 行号 / 是否结构脆弱 / 是否建议保留）。
3. xpath:neighbor 算法用 1 个真实 HTML 片段推演 2 遍（展示 preceding/following 与 offset）。
4. getPossibleTargetList 的逐步执行示例（给定 targets 与设置，给出排序结果）。
5. 一张「裁剪 checklist」：必删（云端上报）、必留（neighbor+排序+重试）、可合并（双轨→单轨）。
6. 一段 ≤150 行的定位器+自愈最小骨架（单轨、对象形态、neighbor 置顶）。
```

---

## 三、变体 A · 代码生成型（直接产出可运行骨架）

```
基于上述关键事实 A–I，请**只产出代码**，不要解释：
1. 一个单文件 locator-builders.js：合并双轨为单轨，保留 Katalon 版「对象形态 + xpath:neighbor 置顶」，
   策略至少含 id/name/css/xpath:neighbor，参考 ku-locatorBuilders.js:136-139 与 :577。
2. 一个 neighbor-xpaths-generator.js：实现 getXpathsByNeighbors / getUsefulNeighbors /
   getRelativePrefix / getCorrectOffset / getImmediateText / usefulElement，
   等价 content/neighbor-xpaths-generator.js:17,102,149,164,202,294，并用 katalon 版 // 轴 + generateTextLocator 兜底。
3. 一个 self-healing.js：实现 setting 默认值（load-setting-data.js:7-18）、
   getPossibleTargetList（utils.js:55-78）、isExcluded（utils.js:27-48）、递归重试 runCommand（play-actions.js:1330-1341）。
要求：每个函数上方一行注释标明对应源码 路径:行号。禁止臆测，未找到的写「未在源码中找到」。
```

---

## 四、变体 B · 问题诊断型（排查自愈不触发）

```
我在个人插件里发现「首选定位器失效时自愈没有触发」。请按以下清单逐项核对并给出最可能原因：
1. enable 开关：setting["self-healing"].enable 是否 true？（对照 load-setting-data.js:7-18）
2. 排除命令：失败命令是否在 excludeCommands 正则匹配中？（utils.js:27-48 + play-actions.js:1325）
3. 排序入口：doCommand 是否真的调了 getPossibleTargetList？（play-actions.js:944）
4. 重试条件：报错文案是否含 not found / Invalid xpath / Unrecognised locator type？
   （play-actions.js:1321-1323）
5. 队列非空：possibleTargets 是否 >0？（play-actions.js:1330）
6. 候选来源：录制时 targets 数组是否为空？（parser.js:92-95 + test-command.js:13）
7. 递归调用：runCommand 是否真的用 nextTarget 重新查找而非原 target？（play-actions.js:1331,1330-1341）
请输出：一个「排查决策树」+ 每个节点对应的 路径:行号 + 最可能的 1 个根因。
```

---

## 五、调试提示词（定向故障模板）

**T1 · neighbor 总为空**
```
我的 xpath:neighbor 候选经常为空。请检查：
- excludedTags 是否把页面仅有的邻居排除了？（neighbor-xpaths-generator.js:4）
- usefulElement 的文本长度/数字/隐藏判定是否过滤过度？（:294）
- getUsefulNeighbors 前后各取 2 个是否不够？（:102，参数 2,2）
给出 3 个可调参数与对应行号。

**T2 · 自愈换了定位器但点错元素**
```
自愈命中了但操作了错误元素。请检查：
- getCorrectOffset 的 preceding 反向计数是否正确？（neighbor-xpaths-generator.js:164）
- getRelativePrefix 路径分叉判断是否反了？（:149）
- preciseXPath 唯一性校验是否在生成阶段生效？（content/locatorBuilders.js:332-345）
给出验证 XPath 是否唯一命中的调试代码片段。

**T3 · excludeCommands 误伤**
```
我的 excludeCommands 用正则误匹配了命令。请检查 utils.js:27-48 的
new RegExp(command).exec(commandName) 是否需要整词锚定（^...$），并给出修复片段。

**T4 · 云端上报关不掉**
```
我已删 dom_collector.js 但仍上报。请检查 common.js:35-36 的 getUsefulNeighborsText 调用
与 dom_inspector.js 的 DOM 监听是否也要移除，并列出所有 qAutomate_server_url 引用点。
```

---

*提示词包完。所有引用均可在 `7.1.0_0` 按 路径:行号 核对。*
