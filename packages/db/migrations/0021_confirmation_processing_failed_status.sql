-- 为 confirmations.status 增加 'processing' 和 'failed' 两个状态值
-- 'processing'：原子占位状态，防止并发重复执行副作用
-- 'failed'：副作用执行失败，记录最终失败状态

-- 步骤 1：删除旧约束
ALTER TABLE "confirmations"
  DROP CONSTRAINT IF EXISTS "confirmations_status_check";
--> statement-breakpoint

-- 步骤 2：添加包含新状态的约束
ALTER TABLE "confirmations"
  ADD CONSTRAINT "confirmations_status_check"
  CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'expired', 'failed'));
