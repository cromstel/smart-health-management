/**
 * Env helper for required secrets.
 *
 * In production a missing secret is a hard startup error (fail-fast).
 * In development a safe, clearly-labeled fallback value is used so the
 * stack runs without a full .env file. No real secrets are hardcoded here.
 */
export const getSecret = (name: string, devFallback: string): string => {
  const value = process.env[name];
  if (value && value.trim() !== '') {
    return value;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return devFallback;
};