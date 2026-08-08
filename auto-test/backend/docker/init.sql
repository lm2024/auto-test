-- =============================================
-- 回放功能 - 数据库初始化脚本
-- =============================================

-- 插件推送依赖字段（兼容复用旧库）
ALTER TABLE test_chain ADD COLUMN IF NOT EXISTS product_code varchar(64) DEFAULT NULL COMMENT '所属产品编码' AFTER tenant_id;
ALTER TABLE test_chain ADD COLUMN IF NOT EXISTS login_chain_code varchar(64) DEFAULT NULL COMMENT '前置登录链路编码' AFTER account_code;
ALTER TABLE test_chain ADD COLUMN IF NOT EXISTS login_timeout int DEFAULT 30000 COMMENT '登录超时(ms)' AFTER login_chain_code;
ALTER TABLE test_chain ADD COLUMN IF NOT EXISTS data_pool_code varchar(64) DEFAULT NULL COMMENT '绑定的数据池编码' AFTER product_code;
ALTER TABLE test_chain ADD COLUMN IF NOT EXISTS param_mode varchar(16) DEFAULT 'NONE' COMMENT '参数模式' AFTER data_pool_code;

-- 1. test_chain 添加字段
ALTER TABLE test_chain ADD COLUMN current_version INT DEFAULT NULL COMMENT '当前展示版本号' AFTER status;
ALTER TABLE test_chain ADD COLUMN chain_fingerprint VARCHAR(64) DEFAULT NULL COMMENT '链路指纹MD5' AFTER current_version;

-- 1.1 test_node_config 添加字段
ALTER TABLE test_node_config ADD COLUMN delay_seconds INT DEFAULT NULL COMMENT '延迟秒数' AFTER variable_mapping;

-- 2. 创建版本快照表
ALTER TABLE sys_category ADD INDEX IF NOT EXISTS idx_category_tree (tenant_id, parent_id, status, sort_order, id);
ALTER TABLE sys_category ADD INDEX IF NOT EXISTS idx_category_name_prefix (category_name);

-- 2. 创建版本快照表
CREATE TABLE IF NOT EXISTS test_chain_version (
    id BIGINT(20) NOT NULL AUTO_INCREMENT,
    chain_code VARCHAR(64) NOT NULL COMMENT '链路编码',
    chain_fingerprint VARCHAR(64) DEFAULT NULL COMMENT '链路指纹MD5',
    version INT(11) NOT NULL COMMENT '版本号',
    chain_name VARCHAR(128) DEFAULT NULL COMMENT '链路名称快照',
    execute_mode TINYINT(1) DEFAULT 1 COMMENT '执行模式 1顺序 2并行',
    description TEXT COMMENT '描述',
    node_snapshot MEDIUMTEXT COMMENT '节点快照JSON',
    diff_result MEDIUMTEXT COMMENT '与上一版本差异JSON',
    ai_analysis MEDIUMTEXT COMMENT 'AI分析结果',
    status VARCHAR(20) DEFAULT 'active' COMMENT '版本状态',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    create_by VARCHAR(64) DEFAULT NULL COMMENT '创建人',
    PRIMARY KEY (id),
    UNIQUE KEY uk_chain_version (chain_code, version),
    KEY idx_chain_code (chain_code),
    KEY idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='链路版本快照';

-- 3. 创建节点快照表
CREATE TABLE IF NOT EXISTS test_node_snapshot (
    id BIGINT(20) NOT NULL AUTO_INCREMENT,
    version_id BIGINT(20) NOT NULL COMMENT '版本ID',
    chain_code VARCHAR(64) NOT NULL COMMENT '链路编码',
    node_id BIGINT(20) DEFAULT NULL COMMENT '节点ID',
    node_code VARCHAR(64) DEFAULT NULL COMMENT '节点编码',
    node_name VARCHAR(128) DEFAULT NULL COMMENT '节点名称',
    node_type VARCHAR(32) DEFAULT NULL COMMENT '节点类型',
    sort_no INT(11) DEFAULT 0 COMMENT '排序号',
    parallel_group VARCHAR(64) DEFAULT NULL COMMENT '并行组',
    request_url TEXT COMMENT '请求URL',
    request_method VARCHAR(16) DEFAULT NULL COMMENT '请求方法',
    request_headers MEDIUMTEXT COMMENT '请求头JSON',
    body_type VARCHAR(32) DEFAULT NULL COMMENT '请求体类型',
    body_data MEDIUMTEXT COMMENT '请求体数据',
    response_code INT(11) DEFAULT NULL COMMENT '响应状态码',
    response_headers MEDIUMTEXT COMMENT '响应头JSON',
    response_body MEDIUMTEXT COMMENT '响应体',
    duration_ms BIGINT(20) DEFAULT NULL COMMENT '耗时ms',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    KEY idx_version_id (version_id),
    KEY idx_chain_code (chain_code),
    KEY idx_node_id (node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='节点快照';
