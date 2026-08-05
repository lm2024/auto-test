# 05 PRD：本地存储与视频管理模块

## 1. 模块职责

- 录制视频本地持久化（文件本体 + 元数据）
- 视频列表、预览、重命名、删除、全部删除
- 生成缩略图
- 分享到 YouTube / Google Drive
- 下载本地视频（处理 webm 不可 seek 的问题）

## 2. 涉及文件

| 文件 | 角色 |
| --- | --- |
| `javascripts/DB.js` | IndexedDB 封装 |
| `javascripts/file.js` | FileSystem API + 分片写入 |
| `javascripts/video-list.js` / `video-list.html` | 视频列表 |
| `javascripts/video.js` / `video.html` | 单视频详情 |
| `javascripts/upload-video.js` | YouTube / Drive 上传 |
| `javascripts/cors_upload.js` | Drive 可断点上传器 |
| `javascripts/googleOAuth.js` | OAuth 凭据管理 |
| `javascripts/libs/EBML.js` | webm seek 修复 |

## 3. IndexedDB 设计

- 数据库名：`AwesomeScreenshot`
- object store：`recordings`（autoIncrement）
- index：`by_id`（unique，主键 `id`）

记录结构：
```json
{
  "id": 1720000000000,
  "fileUrl": "filesystem:chrome-extension://.../persistent/xxx.webm",
  "detail": {
    "title": "Tab-1720000000000",
    "youtubeUrl": "",
    "gDriveUrl": "",
    "size": "12.5 MB",
    "duration": "00:01:30",
    "timeStamp": 1720000000000,
    "thumbnailUrl": "filesystem:.../thumbnail.png",
    "recordType": "desktop"
  }
}
```

API：`init / save / get / getAll / update / updateYoutubeUrl / delete / deleteAll`

## 4. FileSystem API 设计

`file.js` 用 `window.requestFileSystem(window.PERSISTENT, 50MB)`：

- `fileSaver.save(blob, filename)`：首片创建文件并写入
- `fileSaver.append(blob, filename)`：后续分片追加（复用 `currentFileWriter`）
- `fileSaver.remove(filename)`：删除
- `do_save` 返回 `file.toURL()`（`filesystem:chrome-extension://...`）

关键点：
- 录制时每 3s 一片，边录边写，避免内存爆炸
- 50MB 配额是 FileSystem API 的硬限制，超过需 `unlimitedStorage` 或改用 IndexedDB 存 blob

## 5. 视频列表页

`video-list.js`：
- `DB.getAll()` 后倒序渲染
- 缩略图 / 标题 / 时长 / 大小
- 点击进入 `video-react.html?id=`
- 单条删除：先 `fileSaver.remove(fileUrl)` 再 `DB.delete(id)`
- 全部删除：遍历 fileUrl → remove → `DB.deleteAll()`

## 6. 视频详情页（video.js / video-react）

- `video` 元素加载 `currentRecord.fileUrl`
- 改名：`detail.title` 更新 DB
- 下载：
  - `chrome.permissions.request({permissions:["downloads"]})`
  - `getFile(fileUrl)` 转 blob
  - 大文件用 `getSeekableBlob` 修复 webm 元数据
  - `chrome.downloads.download({url, filename, saveAs:true})`，失败降级为 `<a download>`
- 分享：
  - YouTube：`uploadToYoutube(file, progress)` → `https://youtu.be/{id}`
  - Drive：`uploadToGoogleDrive(file, progress)` → `alternateLink`
  - 成功后 `DB.update` 写入 youtubeUrl / gDriveUrl
- 删除：确认后 `DB.delete(id)`
- 缩略图：`canvas` 截取视频首帧 → `fileSaver.save` → `thumbnailUrl`

## 7. WebM Seek 修复

`getSeekableBlob(blob, cb)`：
1. `EBML.Reader` + `EBML.Decoder` 解析 webm 结构
2. `reader.stop()` 后 `EBML.tools.makeMetadataSeekable(metadatas, duration, cues)`
3. 重新编码 metadata 并拼回原数据
4. 得到可拖动进度条的 blob

没有修复前，流式写入的 webm 缺少 duration/cues，播放器无法 seek。

## 8. YouTube / Drive 上传

`upload-video.js`：
- 先 `googleOAuth.autherize()` 拿 access token
- YouTube：`POST https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status`，privacyStatus=Unlisted
- Drive：`MediaUploader` 走 resumable upload（`X-Upload-Content-Length`、`Content-Range`、308 断点续传、指数退避）

OAuth 细节见 `09-隐晦知识点.md`。

## 9. 蒸馏要点

1. 视频本体与元数据分离：FileSystem 存文件，IndexedDB 存记录，删除时两者同步
2. 分片追加写盘是录制不卡顿的关键
3. 本地视频下载前做 EBML seek 修复，体验差异很大
4. 缩略图在 `canplay` 事件后截取
5. 删除所有记录时先删文件再删 DB，顺序不能反
6. 个人插件建议把 `AwesomeScreenshot` 数据库名换成自己的命名空间，避免与原版冲突
