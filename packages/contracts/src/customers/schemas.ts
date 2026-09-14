import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  RevisionSchema,
  PaginationQuerySchema,
} from '../common/base.js';

// 客户状态
export const CustomerStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('inactive'),
]);

// 客户详情
export const CustomerSchema = Type.Object(
  {
    id: UuidSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    contactName: Type.Optional(Type.String({ maxLength: 100 })),
    contactPhone: Type.Optional(Type.String({ maxLength: 50 })),
    contactEmail: Type.Optional(
      Type.String({ format: 'email', maxLength: 255 }),
    ),
    industry: Type.Optional(Type.String({ maxLength: 100 })),
    address: Type.Optional(Type.String({ maxLength: 500 })),
    notes: Type.Optional(Type.String({ maxLength: 2000 })),
    status: CustomerStatusSchema,
    createdBy: UuidSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    revision: RevisionSchema,
  },
  { additionalProperties: false },
);

// GET /customers
export const ListCustomersQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object(
    {
      status: Type.Optional(CustomerStatusSchema),
      search: Type.Optional(Type.String({ maxLength: 200 })),
    },
    { additionalProperties: false },
  ),
]);

export const ListCustomersResponseSchema = Type.Object(
  {
    data: Type.Array(CustomerSchema),
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

// POST /customers
export const CreateCustomerRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    contactName: Type.Optional(Type.String({ maxLength: 100 })),
    contactPhone: Type.Optional(Type.String({ maxLength: 50 })),
    contactEmail: Type.Optional(
      Type.String({ format: 'email', maxLength: 255 }),
    ),
    industry: Type.Optional(Type.String({ maxLength: 100 })),
    address: Type.Optional(Type.String({ maxLength: 500 })),
    notes: Type.Optional(Type.String({ maxLength: 2000 })),
  },
  { additionalProperties: false },
);

export const CreateCustomerResponseSchema = Type.Object(
  {
    data: CustomerSchema,
  },
  { additionalProperties: false },
);

// GET /customers/:id
export const GetCustomerResponseSchema = Type.Object(
  {
    data: CustomerSchema,
  },
  { additionalProperties: false },
);

// PATCH /customers/:id
export const UpdateCustomerRequestSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    contactName: Type.Optional(Type.String({ maxLength: 100 })),
    contactPhone: Type.Optional(Type.String({ maxLength: 50 })),
    contactEmail: Type.Optional(
      Type.String({ format: 'email', maxLength: 255 }),
    ),
    industry: Type.Optional(Type.String({ maxLength: 100 })),
    address: Type.Optional(Type.String({ maxLength: 500 })),
    notes: Type.Optional(Type.String({ maxLength: 2000 })),
    status: Type.Optional(CustomerStatusSchema),
    expectedRevision: RevisionSchema,
  },
  { additionalProperties: false },
);

export const UpdateCustomerResponseSchema = Type.Object(
  {
    data: CustomerSchema,
  },
  { additionalProperties: false },
);

// 类型导出
export type CustomerStatus = Static<typeof CustomerStatusSchema>;
export type Customer = Static<typeof CustomerSchema>;
export type CreateCustomerRequest = Static<typeof CreateCustomerRequestSchema>;
export type UpdateCustomerRequest = Static<typeof UpdateCustomerRequestSchema>;
