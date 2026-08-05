---
name: kr-recorder-engine
description: Katalon Recorder 录制引擎（DOM 事件捕获 → 语义命令）专家。用于逆向理解、裁剪或排障浏览器插件的「把用户操作录成可回放命令」能力，覆盖事件白名单、状态机去重、frame/window 上下文、跨导航握手与对话框因果倒置。
keywords: [katalon-recorder, recorder, dom-event, capture, content-script, mv3, selectFrame, selectWindow, 录制引擎, 事件捕获, 命令去重, 跨导航]
---

# KR Recorder Engine 技能

你是一位精通 Katalon Recorder 7.1.0（MV3）**录制引擎**的架构师。
本技能帮助你**逆向理解、裁剪、排障**「用户操作 → 语义命令」这条链路，用于构建个人录制回放插件。

> **一句话回答最常见的困惑**
> "为什么录出来是 `click/type`，不是一堆网络请求？"
> 因为它**没有 `webRequest` 权限**（`manifest.json:64`），根本看不见网络层。
> 它在 **DOM 事件的 capture 阶段**工作，记录的是**原因（用户意图）**，不是**结果（HTTP 流量）**。
> 网络请求不可回放（token、时序、幂等全是坑），用户意图才可回放。

## 一、何时使用

- 需要理解「浏览器里点一下，插件是怎么变成一条 `click | id=btn | ` 的」。
- 要从 KR 裁剪出个人录制插件，需要知道哪些代码必留、哪些是死代码。
- 录制行为异常：录多了 / 录少了 / 顺序错 / 跳转后断了 / iframe 里录不准。
- 需要设计自己的「事件 → 命令」语义层（去重、合并、静音、防自录）。
- 需要处理多标签页、多 iframe、alert/confirm/prompt 这类上下文相关命令。
- **不适用**：定位器生成与 Self-Healing 自愈 → 请用 `kr-locator-selfhealing` 技能。

## 二、心智模型

```
                 ┌───────────────── Content Script（每个 frame，document_start）
用户点击 ─DOM事件─▶│  ① 白名单：只有注册过的事件类型才进来
   (capture阶段)   │  ② 入口守卫：isTrusted / Playing / preventClick / 30ms 双击 / 浮层过滤
                 │  ③ 状态机：typeLock / typeTarget / preventType 跨事件协同
                 │        ↓ 塌缩后
                 │  record(command, target[], value, insertBefore, frameLocation)
                 └────────────────┬──────────── sendMessage ───────────────┐
                                  ▼                                        │
                 ┌─────────── Panel 独立窗口（真正的"录制后台"）────────────┘
                 │  会话状态：tabId / windowId / lastFrameLocation / lastCommand
                 │  上下文差分：frameLocation LCA → selectFrame×N
                 │              窗口别名 win_ser_local/N → selectWindow / close
                 │  落库：addCommand / addCommandBeforeLastCommand（对话框前置）
                 └──────────────────────────────────────────────────────────
```

核心四点：
1. **DOM 层 ≠ 网络层**：没有 `webRequest`，所以只能也只应该记录用户意图。
2. **capture + document 委托**：抢在 `stopPropagation` 和 SPA 卸载节点之前拿到事件。
3. **塌缩靠状态机，不靠定时器**：几十个原始事件 → 1 条命令，靠的是浏览器 `change` 语义 + 模块级锁。
4. **上下文是后台算出来的**：`selectFrame` / `selectWindow` 不是用户操作，是后台对比前后状态**差分**生成的。

## 三、决策树

