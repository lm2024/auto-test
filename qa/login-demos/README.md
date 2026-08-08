# 登录配置向导测试环境

该目录提供五个可重复启动的登录协议 Demo，以及一个 Selenium Chromium 节点，用于验证登录配置向导的前后端链路。

## 启动

```bash
docker compose up -d --build
```

服务地址：

| 类型 | 地址 | 测试账号 |
| --- | --- | --- |
| 密码登录 | `http://localhost:18101/api/auth/login` | `demo / demo-pass` |
| Cookie 会话 | `http://localhost:18102/api/auth/login` | `demo / demo-pass` |
| OAuth2 客户端模式 | `http://localhost:18103/oauth/token` | `demo-client / demo-secret` |
| CAS REST | `http://localhost:18104/cas` | `demo / demo-pass` |
| 浏览器自动登录 | `http://localhost:18105/login` | `demo / demo-pass` |
| Selenium | `http://localhost:4444` | 无 |

## 测试方式

先运行 Demo 自检：

```bash
./test-demos.sh
```

再启动后端，并配置远程浏览器驱动：

```bash
cd ../../auto-test/backend
BROWSER_LOGIN_REMOTE_URL=http://localhost:4444/wd/hub mvn spring-boot:run
```

进入前端“登录配置向导”，依次填写上表地址，执行登录测试。浏览器模式的 URL 要填写 `http://host.docker.internal:18105/login`，因为 Chromium 运行在 Docker 容器中。

## 测试分层

1. Demo 自检：验证外部协议的成功、失败、Cookie、票据和页面元素行为。
2. 后端集成测试：验证 `login-test` 是否真正调用外部系统、解析 Token/Cookie、处理 HTTP 错误，并清理临时账号。
3. 前端 E2E 测试：验证步骤流转、必填校验、OAuth2 客户端模式无需密码、失败提示和保存条件。

十万级分类场景同样不应一次加载全部数据；分类选择器应使用服务端分页/搜索和按需展开。本登录测试环境采用同样原则：外部系统是独立依赖，测试数据固定且可重复，不把真实系统凭据写入仓库。
