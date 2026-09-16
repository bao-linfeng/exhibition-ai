import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  GetQuotaResponseSchema,
  ListModelConfigsResponseSchema,
  TopupQuotaRequestSchema,
  TopupQuotaResponseSchema,
  UpdateModelConfigRequestSchema,
  UpdateModelConfigResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';
import type {
  TopupQuotaRequest,
  UpdateModelConfigRequest,
} from '@exhibition/contracts';

type ModelConfigRow = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  description: string | null;
  capabilities: unknown;
  costPerImageMinor: number;
  currency: string;
  isActive: boolean;
  maxConcurrent: number;
  createdAt: Date;
  updatedAt: Date;
};

function toModelConfigDto(config: ModelConfigRow) {
  return {
    id: config.id,
    providerId: config.providerId,
    modelId: config.modelId,
    displayName: config.displayName,
    description: config.description ?? undefined,
    capabilities: (config.capabilities as string[]) ?? [],
    costPerImageMinor: config.costPerImageMinor,
    currency: config.currency,
    isActive: config.isActive,
    maxConcurrent: config.maxConcurrent,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function settingsRoutes(app: FastifyInstance) {
  async function currentUser(sessionId: string | undefined) {
    return sessionId
      ? app.services!.authService.validateSession(sessionId)
      : null;
  }

  app.get(
    '/api/v1/settings/model-configs',
    {
      schema: {
        operationId: 'listAdminModelConfigs',
        tags: ['settings'],
        response: { 200: ListModelConfigsResponseSchema },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (user.role !== 'admin') throw app.httpErrors.forbidden();

      const configs =
        await app.services!.settingsService.listModelConfigs(false);
      return { data: configs.map(toModelConfigDto) };
    },
  );

  // PATCH /api/v1/settings/model-configs/:id — admin only
  app.patch(
    '/api/v1/settings/model-configs/:id',
    {
      schema: {
        operationId: 'updateModelConfig',
        tags: ['settings'],
        summary: '（管理员）更新模型配置',
        params: Type.Object({ id: UuidSchema }),
        body: UpdateModelConfigRequestSchema,
        response: { 200: UpdateModelConfigResponseSchema },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (user.role !== 'admin') throw app.httpErrors.forbidden();

      const { id } = request.params as { id: string };
      const body = request.body as UpdateModelConfigRequest;
      const updated = await app.services!.settingsService.updateModelConfig(
        id,
        body,
      );
      if (!updated) throw app.httpErrors.notFound('Model config not found');

      await app.services!.auditService.log({
        eventType: 'settings.model_config.update',
        actorId: user.id,
        actorEmail: user.email,
        resourceType: 'model_config',
        resourceId: id,
        metadata: body,
      });

      return { data: toModelConfigDto(updated) };
    },
  );

  // GET /api/v1/settings/quota — admin 看系统账户，其他人看自己
  app.get(
    '/api/v1/settings/quota',
    {
      schema: {
        operationId: 'getQuota',
        tags: ['settings'],
        summary: '查询额度账户',
        response: { 200: GetQuotaResponseSchema },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const quota =
        user.role === 'admin'
          ? await app.services!.quotaService.getSystemQuota()
          : await app.services!.quotaService.getUserQuota(user.id);
      return { data: quota };
    },
  );

  // POST /api/v1/settings/quota/topup — admin only
  app.post(
    '/api/v1/settings/quota/topup',
    {
      schema: {
        operationId: 'topupQuota',
        tags: ['settings'],
        summary: '（管理员）充值额度',
        body: TopupQuotaRequestSchema,
        response: { 200: TopupQuotaResponseSchema },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (user.role !== 'admin') throw app.httpErrors.forbidden();

      const body = request.body as TopupQuotaRequest;
      const result = await app.services!.quotaService.topup({
        ownerType: body.ownerType,
        ownerId: body.ownerId,
        amountMinor: body.amountMinor,
        currency: body.currency,
        reason: body.reason,
        actorId: user.id,
        actorEmail: user.email,
      });
      return { data: result };
    },
  );
}
