import { Type, type Static } from '@sinclair/typebox';

// Health check schemas
export const HealthSchema = Type.Object(
  { status: Type.Literal('ok') },
  { additionalProperties: false },
);
export const ReadySchema = Type.Object(
  {
    status: Type.Union([Type.Literal('ready'), Type.Literal('not_ready')]),
    dependencies: Type.Object(
      {
        postgres: Type.Boolean(),
        redis: Type.Boolean(),
        storage: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type Health = Static<typeof HealthSchema>;
export type Readiness = Static<typeof ReadySchema>;

// Common types
export * from './common/base.js';

// Domain modules
export * from './auth/schemas.js';
export * from './users/schemas.js';
export * from './customers/schemas.js';
export * from './projects/schemas.js';
export * from './briefs/schemas.js';
export * from './assets/schemas.js';
export * from './directions/schemas.js';
export * from './generations/schemas.js';
export * from './versions/schemas.js';
export * from './tasks/schemas.js';
export * from './conversations/schemas.js';
export * from './confirmations/schemas.js';
export * from './exports/schemas.js';
export * from './events/schemas.js';
export * from './models/schemas.js';
export * from './audit/schemas.js';
