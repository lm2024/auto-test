# PROMPT-07 · 设置面板 / 配置系统（提示词包）

> 用途：把 KR 7.1.0 的 `setting-panel/` 配置系统反向讲给 LLM，辅助「裁剪纯本地个人录制回放插件」或「排查设置改了不生效 / 两窗口不同步 / 升级后配置丢失」。
> 纪律：所有结论必须带 `路径:行号`，禁止臆测；入口以 `panel/js/katalon/kar.js` 的 `#settings` 按钮与 `manifest.json` 的 `options_page` 为准。

---

## 一、用法说明

本文件包含：
1. **主提示词（自包含，可直接粘贴）**：让 LLM 扮演扩展架构师，产出「单一 Settings 对象 + 单 key + 单向广播」的裁剪方案。
2. **变体 A**：偏「代码生成」（直接产出一套类型安全的 `settings.js` 模块）。
3. **变体 B**：偏「问题诊断」（排查设置不生效 / 不同步 / 升级丢失）。
4. **调试提示词 T1-T4**：针对常见故障的定向追问模板。

粘贴时请替换 `{{SRC_DIR}}` 为你的源码根目录（默认 `7.1.0_0`）。

---

## 二、主提示词（自包含，可直接粘贴）

```
你是一位资深浏览器扩展架构师 + 技术文档作者。我要把 Chrome 扩展 Katalon Recorder 7.1.0（MV3）
的「设置面板 / 配置系统」逆向裁剪成一个纯本地的个人录制回放插件。

【源码目录】{{SRC_DIR}}

【必读文件】
- manifest.json                                 （:63 options_page 指向僵尸页；:51/:53/:68 云/埋点 URL）
- panel/js/katalon/kar.js                       （:229-258 #settings 按钮开窗，复用 settingWindowID）
- setting-panel/index.html                      （:28-36 脚本加载顺序硬约束，引用 panel/css/*.css）
- setting-panel/js/setting-panel.js             （主控制器：saveData 串行、isChange 脏标、displayTab 深链）
- setting-panel/js/UI/menu-tree.js              （4 条扁平菜单 + tree.click 分发）
- setting-panel/js/UI/confirm-close-dialog.js   （关闭确认，Cancel 不 resolve）
- setting-panel/js/setting-tabs/KS-port-setting-tab.js   （Katalon Studio 端口，硬编码 URL + 图片路径错误）
- setting-panel/js/setting-tabs/self-healing-setting-tab.js （自愈 UI 最复杂，读改写整对象）
- setting-panel/js/setting-tabs/privacy-setting-tab.js     （埋点开关，含 debugger;）
- setting-panel/js/setting-tabs/test-execution-setting-tab.js（双布尔互斥选项）
- setting-panel/js/setting-tabs/ISettingTab.js  （鸭子接口契约）
- panel/js/background/load-setting-data.js      （默认值 + 整体缺失判定）
- panel/js/UI/services/self-healing-service/utils.js （自愈消费链，1 次判定读 3 次 storage）
- panel/js/UI/view/dialog/test-execution-dialog.js （弹框内深链写 testExecutionTab）
- background/segment-tracking-services.js       （安装事件用 || 绕过 tracking 开关）
- katalon/options.html + katalon/options.js     （2018 僵尸 options 页，与 KS Port Tab 文案重复）

【硬性纪律】
1. 禁止臆测：每个结论必须带 `文件路径:行号` + 片段；找不到写「未在源码中找到」。
2. 入口判定以 #settings 按钮与 options_page 为主，不以目录名猜测。
3. 安全/隐私缺陷必须点名（debugger、tracking 默认开、埋点绕过），不得美化。
4. 全部简体中文。

【关键事实（已核实，可直接引用）】
A. 真入口在 Panel 的 #settings 按钮。panel/js/katalon/kar.js:245-258：
   点击 → 若 settingWindowID 未定义则 windows.create({url:"setting-panel/index.html", type:"popup"})
   （:235-243），否则 windows.update(settingWindowID,{focused:true}) 复用（:249-256）。
   这是独立 popup 窗口，【不走】options_page。settingWindowID 是内存变量（:229），SW 回收即失忆。

B. options_page 是僵尸配置。manifest.json:63 `"options_page": "katalon/options.html"`，
   但 katalon/options.html + katalon/options.js 是 2018 年遗留页，文案与 KS Port Tab 逐字重复，
   全扩展真正打开设置面板只走 A 路径，options_page 实际从不被调用。

C. 持久化：所有设置聚合在一个对象 `setting` 里，存到 chrome.storage.local 的【单 key】"setting"。
   证据：load-setting-data.js:8-17 写默认值；各 Tab 用 browser.storage.local.get("setting") / .set({setting:...})
   （privacy-setting-tab.js:31-33、self-healing-setting-tab.js:203-206、test-execution-setting-tab.js:43-50）。
   【没有】storage.sync、【没有】localStorage、【没有】storage.onChanged 监听 setting —— 全靠「用时现读」。

D. 默认写时机缺陷。loadSettingData 只判整体缺失（isObjectEmpty 见 load-setting-data.js:1-5，
   调用处 :20-24），整体有值即跳过；【无 schemaVersion】、【无字段级 deepMerge 补齐】。
   => 老用户升级后新增字段（如 testExecution）不会补默认值（test-execution 用 ?? {} 兜底，但 self-healing 不兜底）。

E. 丢更新根因。setting-panel.js:35-40 的 saveData() 串行调 4 个 Tab 的 saveData，但：
   ① KS Port Tab 的 saveData() 根本没 return Promise（KS-port-setting-tab.js:46-48），不进 await 链；
   ② 其余 3 个 Tab 内部 browser.storage.local.set(...) 也都【未 await】
   （privacy-setting-tab.js:33、self-healing-setting-tab.js:206、test-execution-setting-tab.js:50）。
   每个 Tab 各自「读 setting 整对象 → 改自己那块 → 写回整对象」，并发保存互相覆盖最后一写者。

F. 明显缺陷（点名）：
   - privacy-setting-tab.js:29 残留 `debugger;` 语句，发行包里会断点挂起；
   - privacy-setting-tab.js:15-16 直接 `settingData.setting.tracking`，setting 为空时 .setting 崩溃
     （同文件 :31-32 再次触发），test-execution/self-healing 有 `?? {}` 兜底，privacy 没有；
   - self-healing-setting-tab.js:204-205 `Object.assign(settingData["self-healing"], self_healing)`
     应为 `settingData.setting["self-healing"]`，漏写 `.setting` 导致赋到错误层级；
   - self-healing-setting-tab.js:122 把用户输入 `$(e.target).val()` 直接拼进 HTML 模板（XSS 面）。

G. 互斥选项用双布尔。test-execution-setting-tab.js:46-47 同时存 stopExecution / continueExecution 两个布尔，
   二者并存且都进 storage；但回放消费方 play-actions.js:1530-1552 只认
   `testExecution.continueExecution ?? true`，stopExecution【从未被消费】，注释与代码矛盾。

H. 埋点反模式。① tracking 默认开启（load-setting-data.js:15 "tracking": true）；
   ② 安装事件 kru_install_application 用 `||` 绕过开关：segment-tracking-services.js:16-17
   `if (data.event === "kru_install_application" || settingData.setting.tracking)` —— 装完即上报，关不掉；
   ③ 自愈消费链 utils.js 一次判定读 3 次 storage.local.get("setting")（:2, :18, :28）放大读；
   ④ KS Port Tab 图片路径多写一层 `../../../`（KS-port-setting-tab.js:18），且硬编码 katalon.com（:12,21,23,25）。

【可整块裁剪（个人插件不需要）】
- 僵尸 options_page：manifest.json:63 + katalon/options.html + katalon/options.js。
- 埋点全链路：background/segment-tracking-services.js、panel/js/UI/services/tracking-service/*、
  common/offscreen*.js（仅埋点）、manifest.json:68 segment_url / :53 hubspot_url / :51 homepage_url 中的上报部分。
- externally_connectable（manifest.json:46-50）与 Katalon Studio 端口联动（KS-port-setting-tab.js）。

【值得直接抄 / 改进】
- 单一 Settings 对象思路（单 key "setting"）可保留，但应改为：
  进程内缓存 + settings.js 暴露 load()/save()/subscribe()/migrate()，save 内部 await，
  并用 storage.onChanged 做【单向广播】（写方写、所有读方被动刷新），消灭「4 Tab 各自读改写」与「读放大」。
- 菜单/弹窗 UI 可保留，但 4 条扁平菜单不必引 1342 行 jqtree（menu-tree.js 仅 4 项）。

【任务：请输出】
1. 一张「设置项全清单」表：设置名 / 控件类型 / 默认值 / storage 路径 / 消费方行号 / 是否真被消费。
2. 一张「持久化与同步机制」图（ASCII）：单 key "setting" + 4 Tab 各自「读-改-写」链 + 缺失的 onChanged 广播。
3. 举 2-3 条「setting → 运行时」传导链，每条带 路径:行号（如 self-healing 开启 → utils.js 判定 → 回放自愈）。
4. 一份「缺陷清单」：列出 debugger、缺 ?? {} 兜底、Object.assign 漏 .setting、双布尔、丢更新、无广播、
   无 schemaVersion、僵尸 options_page、埋点绕过、硬编码 URL 共 10 项，每项给 路径:行号 + 修复建议。
5. 一份「复刻方案」：定义 Settings 接口（load/save/subscribe/migrate 签名）、DEFAULT_SETTINGS 结构、
   版本迁移策略（schemaVersion + 字段级 merge），并说明如何用 onChanged 单向广播替代「读放大」。
6. 一份「云/埋点可删清单」：每项给 原状 路径:行号 + 删除后需改的引用点（至少覆盖 options_page、segment、offscreen、KS Port）。
```

