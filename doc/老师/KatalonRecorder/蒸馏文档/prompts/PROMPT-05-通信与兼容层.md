# PROMPT-05 · 跨进程通信总线 / 浏览器兼容层 / 弹框机制（提示词包）

> 用途：把 KR 7.1.0 的 MV3 通信基础设施反向讲给 LLM，辅助「裁剪个人录制回放插件」或「排查消息发不出去」。
> 纪律：所有结论必须带 `路径:行号`，禁止臆测；拓扑以 `worker_wrapper.js` 的 importScripts 清单与 `panel/index.html` 的 script 标签为准。

---

## 一、用法说明

本文件包含：
1. **主提示词（自包含，可直接粘贴）**：让 LLM 扮演 MV3 架构师，产出通信层 + 兼容层 + 弹框机制的裁剪方案。
2. **变体 A**：偏「代码生成」（直接产出一套 MV3 通信层骨架）。
3. **变体 B**：偏「问题诊断」（排查消息发不到 content script / MAIN world 拿不到 `chrome.runtime`）。
4. **调试提示词 T1-T5**：针对常见故障的定向追问模板。

粘贴时请替换 `{{SRC_DIR}}` 为你的源码根目录（默认 `7.1.0_0`）。

---

## 二、主提示词（自包含，可直接粘贴）

