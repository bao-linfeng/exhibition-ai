-- Migration: 0008_add_image_versions
-- 创建 image_versions 表，记录每次多图生成中单张图片的发布版本

CREATE TABLE IF NOT EXISTS image_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  output_ordinal INTEGER NOT NULL,
  asset_id UUID NOT NULL UNIQUE REFERENCES assets(id),
  parent_version_id UUID REFERENCES image_versions(id),
  sequence INTEGER NOT NULL,
  brief_revision_id UUID NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(127) NOT NULL,
  hidden_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS image_versions_project_sequence_unique
  ON image_versions (project_id, sequence);

CREATE INDEX IF NOT EXISTS image_versions_project_id_idx
  ON image_versions (project_id);

CREATE INDEX IF NOT EXISTS image_versions_task_id_idx
  ON image_versions (task_id);

CREATE INDEX IF NOT EXISTS image_versions_parent_version_id_idx
  ON image_versions (parent_version_id);
