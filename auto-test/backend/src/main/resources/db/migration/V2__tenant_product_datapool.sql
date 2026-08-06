-- ============================================================
-- V2: 多租户 + 产品管理 + 数据池 + 参数化测试
-- 日期: 2026-08-06
-- ============================================================

-- -------------------------------------------
-- 1. test_account 新增字段
-- -------------------------------------------
ALTER TABLE test_account
  ADD COLUMN tenant_id bigint DEFAULT NULL COMMENT '租户ID' AFTER account_code,
  ADD COLUMN product_code varchar(64) DEFAULT NULL COMMENT '所属产品编码' AFTER tenant_id,
  ADD COLUMN login_type varchar(32) DEFAULT 'HTTP' COMMENT '登录类型: HTTP/COOKIE/OAUTH2_CODE/CAS/PLAYWRIGHT/SCRIPT' AFTER auth_type,
  ADD COLUMN login_config json COMMENT '登录详细配置' AFTER auth_config,
  ADD COLUMN login_script text COMMENT '自定义登录脚本（SCRIPT类型使用）' AFTER login_config,
  ADD INDEX idx_tenant (tenant_id),
  ADD INDEX idx_product (product_code);

-- -------------------------------------------
-- 2. test_chain 新增字段
-- -------------------------------------------
ALTER TABLE test_chain
  ADD COLUMN product_code varchar(64) DEFAULT NULL COMMENT '所属产品编码' AFTER tenant_id,
  ADD COLUMN login_chain_code varchar(64) DEFAULT NULL COMMENT '前置登录链路编码' AFTER account_code,
  ADD COLUMN login_timeout int DEFAULT 30000 COMMENT '登录超时(ms)' AFTER login_chain_code,
  ADD COLUMN data_pool_code varchar(64) DEFAULT NULL COMMENT '绑定的数据池编码' AFTER product_code,
  ADD COLUMN param_mode varchar(16) DEFAULT 'NONE' COMMENT '参数模式: NONE=不参数化 FIXED=固定行 DYNAMIC=每轮不同行' AFTER data_pool_code;

-- -------------------------------------------
-- 3. sys_product 产品表（新建）
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS sys_product (
  id bigint NOT NULL AUTO_INCREMENT,
  product_code varchar(64) NOT NULL COMMENT '产品编码（英文标识）',
  product_name varchar(256) NOT NULL COMMENT '产品名称（支持中英文）',
  tenant_id bigint NOT NULL COMMENT '所属租户ID',
  description varchar(512) DEFAULT NULL COMMENT '描述',
  status tinyint DEFAULT 1 COMMENT '状态: 1启用 0禁用',
  create_by varchar(64) DEFAULT NULL COMMENT '创建人',
  create_time datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_code (product_code),
  KEY idx_tenant (tenant_id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品表';

-- -------------------------------------------
-- 4. test_data_pool 数据池主表（新建）
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS test_data_pool (
  id bigint NOT NULL AUTO_INCREMENT,
  pool_code varchar(64) NOT NULL COMMENT '数据池编码',
  pool_name varchar(256) NOT NULL COMMENT '数据池名称（支持中英文）',
  tenant_id bigint DEFAULT NULL COMMENT '租户ID',
  product_code varchar(64) DEFAULT NULL COMMENT '所属产品编码',
  description varchar(512) DEFAULT NULL COMMENT '描述',
  column_defs json NOT NULL COMMENT '列定义 [{"name":"orderId","type":"STRING","label":"订单号","required":true}]',
  status tinyint DEFAULT 1 COMMENT '状态: 1启用 0禁用',
  create_by varchar(64) DEFAULT NULL,
  create_time datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pool_code (pool_code),
  KEY idx_tenant (tenant_id),
  KEY idx_product (product_code),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据池';

-- -------------------------------------------
-- 5. test_data_pool_row 数据池行数据（新建）
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS test_data_pool_row (
  id bigint NOT NULL AUTO_INCREMENT,
  pool_id bigint NOT NULL COMMENT '所属数据池ID',
  row_index int NOT NULL COMMENT '行号（从0开始）',
  row_data json NOT NULL COMMENT '行数据 {"orderId":"12345","productId":"P001"}',
  create_time datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pool_row (pool_id, row_index),
  KEY idx_pool_id (pool_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据池行数据';

-- -------------------------------------------
-- 6. sys_scheduled_task 新增多轮字段
-- -------------------------------------------
ALTER TABLE sys_scheduled_task
  ADD COLUMN round_count int DEFAULT 1 COMMENT '执行轮数（1=单轮）' AFTER interval_minutes,
  ADD COLUMN round_interval_ms int DEFAULT 0 COMMENT '轮次间隔毫秒（0=连续执行）' AFTER round_count,
  ADD COLUMN use_data_pool tinyint DEFAULT 0 COMMENT '是否使用数据池（0=否 1=是）' AFTER round_interval_ms,
  ADD COLUMN data_pool_code varchar(64) DEFAULT NULL COMMENT '数据池编码' AFTER use_data_pool;

-- -------------------------------------------
-- 7. sys_task_execute_log 新增轮次字段
-- -------------------------------------------
ALTER TABLE sys_task_execute_log
  ADD COLUMN round_number int DEFAULT NULL COMMENT '当前轮次' AFTER execution_ids,
  ADD COLUMN total_rounds int DEFAULT NULL COMMENT '总轮数' AFTER round_number;

-- -------------------------------------------
-- 8. test_execute_main 新增关联字段
-- -------------------------------------------
ALTER TABLE test_execute_main
  ADD COLUMN round_number int DEFAULT NULL COMMENT '轮次编号' AFTER chain_code,
  ADD COLUMN task_id bigint DEFAULT NULL COMMENT '关联定时任务ID' AFTER round_number;
