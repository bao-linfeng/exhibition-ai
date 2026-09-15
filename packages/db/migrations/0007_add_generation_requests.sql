CREATE TABLE "generation_requests" (
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
--> statement-breakpoint
ALTER TABLE "generation_requests" ADD CONSTRAINT "generation_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "generation_requests_idempotency_key_idx" ON "generation_requests" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "generation_requests_task_id_idx" ON "generation_requests" ("task_id");
--> statement-breakpoint
CREATE INDEX "generation_requests_project_id_idx" ON "generation_requests" ("project_id");
