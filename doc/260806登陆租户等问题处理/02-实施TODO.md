# 登录兼容 + 多租户 + 参数化测试 — 实施 TODO（v2）

> **基于架构设计文档 v2.0**  
> **日期**: 2026-08-06  
> **总工时估算**: 31 人天（5-6 周）

---

## Phase 1：基础修复 + 租户隔离（Week 1-2）

### 1.1 Bug 修复

- [ ] **修复全局变量加载 bug**
  - 文件: `ExecuteServiceImpl.java` → `executeChainByTraceIdAsync()` 方法
  - 改动: 在创建 ExecutionContext 后（约 line 130），加载全局变量并注入
  ```java
  // 新增代码
  Map<String, Object> globalVars = globalVariableService.loadVariableMap(chainCode);
  context.getVariables().putAll(globalVars);
  ```
  - 验证: 创建全局变量 `testVar=hello`，链路节点 Body 中使用 `${testVar}`，执行后确认替换为 `hello`

### 1.2 数据库 Schema

- [ ] **test_account 新增字段**
  ```sql
  ALTER TABLE test_account 
    ADD COLUMN tenant_id VARCHAR(64) DEFAULT NULL COMMENT '租户编码' AFTER account_code,
    ADD COLUMN product_code VARCHAR(64) DEFAULT NULL COMMENT '所属产品编码' AFTER tenant_id,
    ADD COLUMN login_type VARCHAR(32) DEFAULT 'HTTP' COMMENT '登录类型: HTTP/COOKIE/OAUTH2_CODE/CAS/PLAYWRIGHT/SCRIPT' AFTER auth_type,
    ADD COLUMN login_config JSON COMMENT '登录详细配置' AFTER auth_config,
    ADD COLUMN login_script TEXT COMMENT '自定义登录脚本' AFTER login_config,
    ADD INDEX idx_tenant (tenant_id),
    ADD INDEX idx_product (product_code);
  ```

- [ ] **test_global_variable 补映射**
  - 数据库已有 `tenant_id` 列
  - 文件: `TestGlobalVariable.java` — 新增 `tenantId` 字段
  - 文件: `TestGlobalVariableMapper.xml` — ResultMap 加 `tenant_id` 映射

- [ ] **test_execute_main 补映射**
  - 数据库已有 `tenant_id` 列
  - 文件: `TestExecuteMain.java` — 新增 `tenantId`, `roundNumber`, `taskId` 字段
  - 文件: `TestExecuteMainMapper.xml` — ResultMap + INSERT 加映射

- [ ] **test_chain 新增字段**
  ```sql
  ALTER TABLE test_chain
    ADD COLUMN product_code VARCHAR(64) DEFAULT NULL COMMENT '所属产品编码' AFTER tenant_id,
    ADD COLUMN login_chain_code VARCHAR(64) DEFAULT NULL COMMENT '前置登录链路编码' AFTER account_code,
    ADD COLUMN login_timeout INT DEFAULT 30000 COMMENT '登录超时(ms)' AFTER login_chain_code,
    ADD COLUMN data_pool_code VARCHAR(64) DEFAULT NULL COMMENT '绑定的数据池编码' AFTER product_code,
    ADD COLUMN param_mode VARCHAR(16) DEFAULT 'NONE' COMMENT '参数模式: NONE/FIXED/DYNAMIC' AFTER data_pool_code;
  ```

- [ ] **创建 sys_product 表**
  ```sql
  CREATE TABLE sys_product (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_code VARCHAR(64) NOT NULL COMMENT '产品编码',
    product_name VARCHAR(256) NOT NULL COMMENT '产品名称（支持中英文）',
    tenant_id VARCHAR(64) NOT NULL COMMENT '所属租户编码',
    description VARCHAR(512) DEFAULT NULL COMMENT '描述',
    status TINYINT DEFAULT 1 COMMENT '状态: 1启用 0禁用',
    create_by VARCHAR(64) DEFAULT NULL COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_product_code (product_code),
    INDEX idx_tenant (tenant_id),
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品表';
  ```

