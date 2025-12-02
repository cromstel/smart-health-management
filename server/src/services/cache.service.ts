import Redis from 'ioredis';

/**
 * Cache Service for Redis-based caching
 * Provides caching functionality with graceful fallback if Redis is unavailable
 */
class CacheService {
  private redis: Redis | null = null;
  private isEnabled: boolean = false;
  private inMemoryCache: Map<string, { value: any; expiresAt: number }> = new Map();

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Redis connection
   * Falls back to in-memory cache if Redis is unavailable
   */
  private async initialize(): Promise<void> {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');
    const redisPassword = process.env.REDIS_PASSWORD;
    const redisEnabled = process.env.REDIS_ENABLED !== 'false'; // Default to enabled if not set

    if (!redisEnabled) {
      console.log('📦 Redis caching disabled via REDIS_ENABLED=false, using in-memory cache');
      return;
    }

    try {
      this.redis = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      // Handle connection events
      this.redis.on('connect', () => {
        console.log('✅ Redis connection established');
        this.isEnabled = true;
      });

      this.redis.on('ready', () => {
        console.log('✅ Redis is ready');
        this.isEnabled = true;
      });

      this.redis.on('error', (error: Error) => {
        console.warn('⚠️  Redis connection error:', error.message);
        console.warn('⚠️  Falling back to in-memory cache');
        this.isEnabled = false;
        this.redis = null;
      });

      this.redis.on('close', () => {
        console.warn('⚠️  Redis connection closed, falling back to in-memory cache');
        this.isEnabled = false;
      });

      // Attempt to connect
      await this.redis.connect();
    } catch (error) {
      console.warn('⚠️  Failed to initialize Redis:', error instanceof Error ? error.message : 'Unknown error');
      console.warn('⚠️  Falling back to in-memory cache');
      this.isEnabled = false;
      this.redis = null;
    }

    // Clean up expired in-memory cache entries every 5 minutes
    setInterval(() => {
      this.cleanupInMemoryCache();
    }, 5 * 60 * 1000);
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.isEnabled && this.redis) {
        const data = await this.redis.get(key);
        if (data) {
          return JSON.parse(data) as T;
        }
        return null;
      } else {
        // Fallback to in-memory cache
        const cached = this.inMemoryCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          return cached.value as T;
        }
        if (cached) {
          this.inMemoryCache.delete(key);
        }
        return null;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      // Fallback to in-memory cache on error
      const cached = this.inMemoryCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value as T;
      }
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      if (this.isEnabled && this.redis) {
        await this.redis.setex(key, ttl, JSON.stringify(value));
      } else {
        // Fallback to in-memory cache
        this.inMemoryCache.set(key, {
          value,
          expiresAt: Date.now() + ttl * 1000,
        });
      }
    } catch (error) {
      console.error('Cache set error:', error);
      // Fallback to in-memory cache on error
      this.inMemoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttl * 1000,
      });
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      if (this.isEnabled && this.redis) {
        await this.redis.del(key);
      } else {
        this.inMemoryCache.delete(key);
      }
    } catch (error) {
      console.error('Cache delete error:', error);
      this.inMemoryCache.delete(key);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (this.isEnabled && this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        // Fallback: delete matching keys from in-memory cache
        const regex = new RegExp(pattern.replace('*', '.*'));
        for (const key of this.inMemoryCache.keys()) {
          if (regex.test(key)) {
            this.inMemoryCache.delete(key);
          }
        }
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Check if cache is enabled and available
   */
  isCacheEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ enabled: boolean; type: string; size?: number }> {
    if (this.isEnabled && this.redis) {
      try {
        await this.redis.info('stats'); // Get stats to verify connection
        return {
          enabled: true,
          type: 'redis',
        };
      } catch {
        return {
          enabled: false,
          type: 'in-memory',
          size: this.inMemoryCache.size,
        };
      }
    }
    return {
      enabled: false,
      type: 'in-memory',
      size: this.inMemoryCache.size,
    };
  }

  /**
   * Clean up expired entries from in-memory cache
   */
  private cleanupInMemoryCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.inMemoryCache.entries()) {
      if (cached.expiresAt <= now) {
        this.inMemoryCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async clear(): Promise<void> {
    try {
      if (this.isEnabled && this.redis) {
        await this.redis.flushdb();
      } else {
        this.inMemoryCache.clear();
      }
    } catch (error) {
      console.error('Cache clear error:', error);
      this.inMemoryCache.clear();
    }
  }

  /**
   * Close Redis connection gracefully
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isEnabled = false;
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export cache key generators for consistency
export const CacheKeys = {
  // Permission cache keys
  permission: (userId: string, module: string, action: string, departmentId?: string | null) => {
    const dept = departmentId ? `:dept:${departmentId}` : '';
    return `permission:${userId}:${module}:${action}${dept}`;
  },
  
  // Role permissions cache keys
  rolePermissions: (roleId: string | number) => `role:permissions:${roleId}`,
  
  // User data cache keys
  user: (userId: string) => `user:${userId}`,
  userPermissions: (userId: string) => `user:permissions:${userId}`,
  
  // Frequently accessed data
  patients: (hospitalId?: string) => hospitalId ? `patients:hospital:${hospitalId}` : 'patients:all',
  appointments: (hospitalId?: string, date?: string) => {
    const parts = ['appointments'];
    if (hospitalId) parts.push(`hospital:${hospitalId}`);
    if (date) parts.push(`date:${date}`);
    return parts.join(':');
  },
  settings: () => 'settings:all',
  
  // Cache invalidation patterns
  invalidateUser: (userId: string) => `*:${userId}:*`,
  invalidateRole: (roleId: string | number) => `role:permissions:${roleId}*`,
  invalidatePermissions: () => 'permission:*',
};

