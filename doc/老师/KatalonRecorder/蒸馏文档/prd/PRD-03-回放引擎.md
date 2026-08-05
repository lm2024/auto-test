# PRD-03 · 回放引擎（Playback）产品需求文档

> 产品视角，给「个人录制回放插件」的回放能力定范围。所有功能点均有源码依据（见 `实现位置` 列）。
> 优先级约定：**P0=必备**（缺了跑不起来），**P1=重要**（影响可用性），**P2=可选**（锦上添花）。
> 需求编号统一前缀 `FR-P`（Functional Requirement · Playback）。
> 源码根目录：`c:\Users\Li\Downloads\GitHub\auto-test\doc\老师\KatalonRecorder\7.1.0_0\`

---

## 目录

1. [背景与目标](#1-背景与目标)
2. [名词表](#2-名词表)
3. [用户故事](#3-用户故事)
4. [功能需求（FR-P）](#4-功能需求fr-p)
5. [非功能需求（NFR）](#5-非功能需求nfr)
6. [数据结构（TypeScript）](#6-数据结构typescript)
7. [核心流程图](#7-核心流程图)
8. [状态机定义](#8-状态机定义)
9. [边界与异常](#9-边界与异常)
10. [验收用例](#10-验收用例)
11. [Out of Scope（不在本次范围）](#11-out-of-scopeboundary不在本次范围)

---

## 1. 背景与目标

**背景**：录制只解决「把操作记下来」，回放才是自动化测试的价值兑现环节。Katalon Recorder 的回放引擎需要在**浏览器扩展的多进程环境**（Panel 页面 / Content Script / Service Worker / Page 上下文）中，跨页面跳转、跨 iframe、跨窗口地把一串命令可靠地执行完，并在页面动态变化时不误判、不早退。

**核心矛盾**：

| 矛盾 | 表现 |
|---|---|
| 命令是同步语义，浏览器是异步的 | 点了按钮，下一条命令什么时候能跑？ |
| Panel 与页面是两个进程 | 页面刷新会销毁 Content Script，命令投递会失败 |
| MV3 禁止 Panel 侧 `eval` | `if (count > 3)` 这种条件表达式怎么求值？ |
| 页面有 `<input type=file>` / 需要真实按键 | JS 权限不够 |

**目标**：在个人裁剪插件中实现一套**可读、可调试、可扩展**的回放引擎，保留原版的稳定性设计（五段等待流水线、通信重试、自愈接入），剔除外部 Socket 驱动、CDP 越权、云端上报等非核心逻辑。

**成功标准**：

- S1：一条包含 `open → type → click → assertText` 的用例，在含页面跳转的场景下 100% 通过。
- S2：目标标签页在命令执行中刷新，引擎能自动等待并续跑，不报「连接断开」。
- S3：单条命令失败时，能明确区分「元素找不到」/「断言不通过」/「通信超时」三类错误。
- S4：支持暂停 / 继续 / 停止，且暂停后不丢失变量上下文。

---

## 2. 名词表

| 名词 | 含义 | 源码锚点 |
|---|---|---|
| Command（命令） | `{command, target, value}` 三元组，回放的最小单位 | `window-controller.js:142-158` |
| Action（动作命令） | `doXxx` 派生，产生副作用，如 `click` | `selenium-commandhandlers.js:90-102` |
| Accessor（访问器） | `getXxx`/`isXxx`，只读取值，派生出 8 种命令 | `selenium-commandhandlers.js:67-88` |
| AndWait 变体 | 动作命令的「执行后等页面加载」版本 | `selenium-commandhandlers.js:99` |
| ExtCommand（扩展级命令） | 不下发页面、由 Panel 直接执行的命令 | `play-actions.js:1489` |
| 内部等待命令 | `waitPreparation/prePageWait/pageWait/ajaxWait/domWait` 五条引擎私有命令 | `selenium-api.js:419-534` |
| ExecutionLoop（执行主循环） | Promise 递归的命令调度器 | `play-actions.js:539-682` |
| blockStack（块栈） | 模拟 `if`/`while` 嵌套的运行时栈 | `play-actions.js:46` |
| labels（标签表） | `label 名 → 命令索引`，供 `gotoLabel` 跳转 | `play-actions.js:47` |
| storedVars | Content Script 进程内的变量表 | `selenium-api.js:20` |
| declaredVars | Panel 进程内的变量表 | `formatCommand.js:3` |
| SideeXPlayingFlag | `document.body` 上的「回放中」标记，抑制录制 | `command-receiver.js:81/87/100/129` |
| Sandbox Evaluator | MV3 下用 iframe 做动态表达式求值的沙箱 | `SandboxEvaluator.js:41-44` |
| formalCommands | UI 命令白名单（小写→正规写法映射） | `generate-command-data-list.js:8` |

---

## 3. 用户故事

| ID | 角色 | 故事 | 关联需求 |
|---|---|---|---|
| US-1 | 测试工程师 | 我点一下 Play，希望录好的用例从头到尾自动跑完，中途页面跳转也不会断 | FR-P-001 ~ 007 |
| US-2 | 测试工程师 | 我希望回放速度可调，调试时慢放看清每一步，跑批时全速 | FR-P-008 |
| US-3 | 测试工程师 | 我希望能在某一行打断点，跑到那里停下来手工检查页面 | FR-P-009 |
| US-4 | 测试工程师 | 我希望把页面上的文本存成变量，后面的命令里用 `${var}` 引用 | FR-P-020 ~ 023 |
| US-5 | 测试工程师 | 我希望写 `if 库存 > 0 then 下单 else 跳过` 这种分支逻辑 | FR-P-030 ~ 035 |
| US-6 | 测试工程师 | 我希望一份 CSV 数据驱动同一个用例跑 100 遍 | FR-P-040 ~ 043 |
| US-7 | 测试工程师 | 页面弹了个 confirm，我希望回放能自动点「确定」而不是卡住 | FR-P-050 ~ 052 |
| US-8 | 测试工程师 | 用例失败时我希望能一眼看出是哪一行、什么原因 | FR-P-060 ~ 063 |
| US-9 | 测试工程师 | 页面改版后定位器失效，我希望引擎自动换个候选定位器继续跑 | FR-P-070 ~ 071 |
| US-10 | 插件开发者 | 我希望新增一个命令只需要写一个 `doXxx` 方法，断言/等待/存储变体自动生成 | FR-P-011 |

---

## 4. 功能需求（FR-P）

### 4.1 A 组：执行调度（FR-P-001 ~ 009）

| ID | 优先级 | 需求描述 | 实现位置 | 备注 |
|---|---|---|---|---|
| FR-P-001 | **P0** | 支持「播放单个测试用例」，从索引 0 顺序执行到末条 | `play-actions.js:158-176` `playTestCaseAction` | 起始日志 `Playing test case <suite> / <case>` |
| FR-P-002 | **P0** | 执行流程必须为 `初始化 → 主循环 → 收尾 → 异常捕获` 四段式 | `play-actions.js:274-281` | `initializePlayingProgress().then(executionLoop).then(finalizePlayingProgress).catch(catchPlayingError)` |
| FR-P-003 | **P0** | 主循环用 Promise 递归而非 for 循环，每条命令完成后递归下一条 | `play-actions.js:539-682`，递归点 `:679` | 支持异步中断/续跑 |
| FR-P-004 | **P0** | 维护游标 `currentPlayingCommandIndex`，初值 `-1`，取命令前自增 | `play-actions.js:50` / `:607` | |
| FR-P-005 | **P0** | 每条业务命令前必须依次执行 5 个内部等待命令 | `play-actions.js:673-679` | 见 D 组 |
| FR-P-006 | **P1** | 支持「播放测试套件」（多用例串行） | `play-actions.js:339`（第二处 `logStartTime`） | |
| FR-P-007 | **P2** | 支持「播放全部套件」 | `CommandFactory.js` `playAll` | |
| FR-P-008 | **P1** | 命令间延迟可通过 UI 滑块调节 | `play-actions.js:630` `delay($("#slider").slider("option","value"))` | 建议重构为 `getPlaybackDelay()` 解耦 UI |
| FR-P-009 | **P1** | 支持断点 / 暂停 / 继续 / 停止；暂停时保留变量上下文 | `play-actions.js:577-595` | 实现方式：暂停时不递归，把 resolve 挂起 |

### 4.2 B 组：命令体系（FR-P-010 ~ 016）

| ID | 优先级 | 需求描述 | 实现位置 | 备注 |
|---|---|---|---|---|
| FR-P-010 | **P0** | 命令实现集中在一个 `Selenium.prototype` 命名空间下，按 `doXxx`/`getXxx`/`isXxx` 命名约定编写 | `content/selenium-api.js`（153 个活跃方法） | 99 个 `doXxx` + 54 个 accessor |
| FR-P-011 | **P0** | **命令变体自动派生**：写一个方法自动得到多个命令，无需手工注册 | `selenium-commandhandlers.js:121-125` `registerAll` | 三条规则见下 |
| FR-P-011a | **P0** | Accessor 规则：`getFoo`/`isFoo` → `getFoo, storeFoo, assertFoo, verifyFoo, assertNotFoo, verifyNotFoo, waitForFoo, waitForNotFoo`（8 个） | `selenium-commandhandlers.js:67-88` | |
| FR-P-011b | **P0** | Action 规则：`doFoo` → `foo, fooAndWait`（2 个） | `selenium-commandhandlers.js:90-102`，`AndWait` 在 `:99` | |
| FR-P-011c | **P2** | Assert 规则：裸 `assertFoo` → `assertFoo(halt), verifyFoo(no-halt)` | `selenium-commandhandlers.js:104-119` | KR 7.1.0 中**无活跃方法命中**，规则空转 |
| FR-P-012 | **P0** | `is*Present` 的反义命名必须为 `XxxNotPresent` 而非 `NotXxxPresent` | `kar-loadCommand.js:26-35` | 影响 5 个访问器 |
| FR-P-013 | **P1** | 维护 UI 命令白名单，用于输入框自动补全与大小写容错 | `kar-loadCommand.js:1-76` + `generate-command-data-list.js:8` | 575 条 |
| FR-P-014 | **P1** | 白名单需排除不适合 `AndWait` 的命令 | `kar-loadCommand.js:5` `nonWaitActions`（8 条） | `open` 已隐式等待 |
| FR-P-015 | **P0** | Content 侧按 `"do" + 首字母大写` 反射调用命令方法 | `command-receiver.js:78-79` | 找不到则回落 handler 表 `:109-133` |
| FR-P-016 | **P1** | 白名单外的 17 条 Panel 独占命令由主控直接执行，不下发页面 | `play-actions.js:1114-1304` | if/else/while/label/goto/CSV 等 |

### 4.3 C 组：跨进程通信（FR-P-017 ~ 019）

| ID | 优先级 | 需求描述 | 实现位置 | 备注 |
|---|---|---|---|---|
| FR-P-017 | **P0** | 命令通过 `tabs.sendMessage(tabId, {commands, target, value}, {frameId})` 投递到指定 Frame | `window-controller.js:142-158` | |
| FR-P-018 | **P0** | 投递必须包裹**通信重试**，重试 60 次 × 500ms（共 30s） | `window-controller.js:142-158` + `common/promise-utils.js` | 用于跨越页面刷新导致的 Content Script 重注入 |
| FR-P-019 | **P0** | 4 条会话上下文命令（`pause/selectFrame/selectWindow/close`）不下发页面 | `play-actions.js:1489` `isExtCommand` | 由 `window-controller.js:212/229/278` 执行 |

### 4.4 D 组：等待与稳定性（FR-P-100 ~ 106）

| ID | 优先级 | 需求描述 | 实现位置 | 备注 |
|---|---|---|---|---|
| FR-P-100 | **P0** | 提供「安装监听钩子」命令，一次性挂上导航/XHR/DOM 三类监听 | `selenium-api.js:419-464` `doWaitPreparation` | |
| FR-P-101 | **P1** | 导航判定：`beforeunload` 触发即置 `window.new_page` | `selenium-api.js:419-464` / `:468` `doPrePageWait` | |
| FR-P-102 | **P0** | 加载判定：`document.readyState == "complete"` | `selenium-api.js:475` `doPageWait` | 最基础，必须有 |
| FR-P-103 | **P1** | AJAX 判定：所有已发起 XHR 的 `readyState` 均为 4 | `selenium-api.js:495` `doAjaxWait` | **注意原版内存泄漏，见 NFR-5** |
| FR-P-104 | **P1** | DOM 静止判定：`domModifiedTime` 在采样间隔内无变化 | `selenium-api.js:530` `doDomWait` | 原版用已废弃的 Mutation Events |
| FR-P-105 | **P0** | 单命令默认超时 30 秒，可用 `setTimeout` 命令修改 | `selenium-api.js:290` / `:2884` | |
| FR-P-106 | **P1** | `waitForXxx` 系列在 Content 侧以 10ms 轮询实现 | `command-receiver.js:191-221` | |

### 4.5 E 组：变量系统（FR-P-020 ~ 026）

| ID | 优先级 | 需求描述 | 实现位置 | 备注 |
|---|---|---|---|---|
| FR-P-020 | **P0** | 支持在命令的 target/value 中用 `${varName}` 引用变量 | `formatCommand.js:5-47` `xlateArgument` | 命令下发前替换 |
| FR-P-021 | **P0** | Content 侧独立维护 `storedVars`，命令执行时二次替换 | `selenium-api.js:20` / `:2962` `replaceVariables` | |
| FR-P-022 | **P0** | Content 侧执行 `storeXxx` 后必须把结果回传 Panel | `selenium-api.js:377` + `selenium-commandhandlers.js:269-283` | 消息格式 `{storeStr, storeVar}` |
| FR-P-023 | **P0** | Panel 侧监听并写入 `declaredVars` | `formatCommand.js:61-70` + `panel/js/katalon/kar.js:623` | |
| FR-P-024 | **P1** | `echo` 命令通过 `{echoStr}` 消息打日志 | `selenium-api.js:405` / `formatCommand.js:61-70` | |
| FR-P-025 | **P1** | 支持参数内联求值 `javascript{expr}` | `selenium-api.js:2949` `preprocessParameter` | Content 侧可直接 eval |
| FR-P-026 | **P2** | 内置特殊按键常量（`${KEY_ENTER}` 等）自动注入变量表 | `selenium-api.js:26-103` `build_sendkeys_maps` | 配合 `sendKeys`（`:1083`） |

### 4.6 F 组：流程控制（FR-P-030 ~ 037）

| ID | 优先级 | 需求描述 | 实现位置 | 备注 |
|---|---|---|---|---|
| FR-P-030 | **P1** | 支持 `if / elseIf / else / endIf` 分支 | `play-actions.js:1114/1136/1125/1147` | 用 `blockStack` |
| FR-P-031 | **P1** | 支持 `while / endWhile` 循环 | `play-actions.js:1154/1165` | `endWhile` 回拨游标 |
| FR-P-032 | **P2** | 支持 `label / gotoLabel / gotoIf` 跳转 | `play-actions.js:1227/1255/1237` | 用 `labels` 表 |
| FR-P-033 | **P2** | 支持 `break` 跳出循环 | 由 `blockStack` 消费 | |
| FR-P-034 | **P1** | 条件表达式为 JS 语法，**MV3 下必须走沙箱 iframe 求值** | `SandboxEvaluator.js:41-44` + `panel/js/katalon/kar.js:597` | 禁止 Panel 页直接 `eval` |
| FR-P-035 | **P1** | 求值前把所有已声明变量拼成 `var xxx = ...;` 前导声明 | `panel/js/katalon/kar.js:611` `expandForStoreEval` | 让表达式能直接写变量名 |
| FR-P-036 | **P0** | 块栈与标签表在每次回放开始时必须重置 | `play-actions.js:46-48` | 否则跨用例污染 |
| FR-P-037 | **P2** | 嵌套深度无硬限制（受内存约束） | — | |

### 4.7 G 组：数据驱动（FR-P-040 ~ 044）

| ID | 优先级 | 需求描述 | 实现位置 | 备注 |
|---|---|---|---|---|
| FR-P-040 | **P2** | `storeCsv` 支持两种 target：`file,row,col`（取单元格）与 `file`（取整表） | `execute-storeCSV.js:66-104` `parseLocation` | |
| FR-P-041 | **P2** | 整表模式返回**列式对象** `{col: [...], length: N}` | `execute-storeCSV.js:130-148` `getCSVData` | 支持 `${csv.name[0]}` |
| FR-P-042 | **P2** | `loadVars / endLoadVars` 构成按 CSV 行迭代的循环块 | `play-actions.js:1186/1210` | 与 while 同构 |
| FR-P-043 | **P2** | 支持 `writeToCSV / appendToCSV / appendToJSON` 写回 | `execute-{writeToCSV,appendToCSV,appendToJSON}.js` | |
| FR-P-044 | **P1** | 数据驱动命令的入参必须做三层校验（行号非负整数、列名非空、文件存在） | `execute-storeCSV.js:11-27 / 35-43 / 175-181` | 错误信息面向用户 |

### 4.8 H 组：弹窗处理（FR-P-050 ~ 054）

| ID | 优先级 | 需求描述 | 实现位置 | 备注 |
|---|---|---|---|---|
| FR-P-050 | **P1** | 必须在 **page 上下文**（非 isolated world）改写 `window.alert/confirm/prompt` | `page/prompt.js:118-176` | isolated world 改写无效 |
| FR-P-051 | **P1** | 回放期弹窗自动应答，不阻塞流程 | `page/prompt.js:119/137/155` 检查 body 属性 | `setPrompt` / `setConfirm` / `SideeXPlayingFlag` |
| FR-P-052 | **P1** | 子 Frame 的弹窗代理给顶层窗口处理 | `page/prompt.js:56-114` | |
| FR-P-053 | **P1** | 提供 `answerOnNextPrompt / chooseOkOnNextConfirmation / chooseCancelOnNext*` 预设应答命令 | `selenium-api.js:3804/3808/3841/3845` | |
| FR-P-054 | **P1** | 提供 `assertAlert / assertConfirmation / assertPrompt` 断言弹窗内容 | `selenium-api.js:3812/3822/3849` | 另有人工补丁 `doVerifyAlert:3831` |

### 4.9 I 组：错误处理（FR-P-060 ~ 065）

| ID | 优先级 | 需求描述 | 实现位置 | 备注 |
|---|---|---|---|---|
| FR-P-060 | **P0** | `assert*` 失败中断用例，`verify*` 失败只记录不中断 | `selenium-commandhandlers.js:358-379` `haltOnFailure` | |
| FR-P-061 | **P0** | 断言失败必须抛出带实际值与期望值的错误信息 | `selenium-commandhandlers.js:204-212` `Assert.fail(result.message)` | |
| FR-P-062 | **P1** | 提供全局「失败后是否继续下一用例」开关 | `play-actions.js:1530-1552` 读 `setting.testExecution.continueExecution` | |
| FR-P-063 | **P1** | 提供「隐藏执行结果对话框」开关 | 同上，`setting.testExecution.hideExecutionDialog` | |
| FR-P-064 | **P0** | 顶层统一异常捕获，失败时标红当前行并正常收尾 | `play-actions.js:274-281` `.catch(catchPlayingError)` | |
| FR-P-065 | **P1** | 错误必须可区分三类：元素找不到 / 断言不通过 / **通信超时**（`Retry failed`） | `common/promise-utils.js` 抛 `'Retry failed'` | 通信超时常被误诊为元素问题 |

### 4.10 J 组：自愈接入（FR-P-070 ~ 072）

| ID | 优先级 | 需求描述 | 实现位置 | 备注 |
|---|---|---|---|---|
| FR-P-070 | **P1** | 命令失败后先在隐式等待窗口内原地重试同一定位器 | `play-actions.js:1320-1370` | |
| FR-P-071 | **P1** | 隐式等待耗尽后，按序取候选定位器重试 | `play-actions.js:944` / `:1326` `getPossibleTargetList` | 详见 TECH-02 |
| FR-P-072 | **P2** | 自愈命中后上报「断裂定位器 + 推荐定位器」供用户写回 | `addBrokenLocator` | 详见 TECH-02 |

### 4.11 K 组：越权能力（FR-P-080 ~ 083）

| ID | 优先级 | 需求描述 | 实现位置 | 备注 |
|---|---|---|---|---|
| FR-P-080 | **P2** | 支持整页截图 | `background/kar.js:160-169` `tabs.captureVisibleTab` + `selenium-api.js:3229` | 只需 `activeTab` 权限 |
| FR-P-081 | **P2** | 支持文件上传（`<input type=file>`） | `background/kar.js:61-81` CDP `DOM.setFileInputFiles` + `selenium-api.js:3887` | **需 `debugger` 高危权限** |
| FR-P-082 | **P2** | 支持派发真实（`isTrusted:true`）按键事件 | `background/kar.js:85-157` CDP `Input.dispatchKeyEvent` | 同上 |
| FR-P-083 | **P2** | 提供元素 → CDP nodeId 的桥接（打 `krId` 属性再查询） | `background/kar.js:197` `doActionOnNode` / `:240` `doAttachDebugger` | |

### 4.12 L 组：回放期录制抑制（FR-P-090）

| ID | 优先级 | 需求描述 | 实现位置 | 备注 |
|---|---|---|---|---|
| FR-P-090 | **P0** | 命令执行期间在 `document.body` 打 `SideeXPlayingFlag` 标记，执行完移除 | `command-receiver.js:81/87/100/129` | 防止回放动作被录制器再次记录，造成命令自增殖 |

---

## 5. 非功能需求（NFR）

| ID | 优先级 | 需求 | 依据 / 说明 |
|---|---|---|---|
| NFR-1 | **P0** | **跨页面跳转鲁棒性**：目标页刷新/跳转后，引擎须在 30 秒内自动恢复命令投递 | `window-controller.js:142-158` 的 `retryUntilSuccess(…, 60, 500)` |
| NFR-2 | **P0** | **MV3 合规**：Panel 页面不得使用 `eval`/`new Function`；动态求值一律走 sandbox iframe | `SandboxEvaluator.js` |
| NFR-3 | **P1** | **无栈溢出**：万条级命令用例不得因递归导致 `RangeError` | Promise `.then()` 递归在微任务队列展平，天然满足 |
| NFR-4 | **P1** | **超时配置统一**：三套超时（Content 命令 30s / Panel 等待 30s×5 / 通信重试 30s）应收敛到单一 config | 原版三处独立硬编码，见 `selenium-api.js:290`、`play-actions.js:831-933`、`window-controller.js:142` |
| NFR-5 | **P1** | **无内存泄漏**：AJAX 监听不得无限累积请求对象 | 原版 `window.ajax_obj` 只增不减（`selenium-api.js:419-464`），须改造 |
| NFR-6 | **P1** | **性能**：DOM 变更监听改用 `MutationObserver`，禁用已废弃的 Mutation Events | 原版用 `DOMNodeInserted` 等，性能差一个量级 |
| NFR-7 | **P1** | **UI 解耦**：引擎核心不得直接读 jQuery DOM | 原版 `play-actions.js:630` 直读 `$("#slider")` |
| NFR-8 | **P2** | **最小权限**：默认不申请 `debugger` 权限，上传/真实按键作为可选模块 | 见 FR-P-081/082 |
| NFR-9 | **P1** | **可调试性**：每条命令的开始/结束/耗时/结果需可打印到日志面板 | 参照 `sideex_log.info` |
| NFR-10 | **P2** | **命令扩展成本**：新增一个业务命令的改动量 ≤ 1 个函数 | 由 FR-P-011 元编程保证 |

---

## 6. 数据结构（TypeScript）

```ts
// ============ 命令与用例 ============

