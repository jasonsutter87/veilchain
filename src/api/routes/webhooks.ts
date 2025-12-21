/**
 * VeilChain Webhook Routes
 *
 * Manage webhook subscriptions for real-time notifications.
 */

import type { FastifyInstance } from 'fastify';
import type { WebhookService, WebhookEventType } from '../../services/webhook.js';
import { getAuthContext } from '../middleware/jwt.js';

/**
 * Request body types
 */
interface CreateWebhookBody {
  name: string;
  url: string;
  secret?: string;
  events: WebhookEventType[];
  ledgerIds?: string[];
  headers?: Record<string, string>;
}

interface UpdateWebhookBody {
  name?: string;
  url?: string;
  secret?: string;
  events?: WebhookEventType[];
  ledgerIds?: string[];
  headers?: Record<string, string>;
}

/**
 * Register webhook routes
 */
export async function registerWebhookRoutes(
  fastify: FastifyInstance,
  webhookService: WebhookService
): Promise<void> {
  /**
   * GET /v1/webhooks - List user's webhooks
   */
  fastify.get(
    '/v1/webhooks',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const webhooks = await webhookService.list(auth.userId);

      return reply.code(200).send({
        webhooks: webhooks.map(w => ({
          id: w.id,
          name: w.name,
          url: w.url,
          events: w.events,
          ledgerIds: w.ledgerIds,
          isActive: w.isActive,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        })),
      });
    }
  );

  /**
   * POST /v1/webhooks - Create new webhook
   */
  fastify.post<{ Body: CreateWebhookBody }>(
    '/v1/webhooks',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'url', 'events'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            url: { type: 'string', format: 'uri' },
            secret: { type: 'string', maxLength: 128 },
            events: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'string',
                enum: ['root_change', 'entry_append', 'ledger_create', 'ledger_delete'],
              },
            },
            ledgerIds: {
              type: 'array',
              items: { type: 'string' },
            },
            headers: { type: 'object' },
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

      // Validate URL is HTTPS in production
      if (process.env.NODE_ENV === 'production' && !request.body.url.startsWith('https://')) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_URL',
            message: 'Webhook URL must use HTTPS in production',
          },
        });
      }

      const webhook = await webhookService.create({
        userId: auth.userId,
        name: request.body.name,
        url: request.body.url,
        secret: request.body.secret,
        events: request.body.events,
        ledgerIds: request.body.ledgerIds,
        headers: request.body.headers,
      });

      return reply.code(201).send({
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        ledgerIds: webhook.ledgerIds,
        isActive: webhook.isActive,
        createdAt: webhook.createdAt.toISOString(),
        secret: webhook.secret ? '[CONFIGURED]' : undefined,
      });
    }
  );

  /**
   * GET /v1/webhooks/:id - Get webhook details
   */
  fastify.get<{ Params: { id: string } }>(
    '/v1/webhooks/:id',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const webhook = await webhookService.get(auth.userId, request.params.id);
      if (!webhook) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      // Get delivery stats
      const stats = await webhookService.getDeliveryStats(webhook.id);

      return reply.code(200).send({
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        ledgerIds: webhook.ledgerIds,
        isActive: webhook.isActive,
        headers: webhook.headers,
        hasSecret: !!webhook.secret,
        createdAt: webhook.createdAt.toISOString(),
        updatedAt: webhook.updatedAt.toISOString(),
        stats,
      });
    }
  );

  /**
   * PATCH /v1/webhooks/:id - Update webhook
   */
  fastify.patch<{ Params: { id: string }; Body: UpdateWebhookBody }>(
    '/v1/webhooks/:id',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            url: { type: 'string', format: 'uri' },
            secret: { type: 'string', maxLength: 128 },
            events: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'string',
                enum: ['root_change', 'entry_append', 'ledger_create', 'ledger_delete'],
              },
            },
            ledgerIds: {
              type: 'array',
              items: { type: 'string' },
            },
            headers: { type: 'object' },
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

      const webhook = await webhookService.update(
        auth.userId,
        request.params.id,
        request.body
      );

      if (!webhook) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      return reply.code(200).send({
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        ledgerIds: webhook.ledgerIds,
        isActive: webhook.isActive,
        updatedAt: webhook.updatedAt.toISOString(),
      });
    }
  );

  /**
   * DELETE /v1/webhooks/:id - Delete webhook
   */
  fastify.delete<{ Params: { id: string } }>(
    '/v1/webhooks/:id',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const deleted = await webhookService.delete(auth.userId, request.params.id);
      if (!deleted) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      return reply.code(200).send({
        message: 'Webhook deleted successfully',
      });
    }
  );

  /**
   * POST /v1/webhooks/:id/activate - Activate webhook
   */
  fastify.post<{ Params: { id: string } }>(
    '/v1/webhooks/:id/activate',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const updated = await webhookService.setActive(auth.userId, request.params.id, true);
      if (!updated) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      return reply.code(200).send({
        message: 'Webhook activated',
      });
    }
  );

  /**
   * POST /v1/webhooks/:id/deactivate - Deactivate webhook
   */
  fastify.post<{ Params: { id: string } }>(
    '/v1/webhooks/:id/deactivate',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const updated = await webhookService.setActive(auth.userId, request.params.id, false);
      if (!updated) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      return reply.code(200).send({
        message: 'Webhook deactivated',
      });
    }
  );

  /**
   * POST /v1/webhooks/:id/test - Send test webhook
   */
  fastify.post<{ Params: { id: string } }>(
    '/v1/webhooks/:id/test',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const webhook = await webhookService.get(auth.userId, request.params.id);
      if (!webhook) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      // Queue a test delivery
      const deliveryId = await webhookService.queueDelivery(
        webhook.id,
        'root_change',
        {
          eventType: 'test',
          message: 'This is a test webhook delivery',
          timestamp: new Date().toISOString(),
        }
      );

      return reply.code(200).send({
        message: 'Test webhook queued',
        deliveryId,
      });
    }
  );
}
