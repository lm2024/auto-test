---
name: kr-mvp-blueprint
version: 1.0.0
description: >-
  从零搭建一个纯本地浏览器录制/回放插件（Manifest V3）的总控蓝图技能。基于对 Katalon Recorder 7.1.0
  的完整逆向蒸馏，提炼出 8 条不可动摇的架构原则（后台在 Panel 独立窗口而非 Service Worker、DOM 事件层
  而非 network 层、三层收敛保证一次交互一条命令、多候选定位器、单一 store 不以 DOM 为数据源、纯函数
  formatter 契约、零联网、类型先行）、MVP-1/2/3 三阶段分期路线、11 道必须先拍板的架构决策题、以及
  830KB 可删代码的裁剪清单。用于统筹调度 kr-recorder-engine / kr-locator-selfhealing /
  kr-playback-engine / kr-panel-ui / kr-mv3-messaging / kr-export-formatter 六个模块技能。
type: architecture-blueprint
domain: browser-extension / test-automation
source-version: Katalon Recorder 7.1.0 (Manifest V3)
related-skills:
  - kr-recorder-engine
  - kr-locator-selfhealing
  - kr-playback-engine
  - kr-panel-ui
  - kr-mv3-messaging
  - kr-export-formatter
tags:
  - katalon-recorder
  - manifest-v3
  - test-recorder
  - architecture
  - mvp-roadmap
  - code-reduction
---

# kr-mvp-blueprint · 从零搭一个录制回放插件的总控蓝图

本技能是六个模块技能的**上位调度层**。模块技能回答「这个机制怎么实现的」，本技能回答「**我到底该做什么、按什么顺序做、什么坚决不做**」。

## 何时使用

- 用户说「我想做一个自己的浏览器录制插件」「把 Katalon Recorder 裁剪成我自己的」「从零开始搭一个」。
- 用户在做架构选型：后台放哪、用什么技术栈、存档用什么格式、要不要自愈/iframe/流程控制。
- 用户已经开工但方向可能跑偏，需要架构评审。
- 用户问「先做什么后做什么」「MVP 应该包含什么」「哪些代码可以删」。
- 需要判断某个功能请求该路由到哪个模块技能时。

**不适用**：用户只是想搞懂某个具体机制（→ 直接用对应模块技能）。

## 核心事实（务必先建立的心智模型）

1. **【总钥匙】后台大脑放 Panel 独立窗口，不放 Service Worker。**
   证据：`worker_wrapper.js:1-26` 的 `importScripts` 清单里**没有** `recorder.js`、**没有** `window-controller.js`、**没有** `playback/`；而 `panel/index.html:1001-1016` 把它们全部加载了。
   理由：MV3 的 SW 空闲 30 秒被回收、没有 DOM、没有 `window.prompt()`（`storeXxx` 命令要弹输入框）。
   实现：`chrome.action.onClicked` → `chrome.windows.create({type:"popup"})`（`background/background.js:29-106`）。
   **不能用 popup 页面**——popup 失焦即销毁，而录制时用户必然要去点目标页面，popup 必挂。这是所有录制类扩展的必选架构。

2. **录制工作在 DOM 事件层，不碰 network 层。**
   KR 的 `manifest.json` permissions 里**没有 `webRequest`**。用户要的是「我点了登录按钮」这一条语义命令，不是那次点击背后的 47 条 HTTP 请求。这是"为什么显示的是我的事件而不是网络请求"的完整答案。

3. **一次交互一条命令，靠三层收敛。**
   (a) 白名单：只监听有语义的事件；(b) 入口守卫：`input` 只记「当前哪个元素在被输入」不产命令，等 `change`（失焦/回车）才落一条 `type`（`content/recorder.js:102-118`）；(c) 状态机：`preventType`/`preventClick` 标志位防重复。
   ⚠️ 已知高危缺陷：`focus`/`blur` 在 `document_start` 绑定失败会导致 `preventType` 永不复位、后续命令被**静默吞掉**（TECH-01 缺陷 B2，是全部 20 个缺陷里最严重的一个）。

