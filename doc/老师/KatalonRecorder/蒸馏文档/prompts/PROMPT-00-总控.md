# PROMPT-00 · 总控提示词

> **这是整套提示词的入口。** 用它一次性搭出项目骨架，再用 PROMPT-01~07 逐模块下钻。
> 所有提示词都是**自包含**的：复制整个代码块粘给任意 AI 编码助手即可，不需要它读过本仓库。

---

## 1. 用法说明

| 你的处境 | 用哪个 | 产出 |
|---|---|---|
| 从零开始，什么都没有 | §2 **主提示词**（MVP-1 骨架） | 一个能装进 Chrome、能录能放的最小闭环，约 1500 行 |
| MVP-1 跑通了，要加 iframe / 自愈 / 存档 | §3 **阶段提示词**（MVP-2 增量） | 在既有骨架上做增量改造 |
| 已经写了一半，想检查架构对不对 | §4 **变体 A · 架构评审型** | 一份带优先级的评审报告 |
| 手上有别的录制器代码，想对齐这套架构 | §5 **变体 B · 迁移型** | 迁移方案 + 改造清单 |
| 某个模块要做深 | §6 **模块下钻路由表** | 转到 PROMPT-01~07 |
| 出了具体故障 | §7 **调试提示词 T1-T7** | 定向排查 |

**使用前请先做两件事**：
1. 读 `91-你还缺什么.md` §3，把 **D1-D11 十一道决策题**拍板；
2. 把下面提示词里 `【你的决策】` 段落按你的答案改掉。不改的话 AI 会按推荐值走。

---

## 2. 主提示词 · MVP-1 骨架生成

