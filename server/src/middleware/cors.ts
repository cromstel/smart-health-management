/**
 * The cross-origin policy of the API.
 *
 * The API is published on an address of its own and the application on
 * another, so a browser request from the application carries an origin. A
 * request from an address the service does not accept is refused, because a
 * page on an address the platform does not control has no business asking
 * the API to do anything on a member of staff's behalf.
 *
 * The policy lives here rather than in the entry point so that it can be
 * exercised on its own: the refusal is a decision about the request, and a
 * decision that is only reachable by starting the whole service is a decision
 * nobody checks.
 */
import cors from 'cors';
import { allowedFrontendOrigins } from '../config/runtime.js';
import { RefusedRequest } from './errorHandler.js';

/**
 * The options the API is published with.
 *
 * The list of accepted origins is read once, when the service starts, so that
 * every request is answered against the same list and a request cannot be
 * let through by an address that appears in the environment afterwards.
 */
export const corsOptions = (): cors.CorsOptions => {
  const allowedOrigins = allowedFrontendOrigins();

  return {
    origin: (origin, callback) => {
      // Same-origin and non-browser callers send no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // A request from an address that is not on the list is refused, and the
      // refusal says nothing about which addresses are on the list or which
      // one asked. It is a refusal, not a fault, so it is answered as one and
      // it is not recorded as a fault.
      return callback(
        new RefusedRequest('This request is not allowed from this address.', 403)
      );
    },
    credentials: true,
    // Required for the app to read the CSRF token: response headers other than
    // the safelisted ones are withheld from cross-origin scripts unless listed.
    // Without this the X-XSRF-Token header is invisible to the client even though
    // the server sends it.
    //
    // The paging headers are listed for the same reason. A list endpoint that
    // answers with an array reports how many rows there are and where the page
    // sits in the headers, and a browser on another address cannot read a
    // header the policy withholds.
    exposedHeaders: ['X-XSRF-Token', 'X-Total-Count', 'X-Page-Limit', 'X-Page-Offset'],
  };
};
