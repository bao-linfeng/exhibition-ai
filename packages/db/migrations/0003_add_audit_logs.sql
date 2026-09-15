CREATE TYPE "public"."audit_event_type" AS ENUM('user.login', 'user.logout', 'user.created', 'user.updated', 'project.created', 'project.updated', 'project.transitioned', 'project.member_added', 'project.member_removed', 'project.owner_transferred', 'brief.updated', 'brief.confirmed', 'generation.created', 'task.cancelled', 'task.reconciled', 'asset.uploaded', 'asset.hidden', 'version.selected', 'export.created');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "audit_event_type" NOT NULL,
	"actor_id" uuid,
	"actor_email" varchar(255),
	"project_id" uuid,
	"resource_type" varchar(100),
	"resource_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
