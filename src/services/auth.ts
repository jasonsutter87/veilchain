/**
 * VeilChain Authentication Service
 *
 * Handles user registration, login, token management, and OAuth flows.
 */

import { Pool } from 'pg';
import type { User, UserPublic, RefreshToken, OAuthProvider } from '../types.js';
import { UserService } from './user.js';
import { AuditService } from './audit.js';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateId,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  generateOAuthState,
  createJwtService,
  type JwtService,
  type CryptoConfig,
} from './crypto.js';

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** JWT configuration */
  jwt: CryptoConfig['jwt'];
  /** bcrypt cost factor */
  bcryptCostFactor?: number;
  /** Base URL for callbacks */
  baseUrl?: string;
  /** OAuth configuration */
  oauth?: {
    github?: {
      clientId: string;
      clientSecret: string;
    };
    google?: {
      clientId: string;
      clientSecret: string;
    };
  };
}

/**
 * Authentication result
 */
export interface AuthResult {
  user: UserPublic;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * Registration input
 */
export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

/**
 * Login input
 */
export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * OAuth callback data
 */
export interface OAuthCallbackData {
  provider: OAuthProvider;
  code: string;
  state: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * OAuth user info from provider
 */
export interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

/**
 * Authentication error codes
 */
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_EXISTS'
  | 'EMAIL_NOT_VERIFIED'
  | 'USER_NOT_FOUND'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REVOKED'
  | 'OAUTH_ERROR'
  | 'INVALID_STATE';

/**
 * Authentication error
 */
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Authentication service
 */
export class AuthService {
  private readonly jwtService: JwtService;