- 要理解"事件怎么变命令"？→ `content/recorder-handlers.js`（19 个 handler 注册点）。
- 要理解"监听怎么挂/怎么摘"？→ `content/recorder.js:121-130`（`C_` 前缀）、`:44-68` attach、`:71-83` detach。
- 要理解"命令怎么落库"？→ `panel/js/background/recorder.js:175-344`。
- 打字没录到 type？→ 先看 `input`(:82-85) 只记指针、`change`(:49-80) 才产命令；再查 **B2** preventType 死锁。
- 一次点击录了两条？→ 查 `preventClickTwice` 30ms / attach 幂等 / all_frames 重复。
- 顺序不对（对话框排在 click 后）？→ `insertBeforeLastCommand`（`recorder.js:102-118` 第 4 参）+ **B1** `-2` 越界。
- 跳转后不录了？→ 握手 `attachRecorderRequest`(`recorder-handlers.js:522-526`) ↔ `editor.js:69-74`。
- iframe 里录错？→ `getFrameLocation`(:85-100) + 后台 LCA 差分。
- 想裁剪？→ 先删 KU 双轨（`katalon/ku-recorder.js`，其 record 全注释）与全注释 handler（**B4**）。

## 四、实现清单（落地时逐项核对）

**基础设施**
- [ ] MV3 manifest：`run_at: "document_start"` + `all_frames: true`；**不要**加 `webRequest`（`manifest.json:64`）
- [ ] `addEventHandler(name, event, fn, capture)` 用 `'C_'+eventName` 编码 capture（`recorder.js:121-130`）
- [ ] `parseEventKey` 用 `/^C_/` 反解（`:35-41`）
- [ ] `attach()` 幂等：`if (this.attached) return`（`:44-47`）
- [ ] `detach()` 用**同一 capture 值**移除，否则摘不掉（`:71-83`）
- [ ] `record()` 统一出口，携带 `frameLocation`，过滤自家浮层 class（`:102-118`）
- [ ] `record()` 的 `sendMessage.catch` 里**不要** detach（KR 已注释掉，见 `:102-118` KAT-BEGIN 块）

**语义层**
- [ ] `input` 只写 `typeTarget`，不产命令（`:82-85`）
- [ ] `change` 按 tagName/type 分流 type / select / addSelection / removeSelection（`:49-80`）
- [ ] `keydown` 只处理 Enter/Tab/Esc，用 `typeLock` 与 change 互斥（`:159-248`）
- [ ] `click` 五道守卫齐全（`:89-111`）
- [ ] `select` 用 focus 快照 + change 差分，`getOptionLocator`（`:529-549`）

**上下文层**
- [ ] `getFrameLocation` 产出 `root:0:1` 形态（`:85-100`）
- [ ] 后台 LCA 差分 → `selectFrame relative=parent` / `index=N` / `relative=top`
- [ ] 窗口别名 `win_ser_local` / `win_ser_N` + 血统检查（`panel/js/background/recorder.js:152-173`）
- [ ] `isPrivilegedPage` 跳过 `chrome://` 等（`:346-352`）

**续录与特殊命令**
- [ ] 内容脚本主动报到握手（`recorder-handlers.js:522-526` ↔ `editor.js:69-74`）
- [ ] 对话框前置写入（`add-command.js:149-151`），**修掉 B1 的 `-2`**
- [ ] 回放静音 `SideeXPlayingFlag`（`command-receiver.js:81-105`）
- [ ] 右键菜单命令（可选，`background/background.js:123-226`，17 项）

**必修缺陷**
- [ ] **B1** `add-command.js:98` 的 `-2` off-by-one
- [ ] **B2** `recorder-handlers.js:135-151` focus/blur 绑定失效 → 改 document 级委托
- [ ] **B3** `inject-popup-record.js:83-99` 监听器泄漏 → 记录并移除

## 五、代码模式（关键片段）

**capture 编码进 key（挂载/摘除对称）** `recorder.js:121-130` + `:35-41`
```js
// 注册：capture=true 时 key 变成 'C_click'
let key = options ? ('C_' + eventName) : eventName;
(this.eventHandlers[key] ||= []).push(handler);

// 反解：attach/detach 都用它还原 {eventName, capture}
parseEventKey(eventKey) {
  return eventKey.match(/^C_/)
    ? { eventName: eventKey.substring(2), capture: true }
    : { eventName: eventKey, capture: false };
}
```
> 为什么必须编码？因为 `removeEventListener` 的第三参 capture 必须与 add 时一致，
> 否则**摘不掉**，导致下一次录制重复上报（D1 "录多了"的经典根因）。