```
你是一位资深浏览器扩展架构师 + 技术文档作者。我要把 Chrome 扩展 Katalon Recorder 7.1.0（MV3）
的跨进程通信总线、浏览器兼容层、弹框机制，逆向裁剪成一个纯本地的个人录制回放插件。

【源码目录】{{SRC_DIR}}

【必读文件】
- worker_wrapper.js                              （SW 到底装了哪 22 个文件——判断"后台在哪"的第一证据）
- panel/index.html                               （:1001-1016 加载 js/background/* ——第二证据）
- background/background.js                       （开窗、握手、右键菜单、Port、保活）
- background/kar.js                              （窗口尺寸、截图、CDP、外部能力注册）
- background/install.js                          （安装引导、open-panel/focus-panel 字符串消息）
- panel/js/background/editor.js                  （握手接收 + 录制控制下行）
- panel/js/background/recorder.js                （上行接收、窗口别名、frameLocation 差分）
- panel/js/background/window-controller.js       （下行 sendCommand + retryUntilSuccess）
- content/recorder.js                            （上行发送、frameLocation 上报、浮层过滤）
- content/command-receiver.js                    （下行统一入口 doCommands）
- content/inject-popup-record.js                 （页面内录制浮层）
- common/chrome-polyfill-server.js / chrome-polyfill.js  （MAIN↔ISOLATED RPC 两端，各不足 20 行）
- common/remote-object-helper-content.js / -page.js      （RPC 传输层打包产物，含明文密钥）
- common/offscreen-server.js / common/offscreen.js       （Offscreen，仅埋点）
- panel/sandbox.js + panel/js/UI/services/helper-service/SandboxEvaluator.js （合规 eval）
- panel/js/katalon/bowser.js + panel/js/katalon/kar.js   （版本探测与日志）
- common/browser-polyfill*.js（三份）、common/get-browser-name*.js（两份同名实现）
- manifest.json 与 manifest.bak.json             （对照看 CSP 与 MAIN world 注入顺序）

【硬性纪律】
1. 禁止臆测：每个结论必须带 `文件路径:行号` + 片段；找不到写「未在源码中找到」。
2. 拓扑判断以 importScripts 清单与 script 标签为准，不以文件名/目录名猜测。
3. 安全缺陷必须点名，不得美化。
4. 全部简体中文。

【关键事实（已核实，可直接引用）】
A. 后台不在 Service Worker，在 Panel 窗口。worker_wrapper.js:1-26 只 import 22 个文件，
   其中【没有】recorder.js、【没有】window-controller.js、【没有】playback/；
   而 panel/index.html:1001-1016 用 <script type="module"> 加载了
   js/background/window-controller.js、js/background/recorder.js、js/background/playback/index.js。
   => 整套 MV2 background page 逻辑被物理搬进 Panel 窗口，Panel 自己就是背景页，
      所以它根本不需要"绕过 getBackgroundPage()"。

B. 握手是全生命周期唯一一次 SW→Panel 定向消息。
   发：background/background.js:92-98 → tabs.sendMessage(panelTab, {selfWindowId, commWindowId})
   收：panel/js/background/editor.js:79-88，处理完立刻 removeListener(自己)。
   selfWindowId = Panel 自己窗口 id（storeXxx 弹 prompt 时抢焦点）；
   commWindowId = 被录制/回放的目标窗口 id（所有操作的作用域）。

C. 上行广播 + sender 分流。content/recorder.js:102-118 用 runtime.sendMessage 发
   {command,target,value,insertBeforeLastCommand,frameLocation}（不带 tabId，是广播）；
   Panel 在 panel/js/background/recorder.js:362-372 的 attach() 里注册
   runtime.onMessage.addListener(addCommandMessageHandler)，靠 sender.tab.id / sender.frameId 分流。

D. 窗口别名表。panel/js/background/recorder.js:212-224：第一个被录的 tab 固定叫 "win_ser_local"，
   同时若命令表为空则自动补 addCommandAuto("open",[[sender.tab.url]],"")。
   这就是脚本里 `selectWindow | win_ser_local` 的来源。

E. frameLocation 差分算法。panel/js/background/recorder.js:271-293：
   把 "root:0:1" 与 "root:2" 按 ':' 切段比长度，
   old 更长 → 循环 addCommandAuto("selectFrame",[["relative=parent"]])；
   new 更长 → 循环 addCommandAuto("selectFrame",[["index="+level]])。
   frameLocation 由 content 构造时主动上报一次（content/recorder.js:26-31），
   Panel 侧 window-controller.js:45-49 用 setFrame(sender.tab.id, loc, sender.frameId) 记录。

F. 下行定向 + 有界重试。panel/js/background/window-controller.js:142-156：
   retryUntilSuccess(async () => {
     const tab = await browser.tabs.get(tabId);
     if (!tab || tab.status !== 'complete') throw new Error('The target tab is not ready');
     return browser.tabs.sendMessage(tabId, {commands, target, value}, {frameId: top ? 0 : frameId});
   }, 60, 500)
   => 60 次 × 500ms = 30 秒上限，这是解决 "Could not establish connection.
      Receiving end does not exist." 的实用组合（页面加载中 content script 尚未注入）。
   注意上行字段叫 command（单数），下行字段叫 commands（复数），别写反。
   Content 侧总入口：content/command-receiver.js:49-77，把 commands 首字母大写后
   映射到 selenium["do"+Upper]。

G. 部分消息 Content 直连 SW，不经 Panel（因为需要扩展进程权限）：
   截图 content/command-receiver.js:68 → background/kar.js:159-169（tabs.captureVisibleTab）；
   CDP 上传/按键/探测 → background/kar.js:174-192 / :61-80 / :111-146 / :324-330。

H. MAIN world 没有 chrome.*，靠自研 RPC 代理补齐。
   Server（ISOLATED，manifest.json:16 第三个脚本）common/chrome-polyfill-server.js:1-9 全文：
     document.documentElement.setAttribute('katalonExtensionId', chrome.runtime.id);
     transportServer.addConnectionListener(c => RemoteObjectHelper.attachToServer(chrome, c, 'chrome'));
   Client（MAIN）common/chrome-polyfill.js:1-15 全文：读回 katalonExtensionId 拼出 myChrome，
     再把 chromeProxy.runtime / .storage / .extension 挂回 chrome。

I. 【P0 安全缺陷】RPC 传输层 common/remote-object-helper-content.js 与 -page.js
   （md5 完全相同 282bf197618d582fe0198a40d352d4b0，97155 字节打包产物）：
     constructor(s = "pandoraboz") { this.secretKey = s }
     pureConnect() { postMessage({source:this.id, type:"connect", key:this.secretKey}, "*") }
     verifyRawMessage(s) { return s.data?.source !== this.id && s.data?.type === "message"
                                  && s.data?.key === this.secretKey }
   => 明文固定密钥 + targetOrigin "*" + 不校验 event.origin。
      同页任意第三方脚本发一帧 {type:"connect", key:"pandoraboz"} 即可拿到
      chrome.storage 的完整读写代理。复刻必须换 crypto.randomUUID() 随机 nonce
      + 精确 targetOrigin + 接收侧校验 event.origin 与 event.source。

J. MAIN world 注入顺序是硬约束（manifest.bak.json:74-81）：
   content/myKRIsolatedWindow.js（最终包中不存在，已打进 bundle 头部）
   → common/remote-object-helper-page.js
   → common/chrome-polyfill.js
   → common/browser-polyfill-page.js
   → content/prompt-injecter.js → content/runScript-injecter.js
   必须先 chrome-polyfill 补出 chrome.runtime.id，否则 browser-polyfill 会直接
   throw new Error("This script should only be loaded in a browser extension.")。

K. 版本探测。日志 "[info] Browser: Chrome Version: 150.0" 出自
   panel/js/katalon/kar.js:513-529 的 logStartTime()，值取 bowser.name / bowser.version；
   截断根因 panel/js/katalon/bowser.js:274-279 的正则 (\d+(\.\d+)?) 只捕两段，
   所以 150.0.7204.100 → "150.0"。Edge 必须先于 Chrome 判定（:159-164，Edge UA 也含 Chrome/）。
   bowser 在 :457 模块加载即执行，无惰性求值。三份物理副本：content/bowser.js（SW）、
   katalon/bowser.js（Object Spy）、panel/js/katalon/bowser.js（Panel）。

L. 弹框靠 bug 工作。manifest.json:44 的 "default_popup": "popup-browser/index.html"
   ①写在 manifest 顶层（MV3 规范要求 action.default_popup），Chrome 视为未知键忽略；
   ②popup-browser/ 目录根本不存在。正因为它无效，action.onClicked 才会触发。
   真正实现 background/background.js:29-106 + :852：
     master[contentWindowId] 存在 → windows.update 只聚焦；
     clickEnabled 1 秒节流防双击开两窗；
     getWindowSize 读 storage.local.window（缺省 1080×630，background/kar.js:1-20）；
     windows.create({url:"panel/index.html", type:"popup"})；
     轮询 tabs.query({status:"complete"}) 500ms×100 等 ready；
     首个 Panel 时 createKrMenus() 建 17 条右键菜单；
     最后发握手。关窗清理见 :110-120。
   尺寸写回：panel/js/katalon/kar.js:51-59 的 $(window).on("resize")。

M. 右键菜单走长连接 Port（background/background.js:228-235）：
     var port;
     contextMenus.onClicked → port.postMessage({cmd: info.menuItemId});
     runtime.onConnect → port = m;
   缺陷：单变量、无判空、多 Panel 互相覆盖。改 Map<windowId, Port> + onDisconnect 清理。
   17 条菜单 id 见 background/background.js:123-226。
   SW 保活：background/background.js:237-239，setInterval(getPlatformInfo, 20e3)。

N. MV2→MV3 四处遗留（重要教训，迁移时全局搜这四类）：
   ① panel/js/background/window-controller.js:326-331 用 runtime.getBackgroundPage()，
      MV3 已移除，必然 reject 且【无 .catch】→ SW 侧 master 映射在"回放时新建窗口"
      路径下永不更新（表现：该窗口点图标会再开一个 Panel）。
   ② katalon/background.js:138-179 在 SW 里 new XMLHttpRequest()（SW 中为 undefined），
      所幸唯一调用者已注释（:192-193），实际走 WebSocket（:210-215）。
   ③ manifest.json:44 default_popup 死配置（见 L）。
   ④ CSP 被构建期误改：manifest.bak.json:48-50 是正确的
      "script-src 'self'; object-src 'self'"，manifest.json:41-43 变成
      "script-src 'self'; object-src 'self'; unsafe-eval; unsafe-inline;"
      —— unsafe-eval/unsafe-inline 是【关键字】不是【指令名】，Chrome 直接忽略整条。
   另：common/get-browser-name.js:43-60 里 isChrome 分支先于 isEdgeChromium 返回，
   Edge Chromium 永远被判成 "Chrome"，isEdgeChromium 是死代码；
   SW 版同名函数 common/get-browser-name-background.js:1-4 转发到 offscreen，
   两个同名函数靠"谁 import"决定语义，是很脆的隐式多态。

【可整块裁剪（个人插件不需要）】
- Offscreen 仅服务埋点：common/offscreen-server.js:21-42,:44-52 + common/offscreen.js:1-29
  只做 get-browser-name 与 get-fingerprint-visitor，删掉并去掉 offscreen 权限。
- CDP 只在两处不可替代（DOM.setFileInputFiles、Input.dispatchKeyEvent），
  debugger 权限会常驻"正在被调试"横幅，非必要不申请。
- externally_connectable（manifest.json:46-50，ids:["*"] 任意扩展可连）
  + 能力注册 background/kar.js:267-308 + 2 分钟 ping 淘汰 :310-322。
- Object Spy 通道 katalon/background.js:84,105,288,319 与端口分叉 katalon/chrome_common.js:18。

【值得直接抄】
- panel/sandbox.js:28-54 的 EvalScope「单 promise 队列」：input/output 两个 deferred 交替，
  do...while(true) 死循环消费；宿主封装见
  panel/js/UI/services/helper-service/SandboxEvaluator.js:23-50（隐藏 iframe + message 回调）。
- 页面浮层三要素：全 !important 样式 + z-index:99999999（content/inject-popup-record.js:19-38）
  + trustedPolicy.createHTML 兼容 Trusted Types（:48-76）
  + 录制时过滤自身（content/recorder.js:104 判 target 含 'popupInjectionKR'）。

【任务：请输出】
1. 一张「五上下文能力矩阵」表：SW / Panel / ISOLATED / MAIN / Offscreen，
   每行列出：是否有 DOM、是否有 chrome.*、生命周期、本项目承担的职责、证据行号。
2. 一张「消息 Schema 清单」表：消息首字段 / 方向 / 发送方行号 / 接收方行号 / 语义，
   并显式标注上行 command（单数）与下行 commands（复数）这个易错点。
3. 用一个 3 层 iframe 的真实场景，推演 frameLocation 差分算法 2 遍
   （root:0:1 → root:0 与 root:0:1 → root:2），给出自动插入的 selectFrame 序列。
4. 一份「MV3 迁移排雷 checklist」：至少覆盖 getBackgroundPage / XMLHttpRequest /
   chrome.extension.* / default_popup / CSP 关键字 / SW 内存状态 六项，每项给源码行号 + 修法。
5. 一份「安全整改清单」：pandoraboz 明文密钥、postMessage("*") 不校验 origin、
   externally_connectable ids:["*"]、CSP unsafe-eval、host_permissions 冗余，
   每项给出「原状 → 风险 → 复刻正确做法」三段。
6. 一段 ≤200 行的最小 MV3 通信层骨架（SW 权限桩 + Panel 后台 + 上行/下行 + retryUntilSuccess），
   每个函数上方一行注释标明对应源码 路径:行号。
```

