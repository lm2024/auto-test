# AGENTS.md - Auto Test 速查（压缩版）

API 自动化测试平台。前后端分离 + 浏览器插件 + WebSocket 实时推送。

## 技术栈（速记）
- 后端：Java 8 / Spring Boot 2.7.7 / MyBatis / MySQL 8.0 / Maven / LangChain4j
- 前端：Vue 3.4 / Vite 5 / Element Plus / LogicFlow / Monaco
- 插件：Chrome MV3
- DB：MySQL 8.0（Docker），utf8mb4，表名大小写不敏感

## 前端（重点：有两个，默认只用一个）
- 目录：`auto-test/auto-test/`
- ✅ **默认前端 = `frontend/`**（Vue 3.4 / Vite 5）—— 所有前端任务、启动、改码、部署默认都用它
- ⚠️ `frontend-vue2/` 是 Vue 2.6 版本，**默认不碰**
- 规则：除非我明确要求「用 Vue2」，否则一律只动 `frontend/`，不要去改 `frontend-vue2/`，也不要把两者混淆

## 端口 & 服务
- 后端 9093 / 前端 9094 / MySQL 3306
- 前端 /api → 9093，/ws → ws://9093（vite 代理仅 dev 生效）

## 每次必做（启动顺序）
1. Docker 起库：`cd docker && docker-compose up -d`
2. 起后端：`mvn spring-boot:run`（或 start-backend.bat）
3. 起前端：`npm install`（仅首次）→ `npm run dev`（或 start-frontend.bat）
- 一键：start.bat / stop.bat / restart.bat
- 改完后端代码要重新编译；改完前端依赖要 npm install
- ⚠️ **前端改完代码，dev 能跑不算过，必须 `npm run build` 也通过才算完**（dev 能跑 ≠ build 能过，高频坑，见下方踩坑）

## 关键配置（改前先看）
- DB：root / AutoTest2026Kp9&Xz* / auto_test
- AI：base-url http://localhost:11434/v1，model qwen-max，timeout 120s
- account.aes-key 必须 16 字节（测试账号密码加密）

## 规则（编码铁律）
1. 类/文档 ≤400 行（硬上限 500），超了拆文件
2. 模块隔离，改动文件不重叠
3. 任务拆到原子级，单会话只干一件
4. Java 驼峰；MyBatis 下划线转驼峰已开
5. 所有 Controller 接口必须有异常兜底
6. 全程 UTF-8

## 踩坑清单（血泪）
- JDK 必须 1.8，版本错编译直接挂
- Docker 没起就起后端 → 连不上库
- 9093/9094 被占 → 先 stop.bat 释放端口
- aes-key 非 16 字节 → 账号加密报错
- 新增前端依赖后必须 npm install 才生效
- **前端 `npm run dev` 能跑但 `npm run build` 失败（用户高频踩坑）**：dev 不校验的隐患（未声明变量、类型错误、import 路径大小写不符、循环依赖、动态引入拼错）只在 build 才爆。改完前端务必跑一次 `npm run build` 验证，别只看 dev 绿灯
- 默认账号密码已改为 Admin@123（原 admin123 弱密码已弃用）
- 内网/离线部署：删 Google Fonts CDN，否则白屏
  （前端 index.html/App.vue/ExecuteDetail.vue/ChainEdit.vue + 插件 sidepanel.html）
- 前端 API/WS 用相对路径；生产静态托管需 nginx 反代 /api、/ws 到 9093
- init.sql 有两份（backend/docker 与外层 docker），改动需保持一致
- 安全密钥 account.aes-key / jwt.secret 是公开默认值；内网可信可暂不改，不可信须换
- sso.* 整段默认关闭，可删

官网
https://github.com/colbymchenry/codegraph
https://tdesign.tencent.com/
https://site.logic-flow.cn/