/** 回放的最小单位 */
interface Command {
  command: string;          // 命令名，如 "click" / "assertText"
  target: string;           // 定位器或参数 1，可含 ${var}
  value: string;            // 参数 2，可含 ${var}
  targets?: LocatorPair[];  // 候选定位器（自愈用），见 TECH-02
  comment?: string;
  breakpoint?: boolean;     // FR-P-009
}

type LocatorPair = [locator: string, finderName: string];

interface TestCase {
  name: string;
  commands: Command[];
}

interface TestSuite {
  name: string;
  testCases: TestCase[];
}

// ============ 引擎运行时状态 ============
// 对应 play-actions.js:46-50

/** if/while 的运行时块帧 */
interface BlockFrame {
  type: 'if' | 'while' | 'loadVars';
  startIndex: number;       // 块起始命令索引（while 回拨用）
  conditionMet: boolean;    // 当前分支是否应执行
  branchTaken?: boolean;    // if/elseIf 链中是否已有分支命中
}

interface PlaybackState {
  currentPlayingCommandIndex: number;   // play-actions.js:50，初值 -1
  blockStack: BlockFrame[];             // play-actions.js:46
  labels: Record<string, number>;       // play-actions.js:47
  expectingLabel: string | null;        // play-actions.js:48
  status: PlaybackStatus;               // 见 §8
}

