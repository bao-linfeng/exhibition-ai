import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  PaginationQuerySchema,
} from '../common/base.js';

// 资产类型
export const AssetKindSchema = Type.Union([
  Type.Literal('logo'),
  Type.Literal('product'),
  Type.Literal('reference'),
  Type.Literal('brand_material'),
  Type.Literal('generated_image'),
  Type.Literal('thumbnail'),
  Type.Literal('export_zip'),
  Type.Literal('export_pdf'),
]);

// 资产状态
export const AssetStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('validating'),
  Type.Literal('ready'),
  Type.Literal('rejected'),
]);

// 上传会话状态
export const UploadSessionStatusSchema = Type.Union([
  Type.Literal('initiated'),
  Type.Literal('validating'),
  Type.Literal('completed'),
  Type.Literal('failed'),
  Type.Literal('expired'),
]);

// 资产详情
export const AssetSchema = Type.Object(
  {
    id: UuidSchema,
    projectId: UuidSchema,
    kind: AssetKindSchema,
    status: AssetStatusSchema,
    bucket: Type.String(),
    objectKey: Type.String(),
    originalFilename: Type.String({ maxLength: 255 }),
    mimeType: Type.String({ maxLength: 127 }),
    sizeBytes: Type.Integer({ minimum: 0 }),
    width: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    height: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    sha256: Type.Union([
      Type.String({ minLength: 64, maxLength: 64 }),
      Type.Null(),
    ]),
    sourceAssetId: Type.Union([UuidSchema, Type.Null()]),
    hiddenAt: Type.Union([DateTimeSchema, Type.Null()]),
    createdBy: UuidSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

// POST /projects/:id/uploads
export const CreateUploadSessionRequestSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal('logo'),
      Type.Literal('product'),
      Type.Literal('reference'),
      Type.Literal('brand_material'),
    ]),
    originalFilename: Type.String({ minLength: 1, maxLength: 255 }),
    sizeBytes: Type.Integer({ minimum: 1, maximum: 26214400 }), // 25 MiB
    mimeType: Type.Union([
      Type.Literal('image/png'),
      Type.Literal('image/jpeg'),
      Type.Literal('image/webp'),
    ]),
  },
  { additionalProperties: false },
);

export const CreateUploadSessionResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        uploadId: UuidSchema,
        url: Type.String({ format: 'uri' }),
        requiredHeaders: Type.Record(Type.String(), Type.String()),
        expiresAt: DateTimeSchema,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// POST /projects/:id/uploads/:uploadId/complete
export const CompleteUploadRequestSchema = Type.Object(
  {},
  { additionalProperties: false },
);

export const CompleteUploadResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        assetId: UuidSchema,
        validationTaskId: UuidSchema,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// GET /projects/:id/assets
export const ListAssetsQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object(
    {
      kind: Type.Optional(AssetKindSchema),
      status: Type.Optional(AssetStatusSchema),
      includeHidden: Type.Optional(Type.Boolean()),
    },
    { additionalProperties: false },
  ),
]);

export const ListAssetsResponseSchema = Type.Object(
  {
    data: Type.Array(AssetSchema),
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

// GET /assets/:id
export const GetAssetResponseSchema = Type.Object(
  {
    data: AssetSchema,
  },
  { additionalProperties: false },
);

// DELETE /projects/:id/assets/:id - 隐藏资产（204 No Content）
export const HideAssetResponseSchema = Type.Null();

// POST /assets/:id/download-url
export const CreateDownloadUrlRequestSchema = Type.Object(
  {
    variant: Type.Optional(
      Type.Union([Type.Literal('original'), Type.Literal('thumbnail')]),
    ),
  },
  { additionalProperties: false },
);

export const CreateDownloadUrlResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        url: Type.String({ format: 'uri' }),
        expiresAt: DateTimeSchema,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// 类型导出
export type AssetKind = Static<typeof AssetKindSchema>;
export type AssetStatus = Static<typeof AssetStatusSchema>;
export type Asset = Static<typeof AssetSchema>;
export type CreateUploadSessionRequest = Static<
  typeof CreateUploadSessionRequestSchema
>;
export type CompleteUploadRequest = Static<typeof CompleteUploadRequestSchema>;
export type CreateDownloadUrlRequest = Static<
  typeof CreateDownloadUrlRequestSchema
>;
