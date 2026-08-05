# PROMPT-04｜复刻 Katalon Recorder Panel UI 与日志面板（自包含提示词）

> 用途：把下面这段提示词直接喂给代码生成模型，让它从零产出一套最小可用的「录制脚本编辑面板 + 日志/辅助面板」。
> 风格：自包含、不依赖外部上下文；含技术约束、文件清单、验收点。
> 配套：3 个变体（V1 纯前端单页 / V2 浏览器扩展 popup / V3 React+TS）+ 1 个调试提示词。

---

## 🔷 主提示词（Self-contained）

```
你是一名资深前端架构师。请为我从零实现一套「浏览器录制脚本的编辑面板 + 日志/辅助面板」，
参考 Katalon Recorder 7.1.0 的 Panel UI 设计，但用现代化、可维护的代码重写（不要求 1:1 还原）。

【目标产物】
一个能展示「录制事件列表」并支持增删、拖拽排序、行内编辑、撤销重做，并在底部提供
Log / Screenshots / Variables / Reference / Self-healing 五个标签页的面板。

【核心数据模型】
- Command: { id, name, target, targets:string[][], value, state:'idle'|'success'|'fail'|'breakpoint' }
- TestCase: { id, name, commands: Command[], tags: string[] }
- 行 id 规则：列表项用 "row-N"（N 从 1 起），数组索引 = N-1（偏移 +1）。

【必须实现的功能】
1. 命令表格：
   - 每行三列：命令名 / 定位器(target) / 值(value)。
   - 每个单元格用「双层结构」：一个隐藏节点存真实值（含全部候选定位器），一个可见节点存截断后的展示值。
   - 新增行（末尾 / 选中行后）、删除行后，行 id 必须连续重排。
2. 拖拽排序：拖拽后必须同步更新底层 commands 数组（不要只 swap DOM），可用 SortableJS。
3. 行内编辑：点击单元格就地变成输入框（命令名用 input + 自动补全；值用 textarea，Enter 提交、Shift+Enter 换行）。
4. 撤销/重做：用 Command 模式 + 装饰器实现。维护 undo/redo 双栈（上限 100）。
   撤销机制采用「整表状态快照 + 重建」而非 diff：执行前快照 {id,name,target,value,breakpoint,selected}，
   撤销时清空再逐行重建。
5. 五个标签页（用类似 CardLayout 的显隐切换，不是浏览器 tab）：
   - Log：一个追加式日志区，API 形如 log.info()/log.error()，每条是带级别的 DOM 节点，自动滚到底；支持「保存为 HTML」「清空」。
   - Screenshots：缩略图画廊 + 「批量下载全部」。
   - Variables：渲染一个全局变量表 {name, format, value}。
   - Reference：选中命令后展示该命令的参数说明（可硬编码一张速查表，也可解析一份 XML 文档）。
   - Self-healing：展示「原定位器失效→提议新定位器」的提案列表，可勾选后「一键写回」命令表格。
6. 顶部播放控制条：Record / Play / Stop / Pause / Resume / Play Suite / Play All 按钮，
   用工厂模式 createCommand(name).execute() 分派（先输出桩即可）。
7. 页面右键加断言（扩展场景）：在 content script 监听 contextmenu，runtime.connect() 建立长连接，
   Service Worker 注册 17 项原生右键菜单（verifyText/verifyTitle/verifyValue/assertText/.../waitForNotVisible），
   用户选中后 SW 通过 port.postMessage({cmd}) 回传，content 侧 record(cmd) 落命令。

【技术约束】
- 纯前端优先用原生 JS + ES Module；若用框架请在变体中指定。
- 不依赖 jQuery UI 的旧 dialog，改用原生 <dialog> 或轻量弹窗封装一个 GenericDialog 基类。
- 所有状态变更走「改模型 → 重渲视图 → 重绑事件」三步闭环（MVC）。
- 给出清晰的文件结构、关键函数签名、以及撤销重做与拖拽重建的单元测试要点。

【交付格式】
1. 文件清单 + 各自职责；
2. 核心代码片段：Command 模型、双层 div 渲染、拖拽重建、撤销装饰器、五个标签页切换、日志类、右键 port 链路；
3. 一张「数据流图」文字描述（用户操作 → 改模型 → 重渲）；
4. 验收清单（对应上面的功能点）。
```

---

## 🔷 变体 V1：纯前端单页（无扩展，便于本地 demo）

> 在主线基础上，去掉「浏览器扩展 / content script / Service Worker」相关部分，改为一个能直接 `open index.html` 跑的单页应用。右键加断言功能用「页面内浮动菜单」模拟 17 个断言按钮替代原生 contextMenus。其余（命令表格、拖拽、撤销、五标签、日志类）完全一致。

