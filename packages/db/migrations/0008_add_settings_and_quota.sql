-- 模型配置表（管理员维护，不可在线修改凭证）
CREATE TABLE "model_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" varchar(100) NOT NULL,
  "model_id" varchar(100) NOT NULL,
  "display_name" varchar(200) NOT NULL,
  "description" text,
  "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "cost_per_image_minor" integer NOT NULL DEFAULT 0,
  "currency" varchar(3) NOT NULL DEFAULT 'CNY',
  "is_active" boolean NOT NULL DEFAULT true,
  "max_concurrent" integer NOT NULL DEFAULT 2,
  "parameters_schema" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 系统和用户额度账户
CREATE TABLE "quota_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_type" varchar(20) NOT NULL,
  "owner_id" uuid,
  "balance_minor" bigint NOT NULL DEFAULT 0,
  "reserved_minor" bigint NOT NULL DEFAULT 0,
  "currency" varchar(3) NOT NULL DEFAULT 'CNY',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- usage 账本（追加式，每条记录对应一次预留或结算）
CREATE TABLE "usage_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "attempt_ordinal" integer,
  "account_id" uuid NOT NULL,
  "entry_type" varchar(30) NOT NULL,
  "fee_status" varchar(20) NOT NULL,
  "amount_minor" bigint NOT NULL,
  "currency" varchar(3) NOT NULL,
  "provider" varchar(100),
  "model" varchar(100),
  "period_date" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX "model_configs_provider_model_idx" ON "model_configs" ("provider_id", "model_id");
CREATE INDEX "model_configs_active_idx" ON "model_configs" ("is_active");
--> statement-breakpoint
CREATE UNIQUE INDEX "quota_accounts_owner_idx" ON "quota_accounts" ("owner_type", "owner_id") WHERE "owner_id" IS NOT NULL;
CREATE UNIQUE INDEX "quota_accounts_system_idx" ON "quota_accounts" ("owner_type") WHERE "owner_id" IS NULL AND "owner_type" = 'system';
--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_account_id_quota_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."quota_accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "usage_ledger_task_id_idx" ON "usage_ledger" ("task_id");
CREATE INDEX "usage_ledger_account_id_idx" ON "usage_ledger" ("account_id");
CREATE INDEX "usage_ledger_period_date_idx" ON "usage_ledger" ("period_date");
CREATE INDEX "usage_ledger_entry_type_idx" ON "usage_ledger" ("entry_type");
--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'settings.model_config.update';
ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'quota.topup';
