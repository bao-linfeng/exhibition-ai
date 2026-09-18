-- 为 tasks 表增加 reconciling_at 字段
-- 记录任务进入 reconciling 状态的时间，用于准确计算 reconciling 超时

ALTER TABLE "tasks"
  ADD COLUMN "reconciling_at" timestamp with time zone;