  constructor(
    private readonly pool: Pool,
    private readonly userService: UserService,
    private readonly auditService: AuditService,
    private readonly config: AuthConfig
  ) {
    this.jwtService = createJwtService(config.jwt);
  }

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<{ message: string }> {
    // Check if email exists
    if (await this.userService.emailExists(input.email)) {
      throw new AuthError('EMAIL_EXISTS', 'Email already registered');
    }

    // Validate password
    if (input.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Hash password
    const passwordHash = await hashPassword(input.password, this.config.bcryptCostFactor);

    // Generate email verification token
    const { token: verificationToken, expiresAt: verificationExpires } =
      generateEmailVerificationToken();

    // Create user
    const user = await this.userService.create({
      email: input.email,
      name: input.name,
      passwordHash,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    // Log registration
    await this.auditService.log({
      userId: user.id,
      action: 'register',
      resourceType: 'user',
      resourceId: user.id,
      details: { email: input.email },
    });

    // TODO: Send verification email
    // await this.emailService.sendVerificationEmail(user.email, verificationToken);

    return { message: 'Verification email sent' };
  }

  /**
   * Login with email and password
   */
  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userService.getByEmail(input.email);

    if (!user || !user.passwordHash) {
      // Log failed attempt
      await this.auditService.log({
        action: 'login',
        details: { email: input.email, success: false, reason: 'user_not_found' },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Verify password
    const passwordValid = await verifyPassword(input.password, user.passwordHash);
    if (!passwordValid) {
      await this.auditService.log({
        userId: user.id,
        action: 'login',
        details: { success: false, reason: 'invalid_password' },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Check email verification (optional enforcement)
    // if (!user.emailVerified) {
    //   throw new AuthError('EMAIL_NOT_VERIFIED', 'Please verify your email');
    // }

    // Generate tokens
    const accessToken = this.jwtService.signAccessToken({
      userId: user.id,
      email: user.email,
      tier: user.tier,
    });

    let refreshToken: string | undefined;
    if (input.rememberMe) {
      const refreshData = this.jwtService.generateRefreshToken(user.id, undefined, true);
      await this.storeRefreshToken(refreshData, input.ipAddress, input.userAgent);
      refreshToken = refreshData.token;
    }

    // Update last login
    await this.userService.updateLastLogin(user.id);

    // Log success
    await this.auditService.log({
      userId: user.id,
      action: 'login',
      details: { success: true, rememberMe: input.rememberMe },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      user: this.userService.toPublic(user),
      accessToken,
      refreshToken,
      expiresIn: this.jwtService.getAccessTokenExpirySeconds(),
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    const tokenHash = hashToken(refreshToken);

    // Find the refresh token
    const result = await this.pool.query(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      throw new AuthError('INVALID_TOKEN', 'Invalid refresh token');
    }

    const storedToken = this.mapRowToRefreshToken(result.rows[0]);

    // Check expiration
    if (storedToken.expiresAt < new Date()) {
      throw new AuthError('TOKEN_EXPIRED', 'Refresh token expired');
    }

    // Get user
    const user = await this.userService.getById(storedToken.userId);
    if (!user) {
      throw new AuthError('USER_NOT_FOUND', 'User not found');
    }

    // Rotate refresh token (invalidate old, create new)
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), revoked_reason = 'rotated' WHERE id = $1`,
      [storedToken.id]
    );

    // Generate new tokens
    const accessToken = this.jwtService.signAccessToken({
      userId: user.id,
      email: user.email,
      tier: user.tier,
    });

    const newRefreshData = this.jwtService.generateRefreshToken(
      user.id,
      storedToken.familyId,
      true
    );
    await this.storeRefreshToken(newRefreshData, ipAddress, userAgent);

    return {
      user: this.userService.toPublic(user),
      accessToken,
      refreshToken: newRefreshData.token,
      expiresIn: this.jwtService.getAccessTokenExpirySeconds(),
    };
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(
    refreshToken: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const tokenHash = hashToken(refreshToken);

    await this.pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(), revoked_reason = 'logout'
       WHERE token_hash = $1 AND user_id = $2`,
      [tokenHash, userId]
    );

    await this.auditService.log({
      userId,
      action: 'logout',
      ipAddress,
      userAgent,
    });
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string, reason: string = 'user_requested'): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(), revoked_reason = $1
       WHERE user_id = $2 AND revoked_at IS NULL`,
      [reason, userId]
    );
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    const user = await this.userService.getByEmailVerificationToken(token);
    if (!user) {
      throw new AuthError('INVALID_TOKEN', 'Invalid or expired verification token');
    }

    await this.userService.update(user.id, {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    await this.auditService.log({
      userId: user.id,
      action: 'email_verify',
      resourceType: 'user',
      resourceId: user.id,
    });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userService.getByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    const { token, expiresAt } = generatePasswordResetToken();

    await this.userService.update(user.id, {
      passwordResetToken: token,
      passwordResetExpires: expiresAt,
    });

    // TODO: Send password reset email
    // await this.emailService.sendPasswordResetEmail(user.email, token);
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.userService.getByPasswordResetToken(token);
    if (!user) {
      throw new AuthError('INVALID_TOKEN', 'Invalid or expired reset token');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const passwordHash = await hashPassword(newPassword, this.config.bcryptCostFactor);

    await this.userService.update(user.id, {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    });

    // Revoke all existing refresh tokens
    await this.revokeAllUserTokens(user.id, 'password_reset');

    await this.auditService.log({
      userId: user.id,
      action: 'password_reset',
      resourceType: 'user',
      resourceId: user.id,
    });
  }

  /**
   * Change password (authenticated)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.userService.getById(userId);
    if (!user || !user.passwordHash) {
      throw new AuthError('USER_NOT_FOUND', 'User not found');
    }

    const passwordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw new AuthError('INVALID_CREDENTIALS', 'Current password is incorrect');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const passwordHash = await hashPassword(newPassword, this.config.bcryptCostFactor);

    await this.userService.update(userId, { passwordHash });

    // Revoke all existing refresh tokens
    await this.revokeAllUserTokens(userId, 'password_change');

    await this.auditService.log({
      userId,
      action: 'password_change',
      resourceType: 'user',
      resourceId: userId,
    });
  }

  /**
   * Check if a JWT is revoked
   */
  async isTokenRevoked(jti: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM token_blocklist WHERE jti = $1`,
      [jti]
    );
    return result.rows.length > 0;
  }

  /**
   * Revoke a specific JWT
   */
  async revokeToken(jti: string, userId: string, expiresAt: Date, reason?: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO token_blocklist (jti, user_id, expires_at, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (jti) DO NOTHING`,
      [jti, userId, expiresAt, reason || null]
    );
  }

  /**
   * Verify access token and return payload
   */
  verifyAccessToken(token: string) {
    return this.jwtService.verifyAccessToken(token);
  }

  /**
   * Create OAuth state for CSRF protection
   */
  async createOAuthState(redirectUrl?: string): Promise<string> {
    const { state, expiresAt } = generateOAuthState();

    await this.pool.query(
      `INSERT INTO oauth_states (state, redirect_url, expires_at)
       VALUES ($1, $2, $3)`,
      [state, redirectUrl || null, expiresAt]
    );

    return state;
  }

  /**
   * Validate and consume OAuth state
   */
  async validateOAuthState(state: string): Promise<string | null> {
    const result = await this.pool.query(
      `DELETE FROM oauth_states
       WHERE state = $1 AND expires_at > NOW()
       RETURNING redirect_url`,
      [state]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].redirect_url;
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(data: OAuthCallbackData): Promise<AuthResult> {
    // Validate state
    const redirectUrl = await this.validateOAuthState(data.state);
    if (redirectUrl === null && data.state) {
      throw new AuthError('INVALID_STATE', 'Invalid or expired OAuth state');
    }

    // Exchange code for user info
    let userInfo: OAuthUserInfo;
    try {
      userInfo = await this.getOAuthUserInfo(data.provider, data.code);
    } catch (error) {
      throw new AuthError('OAUTH_ERROR', `Failed to get user info from ${data.provider}`);
    }

    // Find or create user
    let user = await this.userService.getByOAuth(data.provider, userInfo.id);

    if (!user) {
      // Check if email exists
      const existingUser = await this.userService.getByEmail(userInfo.email);
      if (existingUser) {
        // Link OAuth to existing account
        user = await this.userService.update(existingUser.id, {
          avatarUrl: userInfo.avatarUrl,
        }) as User;
        // Note: In production, you might want to require re-authentication
        // before linking an OAuth provider
      } else {
        // Create new user
        user = await this.userService.create({
          email: userInfo.email,
          name: userInfo.name,
          oauthProvider: data.provider,
          oauthProviderId: userInfo.id,
          avatarUrl: userInfo.avatarUrl,
          emailVerified: true, // OAuth emails are pre-verified
        });

        await this.auditService.log({
          userId: user.id,
          action: 'register',
          resourceType: 'user',
          resourceId: user.id,
          details: { provider: data.provider },
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        });
      }
    }

    // Generate tokens
    const accessToken = this.jwtService.signAccessToken({
      userId: user.id,
      email: user.email,
      tier: user.tier,
    });

    const refreshData = this.jwtService.generateRefreshToken(user.id, undefined, true);
    await this.storeRefreshToken(refreshData, data.ipAddress, data.userAgent);

    // Update last login
    await this.userService.updateLastLogin(user.id);

    // Log success
    await this.auditService.log({
      userId: user.id,
      action: 'login',
      details: { provider: data.provider, success: true },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });

    return {
      user: this.userService.toPublic(user),
      accessToken,
      refreshToken: refreshData.token,
      expiresIn: this.jwtService.getAccessTokenExpirySeconds(),
    };
  }

  /**
   * Get OAuth authorization URL
   */
  getOAuthAuthorizationUrl(provider: OAuthProvider, state: string): string {
    const baseUrl = this.config.baseUrl || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/v1/auth/${provider}/callback`;

    switch (provider) {
      case 'github': {
        const config = this.config.oauth?.github;
        if (!config) throw new Error('GitHub OAuth not configured');
        return `https://github.com/login/oauth/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=user:email&state=${state}`;
      }
      case 'google': {
        const config = this.config.oauth?.google;
        if (!config) throw new Error('Google OAuth not configured');
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=email%20profile&state=${state}`;
      }
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
  }

  /**
   * Get user info from OAuth provider
   */
  private async getOAuthUserInfo(provider: OAuthProvider, code: string): Promise<OAuthUserInfo> {
    const baseUrl = this.config.baseUrl || 'http://localhost:3000';

    switch (provider) {
      case 'github':
        return this.getGitHubUserInfo(code, baseUrl);
      case 'google':
        return this.getGoogleUserInfo(code, baseUrl);
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
  }

  /**
   * Get GitHub user info
   */
  private async getGitHubUserInfo(code: string, baseUrl: string): Promise<OAuthUserInfo> {
    const config = this.config.oauth?.github;
    if (!config) throw new Error('GitHub OAuth not configured');

    const callbackUrl = `${baseUrl}/v1/auth/github/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
    if (tokenData.error || !tokenData.access_token) {
      throw new Error(`GitHub OAuth error: ${tokenData.error}`);
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
      },
    });

    const userData = await userResponse.json() as {
      id: number;
      email: string | null;
      name: string | null;
      avatar_url: string;
    };

    // Get primary email if not public
    let email = userData.email;
    if (!email) {
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/json',
        },
      });
      const emails = await emailResponse.json() as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primaryEmail = emails.find(e => e.primary && e.verified);
      email = primaryEmail?.email || emails[0]?.email;
    }

    if (!email) {
      throw new Error('Could not get email from GitHub');
    }

    return {
      id: userData.id.toString(),
      email,
      name: userData.name || undefined,
      avatarUrl: userData.avatar_url,
    };
  }

  /**
   * Get Google user info
   */
  private async getGoogleUserInfo(code: string, baseUrl: string): Promise<OAuthUserInfo> {
    const config = this.config.oauth?.google;
    if (!config) throw new Error('Google OAuth not configured');

    const callbackUrl = `${baseUrl}/v1/auth/google/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl,
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
    if (tokenData.error || !tokenData.access_token) {
      throw new Error(`Google OAuth error: ${tokenData.error}`);
    }

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json() as {
      id: string;
      email: string;
      name?: string;
      picture?: string;
    };

    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      avatarUrl: userData.picture,
    };
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(
    data: { userId: string; familyId: string; tokenHash: string; expiresAt: Date },
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const id = generateId();

    await this.pool.query(
      `INSERT INTO refresh_tokens (
        id, user_id, token_hash, family_id, expires_at, user_agent, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, data.userId, data.tokenHash, data.familyId, data.expiresAt, userAgent || null, ipAddress || null]
    );
  }

  /**
   * Map database row to RefreshToken
   */
  private mapRowToRefreshToken(row: Record<string, unknown>): RefreshToken {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      tokenHash: row.token_hash as string,
      familyId: row.family_id as string,
      expiresAt: new Date(row.expires_at as string),
      issuedAt: new Date(row.issued_at as string),
      revokedAt: row.revoked_at ? new Date(row.revoked_at as string) : undefined,
      revokedReason: row.revoked_reason as string | undefined,
      userAgent: row.user_agent as string | undefined,
      ipAddress: row.ip_address as string | undefined,
    };
  }
}
