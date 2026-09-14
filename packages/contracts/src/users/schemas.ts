import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  RevisionSchema,
  PaginationQuerySchema,
} from '../common/base.js';
import { UserRoleSchema, UserStatusSchema } from '../auth/schemas.js';

// 用户详情
export const UserSchema = Type.Object(
  {
    id: UuidSchema,
    email: Type.String({ format: 'email', maxLength: 255 }),
    displayName: Type.String({ minLength: 1, maxLength: 100 }),
    role: UserRoleSchema,
    status: UserStatusSchema,
    mustChangePassword: Type.Boolean(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    revision: RevisionSchema,
  },
  { additionalProperties: false },
);

// GET /users - 管理员查询用户列表
export const ListUsersQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object(
    {
      role: Type.Optional(UserRoleSchema),
      status: Type.Optional(UserStatusSchema),
      search: Type.Optional(Type.String({ maxLength: 200 })),
    },
    { additionalProperties: false },
  ),
]);

export const ListUsersResponseSchema = Type.Object(
  {
    data: Type.Array(UserSchema),
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

// PATCH /users/:id - 管理员修改用户
export const UpdateUserRequestSchema = Type.Object(
  {
    role: Type.Optional(UserRoleSchema),
    status: Type.Optional(UserStatusSchema),
    expectedRevision: RevisionSchema,
  },
  { additionalProperties: false },
);

export const UpdateUserResponseSchema = Type.Object(
  {
    data: UserSchema,
  },
  { additionalProperties: false },
);

// GET /users/:id
export const GetUserResponseSchema = Type.Object(
  {
    data: UserSchema,
  },
  { additionalProperties: false },
);

// GET /users/options - 项目负责人获取用户选项（用于分配成员）
export const UserOptionSchema = Type.Object(
  {
    id: UuidSchema,
    displayName: Type.String(),
    email: Type.String(),
    role: UserRoleSchema,
  },
  { additionalProperties: false },
);

export const ListUserOptionsQuerySchema = Type.Object(
  {
    search: Type.Optional(Type.String({ maxLength: 100 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  },
  { additionalProperties: false },
);

export const ListUserOptionsResponseSchema = Type.Object(
  {
    data: Type.Array(UserOptionSchema),
  },
  { additionalProperties: false },
);

// 类型导出
export type User = Static<typeof UserSchema>;
export type ListUsersQuery = Static<typeof ListUsersQuerySchema>;
export type UpdateUserRequest = Static<typeof UpdateUserRequestSchema>;
export type UserOption = Static<typeof UserOptionSchema>;