type PlaybackStatus =
  | 'IDLE' | 'INITIALIZING' | 'RUNNING'
  | 'WAITING' | 'PAUSED' | 'FINALIZING'
  | 'FAILED' | 'STOPPED';

// ============ 跨进程消息 ============

/** Panel → Content：命令投递
 *  window-controller.js:142-158 */
interface CommandMessage {
  commands: string;     // 注意：字段名是复数 commands，但值是单条命令名
  target: string;
  value: string;
}

/** Panel → Content 的投递选项 */
interface SendOptions {
  frameId: number;      // top ? 0 : frameId
}

/** Content → Panel：变量回传 / 日志
 *  formatCommand.js:61-70 */
interface FormatCommandMessage {
  storeStr?: string;    // 要存的值
  storeVar?: string;    // 变量名
  echoStr?: string;     // 日志内容
}

/** Content ↔ Page：弹窗控制
 *  page/prompt.js:217-283 */
interface PromptControlMessage {
  direction: 'from-content-script' | 'from-page-script';
  command?: 'setNextPromptResult' | 'getPromptMessage'
          | 'setNextConfirmationResult' | 'getConfirmationMessage'
          | 'setNextAlertResult';
  response?: 'prompt' | 'confirm' | 'alert';
  target?: string | boolean;
  value?: string;
}

