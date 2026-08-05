---
name: kr-locator-selfhealing
description: Katalon Recorder 定位器生成与 Self-Healing 自愈模块专家。用于逆向理解、裁剪或排障录制回放插件中的「元素定位器生成 + 自动换用候选定位器自愈」能力。
keywords: [katalon-recorder, locator, self-healing, xpath:neighbor, locator-builders, 定位器, 自愈, 录制回放]
---

# KR Locator & Self-Healing 技能

你是一位精通 Katalon Recorder 7.1.0（MV3）「元素定位器生成 + Self-Healing 自愈」模块的架构师。
本技能帮助你**逆向理解、裁剪、排障**这套机制，用于构建个人录制回放插件。

## 一、何时使用

- 需要理解「录制时如何把点击元素变成可回放定位器字符串」。
- 需要裁剪/重写个人插件的定位器生成器（双轨合并、neighbor 置顶）。
- 回放时首选定位器失效，需要让工具自动换用候选定位器继续。
- 排查「自愈为什么不触发 / 换了定位器但点错元素 / 云端上报关不掉」等问题。
- 需要把断裂定位器与推荐定位器展示给用户并一键写回。

## 二、心智模型

```
录制：DOM 元素 ──LocatorBuilder.buildAll──▶ {finderName:[locator,...]} ──▶ TestCommand.targets[]
                                                                              │
回放：defaultTarget ──findElement──▶ 命中? 执行 : 抛 not found
                                              │
                                       Self-Healing 触发
                                              │
                              getPossibleTargetList 排序候选（按 setting.locator 顺序）
                                              │
                              递归 runCommand 逐个消耗 possibleTargets
                                              │
                              命中 → addBrokenLocator(UI) → 用户 Approve → 写回 defaultTarget
```

核心三点：
1. **录制存多候选**（`targets[]`）是自愈的弹药库 —— 没有候选就没有自愈。
2. **xpath:neighbor 最鲁棒**（用邻居文本当锚，不依赖自身属性/路径），Katalon 把它置顶。
3. **自愈 = 排序 + 有界递归重试 + 可审计写回**，不是「更聪明的定位器」。

## 三、决策树

- 要生成定位器？→ 看 `katalon/ku-locatorBuilders.js:352-579`（保留此版，对象形态 + neighbor 置顶）。
- neighbor 为空？→ 查 `excludedTags`(:4) / `usefulElement`(:294) / 前后取数(:102)。
- 自愈不触发？→ 查 enable(:7-18) / excludeCommands(:27-48) / 报错文案(:1321) / 队列非空(:1330)。
- 点错元素？→ 查 `getCorrectOffset` preceding 反向计数(:164) / `getRelativePrefix`(:149)。
- 想写回？→ `approveSelfHealingProposalAction`(:57) → `command.defaultTarget = proposeLocator`(:44)。
- 想去隐私？→ 删 `dom_collector.js` / `dom_inspector.js` / `common.js:35-36`。

## 四、实现清单（落地时逐项核对）

- [ ] 单轨生成器，`buildAll` 返回对象 `{finderName:[locator]}`（参照 ku:136-139）
- [ ] `_preferredOrder = ['xpath:neighbor']`（参照 ku:577）
- [ ] 策略以 `.add(` 注册（参照 ku:352-579，至少 id/name/css/xpath:neighbor）
- [ ] 用 `katalon/neighbor-xpaths-generator.min.js`（含 generateTextLocator 兜底）
- [ ] `TestCommand{ defaultTarget, targets:[] }`（test-command.js:13）
- [ ] 存档 `<datalist><option>`（parser.js:92-95）
- [ ] 设置 `setting["self-healing"]={enable,locator[],excludeCommands[]}`（load-setting-data.js:7-18）
- [ ] `getPossibleTargetList` 排序（utils.js:55-78）
- [ ] 回放失败识别 + 有界递归重试（play-actions.js:1321-1341）
- [ ] 断裂 UI + Approve 写回（self-healing-tab.js:46 / command-actions.js:44）
- [ ] 删除云端上报（dom_collector / dom_inspector / common.js:35-36）

## 五、代码模式（关键片段）

