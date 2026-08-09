-- 系统调用关系分析压测/验收数据
-- 用法：
-- docker exec -i auto-test-mysql mysql -uroot -p'AutoTest2026Kp9&Xz*' auto_test < docker/seed_callgraph_10000.sql
--
-- 可重复执行：每次只清理 SEED_CALL_CHAIN_% / SEED_SYS_% 前缀的数据，
-- 不会删除业务现有链路、节点和系统。

SET NAMES utf8mb4;
SET SESSION group_concat_max_len = 16777216;
SET SESSION cte_max_recursion_depth = 10000;
USE auto_test;

START TRANSACTION;

DELETE FROM test_node_config WHERE chain_code LIKE 'SEED_CALL_CHAIN_%';
DELETE FROM test_chain WHERE chain_code LIKE 'SEED_CALL_CHAIN_%';
DELETE FROM sys_system_registry WHERE system_code LIKE 'SEED_SYS_%';

-- 36 个目标系统：16 个内网、16 个外网、4 个未知，覆盖 8 种分类。
INSERT INTO sys_system_registry
    (system_code, system_name, scope, domain_patterns, ip_ranges, category, owner, description, sort_order, status, tenant_id)
SELECT
    CONCAT('SEED_SYS_', LPAD(n, 3, '0')),
    CONCAT('压测目标系统 ', LPAD(n, 3, '0')),
    CASE WHEN n <= 16 THEN 'INTERNAL' WHEN n <= 32 THEN 'EXTERNAL' ELSE 'UNKNOWN' END,
    CASE WHEN n <= 16
        THEN CONCAT('*.seed-', LPAD(n, 3, '0'), '.internal')
        WHEN n <= 32 THEN CONCAT('*.seed-', LPAD(n, 3, '0'), '.example.com')
        ELSE CONCAT('unknown.seed-', LPAD(n, 3, '0'), '.test')
    END,
    CASE WHEN n <= 16 THEN CONCAT('10.', n, '.0.0/16') ELSE NULL END,
    ELT(MOD(n - 1, 8) + 1, '用户', '订单', '支付', '数据', '消息', '第三方', '安全', '基础设施'),
    CONCAT('seed-owner-', LPAD(MOD(n - 1, 8) + 1, 2, '0')),
    '系统调用关系分析测试数据',
    n,
    1,
    1
FROM (
    WITH RECURSIVE seq AS (
        SELECT 1 AS n
        UNION ALL SELECT n + 1 FROM seq WHERE n < 36
    )
    SELECT n FROM seq
) numbers;

-- 120 条链路，均挂到现有树形分类，便于联动检查分类相关页面。
INSERT INTO test_chain
    (chain_code, chain_name, execute_mode, description, create_time, update_time,
     create_by, status, graph_data, system_category, func_category, priority, category_id, tenant_id)
SELECT
    CONCAT('SEED_CALL_CHAIN_', LPAD(n, 4, '0')),
    CONCAT('调用关系压测链路 ', LPAD(n, 4, '0')),
    CASE WHEN MOD(n, 3) = 0 THEN 2 ELSE 1 END,
    CONCAT('用于系统调用关系筛选验证，组合编号 ', n),
    DATE_SUB(NOW(), INTERVAL MOD(n, 90) DAY),
    NOW(),
    'seed-callgraph',
    1,
    '{"cells":[]}',
    ELT(MOD(n - 1, 4) + 1, 'order_system', 'payment_system', 'user_mgmt', 'data_platform'),
    ELT(MOD(n - 1, 6) + 1, 'query', 'create', 'update', 'delete', 'approval', 'notify'),
    MOD(n - 1, 3),
    MOD(n - 1, 16) + 1,
    1
FROM (
    WITH RECURSIVE seq AS (
        SELECT 1 AS n
        UNION ALL SELECT n + 1 FROM seq WHERE n < 120
    )
    SELECT n FROM seq
) numbers;

-- 10,000 条节点调用记录：
-- 60% 内网、30% 外网、10% 未知；GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS 全覆盖。
INSERT INTO test_node_config
    (chain_code, node_id, node_code, node_name, node_type, interface_scope, target_system,
     request_url, request_method, request_headers, body_type, body_data,
     extract_rules, assert_rules, variable_mapping, delay_seconds,
     is_ignored, create_time, update_time)
