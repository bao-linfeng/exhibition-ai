import { EventEmitter } from 'node:events';

type Pool = {
  connect(): Promise<{
    query: <T = unknown>(
      sql: string,
      params?: unknown[],
    ) => Promise<{ rows: T[] }>;
    release(): void;
  }>;
};

export interface ProjectEventData {
  type: string;
  data: Record<string, unknown>;
  resourceId?: string;
  resourceRevision?: number;
}

export interface ProjectEvent {
  id: string;
  projectId: string;
  sequence: number;
  type: string;
  data: Record<string, unknown>;
  resourceId: string | null;
  resourceRevision: number | null;
  createdAt: Date;
}

export class EventsService {
  private eventBus = new EventEmitter();

  constructor(private pool: Pool) {
    this.eventBus.setMaxListeners(1000); // 支持多个并发连接
  }

  async appendEvent(
    projectId: string,
    event: ProjectEventData,
    _actor: { userId: string; role: string },
  ): Promise<ProjectEvent> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 原子递增 sequence 并插入事件
      const result = await client.query<ProjectEvent>(
        `
        WITH next_seq AS (
          UPDATE projects
          SET next_event_sequence = next_event_sequence + 1
          WHERE id = $1
          RETURNING next_event_sequence - 1 AS seq
        )
        INSERT INTO project_events (project_id, sequence, type, data, resource_id, resource_revision)
        SELECT $1, seq, $2, $3, $4, $5
        FROM next_seq
        RETURNING id, project_id AS "projectId", sequence, type, data, resource_id AS "resourceId",
                  resource_revision AS "resourceRevision", created_at AS "createdAt"
        `,
        [
          projectId,
          event.type,
          JSON.stringify(event.data),
          event.resourceId ?? null,
          event.resourceRevision ?? null,
        ],
      );

      await client.query('COMMIT');

      // 发布事件到 EventEmitter，供 SSE 订阅者实时接收
      const insertedEvent = result.rows[0];
      if (insertedEvent) {
        this.eventBus.emit('project.event', insertedEvent);
      }

      return insertedEvent!;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEvents(
    projectId: string,
    afterSequence?: number,
    limit: number = 100,
  ): Promise<ProjectEvent[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<ProjectEvent>(
        `
        SELECT
          id,
          project_id AS "projectId",
          sequence,
          type,
          data,
          resource_id AS "resourceId",
          resource_revision AS "resourceRevision",
          created_at AS "createdAt"
        FROM project_events
        WHERE project_id = $1
          AND ($2::integer IS NULL OR sequence > $2)
        ORDER BY sequence ASC
        LIMIT $3
        `,
        [projectId, afterSequence ?? null, limit],
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getLatestSequence(projectId: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ sequence: number }>(
        `
        SELECT COALESCE(MAX(sequence), 0) AS sequence
        FROM project_events
        WHERE project_id = $1
        `,
        [projectId],
      );
      return result.rows[0]?.sequence ?? 0;
    } finally {
      client.release();
    }
  }

  async getMinSequence(projectId: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ sequence: number }>(
        `
        SELECT COALESCE(MIN(sequence), 1) AS sequence
        FROM project_events
        WHERE project_id = $1
        `,
        [projectId],
      );
      return result.rows[0]?.sequence ?? 1;
    } finally {
      client.release();
    }
  }

  async getMaxSequence(projectId: string): Promise<number> {
    return this.getLatestSequence(projectId);
  }

  subscribe(
    projectId: string,
    callback: (event: ProjectEvent) => void,
  ): () => void {
    const handler = (event: ProjectEvent & { projectId: string }) => {
      if (event.projectId === projectId) {
        callback(event);
      }
    };

    this.eventBus.on('project.event', handler);

    return () => {
      this.eventBus.off('project.event', handler);
    };
  }
}
