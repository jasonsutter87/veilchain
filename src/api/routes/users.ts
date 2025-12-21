/**
 * VeilChain User Routes
 *
 * Handles user profile, stats, and activity.
 */

import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { UserService } from '../../services/user.js';
import type { AuditService } from '../../services/audit.js';
import type { PermissionService } from '../../services/permission.js';
import { getAuthContext } from '../middleware/jwt.js';

/**
 * Request body types
 */
interface UpdateProfileBody {
  name?: string;
  avatarUrl?: string;
}

/**
 * Register user routes
 */
export async function registerUserRoutes(
  fastify: FastifyInstance,
  userService: UserService,
  auditService: AuditService,
  permissionService: PermissionService,
  pool: Pool
): Promise<void> {
  /**
   * GET /v1/users/me - Get current user profile
   */
  fastify.get(
    '/v1/users/me',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
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
   * PATCH /v1/users/me - Update current user profile
   */
  fastify.patch<{ Body: UpdateProfileBody }>(
    '/v1/users/me',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', maxLength: 255 },
            avatarUrl: { type: 'string', format: 'uri' },
          },
        },
      },
    },
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const user = await userService.update(auth.userId, {
        name: request.body.name,
        avatarUrl: request.body.avatarUrl,
      });

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
   * DELETE /v1/users/me - Delete current user account
   */
  fastify.delete(
    '/v1/users/me',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const deleted = await userService.delete(auth.userId);
      if (!deleted) {
        return reply.code(404).send({
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      return reply.code(200).send({
        message: 'Account deleted successfully',
      });
    }
  );

  /**
   * GET /v1/stats - Get user dashboard stats
   */
  fastify.get(
    '/v1/stats',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      // Get ledger count
      const ledgerResult = await pool.query(
        `SELECT COUNT(*) as count FROM ledgers WHERE owner_id = $1`,
        [auth.userId]
      );
      const ledgerCount = parseInt(ledgerResult.rows[0].count, 10);

      // Get total entries across user's ledgers
      const entryResult = await pool.query(
        `SELECT COALESCE(SUM(l.entry_count), 0) as count
         FROM ledgers l
         WHERE l.owner_id = $1`,
        [auth.userId]
      );
      const entryCount = parseInt(entryResult.rows[0].count, 10);

      // Get API key count
      const apiKeyResult = await pool.query(
        `SELECT COUNT(*) as count FROM api_keys
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [auth.userId]
      );
      const apiKeyCount = parseInt(apiKeyResult.rows[0].count, 10);

      // Get ledgers shared with user
      const sharedResult = await pool.query(
        `SELECT COUNT(*) as count FROM ledger_permissions
         WHERE user_id = $1 AND role != 'owner'`,
        [auth.userId]
      );
      const sharedLedgerCount = parseInt(sharedResult.rows[0].count, 10);

      return reply.code(200).send({
        stats: {
          ledgers: ledgerCount,
          entries: entryCount,
          apiKeys: apiKeyCount,
          sharedLedgers: sharedLedgerCount,
        },
      });
    }
  );

  /**
   * GET /v1/activity - Get user activity feed
   */
  fastify.get<{ Querystring: { limit?: number; offset?: number } }>(
    '/v1/activity',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'number', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;

      const { logs, total } = await auditService.getUserActivity(auth.userId, {
        limit,
        offset,
      });

      return reply.code(200).send({
        activity: logs.map(log => ({
          id: log.id,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          details: log.details,
          createdAt: log.createdAt.toISOString(),
        })),
        total,
        limit,
        offset,
      });
    }
  );

  /**
   * GET /v1/ledgers/shared - Get ledgers shared with user
   */
  fastify.get(
    '/v1/ledgers/shared',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const ledgers = await permissionService.listUserLedgers(auth.userId);

      // Filter out owned ledgers
      const sharedLedgers = ledgers.filter(l => l.role !== 'owner');

      return reply.code(200).send({
        ledgers: sharedLedgers.map(ledger => ({
          id: ledger.ledgerId,
          name: ledger.ledgerName,
          role: ledger.role,
          grantedAt: ledger.grantedAt.toISOString(),
          expiresAt: ledger.expiresAt?.toISOString(),
        })),
      });
    }
  );
}
