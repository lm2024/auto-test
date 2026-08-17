-- ================================================================
-- 01_schema.sql · 数据库结构（DDL）
-- 说明：本目录（docker/sql/）是数据库初始化的唯一权威脚本集合。
--       MySQL 容器首次启动时按文件名顺序自动执行 01 → 02。
--       本文件含建库 + 全部 21 张表：
--         19 张业务表（代码实际使用）+ 2 张回放快照表
--         （test_chain_version / test_node_snapshot，回放功能，代码暂未实现）
-- 手动执行：mysql -uroot -p < 01_schema.sql
-- ================================================================
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS auto_test DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE auto_test;

-- =============================================
-- 分类字典表
-- =============================================
DROP TABLE IF EXISTS `dict_category`;
CREATE TABLE `dict_category` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `category_type` varchar(32) NOT NULL COMMENT '分类类型：system=系统分类，func=功能分类',
  `category_code` varchar(64) NOT NULL COMMENT '分类编码',
  `category_name` varchar(128) NOT NULL COMMENT '分类名称',
  `sort_order` int DEFAULT '0' COMMENT '排序号',
  `status` int DEFAULT '1' COMMENT '状态：0=禁用，1=可用',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_type_code` (`category_type`,`category_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分类字典表';

-- =============================================
-- 系统配置表
-- =============================================
DROP TABLE IF EXISTS `sys_config`;
CREATE TABLE `sys_config` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `config_key` varchar(255) NOT NULL COMMENT '配置键',
  `config_value` longtext COMMENT '配置值',
  `config_desc` varchar(512) DEFAULT NULL COMMENT '配置描述',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- =============================================
-- 测试账号管理表
-- =============================================
DROP TABLE IF EXISTS `test_account`;
CREATE TABLE `test_account` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `account_code` varchar(64) NOT NULL COMMENT '账号编码',
  `account_name` varchar(128) NOT NULL COMMENT '显示名称',
  `tenant_id` bigint DEFAULT NULL COMMENT '租户ID',
  `product_code` varchar(64) DEFAULT NULL COMMENT '所属产品编码',
  `system_name` varchar(128) DEFAULT NULL COMMENT '所属系统',
  `username` varchar(128) NOT NULL COMMENT '登录用户名',
  `password` varchar(256) NOT NULL COMMENT '登录密码（AES加密存储）',
  `auth_type` varchar(32) NOT NULL COMMENT '认证类型：SSO/PASSWORD/TOKEN/CERTIFICATE',
  `auth_config` text COMMENT '认证配置JSON',
  `login_type` varchar(32) DEFAULT 'HTTP' COMMENT '登录类型',
  `login_config` json COMMENT '登录详细配置',
  `login_script` text COMMENT '自定义登录脚本',
  `status` int DEFAULT '1' COMMENT '状态：0=禁用，1=可用，2=锁定',
  `last_used_time` datetime DEFAULT NULL COMMENT '最后使用时间',
  `lock_until` datetime DEFAULT NULL COMMENT '锁定截止时间',
  `valid_from` datetime DEFAULT NULL COMMENT '账号有效期开始',
  `valid_until` datetime DEFAULT NULL COMMENT '账号有效期结束',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_account_code` (`account_code`),
  KEY `idx_status` (`status`),
  KEY `idx_account_tenant` (`tenant_id`),
  KEY `idx_account_product` (`product_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试账号管理表';