**统一出口 record（带 frame 坐标 + 自家浮层过滤）** `recorder.js:102-118`
```js
record(command, target, value, insertBeforeLastCommand, actualFrameLocation) {
  if (target[0].some(e => e?.includes instanceof Function && e.includes('popupInjectionKR'))) return; // 防自录
  browser.runtime.sendMessage({
    command, target, value, insertBeforeLastCommand,
    frameLocation: actualFrameLocation ?? this.frameLocation,
  }).catch(() => { /* KR 已注释掉 self.detach()：一次失败不该永久停录 */ });
}
```

**input 与 change 的分工（合并逐字符输入的真正机制）** `recorder-handlers.js:82-85` / `:49-80`
```js
// input：只记指针，绝不产命令
Recorder.addEventHandler('type', 'input', function (event) {
  typeTarget = getEventTarget(event);
}, true);

// change：才产命令。合并靠浏览器原生 change 语义（失焦/提交才触发），源码中无任何防抖 setTimeout
Recorder.addEventHandler('type', 'change', function (event) {
  const target = getEventTarget(event);
  if (target.tagName === 'SELECT') { /* addSelection / removeSelection */ }
  else if (Recorder.inputTypes.includes(target.type)) { this.record('type', locators, target.value); }
}, true);
```

**双击折叠（30ms 窗口）** `recorder-handlers.js:89-111` 思路
```js
if (preventClickTwice) { /* 折叠为 doubleClick 或丢弃 */ return; }
preventClickTwice = true;
setTimeout(() => { preventClickTwice = false; }, 30);
```

**对话框因果倒置** `recorder.js:102-118` → `add-command.js:149-151`
```js
// 触发 confirm 的 click 已经先落库了，assertConfirmation 必须插到它前面
this.record('assertConfirmation', [[text]], '', /* insertBeforeLastCommand */ true);
```
> ⚠ KR 在 `add-command.js:98` 用 `-2` 计算插入位，多层对话框会插错位（B1）。
> 正确做法：显式保存「最后一条真实命令」的索引，再 `list.splice(idx, 0, cmd)`。

**握手续录（内容脚本主动报到）** `recorder-handlers.js:522-526` ↔ `editor.js:69-74`
```js
// 新页面 document_start：先问后台"还在录吗"
browser.runtime.sendMessage({ attachRecorderRequest: true });
// 后台应答：在录 → 下发 attachRecorder；不在录 → 忽略
```
> 方向很重要：**脚本问后台**，不是后台追着注入。后者在快速跳转时有竞态窗口。

## 六、常见坑（按危害排序）

1. **B2 静默丢数据（最严重）**：`recorder-handlers.js:135-151` 在 `document_start` 用
   `document.getElementsByTagName("input")` 取节点绑 focus/blur，此刻 DOM 为空 →
   监听器**从未绑定** → `preventType` 一旦置位永不复位 → 之后所有 `type` 被静默吞掉。
   **修法**：改成 `document` 级 capture 委托。
