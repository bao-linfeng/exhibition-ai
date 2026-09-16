import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema, DateTimeSchema } from '../common/base.js';

// SSE 事件类型
export const EventTypeSchema = Type.Union([
  Type.Literal('task.updated'),
  Type.Literal('message.delta'),
  Type.Literal('message.completed'),
  Type.Literal('confirmation.created'),
  Type.Literal('asset.ready'),
  Type.Literal('version.created'),
  Type.Literal('project.updated'),
  Type.Literal('stream.reset'),
]);

// 基础事件
const BaseEventSchema = Type.Object(
  {
    id: Type.String(),
    type: EventTypeSchema,
    projectId: UuidSchema,
    sequence: Type.Integer({ minimum: 1 }),
    timestamp: DateTimeSchema,
  },
  { additionalProperties: false },
);

// task.updated 事件
export const TaskUpdatedEventSchema = Type.Intersect([
  BaseEventSchema,
  Type.Object(
    {
      type: Type.Literal('task.updated'),
      data: Type.Object(
        {
          taskId: UuidSchema,
          status: Type.String(),
          stage: Type.Union([Type.String(), Type.Null()]),
          progress: Type.Union([
            Type.Number({ minimum: 0, maximum: 1 }),
            Type.Null(),
          ]),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
]);

// message.delta 事件
export const MessageDeltaEventSchema = Type.Intersect([
  BaseEventSchema,
  Type.Object(
    {
      type: Type.Literal('message.delta'),
      data: Type.Object(
        {
          messageId: UuidSchema,
          conversationId: UuidSchema,
          delta: Type.String(),
          index: Type.Integer({ minimum: 0 }),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
]);

// message.completed 事件
export const MessageCompletedEventSchema = Type.Intersect([
  BaseEventSchema,
  Type.Object(
    {
      type: Type.Literal('message.completed'),
      data: Type.Object(
        {
          messageId: UuidSchema,
          conversationId: UuidSchema,
          status: Type.Union([
            Type.Literal('completed'),
            Type.Literal('interrupted'),
            Type.Literal('failed'),
          ]),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
]);

// confirmation.created 事件
export const ConfirmationCreatedEventSchema = Type.Intersect([
  BaseEventSchema,
  Type.Object(
    {
      type: Type.Literal('confirmation.created'),
      data: Type.Object(
        {
          confirmationId: UuidSchema,
          runId: UuidSchema,
          action: Type.String(),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
]);

// asset.ready 事件
export const AssetReadyEventSchema = Type.Intersect([
  BaseEventSchema,
  Type.Object(
    {
      type: Type.Literal('asset.ready'),
      data: Type.Object(
        {
          assetId: UuidSchema,
          kind: Type.String(),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
]);

// version.created 事件
export const VersionCreatedEventSchema = Type.Intersect([
  BaseEventSchema,
  Type.Object(
    {
      type: Type.Literal('version.created'),
      data: Type.Object(
        {
          versionId: UuidSchema,
          assetId: UuidSchema,
          sequence: Type.Integer({ minimum: 1 }),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
]);

// project.updated 事件
export const ProjectUpdatedEventSchema = Type.Intersect([
  BaseEventSchema,
  Type.Object(
    {
      type: Type.Literal('project.updated'),
      data: Type.Object(
        {
          status: Type.Optional(Type.String()),
          selectedVersionId: Type.Optional(
            Type.Union([UuidSchema, Type.Null()]),
          ),
          revision: Type.Integer({ minimum: 1 }),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
]);

// stream.reset 事件（服务端发送，通知客户端重新 GET 快照）
export const StreamResetEventSchema = Type.Intersect([
  BaseEventSchema,
  Type.Object(
    {
      type: Type.Literal('stream.reset'),
      data: Type.Object(
        {
          reason: Type.String(),
          minSequence: Type.Integer({ minimum: 1 }),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
]);

// 所有事件的联合类型
export const ProjectEventSchema = Type.Union([
  TaskUpdatedEventSchema,
  MessageDeltaEventSchema,
  MessageCompletedEventSchema,
  ConfirmationCreatedEventSchema,
  AssetReadyEventSchema,
  VersionCreatedEventSchema,
  ProjectUpdatedEventSchema,
  StreamResetEventSchema,
]);

// 类型导出
export type EventType = Static<typeof EventTypeSchema>;
export type TaskUpdatedEvent = Static<typeof TaskUpdatedEventSchema>;
export type MessageDeltaEvent = Static<typeof MessageDeltaEventSchema>;
export type MessageCompletedEvent = Static<typeof MessageCompletedEventSchema>;
export type ConfirmationCreatedEvent = Static<
  typeof ConfirmationCreatedEventSchema
>;
export type AssetReadyEvent = Static<typeof AssetReadyEventSchema>;
export type VersionCreatedEvent = Static<typeof VersionCreatedEventSchema>;
export type ProjectUpdatedEvent = Static<typeof ProjectUpdatedEventSchema>;
export type StreamResetEvent = Static<typeof StreamResetEventSchema>;
export type ProjectEvent = Static<typeof ProjectEventSchema>;