- [ ] **创建 test_data_pool 表**
  ```sql
  CREATE TABLE test_data_pool (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pool_code VARCHAR(64) NOT NULL COMMENT '数据池编码',
    pool_name VARCHAR(256) NOT NULL COMMENT '数据池名称（支持中英文）',
    tenant_id VARCHAR(64) DEFAULT NULL COMMENT '租户编码',
    description VARCHAR(512) DEFAULT NULL COMMENT '描述',
    column_defs JSON NOT NULL COMMENT '列定义',
    status TINYINT DEFAULT 1 COMMENT '状态: 1启用 0禁用',
    create_by VARCHAR(64) DEFAULT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_pool_code (pool_code),
    INDEX idx_tenant (tenant_id),
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据池';
  ```

- [ ] **创建 test_data_pool_row 表**
  ```sql
  CREATE TABLE test_data_pool_row (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pool_id BIGINT NOT NULL COMMENT '所属数据池 ID',
    row_index INT NOT NULL COMMENT '行号（从 0 开始）',
    row_data JSON NOT NULL COMMENT '行数据',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_pool_row (pool_id, row_index),
    INDEX idx_pool_id (pool_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据池行数据';
  ```

- [ ] **sys_scheduled_task 新增多轮字段**
  ```sql
  ALTER TABLE sys_scheduled_task
    ADD COLUMN round_count INT DEFAULT 1 COMMENT '执行轮数' AFTER interval_minutes,
    ADD COLUMN round_interval_ms INT DEFAULT 0 COMMENT '轮次间隔(ms)' AFTER round_count,
    ADD COLUMN use_data_pool TINYINT DEFAULT 0 COMMENT '是否使用数据池' AFTER round_interval_ms,
    ADD COLUMN data_pool_code VARCHAR(64) DEFAULT NULL COMMENT '数据池编码' AFTER use_data_pool;
  ```

- [ ] **sys_task_execute_log 新增轮次字段**
  ```sql
  ALTER TABLE sys_task_execute_log
    ADD COLUMN round_number INT DEFAULT NULL COMMENT '当前轮次' AFTER execution_ids,
    ADD COLUMN total_rounds INT DEFAULT NULL COMMENT '总轮数' AFTER round_number;
  ```

### 1.3 租户上下文 + 拦截器

- [ ] **新建 TenantContext**
  - 文件: `com/autotest/context/TenantContext.java`
  - 功能: ThreadLocal 存储当前请求的 tenantId

- [ ] **改造 JwtAuthFilter**
  - 文件: `JwtAuthFilter.java`
  - 改动: 解析 JWT 时提取 tenantId，设置到 TenantContext
  - finally 块中 clear()

- [ ] **新建 TenantInterceptor**
  - 文件: `com/autotest/config/TenantInterceptor.java`
  - 功能: MyBatis 拦截器，自动在 SQL 中注入 `WHERE tenant_id = ?`
  - 白名单: test_chain, test_account, test_global_variable, test_execute_main, sys_category, sys_scheduled_task, sys_product, test_data_pool
  - 忽略: sys_tenant, sys_config, sys_user, dict_category

- [ ] **注册拦截器**
  - 文件: `MyBatisConfig.java` 或 `application.yml`

### 1.4 租户管理后端

- [ ] **新建 SysTenant 实体**
  - 文件: `com/autotest/model/entity/SysTenant.java`
  - 字段: id, tenantCode, tenantName, status, createTime, updateTime

- [ ] **新建 TenantMapper + TenantMapper.xml**
  - CRUD + 分页查询

- [ ] **新建 TenantService + TenantServiceImpl**
  - createTenant, updateTenant, deleteTenant, listTenants

- [ ] **新建 TenantController**
  - `POST /api/tenant/create`
  - `PUT /api/tenant/update`
  - `DELETE /api/tenant/delete`
  - `GET /api/tenant/list`

### 1.5 产品管理后端

- [ ] **新建 SysProduct 实体**
  - 文件: `com/autotest/model/entity/SysProduct.java`
  - 字段: id, productCode, productName, tenantId, description, status, createBy, createTime, updateTime

- [ ] **新建 ProductMapper + ProductMapper.xml**

- [ ] **新建 ProductService + ProductServiceImpl**

- [ ] **新建 ProductController**
  - `POST /api/product/create`
  - `PUT /api/product/update`
  - `DELETE /api/product/delete`
  - `GET /api/product/list`（按 tenant_id 过滤）