---

## 三、变体 A · 代码生成型（直接产出 MV3 通信层骨架）

```
基于上述关键事实 A–N，请【只产出代码】，不要解释。产出一套 MV3 通信层骨架，包含 5 个文件：

1. `src/sw/index.js` —— Service Worker 权限桩（对照 worker_wrapper.js:1-26 的"只留 22 个文件"思路）
   - openPanel(tab)：master 映射查重 + 1 秒节流 + getWindowSize 读 storage.local.window
     + windows.create({type:"popup"}) + 握手 sendMessage({selfWindowId, commWindowId})
     （对照 background/background.js:29-106、:852、background/kar.js:1-20）
   - 【改进点1】master 改存 chrome.storage.session，不用内存变量（原版 background.js:18）
   - 【改进点2】等 Panel ready 改为监听 {panelReady:true}，删掉 500ms×100 轮询
     （原版 background.js:29-106 分支④）
   - windows.onRemoved 清理 master 与 popupWindowIDs（原版 :110-120 只清 master）
   - contextMenus Port 用 Map<windowId, Port> + onDisconnect 删除（原版缺陷 :228-235）
   - 截图请求 handler（对照 background/kar.js:159-169）
   - 不申请 debugger / offscreen 权限

2. `src/panel/bus.js` —— Panel 侧总线（Panel 兼后台，对照 panel/index.html:1001-1016）
   - onHandshake(cb)：收到 {selfWindowId, commWindowId} 后 removeListener（对照 editor.js:79-88）
   - onRecordMessage(cb)：runtime.onMessage 广播接收 + sender.tab.id / sender.frameId 分流
     （对照 panel/js/background/recorder.js:362-372）
   - sendCommand(tabId, frameId, {commands, target, value})：
     tabs.get 校验 status==='complete' + retryUntilSuccess(fn, 60, 500)
     （对照 window-controller.js:142-156）
   - retryUntilSuccess(fn, times, intervalMs) 的完整实现
   - 【改进点】tabs.get 抛 "No tab with id" 时立即终止，不再重试 60 次

3. `src/panel/frame-diff.js` —— frameLocation 差分（对照 recorder.js:271-293）
   - diffFrameLocation(oldLoc, newLoc): string[]  返回要插入的 selectFrame 命令数组
   - allocWindowAlias(tabId, table): "win_ser_local" | "win_ser_N"（对照 recorder.js:212-224）

4. `src/content/receiver.js` —— ISOLATED 侧下行入口（对照 command-receiver.js:49-77）
   - runtime.onMessage → request.commands 首字母大写 → 分发到 handlers["do"+Upper]
   - 特判 waitPreparation / prePageWait / captureEntirePageScreenshot（转发 SW）

5. `src/bridge/rpc.js` —— MAIN↔ISOLATED RPC（对照 chrome-polyfill-server.js:1-9 /
   chrome-polyfill.js:1-15 / remote-object-helper-*.js）
   - 【必须】密钥用 crypto.randomUUID() 在 ISOLATED 侧生成，写到 documentElement 属性
     供 MAIN 侧读取，替换原版硬编码 "pandoraboz"
   - 【必须】postMessage 用精确 targetOrigin（location.origin），
     接收侧校验 event.origin === location.origin && event.source === window
   - 帧格式沿用 {source, type:'connect'|'message', key, message:{id, type:REQUEST|RESPONSE, data}}
   - 防自回环：source !== this.id

要求：
- 每个函数上方一行注释标明对应源码 `路径:行号`；对原版的改进用 `// 【改进】原版 xxx:行号 的问题是…` 标注。
- 禁止臆测，未找到的写「未在源码中找到」。
- 不引入任何第三方依赖，不写 TypeScript，用原生 ESM。
```

---

## 四、变体 B · 问题诊断型（消息发不出去 / MAIN world 拿不到 chrome.runtime）

```
我的 MV3 录制插件出现通信故障，请按以下决策树逐项核对，并给出最可能的 1 个根因。

