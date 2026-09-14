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

export async function conversationRoutes(app: FastifyInstance) {
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
    async () => {
      throw app.httpErrors.notImplemented('Get conversation not implemented');
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
    async () => {
      throw app.httpErrors.notImplemented('List messages not implemented');
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
    async () => {
      throw app.httpErrors.notImplemented('Send message not implemented');
    },
  );
}