```
你是一名资深 Chrome 扩展工程师。请帮我从零搭建一个 Manifest V3 的浏览器操作录制/回放插件的 MVP-1 骨架。

【产品一句话】
一个装在 Chrome 里、把用户的浏览器操作翻译成可回放的语义命令表、并能导出成自动化测试代码的纯本地插件。零联网、零埋点、无账号。

【我的技术背景】
Java 出身，熟悉强类型和面向对象设计，对前端与浏览器扩展生态不熟。请在关键设计点上用 Java 概念做类比帮助我理解，但代码本身要地道的 TypeScript。

【你的决策】（可按需修改）
- 技术栈：TypeScript + Vite + @crxjs/vite-plugin，strict: true
- UI：原生 DOM + 轻量拖拽库，不引入 React
- 状态：单一 store（自写即可，不引 Redux）
- 存档格式：.krecorder（HTML 表格），MVP-1 先只做内存，接口预留
- 导出：MVP-1 不做，接口预留
- 不申请 debugger 权限

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【必须遵守的 8 条架构原则】（这些来自对一个成熟同类产品的完整逆向分析，不是我拍脑袋定的）

P1. 后台大脑放在 Panel 独立窗口，不放 Service Worker。
    用 chrome.action.onClicked → chrome.windows.create({type:"popup"}) 开出一个
    1080×630 的独立窗口，录制状态机、回放引擎、UI 全部跑在这个窗口里。
    Service Worker 只做三件事：开窗、聚焦已有窗、（可选）截图。
    理由：MV3 的 SW 空闲 30 秒被回收、没有 DOM、没有 window.prompt()。
    ⚠️ 这是整个架构最反直觉也最关键的一条，请不要"优化"成把逻辑放回 SW。

P2. 录制工作在 DOM 事件层，绝不碰 network 层。
    不申请 webRequest 权限。用户要的是"我点了登录按钮"，不是 47 条 XHR。

P3. 一次用户交互只产生一条命令。用三层收敛实现：
    (a) 白名单：只监听 click / change / select / submit / keydown 等有语义的事件；
    (b) 入口守卫：input 事件只记录"当前哪个元素在被输入"，不产命令；
        等 change 事件（失焦或回车）才落一条 type。所以敲 10 个字符只出 1 条命令；
    (c) 状态机：用 preventClick / preventType 等标志位防止同一次交互被多个 handler 重复记录。
    ⚠️ 已知坑：如果在 document_start 阶段给 document 绑 focus/blur，可能绑定失败导致
       标志位永不复位、后续命令被静默吞掉。请确保监听器绑定时机正确并加防御。

P4. 定位器必须是"多候选数组"，不能是单个字符串。
    生成时一次产出多个策略的候选并按可靠性降序排列，主定位器只是数组第一项。
    这是后续自愈能力的前提。MVP-1 可以只用第一项，但数据结构必须先留出来。

P5. 状态存在单一 store 里，绝不把 DOM 当数据源。
    （被逆向的那个产品用"双层 div 分别存 real 值和 show 值"，是它最大的技术债，
      导致排序、撤销、导出各写一套读取逻辑。请不要重蹈覆辙。）

P6. 导出用纯函数契约：(name: string, commands: TestCommand[]) => {content, extension, mimetype}
    MVP-1 不实现具体 formatter，但要把注册表和类型定义先建好。

P7. 零联网。不得有任何 fetch/XHR 指向外部域名，host_permissions 不含任何具体域名。

P8. 命令模型和消息协议必须有完整 TypeScript 类型，这两个模型是系统复杂度的全部所在。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【通信拓扑】（必须严格照做）

上行（页面 → Panel）：content script 用 chrome.runtime.sendMessage 广播，
                      Panel 侧用 sender.tab.id / sender.frameId 分流。
下行（Panel → 页面）：用 chrome.tabs.sendMessage(tabId, msg, {frameId}) 定向。
                      必须包一层重试：retryUntilSuccess(fn, maxAttempts=60, intervalMs=500)，
                      因为页面可能还没注入完 content script，会报
                      "Could not establish connection. Receiving end does not exist."
                      重试上限 30 秒。
握手：           SW 开窗后向 Panel 发一次 {selfWindowId, commWindowId}，
                      Panel 收到后记录并摘除该临时监听器。

【content script 的 world 选择】
录制器和执行器跑在 MAIN world（需要拿页面原生对象和事件）。
MAIN world 没有 chrome.* API，必须由 ISOLATED world 通过 window.postMessage 做 RPC 代理。
⚠️ 安全要求（这是被逆向产品的一个真实漏洞，务必避开）：
   - 代理握手密钥必须是随机 nonce（由 ISOLATED 侧生成，通过 DOM 属性或首帧消息下发），
     绝不能是硬编码明文常量；
   - postMessage 的 targetOrigin 不要用 "*"，接收端必须校验 event.source 和 event.origin。
   否则同页面的任意第三方脚本都能伪造消息，拿到你扩展的 chrome.storage 完整读写权。

【MAIN world 脚本注入顺序是硬约束】
RPC 代理脚本 → chrome polyfill（造出 chrome.runtime.id）→ webextension-polyfill
顺序错了 polyfill 会因为 chrome.runtime.id 为空直接抛异常。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【MVP-1 能力范围】
单标签页 · 不支持 iframe · 单一定位器 · 内存存储（不做文件读写）· 不做导出

12 条 P0 命令：
  open, click, type, select, sendKeys, pause,
  assertText, verifyText, assertTitle,
  waitForElementPresent, waitForVisible, echo

【核心数据模型】（请以此为准，不要自行改名）

interface TestCommand {
  id: string;                    // 稳定唯一 id，不要用数组下标或 DOM id
  command: string;
  target: Locator;
  value: string;
  comment?: string;
  tags?: string[];
  breakpoint?: boolean;
  disabled?: boolean;
}
interface Locator {
  value: string;                 // 形如 "xpath=//button[@id='login']"
  candidates: { value: string; strategy: string }[];   // 降序
}
interface TestCase { name: string; commands: TestCommand[]; }

【定位器生成优先级】（MVP-1 版本）
data-testid / data-test > id > name > css 唯一选择器 > 文本内容 xpath > 结构 xpath
每一级都要校验"在当前文档中唯一命中"，不唯一就降级。

【期望的目录结构】
my-recorder/
├─ manifest.json          权限只要 tabs / activeTab / storage / scripting
├─ src/
│  ├─ sw.ts               ~150 行：action.onClicked → windows.create / 聚焦 / 握手
│  ├─ shared/
│  │  ├─ types.ts         TestCommand / Locator / TestCase / 全部消息类型
│  │  ├─ messages.ts      消息常量 + 类型守卫
│  │  └─ retry.ts         retryUntilSuccess
│  ├─ content/
│  │  ├─ isolated.ts      polyfill + RPC server（nonce 生成与下发）
│  │  ├─ main-recorder.ts 事件捕获 + 定位器生成 + 上行广播
│  │  └─ main-executor.ts 接收下行命令 + findElement + 执行 + 回结果
│  └─ panel/
│     ├─ index.html       表格 + 三个按钮（Record / Play / Stop）+ 日志区
│     ├─ main.ts          入口 + 握手接收
│     ├─ store.ts         单一状态源（原则 P5）
│     ├─ recorder-backend.ts  接收上行 → 合并 → addCommand
│     ├─ player.ts        主循环 + 下发 + 收结果 + 写日志
│     ├─ table.ts         命令表格渲染与编辑
│     └─ log.ts           [info]/[error]/[debug] 分级日志
└─ vite.config.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【请输出】
1. 完整的 manifest.json，并逐条注释每个权限为什么需要；
2. 上面目录结构里每一个文件的完整代码（不要写 TODO 占位，要能直接跑）；
3. shared/types.ts 要完整，包括所有上行/下行消息的 discriminated union 类型；
4. 一段"如何加载与验证"的说明：怎么装进 Chrome、怎么验证 AC-1~AC-4；
5. 一张 ASCII 时序图，画清"用户点击页面按钮 → 表格里出现一行"的完整链路；
6. 明确列出你在实现中做了哪些与上述原则不同的取舍，以及为什么。

【硬性纪律】
- 不要引入除 Vite/@crxjs 之外的重型依赖；
- 不要用 jQuery；
- 不要为了"更简单"把后台逻辑挪回 Service Worker（违反 P1）；
- 不要把定位器退化成单个字符串（违反 P4）；
- 不要把命令数据存在 DOM 属性里（违反 P5）；
- 每个非显然的设计决策后面加一句 Java 类比。
```

