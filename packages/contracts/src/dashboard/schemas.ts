import { Type, type Static } from '@sinclair/typebox';
import { DateTimeSchema, UuidSchema } from '../common/base.js';
import { ProjectStatusSchema } from '../projects/schemas.js';

export const DashboardRecentProjectSchema = Type.Object(
  {
    id: UuidSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    status: ProjectStatusSchema,
    customerName: Type.String(),
    updatedAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

export const DashboardSummaryResponseSchema = Type.Object(
  {
    totalProjects: Type.Integer({ minimum: 0 }),
    activeProjects: Type.Integer({ minimum: 0 }),
    activeTasks: Type.Integer({ minimum: 0 }),
    pendingReview: Type.Integer({ minimum: 0 }),
    approvedThisMonth: Type.Integer({ minimum: 0 }),
    recentProjects: Type.Array(DashboardRecentProjectSchema, { maxItems: 5 }),
  },
  { additionalProperties: false },
);

export type DashboardRecentProject = Static<
  typeof DashboardRecentProjectSchema
>;
export type DashboardSummaryResponse = Static<
  typeof DashboardSummaryResponseSchema
>;
