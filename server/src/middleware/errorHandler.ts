import type { Request, Response, NextFunction } from 'express';

/**
 * An error whose message was written for the person who made the request.
 *
 * The error handler answers every other error with a generic message, so an
 * error that names a table, a column, a file path or a driver detail has to
 * say so deliberately. `PublicError` is that deliberate signal.
 */
export class PublicError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PublicError';
    this.status = status;
  }
}

/**
 * The database driver's failures, and what the caller is told instead.
 *
 * A driver message is written for a server operator: it names the table, the
 * column, the index and sometimes the value that collided. Answering a
 * client with it hands over the shape of the schema and, where the value is
 * part of the message, a piece of the record. The driver code is stable and
 * says the same thing every time, so it is the safe thing to key on.
 */
const DRIVER_RESPONSES: Record<string, { status: number; message: string }> = {
  ER_DUP_ENTRY: {
    status: 409,
    message: 'A record with these details already exists.',
  },
  ER_NO_REFERENCED_ROW: {
    status: 400,
    message: 'A record this refers to does not exist.',
  },
  ER_NO_REFERENCED_ROW_2: {
    status: 400,
    message: 'A record this refers to does not exist.',
  },
  ER_ROW_IS_REFERENCED: {
    status: 409,
    message: 'This record is referred to by another record and cannot be changed.',
  },
  ER_ROW_IS_REFERENCED_2: {
    status: 409,
    message: 'This record is referred to by another record and cannot be removed.',
  },
  ER_DATA_TOO_LONG: {
    status: 400,
    message: 'A value is longer than the field allows.',
  },
  ER_WARN_DATA_OUT_OF_RANGE: {
    status: 400,
    message: 'A value is outside the range the field allows.',
  },
  ER_TRUNCATED_WRONG_VALUE: {
    status: 400,
    message: 'A value is not of the type the field expects.',
  },
  ER_PARSE_ERROR: {
    status: 400,
    message: 'The request could not be understood.',
  },
  ER_LOCK_WAIT_TIMEOUT: {
    status: 409,
    message: 'That record is being changed by someone else. Please try again.',
  },
  ER_LOCK_DEADLOCK: {
    status: 409,
    message: 'That record is being changed by someone else. Please try again.',
  },
  ER_ACCESS_DENIED_ERROR: {
    status: 503,
    message: 'The service is not available at the moment. Please try again.',
  },
  PROTOCOL_CONNECTION_LOST: {
    status: 503,
    message: 'The service is not available at the moment. Please try again.',
  },
  ECONNREFUSED: {
    status: 503,
    message: 'The service is not available at the moment. Please try again.',
  },
  ETIMEDOUT: {
    status: 503,
    message: 'The service is not available at the moment. Please try again.',
  },
  ECONNRESET: {
    status: 503,
    message: 'The service is not available at the moment. Please try again.',
  },
};

/** The largest body the service accepts as JSON. */
const MAX_JSON_BODY = '1mb';

export const errorHandler = (err: any, _req: Request, res: Response, next: NextFunction): void => {
  if (res.headersSent) {
    // The answer has already started. There is nothing left to say, and
    // writing a second one would corrupt it.
    next(err);
    return;
  }

  // The detail belongs to the operator, not to the caller. It is logged
  // where the operator can reach it and answered with a message that says
  // nothing about the inside of the system.
  console.error('Unhandled request error:', {
    name: err?.name,
    code: err?.code,
    status: err?.status || err?.statusCode,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  let status = 500;
  let message = 'Internal server error';

  if (err?.name === 'MulterError') {
    // The upload library's own message names the field and the limit, which
    // is written for the caller and says nothing about the system.
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'That file is larger than the service accepts.'
      : 'That file could not be accepted.';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON payload';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    message = `The request body is larger than the service accepts (${MAX_JSON_BODY}).`;
  } else if (err instanceof PublicError) {
    status = err.status;
    message = err.message;
  } else if (typeof err?.code === 'string' && DRIVER_RESPONSES[err.code]) {
    const mapped = DRIVER_RESPONSES[err.code];
    status = mapped.status;
    message = mapped.message;
  } else {
    // A deliberate status on an ordinary error means the message was written
    // for the caller. Anything else is an internal failure, and the message
    // is not shown.
    const declared = err?.status || err?.statusCode;
    if (Number.isInteger(declared) && declared >= 400 && declared < 500) {
      status = declared;
      message = typeof err.message === 'string' ? err.message : message;
    }
  }

  res.status(status).json({ error: message });
};