4. **定位器必须是多候选数组，不能是单字符串。** 这是自愈的前提，也决定了存档格式必须装得下候选列表（`.krecorder` 的 `<datalist><option>` 设计正为此服务，`parser.js:92-131`）。MVP-1 可以只用第一项，但**数据结构必须一开始就留出来**，否则后期改造伤筋动骨。

5. **命令元编程是 KR 最聪明的设计，必抄。**
   153 个基础 `doXxx` 方法 × `assert/verify/store/waitFor/AndWait` 五种变体 → **629 个 handler**。写 1 个基础方法白送 5 个命令（详见 TECH-03）。

6. **`.krecorder` 存档格式是 KR 少数几个设计得非常漂亮的地方，必抄。**
   HTML 表格 + `<datalist>` 候选定位器 + `<tr data-tags>`，全文只有 144 行（`parser.js`，marshall `:92-131` / unmarshall `:67-84` / parseTarget `:25-31`）。它同时满足「人可读（浏览器直接打开）+ 机器可解析（DOMParser）+ 生态兼容（Selenium IDE）+ 可 Git diff」四项，JSON 做不到。

7. **两代 formatter 并存，只抄新式那代。**
   旧式是 Selenium-IDE 遗产：全局函数层叠覆盖、19 种语言、约 300 KB，调试时根本不知道是哪个文件改了 `formatCommand` 的行为。新式是纯函数契约 `newFormatters[id](name, commands) → {content, extension, mimetype}`，每个 formatter 20-230 行，互不干扰。

8. **KR 最大的技术债：把 DOM 当数据源。**
   命令表格用「双层 div 分别存 real 值和 show 值」，导致排序、撤销、导出各写一套读取逻辑。复刻时必须改成单一 store。这条是**反面教材，务必主动提醒用户**。

9. **约 40% 的文件体积可整块删除（≈ −830 KB）。**
   `common/browser-fingerprint2.js` 单文件 **277 KB**（FingerprintJS 全量库，只服务埋点）、`content-marketing/`（13 文件）、`tracking-service/`、登录/Keycloak、`katalon/`（179 文件，Object Spy）、`playback/`（7 文件，socket 引擎）、旧式 formatter 全家桶（约 300 KB）。权限从 12 项砍到 5-6 项。

10. **有一个安全缺陷绝不能跟着抄过去。**
    MAIN↔ISOLATED 的 RPC 代理用**明文硬编码密钥 `"pandoraboz"`** + `postMessage(..., "*")` + 不校验 `event.origin`。同页任意第三方脚本都能伪造消息拿到 `chrome.storage` 完整读写权。复刻必须换成随机 nonce + origin 校验。

11. **`manifest.json` 里有三个坑不能跟着抄。**
    ① `:44` 的 `default_popup` 指向不存在的目录且写在顶层——**正因为它无效，`action.onClicked` 才会触发**，谁"好心"修正它整个插件就点不开了，正确做法是删除该行；② `:42` 的 CSP 写了 `unsafe-eval; unsafe-inline;`（是关键字不是指令名，Chrome 忽略整条）；③ `:48` 的 `externally_connectable.ids: ["*"]` 任意扩展可连。

12. **`manifest.bak.json` 是整个逆向过程中最有价值的文件。**
    它保留了打包前的完整脚本清单和注入顺序（`:106-126` 对应 `bundles/content.1.bundle.js`，`:74-81` 是 MAIN world 的注入顺序硬约束），等于官方给的架构说明书。**动手前先归档它。**

## 取证锚点（架构决策时优先读这些）

