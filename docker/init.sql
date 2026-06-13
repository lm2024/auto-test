CREATE DATABASE IF NOT EXISTS auto_test DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE auto_test;

-- 测试链路表
CREATE TABLE IF NOT EXISTS test_chain (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    chain_code VARCHAR(64) NOT NULL COMMENT '链路编码',
    chain_name VARCHAR(128) NOT NULL COMMENT '链路名称',
    execute_mode TINYINT NOT NULL DEFAULT 1 COMMENT '执行模式: 1=全串行, 2=分组并行',
    description TEXT COMMENT '链路描述',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    create_by VARCHAR(64) COMMENT '创建人',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1=启用, 0=禁用',
    PRIMARY KEY (id),
    UNIQUE INDEX uk_chain_code (chain_code),
    INDEX idx_chain_name (chain_name),
    INDEX idx_execute_mode (execute_mode),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试链路表';

-- 测试节点配置表
CREATE TABLE IF NOT EXISTS test_node_config (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    chain_code VARCHAR(64) NOT NULL COMMENT '所属链路编码',
    node_id BIGINT NOT NULL COMMENT '节点ID',
    node_code VARCHAR(64) NOT NULL COMMENT '节点编码',
    node_name VARCHAR(128) NOT NULL COMMENT '节点名称',
    node_type VARCHAR(16) NOT NULL DEFAULT 'HTTP' COMMENT '节点类型',
    sort_no INT NOT NULL COMMENT '排序号',
    parallel_group VARCHAR(32) COMMENT '并行分组标识',
    request_url TEXT NOT NULL COMMENT '请求URL',
    request_method VARCHAR(10) NOT NULL COMMENT '请求方法',
    request_headers LONGTEXT COMMENT '请求头(JSON格式)',
    body_type VARCHAR(32) COMMENT '请求体类型',
    body_data LONGTEXT COMMENT '请求体内容',
    extract_rules LONGTEXT COMMENT '变量提取规则(JSON)',
    assert_rules LONGTEXT COMMENT '断言规则(JSON)',
    variable_mapping LONGTEXT COMMENT '变量占位符映射(JSON)',
    delay_seconds INT DEFAULT 0 COMMENT '执行后等待秒数',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE INDEX uk_chain_node_code (chain_code, node_code),
    UNIQUE INDEX uk_chain_sort_no (chain_code, sort_no),
    INDEX idx_chain_code (chain_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试节点配置表';

-- 执行主日志表
CREATE TABLE IF NOT EXISTS test_execute_main (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    execution_id VARCHAR(32) NOT NULL COMMENT '执行ID',
    chain_code VARCHAR(64) NOT NULL COMMENT '关联链路编码',
    status VARCHAR(16) NOT NULL DEFAULT 'RUNNING' COMMENT '执行状态: RUNNING/SUCCESS/FAILED',
    start_time DATETIME NOT NULL COMMENT '开始时间',
    end_time DATETIME COMMENT '结束时间',
    total_cost_ms BIGINT COMMENT '总耗时(毫秒)',
    error_message TEXT COMMENT '全局错误信息',
    node_count INT COMMENT '节点总数',
    success_count INT COMMENT '成功节点数',
    fail_count INT COMMENT '失败节点数',
    skip_count INT COMMENT '跳过节点数',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE INDEX uk_execution_id (execution_id),
    INDEX idx_chain_code (chain_code),
    INDEX idx_status (status),
    INDEX idx_start_time (start_time),
    INDEX idx_chain_status (chain_code, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='执行主日志表';

-- 节点明细日志表
CREATE TABLE IF NOT EXISTS test_node_execute_log (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    execution_id VARCHAR(32) NOT NULL COMMENT '关联执行ID',
    node_code VARCHAR(64) NOT NULL COMMENT '节点编码',
    node_name VARCHAR(128) COMMENT '节点名称',
    status VARCHAR(16) NOT NULL COMMENT '执行状态',
    request_url TEXT COMMENT '请求URL',
    request_method VARCHAR(10) COMMENT '请求方法',
    request_headers LONGTEXT COMMENT '请求头',
    request_body LONGTEXT COMMENT '请求体',
    response_code INT COMMENT '响应码',
    response_headers LONGTEXT COMMENT '响应头',
    response_body LONGTEXT COMMENT '响应体',
    cost_ms BIGINT COMMENT '执行耗时(毫秒)',
    error_message TEXT COMMENT '错误信息',
    extracted_vars LONGTEXT COMMENT '提取的变量(JSON)',
    start_time DATETIME COMMENT '节点开始时间',
    end_time DATETIME COMMENT '节点结束时间',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    INDEX idx_execution_id (execution_id),
    INDEX idx_node_code (node_code),
    INDEX idx_execution_node (execution_id, node_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='节点明细日志表';

-- 系统配置表
CREATE TABLE IF NOT EXISTS sys_config (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    config_key VARCHAR(255) NOT NULL COMMENT '配置键',
    config_value LONGTEXT COMMENT '配置值',
    config_desc VARCHAR(512) COMMENT '配置描述',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';
