/**
 * VeilChain User Service Tests - Phase 4
 *
 * Comprehensive tests for user CRUD operations, validation, and edge cases.
 * Uses injectable mock pool for isolated testing.
 */

import { jest } from '@jest/globals';
import { UserService } from '../../src/services/user.js';
import type { User, UserTier } from '../../src/types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = jest.Mock<any>;

// Create a mock pool factory
function createMockPool() {
  const mockQuery = jest.fn() as MockFn;
  return {
    query: mockQuery,
    _mockQuery: mockQuery,
  };
}

describe('User Service - Phase 4', () => {
  let userService: UserService;
  let mockPool: ReturnType<typeof createMockPool>;
  let mockQuery: MockFn;

  beforeEach(() => {
    mockPool = createMockPool();
    mockQuery = mockPool._mockQuery;
    userService = new UserService(mockPool as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // User Creation Tests (15 tests)
  // ============================================
  describe('create', () => {
    const baseUserRow = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      password_hash: null,
      email_verified: false,
      email_verification_token: null,
      email_verification_expires: null,
      password_reset_token: null,
      password_reset_expires: null,
      oauth_provider: null,
      oauth_provider_id: null,
      avatar_url: null,
      tier: 'FREE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: null,
    };

    it('should create a user with minimal data', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [baseUserRow] });

      const user = await userService.create({ email: 'test@example.com' });

      expect(user.id).toBe('user-123');
      expect(user.email).toBe('test@example.com');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should create a user with all optional fields', async () => {
      const fullUserRow = {
        ...baseUserRow,
        name: 'Full User',
        password_hash: '$2b$12$hash',
        email_verified: true,
        avatar_url: 'https://example.com/avatar.jpg',
      };
      mockQuery.mockResolvedValueOnce({ rows: [fullUserRow] });

      const user = await userService.create({
        email: 'full@example.com',
        name: 'Full User',
        passwordHash: '$2b$12$hash',
        emailVerified: true,
        avatarUrl: 'https://example.com/avatar.jpg',
      });

      expect(user.name).toBe('Full User');
      expect(user.passwordHash).toBe('$2b$12$hash');
      expect(user.emailVerified).toBe(true);
    });

    it('should lowercase email on creation', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, email: 'test@example.com' }] });

      await userService.create({ email: 'TEST@EXAMPLE.COM' });

      const queryCall = mockQuery.mock.calls[0] as unknown[];
      expect((queryCall[1] as unknown[])[1]).toBe('test@example.com');
    });

    it('should create OAuth user without password', async () => {
      const oauthRow = {
        ...baseUserRow,
        oauth_provider: 'github',
        oauth_provider_id: 'gh-123',
        email_verified: true,
      };
      mockQuery.mockResolvedValueOnce({ rows: [oauthRow] });

      const user = await userService.create({
        email: 'oauth@example.com',
        oauthProvider: 'github',
        oauthProviderId: 'gh-123',
        emailVerified: true,
      });

      expect(user.oauthProvider).toBe('github');
      expect(user.oauthProviderId).toBe('gh-123');
      expect(user.passwordHash).toBeFalsy();
    });

    it('should set default tier to FREE', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [baseUserRow] });

      const user = await userService.create({ email: 'test@example.com' });

      expect(user.tier).toBe('FREE');
    });

    it('should include email verification token when provided', async () => {
      const userWithToken = {
        ...baseUserRow,
        email_verification_token: 'token-123',
        email_verification_expires: new Date(Date.now() + 86400000).toISOString(),
      };
      mockQuery.mockResolvedValueOnce({ rows: [userWithToken] });

      const user = await userService.create({
        email: 'test@example.com',
        emailVerificationToken: 'token-123',
        emailVerificationExpires: new Date(Date.now() + 86400000),
      });

      expect(user.emailVerificationToken).toBe('token-123');
    });

    it('should handle database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(userService.create({ email: 'test@example.com' })).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle duplicate email error', async () => {
      const duplicateError = new Error('duplicate key value violates unique constraint');
      mockQuery.mockRejectedValueOnce(duplicateError);

      await expect(userService.create({ email: 'existing@example.com' })).rejects.toThrow();
    });

    it('should generate unique ID for each user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, id: 'user-1' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, id: 'user-2' }] });

      await userService.create({ email: 'user1@example.com' });
      await userService.create({ email: 'user2@example.com' });

      // Check that different IDs were generated (passed to query)
      const calls = mockQuery.mock.calls as unknown[][];
      expect((calls[0][1] as unknown[])[0]).not.toBe((calls[1][1] as unknown[])[0]);
    });

    it('should set created_at and updated_at to current time', async () => {
      const now = new Date();
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, created_at: now.toISOString(), updated_at: now.toISOString() }] });

      const user = await userService.create({ email: 'test@example.com' });

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle null name', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, name: null }] });

      const user = await userService.create({ email: 'test@example.com' });

      expect(user.name).toBeFalsy();
    });

    it('should handle Google OAuth user', async () => {
      const googleRow = {
        ...baseUserRow,
        oauth_provider: 'google',
        oauth_provider_id: 'google-123',
      };
      mockQuery.mockResolvedValueOnce({ rows: [googleRow] });

      const user = await userService.create({
        email: 'google@example.com',
        oauthProvider: 'google',
        oauthProviderId: 'google-123',
      });

      expect(user.oauthProvider).toBe('google');
    });

    it('should create user with avatar URL', async () => {
      const avatarRow = { ...baseUserRow, avatar_url: 'https://cdn.example.com/avatar.png' };
      mockQuery.mockResolvedValueOnce({ rows: [avatarRow] });

      const user = await userService.create({
        email: 'test@example.com',
        avatarUrl: 'https://cdn.example.com/avatar.png',
      });

      expect(user.avatarUrl).toBe('https://cdn.example.com/avatar.png');
    });

    it('should create user with email already verified', async () => {
      const verifiedRow = { ...baseUserRow, email_verified: true };
      mockQuery.mockResolvedValueOnce({ rows: [verifiedRow] });

      const user = await userService.create({
        email: 'verified@example.com',
        emailVerified: true,
      });

      expect(user.emailVerified).toBe(true);
    });

    it('should handle empty name string', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, name: '' }] });

      const user = await userService.create({ email: 'test@example.com', name: '' });

      expect(user.name).toBe('');
    });
  });

  // ============================================
  // User Retrieval Tests (12 tests)
  // ============================================
  describe('getById', () => {
    const userRow = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      password_hash: '$2b$12$hash',
      email_verified: true,
      email_verification_token: null,
      email_verification_expires: null,
      password_reset_token: null,
      password_reset_expires: null,
      oauth_provider: null,
      oauth_provider_id: null,
      avatar_url: null,
      tier: 'PRO',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    };

    it('should return user when found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [userRow] });

      const user = await userService.getById('user-123');

      expect(user).not.toBeNull();
      expect(user?.id).toBe('user-123');
      expect(user?.email).toBe('test@example.com');
    });

    it('should return null when user not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const user = await userService.getById('nonexistent');

      expect(user).toBeNull();
    });

    it('should map all user fields correctly', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [userRow] });

      const user = await userService.getById('user-123');

      expect(user?.passwordHash).toBe('$2b$12$hash');
      expect(user?.emailVerified).toBe(true);
      expect(user?.tier).toBe('PRO');
      expect(user?.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection lost'));

      await expect(userService.getById('user-123')).rejects.toThrow('Connection lost');
    });
  });

  describe('getByEmail', () => {
    const userRow = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      password_hash: '$2b$12$hash',
      email_verified: true,
      email_verification_token: null,
      email_verification_expires: null,
      password_reset_token: null,
      password_reset_expires: null,
      oauth_provider: null,
      oauth_provider_id: null,
      avatar_url: null,
      tier: 'FREE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: null,
    };

    it('should find user by email', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [userRow] });

      const user = await userService.getByEmail('test@example.com');

      expect(user?.email).toBe('test@example.com');
    });

    it('should lowercase email before lookup', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [userRow] });

      await userService.getByEmail('TEST@EXAMPLE.COM');

      const calls = mockQuery.mock.calls as unknown[][];
      expect((calls[0][1] as unknown[])[0]).toBe('test@example.com');
    });

    it('should return null when email not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const user = await userService.getByEmail('notfound@example.com');

      expect(user).toBeNull();
    });

    it('should handle special characters in email', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...userRow, email: "test+tag@example.com" }] });

      const user = await userService.getByEmail('test+tag@example.com');

      expect(user?.email).toBe('test+tag@example.com');
    });
  });

  describe('getByOAuth', () => {
    const oauthUserRow = {
      id: 'oauth-user-123',
      email: 'oauth@example.com',
      name: 'OAuth User',
      password_hash: null,
      email_verified: true,
      email_verification_token: null,
      email_verification_expires: null,
      password_reset_token: null,
      password_reset_expires: null,
      oauth_provider: 'github',
      oauth_provider_id: 'gh-456',
      avatar_url: 'https://github.com/avatar.jpg',
      tier: 'FREE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: null,
    };

    it('should find user by OAuth credentials', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [oauthUserRow] });

      const user = await userService.getByOAuth('github', 'gh-456');

      expect(user?.oauthProvider).toBe('github');
      expect(user?.oauthProviderId).toBe('gh-456');
    });

    it('should return null when OAuth user not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const user = await userService.getByOAuth('github', 'nonexistent');

      expect(user).toBeNull();
    });

    it('should distinguish between providers', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const user = await userService.getByOAuth('google', 'gh-456');

      expect(user).toBeNull();
    });
  });

  describe('getByEmailVerificationToken', () => {
    it('should find user by valid verification token', async () => {
      const userRow = {
        id: 'user-123',
        email: 'test@example.com',
        name: null,
        password_hash: '$2b$12$hash',
        email_verified: false,
        email_verification_token: 'valid-token',
        email_verification_expires: new Date(Date.now() + 86400000).toISOString(),
        password_reset_token: null,
        password_reset_expires: null,
        oauth_provider: null,
        oauth_provider_id: null,
        avatar_url: null,
        tier: 'FREE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login_at: null,
      };
      mockQuery.mockResolvedValueOnce({ rows: [userRow] });

      const user = await userService.getByEmailVerificationToken('valid-token');

      expect(user?.emailVerificationToken).toBe('valid-token');
    });

    it('should return null for expired token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const user = await userService.getByEmailVerificationToken('expired-token');

      expect(user).toBeNull();
    });
  });

  describe('getByPasswordResetToken', () => {
    it('should find user by valid reset token', async () => {
      const userRow = {
        id: 'user-123',
        email: 'test@example.com',
        name: null,
        password_hash: '$2b$12$hash',
        email_verified: true,
        email_verification_token: null,
        email_verification_expires: null,
        password_reset_token: 'reset-token',
        password_reset_expires: new Date(Date.now() + 3600000).toISOString(),
        oauth_provider: null,
        oauth_provider_id: null,
        avatar_url: null,
        tier: 'FREE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login_at: null,
      };
      mockQuery.mockResolvedValueOnce({ rows: [userRow] });

      const user = await userService.getByPasswordResetToken('reset-token');

      expect(user?.passwordResetToken).toBe('reset-token');
    });

    it('should return null for expired reset token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const user = await userService.getByPasswordResetToken('expired-reset-token');

      expect(user).toBeNull();
    });
  });

  // ============================================
  // User Update Tests (15 tests)
  // ============================================
  describe('update', () => {
    const baseUserRow = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      password_hash: '$2b$12$hash',
      email_verified: true,
      email_verification_token: null,
      email_verification_expires: null,
      password_reset_token: null,
      password_reset_expires: null,
      oauth_provider: null,
      oauth_provider_id: null,
      avatar_url: null,
      tier: 'FREE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: null,
    };

    it('should update user name', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, name: 'New Name' }] });

      const user = await userService.update('user-123', { name: 'New Name' });

      expect(user?.name).toBe('New Name');
    });

    it('should update user tier', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, tier: 'PRO' }] });

      const user = await userService.update('user-123', { tier: 'PRO' });

      expect(user?.tier).toBe('PRO');
    });

    it('should update email verified status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, email_verified: true }] });

      const user = await userService.update('user-123', { emailVerified: true });

      expect(user?.emailVerified).toBe(true);
    });

    it('should update avatar URL', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, avatar_url: 'https://new-avatar.com' }] });

      const user = await userService.update('user-123', { avatarUrl: 'https://new-avatar.com' });

      expect(user?.avatarUrl).toBe('https://new-avatar.com');
    });

    it('should update password hash', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, password_hash: '$2b$12$newhash' }] });

      const user = await userService.update('user-123', { passwordHash: '$2b$12$newhash' });

      expect(user?.passwordHash).toBe('$2b$12$newhash');
    });

    it('should clear email verification token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, email_verification_token: null }] });

      const user = await userService.update('user-123', { emailVerificationToken: null });

      expect(user?.emailVerificationToken).toBeFalsy();
    });

    it('should clear password reset token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, password_reset_token: null }] });

      const user = await userService.update('user-123', { passwordResetToken: null });

      expect(user?.passwordResetToken).toBeFalsy();
    });

    it('should update multiple fields at once', async () => {
      const updatedRow = {
        ...baseUserRow,
        name: 'Updated Name',
        tier: 'ENTERPRISE',
        avatar_url: 'https://new-avatar.com',
      };
      mockQuery.mockResolvedValueOnce({ rows: [updatedRow] });

      const user = await userService.update('user-123', {
        name: 'Updated Name',
        tier: 'ENTERPRISE',
        avatarUrl: 'https://new-avatar.com',
      });

      expect(user?.name).toBe('Updated Name');
      expect(user?.tier).toBe('ENTERPRISE');
      expect(user?.avatarUrl).toBe('https://new-avatar.com');
    });

    it('should return null when user not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const user = await userService.update('nonexistent', { name: 'New Name' });

      expect(user).toBeNull();
    });

    it('should return existing user when no updates provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [baseUserRow] });

      const user = await userService.update('user-123', {});

      expect(user?.id).toBe('user-123');
    });

    it('should update lastLoginAt', async () => {
      const newLoginDate = new Date();
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseUserRow, last_login_at: newLoginDate.toISOString() }] });

      const user = await userService.update('user-123', { lastLoginAt: newLoginDate });

      expect(user?.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should handle database errors on update', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Update failed'));

      await expect(userService.update('user-123', { name: 'New' })).rejects.toThrow('Update failed');
    });

    it('should update password reset token with expiry', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      mockQuery.mockResolvedValueOnce({
        rows: [{
          ...baseUserRow,
          password_reset_token: 'new-reset-token',
          password_reset_expires: expiresAt.toISOString(),
        }]
      });

      const user = await userService.update('user-123', {
        passwordResetToken: 'new-reset-token',
        passwordResetExpires: expiresAt,
      });

      expect(user?.passwordResetToken).toBe('new-reset-token');
      expect(user?.passwordResetExpires).toBeInstanceOf(Date);
    });

    it('should update email verification token with expiry', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      mockQuery.mockResolvedValueOnce({
        rows: [{
          ...baseUserRow,
          email_verification_token: 'new-verify-token',
          email_verification_expires: expiresAt.toISOString(),
        }]
      });

      const user = await userService.update('user-123', {
        emailVerificationToken: 'new-verify-token',
        emailVerificationExpires: expiresAt,
      });

      expect(user?.emailVerificationToken).toBe('new-verify-token');
    });

    it('should update updated_at timestamp automatically', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [baseUserRow] });

      await userService.update('user-123', { name: 'New Name' });

      const queryCall = mockQuery.mock.calls[0][0];
      expect(queryCall).toContain('updated_at = NOW()');
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await userService.updateLastLogin('user-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('last_login_at = NOW()'),
        ['user-123']
      );
    });

    it('should also update updated_at', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await userService.updateLastLogin('user-123');

      expect(mockQuery.mock.calls[0][0]).toContain('updated_at = NOW()');
    });
  });

  // ============================================
  // User Deletion Tests (5 tests)
  // ============================================
  describe('delete', () => {
    it('should delete user and return true', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await userService.delete('user-123');

      expect(result).toBe(true);
    });

    it('should return false when user not found', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await userService.delete('nonexistent');

      expect(result).toBe(false);
    });

    it('should execute DELETE query', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await userService.delete('user-123');

      expect(mockQuery.mock.calls[0][0]).toContain('DELETE FROM users');
    });

    it('should handle database errors on delete', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Constraint violation'));

      await expect(userService.delete('user-123')).rejects.toThrow('Constraint violation');
    });

    it('should handle null rowCount', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: null });

      const result = await userService.delete('user-123');

      expect(result).toBe(false);
    });
  });

  // ============================================
  // Email Existence Check Tests (5 tests)
  // ============================================
  describe('emailExists', () => {
    it('should return true when email exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

      const exists = await userService.emailExists('existing@example.com');

      expect(exists).toBe(true);
    });

    it('should return false when email does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const exists = await userService.emailExists('new@example.com');

      expect(exists).toBe(false);
    });

    it('should lowercase email before checking', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await userService.emailExists('TEST@EXAMPLE.COM');

      const calls = mockQuery.mock.calls as unknown[][];
      expect((calls[0][1] as unknown[])[0]).toBe('test@example.com');
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'));

      await expect(userService.emailExists('test@example.com')).rejects.toThrow('Query failed');
    });

    it('should handle special characters in email', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

      const exists = await userService.emailExists("user+tag@example.com");

      expect(exists).toBe(true);
    });
  });

  // ============================================
  // toPublic Conversion Tests (8 tests)
  // ============================================
  describe('toPublic', () => {
    const fullUser: User = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: '$2b$12$secrethash',
      emailVerified: true,
      emailVerificationToken: 'secret-token',
      emailVerificationExpires: new Date(),
      passwordResetToken: 'reset-secret',
      passwordResetExpires: new Date(),
      oauthProvider: 'github',
      oauthProviderId: 'gh-123',
      avatarUrl: 'https://example.com/avatar.jpg',
      tier: 'PRO' as UserTier,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    };

    it('should include public fields', () => {
      const publicUser = userService.toPublic(fullUser);

      expect(publicUser.id).toBe('user-123');
      expect(publicUser.email).toBe('test@example.com');
      expect(publicUser.name).toBe('Test User');
      expect(publicUser.emailVerified).toBe(true);
      expect(publicUser.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(publicUser.tier).toBe('PRO');
      expect(publicUser.createdAt).toBeInstanceOf(Date);
      expect(publicUser.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should exclude password hash', () => {
      const publicUser = userService.toPublic(fullUser);

      expect((publicUser as any).passwordHash).toBeUndefined();
    });

    it('should exclude email verification token', () => {
      const publicUser = userService.toPublic(fullUser);

      expect((publicUser as any).emailVerificationToken).toBeUndefined();
    });

    it('should exclude password reset token', () => {
      const publicUser = userService.toPublic(fullUser);

      expect((publicUser as any).passwordResetToken).toBeUndefined();
    });

    it('should exclude OAuth provider ID', () => {
      const publicUser = userService.toPublic(fullUser);

      expect((publicUser as any).oauthProviderId).toBeUndefined();
    });

    it('should exclude updatedAt', () => {
      const publicUser = userService.toPublic(fullUser);

      expect((publicUser as any).updatedAt).toBeUndefined();
    });

    it('should handle undefined optional fields', () => {
      const minimalUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: false,
        tier: 'FREE' as UserTier,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const publicUser = userService.toPublic(minimalUser);

      expect(publicUser.name).toBeUndefined();
      expect(publicUser.avatarUrl).toBeUndefined();
      expect(publicUser.lastLoginAt).toBeUndefined();
    });

    it('should preserve date objects', () => {
      const publicUser = userService.toPublic(fullUser);

      expect(publicUser.createdAt).toBeInstanceOf(Date);
      expect(publicUser.lastLoginAt).toBeInstanceOf(Date);
    });
  });
});
