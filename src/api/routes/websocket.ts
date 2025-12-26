/**
 * VeilChain WebSocket Routes
 *
 * WebSocket endpoint for real-time ledger updates.
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocketService, SubscriptionOptions, WebSocketEventType } from '../../services/websocket.js';

/**
 * Register WebSocket routes
 */
export async function registerWebSocketRoutes(
  fastify: FastifyInstance,
  wsService: WebSocketService
): Promise<void> {
  /**
   * WebSocket connection endpoint
   * WS /v1/ws
   *
   * Query parameters:
   * - ledgerIds: comma-separated list of ledger IDs to subscribe to (optional)
   * - events: comma-separated list of event types (optional)
   *
   * Example: ws://localhost:3000/v1/ws?ledgerIds=ledger_123,ledger_456&events=entry_append,root_change
   */
  fastify.get('/v1/ws', { websocket: true }, (socket, request) => {
    // Parse subscription options from query string
    const query = request.query as Record<string, string>;
    const options: SubscriptionOptions = {};

    if (query.ledgerIds) {
      options.ledgerIds = query.ledgerIds.split(',').map(id => id.trim());
    }

    if (query.events) {
      options.eventTypes = query.events.split(',').map(e => e.trim()) as WebSocketEventType[];
    }

    // Get user ID from auth context if available
    const userId = (request as unknown as Record<string, unknown>).userId as string | undefined;

    // Register the client
    wsService.subscribe(socket, options, userId);

    fastify.log.info({
      event: 'websocket_connected',
      userId,
      subscriptions: options
    }, 'WebSocket client connected');

    socket.on('close', () => {
      fastify.log.info({
        event: 'websocket_disconnected',
        userId
      }, 'WebSocket client disconnected');
    });
  });

  /**
   * WebSocket connection for specific ledger
   * WS /v1/ledgers/:id/ws
   */
  fastify.get<{
    Params: { id: string };
  }>('/v1/ledgers/:id/ws', { websocket: true }, (socket, request) => {
    const { id: ledgerId } = request.params;

    // Parse additional event filters from query
    const query = request.query as Record<string, string>;
    const options: SubscriptionOptions = {
      ledgerIds: [ledgerId]
    };

    if (query.events) {
      options.eventTypes = query.events.split(',').map(e => e.trim()) as WebSocketEventType[];
    }

    // Get user ID from auth context if available
    const userId = (request as unknown as Record<string, unknown>).userId as string | undefined;

    // Register the client
    wsService.subscribe(socket, options, userId);

    fastify.log.info({
      event: 'websocket_connected',
      ledgerId,
      userId
    }, 'WebSocket client connected to ledger');

    socket.on('close', () => {
      fastify.log.info({
        event: 'websocket_disconnected',
        ledgerId,
        userId
      }, 'WebSocket client disconnected from ledger');
    });
  });
}