【症状一：Panel → Content 报 "Could not establish connection. Receiving end does not exist."】
1. content script 是否真的注入了该页面？特权页（chrome://、Chrome Web Store、
   moz-extension://）永远注不进 —— 对照特权页判定 panel/js/background/recorder.js:346-352。
2. 是否在页面 status !== 'complete' 时就发消息？
   对照 window-controller.js:142-156 的 tabs.get + status 校验前置。
3. 是否包了重试？KR 用 retryUntilSuccess(fn, 60, 500) = 30 秒上限（window-controller.js:142-156）。
4. frameId 传对了吗？主框架必须传 0；子框架要用 sender.frameId 记录的值
   （来源 window-controller.js:45-49 的 setFrame(tabId, loc, frameId)）。
5. tabId 是不是已关闭的 tab？（原版会白白重试 60 次）
6. manifest 的 content_scripts.matches / host_permissions 是否覆盖该域名？

【症状二：Content → Panel 的录制消息 Panel 收不到】
7. Panel 是否已 attach 监听？对照 panel/js/background/recorder.js:362-372 的 attach()，
   注意里面有 this.attached 幂等守卫，重复 attach 会被静默跳过。
8. 上行是广播（runtime.sendMessage，无 tabId），Panel 必须用 runtime.onMessage 收，
   不能用 tabs.onMessage —— 对照 content/recorder.js:102-118。
