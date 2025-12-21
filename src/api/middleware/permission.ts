/**
 * VeilChain Permission Middleware
 *
 * Route-level permission checking for ledger access.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { PermissionService } from '../../services/permission.js';
import type { ApiKeyService } from '../../services/apiKey.js';
import type { LedgerRole } from '../../types.js';
import { getAuthContext, type AuthenticatedRequest } from './jwt.js';

/**
 * Permission middleware configuration
 */
export interface PermissionMiddlewareConfig {
  permissionService: PermissionService;
  apiKeyService?: ApiKeyService;
}

/**
 * Create permission checking middleware
 *
 * @param action - The action to check ('read', 'write', 'admin')
 * @param config - Permission service configuration
 * @param ledgerIdParam - The request parameter containing the ledger ID (default: 'id')
 */
export function requirePermission(
  action: 'read' | 'write' | 'admin',
  config: PermissionMiddlewareConfig,
  ledgerIdParam: string = 'id'
) {
  const { permissionService, apiKeyService } = config;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const auth = getAuthContext(request);

    if (!auth) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Get ledger ID from params
    const ledgerId = (request.params as Record<string, string>)[ledgerIdParam];
    if (!ledgerId) {
      return reply.code(400).send({
        error: {
          code: 'BAD_REQUEST',
          message: 'Ledger ID is required',
        },
      });
    }

    // Check API key scope if using API key auth
    if (auth.authMethod === 'api_key' && auth.apiKeyId && apiKeyService) {
      const canAccess = await apiKeyService.canAccessLedger(
        auth.apiKeyId,
        ledgerId,
        action
      );

      if (!canAccess) {
        return reply.code(403).send({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `API key does not have ${action} access to this ledger`,
          },
        });
      }
    }

    // Check user permission
    let hasPermission = false;

    switch (action) {
      case 'read':
        hasPermission = await permissionService.canRead(auth.userId, ledgerId);
        break;
      case 'write':
        hasPermission = await permissionService.canWrite(auth.userId, ledgerId);
        break;
      case 'admin':
        hasPermission = await permissionService.canAdmin(auth.userId, ledgerId);
        break;
    }

    if (!hasPermission) {
      return reply.code(403).send({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `You do not have ${action} access to this ledger`,
        },
      });
    }
  };
}

/**
 * Require user to be the owner of a ledger
 */
export function requireOwner(
  config: PermissionMiddlewareConfig,
  ledgerIdParam: string = 'id'
) {
  const { permissionService } = config;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const auth = getAuthContext(request);

    if (!auth) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const ledgerId = (request.params as Record<string, string>)[ledgerIdParam];
    if (!ledgerId) {
      return reply.code(400).send({
        error: {
          code: 'BAD_REQUEST',
          message: 'Ledger ID is required',
        },
      });
    }

    const isOwner = await permissionService.isOwner(auth.userId, ledgerId);

    if (!isOwner) {
      return reply.code(403).send({
        error: {
          code: 'OWNER_REQUIRED',
          message: 'Only the ledger owner can perform this action',
        },
      });
    }
  };
}

/**
 * Check and attach permission info to request
 * Does not block - just attaches permission data for routes to use
 */
export function attachPermission(
  config: PermissionMiddlewareConfig,
  ledgerIdParam: string = 'id'
) {
  const { permissionService } = config;

  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const auth = getAuthContext(request);
    if (!auth) return;

    const ledgerId = (request.params as Record<string, string>)[ledgerIdParam];
    if (!ledgerId) return;

    const permission = await permissionService.getAccess(ledgerId, auth.userId);
    const isOwner = await permissionService.isOwner(auth.userId, ledgerId);

    // Attach to request for route handlers to use
    (request as AuthenticatedRequest & { permission?: { role: LedgerRole; isOwner: boolean } }).permission = {
      role: isOwner ? 'owner' : (permission?.role || 'read'),
      isOwner,
    };
  };
}
