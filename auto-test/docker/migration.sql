-- =============================================
-- 数据库迁移脚本 - 从 EP 迁移到 Ant Design + X6 架构
-- 执行前请备份数据库!
-- =============================================
USE auto_test;

-- =============================================
-- 1. 新增系统内部域名表 (用于系统调用关系图分析)
-- =============================================
CREATE TABLE IF NOT EXISTS `sys_internal_domain` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `domain` varchar(256) NOT NULL COMMENT '域名或IP地址',
  `is_ip` tinyint DEFAULT '0' COMMENT '是否为IP: 0=域名, 1=IP',
  `system_name` varchar(128) DEFAULT '' COMMENT '所属系统名称',
  `is_active` tinyint DEFAULT '1' COMMENT '状态: 0=禁用, 1=启用',
  `remark` varchar(256) DEFAULT '' COMMENT '备注',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_domain` (`domain`(128)),
  KEY `idx_system_name` (`system_name`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统内部域名表';

-- 插入默认内部域名配置
INSERT INTO `sys_internal_domain` (`domain`, `is_ip`, `system_name`, `is_active`, `remark`) VALUES
('localhost', 1, '本地系统', 1, '本地开发环境'),
('127.0.0.1', 1, '本地系统', 1, '本地回环地址'),
('192.168.', 0, '内网段', 1, '内网IP段'),
('10.', 0, '内网段', 1, '内网IP段');

-- =============================================
-- 2. 新增链路全局变量表
-- =============================================
CREATE TABLE IF NOT EXISTS `test_chain_global_var` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `chain_code` varchar(64) NOT NULL COMMENT '所属链路编码',
  `var_name` varchar(128) NOT NULL COMMENT '变量名称',
  `var_value` longtext COMMENT '变量值',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_chain_code` (`chain_code`),
  KEY `idx_chain_var` (`chain_code`, `var_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='链路全局变量表';

-- =============================================
-- 3. 修改 test_node_config 表
--    移除 sort_no 和 parallel_group 字段
--    新增 canvas_node_json 和 node_order 字段
-- =============================================
ALTER TABLE `test_node_config`
  DROP INDEX `uk_chain_sort_no`,
  DROP COLUMN `sort_no`,
  DROP COLUMN `parallel_group`,
  ADD COLUMN `canvas_node_json` longtext COMMENT 'AntV X6 节点数据(JSON)' AFTER `is_ignored`,
  ADD COLUMN `node_order` int NOT NULL DEFAULT 0 COMMENT '节点拖拽排序序号' AFTER `chain_code`;

-- 迁移现有数据: 将现有 sort_no 值迁移到 node_order
UPDATE `test_node_config` SET `node_order` = `sort_no` WHERE `sort_no` IS NOT NULL;
-- 将没有 sort_no 的记录设为 nodeId 值
UPDATE `test_node_config` SET `node_order` = `node_id` WHERE `node_order` = 0;

-- =============================================
-- 4. 修改 test_node_snapshot 表 (保持兼容)
--    仅移除 sort_no 和 parallel_group 字段
-- =============================================
ALTER TABLE `test_node_snapshot`
  DROP COLUMN IF EXISTS `sort_no`,
  DROP COLUMN IF EXISTS `parallel_group`;

-- =============================================
-- 5. 新增系统调用关系图谱数据表 (可选, 用于存储分析结果)
-- =============================================
CREATE TABLE IF NOT EXISTS `sys_call_relation` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `source_system` varchar(128) NOT NULL COMMENT '源系统名称',
  `target_system` varchar(128) NOT NULL COMMENT '目标系统名称',
  `target_url` varchar(1024) NOT NULL COMMENT '目标URL',
  `call_count` int DEFAULT 0 COMMENT '调用次数',
  `last_call_time` datetime DEFAULT NULL COMMENT '最后调用时间',
  `category` varchar(64) DEFAULT '' COMMENT '调用分类',
  `is_internal` tinyint DEFAULT 1 COMMENT '是否内部调用',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_source` (`source_system`),
  KEY `idx_target` (`target_system`),
  KEY `idx_category` (`category`),
  KEY `idx_is_internal` (`is_internal`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统调用关系表';