### 1.6 租户/产品管理前端

- [ ] **租户管理页面**
  - 文件: `frontend/src/views/TenantManage.vue`
  - 列表: t-table + 搜索 + 分页 + ActionMenu
  - 新增/编辑: t-dialog + t-form
  - 组件: 遵循 ChainList.vue 模式

- [ ] **产品管理页面**
  - 文件: `frontend/src/views/ProductManage.vue`
  - 列表: t-table + 租户筛选 + 搜索 + 分页
  - 新增/编辑: t-dialog + t-form + 租户选择器

- [ ] **路由注册**
  - 文件: `frontend/src/router/index.js`
  - 新增: `/tenant/list`, `/product/list`

- [ ] **菜单注册**
  - 文件: `App.vue` 侧边栏
  - 新增: "租户管理"、"产品管理"（管理员可见）

---

## Phase 2：登录兼容（Week 3-4）

### 2.1 AuthService 增强

- [ ] **扩展 AuthType 枚举**
  - 新增: `COOKIE`, `OAUTH2_CODE`, `CAS`, `PLAYWRIGHT`, `SCRIPT`
  - 文件: AuthType 定义文件

- [ ] **实现 COOKIE 登录类型**
  - 文件: `AuthServiceImpl.java`
  - 逻辑: POST 登录 → 解析 Set-Cookie → 提取 session cookie → 存入结果
  - 返回: `{token: "...", cookies: {SESSION: "xxx", JSESSIONID: "yyy"}}`

- [ ] **实现 OAUTH2_CODE 登录类型**
  - 文件: `AuthServiceImpl.java`
  - 逻辑: 构造授权 URL → 获取授权码（需浏览器）→ 用 code 换 token

- [ ] **实现 CAS 登录类型**
  - 文件: `AuthServiceImpl.java`
  - 逻辑: CAS 协议 REST API 登录

- [ ] **实现 CookieSessionManager**
  - 新建文件: `com/autotest/auth/CookieSessionManager.java`
  - 功能: Cookie 存储、注入请求、过期检测、自动续期

### 2.2 Playwright 引擎

- [ ] **添加 Maven 依赖**
  ```xml
  <dependency>
      <groupId>com.microsoft.playwright</groupId>
      <artifactId>playwright</artifactId>
      <version>1.44.0</version>
  </dependency>
  ```

- [ ] **新建 PlaywrightLoginService**
  - 新建文件: `com/autotest/service/impl/PlaywrightLoginService.java`
  - 功能: 启动浏览器 → 打开登录页 → 填表 → 点击 → 等待 → 提取 token/cookie
  - 支持: localStorage 提取、Cookie 提取、元素文本提取、页面截图

- [ ] **Playwright 环境配置**
  - Docker 镜像中预装 Playwright + Chromium
  - 或提供手动安装脚本

### 2.3 Chrome 插件 Cookie 增强

- [ ] **manifest.json 新增 cookies 权限**
  ```json
  "permissions": ["storage", "sidePanel", "debugger", "activeTab", "tabs", "scripting", "cookies"]
  ```

- [ ] **增强 extractAuthTokens**
  - 文件: `background.js`
  - 改动: 移除 cookie 名称白名单限制，解析所有 Set-Cookie
  - 新增: 解析 cookie 的 domain、path、secure、httpOnly、sameSite、过期时间

- [ ] **Cookie 持久化**
  - 文件: `background.js`
  - 改动: capturedTokens 保存到 chrome.storage.local
  - 启动时从 storage 恢复

- [ ] **推送数据增加 Cookie 字段**
  - 文件: `sidepanel.js` → `doPush()`
  - 新增: `authContext.cookies` 字段
  - 新增: 每个 API 的 `requestCookies` 字段

- [ ] **HTTP 回放增加 Cookie 注入**
  - 文件: `sidepanel.js` → `httpReplay()`
  - 改动: 从 authContext.cookies 构造 Cookie 头

- [ ] **后端接收 Cookie 数据**
  - 文件: `PluginController.java`
  - 改动: PluginChainCreateDTO 增加 authContext 字段
  - 文件: `ChainServiceImpl.java`
  - 改动: 保存 authContext 到链路或账号配置