| 主题 | 文件 | 关键行 |
|---|---|---|
| 后台不在 SW（第一证据） | `worker_wrapper.js` | 1-26 |
| Panel 兼后台（第二证据） | `panel/index.html` | 1001-1016 |
| 开窗架构（弹框全部秘密） | `background/background.js` | 29-106 |
| 录制上行 + 浮层过滤 | `content/recorder.js` | 102-118 |
| 窗口别名 win_ser_local | `panel/js/background/recorder.js` | 212-224 |
| frameLocation 差分（iframe） | `panel/js/background/recorder.js` | 271-293 |
| 下行 + retryUntilSuccess | `panel/js/background/window-controller.js` | 142-156 |
| `.krecorder` 存档读写 | `panel/js/UI/services/helper-service/parser.js` | 92-131 / 67-84 / 25-31 |
| 新式 formatter 契约 | `panel/js/katalon/newformatters/sample.js` | 全文 |
| 打包前脚本清单（架构说明书） | `manifest.bak.json` | 106-126 / 74-81 |
| 回放日志的浏览器信息行 | `panel/js/katalon/kar.js` | 513-529 |
| 版本号只取两段的正则 | `panel/js/katalon/bowser.js` | 274-279 |
| CDP 两用途（文件上传/按键） | `background/kar.js` | 61-80 / 111-146 |

## 工作流

1. **先亮总钥匙**：任何架构讨论的第一句就说明「后台在 Panel 独立窗口，不在 Service Worker」，并给出 `worker_wrapper.js:1-26` + `panel/index.html:1001-1016` 双证据。用户若带着「MV3 = SW 当后台」的默认假设，后面所有推理都会跑偏。

2. **逼用户先做决策，再谈实现**。有 11 道决策题必须先拍板（详见 `_distill/91-你还缺什么.md` §3）：技术栈 / 后台位置 / 文件上传 / 特殊按键 / 自愈 / 存档格式 / 导出语言数 / iframe / 流程控制 / 命令集规模 / 单人还是团队。
   每题都给**推荐答案 + 理由 + 反对意见**，不要只给选项让用户猜。推荐默认值：TypeScript+Vite / Panel 窗口 / 不做文件上传 / 合成事件 / 要自愈 / `.krecorder` / 1 种语言 / MVP-2 加 iframe / 不做流程控制 / 12 条起步 / 单人。

3. **严守分期，不允许跳级**。
   - **MVP-1（约 1500 行）**：单标签页 · 无 iframe · 12 条 P0 命令 · 单一定位器 · 内存存储。验收线是「录一段填表提交，点 Play 能重放成功」。
   - **MVP-2（约 4000 行）**：多候选定位器 → iframe 差分 → 多窗口别名 → 命令元编程 → 自愈 → `.krecorder` 存档；配套拖拽排序、撤销重做、变量系统、设置面板。
   - **MVP-3**：截图、`.side` 导入、第二种导出语言、测试套件。
   用户想在 MVP-1 阶段就加自愈/iframe/导出时，**明确劝阻**并说明理由：地基（事件收敛 + 通信链路）没夯实就加功能，后面每个 bug 都要在两层里找。

4. **Java 类比**（用户是 Java 背景，主动映射，不要等他问）：
   - Panel 兼后台 → **把整个 Spring 容器塞进 Swing 主窗口**，窗口关了容器就没了（这就是"关掉 Panel 录制状态全丢"的本质）；
   - Service Worker 30 秒回收 → **无状态 Bean / Lambda 冷启动**，绝不能存状态；
   - 上行 `runtime.sendMessage` 广播 → **JMS Topic**，订阅方靠 `sender.tab.id` 自己过滤；
   - 下行 `tabs.sendMessage(tabId,·,{frameId})` → **JMS Queue 点对点**；
   - `retryUntilSuccess(fn,60,500)` → **Spring Retry `@Retryable(maxAttempts=60, backoff=@Backoff(500))`**；
   - MAIN↔ISOLATED RPC → **RMI stub / 动态代理 `InvocationHandler`**；
   - 命令元编程（doXxx 派生 5 变体）→ **运行时反射 + 动态代理批量注册方法**；
   - 新式 formatter → **`Function<TestCase,String>`**；旧式层叠 → **模板方法 + 子类覆盖，但用全局函数实现，没有 `@Override` 检查**；
   - `.krecorder` marshall/unmarshall → **JAXB / Jackson 的 `writeValue`/`readValue`**，只是目标格式是 HTML；
   - 「DOM 当数据源」→ **把业务状态存在 JTable 的单元格里而不是 model 里**，这就是为什么它是技术债。

