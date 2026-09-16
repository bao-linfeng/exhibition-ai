CREATE TABLE export_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  format VARCHAR(20) NOT NULL DEFAULT 'zip',
  version_ids JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  result_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  error_message TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);
--> statement-breakpoint
CREATE INDEX export_records_project_id_idx ON export_records(project_id);
--> statement-breakpoint
CREATE INDEX export_records_task_id_idx ON export_records(task_id);
--> statement-breakpoint
CREATE INDEX export_records_status_idx ON export_records(status);
