-- Existing databases: repair fields required by plugin chain push.
ALTER TABLE test_chain ADD COLUMN IF NOT EXISTS product_code varchar(64) DEFAULT NULL COMMENT '所属产品编码' AFTER tenant_id;
ALTER TABLE test_chain ADD COLUMN IF NOT EXISTS login_chain_code varchar(64) DEFAULT NULL COMMENT '前置登录链路编码' AFTER account_code;
ALTER TABLE test_chain ADD COLUMN IF NOT EXISTS login_timeout int DEFAULT 30000 COMMENT '登录超时(ms)' AFTER login_chain_code;
ALTER TABLE test_chain ADD COLUMN IF NOT EXISTS data_pool_code varchar(64) DEFAULT NULL COMMENT '绑定的数据池编码' AFTER product_code;
ALTER TABLE test_chain ADD COLUMN IF NOT EXISTS param_mode varchar(16) DEFAULT 'NONE' COMMENT '参数模式' AFTER data_pool_code;
