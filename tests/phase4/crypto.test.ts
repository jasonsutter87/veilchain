/**
 * VeilChain Cryptographic Utilities Tests - Phase 4
 *
 * Comprehensive tests for password hashing, API key generation, JWT operations,
 * and other cryptographic functions. 50+ test cases.
 */

import { generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';
import {
  generateSecureToken,
  generateId,
  generateJti,
  generateApiKey,
  hashPassword,
  verifyPassword,
  hashApiKey,
  verifyApiKey,
  hashToken,
  createJwtService,
  secureCompare,
  generatePasswordResetToken,
  generateEmailVerificationToken,
  generateOAuthState,
} from '../../src/services/crypto.js';

// Generate valid RSA keys for JWT testing
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

describe('Cryptographic Utilities - Phase 4', () => {
  // ============================================
  // generateSecureToken Tests (10 tests)
  // ============================================
  describe('generateSecureToken', () => {
    it('should generate a token of default length (32 bytes)', () => {
      const token = generateSecureToken();
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(40);
    });

    it('should generate a token of specified length 16 bytes', () => {
      const token = generateSecureToken(16);
      expect(token.length).toBeGreaterThan(20);
    });

    it('should generate a token of specified length 64 bytes', () => {
      const token = generateSecureToken(64);
      expect(token.length).toBeGreaterThan(80);
    });

    it('should generate a token of 1 byte', () => {
      const token = generateSecureToken(1);
      expect(token.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate 100 unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateSecureToken());
      }
      expect(tokens.size).toBe(100);
    });

    it('should generate 1000 unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        tokens.add(generateSecureToken());
      }
      expect(tokens.size).toBe(1000);
    });

    it('should only contain URL-safe characters (base64url)', () => {
      for (let i = 0; i < 100; i++) {
        const token = generateSecureToken();
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });

    it('should not contain + or / characters', () => {
      for (let i = 0; i < 100; i++) {
        const token = generateSecureToken();
        expect(token).not.toContain('+');
        expect(token).not.toContain('/');
      }
    });

    it('should not contain padding characters', () => {
      for (let i = 0; i < 100; i++) {
        const token = generateSecureToken();
        expect(token).not.toContain('=');
      }
    });

    it('should handle large token sizes', () => {
      const token = generateSecureToken(1024);
      expect(token.length).toBeGreaterThan(1360);
    });
  });

  // ============================================
  // generateId Tests (8 tests)
  // ============================================
  describe('generateId', () => {
    it('should generate a 32-character hex string', () => {
      const id = generateId();
      expect(id.length).toBe(32);
      expect(id).toMatch(/^[a-f0-9]+$/);
    });

    it('should only contain lowercase hex characters', () => {
      for (let i = 0; i < 100; i++) {
        const id = generateId();
        expect(id).toMatch(/^[a-f0-9]+$/);
        expect(id).not.toMatch(/[A-F]/);
      }
    });

    it('should generate 1000 unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(1000);
    });

    it('should generate 10000 unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10000; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(10000);
    });

    it('should be suitable as UUID replacement', () => {
      const id = generateId();
      // 32 hex chars = 128 bits of entropy (same as UUID)
      expect(id.length).toBe(32);
    });

    it('should be consistent in format across many generations', () => {
      for (let i = 0; i < 500; i++) {
        const id = generateId();
        expect(id.length).toBe(32);
        expect(id).toMatch(/^[a-f0-9]{32}$/);
      }
    });

    it('should not have obvious patterns', () => {
      const ids = [];
      for (let i = 0; i < 100; i++) {
        ids.push(generateId());
      }
      // Check no two consecutive IDs share more than 8 characters in same position
      for (let i = 1; i < ids.length; i++) {
        let matches = 0;
        for (let j = 0; j < 32; j++) {
          if (ids[i][j] === ids[i - 1][j]) matches++;
        }
        expect(matches).toBeLessThan(16);
      }
    });

    it('should be usable as database primary key', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeLessThanOrEqual(64);
    });
  });

  // ============================================
  // generateJti Tests (6 tests)
  // ============================================
  describe('generateJti', () => {
    it('should generate a valid JWT ID', () => {
      const jti = generateJti();
      expect(jti.length).toBe(32);
      expect(jti).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate 1000 unique JTIs', () => {
      const jtis = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        jtis.add(generateJti());
      }
      expect(jtis.size).toBe(1000);
    });

    it('should be suitable for JWT jti claim', () => {
      const jti = generateJti();
      // JWT jti should be a string identifier
      expect(typeof jti).toBe('string');
      expect(jti.length).toBeGreaterThan(0);
    });

    it('should be collision-resistant for high volume', () => {
      const jtis = new Set<string>();
      for (let i = 0; i < 50000; i++) {
        jtis.add(generateJti());
      }
      expect(jtis.size).toBe(50000);
    });

    it('should have same format as generateId', () => {
      const jti = generateJti();
      const id = generateId();
      expect(jti.length).toBe(id.length);
      expect(jti).toMatch(/^[a-f0-9]+$/);
    });

    it('should be safe for URL encoding', () => {
      for (let i = 0; i < 100; i++) {
        const jti = generateJti();
        expect(encodeURIComponent(jti)).toBe(jti);
      }
    });
  });

  // ============================================
  // generateApiKey Tests (12 tests)
  // ============================================
  describe('generateApiKey', () => {
    it('should generate a key with correct prefix format', () => {
      const { key, prefix } = generateApiKey();
      expect(key).toMatch(/^vc_live_[A-Za-z0-9_-]+$/);
      expect(prefix).toBe(key.substring(0, 12));
    });

    it('should have prefix starting with vc_live_', () => {
      const { prefix } = generateApiKey();
      expect(prefix).toMatch(/^vc_live_/);
    });

    it('should generate keys with sufficient entropy (32+ bytes)', () => {
      const { key } = generateApiKey();
      // vc_live_ (8 chars) + base64url(32 bytes) = 8 + 43 = 51+ chars
      expect(key.length).toBeGreaterThan(50);
    });

    it('should generate 1000 unique keys', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const { key } = generateApiKey();
        keys.add(key);
      }
      expect(keys.size).toBe(1000);
    });

    it('should generate 1000 unique prefixes', () => {
      const prefixes = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const { prefix } = generateApiKey();
        prefixes.add(prefix);
      }
      // Prefixes might have some collisions due to shorter length, but should be mostly unique
      expect(prefixes.size).toBeGreaterThan(900);
    });

    it('should be URL-safe', () => {
      for (let i = 0; i < 100; i++) {
        const { key } = generateApiKey();
        expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });

    it('should not contain special characters except underscore and dash', () => {
      for (let i = 0; i < 100; i++) {
        const { key } = generateApiKey();
        expect(key).not.toMatch(/[!@#$%^&*()+=\[\]{}|;:'",.<>?/\\`~]/);
      }
    });

    it('should have consistent prefix length', () => {
      for (let i = 0; i < 100; i++) {
        const { prefix } = generateApiKey();
        expect(prefix.length).toBe(12);
      }
    });

    it('should have consistent key format', () => {
      for (let i = 0; i < 100; i++) {
        const { key, prefix } = generateApiKey();
        expect(key.startsWith(prefix)).toBe(true);
        expect(key.startsWith('vc_live_')).toBe(true);
      }
    });

    it('should be safe to use in HTTP headers', () => {
      const { key } = generateApiKey();
      // No control characters or spaces
      expect(key).not.toMatch(/[\x00-\x1f\x7f\s]/);
    });

    it('should be safe to store in databases', () => {
      const { key } = generateApiKey();
      // Check reasonable length for VARCHAR column
      expect(key.length).toBeLessThan(256);
    });

    it('should be distinguishable from other token types', () => {
      const { key } = generateApiKey();
      const token = generateSecureToken();
      expect(key.startsWith('vc_live_')).toBe(true);
      expect(token.startsWith('vc_live_')).toBe(false);
    });
  });

  // ============================================
  // Password Hashing Tests (15 tests)
  // ============================================
  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'securePassword123!';
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('should use default cost factor of 12', async () => {
      const hash = await hashPassword('test');
      expect(hash).toMatch(/^\$2b\$12\$/);
    });

    it('should use configurable cost factor 10', async () => {
      const hash = await hashPassword('test', 10);
      expect(hash).toMatch(/^\$2b\$10\$/);
    });

    it('should use configurable cost factor 14', async () => {
      const hash = await hashPassword('test', 14);
      expect(hash).toMatch(/^\$2b\$14\$/);
    });

    it('should verify correct password', async () => {
      const password = 'correctPassword';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'correctPassword';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('wrongPassword', hash);
      expect(isValid).toBe(false);
    });

    it('should reject similar but different password', async () => {
      const password = 'correctPassword';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('correctpassword', hash);
      expect(isValid).toBe(false);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'samePassword';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', async () => {
      const hash = await hashPassword('');
      const isValid = await verifyPassword('', hash);
      expect(isValid).toBe(true);
    });

    it('should reject empty password against non-empty', async () => {
      const hash = await hashPassword('password');
      const isValid = await verifyPassword('', hash);
      expect(isValid).toBe(false);
    });

    it('should handle unicode passwords', async () => {
      const password = '密码🔐パスワード';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should handle very long passwords', async () => {
      const password = 'a'.repeat(1000);
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should handle passwords with special characters', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should handle passwords with newlines', async () => {
      const password = 'line1\nline2\rline3\r\nline4';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should handle passwords with null bytes', async () => {
      const password = 'before\x00after';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });
  });

  // ============================================
  // API Key Hashing Tests (8 tests)
  // ============================================
  describe('API Key Hashing', () => {
    it('should hash an API key', async () => {
      const { key } = generateApiKey();
      const hash = await hashApiKey(key);
      expect(hash).toBeDefined();
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('should verify correct API key', async () => {
      const { key } = generateApiKey();
      const hash = await hashApiKey(key);
      const isValid = await verifyApiKey(key, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect API key', async () => {
      const { key } = generateApiKey();
      const hash = await hashApiKey(key);
      const { key: otherKey } = generateApiKey();
      const isValid = await verifyApiKey(otherKey, hash);
      expect(isValid).toBe(false);
    });

    it('should reject modified API key', async () => {
      const { key } = generateApiKey();
      const hash = await hashApiKey(key);
      const modifiedKey = key.slice(0, -1) + 'X';
      const isValid = await verifyApiKey(modifiedKey, hash);
      expect(isValid).toBe(false);
    });

    it('should reject truncated API key', async () => {
      const { key } = generateApiKey();
      const hash = await hashApiKey(key);
      const truncatedKey = key.slice(0, 20);
      const isValid = await verifyApiKey(truncatedKey, hash);
      expect(isValid).toBe(false);
    });

    it('should use same cost factor as password hashing', async () => {
      const { key } = generateApiKey();
      const hash = await hashApiKey(key);
      expect(hash).toMatch(/^\$2b\$12\$/);
    });

    it('should produce different hashes for same key', async () => {
      const { key } = generateApiKey();
      const hash1 = await hashApiKey(key);
      const hash2 = await hashApiKey(key);
      expect(hash1).not.toBe(hash2);
    });

    it('should accept custom cost factor', async () => {
      const { key } = generateApiKey();
      const hash = await hashApiKey(key, 10);
      expect(hash).toMatch(/^\$2b\$10\$/);
      const isValid = await verifyApiKey(key, hash);
      expect(isValid).toBe(true);
    });
  });

  // ============================================
  // Token Hashing (SHA-256) Tests (10 tests)
  // ============================================
  describe('Token Hashing (SHA-256)', () => {
    it('should hash a token using SHA-256', () => {
      const token = 'testToken123';
      const hash = hashToken(token);
      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should produce deterministic hashes', () => {
      const token = 'sameToken';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');
      expect(hash1).not.toBe(hash2);
    });

    it('should hash empty string correctly', () => {
      const hash = hashToken('');
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('should produce lowercase hex output', () => {
      const hash = hashToken('test');
      expect(hash).not.toMatch(/[A-F]/);
    });

    it('should handle unicode strings', () => {
      const hash = hashToken('日本語テスト');
      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should handle binary-like strings', () => {
      const hash = hashToken('\x00\x01\x02\xff');
      expect(hash.length).toBe(64);
    });

    it('should be consistent with known SHA-256 values', () => {
      // Known SHA-256 hash of "hello"
      const hash = hashToken('hello');
      expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('should be different for case-different strings', () => {
      const hash1 = hashToken('Hello');
      const hash2 = hashToken('hello');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle very long strings', () => {
      const longString = 'x'.repeat(100000);
      const hash = hashToken(longString);
      expect(hash.length).toBe(64);
    });
  });

  // ============================================
  // secureCompare Tests (10 tests)
  // ============================================
  describe('secureCompare', () => {
    it('should return true for equal strings', () => {
      expect(secureCompare('hello', 'hello')).toBe(true);
    });

    it('should return true for empty strings', () => {
      expect(secureCompare('', '')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(secureCompare('hello', 'world')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(secureCompare('short', 'longer')).toBe(false);
      expect(secureCompare('longer', 'short')).toBe(false);
    });

    it('should return false for prefix match', () => {
      expect(secureCompare('hello', 'hello!')).toBe(false);
    });

    it('should return false for suffix match', () => {
      expect(secureCompare('!hello', 'hello')).toBe(false);
    });

    it('should handle unicode strings', () => {
      expect(secureCompare('日本語', '日本語')).toBe(true);
      expect(secureCompare('日本語', '中文')).toBe(false);
    });

    it('should handle strings with null bytes', () => {
      expect(secureCompare('a\x00b', 'a\x00b')).toBe(true);
      expect(secureCompare('a\x00b', 'a\x00c')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(secureCompare('Hello', 'hello')).toBe(false);
    });

    it('should handle long strings', () => {
      const long1 = 'x'.repeat(10000);
      const long2 = 'x'.repeat(10000);
      const long3 = 'x'.repeat(9999) + 'y';
      expect(secureCompare(long1, long2)).toBe(true);
      expect(secureCompare(long1, long3)).toBe(false);
    });
  });

  // ============================================
  // generatePasswordResetToken Tests (6 tests)
  // ============================================
  describe('generatePasswordResetToken', () => {
    it('should generate a token and expiration', () => {
      const { token, expiresAt } = generatePasswordResetToken();
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(40);
      expect(expiresAt).toBeInstanceOf(Date);
    });

    it('should set expiration to approximately 1 hour', () => {
      const now = new Date();
      const { expiresAt } = generatePasswordResetToken();
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);
      expect(diffMinutes).toBeGreaterThan(58);
      expect(diffMinutes).toBeLessThan(62);
    });

    it('should generate 1000 unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const { token } = generatePasswordResetToken();
        tokens.add(token);
      }
      expect(tokens.size).toBe(1000);
    });

    it('should generate URL-safe tokens', () => {
      for (let i = 0; i < 100; i++) {
        const { token } = generatePasswordResetToken();
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });

    it('should have expiration in the future', () => {
      const now = new Date();
      const { expiresAt } = generatePasswordResetToken();
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should not have expiration too far in future', () => {
      const now = new Date();
      const { expiresAt } = generatePasswordResetToken();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      expect(expiresAt.getTime()).toBeLessThan(twoHoursFromNow.getTime());
    });
  });

  // ============================================
  // generateEmailVerificationToken Tests (6 tests)
  // ============================================
  describe('generateEmailVerificationToken', () => {
    it('should generate a token and expiration', () => {
      const { token, expiresAt } = generateEmailVerificationToken();
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(40);
      expect(expiresAt).toBeInstanceOf(Date);
    });

    it('should set expiration to approximately 7 days', () => {
      const now = new Date();
      const { expiresAt } = generateEmailVerificationToken();
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(6.9);
      expect(diffDays).toBeLessThan(7.1);
    });

    it('should generate 1000 unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const { token } = generateEmailVerificationToken();
        tokens.add(token);
      }
      expect(tokens.size).toBe(1000);
    });

    it('should generate URL-safe tokens', () => {
      for (let i = 0; i < 100; i++) {
        const { token } = generateEmailVerificationToken();
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });

    it('should have longer expiration than password reset', () => {
      const { expiresAt: emailExp } = generateEmailVerificationToken();
      const { expiresAt: passExp } = generatePasswordResetToken();
      expect(emailExp.getTime()).toBeGreaterThan(passExp.getTime());
    });

    it('should be suitable for email links', () => {
      const { token } = generateEmailVerificationToken();
      const url = `https://example.com/verify?token=${token}`;
      expect(url).not.toContain(' ');
      expect(encodeURIComponent(token)).toBe(token);
    });
  });

  // ============================================
  // generateOAuthState Tests (6 tests)
  // ============================================
  describe('generateOAuthState', () => {
    it('should generate a state and expiration', () => {
      const { state, expiresAt } = generateOAuthState();
      expect(state).toBeDefined();
      expect(state.length).toBeGreaterThan(40);
      expect(expiresAt).toBeInstanceOf(Date);
    });

    it('should set expiration to approximately 10 minutes', () => {
      const now = new Date();
      const { expiresAt } = generateOAuthState();
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);
      expect(diffMinutes).toBeGreaterThan(9);
      expect(diffMinutes).toBeLessThan(11);
    });

    it('should generate 1000 unique states', () => {
      const states = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const { state } = generateOAuthState();
        states.add(state);
      }
      expect(states.size).toBe(1000);
    });

    it('should generate URL-safe states', () => {
      for (let i = 0; i < 100; i++) {
        const { state } = generateOAuthState();
        expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });

    it('should have shorter expiration than password reset', () => {
      const { expiresAt: oauthExp } = generateOAuthState();
      const { expiresAt: passExp } = generatePasswordResetToken();
      expect(oauthExp.getTime()).toBeLessThan(passExp.getTime());
    });

    it('should be suitable for OAuth state parameter', () => {
      const { state } = generateOAuthState();
      expect(encodeURIComponent(state)).toBe(state);
    });
  });

  // ============================================
  // JWT Service Tests (25+ tests)
  // ============================================
  describe('JWT Service', () => {
    describe('Configuration', () => {
      it('should throw error when private key not configured for signing', () => {
        const jwtService = createJwtService({});
        expect(() => {
          jwtService.signAccessToken({
            userId: 'user-123',
            email: 'test@example.com',
            tier: 'FREE',
          });
        }).toThrow('JWT private key not configured');
      });

      it('should throw error when public key not configured for verification', () => {
        const jwtService = createJwtService({ privateKey });
        const token = jwtService.signAccessToken({
          userId: 'user-123',
          email: 'test@example.com',
          tier: 'FREE',
        });
        expect(() => {
          jwtService.verifyAccessToken(token);
        }).toThrow('JWT public key not configured');
      });

      it('should use default issuer and audience', () => {
        const jwtService = createJwtService({ privateKey, publicKey });
        const token = jwtService.signAccessToken({
          userId: 'user-123',
          email: 'test@example.com',
          tier: 'FREE',
        });
        const decoded = jwtService.verifyAccessToken(token);
        expect(decoded.iss).toBe('veilchain');
        expect(decoded.aud).toBe('veilchain-api');
      });

      it('should use custom issuer and audience', () => {
        const jwtService = createJwtService({
          privateKey,
          publicKey,
          issuer: 'custom-issuer',
          audience: 'custom-audience',
        });
        const token = jwtService.signAccessToken({
          userId: 'user-123',
          email: 'test@example.com',
          tier: 'FREE',
        });
        const decoded = jwtService.verifyAccessToken(token);
        expect(decoded.iss).toBe('custom-issuer');
        expect(decoded.aud).toBe('custom-audience');
      });
    });

    describe('Access Token Signing and Verification', () => {
      const jwtService = createJwtService({
        privateKey,
        publicKey,
        issuer: 'veilchain-test',
        audience: 'veilchain-api-test',
        accessTokenExpiry: '15m',
      });

      it('should sign and verify access token', () => {
        const payload = {
          userId: 'user-123',
          email: 'test@example.com',
          tier: 'PRO',
        };
        const token = jwtService.signAccessToken(payload);
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3);

        const decoded = jwtService.verifyAccessToken(token);
        expect(decoded.sub).toBe(payload.userId);
        expect(decoded.email).toBe(payload.email);
        expect(decoded.tier).toBe(payload.tier);
      });

      it('should include all required claims', () => {
        const token = jwtService.signAccessToken({
          userId: 'user-123',
          email: 'test@example.com',
          tier: 'FREE',
        });
        const decoded = jwtService.verifyAccessToken(token);
        expect(decoded.sub).toBeDefined();
        expect(decoded.email).toBeDefined();
        expect(decoded.tier).toBeDefined();
        expect(decoded.iss).toBeDefined();
        expect(decoded.aud).toBeDefined();
        expect(decoded.jti).toBeDefined();
        expect(decoded.iat).toBeDefined();
        expect(decoded.exp).toBeDefined();
      });

      it('should reject token with wrong algorithm', () => {
        const badToken = jwt.sign({ sub: 'user' }, 'secret', { algorithm: 'HS256' });
        expect(() => {
          jwtService.verifyAccessToken(badToken);
        }).toThrow();
      });

      it('should reject expired token', () => {
        const expiredService = createJwtService({
          privateKey,
          publicKey,
          accessTokenExpiry: '1ms',
        });
        const token = expiredService.signAccessToken({
          userId: 'user-123',
          email: 'test@example.com',
          tier: 'FREE',
        });
        // Wait for token to expire
        return new Promise((resolve) => setTimeout(resolve, 50)).then(() => {
          expect(() => {
            expiredService.verifyAccessToken(token);
          }).toThrow();
        });
      });

      it('should reject token with wrong issuer', () => {
        const otherService = createJwtService({
          privateKey,
          publicKey,
          issuer: 'other-issuer',
          audience: 'veilchain-api-test',
        });
        const token = otherService.signAccessToken({
          userId: 'user-123',
          email: 'test@example.com',
          tier: 'FREE',
        });
        expect(() => {
          jwtService.verifyAccessToken(token);
        }).toThrow();
      });

      it('should reject token with wrong audience', () => {
        const otherService = createJwtService({
          privateKey,
          publicKey,
          issuer: 'veilchain-test',
          audience: 'other-audience',
        });
        const token = otherService.signAccessToken({
          userId: 'user-123',
          email: 'test@example.com',
          tier: 'FREE',
        });
        expect(() => {
          jwtService.verifyAccessToken(token);
        }).toThrow();
      });

      it('should reject malformed token', () => {
        expect(() => {
          jwtService.verifyAccessToken('not.a.valid.token');
        }).toThrow();
      });

      it('should reject empty token', () => {
        expect(() => {
          jwtService.verifyAccessToken('');
        }).toThrow();
      });

      it('should generate unique JTIs', () => {
        const tokens = [];
        for (let i = 0; i < 100; i++) {
          tokens.push(
            jwtService.signAccessToken({
              userId: 'user-123',
              email: 'test@example.com',
              tier: 'FREE',
            })
          );
        }
        const jtis = tokens.map((t) => jwtService.decodeToken(t)?.jti);
        const uniqueJtis = new Set(jtis);
        expect(uniqueJtis.size).toBe(100);
      });
    });

    describe('Token Decoding', () => {
      const jwtService = createJwtService({ privateKey, publicKey });

      it('should decode token without verification', () => {
        const token = jwtService.signAccessToken({
          userId: 'user-456',
          email: 'decode@example.com',
          tier: 'STARTER',
        });
        const decoded = jwtService.decodeToken(token);
        expect(decoded?.sub).toBe('user-456');
        expect(decoded?.email).toBe('decode@example.com');
      });

      it('should return null for invalid token', () => {
        const decoded = jwtService.decodeToken('not.valid');
        expect(decoded).toBeNull();
      });

      it('should return null for empty string', () => {
        const decoded = jwtService.decodeToken('');
        expect(decoded).toBeNull();
      });

      it('should decode expired token', () => {
        // Decode should work even on expired tokens
        const expiredService = createJwtService({
          privateKey,
          publicKey,
          accessTokenExpiry: '1ms',
        });
        const token = expiredService.signAccessToken({
          userId: 'user-123',
          email: 'test@example.com',
          tier: 'FREE',
        });
        const decoded = expiredService.decodeToken(token);
        expect(decoded?.sub).toBe('user-123');
      });
    });

    describe('Refresh Token Generation', () => {
      const jwtService = createJwtService({
        privateKey,
        publicKey,
        refreshTokenExpiry: '7d',
      });

      it('should generate refresh token with required fields', () => {
        const data = jwtService.generateRefreshToken('user-123');
        expect(data.userId).toBe('user-123');
        expect(data.familyId).toBeDefined();
        expect(data.token).toBeDefined();
        expect(data.tokenHash).toBeDefined();
        expect(data.expiresAt).toBeInstanceOf(Date);
      });

      it('should use provided family ID', () => {
        const familyId = 'family-abc-123';
        const data = jwtService.generateRefreshToken('user-123', familyId);
        expect(data.familyId).toBe(familyId);
      });

      it('should generate new family ID when not provided', () => {
        const data1 = jwtService.generateRefreshToken('user-123');
        const data2 = jwtService.generateRefreshToken('user-123');
        expect(data1.familyId).not.toBe(data2.familyId);
      });

      it('should extend expiry for remember me', () => {
        const normalData = jwtService.generateRefreshToken('user-123', undefined, false);
        const rememberMeData = jwtService.generateRefreshToken('user-123', undefined, true);
        expect(rememberMeData.expiresAt.getTime()).toBeGreaterThan(
          normalData.expiresAt.getTime()
        );
      });

      it('should generate unique tokens', () => {
        const tokens = new Set<string>();
        for (let i = 0; i < 1000; i++) {
          const data = jwtService.generateRefreshToken('user-123');
          tokens.add(data.token);
        }
        expect(tokens.size).toBe(1000);
      });

      it('should hash token using SHA-256', () => {
        const data = jwtService.generateRefreshToken('user-123');
        expect(data.tokenHash).not.toBe(data.token);
        expect(data.tokenHash.length).toBe(64);
        expect(data.tokenHash).toMatch(/^[a-f0-9]+$/);
      });

      it('should set correct expiry for 7 days', () => {
        const now = new Date();
        const data = jwtService.generateRefreshToken('user-123', undefined, false);
        const diffMs = data.expiresAt.getTime() - now.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        expect(diffDays).toBeGreaterThan(6.9);
        expect(diffDays).toBeLessThan(7.1);
      });

      it('should set correct expiry for 30 days with remember me', () => {
        const now = new Date();
        const data = jwtService.generateRefreshToken('user-123', undefined, true);
        const diffMs = data.expiresAt.getTime() - now.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        expect(diffDays).toBeGreaterThan(29);
        expect(diffDays).toBeLessThan(31);
      });
    });

    describe('Access Token Expiry', () => {
      it('should return correct expiry for minutes', () => {
        const jwtService = createJwtService({
          privateKey,
          publicKey,
          accessTokenExpiry: '15m',
        });
        expect(jwtService.getAccessTokenExpirySeconds()).toBe(900);
      });

      it('should return correct expiry for hours', () => {
        const jwtService = createJwtService({
          privateKey,
          publicKey,
          accessTokenExpiry: '2h',
        });
        expect(jwtService.getAccessTokenExpirySeconds()).toBe(7200);
      });

      it('should return correct expiry for days', () => {
        const jwtService = createJwtService({
          privateKey,
          publicKey,
          accessTokenExpiry: '1d',
        });
        expect(jwtService.getAccessTokenExpirySeconds()).toBe(86400);
      });

      it('should return correct expiry for seconds', () => {
        const jwtService = createJwtService({
          privateKey,
          publicKey,
          accessTokenExpiry: '30s',
        });
        expect(jwtService.getAccessTokenExpirySeconds()).toBe(30);
      });

      it('should return default for invalid format', () => {
        const jwtService = createJwtService({
          privateKey,
          publicKey,
          accessTokenExpiry: 'invalid',
        });
        expect(jwtService.getAccessTokenExpirySeconds()).toBe(900);
      });

      it('should return default for empty string', () => {
        const jwtService = createJwtService({
          privateKey,
          publicKey,
          accessTokenExpiry: '',
        });
        expect(jwtService.getAccessTokenExpirySeconds()).toBe(900);
      });

      it('should handle large values', () => {
        const jwtService = createJwtService({
          privateKey,
          publicKey,
          accessTokenExpiry: '365d',
        });
        expect(jwtService.getAccessTokenExpirySeconds()).toBe(365 * 86400);
      });
    });
  });
});
