/**
 * VeilChain WebSocket Service Tests
 *
 * Tests for the WebSocket real-time update functionality.
 */

import { WebSocketService, createWebSocketService } from '../src/services/websocket.js';

// Mock WebSocket
class MockWebSocket {
  readyState = 1; // WebSocket.OPEN
  messages: string[] = [];
  closeHandlers: Array<() => void> = [];
  messageHandlers: Array<(data: Buffer) => void> = [];

  send(data: string): void {
    this.messages.push(data);
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (event === 'close') {
      this.closeHandlers.push(handler as () => void);
    } else if (event === 'message') {
      this.messageHandlers.push(handler as (data: Buffer) => void);
    }
  }

  simulateClose(): void {
    this.closeHandlers.forEach(h => h());
  }

  simulateMessage(data: Record<string, unknown>): void {
    const buffer = Buffer.from(JSON.stringify(data));
    this.messageHandlers.forEach(h => h(buffer));
  }

  getLastMessage(): Record<string, unknown> | null {
    if (this.messages.length === 0) return null;
    return JSON.parse(this.messages[this.messages.length - 1]);
  }

  getAllMessages(): Array<Record<string, unknown>> {
    return this.messages.map(m => JSON.parse(m));
  }
}

describe('WebSocket Service', () => {
  let wsService: WebSocketService;

  beforeEach(() => {
    wsService = createWebSocketService();
  });

  describe('subscribe', () => {
    it('should register a client and send welcome message', () => {
      const socket = new MockWebSocket();
      wsService.subscribe(socket as unknown as import('@fastify/websocket').WebSocket, {});

      expect(wsService.getClientCount()).toBe(1);

      const welcome = socket.getLastMessage();
      expect(welcome).not.toBeNull();
      expect(welcome!.type).toBe('connected');
    });

    it('should unsubscribe client on close', () => {
      const socket = new MockWebSocket();
      wsService.subscribe(socket as unknown as import('@fastify/websocket').WebSocket, {});

      expect(wsService.getClientCount()).toBe(1);

      socket.simulateClose();
      expect(wsService.getClientCount()).toBe(0);
    });

    it('should handle subscription options', () => {
      const socket = new MockWebSocket();
      wsService.subscribe(
        socket as unknown as import('@fastify/websocket').WebSocket,
        {
          ledgerIds: ['ledger_1', 'ledger_2'],
          eventTypes: ['entry_append', 'root_change']
        }
      );

      const welcome = socket.getLastMessage();
      expect(welcome!.subscriptions).toEqual({
        ledgerIds: ['ledger_1', 'ledger_2'],
        eventTypes: ['entry_append', 'root_change']
      });
    });
  });

  describe('broadcast', () => {
    it('should broadcast to all connected clients', () => {
      const socket1 = new MockWebSocket();
      const socket2 = new MockWebSocket();

      wsService.subscribe(socket1 as unknown as import('@fastify/websocket').WebSocket, {});
      wsService.subscribe(socket2 as unknown as import('@fastify/websocket').WebSocket, {});

      wsService.broadcast({
        type: 'root_change',
        ledgerId: 'ledger_test',
        timestamp: new Date().toISOString(),
        data: { newRoot: 'abc123' }
      });

      // Both should receive the broadcast (plus welcome message)
      expect(socket1.messages).toHaveLength(2);
      expect(socket2.messages).toHaveLength(2);
    });

    it('should filter by ledger ID', () => {
      const socket1 = new MockWebSocket();
      const socket2 = new MockWebSocket();

      wsService.subscribe(
        socket1 as unknown as import('@fastify/websocket').WebSocket,
        { ledgerIds: ['ledger_1'] }
      );
      wsService.subscribe(
        socket2 as unknown as import('@fastify/websocket').WebSocket,
        { ledgerIds: ['ledger_2'] }
      );

      wsService.broadcast({
        type: 'entry_append',
        ledgerId: 'ledger_1',
        timestamp: new Date().toISOString(),
        data: { entryId: 'entry_1' }
      });

      // Only socket1 should receive (welcome + broadcast)
      expect(socket1.messages).toHaveLength(2);
      // socket2 only has welcome
      expect(socket2.messages).toHaveLength(1);
    });

    it('should filter by event type', () => {
      const socket1 = new MockWebSocket();
      const socket2 = new MockWebSocket();

      wsService.subscribe(
        socket1 as unknown as import('@fastify/websocket').WebSocket,
        { eventTypes: ['entry_append'] }
      );
      wsService.subscribe(
        socket2 as unknown as import('@fastify/websocket').WebSocket,
        { eventTypes: ['root_change'] }
      );

      wsService.broadcast({
        type: 'entry_append',
        ledgerId: 'ledger_test',
        timestamp: new Date().toISOString(),
        data: {}
      });

      expect(socket1.messages).toHaveLength(2);
      expect(socket2.messages).toHaveLength(1);
    });

    it('should broadcast to all when no filters set', () => {
      const socket = new MockWebSocket();
      wsService.subscribe(socket as unknown as import('@fastify/websocket').WebSocket, {});

      wsService.broadcast({
        type: 'anchor_confirmed',
        ledgerId: 'any_ledger',
        timestamp: new Date().toISOString(),
        data: {}
      });

      expect(socket.messages).toHaveLength(2);
    });
  });

  describe('emit helpers', () => {
    it('should emit root change event', () => {
      const socket = new MockWebSocket();
      wsService.subscribe(socket as unknown as import('@fastify/websocket').WebSocket, {});

      wsService.emitRootChange('ledger_1', {
        previousRoot: 'old_root',
        newRoot: 'new_root',
        entryCount: 100n
      });

      const messages = socket.getAllMessages();
      const rootChange = messages.find(m => m.type === 'root_change');
      expect(rootChange).toBeDefined();
      expect(rootChange!.ledgerId).toBe('ledger_1');
      expect((rootChange!.data as Record<string, unknown>).previousRoot).toBe('old_root');
      expect((rootChange!.data as Record<string, unknown>).newRoot).toBe('new_root');
      expect((rootChange!.data as Record<string, unknown>).entryCount).toBe('100');
    });

    it('should emit entry append event', () => {
      const socket = new MockWebSocket();
      wsService.subscribe(socket as unknown as import('@fastify/websocket').WebSocket, {});

      wsService.emitEntryAppend('ledger_2', {
        entryId: 'entry_123',
        position: 50n,
        hash: 'hash_abc',
        newRoot: 'new_root_xyz'
      });

      const messages = socket.getAllMessages();
      const entryAppend = messages.find(m => m.type === 'entry_append');
      expect(entryAppend).toBeDefined();
      expect(entryAppend!.ledgerId).toBe('ledger_2');
      expect((entryAppend!.data as Record<string, unknown>).entryId).toBe('entry_123');
    });

    it('should emit anchor status events', () => {
      const socket = new MockWebSocket();
      wsService.subscribe(socket as unknown as import('@fastify/websocket').WebSocket, {});

      wsService.emitAnchorStatus('ledger_3', 'confirmed', {
        anchorId: 'anchor_1',
        anchorType: 'bitcoin',
        rootHash: 'root_hash',
        externalTxId: 'tx_123'
      });

      const messages = socket.getAllMessages();
      const anchorEvent = messages.find(m => m.type === 'anchor_confirmed');
      expect(anchorEvent).toBeDefined();
      expect(anchorEvent!.ledgerId).toBe('ledger_3');
    });

    it('should emit ledger archived event', () => {
      const socket = new MockWebSocket();
      wsService.subscribe(socket as unknown as import('@fastify/websocket').WebSocket, {});

      wsService.emitLedgerArchived('ledger_4');

      const messages = socket.getAllMessages();
      const archivedEvent = messages.find(m => m.type === 'ledger_archived');
      expect(archivedEvent).toBeDefined();
      expect(archivedEvent!.ledgerId).toBe('ledger_4');
    });
  });

  describe('client message handling', () => {
    it('should handle subscribe action', () => {
      const socket = new MockWebSocket();
      wsService.subscribe(socket as unknown as import('@fastify/websocket').WebSocket, {});

      socket.simulateMessage({
        action: 'subscribe',
        ledgerIds: ['ledger_new'],
        eventTypes: ['entry_append']
      });

      const messages = socket.getAllMessages();
      const subscribed = messages.find(m => m.type === 'subscribed');
      expect(subscribed).toBeDefined();
    });

    it('should handle unsubscribe action', () => {
      const socket = new MockWebSocket();
      wsService.subscribe(
        socket as unknown as import('@fastify/websocket').WebSocket,
        { ledgerIds: ['ledger_1', 'ledger_2'] }
      );

      socket.simulateMessage({
        action: 'unsubscribe',
        ledgerId: 'ledger_1'
      });

      const messages = socket.getAllMessages();
      const unsubscribed = messages.find(m => m.type === 'unsubscribed');
      expect(unsubscribed).toBeDefined();
    });

    it('should handle ping action', () => {
      const socket = new MockWebSocket();
      wsService.subscribe(socket as unknown as import('@fastify/websocket').WebSocket, {});

      socket.simulateMessage({ action: 'ping' });

      const messages = socket.getAllMessages();
      const pong = messages.find(m => m.type === 'pong');
      expect(pong).toBeDefined();
      expect(pong!.timestamp).toBeDefined();
    });

    it('should handle unknown action', () => {
      const socket = new MockWebSocket();
      wsService.subscribe(socket as unknown as import('@fastify/websocket').WebSocket, {});

      socket.simulateMessage({ action: 'unknown_action' });

      const messages = socket.getAllMessages();
      const error = messages.find(m => m.type === 'error');
      expect(error).toBeDefined();
      expect((error!.message as string)).toContain('Unknown action');
    });

    it('should handle invalid JSON', () => {
      const socket = new MockWebSocket();
      wsService.subscribe(socket as unknown as import('@fastify/websocket').WebSocket, {});

      // Send invalid data directly
      const buffer = Buffer.from('not valid json');
      socket.messageHandlers.forEach(h => h(buffer));

      const messages = socket.getAllMessages();
      const error = messages.find(m => m.type === 'error');
      expect(error).toBeDefined();
      expect((error!.message as string)).toContain('Invalid message format');
    });
  });

  describe('getLedgerSubscriberCount', () => {
    it('should count subscribers for specific ledger', () => {
      const socket1 = new MockWebSocket();
      const socket2 = new MockWebSocket();
      const socket3 = new MockWebSocket();

      wsService.subscribe(
        socket1 as unknown as import('@fastify/websocket').WebSocket,
        { ledgerIds: ['ledger_1'] }
      );
      wsService.subscribe(
        socket2 as unknown as import('@fastify/websocket').WebSocket,
        { ledgerIds: ['ledger_1', 'ledger_2'] }
      );
      wsService.subscribe(
        socket3 as unknown as import('@fastify/websocket').WebSocket,
        { ledgerIds: ['ledger_2'] }
      );

      expect(wsService.getLedgerSubscriberCount('ledger_1')).toBe(2);
      expect(wsService.getLedgerSubscriberCount('ledger_2')).toBe(2);
      expect(wsService.getLedgerSubscriberCount('ledger_3')).toBe(0);
    });

    it('should count global subscribers for any ledger', () => {
      const socket1 = new MockWebSocket();
      const socket2 = new MockWebSocket();

      // No ledger filter = subscribed to all
      wsService.subscribe(socket1 as unknown as import('@fastify/websocket').WebSocket, {});
      wsService.subscribe(
        socket2 as unknown as import('@fastify/websocket').WebSocket,
        { ledgerIds: ['ledger_1'] }
      );

      // socket1 (global) + socket2 (specific)
      expect(wsService.getLedgerSubscriberCount('ledger_1')).toBe(2);
      // Only socket1 (global)
      expect(wsService.getLedgerSubscriberCount('ledger_other')).toBe(1);
    });
  });
});
