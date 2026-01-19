-- 添加 type 字段到 config_diffs 表
ALTER TABLE config_diffs ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'inbound';

-- 根据内容特征更新现有记录的类型
-- 1. 更新 inbound 类型（有 port 字段）
UPDATE config_diffs 
SET type = 'inbound' 
WHERE type = 'inbound' 
  AND content::jsonb ? 'port';

-- 2. 更新 balancer 类型（有 selector 字段）
UPDATE config_diffs 
SET type = 'balancer' 
WHERE type = 'inbound' 
  AND content::jsonb ? 'selector';

-- 3. 更新 routing 类型（有 outboundTag 但没有 selector）
UPDATE config_diffs 
SET type = 'routing' 
WHERE type = 'inbound' 
  AND content::jsonb ? 'outboundTag' 
  AND NOT content::jsonb ? 'selector';

-- 4. 更新 outbound 类型（没有 port, outboundTag, selector 的剩余记录）
UPDATE config_diffs 
SET type = 'outbound' 
WHERE type = 'inbound' 
  AND NOT content::jsonb ? 'port' 
  AND NOT content::jsonb ? 'outboundTag' 
  AND NOT content::jsonb ? 'selector';

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_config_diffs_type ON config_diffs(slave_id, type);

-- 显示迁移结果
SELECT type, COUNT(*) as count 
FROM config_diffs 
GROUP BY type 
ORDER BY type;
