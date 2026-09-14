import { Type, type Static } from '@sinclair/typebox';
import { EmailSchema, DateTimeSchema, UuidSchema } from '../common/base.js';

// 用户角色
export const UserRoleSchema = Type.Union([
  Type.Literal('admin'),
  Type.Literal('designer'),
  Type.Literal('sales'),
  Type.Literal('viewer'),
]);

// 用户状态
export const UserStatusSchema = Type.Union([
  Type.Literal('enabled'),
  Type.Literal('disabled'),
]);

// 用户摘要（登录后返回、/auth/me）
export const UserSummarySchema = Type.Object(
  {
    id: UuidSchema,
    email: EmailSchema,
    displayName: Type.String({ minLength: 1, maxLength: 100 }),
    role: UserRoleSchema,
    status: UserStatusSchema,
    mustChangePassword: Type.Boolean(),
    createdAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

// POST /auth/login
export const LoginRequestSchema = Type.Object(
  {
    email: EmailSchema,
    password: Type.String({ minLength: 1, maxLength: 255 }),
  },
  { additionalProperties: false },
);

export const LoginResponseSchema = Type.Object(
  {
    data: UserSummarySchema,
  },
  { additionalProperties: false },
);

// GET /auth/me
export const MeResponseSchema = Type.Object(
  {
    data: UserSummarySchema,
  },
  { additionalProperties: false },
);

// GET /auth/csrf
export const CsrfResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        token: Type.String(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// POST /auth/logout - 204 No Content

// PUT /auth/password
export const ChangePasswordRequestSchema = Type.Object(
  {
    currentPassword: Type.String({ minLength: 1, maxLength: 255 }),
    newPassword: Type.String({ minLength: 8, maxLength: 255 }),
  },
  { additionalProperties: false },
);

// 类型导出
export type UserRole = Static<typeof UserRoleSchema>;
export type UserStatus = Static<typeof UserStatusSchema>;
export type UserSummary = Static<typeof UserSummarySchema>;
export type LoginRequest = Static<typeof LoginRequestSchema>;
export type LoginResponse = Static<typeof LoginResponseSchema>;
export type ChangePasswordRequest = Static<typeof ChangePasswordRequestSchema>;
