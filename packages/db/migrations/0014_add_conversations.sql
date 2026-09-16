BEGIN;

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "title" varchar(200) DEFAULT '默认会话' NOT NULL,
  "active_run_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "conversations_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "task_id" uuid NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "tool_call_count" integer DEFAULT 0 NOT NULL,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "error_code" varchar(100),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "agent_runs_conversation_id_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade,
  CONSTRAINT "agent_runs_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade,
  CONSTRAINT "agent_runs_task_id_tasks_id_fk"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade,
  CONSTRAINT "agent_runs_status_check"
    CHECK ("status" IN ('pending', 'running', 'awaiting_confirmation', 'completed', 'interrupted', 'failed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "run_id" uuid,
  "role" varchar(20) NOT NULL,
  "parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "stream_offset" integer DEFAULT 0 NOT NULL,
  "client_message_id" varchar(100),
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "messages_conversation_id_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade,
  CONSTRAINT "messages_run_id_agent_runs_id_fk"
    FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id"),
  CONSTRAINT "messages_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id"),
  CONSTRAINT "messages_role_check"
    CHECK ("role" IN ('user', 'assistant', 'system')),
  CONSTRAINT "messages_status_check"
    CHECK ("status" IN ('pending', 'streaming', 'completed', 'interrupted', 'failed'))
);

CREATE TABLE IF NOT EXISTS "confirmations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "requested_by" uuid NOT NULL,
  "action" varchar(50) NOT NULL,
  "payload" jsonb NOT NULL,
  "payload_hash" varchar(64) NOT NULL,
  "estimated_fee_minor" integer,
  "currency" varchar(3),
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "result_task_id" uuid,
  "result_brief_revision_id" uuid,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "confirmations_run_id_agent_runs_id_fk"
    FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE cascade,
  CONSTRAINT "confirmations_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade,
  CONSTRAINT "confirmations_requested_by_users_id_fk"
    FOREIGN KEY ("requested_by") REFERENCES "users"("id"),
  CONSTRAINT "confirmations_action_check"
    CHECK ("action" IN ('apply_brief_patch', 'create_generation')),
  CONSTRAINT "confirmations_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected', 'expired'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_active_run_id_agent_runs_id_fk'
  ) THEN
    ALTER TABLE "conversations"
      ADD CONSTRAINT "conversations_active_run_id_agent_runs_id_fk"
      FOREIGN KEY ("active_run_id") REFERENCES "agent_runs"("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "conversations_project_id_idx" ON "conversations" USING btree ("project_id");
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_project_unique_idx" ON "conversations" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");
CREATE INDEX IF NOT EXISTS "messages_run_id_idx" ON "messages" USING btree ("run_id");
CREATE INDEX IF NOT EXISTS "messages_client_message_id_idx" ON "messages" USING btree ("client_message_id");
CREATE UNIQUE INDEX IF NOT EXISTS "messages_client_message_id_unique" ON "messages" USING btree ("client_message_id") WHERE "client_message_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "agent_runs_conversation_id_idx" ON "agent_runs" USING btree ("conversation_id");
CREATE INDEX IF NOT EXISTS "agent_runs_task_id_idx" ON "agent_runs" USING btree ("task_id");
CREATE INDEX IF NOT EXISTS "confirmations_run_id_idx" ON "confirmations" USING btree ("run_id");
CREATE INDEX IF NOT EXISTS "confirmations_project_id_idx" ON "confirmations" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "confirmations_status_idx" ON "confirmations" USING btree ("status");

COMMIT;
