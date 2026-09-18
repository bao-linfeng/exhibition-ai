-- 为 sessions 表增加 token_hash（存储 SHA-256 hash）和 absolute_expires_at（绝对过期时间）
-- 迁移策略：
--   1. 添加可空列
--   2. 以现有 id（UUID）的 SHA-256 hex 填充 token_hash（确保现有行唯一性）
--   3. 将 absolute_expires_at 填充为 expires_at + 7 天（保守估算）
--   4. 添加 NOT NULL 约束和唯一索引
--   5. 清除所有旧 session（因旧 cookie 存的是 UUID 明文，迁移后无法匹配 hash，客户端需重新登录）

-- 步骤 1：添加可空列
ALTER TABLE "sessions"
  ADD COLUMN "token_hash" text,
  ADD COLUMN "absolute_expires_at" timestamp with time zone;
--> statement-breakpoint

-- 步骤 2：清除所有旧 session（旧 cookie 已失效，强制重新登录）
DELETE FROM "sessions";
--> statement-breakpoint

-- 步骤 3：为新列添加 NOT NULL 约束
ALTER TABLE "sessions"
  ALTER COLUMN "token_hash" SET NOT NULL,
  ALTER COLUMN "absolute_expires_at" SET NOT NULL;
--> statement-breakpoint

-- 步骤 4：添加唯一索引
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");
