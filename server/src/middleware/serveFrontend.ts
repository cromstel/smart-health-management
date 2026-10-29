import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { isUncacheableDocument } from '../config/frontend.js';

/**
 * Serves the built front-end.
 *
 * A deployment sends every request for the site to one process, so that
 * process answers the page requests as well as the API requests. The build's
 * assets are served from disk, and any other page request is answered with
 * the entry document, because the application reads its routes from the
 * address bar and the server cannot know which of them exist.
 *
 * The API prefix is deliberately left alone: an unknown API route has to
 * answer with a JSON error, not with the application's HTML. A request for an
 * uploaded file that does not exist is left alone for the same reason.
 */

/** The paths that belong to the API rather than to the application. */
const isApiPath = (requestPath: string): boolean =>
  requestPath === '/api' || requestPath.startsWith('/api/');

/** The paths that belong to the uploaded files rather than to the application. */
const isUploadPath = (requestPath: string): boolean =>
  requestPath === '/uploads' || requestPath.startsWith('/uploads/');

/**
 * The cache policy for a file in the build.
 *
 * The build's assets carry a content hash in their name, so a change to one
 * is a change to its name and it may be cached indefinitely. The entry
 * document and the service worker decide which release the browser is
 * running, so they are re-read on every visit. Everything else keeps its
 * name between releases and is cached for a while rather than for ever.
 */
export const cacheControlFor = (filePath: string, webRoot: string): string => {
  if (isUncacheableDocument(filePath)) {
    return 'no-cache, no-store, must-revalidate';
  }
  const relative = path.relative(webRoot, filePath).split(path.sep).join('/');
  if (relative.startsWith('assets/')) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=3600';
};

/** Serves the build's files. */
export const frontendStatic = (webRoot: string) =>
  express.static(webRoot, {
    index: false,
    setHeaders: (res, filePath) => {
      res.setHeader('Cache-Control', cacheControlFor(filePath, webRoot));
    },
  });

/** Answers a page request with the application's entry document. */
export const frontendFallback = (webRoot: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (isApiPath(req.path) || isUploadPath(req.path)) return next();
    res.sendFile(path.join(webRoot, 'index.html'), (error) => {
      if (error) next(error);
    });
  };
