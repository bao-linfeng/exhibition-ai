import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { customers, projects, type Database } from '@exhibition/db';
import type { DashboardSummaryResponse } from '@exhibition/contracts';

const activeStatuses = ['draft', 'briefing', 'designing', 'reviewing'] as const;

export class DashboardService {
  constructor(private db: Database) {}

  async getSummary(): Promise<DashboardSummaryResponse> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [statusCounts, approvedCounts, recentProjects] = await Promise.all([
      this.db
        .select({
          status: projects.status,
          count: sql<number>`count(*)::int`,
        })
        .from(projects)
        .groupBy(projects.status),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(projects)
        .where(
          and(
            eq(projects.status, 'approved'),
            gte(projects.updatedAt, monthStart),
          ),
        ),
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
      pendingReview: counts.get('reviewing') ?? 0,
      approvedThisMonth: approvedCounts[0]?.count ?? 0,
      recentProjects: recentProjects.map((project) => ({
        ...project,
        updatedAt: project.updatedAt.toISOString(),
      })),
    };
  }
}