### 2.4 登录链路机制

- [ ] **实现同步链路执行**
  - 文件: `ExecuteServiceImpl.java`
  - 新增方法: `executeChainSync(String chainCode)` — 同步执行并返回 ExecutionContext
  - 复用现有异步逻辑，但用 Future.get() 等待完成

- [ ] **实现 executeLoginChain**
  - 文件: `ExecuteServiceImpl.java`
  - 新增方法: `executeLoginChain(TestChain chain, ExecutionContext context)`
  - 逻辑: 执行登录链路 → 提取变量 → 合并到主链路上下文

- [ ] **改造 executeChainByTraceIdAsync**
  - 文件: `ExecuteServiceImpl.java`
  - 改动: 在获取 token 之前调用 executeLoginChain

### 2.5 登录配置向导前端

- [ ] **新建 LoginWizard.vue**
  - 文件: `frontend/src/views/LoginWizard.vue`
  - 三步向导: 选择方式 → 配置参数 → 验证保存
  - 使用 TDesign t-steps 组件（如无则用自定义步骤条）
  - 步骤一: 6 种登录方式卡片选择
  - 步骤二: 根据选择动态渲染配置表单
  - 步骤三: 测试账号输入 + 执行测试 + 结果展示

- [ ] **路由注册**
  - 文件: `frontend/src/router/index.js`
  - 新增: `/account/login-wizard`

- [ ] **菜单注册**
  - 文件: `App.vue` 侧边栏
  - 新增: "登录配置向导"（所有用户可见）

### 2.6 账号管理页面改造

- [ ] **AccountList.vue 增加列**
  - 新增列: 登录类型（带图标标签）、所属产品
  - 筛选器: 登录类型下拉筛选

- [ ] **Account 新增/编辑对话框改造**
  - 增加标签页: 基本信息、登录配置、高级设置
  - 登录方式选择: 7 种 radio button
  - 每种方式动态渲染对应配置表单
  - 底部: "不知道选哪个？使用登录配置向导 →" 链接

### 2.7 链路编辑器改造

- [ ] **ChainEdit.vue 属性面板增加配置**
  - 新增区域: "认证配置"
  - 前置登录链路选择器（下拉，只显示标记为"登录链路"的 Chain）
  - 测试账号选择器（现有功能，移到此区域）
  - 新增区域: "参数化配置"
  - 数据池选择器（下拉，显示当前产品下的数据池）
  - 参数模式选择（不参数化 / 每轮不同行）

---

## Phase 3：参数化测试（Week 5-6）

### 3.1 数据池后端

- [ ] **新建 DataPool 实体**
  - 文件: `com/autotest/model/entity/TestDataPool.java`
  - 字段: id, poolCode, poolName, tenantId, description, columnDefs, status, createBy, createTime, updateTime

- [ ] **新建 DataPoolRow 实体**
  - 文件: `com/autotest/model/entity/TestDataPoolRow.java`
  - 字段: id, poolId, rowIndex, rowData, createTime

- [ ] **新建 DataPoolMapper + DataPoolMapper.xml**

- [ ] **新建 DataPoolRowMapper + DataPoolRowMapper.xml**

- [ ] **新建 DataPoolService + DataPoolServiceImpl**
  - 核心方法:
    - `getRowVars(poolCode, rowIndex)` → `Map<String, Object>`（从 JSON 行数据提取变量）
    - `importCsv(poolCode, file)` → 批量导入
    - `exportCsv(poolCode)` → 导出 CSV
    - `getColumnDefs(poolCode)` → 列定义

- [ ] **新建 DataPoolController**
  - `POST /api/datapool/create`
  - `PUT /api/datapool/update`
  - `DELETE /api/datapool/delete`
  - `GET /api/datapool/list`
  - `POST /api/datapool/import`（CSV 导入）
  - `GET /api/datapool/export/{poolCode}`（CSV 导出）
  - `POST /api/datapool/row/add`
  - `DELETE /api/datapool/row/delete`
  - `PUT /api/datapool/row/update`
  - `GET /api/datapool/row/list`（分页查询行数据）

### 3.2 执行引擎改造