9. 字段名写反了吗？上行是 command（单数），下行是 commands（复数）
   （content/recorder.js:105 vs window-controller.js:150）。
10. Panel 窗口关了吗？Panel 就是后台（worker_wrapper.js:1-26 里没有 recorder.js），
    Panel 一关，录制链路直接断，SW 收不到也处理不了。
11. .catch 是不是空实现把错误吞了？原版 content/recorder.js:114 与 :26-31 都是静默吞错。

【症状三：MAIN world 里 chrome.runtime 是 undefined / 脚本直接 throw】
12. 注入顺序对吗？硬约束是 remote-object-helper-page → chrome-polyfill →
    browser-polyfill-page（manifest.bak.json:74-81）。
13. 顺序错时的确切报错：
    "This script should only be loaded in a browser extension."
    —— 因为 browser-polyfill 校验 chrome.runtime.id 为空即 throw。
14. ISOLATED 侧的 server 注入了吗？chrome-polyfill-server.js:1-9 负责把
    chrome.runtime.id 写到 documentElement 的 katalonExtensionId 属性，
    MAIN 侧 chrome-polyfill.js:1-15 靠读这个属性才能拼出 runtime.id。
15. RPC 握手成功了吗？帧是 {source, type:"connect", key}，
    校验函数 verifyRawMessage 只认 type==="message" 且 key 相等且 source !== 自己。
