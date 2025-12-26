/**
 * VeilChain WebSocket Service
 *
 * Provides real-time updates for ledger events:
 * - Root hash changes
 * - Entry append notifications
 * - Anchor confirmations
 */

import type { WebSocket } from '@fastify/websocket';

/**
 * Event types that can be broadcast
 */
export type WebSocketEventType =
  | 'root_change'
  | 'entry_append'
  | 'anchor_pending'
  | 'anchor_confirmed'
  | 'anchor_failed'
  | 'ledger_archived'
  | 'ledger_restored';

/**
 * WebSocket event payload
 */
export interface WebSocketEvent {
  type: WebSocketEventType;
  ledgerId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  ledgerIds?: string[];       // Subscribe to specific ledgers (empty = all)
  eventTypes?: WebSocketEventType[];  // Subscribe to specific events (empty = all)
}

/**
 * Client subscription info
 */
interface ClientSubscription {
  socket: WebSocket;
  options: SubscriptionOptions;
  userId?: string;
  subscribedAt: Date;
}

/**
 * WebSocket service for real-time updates
 */
export class WebSocketService {
  private clients: Map<WebSocket, ClientSubscription> = new Map();

  /**
   * Register a new WebSocket client
   */
  subscribe(socket: WebSocket, options: SubscriptionOptions = {}, userId?: string): void {
    this.clients.set(socket, {
      socket,
      options,
      userId,
      subscribedAt: new Date()
    });

    // Send welcome message
    this.sendToClient(socket, {
      type: 'connected',
      message: 'WebSocket connected',
      subscriptions: {
        ledgerIds: options.ledgerIds ?? 'all',
        eventTypes: options.eventTypes ?? 'all'
      }
    });

    // Handle client disconnect
    socket.on('close', () => {
      this.clients.delete(socket);
    });

    // Handle client messages (for updating subscriptions)
    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(socket, message);
      } catch {
        this.sendToClient(socket, {
          type: 'error',
          message: 'Invalid message format. Expected JSON.'
        });
      }
    });
  }

  /**
   * Unsubscribe a client
   */
  unsubscribe(socket: WebSocket): void {
    this.clients.delete(socket);
  }

  /**
   * Broadcast an event to all matching clients
   */
  broadcast(event: WebSocketEvent): void {
    for (const [socket, subscription] of this.clients) {
      if (this.shouldReceiveEvent(subscription, event)) {
        this.sendToClient(socket, event as unknown as Record<string, unknown>);
      }
    }
  }

  /**
   * Emit root change event
   */
  emitRootChange(ledgerId: string, data: {
    previousRoot: string;
    newRoot: string;
    entryCount: bigint;
  }): void {
    this.broadcast({
      type: 'root_change',
      ledgerId,
      timestamp: new Date().toISOString(),
      data: {
        previousRoot: data.previousRoot,
        newRoot: data.newRoot,
        entryCount: data.entryCount.toString()
      }
    });
  }

  /**
   * Emit entry append event
   */
  emitEntryAppend(ledgerId: string, data: {
    entryId: string;
    position: bigint;
    hash: string;
    newRoot: string;
  }): void {
    this.broadcast({
      type: 'entry_append',
      ledgerId,
      timestamp: new Date().toISOString(),
      data: {
        entryId: data.entryId,
        position: data.position.toString(),
        hash: data.hash,
        newRoot: data.newRoot
      }
    });
  }

  /**
   * Emit anchor status event
   */
  emitAnchorStatus(ledgerId: string, status: 'pending' | 'confirmed' | 'failed', data: {
    anchorId: string;
    anchorType: string;
    rootHash: string;
    externalTxId?: string;
    errorMessage?: string;
  }): void {
    const eventType: WebSocketEventType =
      status === 'pending' ? 'anchor_pending' :
      status === 'confirmed' ? 'anchor_confirmed' : 'anchor_failed';

    this.broadcast({
      type: eventType,
      ledgerId,
      timestamp: new Date().toISOString(),
      data
    });
  }

  /**
   * Emit ledger archived event
   */
  emitLedgerArchived(ledgerId: string): void {
    this.broadcast({
      type: 'ledger_archived',
      ledgerId,
      timestamp: new Date().toISOString(),
      data: {}
    });
  }

  /**
   * Emit ledger restored event
   */
  emitLedgerRestored(ledgerId: string): void {
    this.broadcast({
      type: 'ledger_restored',
      ledgerId,
      timestamp: new Date().toISOString(),
      data: {}
    });
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get subscriptions for a specific ledger
   */
  getLedgerSubscriberCount(ledgerId: string): number {
    let count = 0;
    for (const subscription of this.clients.values()) {
      const ledgerIds = subscription.options.ledgerIds;
      if (!ledgerIds || ledgerIds.length === 0 || ledgerIds.includes(ledgerId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Check if a client should receive an event
   */
  private shouldReceiveEvent(subscription: ClientSubscription, event: WebSocketEvent): boolean {
    const { ledgerIds, eventTypes } = subscription.options;

    // Check ledger filter
    if (ledgerIds && ledgerIds.length > 0 && !ledgerIds.includes(event.ledgerId)) {
      return false;
    }

    // Check event type filter
    if (eventTypes && eventTypes.length > 0 && !eventTypes.includes(event.type)) {
      return false;
    }

    return true;
  }

  /**
   * Handle incoming client message
   */
  private handleClientMessage(socket: WebSocket, message: Record<string, unknown>): void {
    const subscription = this.clients.get(socket);
    if (!subscription) return;

    switch (message.action) {
      case 'subscribe':
        // Update subscription options
        if (Array.isArray(message.ledgerIds)) {
          subscription.options.ledgerIds = message.ledgerIds as string[];
        }
        if (Array.isArray(message.eventTypes)) {
          subscription.options.eventTypes = message.eventTypes as WebSocketEventType[];
        }
        this.sendToClient(socket, {
          type: 'subscribed',
          subscriptions: subscription.options
        });
        break;

      case 'unsubscribe':
        if (message.ledgerId) {
          subscription.options.ledgerIds = subscription.options.ledgerIds?.filter(
            id => id !== message.ledgerId
          );
        }
        if (message.eventType) {
          subscription.options.eventTypes = subscription.options.eventTypes?.filter(
            type => type !== message.eventType
          );
        }
        this.sendToClient(socket, {
          type: 'unsubscribed',
          subscriptions: subscription.options
        });
        break;

      case 'ping':
        this.sendToClient(socket, { type: 'pong', timestamp: new Date().toISOString() });
        break;

      default:
        this.sendToClient(socket, {
          type: 'error',
          message: `Unknown action: ${message.action}`
        });
    }
  }

  /**
   * Send a message to a client
   */
  private sendToClient(socket: WebSocket, data: Record<string, unknown>): void {
    if (socket.readyState === 1) { // WebSocket.OPEN
      socket.send(JSON.stringify(data));
    }
  }
}

/**
 * Create a WebSocket service instance
 */
export function createWebSocketService(): WebSocketService {
  return new WebSocketService();
}
