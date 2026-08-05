-- =============================================================
-- 260804 编排引擎大改造 增量迁移脚本
--
-- 适用：已有数据的 auto_test 库（init.sql 只在首次初始化时执行，
--       老库必须手工跑本脚本）
--
-- 变更要点：
--   1. 编排顺序改由 X6 画布 DAG 决定 → test_chain 新增 graph_data
--   2. 废弃 test_node_config.sort_no / parallel_group
--   3. 新增内外网识别字段 interface_scope / target_system
--   4. 新增全局变量表 test_global_variable
--   5. 新增系统注册表 sys_system_registry
--   6. 彻底删除版本快照功能（test_chain_version / test_node_snapshot）
--
-- 执行方式：
--   docker exec -i auto-test-mysql mysql -uroot -p'AutoTest2026Kp9&Xz*' \
--     auto_test < docker/migration_260804_dag.sql
-- =============================================================

SET NAMES utf8mb4;
USE auto_test;

-- 回填 graph_data 会用 GROUP_CONCAT 拼接整张画布 JSON，
-- 默认上限 1024 字节远远不够，必须先放开（否则报 ERROR 1260 Row N was cut）
SET SESSION group_concat_max_len = 16777216;

-- -------------------------------------------------------------
-- 1. test_chain：新增画布数据，移除版本相关字段
-- -------------------------------------------------------------
ALTER TABLE `test_chain`
  ADD COLUMN `graph_data` longtext NULL
  COMMENT 'X6画布图数据(graph.toJSON())，编排与执行顺序的唯一真相来源' AFTER `status`;

ALTER TABLE `test_chain` DROP COLUMN `current_version`;
ALTER TABLE `test_chain` DROP COLUMN `chain_fingerprint`;

-- -------------------------------------------------------------
-- 2. test_node_config：新增内外网字段
-- -------------------------------------------------------------
ALTER TABLE `test_node_config`
  ADD COLUMN `interface_scope` varchar(16) DEFAULT NULL
  COMMENT '内外网范围: INTERNAL=内网, EXTERNAL=外网, UNKNOWN=未识别' AFTER `node_type`;

ALTER TABLE `test_node_config`
  ADD COLUMN `target_system` varchar(64) DEFAULT NULL
  COMMENT '归属系统编码，关联 sys_system_registry.system_code' AFTER `interface_scope`;

-- -------------------------------------------------------------
-- 3. 基于旧 sort_no 回填 graph_data（生成线性 DAG）
--    必须在删除 sort_no 之前执行
-- -------------------------------------------------------------
UPDATE `test_chain` c
SET c.`graph_data` = (
  SELECT CONCAT(
    '{"cells":[',
    -- 节点
    IFNULL(GROUP_CONCAT(
      CONCAT(
        '{"id":"', n.node_code,
        '","shape":"http-node","x":120,"y":', 80 + (n.rn - 1) * 140,
        ',"width":240,"height":88,"data":{"nodeCode":"', n.node_code,
        '","nodeName":"', REPLACE(REPLACE(IFNULL(n.node_name, ''), '\\', '\\\\'), '"', '\\"'),
        '","nodeType":"', IFNULL(n.node_type, 'HTTP'),
        '","requestMethod":"', IFNULL(n.request_method, 'GET'), '"}}'
      )
      ORDER BY n.rn SEPARATOR ','
    ), ''),
    -- 连线
    IFNULL(CONCAT(',', (
      SELECT GROUP_CONCAT(
        CONCAT(
          '{"id":"edge-', a.node_code, '-', b.node_code,
          '","shape":"dag-edge","source":{"cell":"', a.node_code,
          '"},"target":{"cell":"', b.node_code, '"}}'
        )
        ORDER BY a.rn SEPARATOR ','
      )
      FROM (SELECT node_code, chain_code,
                   ROW_NUMBER() OVER (PARTITION BY chain_code ORDER BY node_id) rn
            FROM test_node_config) a
      JOIN (SELECT node_code, chain_code,
                   ROW_NUMBER() OVER (PARTITION BY chain_code ORDER BY node_id) rn
            FROM test_node_config) b
        ON a.chain_code = b.chain_code AND b.rn = a.rn + 1
      WHERE a.chain_code = c.chain_code
    )), ''),
    ']}'
  )
  FROM (SELECT node_code, node_name, node_type, request_method, chain_code,
               ROW_NUMBER() OVER (PARTITION BY chain_code ORDER BY node_id) rn
        FROM test_node_config) n
  WHERE n.chain_code = c.chain_code
)
WHERE c.`graph_data` IS NULL;

-- 没有任何节点的链路给一个空画布，避免前端拿到 null
UPDATE `test_chain` SET `graph_data` = '{"cells":[]}'
WHERE `graph_data` IS NULL OR `graph_data` = '';

-- -------------------------------------------------------------
-- 4. test_node_config：删除废弃排序字段
-- -------------------------------------------------------------
ALTER TABLE `test_node_config` DROP INDEX `uk_chain_sort_no`;
ALTER TABLE `test_node_config` DROP COLUMN `sort_no`;
ALTER TABLE `test_node_config` DROP COLUMN `parallel_group`;

ALTER TABLE `test_node_config` ADD UNIQUE KEY `uk_chain_node_id` (`chain_code`,`node_id`);
ALTER TABLE `test_node_config` ADD KEY `idx_target_system` (`target_system`);
ALTER TABLE `test_node_config` ADD KEY `idx_interface_scope` (`interface_scope`);

-- -------------------------------------------------------------
-- 5. 全局变量表
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `test_global_variable` (
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

-- -------------------------------------------------------------
-- 6. 系统注册表
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sys_system_registry` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `system_code` varchar(64) NOT NULL COMMENT '系统编码',
  `system_name` varchar(128) NOT NULL COMMENT '系统名称',
  `scope` varchar(16) NOT NULL DEFAULT 'INTERNAL' COMMENT '内外网: INTERNAL=内网, EXTERNAL=外网',
  `domain_patterns` text COMMENT '域名匹配规则，多个用英文逗号分隔，支持 *.example.com 通配',
  `ip_ranges` text COMMENT 'IP段匹配规则(CIDR)，多个用英文逗号分隔，如 10.0.0.0/8',
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

-- 预置内网私有网段，便于开箱即用
INSERT IGNORE INTO `sys_system_registry`
  (`system_code`, `system_name`, `scope`, `domain_patterns`, `ip_ranges`, `description`, `sort_order`)
VALUES
  ('LOCAL', '本机/开发环境', 'INTERNAL', 'localhost,*.local,*.localhost',
   '127.0.0.0/8,::1/128', '本地开发调试地址', 1),
  ('INTRANET', '默认内网', 'INTERNAL', '*.intra,*.internal',
   '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16', 'RFC1918 私有网段', 2);

-- -------------------------------------------------------------
-- 7. 删除版本快照功能相关表
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `test_node_snapshot`;
DROP TABLE IF EXISTS `test_chain_version`;
