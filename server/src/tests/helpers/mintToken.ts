import { signToken } from '../../config/tokens.js';

/**
 * Mints a session token for a test.
 *
 * The tests sign tokens the way the application does — through the one
 * module that describes what a token is. A test that signed its own token
 * would be testing a token the application would never accept, and a change
 * to the token's shape would leave the tests passing against a token
 * nothing else could use.
 */
export const mintToken = (
  userId: number | string,
  email: string,
  role: string,
  extra: Record<string, unknown> = {},
  expiresIn = '15m'
): string =>
  signToken(
    { id: String(userId), email, role, ...extra } as Parameters<typeof signToken>[0],
    expiresIn
  );
