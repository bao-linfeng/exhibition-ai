ALTER TABLE "users" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "contact_name" varchar(100),
  "contact_phone" varchar(50),
  "contact_email" varchar(255),
  "industry" varchar(100),
  "address" varchar(500),
  "notes" text,
  "status" "customer_status" DEFAULT 'active' NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'briefing', 'designing', 'reviewing', 'approved', 'archived');--> statement-breakpoint
CREATE TABLE "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "customer_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "status" "project_status" DEFAULT 'draft' NOT NULL,
  "archived_from_status" "project_status",
  "exhibition_name" varchar(200),
  "exhibition_venue" varchar(200),
  "booth_number" varchar(50),
  "exhibition_date" date,
  "delivery_deadline" date,
  "industry" varchar(100),
  "notes" text,
  "current_brief_revision_id" uuid,
  "selected_version_id" uuid,
  "next_version_sequence" integer DEFAULT 1 NOT NULL,
  "next_event_sequence" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "projects_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint
CREATE TABLE "project_members" (
  "project_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "added_by" uuid NOT NULL,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "project_members_project_id_user_id_pk" PRIMARY KEY("project_id", "user_id"),
  CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "project_members_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);
