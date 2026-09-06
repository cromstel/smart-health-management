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
  next();
};

export const validateCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const clientToken = req.body._csrf || req.headers['x-xsrf-token'];
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