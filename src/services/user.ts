/**
 * VeilChain User Service
 *
 * Manages user CRUD operations with PostgreSQL storage.
 */

import { Pool } from 'pg';
import type { User, UserPublic, UserTier, OAuthProvider } from '../types.js';
import { generateId } from './crypto.js';

/**
 * User creation options
 */
export interface CreateUserOptions {
  email: string;
  name?: string;
  passwordHash?: string;
  oauthProvider?: OAuthProvider;
  oauthProviderId?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
}

/**
 * User update options
 */
export interface UpdateUserOptions {
  name?: string;
  avatarUrl?: string;
  tier?: UserTier;
  emailVerified?: boolean;
  emailVerificationToken?: string | null;
  emailVerificationExpires?: Date | null;
  passwordHash?: string;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  lastLoginAt?: Date;
}

/**
 * User service for managing user accounts
 */
export class UserService {
  constructor(private readonly pool: Pool) {}

  /**
   * Create a new user
   */
  async create(options: CreateUserOptions): Promise<User> {
    const id = generateId();
    const now = new Date();

    const result = await this.pool.query(
      `INSERT INTO users (
        id, email, name, password_hash, email_verified,
        email_verification_token, email_verification_expires,
        oauth_provider, oauth_provider_id, avatar_url,
        tier, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        id,
        options.email.toLowerCase(),
        options.name || null,
        options.passwordHash || null,
        options.emailVerified ?? false,
        options.emailVerificationToken || null,
        options.emailVerificationExpires || null,
        options.oauthProvider || null,
        options.oauthProviderId || null,
        options.avatarUrl || null,
        'FREE',
        now,
        now,
      ]
    );

    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Get user by ID
   */
  async getById(id: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Get user by email
   */
  async getByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Get user by OAuth provider credentials
   */
  async getByOAuth(provider: OAuthProvider, providerId: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_provider_id = $2',
      [provider, providerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Get user by email verification token
   */
  async getByEmailVerificationToken(token: string): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT * FROM users
       WHERE email_verification_token = $1
       AND email_verification_expires > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Get user by password reset token
   */
  async getByPasswordResetToken(token: string): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT * FROM users
       WHERE password_reset_token = $1
       AND password_reset_expires > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Update user
   */
  async update(id: string, options: UpdateUserOptions): Promise<User | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (options.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(options.name);
    }

    if (options.avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(options.avatarUrl);
    }

    if (options.tier !== undefined) {
      updates.push(`tier = $${paramIndex++}`);
      values.push(options.tier);
    }

    if (options.emailVerified !== undefined) {
      updates.push(`email_verified = $${paramIndex++}`);
      values.push(options.emailVerified);
    }

    if (options.emailVerificationToken !== undefined) {
      updates.push(`email_verification_token = $${paramIndex++}`);
      values.push(options.emailVerificationToken);
    }

    if (options.emailVerificationExpires !== undefined) {
      updates.push(`email_verification_expires = $${paramIndex++}`);
      values.push(options.emailVerificationExpires);
    }

    if (options.passwordHash !== undefined) {
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(options.passwordHash);
    }

    if (options.passwordResetToken !== undefined) {
      updates.push(`password_reset_token = $${paramIndex++}`);
      values.push(options.passwordResetToken);
    }

    if (options.passwordResetExpires !== undefined) {
      updates.push(`password_reset_expires = $${paramIndex++}`);
      values.push(options.passwordResetExpires);
    }

    if (options.lastLoginAt !== undefined) {
      updates.push(`last_login_at = $${paramIndex++}`);
      values.push(options.lastLoginAt);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );
  }

  /**
   * Delete user (soft delete by nullifying sensitive data)
   * Note: Hard delete would cascade to all related data
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    return result.rows.length > 0;
  }

  /**
   * Convert user to public format (removes sensitive fields)
   */
  toPublic(user: User): UserPublic {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      tier: user.tier,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * Map database row to User object
   */
  private mapRowToUser(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      email: row.email as string,
      name: row.name as string | undefined,
      passwordHash: row.password_hash as string | undefined,
      emailVerified: row.email_verified as boolean,
      emailVerificationToken: row.email_verification_token as string | undefined,
      emailVerificationExpires: row.email_verification_expires
        ? new Date(row.email_verification_expires as string)
        : undefined,
      passwordResetToken: row.password_reset_token as string | undefined,
      passwordResetExpires: row.password_reset_expires
        ? new Date(row.password_reset_expires as string)
        : undefined,
      oauthProvider: row.oauth_provider as OAuthProvider | undefined,
      oauthProviderId: row.oauth_provider_id as string | undefined,
      avatarUrl: row.avatar_url as string | undefined,
      tier: row.tier as UserTier,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      lastLoginAt: row.last_login_at
        ? new Date(row.last_login_at as string)
        : undefined,
    };
  }
}
