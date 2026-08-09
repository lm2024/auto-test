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