-- =============================================
-- 测试账号使用记录表
-- =============================================
DROP TABLE IF EXISTS `test_account_usage`;
CREATE TABLE `test_account_usage` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `account_id` bigint NOT NULL COMMENT '账号ID',
  `account_code` varchar(64) NOT NULL COMMENT '账号编码快照',
  `tenant_id` bigint DEFAULT NULL COMMENT '租户ID',
  `user_id` bigint DEFAULT NULL COMMENT '使用人员ID',
  `operator_name` varchar(128) DEFAULT NULL COMMENT '使用人员或系统名称',
  `execution_id` varchar(32) DEFAULT NULL COMMENT '执行ID',
  `task_id` bigint DEFAULT NULL COMMENT '定时任务ID',
  `chain_code` varchar(64) DEFAULT NULL COMMENT '使用链路',
  `data_pool_code` varchar(64) DEFAULT NULL COMMENT '使用数据池',
  `usage_type` varchar(32) DEFAULT NULL COMMENT '使用类型',
  `status` varchar(16) NOT NULL DEFAULT 'RUNNING' COMMENT '使用状态',
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  `ended_at` datetime DEFAULT NULL COMMENT '结束时间',
  `duration_ms` bigint DEFAULT NULL COMMENT '使用时长毫秒',
  `release_reason` varchar(128) DEFAULT NULL COMMENT '释放原因',
  PRIMARY KEY (`id`),
  KEY `idx_account_usage_account` (`account_id`,`started_at`),
  KEY `idx_account_usage_execution` (`execution_id`),
  KEY `idx_account_usage_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试账号使用记录表';

-- =============================================
-- 数据池主表
-- =============================================
DROP TABLE IF EXISTS `test_data_pool_row`;
DROP TABLE IF EXISTS `test_data_pool`;
CREATE TABLE `test_data_pool` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `pool_code` varchar(64) NOT NULL COMMENT '数据池编码',
  `pool_name` varchar(256) NOT NULL COMMENT '数据池名称',
  `tenant_id` bigint DEFAULT NULL COMMENT '租户ID',
  `product_code` varchar(64) DEFAULT NULL COMMENT '所属产品编码',
  `description` varchar(512) DEFAULT NULL COMMENT '描述',
  `column_defs` json NOT NULL COMMENT '列定义',
  `status` tinyint DEFAULT 1 COMMENT '状态',
  `create_by` varchar(64) DEFAULT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_pool_code` (`pool_code`), KEY `idx_tenant` (`tenant_id`),
  KEY `idx_product` (`product_code`), KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据池';

CREATE TABLE `test_data_pool_row` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `pool_id` bigint NOT NULL COMMENT '所属数据池ID',
  `row_index` int NOT NULL COMMENT '行号',
  `row_data` json NOT NULL COMMENT '行数据',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uk_pool_row` (`pool_id`,`row_index`), KEY `idx_pool_id` (`pool_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据池行数据';

