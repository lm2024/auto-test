package com.autotest.config;

import com.autotest.context.TenantContext;
import org.apache.ibatis.executor.statement.StatementHandler;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.plugin.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.sql.Connection;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * MyBatis 租户隔离拦截器。
 *
 * 工作原理：
 * 1. 拦截所有 SQL 执行
 * 2. 解析 SQL 中涉及的表名
 * 3. 如果表在"租户隔离白名单"中，自动注入 WHERE tenant_id = ?
 * 4. 白名单机制：只有明确声明需要隔离的表才会被拦截，新表默认不过滤
 *
 * 注意：此拦截器仅处理简单的单表查询。对于 JOIN 查询，需要确保主表在白名单中。
 * 如果遇到复杂 SQL 导致的兼容性问题，可以在白名单中移除该表，改为在 Mapper 中手动过滤。
 */
@Component
@Intercepts({
    @Signature(type = StatementHandler.class, method = "prepare",
               args = {Connection.class, Integer.class})
})
public class TenantInterceptor implements Interceptor {

    private static final Logger log = LoggerFactory.getLogger(TenantInterceptor.class);

    /**
     * 需要租户隔离的表（白名单）
     * 只有这里的表才会自动注入 tenant_id 过滤条件
     */
    private static final Set<String> TENANT_TABLES = Collections.unmodifiableSet(
        new HashSet<>(Arrays.asList(
            "test_chain",
            "test_account",
            "test_execute_main",
            "sys_category",
            "sys_scheduled_task",
            "sys_product",
            "test_data_pool"
            // 注意：test_global_variable 不加入此列表，因为全局变量是跨租户共享的
        ))
    );

    /**
     * 完全忽略的表（全局数据，不隔离）
     */
    private static final Set<String> IGNORE_TABLES = Collections.unmodifiableSet(
        new HashSet<>(Arrays.asList(
            "sys_tenant",
            "sys_config",
            "sys_user",
            "dict_category",
            "sys_user_sso",
            "test_node_config",
            "test_node_execute_log",
            "sys_task_execute_log",
            "test_data_pool_row"
        ))
    );

    /**
     * 从 SQL 中提取表名的正则表达式
     * 匹配 FROM/JOIN/INTO/UPDATE 后面的表名
     */
    private static final Pattern TABLE_NAME_PATTERN = Pattern.compile(
        "(?:FROM|JOIN|INTO|UPDATE)\\s+(\\w+)",
        Pattern.CASE_INSENSITIVE
    );

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        Long tenantId = TenantContext.getTenantId();

        // 没有租户上下文时不处理（兼容非 HTTP 请求，如定时任务等）
        if (tenantId == null) {
            return invocation.proceed();
        }

        StatementHandler handler = (StatementHandler) invocation.getTarget();
        BoundSql boundSql = handler.getBoundSql();
        String originalSql = boundSql.getSql();

        // 提取 SQL 中涉及的表名
        String tableName = extractTableName(originalSql);

        if (tableName != null && TENANT_TABLES.contains(tableName)
                && !IGNORE_TABLES.contains(tableName)) {
            // 检查 SQL 是否已经包含 tenant_id 条件（避免重复注入）
            if (!originalSql.toLowerCase().contains("tenant_id")) {
                String newSql = injectTenantCondition(originalSql, tenantId);
                // 反射修改 BoundSql 的 sql 字段
                setBoundSql(handler, boundSql, newSql);
                log.debug("[TenantInterceptor] 注入租户过滤: table={}, tenantId={}", tableName, tenantId);
            }
        }

        return invocation.proceed();
    }

    /**
     * 从 SQL 中提取第一个涉及的表名
     */
    private String extractTableName(String sql) {
        // 去掉注释和子查询中的干扰
        String cleanSql = sql.replaceAll("--[^\n]*", "")
                             .replaceAll("/\\*[\\s\\S]*?\\*/", "");

        Matcher matcher = TABLE_NAME_PATTERN.matcher(cleanSql);
        if (matcher.find()) {
            String tableName = matcher.group(1).toLowerCase();
            // 掍除 SQL 关键字误匹配
            if (!isSqlKeyword(tableName)) {
                return tableName;
            }
        }
        return null;
    }

    /**
     * 在 SQL 的 WHERE 子句中注入 tenant_id 条件
     * 如果没有 WHERE 子句，则添加 WHERE tenant_id = ?
     */
    private String injectTenantCondition(String sql, Long tenantId) {
        String upperSql = sql.toUpperCase();

        if (upperSql.contains("WHERE")) {
            // 在 WHERE 后面追加 AND tenant_id = ?
            int whereIndex = upperSql.indexOf("WHERE");
            return sql.substring(0, whereIndex + 5)
                     + " tenant_id = " + tenantId + " AND"
                     + sql.substring(whereIndex + 5);
        } else if (upperSql.contains("ORDER BY")) {
            // 在 ORDER BY 前插入 WHERE
            int orderIndex = upperSql.indexOf("ORDER BY");
            return sql.substring(0, orderIndex)
                     + " WHERE tenant_id = " + tenantId + " "
                     + sql.substring(orderIndex);
        } else if (upperSql.contains("LIMIT")) {
            // 在 LIMIT 前插入 WHERE
            int limitIndex = upperSql.indexOf("LIMIT");
            return sql.substring(0, limitIndex)
                     + " WHERE tenant_id = " + tenantId + " "
                     + sql.substring(limitIndex);
        } else {
            // 在 SQL 末尾追加 WHERE
            return sql + " WHERE tenant_id = " + tenantId;
        }
    }

    /**
     * 通过反射修改 BoundSql 的 sql 字段
     */
    private void setBoundSql(StatementHandler handler, BoundSql boundSql, String newSql) throws Exception {
        Field sqlField = BoundSql.class.getDeclaredField("sql");
        sqlField.setAccessible(true);
        sqlField.set(boundSql, newSql);
    }

    /**
     * 检查是否是 SQL 关键字（避免误匹配）
     */
    private boolean isSqlKeyword(String word) {
        Set<String> keywords = Collections.unmodifiableSet(
            new HashSet<>(Arrays.asList(
                "select", "insert", "update", "delete", "from", "where",
                "join", "left", "right", "inner", "outer", "on", "and",
                "or", "not", "in", "values", "set", "into", "order",
                "group", "having", "limit", "offset", "union", "all",
                "as", "null", "is", "between", "like", "exists"
            ))
        );
        return keywords.contains(word.toLowerCase());
    }

    @Override
    public Object plugin(Object target) {
        return Plugin.wrap(target, this);
    }
}