**排序算法（自愈核心）** `utils.js:55-78`：
```js
const groups = {};
currentCommand.targets.forEach(t => {
  const hit = locatorList.find(l => new RegExp('^'+l).test(t));
  if (hit) (groups[hit] = groups[hit]||[]).push(t);
});
let res = [];
locatorList.forEach(l => res.push(...(groups[l]||[])));   // 设置顺序在前
currentCommand.targets.forEach(t => { if(!res.includes(t)) res.push(t); }); // 其余追加
return res.filter(t => t !== currentCommand.target);       // 剔除正在失败的那条
```

**有界递归重试** `play-actions.js:1330-1341`：
```js
if (possibleTargets.length > 0) {
  let nextTarget = possibleTargets.shift();
  return runCommand(/* ... */ nextTarget /* ... */);  // 递归，候选耗尽即止
}
```

**Approve 写回** `command-actions.js:44`：
```js
command.defaultTarget = brokerLocatorItem.proposeLocator;
```

## 六、常见坑

1. 双轨 `LocatorBuilders` / `KULocatorBuilders` 几乎重复，仅 neighbor 置顶与返回形态不同 —— 裁剪务必合并为单轨（保留 KU 版）。
2. `xpath:neighbor` 在 `excludedTags` 含 `p/ul/option` 时可能无锚点（neighbor-xpaths-generator.js:4）。
3. `getCorrectOffset` 的 `preceding` 轴**反向计数**（:164），写错会点错元素。
4. `isCommandExcluded` 用裸 `new RegExp(command)`（utils.js:27-48），未转义元字符会误匹配。
5. 递归重试依赖 `possibleTargets` 长度天然有界（play-actions.js:1330），勿额外加无限循环。
6. 云端上报默认逻辑会把页面 DOM/邻居文本外传 —— 个人插件必须删除（common.js:35-36 + dom_collector/dom_inspector）。
7. `preciseXPath` 在生成阶段保证 xpath 唯一（content/locatorBuilders.js:332-345），回放查找另由 selenium-browserbot/selenium-api 完成。

## 七、调试手册

| 现象 | 首查文件:行号 | 可能根因 |
|---|---|---|
| neighbor 候选空 | neighbor-xpaths-generator.js:4,294,102 | excludedTags 误杀 / 文本过短 / 前后邻居不足 |
| 自愈不触发 | play-actions.js:1321,1325,1330 | 报错文案不匹配 / 命令被排除 / 队列空 |
| 换定位器点错 | neighbor-xpaths-generator.js:164,149 | preceding 反向计数错 / 相对前缀反了 |
| exclude 误伤 | utils.js:27-48 | 正则未锚定 |
| 上报关不掉 | common.js:35-36, dom_inspector.js | 残留 DOM 监听 |
| 写回不生效 | command-actions.js:44 | 仅改内存未改录制网格 |

## 八、KR 对应实现位置表

| 能力 | 原版（content） | Katalon 版（katalon） | 说明 |
|---|---|---|---|
| 生成器主体 | locatorBuilders.js | ku-locatorBuilders.js:352-579,577 | KU 版 neighbor 置顶、返回对象 |
| 邻居算法（可读）| neighbor-xpaths-generator.js | neighbor-xpaths-generator.min.js | KU 版多 generateTextLocator + // 轴 |
| 排序算法 | — | self-healing-service/utils.js:55-78 | getPossibleTargetList |
| 默认设置 | — | load-setting-data.js:7-18 | enable/locator/excludeCommands |
| 回放重试 | — | playback/.../play-actions.js:935,944,958,961,975,1321-1341 | 自愈主链路 |
| 断裂 UI | — | self-healing-tab.js:46 | addBrokenLocator |
| Approve 写回 | — | self-healing-tab-command-actions.js:57,44 | defaultTarget=propose |
| 存档格式 | parser.js:92-95 | 同 | `<datalist><option>` |
| 命令模型 | — | test-model/test-command.js:13 | {defaultTarget,targets[]} |
| 悬停高亮 | targetSelecter.js:3,48,64 | — | 手动选择/校验 |
| 云端上报 | — | common.js:35-36, dom_collector.js, dom_inspector.js | 可裁剪 |
| 实例化 | recorder.js:36 | ku-recorder.js:23 | 双轨分别被 Recorder 实例化 |

---

*技能完。所有引用均可在 KR 7.1.0_0 源码按 路径:行号 核对；找不到的事实标注「未在源码中找到」。*
