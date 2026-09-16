-- Repair databases where the former journal timestamps skipped migrations 0005–0011.
-- Every object below mirrors those migrations and is safe when they already ran.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_kind') THEN
    CREATE TYPE "public"."task_kind" AS ENUM('asset_validation', 'brief_parse', 'design_direction', 'image_generation', 'agent_run', 'export');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE "public"."task_status" AS ENUM('pending', 'queued', 'running', 'awaiting_confirmation', 'succeeded', 'partially_succeeded', 'failed', 'cancelled', 'reconciling');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_kind') THEN
    CREATE TYPE "public"."asset_kind" AS ENUM('logo', 'product', 'reference', 'brand_material', 'generated_image', 'thumbnail', 'export_zip');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_status') THEN
    CREATE TYPE "public"."asset_status" AS ENUM('pending', 'validating', 'ready', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_session_status') THEN
    CREATE TYPE "public"."upload_session_status" AS ENUM('initiated', 'validating', 'completed', 'failed', 'expired');
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "kind" "task_kind" NOT NULL,
  "subtype" varchar(100),
  "status" "task_status" DEFAULT 'pending' NOT NULL,
  "idempotency_key" varchar(255),
  "stage" varchar(100),
  "progress" text,
  "input_snapshot" jsonb,
  "outputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "fee" jsonb,
  "error_code" varchar(100),
  "error_message" text,
  "can_cancel" boolean DEFAULT true NOT NULL,
  "can_retry" boolean DEFAULT false NOT NULL,
  "retry_of_task_id" uuid,
  "requested_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "task_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "queue_name" varchar(255) NOT NULL,
  "payload" jsonb NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "published" boolean DEFAULT false NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "tasks_project_id_idx" ON "tasks" ("project_id");
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" ("status");
CREATE INDEX IF NOT EXISTS "tasks_kind_idx" ON "tasks" ("kind");
CREATE INDEX IF NOT EXISTS "tasks_idempotency_key_idx" ON "tasks" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "task_outbox_published_idx" ON "task_outbox" ("published");
CREATE INDEX IF NOT EXISTS "task_outbox_next_attempt_idx" ON "task_outbox" ("next_attempt_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "kind" "asset_kind" NOT NULL,
  "status" "asset_status" DEFAULT 'pending' NOT NULL,
  "bucket" varchar(100) NOT NULL,
  "object_key" varchar(512) NOT NULL,
  "original_filename" varchar(255) NOT NULL,
  "mime_type" varchar(127) NOT NULL,
  "size_bytes" bigint NOT NULL,
  "width" integer,
  "height" integer,
  "sha256" varchar(64),
  "source_asset_id" uuid,
  "hidden_at" timestamp with time zone,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "upload_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "asset_id" uuid,
  "status" "upload_session_status" DEFAULT 'initiated' NOT NULL,
  "bucket" varchar(100) NOT NULL,
  "object_key" varchar(512) NOT NULL,
  "kind" "asset_kind" NOT NULL,
  "original_filename" varchar(255) NOT NULL,
  "mime_type" varchar(127) NOT NULL,
  "size_bytes" bigint NOT NULL,
  "created_by" uuid NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "assets_project_id_idx" ON "assets" ("project_id");
CREATE INDEX IF NOT EXISTS "assets_status_idx" ON "assets" ("status");
CREATE INDEX IF NOT EXISTS "assets_kind_idx" ON "assets" ("kind");
CREATE INDEX IF NOT EXISTS "assets_hidden_at_idx" ON "assets" ("hidden_at");
CREATE INDEX IF NOT EXISTS "upload_sessions_project_id_idx" ON "upload_sessions" ("project_id");
CREATE INDEX IF NOT EXISTS "upload_sessions_status_idx" ON "upload_sessions" ("status");
CREATE INDEX IF NOT EXISTS "upload_sessions_expires_at_idx" ON "upload_sessions" ("expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "mode" varchar(20) NOT NULL,
  "brief_revision_id" uuid NOT NULL,
  "direction_id" uuid,
  "parent_version_id" uuid,
  "input_asset_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "instruction" text NOT NULL,
  "model_config_id" uuid NOT NULL,
  "parameters" jsonb NOT NULL,
  "parameters_hash" varchar(64) NOT NULL,
  "idempotency_key" varchar(255) NOT NULL,
  "requested_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "generation_requests_task_id_idx" ON "generation_requests" ("task_id");
CREATE INDEX IF NOT EXISTS "generation_requests_project_id_idx" ON "generation_requests" ("project_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_configs" (
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
CREATE TABLE IF NOT EXISTS "quota_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_type" varchar(20) NOT NULL,
  "owner_id" uuid,
  "balance_minor" bigint NOT NULL DEFAULT 0,
  "reserved_minor" bigint NOT NULL DEFAULT 0,
  "currency" varchar(3) NOT NULL DEFAULT 'CNY',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "usage_ledger" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "model_configs_provider_model_idx" ON "model_configs" ("provider_id", "model_id");
CREATE INDEX IF NOT EXISTS "model_configs_active_idx" ON "model_configs" ("is_active");
CREATE INDEX IF NOT EXISTS "quota_accounts_owner_type_idx" ON "quota_accounts" ("owner_type");
CREATE INDEX IF NOT EXISTS "quota_accounts_owner_id_idx" ON "quota_accounts" ("owner_id");
CREATE INDEX IF NOT EXISTS "usage_ledger_task_id_idx" ON "usage_ledger" ("task_id");
CREATE INDEX IF NOT EXISTS "usage_ledger_account_id_idx" ON "usage_ledger" ("account_id");
CREATE INDEX IF NOT EXISTS "usage_ledger_period_date_idx" ON "usage_ledger" ("period_date");
CREATE INDEX IF NOT EXISTS "usage_ledger_entry_type_idx" ON "usage_ledger" ("entry_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "image_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "task_id" uuid NOT NULL,
  "output_ordinal" integer NOT NULL,
  "asset_id" uuid NOT NULL UNIQUE,
  "parent_version_id" uuid,
  "sequence" integer NOT NULL,
  "brief_revision_id" uuid NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "size_bytes" bigint NOT NULL,
  "mime_type" varchar(127) NOT NULL,
  "hidden_at" timestamp with time zone,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "image_versions_project_sequence_unique" ON "image_versions" ("project_id", "sequence");
CREATE INDEX IF NOT EXISTS "image_versions_project_id_idx" ON "image_versions" ("project_id");
CREATE INDEX IF NOT EXISTS "image_versions_task_id_idx" ON "image_versions" ("task_id");
CREATE INDEX IF NOT EXISTS "image_versions_parent_version_id_idx" ON "image_versions" ("parent_version_id");
CREATE TABLE IF NOT EXISTS "design_directions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "brief_revision_id" uuid NOT NULL,
  "source_task_id" uuid NOT NULL,
  "title" varchar(200) NOT NULL,
  "concept" text NOT NULL DEFAULT '',
  "layout_description" text NOT NULL DEFAULT '',
  "materials_and_colors" varchar(1000) NOT NULL DEFAULT '',
  "constraints_checklist" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "questions_for_confirmation" jsonb,
  "prompt_snapshot" jsonb,
  "text_usage" jsonb,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "design_directions_project_id_idx" ON "design_directions" ("project_id");
CREATE INDEX IF NOT EXISTS "design_directions_brief_revision_id_idx" ON "design_directions" ("brief_revision_id");
--> statement-breakpoint
DO $$
DECLARE
  fk record;
  equivalent_constraint_name text;
BEGIN
  FOR fk IN
    SELECT *
    FROM (
      VALUES
        ('tasks', 'tasks_project_id_projects_id_fk', 'project_id', 'projects', 'id', 'c', 'CASCADE'),
        ('tasks', 'tasks_requested_by_users_id_fk', 'requested_by', 'users', 'id', 'a', 'NO ACTION'),
        ('task_outbox', 'task_outbox_task_id_tasks_id_fk', 'task_id', 'tasks', 'id', 'c', 'CASCADE'),
        ('assets', 'assets_project_id_projects_id_fk', 'project_id', 'projects', 'id', 'c', 'CASCADE'),
        ('assets', 'assets_created_by_users_id_fk', 'created_by', 'users', 'id', 'a', 'NO ACTION'),
        ('upload_sessions', 'upload_sessions_project_id_projects_id_fk', 'project_id', 'projects', 'id', 'c', 'CASCADE'),
        ('upload_sessions', 'upload_sessions_asset_id_assets_id_fk', 'asset_id', 'assets', 'id', 'n', 'SET NULL'),
        ('upload_sessions', 'upload_sessions_created_by_users_id_fk', 'created_by', 'users', 'id', 'a', 'NO ACTION'),
        ('generation_requests', 'generation_requests_task_id_tasks_id_fk', 'task_id', 'tasks', 'id', 'c', 'CASCADE'),
        ('usage_ledger', 'usage_ledger_task_id_tasks_id_fk', 'task_id', 'tasks', 'id', 'r', 'RESTRICT'),
        ('usage_ledger', 'usage_ledger_account_id_quota_accounts_id_fk', 'account_id', 'quota_accounts', 'id', 'r', 'RESTRICT'),
        ('image_versions', 'image_versions_project_id_fkey', 'project_id', 'projects', 'id', 'c', 'CASCADE'),
        ('image_versions', 'image_versions_task_id_fkey', 'task_id', 'tasks', 'id', 'c', 'CASCADE'),
        ('image_versions', 'image_versions_asset_id_fkey', 'asset_id', 'assets', 'id', 'a', 'NO ACTION'),
        ('image_versions', 'image_versions_parent_version_id_fkey', 'parent_version_id', 'image_versions', 'id', 'a', 'NO ACTION'),
        ('image_versions', 'image_versions_created_by_fkey', 'created_by', 'users', 'id', 'a', 'NO ACTION'),
        ('design_directions', 'design_directions_project_id_projects_id_fk', 'project_id', 'projects', 'id', 'c', 'CASCADE'),
        ('design_directions', 'design_directions_brief_revision_id_brief_revisions_id_fk', 'brief_revision_id', 'brief_revisions', 'id', 'c', 'CASCADE'),
        ('design_directions', 'design_directions_source_task_id_tasks_id_fk', 'source_task_id', 'tasks', 'id', 'c', 'CASCADE')
    ) AS required_fk(table_name, constraint_name, column_name, referenced_table, referenced_column, delete_action, delete_sql)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_constraint existing_constraint
      WHERE existing_constraint.conrelid = format('public.%I', fk.table_name)::regclass
        AND existing_constraint.conname = fk.constraint_name
    ) THEN
      CONTINUE;
    END IF;

    SELECT existing_constraint.conname
    INTO equivalent_constraint_name
    FROM pg_constraint existing_constraint
    WHERE existing_constraint.contype = 'f'
      AND existing_constraint.conrelid = format('public.%I', fk.table_name)::regclass
      AND existing_constraint.confrelid = format('public.%I', fk.referenced_table)::regclass
      AND existing_constraint.conkey = ARRAY[(SELECT attribute.attnum FROM pg_attribute attribute WHERE attribute.attrelid = existing_constraint.conrelid AND attribute.attname = fk.column_name AND NOT attribute.attisdropped)]::smallint[]
      AND existing_constraint.confkey = ARRAY[(SELECT attribute.attnum FROM pg_attribute attribute WHERE attribute.attrelid = existing_constraint.confrelid AND attribute.attname = fk.referenced_column AND NOT attribute.attisdropped)]::smallint[]
      AND existing_constraint.confdeltype = fk.delete_action
      AND existing_constraint.confupdtype = 'a'
      AND existing_constraint.confmatchtype = 's'
      AND NOT existing_constraint.condeferrable
      AND NOT existing_constraint.condeferred;

    IF equivalent_constraint_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I', fk.table_name, equivalent_constraint_name, fk.constraint_name);
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I (%I) ON DELETE %s ON UPDATE NO ACTION',
        fk.table_name,
        fk.constraint_name,
        fk.column_name,
        fk.referenced_table,
        fk.referenced_column,
        fk.delete_sql
      );
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_event_type') THEN
    ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'settings.model_config.update';
    ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'quota.topup';
    ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'task.retried';
  END IF;
END $$;
ALTER TABLE "usage_ledger" ADD COLUMN IF NOT EXISTS "provider_usage" jsonb;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "quota_accounts" WHERE "owner_id" IS NOT NULL GROUP BY "owner_type", "owner_id", "currency" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Cannot create quota_accounts_owner_currency_idx: duplicate non-system quota accounts exist. Reconcile duplicate owner_type/owner_id/currency accounts before rerunning migration 0012.';
  END IF;
  IF EXISTS (SELECT 1 FROM "quota_accounts" WHERE "owner_id" IS NULL AND "owner_type" = 'system' GROUP BY "owner_type", "currency" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Cannot create quota_accounts_system_currency_idx: duplicate system quota accounts exist. Reconcile duplicate owner_type/currency accounts before rerunning migration 0012.';
  END IF;
  IF EXISTS (SELECT 1 FROM "usage_ledger" WHERE "entry_type" = 'reserve' GROUP BY "task_id" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Cannot create usage_ledger_task_reserve_unique_idx: duplicate reserve ledger records exist. Reconcile duplicate reserve records per task before rerunning migration 0012.';
  END IF;
  IF EXISTS (SELECT 1 FROM "usage_ledger" WHERE "entry_type" IN ('settle_actual', 'release') GROUP BY "task_id" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Cannot create usage_ledger_task_final_unique_idx: duplicate final ledger records exist. Reconcile duplicate settle_actual/release records per task before rerunning migration 0012.';
  END IF;
  IF EXISTS (SELECT 1 FROM "usage_ledger" WHERE "entry_type" = 'settle_unknown' GROUP BY "task_id" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Cannot create usage_ledger_task_unknown_unique_idx: duplicate unknown-settlement ledger records exist. Reconcile duplicate settle_unknown records per task before rerunning migration 0012.';
  END IF;
  IF EXISTS (SELECT 1 FROM "tasks" WHERE "kind" = 'image_generation' AND "idempotency_key" IS NOT NULL GROUP BY "idempotency_key" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Cannot create tasks_image_generation_idempotency_unique_idx: duplicate image-generation idempotency keys exist. Reconcile duplicate tasks before rerunning migration 0012.';
  END IF;
  IF EXISTS (SELECT 1 FROM "generation_requests" GROUP BY "idempotency_key" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Cannot create generation_requests_idempotency_key_idx: duplicate image-generation request idempotency keys exist. Reconcile duplicate generation requests before rerunning migration 0012.';
  END IF;
END $$;
DROP INDEX IF EXISTS "quota_accounts_owner_idx";
DROP INDEX IF EXISTS "quota_accounts_system_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "quota_accounts_owner_currency_idx" ON "quota_accounts" ("owner_type", "owner_id", "currency") WHERE "owner_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "quota_accounts_system_currency_idx" ON "quota_accounts" ("owner_type", "currency") WHERE "owner_id" IS NULL AND "owner_type" = 'system';
CREATE UNIQUE INDEX IF NOT EXISTS "usage_ledger_task_reserve_unique_idx" ON "usage_ledger" ("task_id") WHERE "entry_type" = 'reserve';
CREATE UNIQUE INDEX IF NOT EXISTS "usage_ledger_task_final_unique_idx" ON "usage_ledger" ("task_id") WHERE "entry_type" IN ('settle_actual', 'release');
CREATE UNIQUE INDEX IF NOT EXISTS "usage_ledger_task_unknown_unique_idx" ON "usage_ledger" ("task_id") WHERE "entry_type" = 'settle_unknown';
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_image_generation_idempotency_unique_idx" ON "tasks" ("idempotency_key") WHERE "kind" = 'image_generation' AND "idempotency_key" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "generation_requests_idempotency_key_idx" ON "generation_requests" ("idempotency_key");
