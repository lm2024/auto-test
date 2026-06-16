-- ============================================================
-- 阶段二：数据库变更脚本
-- 后端透传与测试账号管理
-- ============================================================

-- 1. test_chain 表新增字段
ALTER TABLE test_chain
    ADD COLUMN biz_oper_trace_id VARCHAR(64) DEFAULT NULL COMMENT '操作级TraceId，关联一次用户操作的完整链路' AFTER chain_fingerprint,
    ADD COLUMN account_code VARCHAR(64) DEFAULT NULL COMMENT '绑定的测试账号编码' AFTER biz_oper_trace_id,
    ADD COLUMN system_category VARCHAR(64) DEFAULT NULL COMMENT '系统分类' AFTER account_code,
    ADD COLUMN func_category VARCHAR(64) DEFAULT NULL COMMENT '功能分类' AFTER system_category,
    ADD COLUMN priority INT DEFAULT 2 COMMENT '优先级：0=P0核心回归，1=P1常规回归，2=P2低频验证' AFTER func_category;

-- 2. test_node_config 表新增字段
ALTER TABLE test_node_config
    ADD COLUMN biz_oper_trace_id VARCHAR(64) DEFAULT NULL COMMENT '操作级TraceId' AFTER delay_seconds,
    ADD COLUMN trigger_event VARCHAR(32) DEFAULT NULL COMMENT '触发事件类型：click/change/keydown/submit/auto' AFTER biz_oper_trace_id,
    ADD COLUMN target_dom VARCHAR(256) DEFAULT NULL COMMENT '操作DOM选择器' AFTER trigger_event,
    ADD COLUMN page_url VARCHAR(512) DEFAULT NULL COMMENT '当前页面地址' AFTER target_dom,
    ADD COLUMN window_id VARCHAR(64) DEFAULT NULL COMMENT '窗口ID' AFTER page_url,
    ADD COLUMN `ignore` TINYINT DEFAULT 0 COMMENT '是否忽略：0=否，1=是' AFTER window_id;

-- 3. 新增 test_account 表（测试账号管理）
CREATE TABLE IF NOT EXISTS test_account (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    account_code VARCHAR(64) NOT NULL COMMENT '账号编码',
    account_name VARCHAR(128) NOT NULL COMMENT '显示名称',
    system_name VARCHAR(128) DEFAULT NULL COMMENT '所属系统',
    username VARCHAR(128) NOT NULL COMMENT '登录用户名',
    password VARCHAR(256) NOT NULL COMMENT '登录密码（AES加密存储）',
    auth_type VARCHAR(32) NOT NULL COMMENT '认证类型：SSO/PASSWORD/TOKEN/CERTIFICATE',
    auth_config TEXT DEFAULT NULL COMMENT '认证配置JSON：SSO登录地址、token接口等',
    status INT DEFAULT 1 COMMENT '状态：0=禁用，1=可用，2=锁定',
    last_used_time DATETIME DEFAULT NULL COMMENT '最后使用时间',
    lock_until DATETIME DEFAULT NULL COMMENT '锁定截止时间，并发执行时自动锁定',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE INDEX uk_account_code (account_code),
    INDEX idx_status (status),
    INDEX idx_system_name (system_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试账号管理表';

-- 4. 新增 dict_category 表（分类字典）
CREATE TABLE IF NOT EXISTS dict_category (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    category_type VARCHAR(32) NOT NULL COMMENT '分类类型：system=系统分类，func=功能分类',
    category_code VARCHAR(64) NOT NULL COMMENT '分类编码',
    category_name VARCHAR(128) NOT NULL COMMENT '分类名称',
    sort_order INT DEFAULT 0 COMMENT '排序号',
    status INT DEFAULT 1 COMMENT '状态：0=禁用，1=可用',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    UNIQUE INDEX uk_type_code (category_type, category_code),
    INDEX idx_type (category_type),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分类字典表';

-- 5. 初始化分类字典数据
INSERT INTO dict_category (category_type, category_code, category_name, sort_order) VALUES
    ('system', 'user_mgmt', '用户管理', 1),
    ('system', 'order_system', '订单系统', 2),
    ('system', 'payment_system', '支付系统', 3),
    ('system', 'approval_flow', '审批流程', 4),
    ('system', 'data_query', '数据查询', 5),
    ('func', 'login_auth', '登录认证', 1),
    ('func', 'data_query', '数据查询', 2),
    ('func', 'data_create', '数据新增', 3),
    ('func', 'data_update', '数据修改', 4),
    ('func', 'data_delete', '数据删除', 5)
ON DUPLICATE KEY UPDATE category_name = VALUES(category_name);