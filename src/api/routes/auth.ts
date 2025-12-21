/**
 * VeilChain Authentication Routes
 *
 * Handles user registration, login, logout, token refresh, password reset,
 * email verification, and OAuth flows.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthService, AuthError } from '../../services/auth.js';
import type { UserService } from '../../services/user.js';
import { getAuthContext } from '../middleware/jwt.js';

/**
 * Request body types
 */
interface RegisterBody {
  email: string;
  password: string;
  name?: string;
}

interface LoginBody {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface RefreshBody {
  refreshToken: string;
}

interface ForgotPasswordBody {
  email: string;
}

interface ResetPasswordBody {
  token: string;
  password: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

interface OAuthCallbackQuery {
  code: string;
  state: string;
}

/**
 * Register authentication routes
 */
export async function registerAuthRoutes(
  fastify: FastifyInstance,
  authService: AuthService,
  userService: UserService
): Promise<void> {
  /**
   * POST /v1/auth/register - Register new user
   */
  fastify.post<{ Body: RegisterBody }>(
    '/v1/auth/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', maxLength: 255 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await authService.register({
          email: request.body.email,
          password: request.body.password,
          name: request.body.name,
        });

        return reply.code(201).send(result);
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );

  /**
   * POST /v1/auth/login - Login with email/password
   */
  fastify.post<{ Body: LoginBody }>(
    '/v1/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
            rememberMe: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await authService.login({
          email: request.body.email,
          password: request.body.password,
          rememberMe: request.body.rememberMe,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });

        return reply.code(200).send({
          token: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
          user: result.user,
        });
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );

  /**
   * POST /v1/auth/logout - Logout (revoke refresh token)
   */
  fastify.post<{ Body: RefreshBody }>(
    '/v1/auth/logout',
    async (request, reply) => {
      const auth = getAuthContext(request);

      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      if (request.body?.refreshToken) {
        await authService.logout(
          request.body.refreshToken,
          auth.userId,
          request.ip,
          request.headers['user-agent']
        );
      }

      return reply.code(200).send({ message: 'Logged out successfully' });
    }
  );

  /**
   * POST /v1/auth/refresh - Refresh access token
   */
  fastify.post<{ Body: RefreshBody }>(
    '/v1/auth/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await authService.refreshAccessToken(
          request.body.refreshToken,
          request.ip,
          request.headers['user-agent']
        );

        return reply.code(200).send({
          token: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
          user: result.user,
        });
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );

  /**
   * POST /v1/auth/forgot-password - Request password reset
   */
  fastify.post<{ Body: ForgotPasswordBody }>(
    '/v1/auth/forgot-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    async (request, reply) => {
      // Always return success to prevent email enumeration
      await authService.requestPasswordReset(request.body.email);
      return reply.code(200).send({
        message: 'If an account exists with that email, a reset link has been sent',
      });
    }
  );

  /**
   * POST /v1/auth/reset-password - Reset password with token
   */
  fastify.post<{ Body: ResetPasswordBody }>(
    '/v1/auth/reset-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: { type: 'string' },
            password: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        await authService.resetPassword(
          request.body.token,
          request.body.password
        );

        return reply.code(200).send({
          message: 'Password reset successfully',
        });
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );

  /**
   * GET /v1/auth/verify-email - Verify email with token
   */
  fastify.get<{ Querystring: { token: string } }>(
    '/v1/auth/verify-email',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        await authService.verifyEmail(request.query.token);
        return reply.code(200).send({
          message: 'Email verified successfully',
        });
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );

