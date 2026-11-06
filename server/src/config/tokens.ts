import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { APP_NAME } from './app.js';
import { getSecret } from './env.js';

/**
 * The token contract.
 *
 * Every token this service issues and every token it accepts is described
 * here, in one place, so that the issuer and the verifier cannot disagree
 * about what a token is.
 *
 * The verification options are stated rather than left to the library's
 * defaults. A default that accepts "whatever algorithm the token says" is a
 * default that lets a token choose how it is checked; the algorithm is
 * therefore named, and the token is bound to this service and to this
 * deployment, so a token minted elsewhere with the same key is not accepted
 * here.
 */

/** The algorithm every token is signed and verified with. */
export const TOKEN_ALGORITHM = 'HS256' as const;

/** Who issued the token. */
export const TOKEN_ISSUER = APP_NAME;

/** Who the token is for. */
export const TOKEN_AUDIENCE = 'shms-api';

/** The options every token is signed with. */
export const TOKEN_SIGN_OPTIONS: SignOptions = {
  algorithm: TOKEN_ALGORITHM,
  issuer: TOKEN_ISSUER,
  audience: TOKEN_AUDIENCE,
};

/** The options every token is verified with. */
export const TOKEN_VERIFY_OPTIONS: jwt.VerifyOptions = {
  algorithms: [TOKEN_ALGORITHM],
  issuer: TOKEN_ISSUER,
  audience: TOKEN_AUDIENCE,
};

/** The claims a session token carries. */
export interface TokenClaims {
  /** The account's identifier. */
  id: string;
  email: string;
  role: string;
  /** The hospital's public code, for display. */
  hospital_id?: string;
  /** The hospital's numeric key, which is what the records are scoped by. */
  hospital_ref?: number;
  department_id?: string;
  /**
   * The account's token version.
   *
   * It changes when the account's credentials change, so a token minted
   * before a password was changed stops being accepted even though it has
   * not expired.
   */
  ver?: number;
  /**
   * Set on the short-lived token that gates the second factor.
   *
   * A token carrying it is not a session: it may only be used to complete
   * the verification it was issued for.
   */
  mfa_pending?: boolean;
}

/** The signing key. */
const secret = (): string => getSecret('JWT_SECRET', 'dev-only-jwt-secret');

/** Signs a token. */
export const signToken = (claims: TokenClaims, expiresIn: string): string =>
  jwt.sign(
    { ...claims },
    secret(),
    { ...TOKEN_SIGN_OPTIONS, expiresIn } as unknown as SignOptions
  );

/**
 * Verifies a token and returns its claims.
 *
 * Throws when the token is not ours, was not signed with the expected
 * algorithm, has expired, or has been tampered with.
 */
export const verifyToken = (token: string): TokenClaims =>
  jwt.verify(token, secret(), TOKEN_VERIFY_OPTIONS) as unknown as TokenClaims;
