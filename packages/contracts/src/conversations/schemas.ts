import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  PaginationQuerySchema,
} from '../common/base.js';

// 消息角色
export const MessageRoleSchema = Type.Union([
  Type.Literal('user'),
  Type.Literal('assistant'),
  Type.Literal('system'),
]);

// 消息状态
export const MessageStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('streaming'),
  Type.Literal('completed'),
  Type.Literal('interrupted'),
  Type.Literal('failed'),
]);

// 消息部分类型
export const MessagePartSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal('text'),
      text: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('execution_summary'),
      summary: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('tool'),
      toolName: Type.String(),
      callId: Type.String(),
      status: Type.Union([
        Type.Literal('running'),
        Type.Literal('succeeded'),
        Type.Literal('failed'),
      ]),
      summary: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('asset'),
      assetId: UuidSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('task'),
      taskId: UuidSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('confirmation'),
      confirmationId: UuidSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('error'),
      code: Type.String(),
      message: Type.String(),
    },
    { additionalProperties: false },
  ),
]);

// 消息
export const MessageSchema = Type.Object(
  {
    id: UuidSchema,
    conversationId: UuidSchema,
    role: MessageRoleSchema,
    parts: Type.Array(MessagePartSchema, { minItems: 1 }),
    status: MessageStatusSchema,
    clientMessageId: Type.Union([Type.String(), Type.Null()]),
    createdBy: Type.Union([UuidSchema, Type.Null()]),
    createdAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

// 会话
export const ConversationSchema = Type.Object(
  {
    id: UuidSchema,
    projectId: UuidSchema,
    title: Type.String({ maxLength: 200 }),
    activeRunId: Type.Union([UuidSchema, Type.Null()]),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

// GET /projects/:id/conversation
export const GetConversationResponseSchema = Type.Object(
  {
    data: ConversationSchema,
  },
  { additionalProperties: false },
);

// GET /conversations/:id/messages
export const ListMessagesQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object(
    {
      before: Type.Optional(UuidSchema),
    },
    { additionalProperties: false },
  ),
]);

export const ListMessagesResponseSchema = Type.Object(
  {
    data: Type.Array(MessageSchema),
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

// POST /conversations/:id/messages
export const SendMessageRequestSchema = Type.Object(
  {
    text: Type.String({ minLength: 1, maxLength: 10000 }),
    clientMessageId: Type.String({ minLength: 1, maxLength: 100 }),
    assetIds: Type.Optional(Type.Array(UuidSchema, { maxItems: 5 })),
  },
  { additionalProperties: false },
);

export const SendMessageResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        messageId: UuidSchema,
        runId: UuidSchema,
        taskId: Type.Union([UuidSchema, Type.Null()]),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// 类型导出
export type MessageRole = Static<typeof MessageRoleSchema>;
export type MessageStatus = Static<typeof MessageStatusSchema>;
export type MessagePart = Static<typeof MessagePartSchema>;
export type Message = Static<typeof MessageSchema>;
export type Conversation = Static<typeof ConversationSchema>;
export type SendMessageRequest = Static<typeof SendMessageRequestSchema>;
