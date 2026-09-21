import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  GetConversationResponseSchema,
  ListMessagesQuerySchema,
  ListMessagesResponseSchema,
  SendMessageRequestSchema,
  SendMessageResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';
import type { SendMessageRequest } from '@exhibition/contracts';

function toConversationDto(row: {
  id: string;
  projectId: string;
  title: string;
  activeRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    activeRunId: row.activeRunId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMessageDto(row: {
  id: string;
  conversationId: string;
  role: string;
  parts: unknown;
  status: string;
  clientMessageId: string | null;
  createdBy: string | null;
  createdAt: Date;
  streamOffset: number;
  runId: string | null;
}) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    parts: row.parts as unknown[],
    status: row.status,
    clientMessageId: row.clientMessageId,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function conversationRoutes(app: FastifyInstance) {
  async function currentUser(sessionId: string | undefined) {
    return sessionId
      ? app.services!.authService.validateSession(sessionId)
      : null;
  }

  // GET /api/v1/projects/:projectId/conversation
  app.get(
    '/api/v1/projects/:projectId/conversation',
    {
      schema: {
        operationId: 'getConversation',
        description: 'Get conversation for project.',
        tags: ['conversations'],
        params: Type.Object({ projectId: UuidSchema }),
        response: {
          200: GetConversationResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const actorContext = { userId: user.id, role: user.role };

      const { projectId } = request.params as { projectId: string };
      if (!app.projectPolicy) {
        throw app.httpErrors.internalServerError(
          'Project policy not initialized',
        );
      }
      if (!(await app.projectPolicy.canViewProject(actorContext, projectId))) {
        throw app.httpErrors.notFound('Project not found');
      }

      const conversation =
        await app.services!.conversationService.getOrCreateConversation(
          projectId,
          user.id,
        );
      if (conversation === 'forbidden') throw app.httpErrors.forbidden();

      return { data: toConversationDto(conversation) };
    },
  );

  // GET /api/v1/projects/:projectId/conversation/messages
  app.get(
    '/api/v1/projects/:projectId/conversation/messages',
    {
      schema: {
        operationId: 'listMessages',
        description: 'List messages in conversation.',
        tags: ['conversations'],
        params: Type.Object({ projectId: UuidSchema }),
        querystring: ListMessagesQuerySchema,
        response: {
          200: ListMessagesResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const actorContext = { userId: user.id, role: user.role };

      const { projectId } = request.params as { projectId: string };
      const query = request.query as { before?: string; limit?: number };
      if (!app.projectPolicy) {
        throw app.httpErrors.internalServerError(
          'Project policy not initialized',
        );
      }
      if (!(await app.projectPolicy.canViewProject(actorContext, projectId))) {
        throw app.httpErrors.notFound('Project not found');
      }

      const conversation =
        await app.services!.conversationService.getOrCreateConversation(
          projectId,
          user.id,
        );
      if (conversation === 'forbidden') throw app.httpErrors.forbidden();

      const result = await app.services!.conversationService.listMessages(
        conversation.id,
        user.id,
        query,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();

      return {
        data: result.data.map(toMessageDto),
        page: result.page,
      };
    },
  );

  // POST /api/v1/projects/:projectId/conversation/messages
  app.post(
    '/api/v1/projects/:projectId/conversation/messages',
    {
      schema: {
        operationId: 'sendMessage',
        description: 'Send message to agent.',
        tags: ['conversations'],
        params: Type.Object({ projectId: UuidSchema }),
        body: SendMessageRequestSchema,
        response: {
          202: SendMessageResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const actorContext = { userId: user.id, role: user.role };

      const { projectId } = request.params as { projectId: string };
      const body = request.body as SendMessageRequest;
      if (!app.projectPolicy) {
        throw app.httpErrors.internalServerError(
          'Project policy not initialized',
        );
      }
      if (!(await app.projectPolicy.canViewProject(actorContext, projectId))) {
        throw app.httpErrors.notFound('Project not found');
      }

      const conversation =
        await app.services!.conversationService.getOrCreateConversation(
          projectId,
          user.id,
        );
      if (conversation === 'forbidden') throw app.httpErrors.forbidden();

      const result = await app.services!.conversationService.sendMessage({
        projectId,
        conversationId: conversation.id,
        text: body.text,
        clientMessageId: body.clientMessageId,
        assetIds: body.assetIds,
        actorId: user.id,
      });
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'active_run_exists') {
        const error = app.httpErrors.conflict(
          'An active agent run already exists',
        ) as Error & { code?: string };
        error.code = 'ACTIVE_RUN_EXISTS';
        throw error;
      }
      if (result === 'duplicate') {
        return reply.status(202).send({ data: result });
      }

      return reply.status(202).send({ data: result });
    },
  );
}