---

## 3. 阶段提示词 · MVP-2 增量

> MVP-1 跑通 AC-1~AC-4 之后再用。**不要跳过 MVP-1 直接上这个。**

```
我已经有一个可运行的 MV3 录制回放插件 MVP-1 骨架（后台在 Panel 独立窗口，
上行广播 + 下行定向，单一定位器，内存存储，12 条 P0 命令）。
现在要升级到 MVP-2。请给出**增量改造方案 + 完整代码**，不要重写既有部分。

要加的六项能力，按依赖顺序：

① 多候选定位器
   录制时一次产出多策略候选数组并按可靠性降序。
   策略至少覆盖：data-testid / id / name / css / linkText / xpath:attributes /
   xpath:position / xpath:idRelative。
   每个候选都要做"当前文档唯一命中"校验，不唯一则丢弃或降级。

② iframe 支持（frameLocation 差分算法）
   每条上行消息携带 frameLocation 字符串，格式形如 "root:0:1"
   （root 开始，每级是该 frame 在父级 frames 里的索引）。
   Panel 侧维护"上一条命令的 frameLocation"，与当前条做差分：
   - 相同 → 不插入额外命令；
   - 不同 → 在本条命令之前自动插入一条 selectFrame 命令。
   回放时 selectFrame 要能把后续命令下发到正确的 frameId。

③ 多窗口支持（窗口别名表）
   Panel 侧维护 tabId → 别名 的映射：
   - 第一个/主窗口固定别名 "win_ser_local"；
   - 后续新开的窗口依次 "win_ser_1"、"win_ser_2"…
   录制时若发现命令来自新 tabId，自动插入 selectWindow <别名>。
   需要监听 chrome.tabs.onCreated / onRemoved 维护映射，onRemoved 时必须清理
   （被逆向的产品这里有 bug：数组只 push 不 splice，会内存泄漏）。

④ 命令元编程（这是投入产出比最高的一项）
   定义基础方法 doXxx(locator, value) 后，自动派生五个变体：
     assertXxx / verifyXxx / storeXxx / waitForXxx / xxxAndWait
   语义：
     assert  失败即中止整个回放
     verify  失败只记 error 继续跑
     store   把结果存进变量表
     waitFor 轮询直到成立或超时
     AndWait 执行后等待页面加载完成
   实现方式：遍历执行器原型上以 do 开头的方法，用字符串拼接批量注册 handler。
   写 1 个基础方法白送 5 个命令。

⑤ Self-healing 自愈
   回放时主定位器找不到元素 → 依次尝试 candidates 里的其余项 →
   命中则继续执行，并往"自愈记录表"里写一条 {命令id, 原定位器, 新定位器, 时间}。
   UI 上给一个 Self-healing 标签页展示这些记录，每条带 Approve 按钮，
   Approve 后把新定位器提升为主定位器。
   ⚠️ 自愈记录读写要做内存缓存，不要每条命令都去 chrome.storage 读 3-4 次。

⑥ .krecorder 存档格式（marshall / unmarshall）
   序列化成 HTML 表格，一条命令一个 <tr>，三个 <td> 分别是 command / target / value。
   多候选定位器塞进 target 单元格里的 <datalist><option>；
   tags 放在 <tr data-tags="a,b">。
   反序列化用 DOMParser 读回来。
   设计目标：这个文件用浏览器直接打开就能人眼阅读，能被 Git diff，
   并且与 Selenium IDE 的 HTML 格式保持兼容。

同时补：命令表格拖拽排序（拖完重排编号并同步 store，不要依赖 DOM 顺序当数据源）、
撤销/重做、${var} 变量插值与 Variables 面板、设置面板（超时 / 自愈开关）。

【输出要求】
1. 每一项：改动了哪些文件、新增哪些文件、核心代码；
2. frameLocation 差分和窗口别名这两块要给出完整算法实现和单元测试；
3. 元编程那块给出注册表的完整代码和一张"1 个基础方法 → 6 个可用命令"的示意；
4. 指出这六项之间的实现顺序依赖；
5. 每项给出对应的验收步骤。
```