---

## 三、变体 A · 代码生成型（产出类型安全的 settings 模块）

```
基于上述关键事实 A–H，请【只产出代码】，不要解释。产出一套类型安全的配置模块，包含 2 个文件：

1. `src/settings/schema.js` —— 默认结构与类型（对照 load-setting-data.js:7-17）
   - DEFAULT_SETTINGS 对象：selfHealing{enable, locator[], excludeCommands[]}、
     tracking:false（改为默认关）、testExecution{stopExecution,continueExecution}、
     ksPort（如需保留桌面联动）。
   - SCHEMA_VERSION = 1。
   - 纯数据，无副作用。

2. `src/settings/settings.js` —— 读写 + 订阅 + 迁移（对照 setting-panel.js:35-40 / utils.js:2,18,28）
   - 进程内缓存 `let cache = null;`
   - async load()：cache 命中直接返回；否则 storage.local.get("setting")，
     若整体缺失或 schemaVersion 不符 → deepMerge(DEFAULT_SETTINGS, stored) 后写回并缓存。
   - async save(patch)：`cache = deepMerge(cache, patch)` → storage.local.set({setting:cache})
     +【必须 await】+ 不动其它字段（消灭读改写整对象覆盖）。
   - subscribe(cb)：storage.onChanged.addListener，仅当 changes.setting 时
     `cache = changes.setting.newValue` 并 cb(cache)（单向广播，替代「用时现读」）。
   - migrate(stored)：按 schemaVersion 逐项字段级补齐，不得在整体有值时跳过（修 load-setting-data.js:20-24 缺陷）。
   - 删除 privacy 的 debugger;（原 privacy-setting-tab.js:29）、self-healing 的 Object.assign 漏 .setting
     （原 self-healing-setting-tab.js:204-205）、privacy 缺 ?? {} 兜底（原 :15-16）。

要求：
- 每个函数上方一行注释标明对应源码 `路径:行号`；对原版的改进用 `// 【改进】原版 xxx:行号 的问题是…` 标注。
- 不引入任何第三方依赖，用原生 ESM，字段访问全部带默认值兜底，禁止 `obj.x.y` 裸取。
```

---

## 四、变体 B · 问题诊断型（设置改了不生效 / 两窗口不同步 / 升级后配置丢失）

```
我的本地录制插件基于 KR 配置系统改造，出现以下三类故障，请按决策树逐项核对，给出最可能的 1 个根因。

