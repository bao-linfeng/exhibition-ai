import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  CreatePromptTemplateRequestSchema,
  CreatePromptVersionRequestSchema,
  GetPromptTemplateResponseSchema,
  GetQuotaResponseSchema,
  ListPromptTemplatesResponseSchema,
  ListModelConfigsResponseSchema,
  PromptTemplateWithVersionSchema,
  PromptVersionSchema,
  PublishPromptVersionRequestSchema,
  TopupQuotaRequestSchema,
  TopupQuotaResponseSchema,
  UpdateModelConfigRequestSchema,
  UpdateModelConfigResponseSchema,
  UpdatePromptVersionRequestSchema,
  UuidSchema,
} from '@exhibition/contracts';
import type {
  CreatePromptTemplateRequest,
  CreatePromptVersionRequest,
  PublishPromptVersionRequest,
  TopupQuotaRequest,
  UpdateModelConfigRequest,
  UpdatePromptVersionRequest,
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

  type PromptVersionRow = {
    id: string;
    templateId: string;
    version: number;
    status: 'draft' | 'published' | 'archived';
    content: string;
    variables: unknown;
    changeNote: string | null;
    publishedAt: Date | null;
    publishedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  };

  function toPromptVersionDto(v: PromptVersionRow) {
    return {
      id: v.id,
      templateId: v.templateId,
      version: v.version,
      status: v.status,
      content: v.content,
      variables: (v.variables as string[]) ?? [],
      changeNote: v.changeNote ?? null,
      publishedAt: v.publishedAt?.toISOString() ?? null,
      publishedBy: v.publishedBy ?? null,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    };
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

  // ── Prompt Template 路由（管理员专用）────────────────────────────────

  // GET /api/v1/settings/prompt-templates — 列出全部模板（含当前发布版本）
  app.get(
    '/api/v1/settings/prompt-templates',
    {
      schema: {
        operationId: 'listPromptTemplates',
        tags: ['settings'],
        summary: '（管理员）列出 Prompt 模板',
        response: { 200: ListPromptTemplatesResponseSchema },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (user.role !== 'admin') throw app.httpErrors.forbidden();

      const templates =
        await app.services!.promptTemplateService.listTemplates();
      return {
        templates: templates.map((t) => ({
          ...t,
          description: t.description ?? null,
          currentVersion: t.currentVersion
            ? toPromptVersionDto(t.currentVersion)
            : null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
      };
    },
  );

  // POST /api/v1/settings/prompt-templates — 创建模板（含初始草稿版本）
  app.post(
    '/api/v1/settings/prompt-templates',
    {
      schema: {
        operationId: 'createPromptTemplate',
        tags: ['settings'],
        summary: '（管理员）创建 Prompt 模板',
        body: CreatePromptTemplateRequestSchema,
        response: {
          201: Type.Object({
            template: PromptTemplateWithVersionSchema,
            version: PromptVersionSchema,
          }),
        },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (user.role !== 'admin') throw app.httpErrors.forbidden();

      const body = request.body as CreatePromptTemplateRequest;
      try {
        const result = await app.services!.promptTemplateService.createTemplate(
          body,
          { id: user.id, email: user.email },
        );

        reply.code(201);
        return {
          template: {
            ...result.template,
            description: result.template.description ?? null,
            currentVersion: null,
            createdAt: result.template.createdAt.toISOString(),
            updatedAt: result.template.updatedAt.toISOString(),
          },
          version: toPromptVersionDto(result.version),
        };
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'NOT_FOUND') throw app.httpErrors.notFound(e.message);
        if (e.code === 'CONFLICT') throw app.httpErrors.conflict(e.message);
        if (e.code === 'UNPROCESSABLE') {
          throw app.httpErrors.unprocessableEntity(e.message);
        }
        throw err;
      }
    },
  );

  // GET /api/v1/settings/prompt-templates/:id — 获取模板及全部版本历史
  app.get(
    '/api/v1/settings/prompt-templates/:id',
    {
      schema: {
        operationId: 'getPromptTemplate',
        tags: ['settings'],
        summary: '（管理员）获取 Prompt 模板详情与版本历史',
        params: Type.Object({ id: Type.String() }),
        response: { 200: GetPromptTemplateResponseSchema },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (user.role !== 'admin') throw app.httpErrors.forbidden();

      const { id } = request.params as { id: string };
      const result = await app.services!.promptTemplateService.getTemplate(id);
      if (!result) throw app.httpErrors.notFound('Prompt template not found');

      const currentVersion =
        result.versions.find(
          (v) => v.id === result.template.currentVersionId,
        ) ?? null;

      return {
        template: {
          ...result.template,
          description: result.template.description ?? null,
          currentVersion: currentVersion
            ? toPromptVersionDto(currentVersion)
            : null,
          createdAt: result.template.createdAt.toISOString(),
          updatedAt: result.template.updatedAt.toISOString(),
        },
        versions: result.versions.map(toPromptVersionDto),
      };
    },
  );

  // POST /api/v1/settings/prompt-templates/:id/versions — 创建草稿版本
  app.post(
    '/api/v1/settings/prompt-templates/:id/versions',
    {
      schema: {
        operationId: 'createPromptVersion',
        tags: ['settings'],
        summary: '（管理员）创建 Prompt 草稿版本',
        params: Type.Object({ id: Type.String() }),
        body: CreatePromptVersionRequestSchema,
        response: { 201: Type.Object({ version: PromptVersionSchema }) },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (user.role !== 'admin') throw app.httpErrors.forbidden();

      const { id } = request.params as { id: string };
      const body = request.body as CreatePromptVersionRequest;
      try {
        const version = await app.services!.promptTemplateService.createVersion(
          id,
          body,
          { id: user.id, email: user.email },
        );

        reply.code(201);
        return { version: toPromptVersionDto(version) };
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'NOT_FOUND') throw app.httpErrors.notFound(e.message);
        if (e.code === 'CONFLICT') throw app.httpErrors.conflict(e.message);
        if (e.code === 'UNPROCESSABLE') {
          throw app.httpErrors.unprocessableEntity(e.message);
        }
        throw err;
      }
    },
  );

  // PATCH /api/v1/settings/prompt-templates/:id/versions/:versionId — 更新草稿
  app.patch(
    '/api/v1/settings/prompt-templates/:id/versions/:versionId',
    {
      schema: {
        operationId: 'updatePromptVersion',
        tags: ['settings'],
        summary: '（管理员）更新 Prompt 草稿版本',
        params: Type.Object({ id: Type.String(), versionId: Type.String() }),
        body: UpdatePromptVersionRequestSchema,
        response: { 200: Type.Object({ version: PromptVersionSchema }) },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (user.role !== 'admin') throw app.httpErrors.forbidden();

      const { id, versionId } = request.params as {
        id: string;
        versionId: string;
      };
      const body = request.body as UpdatePromptVersionRequest;
      try {
        const version = await app.services!.promptTemplateService.updateVersion(
          id,
          versionId,
          body,
          { id: user.id, email: user.email },
        );
        if (!version) throw app.httpErrors.notFound('Prompt version not found');

        return { version: toPromptVersionDto(version) };
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'NOT_FOUND') throw app.httpErrors.notFound(e.message);
        if (e.code === 'CONFLICT') throw app.httpErrors.conflict(e.message);
        if (e.code === 'UNPROCESSABLE') {
          throw app.httpErrors.unprocessableEntity(e.message);
        }
        throw err;
      }
    },
  );

  // POST /api/v1/settings/prompt-templates/:id/versions/:versionId/publish — 发布
  app.post(
    '/api/v1/settings/prompt-templates/:id/versions/:versionId/publish',
    {
      schema: {
        operationId: 'publishPromptVersion',
        tags: ['settings'],
        summary: '（管理员）发布 Prompt 版本',
        params: Type.Object({ id: Type.String(), versionId: Type.String() }),
        body: PublishPromptVersionRequestSchema,
        response: { 200: GetPromptTemplateResponseSchema },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (user.role !== 'admin') throw app.httpErrors.forbidden();

      const { id, versionId } = request.params as {
        id: string;
        versionId: string;
      };
      const body = request.body as PublishPromptVersionRequest;
      try {
        const result = await app.services!.promptTemplateService.publishVersion(
          id,
          versionId,
          { changeNote: body.changeNote },
          { id: user.id, email: user.email },
        );
        if (!result) throw app.httpErrors.notFound('Prompt template not found');

        const currentVersion =
          result.versions.find(
            (v) => v.id === result.template.currentVersionId,
          ) ?? null;

        return {
          template: {
            ...result.template,
            description: result.template.description ?? null,
            currentVersion: currentVersion
              ? toPromptVersionDto(currentVersion)
              : null,
            createdAt: result.template.createdAt.toISOString(),
            updatedAt: result.template.updatedAt.toISOString(),
          },
          versions: result.versions.map(toPromptVersionDto),
        };
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'NOT_FOUND') throw app.httpErrors.notFound(e.message);
        if (e.code === 'CONFLICT') throw app.httpErrors.conflict(e.message);
        if (e.code === 'UNPROCESSABLE') {
          throw app.httpErrors.unprocessableEntity(e.message);
        }
        throw err;
      }
    },
  );

  // POST /api/v1/settings/prompt-templates/:id/versions/:versionId/rollback — 回滚
  app.post(
    '/api/v1/settings/prompt-templates/:id/versions/:versionId/rollback',
    {
      schema: {
        operationId: 'rollbackPromptVersion',
        tags: ['settings'],
        summary: '（管理员）回滚到指定已发布版本',
        params: Type.Object({ id: Type.String(), versionId: Type.String() }),
        response: { 200: GetPromptTemplateResponseSchema },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (user.role !== 'admin') throw app.httpErrors.forbidden();

      const { id, versionId } = request.params as {
        id: string;
        versionId: string;
      };
      try {
        const result =
          await app.services!.promptTemplateService.rollbackToVersion(
            id,
            versionId,
            { id: user.id, email: user.email },
          );
        if (!result) throw app.httpErrors.notFound('Prompt template not found');

        const currentVersion =
          result.versions.find(
            (v) => v.id === result.template.currentVersionId,
          ) ?? null;

        return {
          template: {
            ...result.template,
            description: result.template.description ?? null,
            currentVersion: currentVersion
              ? toPromptVersionDto(currentVersion)
              : null,
            createdAt: result.template.createdAt.toISOString(),
            updatedAt: result.template.updatedAt.toISOString(),
          },
          versions: result.versions.map(toPromptVersionDto),
        };
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'NOT_FOUND') throw app.httpErrors.notFound(e.message);
        if (e.code === 'CONFLICT') throw app.httpErrors.conflict(e.message);
        if (e.code === 'UNPROCESSABLE') {
          throw app.httpErrors.unprocessableEntity(e.message);
        }
        throw err;
      }
    },
  );
}