// ============ 变量表 ============

/** Content 进程内，selenium-api.js:20 */
type StoredVars = Record<string, unknown>;

/** Panel 进程内，formatCommand.js:3 */
type DeclaredVars = Record<string, unknown>;

// ============ 命令注册表 ============
// selenium-commandhandlers.js

type HandlerKind = 'action' | 'accessor' | 'assert';

interface CommandHandler {
  kind: HandlerKind;
  wait: boolean;              // AndWait 变体，selenium-commandhandlers.js:99
  haltOnFailure: boolean;     // assert=true / verify=false，:358-379
  execute(seleniumApi: unknown, command: Command): unknown;
}

type HandlerTable = Record<string, CommandHandler>;   // 629 条

// ============ 数据驱动 ============
// execute-storeCSV.js

/** 整表模式的列式结果，execute-storeCSV.js:130-148 */
interface CSVColumnarData {
  [columnName: string]: string[];
  length: number;
}

interface ExecuteResult {
  success: boolean;
  errorMessage: string;
  successMessage: string;
}

// ============ 配置 ============

interface PlaybackSettings {
  testExecution: {
    continueExecution: boolean;    // play-actions.js:1530-1552
    hideExecutionDialog: boolean;  // 同上
  };
  /** NFR-4 建议新增：统一超时 */
  timeouts?: {
    commandMs: number;      // 默认 30000，selenium-api.js:290
    pageWaitMs: number;     // 默认 30000，play-actions.js:831-933
    ipcRetryTimes: number;  // 默认 60，window-controller.js:27-31
    ipcRetryIntervalMs: number; // 默认 500
  };
  playbackDelayMs?: number; // FR-P-008，替代 $("#slider")
}
```

---

## 7. 核心流程图

### 7.1 主流程：从 Play 到收尾

```
┌─────────────────────────────────────────────────────────┐
│ 用户点击 Play（panel/js/background/playback/index.js）    │
└────────────────────────┬────────────────────────────────┘
                         ▼
              CommandFactory.createCommand('playTestCase')
                         ▼
              playTestCaseAction()            play-actions.js:158
                 ├─ sideex_log.info("Playing test case ...")   :158-176
                 └─ logStartTime()                              :172
                        └─ kar.js:518-529 打 OS / Browser 日志
                         ▼
              play()                          play-actions.js:274-281
                         ▼
        ┌────────────────────────────────────┐
        │ initializePlayingProgress()        │  重置 blockStack/labels/index
        └────────────────┬───────────────────┘
                         ▼
        ┌────────────────────────────────────┐
        │ executionLoop()   ◄──────────┐     │  play-actions.js:539-682
        └────────────────┬─────────────┼─────┘
                         │             │
                    是最后一条? ──是──► logEndTime() :547 ──► resolve
                         │否           │
                         ▼             │
                   有断点 / 暂停? ──是──► 挂起 resolve，等 resume :577-595
                         │否           │
                         ▼             │
              currentPlayingCommandIndex++    :607
                         ▼             │
              delay(滑块值)                    :630
                         ▼             │
                  isExtCommand? ──是──► ExtCommand 直发 :648 ──┤
                         │否           │                      │
                         ▼             │                      │
     doPreparation → doPrePageWait → doPageWait               │
        → doAjaxWait → doDomWait → doCommand ─────────────────┤
                      (:673-679)                              │
                                                              │
                         ┌────────────────────────────────────┘
                         │  递归 :679
                         └──► executionLoop()
                         ▼
        ┌────────────────────────────────────┐
        │ finalizePlayingProgress()          │
        └────────────────────────────────────┘
                         │
                    (任意环节抛错)
                         ▼
        ┌────────────────────────────────────┐
        │ catchPlayingError()                │  标红当前行 + 按设置决定是否继续
        └────────────────────────────────────┘
