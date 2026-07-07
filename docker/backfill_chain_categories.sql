-- =============================================
-- 回填测试链路的分类字段
-- 用途：修复“按分类筛选查不到数据”的问题。
--        原种子/历史链路的 system_category / func_category / category_id
--        大量为 NULL，导致前端筛选恒为空。
-- 使用：
--   1) 进入 MySQL 容器：  docker exec -i auto-test-mysql mysql -uroot -pautotest123 auto_test
--   2) 执行本文件：        source /path/to/backfill_chain_categories.sql;
--   或直接：
--   docker exec -i auto-test-mysql mysql -uroot -pautotest123 auto_test < backfill_chain_categories.sql
-- 说明：
--   - system_category / func_category 轮询取自 dict_category 中已存在的合法编码
--   - category_id 轮询取自 sys_category 的 1~13 号节点
--   - WHERE 仅补全缺失项，重复执行安全（不会覆盖已存在的分类）
-- =============================================

UPDATE `test_chain`
SET system_category = ELT((id % 5) + 1, 'user_mgmt', 'order_system', 'payment_system', 'approval_flow', 'data_query'),
    func_category   = ELT((id % 5) + 1, 'login_auth', 'data_query', 'data_create', 'data_update', 'data_delete'),
    category_id     = ((id - 1) % 13) + 1
WHERE system_category IS NULL OR func_category IS NULL OR category_id IS NULL;

-- 查看回填结果
SELECT
  COUNT(*) AS total,
  SUM(system_category IS NULL) AS null_system,
  SUM(func_category IS NULL)   AS null_func,
  SUM(category_id IS NULL)     AS null_category
FROM test_chain;