---

## 4. 变体 A · 架构评审型

```
下面是我正在写的一个 MV3 浏览器录制回放插件的代码/结构：

<在此粘贴你的代码或目录树>

请按下列 8 条原则逐条评审，指出违反之处并给出修改方案。
每条给出「符合 / 部分符合 / 违反」的判定和证据（指到具体文件与函数）。

P1 后台大脑在 Panel 独立窗口而非 Service Worker
P2 录制在 DOM 事件层，不申请 webRequest
P3 一次交互一条命令（白名单 + 入口守卫 + 状态机三层收敛）
P4 定位器是多候选数组而非单字符串
P5 状态在单一 store，DOM 不作为数据源
P6 导出用纯函数契约，不用全局函数层叠
P7 零联网
P8 命令模型与消息协议有完整 TS 类型

额外重点检查这 6 个高危项：
a) MAIN↔ISOLATED 的 RPC 握手密钥是不是硬编码常量？postMessage 有没有校验 origin？
b) tabs/windows 的映射表有没有在 onRemoved 时清理？
c) 下行消息有没有做重试？"Receiving end does not exist" 怎么处理的？
d) manifest 里有没有指向不存在文件的 default_popup？CSP 有没有写无效关键字？
   externally_connectable.ids 是不是 ["*"]？
e) 有没有残留 chrome.extension.getBackgroundPage()（MV3 已移除）？
f) 浏览器版本探测是不是用了只取两段的正则（会把 150.0.7204 截成 150.0）？

输出格式：一张评审表（原则 / 判定 / 证据 / 修改建议 / 优先级 P0-P2），
后面附一份按优先级排序的整改清单。
```

---

## 5. 变体 B · 迁移型

```
我手上已有一个浏览器录制工具的代码（可能是 Selenium IDE 衍生版 / 自研 / MV2 老扩展）：

<在此粘贴现状描述与关键代码>

我想把它对齐到下面这套架构。请给出**迁移方案**，而不是重写。

目标架构要点：
- 后台大脑放 Panel 独立窗口（chrome.windows.create type:"popup"），SW 只做开窗与截图
- 上行 runtime.sendMessage 广播 + sender.tab.id 分流；下行 tabs.sendMessage 定向 + 重试 60×500ms
- 录制器跑 MAIN world，靠 nonce 加固的 postMessage RPC 代理访问 chrome.*
- 定位器多候选 + 自愈
- 单一 store，DOM 不作数据源
- 导出纯函数契约
- 存档 .krecorder（HTML 表格 + datalist + data-tags）

请输出：
1. 现状与目标的差异矩阵（维度 / 现状 / 目标 / 差距大小 / 迁移成本）
2. 分阶段迁移路线，每阶段结束时系统仍可运行（不允许出现"中间态跑不起来"）
3. 每阶段的回归验证清单
4. 哪些现有代码可以原样保留、哪些必须重写、哪些应当直接删除
5. 如果是 MV2 → MV3 迁移，额外列出所有已失效 API 及替代方案
   （重点：getBackgroundPage / background page / XMLHttpRequest in SW /
     persistent background / browser_action → action）
```

