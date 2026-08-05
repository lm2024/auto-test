---
name: annotation-toolbar
description: 在 Chrome 扩展录制页面中实现控制栏与标注工具栏（鼠标高亮、点击高亮、画笔、箭头、矩形、文字、表情、模糊），以及截图后的图片标注编辑器（Diigo 风格 SVG doodle + undo/redo）。当用户要求复刻 AwesomeScreenshot 的录制标注工具或图片标注编辑器时使用。
---

# Annotation Toolbar Skill

## 触发条件
- 用户要录制时在页面上叠加标注工具栏
- 需要鼠标/点击高亮、画笔等绘图工具
- 需要截图后编辑标注

## 核心知识

### 工具栏状态
```js
toolbarSettings = {
  mouseMode: "mouse",       // mouse | annotation
  currentMouse: "default",  // 鼠标效果
  drawMode: "freeline",     // 画笔模式
  currentColor: "red",
  isCollapse: false,
  isPaused: false
}
```

### 注入与移除
- desktop 模式：`chrome.tabs.query({})` 广播到所有标签页
- tab/custom：只注入录制标签页
- 移除：`remove-toolbar` 消息 + 后台清理状态
- 图标必须加进 `web_accessible_resources`

### 鼠标/点击高亮
- 高亮鼠标：监听 `mousemove` 生成跟随光标元素
- 点击高亮：监听 `click` 生成波纹/涟漪动画
- 与录制画面同帧，属于真实 DOM 效果

### 绘图工具
- free line / pen：canvas 或 SVG path 跟随鼠标
- 箭头 / 矩形 / 椭圆 / 文字 / 标注气泡 / 表情
- 模糊：`stackBlurCanvasRGBA`（像素级高斯模糊）
- 聚光 / 步骤编号：区域遮罩或序号贴图
- Undo / Remove single / Remove all / Clear

### 图片标注编辑器
- 用 Diigo annotator 思路：图层 canvas + SVG doodle 数组 + 命令栈 undo/redo
- 每个 doodle：`{type, points, pen_width, pen_color, ...}`
- 编辑手柄：EventRegion（CircleRegion 旋转 / TipRegion 缩放）
- 触屏：gesturestart/change/end 三手势
- 文字编辑：textarea 悬浮 + RTL 排版计算

## 实现步骤
1. 设计 toolbarSettings 与工具渲染
2. content script 渲染工具栏 DOM（固定定位、高 z-index）
3. 实现鼠标/点击高亮
4. 实现画笔、形状、文字、表情
5. 实现 undo/redo 命令栈
6. 实现暂停/继续/停止联动
7. 实现图片编辑器页面
8. 验证桌面与标签页模式

## 验证清单
- [ ] 工具栏在所有目标页面正常显示
- [ ] 鼠标/点击高亮与录制画面同步
- [ ] 画笔颜色、粗细可切换
- [ ] undo/redo 正确
- [ ] 暂停时工具栏状态同步
- [ ] 移除工具栏不留残留 DOM
