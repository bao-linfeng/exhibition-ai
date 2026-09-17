CREATE TABLE "user_asset_favorites" (
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_asset_favorites_user_id_asset_id_pk" PRIMARY KEY("user_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "user_image_version_favorites" (
	"user_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_image_version_favorites_user_id_version_id_pk" PRIMARY KEY("user_id","version_id")
);
--> statement-breakpoint
CREATE TABLE "project_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"name_key" varchar(50) NOT NULL,
	"color" varchar(7),
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_tag_assignments" (
	"tag_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_tag_assignments_tag_id_asset_id_pk" PRIMARY KEY("tag_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "image_version_tag_assignments" (
	"tag_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_version_tag_assignments_tag_id_version_id_pk" PRIMARY KEY("tag_id","version_id")
);
--> statement-breakpoint
ALTER TABLE "user_asset_favorites" ADD CONSTRAINT "user_asset_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_asset_favorites" ADD CONSTRAINT "user_asset_favorites_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_asset_favorites" ADD CONSTRAINT "user_asset_favorites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_image_version_favorites" ADD CONSTRAINT "user_image_version_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_image_version_favorites" ADD CONSTRAINT "user_image_version_favorites_version_id_image_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."image_versions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_image_version_favorites" ADD CONSTRAINT "user_image_version_favorites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_tag_assignments" ADD CONSTRAINT "asset_tag_assignments_tag_id_project_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."project_tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_tag_assignments" ADD CONSTRAINT "asset_tag_assignments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_tag_assignments" ADD CONSTRAINT "asset_tag_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "image_version_tag_assignments" ADD CONSTRAINT "image_version_tag_assignments_tag_id_project_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."project_tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "image_version_tag_assignments" ADD CONSTRAINT "image_version_tag_assignments_version_id_image_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."image_versions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "image_version_tag_assignments" ADD CONSTRAINT "image_version_tag_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "project_tags_project_name_key_unique" ON "project_tags" USING btree ("project_id","name_key");
--> statement-breakpoint
CREATE INDEX "project_tags_project_id_idx" ON "project_tags" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "asset_tag_assignments_asset_idx" ON "asset_tag_assignments" USING btree ("asset_id");
--> statement-breakpoint
CREATE INDEX "image_version_tag_assignments_version_idx" ON "image_version_tag_assignments" USING btree ("version_id");
--> statement-breakpoint
CREATE INDEX "user_asset_favorites_user_project_idx" ON "user_asset_favorites" USING btree ("user_id","project_id");
--> statement-breakpoint
CREATE INDEX "user_asset_favorites_project_idx" ON "user_asset_favorites" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "user_image_version_favorites_user_project_idx" ON "user_image_version_favorites" USING btree ("user_id","project_id");
--> statement-breakpoint
CREATE INDEX "user_image_version_favorites_project_idx" ON "user_image_version_favorites" USING btree ("project_id");
--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'tag.create';
--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'tag.update';
--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'tag.delete';
--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'tag.assign';
--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'tag.unassign';
--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'favorite.set';
--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'favorite.unset';
