# 07 PRD：标注与控件栏模块

## 1. 模块职责

- 录制过程中在页面上叠加控制栏与标注工具栏
- 提供鼠标高亮、点击高亮、画笔、箭头、矩形、椭圆、文字、标注气泡、表情、模糊、聚光等工具
- 支持暂停/继续/停止/丢弃、折叠/展开
- 截图后进入独立标注编辑器（Diigo annotator）

## 2. 涉及文件

| 文件 | 角色 |
| --- | --- |
| `javascripts/libs/diigo-image-annotator.min.js` | 图片标注核心（SVG doodle 系统） |
| `javascripts/bundles/annotate.bundle.js` | 标注编辑器 React 壳 |
| `javascripts/bundles/edit.bundle.js` | 图片编辑器（裁剪/滤镜/上传/保存） |
| `javascripts/bg.js` | `initToolbar` / `stopToolbar` / `toggleToolbar` |
| `javascripts/bundles/content.bundle.js` | 页面内控制栏渲染 |
| `images/video_toolbar/*` | 工具栏图标 |
| `images/svg/*` | 表情/光标 SVG |

## 3. 录制工具栏

### 3.1 状态
```js
toolbarSettings = {
  mouseMode: "mouse",       // mouse | annotation
  currentMouse: "default",  // 鼠标样式
  drawMode: "freeline",     // 画笔模式
  currentColor: "red",
  isCollapse: false,
  isPaused: false
}
```

### 3.2 工具清单（来自 i18n）
- 鼠标效果：Default、Highlight Mouse、Highlight Click
- 画笔：Free line、Pen、Arrow、Rectangle、Ellipse、Text、Callout、Emoji、Image、Blur、Spotlight、Step
- 编辑：Undo、Remove single、Remove all、Clear
- 录制控制：Pause、Resume、Stop、Discard
- 折叠/展开

### 3.3 注入流程
1. `initToolbar()`：desktop 模式对所有标签页广播；tab/custom 模式只注入录制标签页
2. content script 渲染工具栏 DOM，图标从 `web_accessible_resources` 加载
3. 鼠标高亮：监听 `mousemove` 生成跟随光标的高亮元素
4. 点击高亮：监听 `click` 生成波纹动画
5. `stopToolbar()`：向页面发 `remove-toolbar` 并清理状态

### 3.4 暂停联动
- 工具栏暂停按钮 → `pauseScreenRecording()` → 页面显示暂停态
- 恢复同理

## 4. 图片标注编辑器

### 4.1 Diigo Annotator 能力
- SVG 路径 doodle：曲线、直线、箭头、矩形、椭圆、文字、列表
- 模糊（`stackBlurCanvasRGBA`）、水印、裁切
- Undo/Redo 命令栈（`_UndoRedoManager`）
- 事件区域（`EventRegion`）支持旋转/缩放手柄
- 触屏手势（`addGesture`）
- RTL 文本排版支持

### 4.2 编辑器页面
- `annotate-react.html?ct=&cl=&cw=&ch=&incognito=&mark=&actionType=&format=`
- 截图数据以 URL 参数传递（dataURL 或图片 URL）
- 标注完成后：
  - 复制到剪贴板
  - 保存 PNG/JPEG（`save-as` 可选）
  - 云端上传（`saveAnnotatedImage`）
  - 本地下载

### 4.3 编辑器能力（edit.bundle.js）
- 图片裁剪、缩放、旋转
- 滤镜（html2canvas 相关）
- PDF 导出（长图拆分）
- 上传到 Awesome 云端
- 分享链接

## 5. 截图后的“保存/复制/上传”流程

`image_upload.js` 中的 `saveAnnotatedImage(blob)`：
1. `getCurrentTab` → `sendMessageToTab(tabId, {action:"destroy_selected"})`
2. 在线且允许自动保存：`getImageId` → 上传队列
3. 离线：`openLoacalTab` 打开 `annotate-react.html` 本地编辑

## 6. 蒸馏要点

1. Diigo annotator 是成熟 SVG 标注引擎，个人插件可直接复用，注意它是压缩库且无文档
2. 工具栏必须用 `web_accessible_resources` 暴露图片，否则页面内无法加载
3. 鼠标/点击高亮是通过监听页面事件 + 注入 DOM 实现的，录制时对画面有真实影响
4. 暂停/恢复要同时同步工具栏状态、录制器状态、页面浮层状态三处
5. 图片编辑器页面之间用 URL 参数传 dataURL，数据量大时可改用 `chrome.runtime` 消息或 IndexedDB 中转
6. 编辑器对 retina 屏做了 `resize_retina`（50% 缩放）选项，个人插件可保留
