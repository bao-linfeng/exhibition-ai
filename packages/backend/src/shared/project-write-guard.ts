/**
 * 项目处于 reviewing/approved/archived 状态时，所有写操作均被锁定。
 * 调用方收到 'project_locked' 后，API 层应返回 HTTP 409 或 403（按现有映射约定）。
 */
export type ProjectStatus = string;

export const LOCKED_STATUSES = new Set(['reviewing', 'approved', 'archived']);

export function isProjectLocked(status: ProjectStatus): boolean {
  return LOCKED_STATUSES.has(status);
}
