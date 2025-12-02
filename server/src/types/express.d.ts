import 'express';
import 'express-session';

declare module 'express' {
  interface Request {
    session: import('express-session').Session & {
      _csrfSecret?: string;
    };
  }
}