关键差异提示词追加：
```
本变体为纯前端 demo，不引入 chrome.* / browser.* API。
- 数据用内存数组 + localStorage 做简易持久化（替代 storage.local）。
- 右键加断言：改为在 document 上监听 contextmenu，显示一个绝对定位的 17 项菜单 DIV，
  点击某项错误后用 window.prompt 取变量名（模拟 KR 的 store* 流程）。
- 顶部播放按钮输出 console.log 桩即可。
```

---

## 🔷 变体 V2：Chrome MV3 扩展 popup（最贴近 KR 原架构）

> 主线 + 扩展外壳。Panel 是一个 `chrome.windows.create({type:"popup"})` 打开的 `panel/index.html`，
> `panel/background/` 脚本与该 UI 同窗口同 `window` 运行（这是 KR 的真实架构，务必保留）。
> 真正的后台逻辑放 Service Worker（`background.js`），负责 17 项 contextMenus 与 port 桥接。

关键差异提示词追加：
```
本变体为 Chrome MV3 扩展：
- manifest.json 声明 action + background.service_worker + permissions: ["contextMenus","storage","downloads"]。
- Panel UI 在 panel/index.html（popup 窗口），其 js/background 脚本与 UI 共享 window（可直接操作 DOM）。
- Service Worker(background.js)：首个 Panel 打开时 createKrMenus() 注册 17 项菜单；
  runtime.onConnect 存 port；contextMenus.onClicked 时 port.postMessage({cmd:menuItemId})。
- content script：contextmenu 时 runtime.connect() 拿 port，挂 onMessage 监听收 cmd 并 record()。
- 存档：用 parser 把 commands 序列化为带 <datalist> 候选定位器的 HTML（扩展名 .krecorder/.html/.json）。
- 给出 manifest.json 片段与 background.js / content.js / panel 三端的最小可运行骨架。
```

---

## 🔷 变体 V3：React + TypeScript 现代化重写

> 主线功能不变，但用 React + TS 重写，把「双层 div / 行 id 重排 / 拖拽重建 / 撤销栈」改成声明式。

关键差异提示词追加：
```
本变体用 React 18 + TypeScript + Vite：
- Command/TestCase 用 TS interface（见 PRD-04 §6）。
- 命令表格用受控组件：state = TestCase；拖拽用 @dnd-kit/sortable，onDragEnd 直接 setState 重排 commands 数组。
- 撤销/重做：用 useReducer + 历史栈（past/present/future），每次 dispatch 前快照 commands。
- 五标签用条件渲染（activeTab state），替代 display:none 切换。
- 日志类改为一个 useLog hook，返回 info/error，内部维护 logs 数组并 auto-scroll。
- 输出组件树、关键 hook 签名、以及一段演示拖拽+撤销的 <Example/>。
```

---

## 🔷 调试提示词（Debug / 排错专用）

```
我在复刻「录制编辑面板 + 日志面板」时遇到下面问题，请基于【命令表格 MVC + 撤销装饰器 + 五标签】的架构帮我定位。
请先复述你对该问题的假设，再给最小修复 diff，并说明为什么。不要直接重写整个文件。

【高频坑位清单，优先排查】
1. 拖拽后底层数组没更新 / 顺序错位
   → 检查是否只 swap 了 DOM 而没重建 commands；确认行 id "row-N" 与索引 N-1 的偏移。
   → 参考：拖拽结束应清空 commands=[] 再遍历 tr 用 parseTarget 重建。
2. 撤销后选中态/断点丢失
   → 检查快照是否包含 isSelected/isBreakpoint；restore 时必须逐行重建并恢复这些标志。
3. 撤销栈在刷新页面后清空
   → 原架构 commandHistory 仅存内存；需把 past/future 序列化进 storage.local 并在启动恢复。
4. 行内编辑提交后模型和视图不一致
   → 确认 changeTd 同时写「真实值节点」与「显示值节点」，并同步 commands[index].target。
5. 页面右键菜单点了没反应
   → 确认 SW 侧 runtime.onConnect 已存 port，且 content 侧 connect 在 contextmenu 事件内完成；
      检查 menuItemId 是否原样作为 cmd 回传。
6. 五标签切换时操作按钮（保存/清空）不跟随显隐
   → setActiveTab 应同时切换容器 display 与按钮可见性。
7. Reference 选中命令后不刷新
   → 检查命令输入框的 input 事件是否触发 scrape()/刷新 Reference 容器。

【请提供】
- 你的诊断结论（哪一层出错：Model / View / Controller / 通信）；
- 关键函数的最小修复代码片段；
- 一个能验证修复的测试断言或手动步骤。
```