SELECT
    CONCAT('SEED_CALL_CHAIN_', LPAD(MOD(n - 1, 120) + 1, 4, '0')),
    FLOOR((n - 1) / 120) + 1,
    CONCAT('SEED_NODE_', LPAD(n, 5, '0')),
    CONCAT('调用节点 ', LPAD(n, 5, '0')),
    'HTTP',
    CASE
        WHEN MOD(n, 10) <= 5 THEN 'INTERNAL'
        WHEN MOD(n, 10) <= 8 THEN 'EXTERNAL'
        ELSE 'UNKNOWN'
    END,
    CASE
        WHEN MOD(n, 10) <= 5 THEN CONCAT('SEED_SYS_', LPAD(MOD(n - 1, 16) + 1, 3, '0'))
        WHEN MOD(n, 10) <= 8 THEN CONCAT('SEED_SYS_', LPAD(MOD(n - 1, 16) + 17, 3, '0'))
        ELSE CONCAT('SEED_SYS_', LPAD(MOD(n - 1, 4) + 33, 3, '0'))
    END,
    CASE
        WHEN MOD(n, 10) <= 5 THEN CONCAT('http://svc-', LPAD(MOD(n - 1, 16) + 1, 3, '0'), '.seed-', LPAD(MOD(n - 1, 16) + 1, 3, '0'), '.internal/api/v', MOD(n - 1, 4) + 1, '/resource/', MOD(n - 1, 37) + 1)
        WHEN MOD(n, 10) <= 8 THEN CONCAT('https://api-', LPAD(MOD(n - 1, 16) + 17, 3, '0'), '.seed-', LPAD(MOD(n - 1, 16) + 17, 3, '0'), '.example.com/open/v', MOD(n - 1, 4) + 1, '/resource/', MOD(n - 1, 37) + 1)
        ELSE CONCAT('https://unknown.seed-', LPAD(MOD(n - 1, 4) + 33, 3, '0'), '.test/legacy/', MOD(n - 1, 53) + 1)
    END,
    ELT(MOD(n - 1, 7) + 1, 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'),
    '{"Accept":"application/json","X-Seed-Data":"callgraph-10000"}',
    CASE WHEN MOD(n - 1, 7) IN (1, 2, 3) THEN 'json' ELSE NULL END,
    CASE WHEN MOD(n - 1, 7) IN (1, 2, 3) THEN CONCAT('{"seed":', n, ',"category":"', ELT(MOD(n - 1, 8) + 1, 'user', 'order', 'payment', 'data', 'message', 'third-party', 'security', 'infra'), '"}') ELSE NULL END,
    NULL,
    CONCAT('{"statusCode":200,"seed":', n, '}'),
    CONCAT('{"seedNo":"', n, '"}'),
    MOD(n, 5),
    0,
    DATE_SUB(NOW(), INTERVAL MOD(n, 90) DAY),
    NOW()
FROM (
    WITH RECURSIVE seq AS (
        SELECT 1 AS n
        UNION ALL SELECT n + 1 FROM seq WHERE n < 10000
    )
    SELECT n FROM seq
) numbers;

COMMIT;

SELECT 'seed_callgraph_10000 completed' AS message;
SELECT COUNT(*) AS seeded_nodes
FROM test_node_config
WHERE chain_code LIKE 'SEED_CALL_CHAIN_%';
SELECT COUNT(*) AS seeded_chains
FROM test_chain
WHERE chain_code LIKE 'SEED_CALL_CHAIN_%';
SELECT interface_scope, request_method, COUNT(*) AS total
FROM test_node_config
WHERE chain_code LIKE 'SEED_CALL_CHAIN_%'
GROUP BY interface_scope, request_method
ORDER BY interface_scope, request_method;
SELECT category, scope, COUNT(*) AS systems
FROM sys_system_registry
WHERE system_code LIKE 'SEED_SYS_%'
GROUP BY category, scope
ORDER BY category, scope;