-- =============================================
-- 测试链路表
-- =============================================
DROP TABLE IF EXISTS `test_chain`;
CREATE TABLE `test_chain` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `chain_code` varchar(64) NOT NULL COMMENT '链路编码',
  `chain_name` varchar(128) NOT NULL COMMENT '链路名称',
  `execute_mode` tinyint NOT NULL DEFAULT '1' COMMENT '执行模式: 1=全串行, 2=分组并行',
  `description` text COMMENT '链路描述',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态: 1=启用, 0=禁用',
  `current_version` int NOT NULL DEFAULT '1' COMMENT '当前展示版本号（回放/版本快照功能）',
  `chain_fingerprint` varchar(128) DEFAULT NULL COMMENT '链路指纹(MD5)（回放/版本快照功能）',
  `graph_data` longtext COMMENT 'X6画布图数据(graph.toJSON())，编排与执行顺序的唯一真相来源',
  `biz_oper_trace_id` varchar(64) DEFAULT NULL COMMENT '操作级TraceId，关联一次用户操作的完整链路',
  `account_code` varchar(64) DEFAULT NULL COMMENT '绑定的测试账号编码',
  `system_category` varchar(64) DEFAULT NULL COMMENT '系统分类',
  `func_category` varchar(64) DEFAULT NULL COMMENT '功能分类',
  `priority` int DEFAULT '2' COMMENT '优先级：0=P0核心回归，1=P1常规回归，2=P2低频验证',
  `category_id` bigint DEFAULT NULL COMMENT '树形分类ID',
  `tenant_id` bigint DEFAULT NULL COMMENT '租户ID',
  `product_code` varchar(64) DEFAULT NULL COMMENT '所属产品编码',
  `login_chain_code` varchar(64) DEFAULT NULL COMMENT '前置登录链路编码',
  `login_timeout` int DEFAULT '30000' COMMENT '登录超时(ms)',
  `data_pool_code` varchar(64) DEFAULT NULL COMMENT '绑定的数据池编码',
  `param_mode` varchar(16) DEFAULT 'NONE' COMMENT '参数模式',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_chain_code` (`chain_code`),
  KEY `idx_chain_name` (`chain_name`),
  KEY `idx_execute_mode` (`execute_mode`),
  KEY `idx_create_time` (`create_time`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_product_code` (`product_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试链路表';

-- =============================================
-- 测试节点配置表
-- =============================================
DROP TABLE IF EXISTS `test_node_config`;
CREATE TABLE `test_node_config` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `chain_code` varchar(64) NOT NULL COMMENT '所属链路编码',
  `node_id` bigint NOT NULL COMMENT '节点ID',
  `node_code` varchar(64) NOT NULL COMMENT '节点编码',
  `node_name` varchar(128) NOT NULL COMMENT '节点名称',
  `node_type` varchar(16) NOT NULL DEFAULT 'HTTP' COMMENT '节点类型',
  `interface_scope` varchar(16) DEFAULT NULL COMMENT '内外网范围: INTERNAL=内网, EXTERNAL=外网, UNKNOWN=未识别',
  `target_system` varchar(64) DEFAULT NULL COMMENT '归属系统编码，关联 sys_system_registry.system_code',
  `request_url` text NOT NULL COMMENT '请求URL',
  `request_method` varchar(10) NOT NULL COMMENT '请求方法',
  `request_headers` longtext COMMENT '请求头(JSON格式)',
  `body_type` varchar(32) DEFAULT NULL COMMENT '请求体类型',
  `body_data` longtext COMMENT '请求体内容',
  `extract_rules` longtext COMMENT '变量提取规则(JSON)',
  `assert_rules` longtext COMMENT '断言规则(JSON)',
  `variable_mapping` longtext COMMENT '变量占位符映射(JSON)',
  `delay_seconds` int DEFAULT '0' COMMENT '执行后等待秒数',
  `biz_oper_trace_id` varchar(64) DEFAULT NULL COMMENT '操作级TraceId',
  `trigger_event` varchar(32) DEFAULT NULL COMMENT '触发事件类型',
  `target_dom` varchar(256) DEFAULT NULL COMMENT '操作DOM选择器',
  `page_url` varchar(512) DEFAULT NULL COMMENT '当前页面地址',
  `window_id` varchar(64) DEFAULT NULL COMMENT '窗口ID',
  `is_ignored` tinyint DEFAULT '0' COMMENT '是否忽略',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_chain_node_code` (`chain_code`,`node_code`),
  UNIQUE KEY `uk_chain_node_id` (`chain_code`,`node_id`),
  KEY `idx_chain_code` (`chain_code`),
  KEY `idx_target_system` (`target_system`),
  KEY `idx_interface_scope` (`interface_scope`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试节点配置表';

-- =============================================
-- 执行主日志表
-- =============================================
DROP TABLE IF EXISTS `test_execute_main`;
CREATE TABLE `test_execute_main` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `execution_id` varchar(32) NOT NULL COMMENT '执行ID',
  `chain_code` varchar(64) NOT NULL COMMENT '关联链路编码',
  `round_number` int DEFAULT NULL COMMENT '轮次编号',
  `task_id` bigint DEFAULT NULL COMMENT '关联定时任务ID',
  `status` varchar(16) NOT NULL DEFAULT 'RUNNING' COMMENT '执行状态: RUNNING/SUCCESS/FAILED',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `total_cost_ms` bigint DEFAULT NULL COMMENT '总耗时(毫秒)',
  `error_message` text COMMENT '全局错误信息',
  `node_count` int DEFAULT NULL COMMENT '节点总数',
  `success_count` int DEFAULT NULL COMMENT '成功节点数',
  `fail_count` int DEFAULT NULL COMMENT '失败节点数',
  `skip_count` int DEFAULT NULL COMMENT '跳过节点数',
  `tenant_id` bigint DEFAULT NULL COMMENT '租户ID',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_execution_id` (`execution_id`),
  KEY `idx_chain_code` (`chain_code`),
  KEY `idx_status` (`status`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_chain_status` (`chain_code`,`status`),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='执行主日志表';

-- =============================================
-- 节点明细日志表
-- =============================================
DROP TABLE IF EXISTS `test_node_execute_log`;
CREATE TABLE `test_node_execute_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `execution_id` varchar(32) NOT NULL COMMENT '关联执行ID',
  `node_code` varchar(64) NOT NULL COMMENT '节点编码',
  `node_name` varchar(128) DEFAULT NULL COMMENT '节点名称',
  `status` varchar(16) NOT NULL COMMENT '执行状态',
  `request_url` text COMMENT '请求URL',
  `request_method` varchar(10) DEFAULT NULL COMMENT '请求方法',
  `request_headers` longtext COMMENT '请求头',
  `request_body` longtext COMMENT '请求体',
  `response_code` int DEFAULT NULL COMMENT '响应码',
  `response_headers` longtext COMMENT '响应头',
  `response_body` longtext COMMENT '响应体',
  `cost_ms` bigint DEFAULT NULL COMMENT '执行耗时(毫秒)',
  `error_message` text COMMENT '错误信息',
  `extracted_vars` longtext COMMENT '提取的变量(JSON)',
  `start_time` datetime DEFAULT NULL COMMENT '节点开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '节点结束时间',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `biz_oper_trace_id` varchar(64) DEFAULT NULL COMMENT '业务操作TraceId(用于分组视图)',
  `sort_no` int DEFAULT NULL COMMENT '节点排序号',
  PRIMARY KEY (`id`),
  KEY `idx_execution_id` (`execution_id`),
  KEY `idx_node_code` (`node_code`),
  KEY `idx_execution_node` (`execution_id`,`node_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='节点明细日志表';

-- =============================================
-- 全局变量表（跨链路复用的变量池）
-- =============================================
DROP TABLE IF EXISTS `test_global_variable`;
CREATE TABLE `test_global_variable` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `var_key` varchar(128) NOT NULL COMMENT '变量名，引用方式 ${var_key}',
  `var_value` longtext COMMENT '变量值',
  `var_type` varchar(16) NOT NULL DEFAULT 'STRING' COMMENT '值类型: STRING/NUMBER/BOOLEAN/JSON',
  `scope` varchar(16) NOT NULL DEFAULT 'GLOBAL' COMMENT '作用域: GLOBAL=全局, CHAIN=链路级',
  `chain_code` varchar(64) DEFAULT NULL COMMENT 'scope=CHAIN 时归属的链路编码',
  `is_secret` tinyint NOT NULL DEFAULT '0' COMMENT '是否敏感值: 1=前端脱敏展示',
  `description` varchar(512) DEFAULT NULL COMMENT '变量说明',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态: 1=启用, 0=禁用',
  `tenant_id` bigint DEFAULT NULL COMMENT '租户ID',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_scope_chain_key` (`scope`,`chain_code`,`var_key`),
  KEY `idx_var_key` (`var_key`),
  KEY `idx_chain_code` (`chain_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='全局/链路级变量表';

-- =============================================
-- 系统注册表（内外网识别 + 系统调用关系图的数据源）
-- =============================================
DROP TABLE IF EXISTS `sys_system_registry`;
CREATE TABLE `sys_system_registry` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `system_code` varchar(64) NOT NULL COMMENT '系统编码',
  `system_name` varchar(128) NOT NULL COMMENT '系统名称',
  `scope` varchar(16) NOT NULL DEFAULT 'INTERNAL' COMMENT '内外网: INTERNAL=内网, EXTERNAL=外网',
  `domain_patterns` text COMMENT '域名匹配规则，多个用英文逗号分隔，支持 *.example.com 通配',
  `ip_ranges` text COMMENT 'IP段匹配规则(CIDR)，多个用英文逗号分隔，如 10.0.0.0/8',
  `category` varchar(128) DEFAULT NULL COMMENT '系统分类',
  `owner` varchar(64) DEFAULT NULL COMMENT '负责人',
  `description` varchar(512) DEFAULT NULL COMMENT '系统说明',
  `sort_order` int DEFAULT '0' COMMENT '排序号',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态: 1=启用, 0=禁用',
  `tenant_id` bigint DEFAULT NULL COMMENT '租户ID',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_system_code` (`system_code`),
  KEY `idx_scope` (`scope`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统注册表';

-- =============================================
-- 租户表
-- =============================================
DROP TABLE IF EXISTS `sys_tenant`;
CREATE TABLE `sys_tenant` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `tenant_code` varchar(64) NOT NULL COMMENT '租户编码',
  `tenant_name` varchar(128) NOT NULL COMMENT '租户名称',
  `status` int DEFAULT '1' COMMENT '状态：0=禁用，1=可用',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_code` (`tenant_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户表';

-- =============================================
-- 系统用户表
-- =============================================
DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `username` varchar(64) NOT NULL COMMENT '用户名',
  `password` varchar(256) NOT NULL COMMENT '密码（BCrypt加密）',
  `display_name` varchar(128) DEFAULT NULL COMMENT '显示名称',
  `role` varchar(32) NOT NULL DEFAULT 'USER' COMMENT '角色：ADMIN/USER',
  `tenant_id` bigint DEFAULT NULL COMMENT '所属租户ID',
  `status` int DEFAULT '1' COMMENT '状态：0=禁用，1=可用',
  `last_login_time` datetime DEFAULT NULL COMMENT '最后登录时间',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

-- =============================================
-- SSO用户映射表
-- =============================================
DROP TABLE IF EXISTS `sys_user_sso`;
CREATE TABLE `sys_user_sso` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `user_id` bigint NOT NULL COMMENT '关联用户ID',
  `sso_provider` varchar(64) DEFAULT NULL COMMENT 'SSO提供商',
  `sso_subject` varchar(128) NOT NULL COMMENT 'SSO用户标识',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sso` (`sso_provider`, `sso_subject`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SSO用户映射表';

-- =============================================
-- 树形分类表
-- =============================================
DROP TABLE IF EXISTS `sys_category`;
CREATE TABLE `sys_category` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `parent_id` bigint DEFAULT '0' COMMENT '父分类ID，0表示根节点',
  `category_name` varchar(128) NOT NULL COMMENT '分类名称',
  `sort_order` int DEFAULT '0' COMMENT '排序号',
  `icon` varchar(64) DEFAULT NULL COMMENT '图标',
  `tenant_id` bigint DEFAULT NULL COMMENT '租户ID',
  `status` int DEFAULT '1' COMMENT '状态：0=禁用，1=可用',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_category_tree` (`tenant_id`, `parent_id`, `status`, `sort_order`, `id`),
  KEY `idx_category_name_prefix` (`category_name`),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='树形分类表';

-- =============================================
-- 定时任务表
-- =============================================
DROP TABLE IF EXISTS `sys_scheduled_task`;
CREATE TABLE `sys_scheduled_task` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `task_name` varchar(128) NOT NULL COMMENT '任务名称',
  `task_type` varchar(32) NOT NULL COMMENT '任务类型：SINGLE=单链路，CATEGORY=按分类',
  `chain_code` varchar(64) DEFAULT NULL COMMENT '链路编码（SINGLE类型）',
  `category_id` bigint DEFAULT NULL COMMENT '分类ID（CATEGORY类型）',
  `cron_expression` varchar(64) DEFAULT NULL COMMENT 'Cron表达式',
  `interval_minutes` int DEFAULT NULL COMMENT '间隔分钟数',
  `round_count` int DEFAULT '1' COMMENT '执行轮数',
  `round_interval_ms` int DEFAULT '0' COMMENT '轮次间隔毫秒',
  `use_data_pool` tinyint DEFAULT '0' COMMENT '是否使用数据池',
  `data_pool_code` varchar(64) DEFAULT NULL COMMENT '数据池编码',
  `enabled` int DEFAULT '1' COMMENT '是否启用：0=禁用，1=启用',
  `last_run_time` datetime DEFAULT NULL COMMENT '上次执行时间',
  `next_run_time` datetime DEFAULT NULL COMMENT '下次执行时间',
  `tenant_id` bigint DEFAULT NULL COMMENT '租户ID',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定时任务表';

-- =============================================
-- 定时任务执行日志表
-- =============================================
DROP TABLE IF EXISTS `sys_task_execute_log`;
CREATE TABLE `sys_task_execute_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `task_id` bigint NOT NULL COMMENT '关联任务ID',
  `execution_ids` text COMMENT '执行ID列表（逗号分隔）',
  `status` varchar(16) DEFAULT NULL COMMENT '执行状态',
  `trigger_type` varchar(32) DEFAULT NULL COMMENT '触发类型：SCHEDULED/MANUAL',
  `start_time` datetime DEFAULT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `error_message` text COMMENT '错误信息',
  `round_number` int DEFAULT NULL COMMENT '当前轮次',
  `total_rounds` int DEFAULT NULL COMMENT '总轮数',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_task_id` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定时任务执行日志表';

-- =============================================
-- 产品表（多租户下按产品维度组织链路/账号/数据池）
-- =============================================
DROP TABLE IF EXISTS `sys_product`;
CREATE TABLE `sys_product` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `product_code` varchar(64) NOT NULL COMMENT '产品编码（英文标识）',
  `product_name` varchar(256) NOT NULL COMMENT '产品名称（支持中英文）',
  `tenant_id` bigint NOT NULL COMMENT '所属租户ID',
  `description` varchar(512) DEFAULT NULL COMMENT '描述',
  `status` tinyint DEFAULT 1 COMMENT '状态: 1启用 0禁用',
  `create_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_code` (`product_code`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品表';

-- =============================================
-- 链路版本快照表（回放/版本管理功能）
-- =============================================
DROP TABLE IF EXISTS `test_chain_version`;
CREATE TABLE `test_chain_version` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `chain_code` varchar(64) NOT NULL COMMENT '链路编码',
  `chain_fingerprint` varchar(128) NOT NULL COMMENT '链路指纹(MD5)',
  `version` int NOT NULL COMMENT '版本号',
  `chain_name` varchar(128) DEFAULT NULL COMMENT '链路名称快照',
  `execute_mode` tinyint DEFAULT '1' COMMENT '执行模式: 1=全串行, 2=分组并行',
  `description` text COMMENT '描述',
  `node_snapshot` longtext COMMENT '节点快照JSON',
  `diff_result` longtext COMMENT '与上一版本差异Diff结果JSON',
  `ai_analysis` text COMMENT 'AI分析结果',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '版本状态: ACTIVE/ARCHIVED',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `create_by` varchar(64) DEFAULT NULL COMMENT '创建人',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_chain_version` (`chain_code`,`version`),
  KEY `idx_fingerprint` (`chain_fingerprint`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='链路版本快照表';

-- =============================================
-- 节点快照表（回放/版本管理功能）
-- =============================================
DROP TABLE IF EXISTS `test_node_snapshot`;
CREATE TABLE `test_node_snapshot` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `version_id` bigint NOT NULL COMMENT '关联 test_chain_version.id',
  `chain_code` varchar(64) NOT NULL COMMENT '链路编码',
  `node_id` bigint DEFAULT NULL COMMENT '节点ID',
  `node_code` varchar(64) DEFAULT NULL COMMENT '节点编码',
  `node_name` varchar(128) DEFAULT NULL COMMENT '节点名称',
  `node_type` varchar(16) DEFAULT 'HTTP' COMMENT '节点类型',
  `sort_no` int DEFAULT NULL COMMENT '节点排序号',
  `parallel_group` varchar(32) DEFAULT NULL COMMENT '并行分组',
  `request_url` text COMMENT '请求URL',
  `request_method` varchar(10) DEFAULT NULL COMMENT '请求方法',
  `request_headers` longtext COMMENT '请求头JSON',
  `body_type` varchar(32) DEFAULT NULL COMMENT 'Body类型',
  `body_data` longtext COMMENT '请求体数据',
  `response_code` int DEFAULT NULL COMMENT '响应状态码',
  `response_headers` longtext COMMENT '响应头JSON',
  `response_body` longtext COMMENT '响应体',
  `duration_ms` bigint DEFAULT NULL COMMENT '耗时(ms)',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_version_id` (`version_id`),
  KEY `idx_chain_code` (`chain_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='节点快照表';