```

### 7.2 单条命令的跨进程往返

```
 Panel 进程                      │   Content Script 进程        │  Page 上下文
─────────────────────────────────┼──────────────────────────────┼──────────────
 doCommand(cmd,target,value)     │                              │
   :935-963                      │                              │
      │                          │                              │
 xlateArgument 替换 ${var}       │                              │
   formatCommand.js:5-47         │                              │
      │                          │                              │
 extCommand.sendCommand          │                              │
   window-controller.js:142      │                              │
      │                          │                              │
 retryUntilSuccess(60,500) ──────┼──► tabs.sendMessage           │
   promise-utils.js              │        │                     │
      │  ◄── 失败则 500ms 后重试 ─┼────────┘                     │
      │                          │        ▼                     │
      │                          │  doCommands()                │
      │                          │    command-receiver.js:49    │
      │                          │        │                     │
      │                          │  body.setAttribute(          │
      │                          │    "SideeXPlayingFlag")  :81 │
      │                          │        │                     │
      │                          │  ┌─────┴─────┐               │
      │                          │  ▼           ▼               │
      │                          │ 反射调用    handler 表        │
      │                          │ selenium[   getCommandHandler│
      │                          │  "do"+Cmd]   (:109-133)      │
      │                          │  (:78-79)                    │
      │                          │        │                     │
      │                          │  replaceVariables            │
      │                          │   selenium-api.js:2962       │
      │                          │        │                     │
      │                          │  真实 DOM 操作 ──────────────┼──► 页面响应
      │                          │        │                     │
      │                          │  body.removeAttribute() :100 │
      │  ◄── sendResponse ───────┼────────┘                     │
      ▼                          │                              │
 若是 storeXxx：                  │                              │
   ◄── runtime.sendMessage ──────┼─ {storeStr, storeVar}        │
 handleFormatCommand              │   commandhandlers.js:269-283│
   formatCommand.js:61-70         │                              │
      │                          │                              │
 declaredVars[var] = str          │                              │