---

## 6. 模块下钻路由表

骨架搭好后，按需要打开对应模块提示词深挖：

| 你要做什么 | 用哪份提示词 | 配套技术依据 |
|---|---|---|
| 录制不准 / 命令冗余 / 事件识别 | `PROMPT-01-录制引擎.md` | TECH-01（2432 行，含 B1-B20 缺陷标注） |
| 定位器质量差 / 想加自愈 | `PROMPT-02-定位器与自愈.md` | TECH-02 |
| 回放不稳 / 想加命令 / 元编程 | `PROMPT-03-回放引擎.md` | TECH-03（629 handler 全量清单） |
| 表格交互 / 日志面板 / 五标签页 | `PROMPT-04-PanelUI与日志.md` | TECH-04 |
| 通信断链 / iframe / 弹框 / 兼容 | `PROMPT-05-通信与兼容层.md` | TECH-05 |
| 导出代码 / 存档格式 | `PROMPT-06-导出与存档.md` | TECH-06 |
| 设置项 / 配置持久化 | `PROMPT-07-设置面板.md` | TECH-07 |

---

## 7. 调试提示词

> 每个独立使用，把 `<>` 里的内容换成你的实际情况。

### T1 · 点了图标没反应 / 开出两个窗口

```
我的 MV3 扩展点击图标后 <没反应 / 每次都新开一个窗口而不是聚焦已有的>。
现状代码：
<粘贴 sw.ts 里 action.onClicked 与 windows.create 相关代码>

请检查这些点：
1. manifest 里是否同时声明了 default_popup？如果声明了，action.onClicked 根本不会触发
   —— 这是一个非常常见的坑，两者互斥；
2. 是否维护了"已打开的 Panel 窗口 id"，重复点击时走 chrome.windows.update({focused:true})；
3. 该 id 列表有没有在 chrome.windows.onRemoved 里清理？只 push 不 splice 会导致
   窗口关了以后再点图标去聚焦一个不存在的窗口，然后静默失败；
4. windows.create 的 type 是不是 "popup"（"normal" 会带地址栏和标签页）。
给出修复后的完整代码。
```

### T2 · Receiving end does not exist

```
我向 content script 发消息时报
"Could not establish connection. Receiving end does not exist."
场景：<描述什么时候发生：页面刚打开 / 跳转后 / iframe 里 / 一直发生>

请按这个顺序帮我排查：
1. content script 到底注入了没有？在目标页 console 里怎么验证？
2. manifest 的 matches 和 all_frames 配置对不对？iframe 需要 all_frames: true；
3. 消息发早了——页面还在加载，content script 尚未注入。
   正确做法是包一层 retryUntilSuccess(fn, 60, 500)，30 秒重试上限；
4. tabId 或 frameId 是不是过期了（页面已导航/已关闭）？
5. 目标页是不是 chrome:// 、Chrome 商店、或 PDF 查看器？这些页面不允许注入，
   必须在 UI 上明确提示用户而不是静默失败。
给出一个健壮的 sendCommand 实现，包含重试、超时、以及可注入性预检。
```

### T3 · MAIN world 里拿不到 chrome.runtime

```
我的 content script 跑在 MAIN world（world: "MAIN"），里面访问 chrome.runtime 是 undefined。

请解释 MAIN world 与 ISOLATED world 的区别（用 Java 的 ClassLoader 隔离做类比），
然后给我一套完整可用的 RPC 代理方案：
- ISOLATED 侧作为 server，持有真正的 chrome.*；
- MAIN 侧作为 client，暴露形状一致的代理对象；
- 两侧用 window.postMessage 通信，请求/响应用自增 id 配对，返回 Promise。

安全硬要求（务必满足）：
- 握手密钥必须是 ISOLATED 侧用 crypto.getRandomValues 生成的随机 nonce，
  通过 DOM 属性或首帧消息下发，绝不能硬编码明文常量；
- postMessage 不用 "*" 作为 targetOrigin；
- 接收端必须校验 event.source === window 且 event.origin 符合预期；
- 校验消息里的 nonce。

另外说明脚本注入顺序为什么重要：
RPC 代理 → chrome polyfill（造 chrome.runtime.id）→ webextension-polyfill，
顺序错了 polyfill 会因为 chrome.runtime.id 为空直接抛异常。
```

