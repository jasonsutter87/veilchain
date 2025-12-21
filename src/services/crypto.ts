/**
 * VeilChain Cryptographic Utilities
 *
 * Provides secure random generation, password hashing, and JWT utilities.
 */

import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

/**
 * Configuration for crypto operations
 */
export interface CryptoConfig {
  /** bcrypt cost factor (default: 12) */
  bcryptCostFactor?: number;
  /** JWT configuration */
  jwt?: {
    /** Private key for signing (RS256) */
    privateKey?: string;
    /** Public key for verification (RS256) */
    publicKey?: string;
    /** Token issuer */
    issuer?: string;
    /** Token audience */
    audience?: string;
    /** Access token expiry (default: '15m') */
    accessTokenExpiry?: string;
    /** Refresh token expiry (default: '7d') */
    refreshTokenExpiry?: string;
  };
}

/**
 * JWT payload structure
 */
export interface JwtPayload {
  /** Subject (user ID) */
  sub: string;
  /** Email */
  email: string;
  /** User tier */
  tier: string;
  /** JWT ID for revocation */
  jti: string;
  /** Issued at */
  iat: number;
  /** Expiration */
  exp: number;
  /** Issuer */
  iss: string;
  /** Audience */
  aud: string;
}

/**
 * Refresh token data structure
 */
export interface RefreshTokenData {
  /** User ID */
  userId: string;
  /** Token family ID for rotation tracking */
  familyId: string;
  /** Raw token value */
  token: string;
  /** SHA-256 hash for storage */
  tokenHash: string;
  /** Expiration date */
  expiresAt: Date;
}

const DEFAULT_BCRYPT_COST = 12;
const DEFAULT_ACCESS_TOKEN_EXPIRY = '15m';
const DEFAULT_REFRESH_TOKEN_EXPIRY = '7d';
const REMEMBER_ME_REFRESH_TOKEN_EXPIRY = '30d';

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Generate a JWT ID (jti)
 */
export function generateJti(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Generate an API key with the VeilChain prefix
 * Format: vc_live_<base64url(32 bytes)>
 */
export function generateApiKey(): { key: string; prefix: string } {
  const secret = randomBytes(32).toString('base64url');
  const key = `vc_live_${secret}`;
  const prefix = key.substring(0, 12); // "vc_live_xxxx"
  return { key, prefix };
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(
  password: string,
  costFactor: number = DEFAULT_BCRYPT_COST
): Promise<string> {
  return bcrypt.hash(password, costFactor);
}

/**
 * Verify a password against a bcrypt hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Hash an API key using bcrypt
 */
export async function hashApiKey(
  key: string,
  costFactor: number = DEFAULT_BCRYPT_COST
): Promise<string> {
  return bcrypt.hash(key, costFactor);
}

/**
 * Verify an API key against a bcrypt hash
 */
export async function verifyApiKey(
  key: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(key, hash);
}

/**
 * Hash a token using SHA-256 (for refresh tokens)
 * Note: We use SHA-256 for refresh tokens because we need to look them up by hash
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create a JWT service instance with configuration
 */
export function createJwtService(config: CryptoConfig['jwt'] = {}) {
  const {
    privateKey,
    publicKey,
    issuer = 'veilchain',
    audience = 'veilchain-api',
    accessTokenExpiry = DEFAULT_ACCESS_TOKEN_EXPIRY,
    refreshTokenExpiry = DEFAULT_REFRESH_TOKEN_EXPIRY,
  } = config;

  /**
   * Sign a JWT access token
   */
  function signAccessToken(payload: {
    userId: string;
    email: string;
    tier: string;
  }): string {
    if (!privateKey) {
      throw new Error('JWT private key not configured');
    }

    const jti = generateJti();

    return jwt.sign(
      {
        sub: payload.userId,
        email: payload.email,
        tier: payload.tier,
        jti,
      },
      privateKey,
      {
        algorithm: 'RS256' as const,
        expiresIn: accessTokenExpiry,
        issuer,
        audience,
      } as jwt.SignOptions
    );
  }

  /**
   * Verify and decode a JWT access token
   */
  function verifyAccessToken(token: string): JwtPayload {
    if (!publicKey) {
      throw new Error('JWT public key not configured');
    }

    return jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer,
      audience,
    }) as JwtPayload;
  }

  /**
   * Decode a JWT without verification (for debugging)
   */
  function decodeToken(token: string): JwtPayload | null {
    const decoded = jwt.decode(token);
    return decoded as JwtPayload | null;
  }

  /**
   * Generate a refresh token
   */
  function generateRefreshToken(
    userId: string,
    familyId?: string,
    rememberMe: boolean = false
  ): RefreshTokenData {
    const token = generateSecureToken(48);
    const tokenHash = hashToken(token);
    const expiry = rememberMe ? REMEMBER_ME_REFRESH_TOKEN_EXPIRY : refreshTokenExpiry;

    // Parse expiry string to calculate date
    const expiresAt = new Date();
    const match = expiry.match(/^(\d+)([dhms])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      switch (unit) {
        case 'd':
          expiresAt.setDate(expiresAt.getDate() + value);
          break;
        case 'h':
          expiresAt.setHours(expiresAt.getHours() + value);
          break;
        case 'm':
          expiresAt.setMinutes(expiresAt.getMinutes() + value);
          break;
        case 's':
          expiresAt.setSeconds(expiresAt.getSeconds() + value);
          break;
      }
    } else {
      // Default to 7 days if parsing fails
      expiresAt.setDate(expiresAt.getDate() + 7);
    }

    return {
      userId,
      familyId: familyId || generateId(),
      token,
      tokenHash,
      expiresAt,
    };
  }

  /**
   * Get the expiration time for access tokens in seconds
   */
  function getAccessTokenExpirySeconds(): number {
    const match = accessTokenExpiry.match(/^(\d+)([dhms])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 'd': return value * 86400;
      case 'h': return value * 3600;
      case 'm': return value * 60;
      case 's': return value;
      default: return 900;
    }
  }

  return {
    signAccessToken,
    verifyAccessToken,
    decodeToken,
    generateRefreshToken,
    getAccessTokenExpirySeconds,
    hashToken,
  };
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a password reset token (URL-safe)
 */
export function generatePasswordResetToken(): {
  token: string;
  expiresAt: Date;
} {
  const token = generateSecureToken(32);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry
  return { token, expiresAt };
}

/**
 * Generate an email verification token
 */
export function generateEmailVerificationToken(): {
  token: string;
  expiresAt: Date;
} {
  const token = generateSecureToken(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
  return { token, expiresAt };
}

/**
 * Generate OAuth state for CSRF protection
 */
export function generateOAuthState(): {
  state: string;
  expiresAt: Date;
} {
  const state = generateSecureToken(32);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry
  return { state, expiresAt };
}

export type JwtService = ReturnType<typeof createJwtService>;
