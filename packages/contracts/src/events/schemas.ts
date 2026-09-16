import { Type, type Static } from '@sinclair/typebox';

export const ProjectEventBaseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  type: Type.String(),
  projectId: Type.String({ format: 'uuid' }),
  sequence: Type.Integer({ minimum: 1 }),
  timestamp: Type.String({ format: 'date-time' }),
});

export const TaskUpdatedEventDataSchema = Type.Object({
  taskId: Type.String({ format: 'uuid' }),
  status: Type.String(),
  progress: Type.Optional(Type.String()),
});

export const TaskUpdatedEventSchema = Type.Intersect([
  ProjectEventBaseSchema,
  Type.Object({
    type: Type.Literal('task.updated'),
    data: TaskUpdatedEventDataSchema,
  }),
]);

export const VersionCreatedEventDataSchema = Type.Object({
  versionId: Type.String({ format: 'uuid' }),
  sequence: Type.Integer(),
  taskId: Type.String({ format: 'uuid' }),
});

export const VersionCreatedEventSchema = Type.Intersect([
  ProjectEventBaseSchema,
  Type.Object({
    type: Type.Literal('version.created'),
    data: VersionCreatedEventDataSchema,
  }),
]);

export const AssetReadyEventDataSchema = Type.Object({
  assetId: Type.String({ format: 'uuid' }),
  kind: Type.String(),
});

export const AssetReadyEventSchema = Type.Intersect([
  ProjectEventBaseSchema,
  Type.Object({
    type: Type.Literal('asset.ready'),
    data: AssetReadyEventDataSchema,
  }),
]);

export const ProjectCreatedEventDataSchema = Type.Object({
  projectId: Type.String({ format: 'uuid' }),
  name: Type.String(),
  customerId: Type.String({ format: 'uuid' }),
  ownerId: Type.String({ format: 'uuid' }),
});

export const ProjectCreatedEventSchema = Type.Intersect([
  ProjectEventBaseSchema,
  Type.Object({
    type: Type.Literal('project.created'),
    data: ProjectCreatedEventDataSchema,
  }),
]);

export const ProjectUpdatedEventDataSchema = Type.Object({
  projectId: Type.String({ format: 'uuid' }),
  changes: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const ProjectUpdatedEventSchema = Type.Intersect([
  ProjectEventBaseSchema,
  Type.Object({
    type: Type.Literal('project.updated'),
    data: ProjectUpdatedEventDataSchema,
  }),
]);

export const ProjectArchivedEventDataSchema = Type.Object({
  projectId: Type.String({ format: 'uuid' }),
});

export const ProjectArchivedEventSchema = Type.Intersect([
  ProjectEventBaseSchema,
  Type.Object({
    type: Type.Literal('project.archived'),
    data: ProjectArchivedEventDataSchema,
  }),
]);

export const ProjectRestoredEventDataSchema = Type.Object({
  projectId: Type.String({ format: 'uuid' }),
});

export const ProjectRestoredEventSchema = Type.Intersect([
  ProjectEventBaseSchema,
  Type.Object({
    type: Type.Literal('project.restored'),
    data: ProjectRestoredEventDataSchema,
  }),
]);

export const BriefConfirmedEventDataSchema = Type.Object({
  revisionId: Type.String({ format: 'uuid' }),
  revisionNumber: Type.Integer(),
  confirmedBy: Type.String({ format: 'uuid' }),
});

export const BriefConfirmedEventSchema = Type.Intersect([
  ProjectEventBaseSchema,
  Type.Object({
    type: Type.Literal('brief.confirmed'),
    data: BriefConfirmedEventDataSchema,
  }),
]);

export const MessageDeltaEventDataSchema = Type.Object({
  conversationId: Type.String({ format: 'uuid' }),
  messageId: Type.String({ format: 'uuid' }),
  delta: Type.String(),
});

export const MessageDeltaEventSchema = Type.Intersect([
  ProjectEventBaseSchema,
  Type.Object({
    type: Type.Literal('message.delta'),
    data: MessageDeltaEventDataSchema,
  }),
]);

export const MessageCompletedEventDataSchema = Type.Object({
  conversationId: Type.String({ format: 'uuid' }),
  messageId: Type.String({ format: 'uuid' }),
  content: Type.String(),
});

export const MessageCompletedEventSchema = Type.Intersect([
  ProjectEventBaseSchema,
  Type.Object({
    type: Type.Literal('message.completed'),
    data: MessageCompletedEventDataSchema,
  }),
]);

export const ConfirmationCreatedEventDataSchema = Type.Object({
  confirmationId: Type.String({ format: 'uuid' }),
  question: Type.String(),
});

export const ConfirmationCreatedEventSchema = Type.Intersect([
  ProjectEventBaseSchema,
  Type.Object({
    type: Type.Literal('confirmation.created'),
    data: ConfirmationCreatedEventDataSchema,
  }),
]);

export const StreamResetEventDataSchema = Type.Object({
  reason: Type.String(),
  minSequence: Type.Integer(),
});

export const StreamResetEventSchema = Type.Intersect([
  ProjectEventBaseSchema,
  Type.Object({
    type: Type.Literal('stream.reset'),
    data: StreamResetEventDataSchema,
  }),
]);

export const ProjectEventSchema = Type.Union([
  ProjectCreatedEventSchema,
  ProjectUpdatedEventSchema,
  ProjectArchivedEventSchema,
  ProjectRestoredEventSchema,
  BriefConfirmedEventSchema,
  TaskUpdatedEventSchema,
  VersionCreatedEventSchema,
  AssetReadyEventSchema,
  MessageDeltaEventSchema,
  MessageCompletedEventSchema,
  ConfirmationCreatedEventSchema,
  StreamResetEventSchema,
]);

export type ProjectEvent = Static<typeof ProjectEventSchema>;
export type ProjectCreatedEvent = Static<typeof ProjectCreatedEventSchema>;
export type ProjectUpdatedEvent = Static<typeof ProjectUpdatedEventSchema>;
export type ProjectArchivedEvent = Static<typeof ProjectArchivedEventSchema>;
export type ProjectRestoredEvent = Static<typeof ProjectRestoredEventSchema>;
export type BriefConfirmedEvent = Static<typeof BriefConfirmedEventSchema>;
export type TaskUpdatedEvent = Static<typeof TaskUpdatedEventSchema>;
export type VersionCreatedEvent = Static<typeof VersionCreatedEventSchema>;
export type AssetReadyEvent = Static<typeof AssetReadyEventSchema>;
export type MessageDeltaEvent = Static<typeof MessageDeltaEventSchema>;
export type MessageCompletedEvent = Static<typeof MessageCompletedEventSchema>;
export type ConfirmationCreatedEvent = Static<typeof ConfirmationCreatedEventSchema>;
export type StreamResetEvent = Static<typeof StreamResetEventSchema>;