16. 如果你已经把密钥改成随机 nonce（应该改，见下），两端 nonce 是否同源同一份？

【症状四：点扩展图标没反应 / 开出两个窗口】
17. 是否误把 default_popup 修正到 action 内？原版 manifest.json:44 写在顶层且目录不存在，
    正因为它【无效】，action.onClicked 才会触发。修"对"了反而整个插件点不开。
18. 双击开两窗 → 缺 clickEnabled 1 秒节流（background/background.js:29-106 分支②）。
19. 同窗口重复开 Panel → master 映射丢了。SW 被回收后内存变量清零
    （原版 background.js:18），必须改 chrome.storage.session。
20. 回放中新建窗口后点图标又开一个 Panel → 根因是
    window-controller.js:326-331 的 getBackgroundPage() 在 MV3 必然 reject 且无 .catch。

请输出：
- 一棵「排查决策树」（症状 → 分支 → 结论），每个节点标注对应 `路径:行号`；
- 每种症状给出最可能的 1 个根因与最小验证方法（一行 console 命令或一段 5 行代码）。
```

---

## 五、调试提示词（T1-T5 定向故障模板）

**T1 · 上行消息 Panel 收不到**

```
我的 content script 调 runtime.sendMessage 发录制命令，Panel 侧一条都收不到。请检查：
- Panel 的 attach() 是否被调用过？注意 panel/js/background/recorder.js:362-372 里
  有 `if (this.attached) return;` 幂等守卫，第二次 attach 会静默跳过。
- 监听器注册的是 runtime.onMessage 而不是别的吗？（同上 :368 那行 addCommandMessageHandler）
- 消息字段是不是 command（单数）？下行才叫 commands（复数）
  （content/recorder.js:105 vs panel/js/background/window-controller.js:150）。
- .catch 是不是空实现吞掉了真实错误？（content/recorder.js:114 原版就是静默 Failed silently）
- Panel 窗口是不是被关了？Panel 兼任后台，关掉即断链（worker_wrapper.js:1-26 无 recorder.js）。
输出：3 个最可能根因 + 每个的一行验证代码。
```

**T2 · Receiving end does not exist**

```
回放时报 "Could not establish connection. Receiving end does not exist."。请检查：
- 有没有在 tab.status !== 'complete' 时就发消息？（window-controller.js:142-156 有前置校验）
- 有没有包 retryUntilSuccess(fn, 60, 500)？KR 靠这个 30 秒窗口熬过 content script 注入延迟。
- frameId 是否传错？top 时必须传 0（window-controller.js:142-156 的 `{frameId: top ? 0 : frameId}`）。
- 目标页是不是特权页（chrome://、Web Store）？永远注不进，重试 60 次也没用
  （特权页判定参考 panel/js/background/recorder.js:346-352）。
