import type { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Error:', err);

  let status = err.status || err.statusCode || 500;
  let message = 'Internal server error';

  if (err.name === 'MulterError') {
    status = 400;
    message = err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON payload';
  } else if (err.message) {
    message = err.message;
  }

  res.status(status).json({ error: message });
};