2. **B1 插入越界**：`add-command.js:98` 的 `-2` 偏移在多对话框场景插错位。
3. **detach 不对称**：`removeEventListener` capture 参数与 add 不一致 → 监听器残留 → 重复上报。
4. **attach 不幂等**：跨导航握手可能重复 attach，必须 `if (this.attached) return`（`:44-47`）。
5. **B3 监听器泄漏**：`inject-popup-record.js:83-99` 每次开始录制都新增 document 监听器且不移除。
6. **照抄死代码（B4）**：19 个 handler 中仅约 8 个真正产出命令，其余整段注释或不可达。
7. **搬 KU 双轨（B13）**：`katalon/ku-recorder.js` 的 record 全被注释，搬过去等于搬空壳。
8. **期待 `*AndWait`（B16）**：录制侧**不产出**任何 `*AndWait` 命令，全库中它只出现在回放/格式器。
9. **在 `input` 里产命令**：会得到 `type a` / `type ab` / `type abc` 三条噪音。
10. **忘了 `all_frames: true`**：iframe 内的操作完全录不到。
11. **在 catch 里 detach**：一次偶发 sendMessage 失败就永久停录（KR 特意注释掉了这段）。
12. **iframe 索引漂移**：`frameLocation` 依赖 `window.frames` 顺序，页面动态增删 iframe 会漂移 —— 这是**设计局限**，不是 bug。

## 七、调试手册

| 现象 | 首查位置（路径:行号） | 可能根因 |
|---|---|---|
| 一次点击录出 2~3 条 | `recorder.js:44-47`、`recorder-handlers.js:89-111` | attach 不幂等 / 30ms 双击窗口失效 / all_frames 重复上报 |
| 鼠标一动就冒命令 | handler 注册点 | 误注册了 mousemove/mouseover 等高频事件 |
| 打字没有 type 命令 | `recorder-handlers.js:82-85,49-80,135-151` | 在 input 里等命令（应等 change）/ **B2** preventType 死锁 |
| 部分点击丢失 | `recorder-handlers.js:89-111`、`command-receiver.js:81-105` | preventClick 500ms 窗口误伤 / SideeXPlayingFlag 未复位 / isTrusted 误杀 |
| 对话框断言排在 click 后 | `recorder.js:102-118`、`add-command.js:149-151,98` | 漏传 insertBeforeLastCommand / **B1** `-2` 越界 |
| 对话框命令偶尔乱序 | `prompt-injecter.js:26-74`、`page/prompt.js:56-177` | MAIN world → 扩展的 postMessage 转发是异步的 |
| 跳转后停止录制 | `recorder-handlers.js:522-526`、`editor.js:69-74` | 握手方向反了 / 会话标志被重置 / catch 里误加 detach |
| chrome:// 页面不录 | `panel/js/background/recorder.js:346-352` | isPrivilegedPage 设计如此，非 bug |
| iframe 回放找不到元素 | `recorder.js:85-100`、`panel/js/background/recorder.js:175-344` | frameLocation 未携带 / LCA 差分缺失 / 首条命令未补下钻 |
| 新标签页操作没录 | `panel/js/background/recorder.js:152-173` | onCreatedNavigationTarget 血统检查未通过 / 别名未分配 |
| 自家浮层被录进去 | `recorder.js:102-118`、`inject-popup-record.js:74-76` | 浮层元素未加可识别 class / record 未过滤 |

## 八、KR 录制引擎实现位置总表

