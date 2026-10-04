import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare module 'express' {
  interface Request {
    session: import('express-session').Session & {
      _csrfSecret?: string;
    };
  }
}

export const generateCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.session._csrfSecret) {
    req.session._csrfSecret = crypto.randomBytes(100).toString('base64');
  }
  const token = crypto.createHash('sha1').update(req.session._csrfSecret).digest('base64');
  res.cookie('XSRF-TOKEN', token, { httpOnly: false, secure: process.env.NODE_ENV === 'production' });
  // Also expose the token as a response header. The cookie alone is unusable
  // for this client: the API runs on a different origin than the app (VITE_API_URL
  // is :5000 while the app is :5175), so document.cookie on the app page cannot
  // see a cookie scoped to :5000, and the double-submit check had nothing to
  // compare against -- every unauthenticated POST returned 403.
  //
  // The header is only readable cross-origin if CORS exposes it, which
  // index.ts now does via exposedHeaders. The cookie is kept for same-origin
  // deployments and is not a second factor on its own: the value is derived
  // from the server-side session secret, so a token is only obtainable from a
  // response the server itself issued.
  res.setHeader('X-XSRF-Token', token);
  next();
};

export const validateCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path === '/api/analytics/event' || req.path === '/api/demo-requests') {
    return next();
  }

  // Bearer-token requests (the SPA authenticates with an Authorization header,
  // not an ambient cookie) cannot be triggered cross-origin — the header is
  // never attached automatically — so the cookie double-submit check does not
  // apply. Skip the check when a Bearer credential is present.
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return next();
  }

  // req.body is undefined, not {}, when no body parser matched the request's
  // Content-Type (express.json() only populates it for application/json). A
  // POST with a missing or wrong Content-Type therefore threw
  // "Cannot read properties of undefined (reading '_csrf')" and surfaced as a
  // 500 instead of the 403 the check exists to return. Optional chaining keeps
  // the unparseable-body case on the normal rejection path.
  const clientToken = (req.body as Record<string, unknown> | undefined)?._csrf || req.headers['x-xsrf-token'];
  const sessionSecret = req.session._csrfSecret;

  if (!clientToken || !sessionSecret) {
    res.status(403).json({ error: 'CSRF token missing or invalid' });
    return;
  }

  const expectedToken = crypto.createHash('sha1').update(sessionSecret).digest('base64');

  if (clientToken === expectedToken) {
    next();
  } else {
    res.status(403).json({ error: 'CSRF token mismatch' });
  }
};