### T4 · 敲字产生一堆 type 命令

```
我在输入框里输入 "hello"，录制器产生了 5 条 type 命令（每个字符一条），
我期望只产生 1 条 value="hello" 的命令。

现状代码：
<粘贴事件监听与 record 调用部分>

请按"三层收敛"改造：
1. 白名单：只处理有语义的事件；
2. 入口守卫：input 事件只更新"当前正在输入的元素"这个指针，不产命令；
   等 change 事件（失焦或回车）时才落一条完整的 type；
3. 状态机：用标志位防止同一次交互被多个 handler 重复记录。

同时请帮我检查一个已知的高危缺陷：
如果 focus / blur 监听是在 document_start 阶段绑到 document 上的，可能绑定失败，
导致状态标志位永远不复位，后续命令被静默吞掉（表现为"录着录着就不出命令了"）。
请给出正确的绑定时机和防御性复位逻辑。

还要处理这些边界：
- 输入后不失焦直接点提交按钮（change 和 click 的先后）；
- contenteditable 元素；
- React 受控组件（value 被框架回写）；
- 输入法组合输入（compositionstart / compositionend）。
```

### T5 · iframe 里录不到 / 回放点不到

```
被测页面有 iframe，<录制时 iframe 内的操作完全录不到 / 录到了但回放时定位不到元素>。

请帮我：
1. 确认 manifest 的 content_scripts 是否配了 all_frames: true；
2. 实现 frameLocation 差分算法：
   - 每条上行消息带上当前 frame 的路径，格式 "root:0:1"
     （从 root 开始，每级是该 frame 在父级 frames 集合中的索引）；
   - 怎么在 content script 里可靠地算出这个路径（注意跨域 iframe 拿不到 parent.frames）；
   - Panel 侧与上一条命令的 frameLocation 做差分，不同则自动插入 selectFrame；
3. 回放侧：selectFrame 之后，后续命令怎么下发到正确的 frameId
   （chrome.webNavigation.getAllFrames 与 sendMessage 的 frameId 参数怎么配合）；
4. 跨域 iframe 的限制边界是什么，哪些情况必须降级并明确提示用户。
```

### T6 · 回放偶发失败 / 时序问题

```
我的回放<偶发失败 / 第一次跑失败第二次成功 / 慢机器上必挂>。
失败命令：<粘贴命令和报错>

请帮我系统性排查时序问题：
1. 命令之间有没有等待页面稳定？AndWait 系列是怎么判定"加载完成"的？
   （load 事件 / DOMContentLoaded / 网络空闲，各自的适用场景）
2. 元素存在 ≠ 可交互。有没有校验 visible / enabled / 未被遮挡 /
   不在动画中 / 不在 transition 中？
3. SPA 路由切换没有 load 事件，怎么判定"页面变了"？
4. 有没有用固定 pause 硬等？应当换成条件轮询（waitFor 语义）。
5. 重试策略：哪些失败该重试（元素暂未出现），哪些不该（断言失败）？
给出一个 waitForElementInteractable 的完整实现和推荐的默认超时值。
```

### T7 · 导出的代码跑不起来

```
我导出的测试代码 <语法错误 / 能编译但跑不通 / 中文乱码 / 定位器格式不对>。
导出结果片段：
<粘贴>

请检查：
1. 转义：target 和 value 里含引号、反斜杠、换行、Unicode 时怎么正确转义到目标语言；
2. 定位器格式转换：内部格式 "xpath=//a[@id='x']" 怎么映射到目标框架的 API
   （Playwright 的 page.locator / Selenium 的 By.xpath），
   注意 css= / id= / name= / linkText= 各前缀的分支；
3. 不支持的命令怎么处理——是跳过、还是生成注释、还是直接报错？
   建议生成带 TODO 的注释而不是静默跳过；
4. 编码：导出文件用 UTF-8，Blob 要不要带 BOM（Excel 要，代码文件不要）；
5. 文件名非法字符（\ / : * ? " < > |）的清洗。

请把 formatter 写成纯函数：
  (name: string, commands: TestCommand[]) => {content, extension, mimetype}
不要用全局函数覆盖的方式实现（那样调试时根本不知道是哪个文件改了行为）。
```
