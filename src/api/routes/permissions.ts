/**
 * VeilChain Permission Routes
 *
 * Handles ledger permission management.
 */

import type { FastifyInstance } from 'fastify';
import type { PermissionService } from '../../services/permission.js';
import type { LedgerRole } from '../../types.js';
import { getAuthContext } from '../middleware/jwt.js';

/**
 * Request body types
 */
interface GrantPermissionBody {
  userId: string;
  role: LedgerRole;
  expiresInDays?: number;
}

/**
 * Register permission routes
 */
export async function registerPermissionRoutes(
  fastify: FastifyInstance,
  permissionService: PermissionService
): Promise<void> {
  /**
   * GET /v1/ledgers/:id/permissions - List ledger permissions
   */
  fastify.get<{ Params: { id: string } }>(
    '/v1/ledgers/:id/permissions',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const ledgerId = request.params.id;

      // Check if user has admin access
      const canAdmin = await permissionService.canAdmin(auth.userId, ledgerId);
      if (!canAdmin) {
        return reply.code(403).send({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Admin access required to view permissions',
          },
        });
      }

      const users = await permissionService.listLedgerUsers(ledgerId);

      return reply.code(200).send({
        permissions: users.map(user => ({
          userId: user.userId,
          email: user.userEmail,
          name: user.userName,
          role: user.role,
          grantedAt: user.grantedAt.toISOString(),
          grantedBy: user.grantedBy,
          expiresAt: user.expiresAt?.toISOString(),
        })),
      });
    }
  );

  /**
   * POST /v1/ledgers/:id/permissions - Grant permission
   */
  fastify.post<{ Params: { id: string }; Body: GrantPermissionBody }>(
    '/v1/ledgers/:id/permissions',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'role'],
          properties: {
            userId: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'write', 'read'] },
            expiresInDays: { type: 'number', minimum: 1 },
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

      const ledgerId = request.params.id;

      // Check if user has admin access
      const canAdmin = await permissionService.canAdmin(auth.userId, ledgerId);
      if (!canAdmin) {
        return reply.code(403).send({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Admin access required to grant permissions',
          },
        });
      }

      // Cannot grant owner role
      if (request.body.role === 'owner') {
        return reply.code(400).send({
          error: {
            code: 'INVALID_ROLE',
            message: 'Owner role cannot be granted',
          },
        });
      }

      let expiresAt: Date | undefined;
      if (request.body.expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + request.body.expiresInDays);
      }

      const permission = await permissionService.grantAccess(
        ledgerId,
        request.body.userId,
        request.body.role,
        auth.userId,
        expiresAt
      );

      return reply.code(201).send({
        permission: {
          id: permission.id,
          ledgerId: permission.ledgerId,
          userId: permission.userId,
          role: permission.role,
          grantedAt: permission.grantedAt.toISOString(),
          grantedBy: permission.grantedBy,
          expiresAt: permission.expiresAt?.toISOString(),
        },
      });
    }
  );

  /**
   * DELETE /v1/ledgers/:id/permissions/:userId - Revoke permission
   */
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/v1/ledgers/:id/permissions/:userId',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const ledgerId = request.params.id;
      const targetUserId = request.params.userId;

      // Check if user has admin access
      const canAdmin = await permissionService.canAdmin(auth.userId, ledgerId);
      if (!canAdmin) {
        return reply.code(403).send({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Admin access required to revoke permissions',
          },
        });
      }

      // Cannot revoke owner permission
      const isOwner = await permissionService.isOwner(targetUserId, ledgerId);
      if (isOwner) {
        return reply.code(400).send({
          error: {
            code: 'CANNOT_REVOKE_OWNER',
            message: 'Cannot revoke owner permission',
          },
        });
      }

      const revoked = await permissionService.revokeAccess(
        ledgerId,
        targetUserId,
        auth.userId
      );

      if (!revoked) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Permission not found' },
        });
      }

      return reply.code(200).send({
        message: 'Permission revoked successfully',
      });
    }
  );
}