输出：一段带"tab 已关闭立即终止、注入失败才重试"的改良版 retryUntilSuccess 实现。
```

**T3 · MAIN world 拿不到 chrome.runtime**

```
MAIN world 脚本里 chrome.runtime 是 undefined，或者直接抛
"This script should only be loaded in a browser extension."。请检查：
- 注入顺序：remote-object-helper-page → chrome-polyfill → browser-polyfill-page
  （硬约束，manifest.bak.json:74-81）。顺序错了 polyfill 会因 chrome.runtime.id 为空 throw。
- ISOLATED 侧 server 有没有注入？common/chrome-polyfill-server.js:1-9 负责
  setAttribute('katalonExtensionId', chrome.runtime.id)。
- MAIN 侧有没有读回来？common/chrome-polyfill.js:1-15 从 documentElement 读该属性拼 myChrome。
- RPC 连接是否建立？握手帧 {source, type:"connect", key}，
  校验逻辑 verifyRawMessage 见 remote-object-helper-*.js。
输出：一份 4 步注入顺序自检脚本（在页面 console 中逐步验证 attribute → runtime.id → proxy）。
```

**T4 · RPC 通道的安全整改**

```
我要复刻 MAIN↔ISOLATED 的 chrome.* RPC 代理，但原版有严重安全缺陷。请给出整改方案：
- 原状：constructor(s = "pandoraboz") 硬编码明文密钥；postMessage(payload, "*") 不限 origin；
  verifyRawMessage 只判 source !== this.id && type === "message" && key 相等
  （common/remote-object-helper-content.js / -page.js，两份 md5 相同 282bf197618d582fe0198a40d352d4b0）。
- 风险：被测页面里任意第三方脚本发一帧 {type:"connect", key:"pandoraboz"} 即可建立连接，
  随后获得 chrome.storage 的完整读写代理（含用户的测试脚本、设置、可能的凭据）。
输出：
1. 用 crypto.randomUUID() 生成 per-page nonce 并通过 documentElement 属性传递的完整代码
   （参考 chrome-polyfill-server.js:1-9 的传递方式）；
2. 收发两侧的 origin/source 双向校验代码；
3. 一段攻击复现脚本（用于回归测试，验证整改后无法建立连接）。
```

**T5 · 点图标弹窗行为异常**

```
我的插件点扩展图标要么没反应、要么开出两个窗口、要么同一浏览器窗口反复开 Panel。请检查：
- default_popup 是否被"修正"进了 action？原版 manifest.json:44 写在顶层且
  popup-browser/ 目录不存在，正因为无效，action.onClicked 才会触发 —— 改"对"了反而点不开。
  正确做法是直接删掉这一行，只用 action.onClicked + windows.create({type:"popup"})
  （background/background.js:29-106、:852）。
- 双击开两窗 → 缺 1 秒节流 clickEnabled（同上，分支②）。
- 同窗口重复开 → master[contentWindowId] 映射丢失。SW 被回收后内存变量清零
  （background/background.js:18），改 chrome.storage.session。
- 关窗后残留 → popupWindowIDs 只 push 不 splice（:110-120 只清了 master），
  focusPanel() 对已关闭窗口调 windows.update 会抛未捕获 rejection。
- 尺寸没记住 → 写在 panel/js/katalon/kar.js:51-59 的 resize 事件，
  读在 background/kar.js:1-20（缺省 1080×630），两边 key 必须都是 storage.local.window。
输出：一份「弹框状态机」伪代码（含 storage.session 持久化与 panelReady 主动通知），
替换原版 500ms×100 轮询（background/background.js:29-106 分支④）。
```

---

*提示词包完。所有引用均可在 `7.1.0_0` 按 路径:行号 核对；完整机制见 `_distill/tech/TECH-05-通信兼容与弹框.md`。*
