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
ALTER TABLE "design_directions" ADD CONSTRAINT "design_directions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "design_directions" ADD CONSTRAINT "design_directions_brief_revision_id_brief_revisions_id_fk" FOREIGN KEY ("brief_revision_id") REFERENCES "public"."brief_revisions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "design_directions" ADD CONSTRAINT "design_directions_source_task_id_tasks_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "design_directions_project_id_idx" ON "design_directions" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "design_directions_brief_revision_id_idx" ON "design_directions" USING btree ("brief_revision_id");
