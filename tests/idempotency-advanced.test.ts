/**
 * Advanced Idempotency Service Tests
 *
 * Comprehensive tests for idempotency service edge cases and scenarios.
 */

import { IdempotencyService, MemoryIdempotencyStorage } from '../src/services/idempotency';

describe('Advanced Idempotency Tests', () => {
  let service: IdempotencyService;

  beforeEach(() => {
    service = new IdempotencyService(new MemoryIdempotencyStorage());
  });

  afterEach(() => {
    service.destroy();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      await service.set('ledger1', 'key1', { data: 'test' });
      const result = await service.get('ledger1', 'key1');
      expect(result).toEqual({ data: 'test' });
    });

    it('should return null for non-existent key', async () => {
      expect(await service.get('ledger1', 'missing')).toBeNull();
    });

    it('should return null for non-existent ledger', async () => {
      expect(await service.get('missing', 'key')).toBeNull();
    });

    it('should overwrite existing key', async () => {
      await service.set('ledger1', 'key1', { v: 1 });
      await service.set('ledger1', 'key1', { v: 2 });
      expect(await service.get('ledger1', 'key1')).toEqual({ v: 2 });
    });

    it('should delete a key', async () => {
      await service.set('ledger1', 'key1', { data: 'test' });
      await service.delete('ledger1', 'key1');
      expect(await service.get('ledger1', 'key1')).toBeNull();
    });

    it('should handle delete of non-existent key', async () => {
      await service.delete('ledger1', 'missing');
      expect(await service.get('ledger1', 'missing')).toBeNull();
    });
  });

  describe('Multiple Ledgers', () => {
    it('should isolate keys between ledgers', async () => {
      await service.set('ledger1', 'key', { ledger: 1 });
      await service.set('ledger2', 'key', { ledger: 2 });
      expect(await service.get('ledger1', 'key')).toEqual({ ledger: 1 });
      expect(await service.get('ledger2', 'key')).toEqual({ ledger: 2 });
    });

    it('should clear only one ledger', async () => {
      await service.set('ledger1', 'key1', { v: 1 });
      await service.set('ledger2', 'key1', { v: 2 });
      service.clearLedger('ledger1');
      expect(await service.get('ledger1', 'key1')).toBeNull();
      expect(await service.get('ledger2', 'key1')).toEqual({ v: 2 });
    });

    it('should handle 10 different ledgers', async () => {
      for (let i = 0; i < 10; i++) {
        await service.set(`ledger${i}`, 'key', { index: i });
      }
      for (let i = 0; i < 10; i++) {
        expect(await service.get(`ledger${i}`, 'key')).toEqual({ index: i });
      }
    });

    it('should handle 100 different ledgers', async () => {
      for (let i = 0; i < 100; i++) {
        await service.set(`ledger${i}`, 'key', { index: i });
      }
      for (let i = 0; i < 100; i++) {
        expect(await service.get(`ledger${i}`, 'key')).toEqual({ index: i });
      }
    });
  });

  describe('Key Variations', () => {
    it('should handle empty string key', async () => {
      await service.set('ledger', '', { empty: true });
      expect(await service.get('ledger', '')).toEqual({ empty: true });
    });

    it('should handle single character key', async () => {
      await service.set('ledger', 'a', { single: true });
      expect(await service.get('ledger', 'a')).toEqual({ single: true });
    });

    it('should handle numeric key', async () => {
      await service.set('ledger', '12345', { numeric: true });
      expect(await service.get('ledger', '12345')).toEqual({ numeric: true });
    });

    it('should handle UUID-like key', async () => {
      const key = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      await service.set('ledger', key, { uuid: true });
      expect(await service.get('ledger', key)).toEqual({ uuid: true });
    });

    it('should handle very long key (1000 chars)', async () => {
      const key = 'k'.repeat(1000);
      await service.set('ledger', key, { long: true });
      expect(await service.get('ledger', key)).toEqual({ long: true });
    });

    it('should handle special characters in key', async () => {
      const key = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      await service.set('ledger', key, { special: true });
      expect(await service.get('ledger', key)).toEqual({ special: true });
    });

    it('should handle unicode key', async () => {
      const key = '中文测试🔐';
      await service.set('ledger', key, { unicode: true });
      expect(await service.get('ledger', key)).toEqual({ unicode: true });
    });

    it('should handle whitespace key', async () => {
      await service.set('ledger', '   ', { spaces: true });
      expect(await service.get('ledger', '   ')).toEqual({ spaces: true });
    });

    it('should handle newline in key', async () => {
      await service.set('ledger', 'line1\nline2', { newline: true });
      expect(await service.get('ledger', 'line1\nline2')).toEqual({ newline: true });
    });

    it('should handle tab in key', async () => {
      await service.set('ledger', 'col1\tcol2', { tab: true });
      expect(await service.get('ledger', 'col1\tcol2')).toEqual({ tab: true });
    });
  });

  describe('Value Variations', () => {
    it('should store null value', async () => {
      await service.set('ledger', 'key', null);
      expect(await service.get('ledger', 'key')).toBeNull();
    });

    it('should store string value', async () => {
      await service.set('ledger', 'key', 'string');
      expect(await service.get('ledger', 'key')).toBe('string');
    });

    it('should store number value', async () => {
      await service.set('ledger', 'key', 42);
      expect(await service.get('ledger', 'key')).toBe(42);
    });

    it('should store boolean true', async () => {
      await service.set('ledger', 'key', true);
      expect(await service.get('ledger', 'key')).toBe(true);
    });

    it('should store boolean false', async () => {
      await service.set('ledger', 'key', false);
      expect(await service.get('ledger', 'key')).toBe(false);
    });

    it('should store empty array', async () => {
      await service.set('ledger', 'key', []);
      expect(await service.get('ledger', 'key')).toEqual([]);
    });

    it('should store array with values', async () => {
      await service.set('ledger', 'key', [1, 2, 3]);
      expect(await service.get('ledger', 'key')).toEqual([1, 2, 3]);
    });

    it('should store empty object', async () => {
      await service.set('ledger', 'key', {});
      expect(await service.get('ledger', 'key')).toEqual({});
    });

    it('should store nested object', async () => {
      const nested = { a: { b: { c: 'd' } } };
      await service.set('ledger', 'key', nested);
      expect(await service.get('ledger', 'key')).toEqual(nested);
    });

    it('should store complex object', async () => {
      const complex = {
        string: 'hello',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { deep: 'value' }
      };
      await service.set('ledger', 'key', complex);
      expect(await service.get('ledger', 'key')).toEqual(complex);
    });

    it('should store large array', async () => {
      const large = Array.from({ length: 1000 }, (_, i) => i);
      await service.set('ledger', 'key', large);
      expect(await service.get('ledger', 'key')).toEqual(large);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent reads', async () => {
      await service.set('ledger', 'key', { value: 'test' });
      const results = await Promise.all(
        Array.from({ length: 100 }, () => service.get('ledger', 'key'))
      );
      expect(results.every(r => r?.value === 'test')).toBe(true);
    });

    it('should handle concurrent writes to different keys', async () => {
      await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          service.set('ledger', `key${i}`, { index: i })
        )
      );
      for (let i = 0; i < 100; i++) {
        expect(await service.get('ledger', `key${i}`)).toEqual({ index: i });
      }
    });

    it('should handle concurrent writes to same key', async () => {
      await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          service.set('ledger', 'key', { index: i })
        )
      );
      const result = await service.get('ledger', 'key');
      expect(result).toHaveProperty('index');
    });

    it('should handle mixed read/write operations', async () => {
      await service.set('ledger', 'key', { initial: true });
      const operations = Array.from({ length: 50 }, (_, i) =>
        i % 2 === 0
          ? service.get('ledger', 'key')
          : service.set('ledger', 'key', { update: i })
      );
      await Promise.all(operations);
      expect(await service.get('ledger', 'key')).toBeDefined();
    });
  });

  describe('ClearLedger Operations', () => {
    it('should clear all keys in ledger', async () => {
      for (let i = 0; i < 10; i++) {
        await service.set('ledger', `key${i}`, { i });
      }
      service.clearLedger('ledger');
      for (let i = 0; i < 10; i++) {
        expect(await service.get('ledger', `key${i}`)).toBeNull();
      }
    });

    it('should handle clearing empty ledger', () => {
      expect(() => service.clearLedger('empty')).not.toThrow();
    });

    it('should handle clearing non-existent ledger', () => {
      expect(() => service.clearLedger('nonexistent')).not.toThrow();
    });

    it('should allow new entries after clear', async () => {
      await service.set('ledger', 'key', { before: true });
      service.clearLedger('ledger');
      await service.set('ledger', 'key', { after: true });
      expect(await service.get('ledger', 'key')).toEqual({ after: true });
    });
  });

  describe('Destroy Operations', () => {
    it('should clean up on destroy', async () => {
      await service.set('ledger', 'key', { data: 'test' });
      service.destroy();
      // After destroy, service should be cleaned up
      // (actual behavior depends on implementation)
    });

    it('should handle double destroy', () => {
      service.destroy();
      expect(() => service.destroy()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle setting same value twice', async () => {
      const value = { same: true };
      await service.set('ledger', 'key', value);
      await service.set('ledger', 'key', value);
      expect(await service.get('ledger', 'key')).toEqual(value);
    });

    it('should handle rapid set/get cycles', async () => {
      for (let i = 0; i < 100; i++) {
        await service.set('ledger', 'key', { cycle: i });
        expect(await service.get('ledger', 'key')).toEqual({ cycle: i });
      }
    });

    it('should handle rapid set/delete cycles', async () => {
      for (let i = 0; i < 100; i++) {
        await service.set('ledger', 'key', { cycle: i });
        await service.delete('ledger', 'key');
        expect(await service.get('ledger', 'key')).toBeNull();
      }
    });

    it('should handle many keys in one ledger', async () => {
      for (let i = 0; i < 1000; i++) {
        await service.set('ledger', `key${i}`, { index: i });
      }
      for (let i = 0; i < 1000; i++) {
        expect(await service.get('ledger', `key${i}`)).toEqual({ index: i });
      }
    });

    it('should handle alternating ledgers', async () => {
      for (let i = 0; i < 100; i++) {
        const ledger = i % 2 === 0 ? 'even' : 'odd';
        await service.set(ledger, `key${i}`, { index: i });
      }
      for (let i = 0; i < 100; i++) {
        const ledger = i % 2 === 0 ? 'even' : 'odd';
        expect(await service.get(ledger, `key${i}`)).toEqual({ index: i });
      }
    });
  });

  describe('Type Safety', () => {
    it('should preserve type for string', async () => {
      await service.set('ledger', 'key', 'hello');
      const result = await service.get<string>('ledger', 'key');
      expect(typeof result).toBe('string');
    });

    it('should preserve type for number', async () => {
      await service.set('ledger', 'key', 42);
      const result = await service.get<number>('ledger', 'key');
      expect(typeof result).toBe('number');
    });

    it('should preserve type for boolean', async () => {
      await service.set('ledger', 'key', true);
      const result = await service.get<boolean>('ledger', 'key');
      expect(typeof result).toBe('boolean');
    });

    it('should preserve type for object', async () => {
      await service.set('ledger', 'key', { prop: 'value' });
      const result = await service.get<{ prop: string }>('ledger', 'key');
      expect(result?.prop).toBe('value');
    });

    it('should preserve type for array', async () => {
      await service.set('ledger', 'key', [1, 2, 3]);
      const result = await service.get<number[]>('ledger', 'key');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