  /**
   * GET /v1/auth/me - Get current user
   */
  fastify.get(
    '/v1/auth/me',
    async (request, reply) => {
      const auth = getAuthContext(request);

      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const user = await userService.getById(auth.userId);
      if (!user) {
        return reply.code(404).send({
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      return reply.code(200).send({
        user: userService.toPublic(user),
      });
    }
  );

  /**
   * POST /v1/auth/change-password - Change password (authenticated)
   */
  fastify.post<{ Body: ChangePasswordBody }>(
    '/v1/auth/change-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (request, reply) => {
      const auth = getAuthContext(request);

      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      try {
        await authService.changePassword(
          auth.userId,
          request.body.currentPassword,
          request.body.newPassword
        );

        return reply.code(200).send({
          message: 'Password changed successfully',
        });
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );

  // ============================================
  // OAuth Routes
  // ============================================

  /**
   * GET /v1/auth/github - Start GitHub OAuth flow
   */
  fastify.get<{ Querystring: { redirect?: string } }>(
    '/v1/auth/github',
    async (request, reply) => {
      try {
        const state = await authService.createOAuthState(request.query.redirect);
        const authUrl = authService.getOAuthAuthorizationUrl('github', state);
        return reply.redirect(authUrl);
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'OAUTH_ERROR', message: 'Failed to start OAuth flow' },
        });
      }
    }
  );

  /**
   * GET /v1/auth/github/callback - GitHub OAuth callback
   */
  fastify.get<{ Querystring: OAuthCallbackQuery }>(
    '/v1/auth/github/callback',
    async (request, reply) => {
      try {
        const result = await authService.handleOAuthCallback({
          provider: 'github',
          code: request.query.code,
          state: request.query.state,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });

        // Redirect to frontend with token
        const redirectUrl = new URL('/dashboard', 'http://localhost:3000');
        redirectUrl.searchParams.set('token', result.accessToken);
        if (result.refreshToken) {
          redirectUrl.searchParams.set('refreshToken', result.refreshToken);
        }

        return reply.redirect(redirectUrl.toString());
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );

  /**
   * GET /v1/auth/google - Start Google OAuth flow
   */
  fastify.get<{ Querystring: { redirect?: string } }>(
    '/v1/auth/google',
    async (request, reply) => {
      try {
        const state = await authService.createOAuthState(request.query.redirect);
        const authUrl = authService.getOAuthAuthorizationUrl('google', state);
        return reply.redirect(authUrl);
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'OAUTH_ERROR', message: 'Failed to start OAuth flow' },
        });
      }
    }
  );

  /**
   * GET /v1/auth/google/callback - Google OAuth callback
   */
  fastify.get<{ Querystring: OAuthCallbackQuery }>(
    '/v1/auth/google/callback',
    async (request, reply) => {
      try {
        const result = await authService.handleOAuthCallback({
          provider: 'google',
          code: request.query.code,
          state: request.query.state,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });

        // Redirect to frontend with token
        const redirectUrl = new URL('/dashboard', 'http://localhost:3000');
        redirectUrl.searchParams.set('token', result.accessToken);
        if (result.refreshToken) {
          redirectUrl.searchParams.set('refreshToken', result.refreshToken);
        }

        return reply.redirect(redirectUrl.toString());
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );
}

/**
 * Handle authentication errors
 */
function handleAuthError(error: unknown, reply: FastifyReply) {
  if (error && typeof error === 'object' && 'code' in error) {
    const authError = error as AuthError;
    const statusMap: Record<string, number> = {
      INVALID_CREDENTIALS: 401,
      EMAIL_EXISTS: 409,
      EMAIL_NOT_VERIFIED: 403,
      USER_NOT_FOUND: 404,
      INVALID_TOKEN: 401,
      TOKEN_EXPIRED: 401,
      TOKEN_REVOKED: 401,
      OAUTH_ERROR: 500,
      INVALID_STATE: 400,
    };

    const status = statusMap[authError.code] || 400;
    return reply.code(status).send({
      error: {
        code: authError.code,
        message: authError.message,
      },
    });
  }

  // Generic error
  const message = error instanceof Error ? error.message : 'An error occurred';
  return reply.code(400).send({
    error: {
      code: 'BAD_REQUEST',
      message,
    },
  });
}