【症状一：在设置面板改了某项，回放时没生效】
1. 保存真的写进去了吗？saveData() 里 set 未 await（privacy:33 / self-healing:206 / test-execution:50），
   点 Save 后立刻关闭窗口，写入可能未完成。
2. 是不是「读改写整对象」覆盖了别人的字段？4 个 Tab 各自读 setting 整对象再写回
   （setting-panel.js:35-40 + 各 Tab），并发保存最后写者胜（E）。
3. 消费方读的是缓存还是最新？无 onChanged 广播，消费方「用时现读」（utils.js:2,18,28），
   若窗口打开早于保存，看不到新值。
4. 字段路径写错了吗？self-healing 的 Object.assign 漏 .setting（self-healing-setting-tab.js:204-205），
   实际没写进 setting["self-healing"]。
5. 该选项真的被消费了吗？stopExecution 从未被读（test-execution:46 vs play-actions.js:1530-1552 只认 continueExecution）。

【症状二：两个设置窗口显示的值不同步】
6. 没有 storage.onChanged 监听（C）：A 窗口改完，B 窗口不会刷新，只能关了重开。
7. settingWindowID 是内存变量（kar.js:229），SW 回收后复用逻辑失效，可能开第二个独立窗
   （kar.js:245-258），两窗各自一份 DOM 状态。