```

### 7.3 五段等待流水线判定

```
        doPreparation (装钩子)
     selenium-api.js:419-464
              │
   ┌──────────┴──────────┬─────────────┐
   ▼                     ▼             ▼
beforeunload         XHR.open       DOM 事件
 → new_page=true   → ajax_obj.push  → domModifiedTime=now
              │
              ▼
      doPrePageWait  ── sideex_new_page = new_page ──► 有导航?
       api.js:468                                        │
              ▼                                     是 → 等新页面 Content
      doPageWait     ── sideex_page_done =                就位（靠通信重试）
       api.js:475       (readyState=="complete")
              │
        false → 重试（≤30s）
              │ true
              ▼
      doAjaxWait     ── 遍历 ajax_obj，全部 readyState==4?
       api.js:495
              │
        false → 重试（≤30s）
              │ true
              ▼
      doDomWait      ── sideex_dom_time = domModifiedTime
       api.js:530       Panel 侧比较两次采样是否变化
              │
        变化 → 重试（≤30s）
              │ 稳定
              ▼
         doCommand（执行真正的业务命令）
```

### 7.4 失败与自愈决策

```
                runCommand 执行
              play-actions.js:965
                       │
                   成功? ──是──► 返回，主循环继续
                       │否
                       ▼
              是断言失败（Assert.fail）?
                       │
        ┌──────────────┴──────────────┐
       是                             否（元素找不到 / 通信失败）
        │                              │
        ▼                              ▼
  haltOnFailure?                 隐式等待未耗尽?
 commandhandlers.js:358          play-actions.js:1320
    │        │                       │        │
 true(assert) false(verify)         是       否
    │        │                       │        │
    ▼        ▼                       ▼        ▼
  throw   记录并继续          delay 后重试   取候选定位器
    │                        同一 target    getPossibleTargetList
    │                                        (:1326)
    │                                          │
    │                                 ┌────────┴────────┐
    │                                有候选            无候选
    │                                  │                │
    │                          换 target 重试        throw
    │                                  │                │
    │                          命中 → addBrokenLocator  │
    │                                  │                │
    ▼                                  ▼                ▼
 ┌───────────────────────────────────────────────────────┐
 │  catchPlayingError（play-actions.js:274-281 的 .catch） │
 │    读 setting.testExecution.continueExecution :1530-1552│
 │      true  → 下一条用例                                  │
 │      false → 终止整个套件                                │
 └───────────────────────────────────────────────────────┘
```

---

## 8. 状态机定义

```
        ┌──────┐
        │ IDLE │◄────────────────────────────────┐
        └───┬──┘                                 │
            │ play()                             │
            ▼                                    │
     ┌──────────────┐                            │
     │ INITIALIZING │  重置 blockStack/labels/index
     └──────┬───────┘                            │
            ▼                                    │
     ┌──────────────┐   命令下发                  │
  ┌─►│   RUNNING    ├──────────┐                 │
  │  └──┬────┬──────┘          ▼                 │
  │     │    │            ┌─────────┐            │
  │     │    │ 等待页面    │ WAITING │            │
  │     │    └───────────►└────┬────┘            │
  │     │                      │ 稳定            │
  │     │◄─────────────────────┘                 │
  │     │                                        │
  │     │ pause / breakpoint                     │
  │     ▼                                        │
  │  ┌────────┐  resume                          │
  └──┤ PAUSED ├──────────┐                       │
     └───┬────┘          │                       │
         │ stop          │                       │
         ▼               │                       │
     ┌─────────┐         │                       │
     │ STOPPED ├─────────┼───────────────────────┤
     └─────────┘         │                       │
                         │                       │
     RUNNING ─── 末条 ───►┌────────────┐          │
                         │ FINALIZING ├──────────┤
                         └────────────┘          │
                                                 │
     RUNNING ─── 异常 ───►┌────────┐              │
                         │ FAILED ├──────────────┘
                         └────────┘
