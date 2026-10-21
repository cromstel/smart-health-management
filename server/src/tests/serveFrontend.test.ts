import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { frontendDistDir, isUncacheableDocument } from '../config/frontend.js';
import { cacheControlFor, frontendFallback } from '../middleware/serveFrontend.js';

describe('the built front-end', () => {
  const originalDistDir = process.env.FRONTEND_DIST_DIR;
  let workspace: string;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'shms-frontend-'));
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
    if (originalDistDir === undefined) delete process.env.FRONTEND_DIST_DIR;
    else process.env.FRONTEND_DIST_DIR = originalDistDir;
  });

  it('is found where a build leaves it', () => {
    const build = path.join(workspace, 'build');
    fs.mkdirSync(path.join(build, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(build, 'index.html'), '<!doctype html>');

    process.env.FRONTEND_DIST_DIR = build;
    expect(frontendDistDir()).toBe(build);
  });

  it('is not found when there is no build', () => {
    process.env.FRONTEND_DIST_DIR = path.join(workspace, 'nothing-here');
    expect(frontendDistDir()).toBeNull();
  });

  it('is not found when the directory holds no entry document', () => {
    const build = path.join(workspace, 'build');
    fs.mkdirSync(build, { recursive: true });
    fs.writeFileSync(path.join(build, 'styles.css'), 'body{}');

    process.env.FRONTEND_DIST_DIR = build;
    expect(frontendDistDir()).toBeNull();
  });
});

describe('the documents that must not be cached', () => {
  it('covers the entry document, the service worker and its helpers', () => {
    expect(isUncacheableDocument(path.join('dist', 'index.html'))).toBe(true);
    expect(isUncacheableDocument(path.join('dist', 'sw.js'))).toBe(true);
    expect(isUncacheableDocument(path.join('dist', 'workbox-abc123.js'))).toBe(true);
    expect(isUncacheableDocument(path.join('dist', 'manifest.webmanifest'))).toBe(true);
  });

  it('leaves the hashed assets and the ordinary files alone', () => {
    expect(isUncacheableDocument(path.join('dist', 'assets', 'app-a1b2c3.js'))).toBe(false);
    expect(isUncacheableDocument(path.join('dist', 'images', 'hero.webp'))).toBe(false);
  });
});

describe('the cache policy for a file in the build', () => {
  const webRoot = path.join('/srv', 'app', 'public');

  it('caches the hashed assets for ever', () => {
    const policy = cacheControlFor(path.join(webRoot, 'assets', 'app-a1b2c3.js'), webRoot);
    expect(policy).toContain('immutable');
  });

  it('re-reads the entry document', () => {
    const policy = cacheControlFor(path.join(webRoot, 'index.html'), webRoot);
    expect(policy).toContain('no-store');
  });

  it('caches an ordinary file for a while rather than for ever', () => {
    const policy = cacheControlFor(path.join(webRoot, 'images', 'hero.webp'), webRoot);
    expect(policy).not.toContain('immutable');
    expect(policy).toContain('max-age=3600');
  });
});

describe('answering a page request', () => {
  const webRoot = path.join('/srv', 'app', 'public');

  const mockRequest = (requestPath: string, method = 'GET') =>
    ({ path: requestPath, method } as unknown as Request);

  it('answers a page request with the entry document', () => {
    const res = { sendFile: vi.fn() } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    frontendFallback(webRoot)(mockRequest('/patients/42'), res, next);

    expect(res.sendFile).toHaveBeenCalledWith(
      path.join(webRoot, 'index.html'),
      expect.any(Function)
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('leaves an unknown API route to the API', () => {
    const res = { sendFile: vi.fn() } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    frontendFallback(webRoot)(mockRequest('/api/nothing-here'), res, next);

    expect(res.sendFile).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('leaves a missing uploaded file to the API', () => {
    const res = { sendFile: vi.fn() } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    frontendFallback(webRoot)(mockRequest('/uploads/missing.pdf'), res, next);

    expect(res.sendFile).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('leaves a request that is not a page request alone', () => {
    const res = { sendFile: vi.fn() } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    frontendFallback(webRoot)(mockRequest('/patients', 'POST'), res, next);

    expect(res.sendFile).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
