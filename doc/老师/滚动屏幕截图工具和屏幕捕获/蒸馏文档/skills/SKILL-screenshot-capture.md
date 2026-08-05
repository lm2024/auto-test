---
name: screenshot-capture
description: 在 Chrome MV3 扩展中实现可见区域、选区、整页滚动拼接、桌面窗口四种截图能力，以及图片上传/本地保存流程。当用户要求复刻 AwesomeScreenshot 的截图能力、实现滚动长截图、选区截图或桌面截屏时使用。
---

# Screenshot Capture Skill

## 触发条件
- 用户要在一个 Chrome 扩展中实现截图功能
- 需要整页滚动截图 / 选区截图 / 桌面窗口截图
- 需要图片上传队列或本地保存

## 核心知识

### 截图能力矩阵
| 模式 | 技术 |
| --- | --- |
| Visible Part | `chrome.tabs.captureVisibleTab` 或 content script + html2canvas |
| Selected Area | content script 注入遮罩，拖拽选区，canvas 裁剪 |
| Full Page | 分屏滚动 + 背景色采样 + 拼接 |
| Desktop / Window | `chrome.desktopCapture.chooseDesktopMedia` + getUserMedia + canvas 定格 |

### 滚动拼接算法（最复杂，按此实现）
1. 初始化：计算 `scrollHeight`、`scrollBarWidth`、正文区域 `contentClip`、背景采样区 `bgRegions`
2. 循环：截当前视口 → 计算下一屏滚动位置 → 发送给后台 → 后台拼接入画布
3. 处理左右空隙：对 `bgRegions` 采样主色（像素频次统计）填充
4. 处理移动端：`visualViewport.scale > 1` 时用视口比例缩放裁剪
5. 上限：`maxCaptureHeight`（建议 100000px）防内存溢出
6. 无限滚动页面：滚动次数超过阈值提示用户手动停止

### 选区截图要点
- 监听 mouse 与 touch 两套事件
- 坐标乘 `devicePixelRatio` 转物理像素
- 遮罩 z-index 高（约 2147483600 以上）
- 支持拖拽 resize 手柄

### 桌面截屏要点
- `chrome.desktopCapture.chooseDesktopMedia(["screen","window"], cb)`
- `chromeMediaSource: "desktop"` + `chromeMediaSourceId`
- video 播放 300ms 后 canvas drawImage + toDataURL
- 用户取消选择（cb 为 null）时关闭窗口
- 错误分类：Mac 系统权限 / Windows 音频源冲突

### 图片上传队列（云端）
- `create` 接口拿 imageID/imageURI
- 分块 `upload_multipart`（FormData: file, imageID, imageIndex）
- 全部完成 `complete_multipart`
- 失败指数退避重试（建议最多 8 次）
- 离线降级到本地标注

## 实现步骤
1. 创建 `capture.js`（后台控制器）与 `content-capture.js`（页面脚本）
2. 实现选区遮罩与拖拽
3. 实现滚动拼接状态机
4. 实现桌面捕获窗口
5. 实现保存/上传管线
6. 加入页面限制判断（chrome:// 等禁止注入）
7. 验证：普通网页、长页面、无限滚动页面、手机模拟

## 验证清单
- [ ] 可见区域截图与屏幕一致
- [ ] 选区截图位置精确（含 devicePixelRatio=2 屏幕）
- [ ] 长页面拼接无错位、无缝隙
- [ ] 桌面窗口截图可取消、可延迟
- [ ] 上传失败自动重试，离线可本地保存
