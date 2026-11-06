/**
 * Pagination helper.
 *
 * A list endpoint that answers with every row hands out a copy of the
 * installation's records: the response grows with the installation, the
 * server spends its time reading rows nobody is going to look at, and the
 * client cannot ask for the rest of the list when it wants it.
 *
 * Every paged list therefore has a page size with a default and a ceiling,
 * and it reports where the page sits in the list: how many rows exist, how
 * big the page is, and where it starts. A client pages by asking for the
 * next offset.
 *
 * The parameters are checked twice on purpose. The route validates them with
 * express-validator, so a request for `limit=abc` or `limit=1000000` is
 * refused with a 400 before the controller runs; `readPage` clamps them
 * again, so a controller that is called directly -- from a test, or from
 * another module -- still cannot ask for the whole table.
 *
 * The ceiling lives here rather than in each route and each controller, so
 * that the size a route refuses and the size a controller serves cannot
 * drift apart.
 */
import type { Response } from 'express';
import { query } from 'express-validator';

/** The page size a list is answered in when nothing else is asked for. */
export interface PagePolicy {
  /** The page size used when the caller does not ask for one. */
  defaultLimit: number;
  /** The largest page the endpoint will serve. */
  maxLimit: number;
}

/** The page size every paged list uses. */
export const PAGE_POLICY: PagePolicy = { defaultLimit: 50, maxLimit: 200 };

export interface PageRequest {
  /** How many rows the page holds. */
  limit: number;
  /** How many rows are skipped before the page starts. */
  offset: number;
}

/**
 * Reads a whole number out of a query value.
 *
 * A repeated parameter arrives as an array, so the first value is taken. An
 * empty string is not a number: `?limit=` means "not supplied", not zero.
 */
const toInteger = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) return value.length > 0 ? toInteger(value[0]) : null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

/**
 * The page a request asked for.
 *
 * The limit is at least one row and at most the endpoint's ceiling; the
 * offset is never negative. A limit of zero would answer with nothing, and
 * a negative offset would be counted backwards from the end of the table.
 */
export const readPage = (query: unknown, policy: PagePolicy = PAGE_POLICY): PageRequest => {
  const source = (query ?? {}) as Record<string, unknown>;

  const requestedLimit = toInteger(source.limit);
  const limit = Math.min(
    Math.max(requestedLimit ?? policy.defaultLimit, 1),
    policy.maxLimit
  );

  const requestedOffset = toInteger(source.offset);
  const offset = Math.max(requestedOffset ?? 0, 0);

  return { limit, offset };
};

/**
 * The validation a route puts in front of a paged list.
 *
 * The rules refuse what the helper would have to correct anyway, so that a
 * caller that asks for something impossible is told so rather than quietly
 * answered with a different page than the one it asked for.
 */
export const pageValidators = (policy: PagePolicy = PAGE_POLICY) => [
  query('limit')
    .optional()
    .isInt({ min: 1, max: policy.maxLimit })
    .withMessage(`limit must be a whole number between 1 and ${policy.maxLimit}`),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('offset must be zero or a positive whole number'),
];

/**
 * Reports the page on the response.
 *
 * The headers are set on every paged list, whatever shape the endpoint
 * answers with, so a client can page an endpoint that answers with an array
 * as well as one that answers with an object. The endpoints that answer
 * with an object carry the same numbers in the body.
 */
export const setPageHeaders = (
  res: Response,
  page: { total: number; limit: number; offset: number }
): void => {
  res.setHeader('X-Total-Count', String(page.total));
  res.setHeader('X-Page-Limit', String(page.limit));
  res.setHeader('X-Page-Offset', String(page.offset));
};
