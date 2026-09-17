import type { FastifyInstance } from 'fastify';
import {
  ListCasesQuerySchema,
  ListCasesResponseSchema,
} from '@exhibition/contracts';
import type { ListCasesQuery } from '@exhibition/contracts';

export async function caseRoutes(app: FastifyInstance) {
  async function currentUser(sessionId: string | undefined) {
    return sessionId
      ? app.services!.authService.validateSession(sessionId)
      : null;
  }

  app.get(
    '/api/v1/cases',
    {
      schema: {
        operationId: 'listCases',
        description:
          'List historical cases (archived projects) with tag and favorite filters.',
        tags: ['cases'],
        querystring: ListCasesQuerySchema,
        response: { 200: ListCasesResponseSchema },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const query = request.query as ListCasesQuery;
      return app.services!.casesService.listCases(query, user);
    },
  );
}
