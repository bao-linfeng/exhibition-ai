import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { customers, projects, tasks, type Database } from '@exhibition/db';
import type {
  DashboardSummaryResponse,
  TaskStatus,
} from '@exhibition/contracts';

const activeStatuses = ['draft', 'briefing', 'designing', 'reviewing'] as const;
const activeTaskStatuses: TaskStatus[] = [
  'pending',
  'queued',
  'running',
  'reconciling',
];

export class DashboardService {
  constructor(private db: Database) {}

  async getSummary(
    visibleProjectIds: string[] | 'all',
  ): Promise<DashboardSummaryResponse> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const projectScope =
      visibleProjectIds === 'all'
        ? undefined
        : visibleProjectIds.length > 0
          ? inArray(projects.id, visibleProjectIds)
          : sql`false`;
    const taskScope =
      visibleProjectIds === 'all'
        ? undefined
        : visibleProjectIds.length > 0
          ? inArray(tasks.projectId, visibleProjectIds)
          : sql`false`;

    const [statusCounts, approvedCounts, activeTaskCounts, recentProjects] =
      await Promise.all([
        this.db
          .select({
            status: projects.status,
            count: sql<number>`count(*)::int`,
          })
          .from(projects)
          .where(projectScope)
          .groupBy(projects.status),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(projects)
          .where(
            and(
              eq(projects.status, 'approved'),
              gte(projects.updatedAt, monthStart),
              projectScope,
            ),
          ),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(tasks)
          .where(and(inArray(tasks.status, activeTaskStatuses), taskScope)),
        this.db
          .select({
            id: projects.id,
            name: projects.name,
            status: projects.status,
            customerName: customers.name,
            updatedAt: projects.updatedAt,
          })
          .from(projects)
          .innerJoin(customers, eq(projects.customerId, customers.id))
          .where(projectScope)
          .orderBy(desc(projects.updatedAt))
          .limit(5),
      ]);

    const counts = new Map(
      statusCounts.map(({ status, count }) => [status, count]),
    );
    const activeProjects = activeStatuses.reduce(
      (total, status) => total + (counts.get(status) ?? 0),
      0,
    );

    return {
      totalProjects: [...counts.values()].reduce(
        (total, count) => total + count,
        0,
      ),
      activeProjects,
      activeTasks: activeTaskCounts[0]?.count ?? 0,
      pendingReview: counts.get('reviewing') ?? 0,
      approvedThisMonth: approvedCounts[0]?.count ?? 0,
      recentProjects: recentProjects.map((project) => ({
        ...project,
        updatedAt: project.updatedAt.toISOString(),
      })),
    };
  }
}