- [ ] **新增 runChainWithParams 方法**
  - 文件: `ExecuteServiceImpl.java`
  - 签名: `runChainWithParams(String chainCode, int roundIndex, String taskExecutionId)`
  - 逻辑: 加载链路 → 加载全局变量 → 执行登录链路 → 获取 token → 注入数据池参数 → 执行节点

### 3.3 多轮调度

- [ ] **改造 ScheduledTaskServiceImpl.executeTask**
  - 文件: `ScheduledTaskServiceImpl.java`
  - 改动: 支持 round_count 循环，每轮调用 runChainWithParams
  - 新增: 轮次间隔等待逻辑

### 3.4 轮次追踪

- [ ] **改造 SysTaskExecuteLog 实体**
  - 新增字段: roundNumber, totalRounds

- [ ] **改造 TestExecuteMain 实体**
  - 新增字段: roundNumber, taskId

- [ ] **改造相关 Mapper XML**
  - INSERT/UPDATE/SELECT 加入新字段

### 3.5 数据池前端

- [ ] **数据池列表页面**
  - 文件: `frontend/src/views/DataPoolList.vue`
  - 列表: t-card + 产品筛选 + 搜索
  - 每个数据池卡片: 名称、编码、列数、行数、操作按钮

- [ ] **数据池编辑器页面**
  - 文件: `frontend/src/views/DataPoolEditor.vue`
  - 表格编辑: t-table 可编辑列
  - 列定义管理: 添加/删除/编辑列
  - 行数据管理: 添加/删除/编辑行
  - CSV 导入: t-upload 组件
  - CSV 导出: 下载按钮

- [ ] **路由注册**
  - `/datapool/list`, `/datapool/edit/:poolCode`

### 3.6 定时任务前端改造

- [ ] **ScheduledTask.vue 增加多轮配置**
  - 新增标签页: "多轮配置"
  - 字段: 执行轮数(t-input-number)、轮次间隔(t-input-number)、是否使用数据池(t-switch)、数据池选择(t-select)

- [ ] **执行日志增加轮次展示**
  - 列表增加: 轮次/总轮数 列
  - 详情增加: 当前轮次信息

### 3.7 端到端测试

- [ ] **测试全局变量加载** — 确认 bug 已修复
- [ ] **测试租户隔离** — 不同租户看不到彼此数据
- [ ] **测试产品管理** — CRUD + 按租户过滤
- [ ] **测试密码登录** — PASSWORD 类型 token 获取
- [ ] **测试 Cookie 登录** — COOKIE 类型会话管理
- [ ] **测试 Playwright 登录** — 浏览器自动化登录
- [ ] **测试登录链路** — 前置链路执行 + 变量传递
- [ ] **测试 Chrome 插件 Cookie** — 录制 → 推送 → 回放
- [ ] **测试数据池 CRUD** — 导入/导出/编辑
- [ ] **测试参数化执行** — 同一链路不同参数
- [ ] **测试定时任务多轮** — N 轮执行 + 轮次追踪
- [ ] **测试登录配置向导** — 新手引导流程

---

## 已确认的 Bug 清单

| Bug | 位置 | 严重程度 | Phase |
|-----|------|---------|-------|
| 全局变量在执行时不加载 | `ExecuteServiceImpl.java` | 高 | Phase 1.1 |
| cron_expression 是死代码 | `ScheduledTaskServiceImpl.java` | 低 | 可选修复 |
| test_account 无 tenant_id | DB Schema | 高 | Phase 1.2 |
| test_global_variable 实体未映射 tenant_id | Entity + Mapper | 中 | Phase 1.2 |
| test_execute_main 实体未映射 tenant_id | Entity + Mapper | 中 | Phase 1.2 |
| test_chain 查询无 tenant 过滤 | Mapper XML | 高 | Phase 1.3（拦截器自动处理） |
| Chrome 插件无 cookies 权限 | manifest.json | 高 | Phase 2.3 |
| Chrome 插件 capturedTokens 不持久化 | background.js | 中 | Phase 2.3 |
| 执行引擎无 Cookie Jar | ExecuteServiceImpl | 高 | Phase 2.4 |
| 执行引擎禁用重定向 | ExecuteServiceImpl | 中 | Phase 2.4 |
