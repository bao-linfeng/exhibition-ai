CREATE TYPE "public"."task_kind" AS ENUM('asset_validation', 'brief_parse', 'design_direction', 'image_generation', 'agent_run', 'export');
--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'queued', 'running', 'awaiting_confirmation', 'succeeded', 'partially_succeeded', 'failed', 'cancelled', 'reconciling');
--> statement-breakpoint
CREATE TABLE "tasks" (
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
--> statement-breakpoint
CREATE TABLE "task_outbox" (
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
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_outbox" ADD CONSTRAINT "task_outbox_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tasks_project_id_idx" ON "tasks" ("project_id");
--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" ("status");
--> statement-breakpoint
CREATE INDEX "tasks_kind_idx" ON "tasks" ("kind");
--> statement-breakpoint
CREATE INDEX "tasks_idempotency_key_idx" ON "tasks" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "task_outbox_published_idx" ON "task_outbox" ("published");
--> statement-breakpoint
CREATE INDEX "task_outbox_next_attempt_idx" ON "task_outbox" ("next_attempt_at");