8. 弹框内深链 test-execution-dialog.js 写 testExecutionTab:true（存 storage.local 独立 key），
   下次开面板 displayTab 会跳到 Test Execution（setting-panel.js:82-100，并立即 reset 为 false）。

【症状三：升级插件后旧配置部分丢失 / 用了旧默认值】
9. loadSettingData 只判整体缺失（load-setting-data.js:1-5,20-24），整体有值就跳过，
   新增字段（如 testExecution）不补默认（除非代码里 ?? {} 兜底，但 self-healing 不兜底）。
10. 无 schemaVersion、无字段级 deepMerge（D）：旧用户升级后新字段保持 undefined，UI 渲染可能崩。

请输出：
- 一棵「排查决策树」（症状 → 分支 → 结论），每个节点标注 路径:行号；
- 每种症状给出最可能的 1 个根因 + 最小验证方法（一行 console 或 5 行代码）。
```

---

## 五、调试提示词（T1-T4 定向故障模板）

**T1 · 设置保存后回放不生效**

```
我在设置面板改了自愈/埋点/失败策略，保存后回放没反映。请检查：
- saveData() 内的 storage.local.set 是否 await？（privacy-setting-tab.js:33 / self-healing:206 / test-execution:50 原版都未 await）
- 是不是 4 个 Tab 各自「读整对象 → 改 → 写回整对象」互相覆盖？（setting-panel.js:35-40）
- 字段路径对吗？self-healing 的 Object.assign(settingData["self-healing"], ...) 漏了 .setting
  （self-healing-setting-tab.js:204-205），没写进 setting["self-healing"]。
- 该选项真被消费了吗？stopExecution 从未被读（test-execution:46 vs play-actions.js:1530-1552）。
输出：3 个最可能根因 + 每个的一行验证代码（如 console.log 落盘后的 storage.setting）。
```

**T2 · 两窗口设置不同步**

```
我同时开了两个设置窗口，改 A 窗口 B 窗口不变。请检查：
- 有没有 storage.onChanged 监听 setting？（C：原版【没有】，全靠用时现读）
- settingWindowID 复用逻辑（kar.js:229,245-258）：SW 回收后内存变量清零，可能开第二个独立窗。
- 弹框内深链写入 storage.local.testExecutionTab（test-execution-dialog.js），
  下次开面板 displayTab 会跳 Test Execution 并立即 reset false（setting-panel.js:82-100）。
输出：一份「用 storage.onChanged 单向广播替代内存变量 + 现读」的最小改写方案（含 subscribe 签名）。
```

**T3 · 升级后配置丢失 / 新字段无默认**

```
插件升级后，老用户的某些设置变成 undefined 或退回旧默认。请检查：
- loadSettingData 只判整体缺失（load-setting-data.js:1-5,20-24），整体有值即跳过，不补新字段。
- 有无 schemaVersion / 字段级 deepMerge？（D：原版都没有）
- 哪些字段有 ?? {} 兜底、哪些没有？privacy/self-healing 缺兜底，读空 setting 会崩溃
  （privacy-setting-tab.js:15-16 直接 .setting.tracking）。
输出：一份 migrate(stored) 实现（按 schemaVersion 字段级补齐 DEFAULT_SETTINGS），并说明如何在 load 时触发。
```

**T4 · 埋点关不掉 / 隐私缺陷整改**

```
我的插件仍在上报埋点，即便关闭了 tracking。请检查：
- tracking 默认值是不是 true？（load-setting-data.js:15）
- 安装事件是否用 || 绕过开关？segment-tracking-services.js:16-17
  `if (data.event === "kru_install_application" || settingData.setting.tracking)` —— 装完即上报。
- privacy tab 是否残留 debugger;（privacy-setting-tab.js:29）会挂起调试器。
- 是否仍引 offscreen / segment / hubspot（manifest.json:51,53,68）。
输出：一份「隐私整改清单」——tracking 默认改 false、删除 || 绕过分支、删除 debugger、
移除 offscreen/segment 调用与权限，并列出每个改动对应的 路径:行号。
```

---

*提示词包完。所有引用均可在 `7.1.0_0` 按 路径:行号 核对；完整机制见 `_distill/tech/TECH-07-设置面板与配置系统.md` 与 `_distill/prd/PRD-07-设置面板.md`。*