5. **路由到模块技能**：判断问题落点后转交——录制不准→`kr-recorder-engine`；定位器/自愈→`kr-locator-selfhealing`；回放/命令集→`kr-playback-engine`；表格/日志/标签页→`kr-panel-ui`；通信/iframe/弹框/兼容→`kr-mv3-messaging`；导出/存档→`kr-export-formatter`。转交时把已确定的架构决策一并带过去。

6. **裁剪按"零风险三步走"**，不要边抄边删：
   ① 先把 `setting.tracking` 默认改 `false`，跑一遍验证功能无损；
   ② 把所有 `trackingXxx()` 替换成空函数（保留调用点，零改动）；
   ③ 再物理删除文件与权限。
   直接删文件会因为散落各处的 import（`tracking-service` 有约 10 处 import 点）导致模块加载即报错。

7. **每个建议都要能被验证**：给出对应的验收步骤（对照 `PRD-00-产品总纲.md` §11 的 AC-1~AC-13），不要停在"应该这样做"。

8. **绝不修改被分析的扩展源码**：所有产出写进 `_distill/` 或用户自己的新项目目录。

## 配套产物

- **入口地图**：`_distill/00-架构总览.md`（五上下文速查、两条主链路时序图、打包机制、阅读路线）。
- **作战地图**：`_distill/90-裁剪清单与MVP路线.md`（🟥可删 / 🟩保留 / 🟨改写三级清单、四阶段路线、技术选型对照表、≈−830 KB 收益估算）。
- **缺口与决策**：`_distill/91-你还缺什么.md`（覆盖率盘点、7 项未确证事项、**D1-D11 决策题**、Java→Web 概念对照表）。
- **产品定义**：`_distill/prd/PRD-00-产品总纲.md`（8 条产品原则、分期功能矩阵、全局数据模型、权限清单与理由、AC-1~AC-13、风险登记册）。
- **一键搭骨架**：`_distill/prompts/PROMPT-00-总控.md`（MVP-1 主提示词 + MVP-2 增量 + 架构评审变体 + 迁移变体 + T1-T7 调试模板）。
- **模块技能**：`kr-recorder-engine` / `kr-locator-selfhealing` / `kr-playback-engine` / `kr-panel-ui` / `kr-mv3-messaging` / `kr-export-formatter`。

## 红线

- **不臆测行号**：找不到的写「未在源码中找到」，绝不编造 `路径:行号`。
- **不改动被分析的扩展源码**：只产出文档、提示词，或在用户自有项目里新建文件。
- **不得建议把录制/回放逻辑放进 Service Worker**：这是本技能第 1 条核心事实，违反它整个架构就塌了。
- **不得让定位器退化成单字符串**：哪怕 MVP-1 只用第一项，数据结构也必须是数组。
- **不得建议把命令数据存在 DOM 里**：这是 KR 的最大技术债，必须主动点名劝阻。
- **只要话题涉及 MAIN world / 跨 world 通信，必须点出 `pandoraboz` 明文密钥缺陷**并给出随机 nonce + origin 校验的正确做法。
- **不得建议"修正" `default_popup`**：`manifest.json:44` 靠无效才让 `action.onClicked` 生效，正确做法是删除该行。
- **不得默认申请 `debugger` 权限**：会让浏览器顶部常驻"正在被调试"横幅，且上架审查重点关注。只有用户明确需要文件上传或原生按键时才建议。
- **不得建议复刻旧式全局函数层叠 formatter 体系**：只用新式纯函数契约。
- **不得跳过决策题直接给实现**：D1-D11 没定就写代码，等于替用户做了他不知道的架构选择。
