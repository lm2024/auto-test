package com.autotest.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;

/** Repairs columns required by newer plugin payloads when an old database is reused. */
@Component
public class DatabaseCompatibilityInitializer {

    private static final Logger log = LoggerFactory.getLogger(DatabaseCompatibilityInitializer.class);

    private final JdbcTemplate jdbcTemplate;

    public DatabaseCompatibilityInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void repairPluginSchema() {
        addColumnIfMissing("test_account", "tenant_id",
                "ALTER TABLE test_account ADD COLUMN tenant_id bigint DEFAULT NULL COMMENT '租户ID' AFTER account_code");
        addColumnIfMissing("test_account", "product_code",
                "ALTER TABLE test_account ADD COLUMN product_code varchar(64) DEFAULT NULL COMMENT '所属产品编码' AFTER tenant_id");
        addColumnIfMissing("test_account", "login_type",
                "ALTER TABLE test_account ADD COLUMN login_type varchar(32) DEFAULT 'HTTP' COMMENT '登录类型' AFTER auth_type");
        addColumnIfMissing("test_account", "login_config",
                "ALTER TABLE test_account ADD COLUMN login_config json COMMENT '登录详细配置' AFTER auth_config");
        addColumnIfMissing("test_account", "login_script",
                "ALTER TABLE test_account ADD COLUMN login_script text COMMENT '自定义登录脚本' AFTER login_config");
        addColumnIfMissing("test_account", "valid_from",
                "ALTER TABLE test_account ADD COLUMN valid_from datetime DEFAULT NULL COMMENT '账号有效期开始' AFTER lock_until");
        addColumnIfMissing("test_account", "valid_until",
                "ALTER TABLE test_account ADD COLUMN valid_until datetime DEFAULT NULL COMMENT '账号有效期结束' AFTER valid_from");
        createAccountUsageTableIfMissing();
        addColumnIfMissing("test_chain", "product_code",
                "ALTER TABLE test_chain ADD COLUMN product_code varchar(64) DEFAULT NULL COMMENT '所属产品编码' AFTER tenant_id");
        addColumnIfMissing("test_chain", "login_chain_code",
                "ALTER TABLE test_chain ADD COLUMN login_chain_code varchar(64) DEFAULT NULL COMMENT '前置登录链路编码' AFTER account_code");
        addColumnIfMissing("test_chain", "login_timeout",
                "ALTER TABLE test_chain ADD COLUMN login_timeout int DEFAULT 30000 COMMENT '登录超时(ms)' AFTER login_chain_code");
        addColumnIfMissing("test_chain", "data_pool_code",
                "ALTER TABLE test_chain ADD COLUMN data_pool_code varchar(64) DEFAULT NULL COMMENT '绑定的数据池编码' AFTER product_code");
        addColumnIfMissing("test_chain", "param_mode",
                "ALTER TABLE test_chain ADD COLUMN param_mode varchar(16) DEFAULT 'NONE' COMMENT '参数模式' AFTER data_pool_code");
        addColumnIfMissing("sys_system_registry", "category",
                "ALTER TABLE sys_system_registry ADD COLUMN category varchar(128) DEFAULT NULL COMMENT '系统分类' AFTER ip_ranges");
        addColumnIfMissing("sys_scheduled_task", "round_count",
                "ALTER TABLE sys_scheduled_task ADD COLUMN round_count int DEFAULT 1 COMMENT '执行轮数' AFTER interval_minutes");
        addColumnIfMissing("sys_scheduled_task", "round_interval_ms",
                "ALTER TABLE sys_scheduled_task ADD COLUMN round_interval_ms int DEFAULT 0 COMMENT '轮次间隔毫秒' AFTER round_count");
        addColumnIfMissing("sys_scheduled_task", "use_data_pool",
                "ALTER TABLE sys_scheduled_task ADD COLUMN use_data_pool tinyint DEFAULT 0 COMMENT '是否使用数据池' AFTER round_interval_ms");
        addColumnIfMissing("sys_scheduled_task", "data_pool_code",
                "ALTER TABLE sys_scheduled_task ADD COLUMN data_pool_code varchar(64) DEFAULT NULL COMMENT '数据池编码' AFTER use_data_pool");
        addColumnIfMissing("sys_task_execute_log", "round_number",
                "ALTER TABLE sys_task_execute_log ADD COLUMN round_number int DEFAULT NULL COMMENT '当前轮次' AFTER execution_ids");
        addColumnIfMissing("sys_task_execute_log", "total_rounds",
                "ALTER TABLE sys_task_execute_log ADD COLUMN total_rounds int DEFAULT NULL COMMENT '总轮数' AFTER round_number");
        addColumnIfMissing("test_execute_main", "round_number",
                "ALTER TABLE test_execute_main ADD COLUMN round_number int DEFAULT NULL COMMENT '轮次编号' AFTER chain_code");
        addColumnIfMissing("test_execute_main", "task_id",
                "ALTER TABLE test_execute_main ADD COLUMN task_id bigint DEFAULT NULL COMMENT '关联定时任务ID' AFTER round_number");
    }

    private void createAccountUsageTableIfMissing() {
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS test_account_usage (" +
                "id bigint NOT NULL AUTO_INCREMENT, account_id bigint NOT NULL, account_code varchar(64) NOT NULL, " +
                "tenant_id bigint DEFAULT NULL, user_id bigint DEFAULT NULL, operator_name varchar(128) DEFAULT NULL, " +
                "execution_id varchar(32) DEFAULT NULL, task_id bigint DEFAULT NULL, chain_code varchar(64) DEFAULT NULL, " +
                "data_pool_code varchar(64) DEFAULT NULL, usage_type varchar(32) DEFAULT NULL, status varchar(16) NOT NULL DEFAULT 'RUNNING', " +
                "started_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ended_at datetime DEFAULT NULL, duration_ms bigint DEFAULT NULL, " +
                "release_reason varchar(128) DEFAULT NULL, PRIMARY KEY (id), KEY idx_account_usage_account (account_id, started_at), " +
                "KEY idx_account_usage_execution (execution_id), KEY idx_account_usage_tenant (tenant_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试账号使用记录'");
    }

    private void addColumnIfMissing(String table, String column, String alterSql) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                    Integer.class, table, column);
            if (count != null && count == 0) {
                jdbcTemplate.execute(alterSql);
                log.info("Added missing database column {}.{}", table, column);
            }
        } catch (Exception e) {
            log.warn("Could not verify database column {}.{}: {}", table, column, e.getMessage());
        }
    }
}