```

| 状态 | 进入条件 | 源码锚点 |
|---|---|---|
| `IDLE` | 初始 / 上次回放结束 | — |
| `INITIALIZING` | 调用 `play()` | `play-actions.js:274` `initializePlayingProgress` |
| `RUNNING` | 初始化完成，进入主循环 | `play-actions.js:539` |
| `WAITING` | 五段等待流水线未通过 | `play-actions.js:673-677` |
| `PAUSED` | 命中断点 或 用户点 pause | `play-actions.js:577-595` |
| `FINALIZING` | 游标到末条 | `play-actions.js:544-547` |
| `FAILED` | 任意环节抛错未被自愈拦下 | `play-actions.js:281` `.catch` |
| `STOPPED` | 用户点 stop | `CommandFactory.js` `stop` |

> **注意**：原版源码中并没有显式的状态枚举，状态是由多个布尔标志隐式表达的。本 PRD 建议在裁剪版中**显式化为枚举**，便于 UI 联动与调试。

---

## 9. 边界与异常

| # | 边界场景 | 原版行为 | 源码依据 | 建议 |
|---|---|---|---|---|
| B-1 | 命令执行中页面刷新 | `tabs.sendMessage` 抛错 → 重试 60 次 × 500ms | `window-controller.js:142-158` | 保留 |
| B-2 | 30 秒后 Content 仍未就位 | 抛字符串 `'Retry failed'` | `common/promise-utils.js` | **改抛 Error 子类**，便于分类 |
| B-3 | 目标 iframe 被销毁 | `frameId` 失效，同 B-1 路径超时 | `window-controller.js:212` | 建议 selectFrame 前校验存活 |
| B-4 | 用例为空（0 条命令） | 主循环首次判定即到末条，直接 `logEndTime` | `play-actions.js:544-547` | 保留 |
| B-5 | `endWhile` 无匹配 `while` | `blockStack` 为空时 pop → undefined | `play-actions.js:1165` | **需加校验并报「语法错误」** |
| B-6 | `while` 条件永真 | 无限循环，只能靠 stop 打断 | `play-actions.js:1154-1165` | 建议加最大迭代次数保护 |
| B-7 | `gotoLabel` 目标 label 不存在 | `labels[name]` 为 undefined | `play-actions.js:1255` | **需报错而非静默** |
| B-8 | `${undefinedVar}` | `xlateArgument` 保留原文 `${undefinedVar}` 不替换 | `formatCommand.js:5-47` | 建议加 warn 日志 |
| B-9 | 条件表达式语法错误 | 沙箱 `eval` 抛错，走 catch | `SandboxEvaluator.js:41-44` | 保留，需保证错误信息透传 |
| B-10 | `storeCsv` 行号为负 / 非数字 | 返回 `{success:false, errorMessage:"row_index must be a non-negative number"}` | `execute-storeCSV.js:11-27` | 保留（示范级校验） |
| B-11 | `storeCsv` target 逗号数不是 0 或 2 | `"Target has incorrect format!"` | `execute-storeCSV.js:66-73` | 保留 |
| B-12 | 数据文件不存在 | `"Data file does not exist!"` | `execute-storeCSV.js:175-181` | 保留 |
| B-13 | AJAX 长轮询 / SSE 常驻连接 | `ajaxWait` 永远等不到 readyState 4 → 30s 超时 | `selenium-api.js:495` | **需可关闭 ajaxWait** |
| B-14 | 页面高频 DOM 动画 | `domWait` 永远等不到静止 → 30s 超时 | `selenium-api.js:530` | 同上，需可关闭 |
| B-15 | `window.ajax_obj` 在 SPA 长会话中膨胀 | 内存持续增长 | `selenium-api.js:419-464` | **必须改造**（NFR-5） |
| B-16 | 回放动作被录制器捕获 | 靠 `SideeXPlayingFlag` 抑制 | `command-receiver.js:81/100` | 保留 |
| B-17 | 弹窗在子 frame 弹出 | 代理给 top 处理 | `page/prompt.js:56-114` | 保留 |
| B-18 | `alert` 在回放中弹出但无对应命令 | 被静默吞掉并 postMessage 上报 | `page/prompt.js:154-163` | 保留（否则会卡死） |
| B-19 | `open` 后再套 `AndWait` | 白名单已过滤（`nonWaitActions`） | `kar-loadCommand.js:5` | 保留 |
| B-20 | 用户在输入框输入大小写不一致的命令名 | `formalCommands` 小写映射兜底 | `generate-command-data-list.js:8` | 保留 |
| B-21 | `setTimeout` 命令改超时后，内部等待仍是 30s | 三套超时不联动 | `selenium-api.js:2884` vs `play-actions.js:831-933` | **需统一**（NFR-4） |
| B-22 | 万条命令用例 | Promise 递归不爆栈 | — | 保留 |
| B-23 | `debugger` 权限被用户拒绝 | 上传 / 特殊按键命令失败 | `background/kar.js:240` | 需降级提示 |

---

## 10. 验收用例

### AC-1：基础顺序执行（覆盖 FR-P-001 ~ 005）

| 步骤 | 命令 | 期望 |
|---|---|---|
| 1 | `open \| https://example.com` | 页面打开，日志出现 `Playing test case ...` |
| 2 | `type \| id=q \| hello` | 输入框值为 `hello` |
| 3 | `click \| id=submit` | 触发提交 |
| 4 | `assertTitle \| Result` | 通过 |

**通过标准**：4 条全绿，日志末尾有 `logEndTime` 输出的 `Time: ...`。

### AC-2：跨页面跳转续跑（覆盖 FR-P-018、NFR-1）

| 步骤 | 操作 | 期望 |
|---|---|---|
| 1 | 执行 `clickAndWait \| link=下一页` | 页面跳转 |
| 2 | 紧接一条 `assertText \| css=h1 \| 第二页` | **不报 `Retry failed`**，正常通过 |

**通过标准**：跳转期间 Content Script 被销毁重注入，引擎自动重试成功。

### AC-3：变量存取与替换（覆盖 FR-P-020 ~ 023）

| 步骤 | 命令 | 期望 |
|---|---|---|
| 1 | `store \| 42 \| n` | `declaredVars.n === "42"` |
| 2 | `storeText \| id=price \| p` | Content 回传，`declaredVars.p` 有值 |
| 3 | `echo \| n=${n} p=${p}` | 日志打印替换后的实际值 |
| 4 | `type \| id=input \| ${n}` | 输入框值为 `42` |

### AC-4：分支与循环（覆盖 FR-P-030 ~ 035）

```
store      | 3      | i
while      | i > 0
  echo     | loop ${i}
  storeEval| i-1    | i
endWhile
if         | i == 0
  echo     | done
else
  echo     | wrong
endIf
```

**通过标准**：日志依次出现 `loop 3`、`loop 2`、`loop 1`、`done`，且**不出现** `wrong`。

### AC-5：断言 halt 语义（覆盖 FR-P-060、061）

| 用例 | 命令序列 | 期望 |
|---|---|---|
| A | `verifyText \| id=x \| 错的` + `echo \| 后续` | 第 1 条记录失败，第 2 条**仍执行** |
| B | `assertText \| id=x \| 错的` + `echo \| 后续` | 第 1 条抛错中断，第 2 条**不执行** |

**通过标准**：失败信息包含实际值与期望值（来自 `Assert.fail(result.message)`）。

