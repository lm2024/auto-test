# 阶段四详细设计文档 - SSO认证与加密请求处理

# 概述

阶段四处理高级认证场景：统一认证(SSO)多轮跳转捕获、Token 自动提取与过期重登、加密请求解密、前端菜单优化。

涉及文件清单：
- plugin-test/inject.js（改造：加密请求解密执行）
- plugin-test/background.js（改造：SSO 跳转跟踪、Token 提取）
- plugin-test/sidepanel.js（改造：加密配置 UI、Token 管理）
- plugin-test/sidepanel.html（改造：设置面板新增加密和 SSO 区域）
- frontend/src/App.vue（改造：菜单折叠/调整宽度）
- backend 新增：controller/AuthController.java
- backend 新增：service/AuthService.java
- backend 新增：service/impl/AuthServiceImpl.java

# 一、SSO 多轮跳转捕获

SSO 登录流程分析：
1. 用户访问受保护页面 → 重定向到 SSO 登录页
2. 用户在 SSO 登录页输入凭证 → SSO 验证通过
3. SSO 重定向回原页面，携带 ticket/code 参数
4. 原页面用 ticket/code 换取 token/session

捕获方案：
- background.js 通过 CDP debugger 跟踪所有 tab 的网络请求
- Network.requestWillBeSent 事件中检测重定向链：
  - 检查 responseHeaders 中的 Location 字段
  - 如果是 302/301 重定向，记录重定向链
- 重定向链中的所有请求都携带 bizOperTraceId
- 从最终响应中提取认证信息

Token 自动提取规则：
- 从 Set-Cookie 响应头提取 cookie 值
- 从 Authorization 请求头提取 Bearer token
- 从响应体 JSON 中提取 token、access_token、refresh_token 字段
- 从 URL 查询参数中提取 access_token、code 字段
- 使用正则表达式匹配 JWT 格式：/eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]+/

Token 存储：
- 提取的 token 存入插件内存 currentAuthContext 对象
- 包含：accessToken、refreshToken、expiresAt、tokenType、cookies
- 推送到后端时携带 authContext 字段

Token 过期处理：
- 从 JWT payload 解析 exp 字段获取过期时间
- 回放时检测 token 是否过期
- 过期时重新执行 SSO 登录流程
- 后端提供 /api/auth/token 接口，根据账号自动获取新 token

# 二、加密请求解密

加密场景分析：
- 请求体加密：应用层加密（AES/RSA/SM4），在 fetch/XHR 发送前加密
- 响应体加密：服务端返回加密数据，前端解密后使用
- TLS 加密：浏览器扩展在应用层拦截，不受 TLS 影响

解密配置：
- 插件设置面板新增"加密请求处理"区域
- 用户可配置：
  - 请求体解密函数（JavaScript 函数字符串）
  - 响应体解密函数（JavaScript 函数字符串）
  - 加密算法标识（AES/RSA/SM4/自定义）

沙箱执行（参考 Katalon Recorder 的 sandbox.js）：
- 新增 sandbox.html 文件，通过 iframe 加载
- 解密函数在 iframe sandbox 中执行，避免安全风险
- 通过 postMessage 通信：发送加密数据，接收解密结果
- iframe sandbox 属性：sandbox="allow-scripts"

执行流程：
1. inject.js 捕获请求/响应
2. 如果配置了加密解密函数，通过 content.js 发送到 background.js
3. background.js 将数据发送到 sandbox iframe
4. sandbox iframe 执行解密函数，返回明文
5. 明文数据存入请求对象的 decryptedBody/decryptedResponse 字段

# 三、前端菜单优化

App.vue 改造：
- el-aside 组件增加折叠状态管理
- 新增折叠按钮（汉堡菜单图标）
- 折叠时 width="64"，仅显示图标
- 展开时 width="240"，显示图标+文字
- 菜单状态持久化到 localStorage

拖拽调整宽度：
- 在菜单右侧增加拖拽条（resize handle）
- mousedown 事件开始拖拽
- mousemove 事件实时更新 width
- mouseup 事件结束拖拽
- 宽度范围限制：64px ~ 400px
- 宽度状态持久化到 localStorage

CSS 改造：
- .app-aside 增加 transition: width 0.3s
- 折叠时 .el-menu-item 仅显示图标，文字隐藏
- 拖拽条样式：宽度 4px，hover 时变色

# 四、后端 AuthController

路由前缀：/api/auth

接口列表：
- POST /api/auth/token → 根据账号编码获取 token
  参数：accountCode
  流程：
  1. 根据 accountCode 查询 test_account
  2. 根据 authType 调用对应的认证接口
  3. SSO：调用 SSO 登录接口获取 token
  4. PASSWORD：调用登录接口获取 token
  5. TOKEN：直接返回配置的 token
  6. 返回 token 信息

- POST /api/auth/refresh → 刷新 token
  参数：accountCode、refreshToken
  流程：
  1. 调用 token 刷新接口
  2. 返回新 token

- GET /api/auth/validate → 验证 token 有效性
  参数：token
  流程：
  1. 解析 JWT
  2. 检查过期时间
  3. 返回有效性

# 五、测试验证点

SSO 验证：
1. 多轮跳转后 token 正确提取
2. Token 存入 authContext 正确
3. 回放时 token 过期自动重登
4. 跨域跳转场景正常工作

加密请求验证：
1. AES 加密请求体解密正确
2. RSA 加密请求体解密正确
3. 响应体解密正确
4. 沙箱执行不泄露数据

菜单优化验证：
1. 折叠/展开动画流畅
2. 拖拽调整宽度正常
3. 宽度状态持久化
4. 折叠后菜单项仅显示图标
