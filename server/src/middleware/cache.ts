import type { Response, NextFunction } from 'express';
import { cacheService } from '../services/cache.service.js';
import type { AuthRequest } from './auth.js';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string | ((req: AuthRequest) => string); // Custom cache key generator
  condition?: (req: AuthRequest, res: Response) => boolean; // Condition to cache
  headers?: Record<string, string>; // Additional cache headers
}

/**
 * Response caching middleware
 * Caches HTTP responses using Redis with configurable TTL and cache keys
 */
export const cacheResponse = (options: CacheOptions = {}) => {
  const {
    ttl = 300, // 5 minutes default
    key: keyGenerator,
    condition = () => true, // Cache by default if condition not provided
    headers = {}
  } = options;

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Check if caching is enabled for this request
      if (!condition(req, res)) {
        return next();
      }

      // Generate cache key
      const cacheKey = typeof keyGenerator === 'function'
        ? keyGenerator(req)
        : keyGenerator || generateDefaultCacheKey(req);

      // Try to get cached response
      const cachedResponse = await cacheService.get<any>(cacheKey);
      if (cachedResponse) {
        // Return cached response
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `public, max-age=${ttl}`,
          ...headers
        });
        res.json(cachedResponse);
        return;
      }

      // Override res.json to capture the response data
      const originalJson = res.json.bind(res);
      res.json = (data: any) => {
        // Cache the response data
        cacheService.set(cacheKey, data, ttl).catch(err =>
          console.error('Cache set error:', err)
        );

        // Set cache headers
        res.set({
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `public, max-age=${ttl}`,
          ...headers
        });

        // Return original response
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Response caching middleware error:', error);
      // Continue without caching on error
      next();
    }
  };
};

/**
 * Cache invalidation middleware
 * Invalidates cache entries when data is modified
 */
export const invalidateCache = (patterns: string[] | ((req: AuthRequest) => string[])) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // Store original response methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalEnd = res.end.bind(res);

    // Override response methods to invalidate cache after successful response
    res.json = (data: any) => {
      const result = originalJson.call(res, data);
      // Invalidate cache asynchronously after response is sent
      setImmediate(async () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const patternArray = typeof patterns === 'function' ? patterns(req) : patterns;
            for (const pattern of patternArray) {
              await cacheService.invalidatePattern(pattern);
            }
          }
        } catch (error) {
          console.error('Cache invalidation error:', error);
        }
      });
      return result;
    };

    res.send = (data: any) => {
      const result = originalSend.call(res, data);
      setImmediate(async () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const patternArray = typeof patterns === 'function' ? patterns(req) : patterns;
            for (const pattern of patternArray) {
              await cacheService.invalidatePattern(pattern);
            }
          }
        } catch (error) {
          console.error('Cache invalidation error:', error);
        }
      });
      return result;
    };

    res.end = (data?: any, encoding?: any) => {
      const result = originalEnd.call(res, data, encoding);
      setImmediate(async () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const patternArray = typeof patterns === 'function' ? patterns(req) : patterns;
            for (const pattern of patternArray) {
              await cacheService.invalidatePattern(pattern);
            }
          }
        } catch (error) {
          console.error('Cache invalidation error:', error);
        }
      });
      return result;
    };

    next();
  };
};

/**
 * Generate default cache key from request
 */
function generateDefaultCacheKey(req: AuthRequest): string {
  const parts = [
    req.method,
    req.originalUrl,
    req.user?.id || 'anonymous',
    req.user?.hospital_id || 'no-hospital'
  ];

  // Include query parameters in cache key
  const queryParams = new URLSearchParams(req.query as any).toString();
  if (queryParams) {
    parts.push(queryParams);
  }

  return `response:${parts.join(':').replace(/[^a-zA-Z0-9:_-]/g, '_')}`;
}

/**
 * Predefined cache configurations for common endpoints
 */
export const CacheConfigs = {
  // Public data that changes infrequently
  public: {
    ttl: 600, // 10 minutes
    headers: { 'Cache-Control': 'public, max-age=600' }
  },

  // User-specific data
  user: {
    ttl: 300, // 5 minutes
    headers: { 'Cache-Control': 'private, max-age=300' }
  },

  // Frequently changing data
  volatile: {
    ttl: 60, // 1 minute
    headers: { 'Cache-Control': 'public, max-age=60' }
  },

  // Static reference data
  reference: {
    ttl: 3600, // 1 hour
    headers: { 'Cache-Control': 'public, max-age=3600' }
  }
};

/**
 * Cache key generators for common patterns
 */
export const CacheKeys = {
  patients: (req: AuthRequest) => `patients:list:${req.user?.hospital_id || 'all'}:${JSON.stringify(req.query)}`,
  patient: (id: string) => `patient:detail:${id}`,
  appointments: (req: AuthRequest) => `appointments:list:${req.user?.hospital_id || 'all'}:${JSON.stringify(req.query)}`,
  dashboard: (req: AuthRequest) => `dashboard:stats:${req.user?.hospital_id || 'all'}`,
  user: (id: string) => `user:profile:${id}`,
  roles: () => 'roles:list',
  permissions: (userId: string) => `user:permissions:${userId}`
};

/**
 * Cache invalidation patterns
 */
export const InvalidationPatterns = {
  patients: ['patients:*', 'dashboard:*'],
  patient: (id: string) => [`patient:detail:${id}`, 'patients:*', 'dashboard:*'],
  appointments: ['appointments:*', 'dashboard:*'],
  dashboard: ['dashboard:*'],
  users: ['user:*', 'patients:*'],
  roles: ['roles:*', 'user:permissions:*'],
  permissions: ['user:permissions:*']
};
