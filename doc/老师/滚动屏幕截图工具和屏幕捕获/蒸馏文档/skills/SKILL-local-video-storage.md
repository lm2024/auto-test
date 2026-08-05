---
name: local-video-storage
description: 在 Chrome 扩展中用 IndexedDB + FileSystem API 实现录制视频的本地持久化、分片追加写盘、视频列表管理、缩略图、webm seek 修复与下载。当用户要求复刻 AwesomeScreenshot 的本地录制存储、实现扩展内视频管理或流式写文件时使用。
---

# Local Video Storage Skill

## 触发条件
- 用户要本地保存录制视频
- 需要边录边写、避免内存占用
- 需要视频列表/详情/缩略图/下载

## 核心知识

### 双存储分工
- IndexedDB：元数据（标题、大小、时长、时间戳、缩略图 URL、记录类型、分享链接）
- FileSystem API：视频文件本体（`requestFileSystem(PERSISTENT, 50MB)`）
- 记录结构：
```json
{
  "id": 1720000000000,
  "fileUrl": "filesystem:chrome-extension://.../persistent/xxx.webm",
  "detail": {
    "title": "Desktop-1720000000000",
    "youtubeUrl": "", "gDriveUrl": "",
    "size": "12.5 MB", "duration": "00:01:30",
    "timeStamp": 1720000000000,
    "thumbnailUrl": "...", "recordType": "desktop"
  }
}
```

### 分片写盘
- 首片：`fileSaver.save(blob, filename)` 创建文件
- 后续片：`fileSaver.append(blob, filename)` 追加（复用 FileWriter）
- 边录边写，3 秒一片
- 删除文件用 `fileSaver.remove(fileUrl)`

### WebM Seek 修复
- 流式 webm 缺 metadata，无法拖动进度条
- 用 EBML.js（ts-ebml）：`Reader` 收集 metadata/duration/cues → `makeMetadataSeekable` → 重组 blob
- 下载时对 <1.4GB 文件做修复

### 视频管理
- 列表：IndexedDB getAll → 倒序渲染
- 详情：video 标签加载 fileUrl，canplay 后截取缩略图
- 改名：更新 detail.title
- 删除：先删文件再删 DB
- 全部删除：遍历删除 + deleteAll

### 下载
- 先申请 `downloads` 权限
- `chrome.downloads.download({url, filename, saveAs:true})`
- 失败降级为 `<a download>` 点击

## 实现步骤
1. 封装 IndexedDB（init/save/get/getAll/update/delete/deleteAll）
2. 封装 FileSystem API（save/append/remove）
3. 接入录制分片回调
4. 实现列表与详情页
5. 实现缩略图生成
6. 实现 EBML seek 修复与下载
7. 验证大数据量

## 验证清单
- [ ] 录制中边录边写不卡顿
- [ ] 录制完成文件可播放
- [ ] 下载后 webm 可拖动进度条
- [ ] 删除记录同时删除文件
- [ ] 浏览器重启后列表仍在
- [ ] 存储写满有错误处理
