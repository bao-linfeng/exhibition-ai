import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema, DateTimeSchema } from '../common/base.js';

// 确认动作
export const ConfirmationActionSchema = Type.Union([
  Type.Literal('apply_brief_patch'),
  Type.Literal('create_generation'),
]);

// 确认状态
export const ConfirmationStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('approved'),
  Type.Literal('rejected'),
  Type.Literal('expired'),
]);

// 确认
export const ConfirmationSchema = Type.Object(
  {
    id: UuidSchema,
    runId: UuidSchema,
    projectId: UuidSchema,
    requestedBy: UuidSchema,
    action: ConfirmationActionSchema,
    payload: Type.Record(Type.String(), Type.Any()),
    payloadHash: Type.String({ minLength: 64, maxLength: 64 }),
    estimatedFee: Type.Optional(
      Type.Object(
        {
          maxAmountMinor: Type.Integer({ minimum: 0 }),
          currency: Type.String({ maxLength: 3 }),
        },
        { additionalProperties: false },
      ),
    ),
    status: ConfirmationStatusSchema,
    resultTaskId: Type.Union([UuidSchema, Type.Null()]),
    resultBriefRevisionId: Type.Union([UuidSchema, Type.Null()]),
    expiresAt: DateTimeSchema,
    createdAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

// POST /confirmations/:id/approve
export const ApproveConfirmationRequestSchema = Type.Object(
  {
    payloadHash: Type.String({ minLength: 64, maxLength: 64 }),
  },
  { additionalProperties: false },
);

export const ApproveConfirmationResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        confirmationId: UuidSchema,
        status: Type.Literal('approved'),
        taskId: Type.Union([UuidSchema, Type.Null()]),
        briefRevisionId: Type.Union([UuidSchema, Type.Null()]),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// POST /confirmations/:id/reject
export const RejectConfirmationRequestSchema = Type.Object(
  {
    reason: Type.Optional(Type.String({ maxLength: 1000 })),
  },
  { additionalProperties: false },
);

export const RejectConfirmationResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        confirmationId: UuidSchema,
        status: Type.Literal('rejected'),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// GET /confirmations/:id
export const GetConfirmationResponseSchema = Type.Object(
  {
    data: ConfirmationSchema,
  },
  { additionalProperties: false },
);

// 类型导出
export type ConfirmationAction = Static<typeof ConfirmationActionSchema>;
export type ConfirmationStatus = Static<typeof ConfirmationStatusSchema>;
export type Confirmation = Static<typeof ConfirmationSchema>;
export type ApproveConfirmationRequest = Static<
  typeof ApproveConfirmationRequestSchema
>;
export type RejectConfirmationRequest = Static<
  typeof RejectConfirmationRequestSchema
>;
