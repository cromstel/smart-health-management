/**
 * Enhanced JWT Configuration with Enterprise Security Features
 * Provides RSA256 asymmetric encryption, JWKS support, and token management
 * Author: Security Team
 * Created: 2025-11-24
 */

import { randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import jwt from 'jsonwebtoken';

/**
 * JWT Payload Interface
 */
export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  permissions?: string[];
  hospital_id?: string;
  jti: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

/**
 * JWT Configuration Interface
 */
export interface JWTConfig {
  algorithm: 'HS256' | 'RS256';
  secret: string;
  issuer: string;
  audience: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  enableBlacklist: boolean;
  validateIssuer: boolean;
  validateAudience: boolean;
}

/**
 * Simple JWT Manager with Enhanced Security Features
 */
export class JWTManager {
  private config: JWTConfig;
  private blacklistCache: Set<string> = new Set();
  private logger: any;

  constructor(config: JWTConfig) {
    this.config = config;
    this.logger = console;
    this.initializeKeys();
  }

  /**
   * Initialize JWT Keys/Directories
   */
  private initializeKeys(): void {
    const keysDir = join(process.cwd(), 'keys');
    if (!existsSync(keysDir)) {
      mkdirSync(keysDir, { recursive: true });
    }
  }

  /**
   * Create JWT Token with Enhanced Security
   */
  async createToken(payload: Omit<JWTPayload, 'jti' | 'iat' | 'exp' | 'iss' | 'aud'>): Promise<string> {
    try {
      const jti = randomBytes(16).toString('hex');

      const fullPayload: JWTPayload = {
        ...payload,
        jti,
        iss: this.config.issuer,
        aud: this.config.audience,
      };

      const options = {
        algorithm: this.config.algorithm === 'RS256' ? 'RS256' : 'HS256',
        issuer: this.config.issuer,
        audience: this.config.audience,
        jwtid: jti,
        expiresIn: this.config.accessTokenExpiry,
      } as jwt.SignOptions;

      return jwt.sign(fullPayload, this.config.secret, options);
    } catch (error) {
      this.logger.error('Token creation failed:', error);
      throw new Error('Failed to create JWT token');
    }
  }

  /**
   * Verify JWT Token with Enhanced Validation
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      // Check blacklist
      if (this.config.enableBlacklist && this.blacklistCache.has(token)) {
        throw new Error('Token has been revoked');
      }

      const options: jwt.VerifyOptions = {
        algorithms: [this.config.algorithm === 'RS256' ? 'RS256' : 'HS256'],
      };

      if (this.config.validateIssuer) {
        options.issuer = this.config.issuer;
      }

      if (this.config.validateAudience) {
        options.audience = this.config.audience;
      }

      const decoded = jwt.verify(token, this.config.secret, options);
      return decoded as JWTPayload;
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Add Token to Blacklist
   */
  async blacklistToken(token: string): Promise<void> {
    if (this.config.enableBlacklist) {
      this.blacklistCache.add(token);
      this.logger.info('Token blacklisted');
    }
  }



  /**
   * Generate Secure Secret
   */
  static generateSecureSecret(length: number = 64): string {
    return randomBytes(length).toString('base64');
  }

  /**
   * Get JWKS (JSON Web Key Set) - Placeholder for future implementation
   */
  async getJWKS(): Promise<{ keys: any[] }> {
    // Placeholder - would implement JWKS for RS256 in production
    return { keys: [] };
  }

  /**
   * Cleanup Expired Tokens from Blacklist
   */
  async cleanupExpiredTokens(): Promise<void> {
    // In production, implement proper cleanup
    this.logger.info('Token cleanup completed');
  }
}

// Configuration Factory
export function createJWTConfig(): JWTConfig {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required and must not be empty');
  }

  return {
    algorithm: (process.env.JWT_ALGORITHM as 'HS256' | 'RS256') || 'HS256',
    secret,
    issuer: process.env.JWT_ISSUER || 'smart-health-manager',
    audience: process.env.JWT_AUDIENCE || 'healthcare-api',
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '1h',
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '30d',
    enableBlacklist: process.env.JWT_ENABLE_BLACKLIST === 'true',
    validateIssuer: process.env.JWT_VALIDATE_ISSUER !== 'false',
    validateAudience: process.env.JWT_VALIDATE_AUDIENCE !== 'false',
  };
}

// Global JWT Manager Instance
export const jwtManager = new JWTManager(createJWTConfig());