| 能力 | 文件 | 关键行号 | 说明 |
|---|---|---|---|
| 权限边界 | `manifest.json` | 64 | 无 webRequest → 只能走 DOM 层 |
| 监听注册 | `content/recorder.js` | 121-130 | `C_` 前缀编码 capture |
| key 反解 | `content/recorder.js` | 35-41 | `/^C_/` |
| 挂载 | `content/recorder.js` | 44-68 | 幂等守卫在 45-47 |
| 摘除 | `content/recorder.js` | 71-83 | capture 必须对称 |
| frame 坐标 | `content/recorder.js` | 85-100 | 自底向上拼 `root:0:1` |
| 统一出口 | `content/recorder.js` | 102-118 | 浮层过滤 + frameLocation + 不 detach |
| change→命令 | `content/recorder-handlers.js` | 49-80 | type / addSelection / removeSelection |
| input 记指针 | `content/recorder-handlers.js` | 82-85 | 不产命令 |
| click 守卫 | `content/recorder-handlers.js` | 89-111 | 五道 |
| focus/blur（**B2**）| `content/recorder-handlers.js` | 135-151 | document_start 空集，监听器从未绑定 |
| keydown | `content/recorder-handlers.js` | 159-248 | Enter/Tab/Esc + typeLock |
| checkForm | `content/recorder-handlers.js` | 29-46 | submit vs sendKeys 决策 |
| option 定位 | `content/recorder-handlers.js` | 529-549 | getOptionLocator |
| select 差分 | `content/recorder-handlers.js` | 569-610 | focus 快照 vs change |
| 握手请求 | `content/recorder-handlers.js` | 522-526 | attachRecorderRequest |
| 回放静音 | `content/command-receiver.js` | 81-105 | SideeXPlayingFlag |
| attach/detach 入口 | `content/command-receiver.js` | 175-187 | 消息驱动 |
| 对话框转发 | `content/prompt-injecter.js` | 26-74 | postMessage 分流 |
| 对话框补丁 | `page/prompt.js` | 56-177 | alert/confirm/prompt 覆写 |
| 页面浮层（**B3**）| `content/inject-popup-record.js` | 74-76, 83-99 | Stop 按钮 / 监听器泄漏 |
| 会话总控 | `panel/js/background/recorder.js` | 1-401 | 真正的录制后台 |
| 标签激活 | `panel/js/background/recorder.js` | 33-64 | tabsOnActivated |
| 新窗口血统 | `panel/js/background/recorder.js` | 152-173 | win_ser 别名分配 |
| 命令消息处理 | `panel/js/background/recorder.js` | 175-344 | frame/window 差分 + 落库 |
| 特权页拦截 | `panel/js/background/recorder.js` | 346-352 | isPrivilegedPage |
| 录制标志 | `panel/js/background/editor.js` | 34 | flags |
| 握手应答 | `panel/js/background/editor.js` | 69-74 | 回应 attachRecorderRequest |
| 命令写表 | `panel/js/UI/view/records-grid/add-command.js` | 21-141 | addCommand |
| 前插（**B1**）| `panel/js/UI/view/records-grid/add-command.js` | 149-151, 98 | addCommandBeforeLastCommand / `-2` |
| 命令模型 | `panel/js/UI/models/test-model/test-command.js` | 4-33 | TestCommand |
| 右键菜单 | `background/background.js` | 123-226 | 17 项断言/验证 |
| 定位器 | `content/locatorBuilders.js` | 64-149 | buildAll（详见 kr-locator-selfhealing） |

## 九、Java 工程师速查类比

| 录制引擎概念 | Java 类比 |
|---|---|
| capture 阶段绑 document | Servlet `Filter` 链最前置 / AOP `@Around` 最外层 |
| 事件白名单 | `@RequestMapping` 路由表：没注册的路径压根不进来 |
| 入口守卫 if 早退 | 参数校验 + 短路 return |
| 模块级 `typeLock` | 实例字段锁 / `ThreadLocal`，忘了 `finally` 复位就死锁 |
| `record()` sendMessage | MQ Producer：只投递，不关心消费者 |
| Panel 后台会话 | 有状态 Session Bean，持有 lastCommand / lastFrameLocation |
| frameLocation LCA 差分 | 树路径求相对路径（`Path.relativize`） |
| `insertBeforeLastCommand` | `List.add(index, e)` 的补偿写入 |
| `attachRecorderRequest` | 客户端启动时向注册中心报到（服务端不主动推） |
| `SideeXPlayingFlag` | 全局熔断开关，回放期间屏蔽采集 |
| `event.isTrusted` | 请求来源校验，拒绝自己造的"内部流量" |

---

*技能完。所有 `路径:行号` 均可在 KR `7.1.0_0` 源码中核对；证据全集见 `_distill/tech/TECH-01-录制引擎.md`，需求编号见 `_distill/prd/PRD-01-录制引擎.md`，提示词见 `_distill/prompts/PROMPT-01-录制引擎.md`。找不到的事实一律标注「未在源码中找到」。*
