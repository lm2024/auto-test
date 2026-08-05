# 02 PRD：截图捕获模块

## 1. 模块职责

提供四类截图能力，并支持云端/本地保存：
- Visible Part：当前可视区域
- Selected Area：用户框选区域
- Full Page：整页滚动拼接
- Desktop / App Window：桌面或应用窗口
- Annotate：本地图片 / 剪贴板图片标注

## 2. 涉及文件

| 文件 | 角色 |
| --- | --- |
| `javascripts/bundles/content.bundle.js` | 页面内选区遮罩、滚动截图、快捷键、截图按钮 |
| `javascripts/bg.js` | 截图调度、数据组装、上传队列协调 |
| `javascripts/capture-desktop.js` / `capture-desktop.html` | 桌面截屏独立窗口 |
| `javascripts/image_upload.js` | 图片创建、分块上传、失败重试 |
| `javascripts/collage.js` | 拼图（html2canvas + 会员限制） |
| `javascripts/upload.js` | 本地/剪贴板图片进入标注 |
| `stylesheets/selected.css` | 选区遮罩样式 |

## 3. 触发链路

```
popup 点击 → runtime.sendMessage({action: "visible"|"selected"|"entire"|"delay"|"desktop"})
    │
    ▼
bg.js 处理：
  - desktop → beginDesktop()（capture-desktop 页面）
  - visible/selected/entire/delay → sendMessageToTab(当前标签, {action, actionFrom})
    │
    ▼
content.bundle.js：
  - selected → 绘制遮罩 + 拖拽调整大小 → 截图
  - entire → 滚动拼接循环 → 每屏截 dataURL → 回传
    │
    ▼
bg.js：
  - 本地 → 打开 annotate-react.html / edit-react.html
  - 云端 → image_upload.js 队列上传
```

## 4. 选区截图（Selected Area）

### 4.1 UI
- 注入固定定位遮罩，包含 `awesome_screenshot_center` 手柄
- 支持 mouse / touch（`touchstart/move/end`）
- 顶部小工具条：Cancel、Capture、Copy 按钮
- `dragresize.js` + jQuery UI 负责拖拽调整

### 4.2 实现要点
- 选区坐标 `x/y/w/h` 乘以 `window.devicePixelRatio` 后回传
- `menuType:"selected"` 进入截图分支
- 截图后用 `toDataURL` 或 `toBlob`，再走 `handleCurrentCapture`
- https 页面出于安全考虑禁用选区（`enable_selected` 消息），但实际代码里对 https 仍提示“For security reason”并禁用

## 5. 整页滚动截图（Full Page）

这是本项目最核心的算法，蒸馏重点：

### 5.1 初始化
- `init_entire_capture` 注入整页截图框架
- 先计算页面尺寸、可滚动性（`canSroll`、`scrollBarWidth`）
- 记录 `topCapturePostion`、`contentClip`、`bottomClip`、`bgRegions`

### 5.2 滚动循环
1. 截取当前视口（`dataURL`）
2. 计算下一屏滚动位置，`userAction` 标记用户是否正在操作
3. 发送 `scroll_next_done` 到 bg.js
4. bg.js 计算拼接画布高度、去重、裁剪
5. 重复直到 `scrollHeight` 走完，或用户点击 Stop

### 5.3 拼接算法
- `handleEntirePage`：用 `topCapturePostion` 判断手机模式（高度大于截图的 1.1 倍）
- `contentClip` 定义正文区域，`bgRegions` 记录左右两侧背景采样区
- `getColorWithRegion`：取背景区域主色（像素统计），用于填充拼接时左右空隙
- `ratio.y` 处理移动端视口缩放
- 输出 `canvas.toBlob(..., "image/jpeg", 1)` 或 PNG

### 5.4 停止
- `stop-entire-capture` 消息终止循环
- 长页面/无限滚动提示用户手动停止（滚动数 >= 9 显示提示）
- `maxCaptureHeight = 100000` 防止内存溢出

## 6. 桌面截图

- `capture-desktop.html` 打开后立即执行 `beginDesktop()`
- `chrome.desktopCapture.chooseDesktopMedia(["screen","window"], callback)` 获取 `chromeMediaSourceId`
- `getUserMedia({video:{mandatory:{chromeMediaSource:"desktop", chromeMediaSourceId, maxWidth:3840, maxHeight:2160}}})`
- 播放 300ms 后 `canvas.drawImage(video)` → `toDataURL()` → `finishCapture`
- 支持延迟截图：badge 显示倒计时
- 错误分类：Mac 系统权限 / Windows 音频源冲突 → 打开 `permission-denied.html?os=mac|win`

## 7. 图片上传队列（云端）

`image_upload.js` 是完整的断点上传设计：

### 7.1 队列对象
- `UploadQueue(imageId, imageUrl)`：一张图片一次完整截图的队列
- `UploadItem(blob, index, isLast, status)`：分块
- `status`：0 初始 / 1 上传中 / 2 完成 / 3 失败

### 7.2 流程
1. `getImageId()` POST `/api/v1/image/create` 拿 `imageID` 和 `imageURI`
2. 每屏/每块 POST `/api/v1/image/upload_multipart`（FormData: file, imageID, imageIndex）
3. 全部完成后 POST `/api/v1/image/complete_multipart`
4. 失败重试：指数退避 `800 * failedTimes`，最多 8 次
5. `refreshUserInfo()` 刷新额度

### 7.3 离线兜底
- 离线时 `isSaveOnLine=false`，本地打开 `annotate-react.html`
- `failedInitImage` 机制：初始化失败也切本地

## 8. 日志与埋点

- `uploadLog(imageID, info)` 把失败原因上报服务端
- `googleEvent("capture "+type, "capture")` 上报 GA

## 9. 蒸馏要点

1. 滚动拼接核心：分屏截取 + 背景色采样 + `contentClip` 裁剪，可独立复刻
2. 选区遮罩注意 touch 支持与 devicePixelRatio 换算
3. 上传队列是很好的“多块上传 + 失败重试 + 离线降级”模板，可换自己的接口
4. 桌面截图必须处理用户取消选择（`callback(null)` 时关窗）
5. `capture-desktop` 独立窗口意味着截图过程中弹窗可以关闭，不影响流程
