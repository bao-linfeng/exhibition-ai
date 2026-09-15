CREATE TYPE "public"."asset_kind" AS ENUM('logo', 'product', 'reference', 'brand_material', 'generated_image', 'thumbnail', 'export_zip');
--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('pending', 'validating', 'ready', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."upload_session_status" AS ENUM('initiated', 'validating', 'completed', 'failed', 'expired');
--> statement-breakpoint
CREATE TABLE "assets" (
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
--> statement-breakpoint
CREATE TABLE "upload_sessions" (
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
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "assets_project_id_idx" ON "assets" ("project_id");
--> statement-breakpoint
CREATE INDEX "assets_status_idx" ON "assets" ("status");
--> statement-breakpoint
CREATE INDEX "assets_kind_idx" ON "assets" ("kind");
--> statement-breakpoint
CREATE INDEX "assets_hidden_at_idx" ON "assets" ("hidden_at");
--> statement-breakpoint
CREATE INDEX "upload_sessions_project_id_idx" ON "upload_sessions" ("project_id");
--> statement-breakpoint
CREATE INDEX "upload_sessions_status_idx" ON "upload_sessions" ("status");
--> statement-breakpoint
CREATE INDEX "upload_sessions_expires_at_idx" ON "upload_sessions" ("expires_at");
