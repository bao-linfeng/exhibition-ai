import type { ActorContext } from '../../shared/ActorContext.js';

type Pool = {
  connect(): Promise<{
    query: <T = unknown>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    release(): void;
  }>;
};

/**
 * ProjectPolicy 处理项目相关的权限检查
 */
export class ProjectPolicy {
  constructor(private pool: Pool) {}

  async canViewProject(actorContext: ActorContext, projectId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      // Admin 可以查看所有项目
      if (actorContext.role === 'admin') {
        return true;
      }

      // 检查用户是否是项目成员
      const result = await client.query<{ exists: boolean }>(
        `
        SELECT EXISTS(
          SELECT 1 FROM project_members
          WHERE project_id = $1 AND user_id = $2
        ) as exists
        `,
        [projectId, actorContext.userId],
      );

      return result.rows[0]?.exists ?? false;
    } finally {
      client.release();
    }
  }
}
