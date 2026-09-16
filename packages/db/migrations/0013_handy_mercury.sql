-- Add project_events table for SSE event persistence
CREATE TABLE "project_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"data" jsonb NOT NULL,
	"resource_id" uuid,
	"resource_revision" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add foreign key constraint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Add indexes for efficient querying
CREATE INDEX "project_events_project_sequence_idx" ON "project_events" USING btree ("project_id","sequence");
--> statement-breakpoint
CREATE INDEX "project_events_created_at_idx" ON "project_events" USING btree ("created_at");
