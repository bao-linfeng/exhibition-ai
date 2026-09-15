import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  PaginationQuerySchema,
} from '../common/base.js';

// 任务类型
export const TaskKindSchema = Type.Union([
  Type.Literal('brief_parse'),
  Type.Literal('design_direction'),
  Type.Literal('image_generation'),
  Type.Literal('asset_validation'),
  Type.Literal('agent_run'),
  Type.Literal('export'),
]);

// 任务状态
export const TaskStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('queued'),
  Type.Literal('running'),
  Type.Literal('awaiting_confirmation'),
  Type.Literal('succeeded'),
  Type.Literal('partially_succeeded'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
  Type.Literal('reconciling'),
]);

// 输出状态
export const OutputStateSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('running'),
  Type.Literal('succeeded'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
  Type.Literal('reconciling'),
]);

// 费用状态
export const FeeStatusSchema = Type.Union([
  Type.Literal('estimated'),
  Type.Literal('actual'),
  Type.Literal('unknown'),
]);

// 任务输出
export const TaskOutputSchema = Type.Object(
  {
    ordinal: Type.Integer({ minimum: 0 }),
    state: OutputStateSchema,
    assetId: Type.Union([UuidSchema, Type.Null()]),
    versionId: Type.Union([UuidSchema, Type.Null()]),
    errorCode: Type.Union([Type.String(), Type.Null()]),
    errorMessage: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);

// 任务费用
export const TaskFeeSchema = Type.Object(
  {
    status: FeeStatusSchema,
    amountMinor: Type.Integer({ minimum: 0 }),
    currency: Type.String({ maxLength: 3 }),
    provider: Type.String(),
    model: Type.String(),
  },
  { additionalProperties: false },
);

// 任务详情
export const TaskSchema = Type.Object(
  {
    id: UuidSchema,
    projectId: UuidSchema,
    kind: TaskKindSchema,
    subtype: Type.Union([Type.String(), Type.Null()]),
    status: TaskStatusSchema,
    stage: Type.Union([Type.String(), Type.Null()]),
    progress: Type.Union([
      Type.Number({ minimum: 0, maximum: 1 }),
      Type.Null(),
    ]),
    outputs: Type.Array(TaskOutputSchema),
    fee: Type.Union([TaskFeeSchema, Type.Null()]),
    errorCode: Type.Union([Type.String(), Type.Null()]),
    errorMessage: Type.Union([Type.String(), Type.Null()]),
    canCancel: Type.Boolean(),
    canRetry: Type.Boolean(),
    retryOfTaskId: Type.Union([UuidSchema, Type.Null()]),
    requestedBy: UuidSchema,
    createdAt: DateTimeSchema,
    startedAt: Type.Union([DateTimeSchema, Type.Null()]),
    finishedAt: Type.Union([DateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

// GET /tasks
export const ListTasksQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object(
    {
      projectId: Type.Optional(UuidSchema),
      kind: Type.Optional(TaskKindSchema),
      status: Type.Optional(TaskStatusSchema),
    },
    { additionalProperties: false },
  ),
]);

export const ListTasksResponseSchema = Type.Object(
  {
    data: Type.Array(TaskSchema),
    page: Type.Object(
      {
        nextCursor: Type.Union([Type.String(), Type.Null()]),
        hasMore: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// GET /tasks/:id
export const GetTaskResponseSchema = Type.Object(
  {
    data: TaskSchema,
  },
  { additionalProperties: false },
);

// POST /tasks/:id/cancel
export const CancelTaskResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        status: TaskStatusSchema,
        message: Type.String(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// POST /tasks/:id/retry
export const RetryTaskRequestSchema = Type.Object(
  {
    failedOrdinals: Type.Optional(Type.Array(Type.Integer({ minimum: 0 }))),
  },
  { additionalProperties: false },
);

export const RetryTaskResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        taskId: UuidSchema,
        status: Type.Literal('pending'),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// POST /tasks/:id/reconcile (admin only)
export const ReconcileTaskRequestSchema = Type.Object(
  {
    ordinal: Type.Integer({ minimum: 0 }),
    outcome: Type.Union([
      Type.Literal('succeeded'),
      Type.Literal('failed'),
      Type.Literal('cancelled'),
    ]),
    actualFee: Type.Optional(TaskFeeSchema),
    reason: Type.String({ minLength: 1, maxLength: 2000 }),
  },
  { additionalProperties: false },
);

export const ReconcileTaskResponseSchema = Type.Object(
  {
    data: TaskSchema,
  },
  { additionalProperties: false },
);

// 类型导出
export type TaskKind = Static<typeof TaskKindSchema>;
export type TaskStatus = Static<typeof TaskStatusSchema>;
export type OutputState = Static<typeof OutputStateSchema>;
export type FeeStatus = Static<typeof FeeStatusSchema>;
export type TaskOutput = Static<typeof TaskOutputSchema>;
export type TaskFee = Static<typeof TaskFeeSchema>;
export type Task = Static<typeof TaskSchema>;
export type ListTasksQuery = Static<typeof ListTasksQuerySchema>;
export type RetryTaskRequest = Static<typeof RetryTaskRequestSchema>;
export type ReconcileTaskRequest = Static<typeof ReconcileTaskRequestSchema>;
