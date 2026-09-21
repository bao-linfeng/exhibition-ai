import type { ActorContext } from '../../shared/ActorContext.js';

type Pool = {
  connect(): Promise<{
    query: <T = unknown>(
      sql: string,
      params?: unknown[],
    ) => Promise<{ rows: T[] }>;
    release(): void;
  }>;
};

/**
 * ProjectPolicy 处理项目相关的权限检查
 */
export class ProjectPolicy {
  constructor(private pool: Pool) {}

  /**
   * 检查用户是否可以使用 Agent（发起会话、生成等付费操作）。
   * 要求：admin 或 designer 角色 + 项目成员。
   */
  async canUseAgent(userId: string, projectId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const userResult = await client.query<{ role: string }>(
        'SELECT role FROM users WHERE id = $1',
        [userId],
      );
      const role = userResult.rows[0]?.role;

      if (role === 'admin') return true;
      if (role !== 'designer') return false;

      const memberResult = await client.query<{ exists: boolean }>(
        `
        SELECT EXISTS(
          SELECT 1 FROM project_members
          WHERE project_id = $1 AND user_id = $2
        ) as exists
        `,
        [projectId, userId],
      );

      return memberResult.rows[0]?.exists ?? false;
    } finally {
      client.release();
    }
  }

  /**
   * 检查用户是否为项目成员或 admin。
   * 用于查看项目相关资源。
   */
  async isMemberOrAdmin(userId: string, projectId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const userResult = await client.query<{ role: string }>(
        'SELECT role FROM users WHERE id = $1',
        [userId],
      );

      if (userResult.rows[0]?.role === 'admin') return true;

      const memberResult = await client.query<{ exists: boolean }>(
        `
        SELECT EXISTS(
          SELECT 1 FROM project_members
          WHERE project_id = $1 AND user_id = $2
        ) as exists
        `,
        [projectId, userId],
      );

      return memberResult.rows[0]?.exists ?? false;
    } finally {
      client.release();
    }
  }

  /**
   * 检查用户是否有写权限（admin 或 designer）。
   * 用于创建或修改资源的快速检查。
   */
  canWrite(role: string): boolean {
    return role === 'admin' || role === 'designer';
  }

  async canViewProject(
    actorContext: ActorContext,
    projectId: string,
  ): Promise<boolean> {
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