### AC-6：暂停与继续（覆盖 FR-P-009）

| 步骤 | 操作 | 期望 |
|---|---|---|
| 1 | 在第 3 条打断点，Play | 跑到第 3 条前停住，状态 `PAUSED` |
| 2 | 手工修改页面 | — |
| 3 | 点 Resume | 从第 3 条继续，**变量上下文不丢** |

### AC-7：弹窗自动应答（覆盖 FR-P-050 ~ 054）

| 步骤 | 命令 | 期望 |
|---|---|---|
| 1 | `chooseOkOnNextConfirmation` | 设置 body 属性 `setConfirm` |
| 2 | `click \| id=delete`（触发 confirm） | **不弹真窗**，自动返回 true |
| 3 | `assertConfirmation \| 确定删除?` | 断言通过 |

### AC-8：错误分类可区分（覆盖 FR-P-065）

| 场景 | 期望错误类型 |
|---|---|
| 定位器写错 | `Element not found` 类 |
| 断言值不符 | `Assert.fail` 类，含实际/期望值 |
| 页面 CSP 阻止脚本注入 | `Retry failed`（通信超时）类 |

**通过标准**：三类错误在日志中有可区分的前缀/类型标识。

### AC-9：数据驱动（覆盖 FR-P-040 ~ 044）

| 步骤 | 命令 | 期望 |
|---|---|---|
| 1 | `storeCsv \| users.csv \| tbl` | `declaredVars.tbl` 为列式对象，含 `length` |
| 2 | `echo \| ${tbl.length}` | 打印行数 |
| 3 | `storeCsv \| users.csv,0,name \| n` | `declaredVars.n` 为第 0 行 name 列 |
| 4 | `storeCsv \| users.csv,-1,name \| n` | 报 `row_index must be a non-negative number` |

### AC-10：回放不触发录制（覆盖 FR-P-090）

| 步骤 | 操作 | 期望 |
|---|---|---|
| 1 | 同时开启录制与回放 | 回放期间产生的 click/type **不被追加**到命令列表 |

**通过标准**：命令条数在回放前后一致。

### AC-11：命令派生正确性（覆盖 FR-P-011、012）

| 输入方法 | 期望自动可用的命令 |
|---|---|
| `Selenium.prototype.doFoo` | `foo`、`fooAndWait` |
| `Selenium.prototype.getBar` | `getBar`、`storeBar`、`assertBar`、`verifyBar`、`assertNotBar`、`verifyNotBar`、`waitForBar`、`waitForNotBar` |
| `Selenium.prototype.isBazPresent` | `assertBazNotPresent`、`verifyBazNotPresent`、`waitForBazNotPresent`（**不是** `assertNotBazPresent`） |

---

## 11. Out of Scope（不在本次范围）

| # | 排除项 | 原版位置 | 排除理由 |
|---|---|---|---|
| OOS-1 | **外部 Socket 回放体系**（监听 localhost:3500，供 Katalon Studio / CI 驱动） | `playback/` 整目录 7 个文件，入口 `playback/index.js:3` | 个人插件无 CI 驱动需求，且引入 socket.io 依赖 |
| OOS-2 | **CDP 文件上传** | `background/kar.js:61-81` | 需 `debugger` 高危权限 + 浏览器顶部调试黄条 |
| OOS-3 | **CDP 真实按键派发** | `background/kar.js:85-157` | 同上 |
| OOS-4 | **整页截图** | `background/kar.js:160-169` + `selenium-api.js:3229` | 非核心，可后期加 |
| OOS-5 | **罕用命令**：`doRollup` / `doUseXpathLibrary` / `doAddScript` / `doRemoveScript` / `doAddLocationStrategy` | `selenium-api.js:3485/3627/3570/3613/3188` | 实际几乎无人使用 |
| OOS-6 | **数据驱动写回**：`writeToCSV` / `appendToCSV` / `appendToJSON` | `execute-*.js` | 涉及文件系统写入，权限与体验复杂 |
| OOS-7 | **`getTable` / `getSelectOptions` 等表格与下拉批量访问器** | `selenium-api.js:1952/2105` | 低频 |
| OOS-8 | **多套件批量执行**（`playAll`） | `CommandFactory.js` | 个人使用单套件足够 |
| OOS-9 | **iedoc-core.xml 命令参考文档系统** | `kar-loadCommand.js:79-97` | 只服务 UI 帮助面板 |
| OOS-10 | **云端 / Katalon Analytics 上报** | 见 TECH-01/02 | 隐私与依赖 |
| OOS-11 | **Selenium IDE 格式导入导出** | — | 与回放引擎无关 |
| OOS-12 | **原版三处调试遗留代码** | `page/prompt.js:252` `console.error("no")` 等 | 直接删除 |

---

## 附录：需求编号总览

| 组 | 编号段 | 主题 | P0 数 | P1 数 | P2 数 |
|---|---|---|---|---|---|
| A | FR-P-001 ~ 009 | 执行调度 | 5 | 3 | 1 |
| B | FR-P-010 ~ 016 | 命令体系 | 5 | 3 | 1 |
| C | FR-P-017 ~ 019 | 跨进程通信 | 3 | 0 | 0 |
| D | FR-P-100 ~ 106 | 等待与稳定性 | 3 | 4 | 0 |
| E | FR-P-020 ~ 026 | 变量系统 | 4 | 2 | 1 |
| F | FR-P-030 ~ 037 | 流程控制 | 1 | 3 | 4 |
| G | FR-P-040 ~ 044 | 数据驱动 | 0 | 1 | 4 |
| H | FR-P-050 ~ 054 | 弹窗处理 | 0 | 5 | 0 |
| I | FR-P-060 ~ 065 | 错误处理 | 3 | 3 | 0 |
| J | FR-P-070 ~ 072 | 自愈接入 | 0 | 2 | 1 |
| K | FR-P-080 ~ 083 | 越权能力 | 0 | 0 | 4 |
| L | FR-P-090 | 录制抑制 | 1 | 0 | 0 |
| **合计** | **56 条** | | **25** | **26** | **16** |

> **MVP 建议**：先实现全部 25 条 P0 + H 组（弹窗，5 条 P1）+ FR-P-009（暂停）+ FR-P-065（错误分类），即可得到一个可日常使用的最小回放引擎。
