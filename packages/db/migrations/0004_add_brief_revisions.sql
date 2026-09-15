CREATE TABLE "brief_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"content" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "brief_revisions" ADD CONSTRAINT "brief_revisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "brief_revisions" ADD CONSTRAINT "brief_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "brief_revisions" ADD CONSTRAINT "brief_revisions_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_current_brief_revision_id_brief_revisions_id_fk" FOREIGN KEY ("current_brief_revision_id") REFERENCES "public"."brief_revisions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "brief_revisions_project_number_idx" ON "brief_revisions" ("project_id", "number");
