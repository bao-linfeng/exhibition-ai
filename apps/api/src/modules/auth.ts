import type { FastifyInstance } from 'fastify';
import type {
  ForgotPasswordRequest,
  LoginRequest,
  ChangePasswordRequest,
  RegisterRequest,
  SendCodeRequest,
} from '@exhibition/contracts';
import {
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  MeResponseSchema,
  CsrfResponseSchema,
  ChangePasswordRequestSchema,
  RegisterRequestSchema,
  SendCodeRequestSchema,
} from '@exhibition/contracts';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/v1/auth/login
  app.post<{ Body: LoginRequest }>(
    '/api/v1/auth/login',
    {
      schema: {
        operationId: 'login',
        description: 'Login with email and password.',
        tags: ['auth'],
        body: LoginRequestSchema,
        response: {
          200: LoginResponseSchema,
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!app.services)
        throw app.httpErrors.internalServerError('Services not initialized');
      const { authService } = app.services;
      const { email, password } = request.body;

      const result = await authService.login(email, password);

      if (!result) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
      }

      // 设置 httpOnly cookie
      reply.setCookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 天（秒）
        path: '/',
      });

      return { data: result.user };
    },
  );

  // GET /api/v1/auth/me
  app.get(
    '/api/v1/auth/me',
    {
      schema: {
        operationId: 'getMe',
        description: 'Get current user summary.',
        tags: ['auth'],
        response: {
          200: MeResponseSchema,
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const sessionId = request.cookies.sessionId;

      if (!sessionId) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Not authenticated',
        });
      }

      const user = await app.services!.authService.validateSession(sessionId);

      if (!user) {
        reply.clearCookie('sessionId', { path: '/' });
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Session expired',
        });
      }

      return { data: user };
    },
  );

  // GET /api/v1/auth/csrf
  app.get(
    '/api/v1/auth/csrf',
    {
      schema: {
        operationId: 'getCsrf',
        description: 'Get CSRF token.',
        tags: ['auth'],
        response: {
          200: CsrfResponseSchema,
        },
      },
    },
    async () => {
      // 简化实现：返回一个固定 token
      // 生产环境应该使用 @fastify/csrf-protection
      return {
        data: {
          token: 'csrf-token-placeholder',
        },
      };
    },
  );

  // POST /api/v1/auth/logout
  app.post(
    '/api/v1/auth/logout',
    {
      schema: {
        operationId: 'logout',
        description: 'Logout current session.',
        tags: ['auth'],
        response: {
          204: { type: 'null', description: 'No content' },
        },
      },
    },
    async (request, reply) => {
      const sessionId = request.cookies.sessionId;

      if (sessionId) {
        await app.services!.authService.logout(sessionId);
        reply.clearCookie('sessionId', { path: '/' });
      }

      return reply.code(204).send();
    },
  );

  // PUT /api/v1/auth/password
  app.put<{ Body: ChangePasswordRequest }>(
    '/api/v1/auth/password',
    {
      schema: {
        operationId: 'changePassword',
        description: 'Change current user password.',
        tags: ['auth'],
        body: ChangePasswordRequestSchema,
        response: {
          204: { type: 'null', description: 'No content' },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const sessionId = request.cookies.sessionId;

      if (!sessionId) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Not authenticated',
        });
      }

      const user = await app.services!.authService.validateSession(sessionId);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Session expired',
        });
      }

      const { currentPassword, newPassword } = request.body;

      const success = await app.services!.authService.changePassword(
        user.id,
        currentPassword,
        newPassword,
      );

      if (!success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Current password is incorrect',
        });
      }

      return reply.code(204).send();
    },
  );

  app.post<{ Body: SendCodeRequest }>(
    '/api/v1/auth/send-code',
    {
      schema: {
        operationId: 'sendVerificationCode',
        description: 'Send an email verification code.',
        tags: ['auth'],
        body: SendCodeRequestSchema,
      },
    },
    async (_request, reply) => {
      return reply.code(410).send({
        error: 'Gone',
        message:
          'Public registration is not available. Contact your administrator.',
      });
    },
  );

  app.post<{ Body: RegisterRequest }>(
    '/api/v1/auth/register',
    {
      schema: {
        operationId: 'register',
        description: 'Register a user account.',
        tags: ['auth'],
        body: RegisterRequestSchema,
        response: {
          200: LoginResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      return reply.code(410).send({
        error: 'Gone',
        message:
          'Public registration is not available. Contact your administrator.',
      });
    },
  );

  app.post<{ Body: ForgotPasswordRequest }>(
    '/api/v1/auth/forgot-password',
    {
      schema: {
        operationId: 'forgotPassword',
        description: 'Reset a password with an email verification code.',
        tags: ['auth'],
        body: ForgotPasswordRequestSchema,
        response: {
          204: { type: 'null', description: 'No content' },
        },
      },
    },
    async (request, reply) => {
      const { email, code, newPassword } = request.body;
      const result = await app.services!.authService.forgotPassword(
        email,
        code,
        newPassword,
      );

      if (result === 'invalid_code') {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid verification code',
        });
      }
      if (result === 'not_found') {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      return reply.code(204).send();
    },
  );
}
