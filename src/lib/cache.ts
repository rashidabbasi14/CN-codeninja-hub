// Simple in-memory cache implementation
// In production, you'd use Redis or similar

interface CacheItem<T> {
  data: T;
  expiry: number;
}

class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expiry });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired items
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Global cache instance
export const cache = new MemoryCache();

// Cleanup expired items every 10 minutes
setInterval(() => {
  cache.cleanup();
}, 10 * 60 * 1000);

// Cache key generators
export const cacheKeys = {
  leaderboard: (type: string, filters?: string) => `leaderboard:${type}:${filters || 'all'}`,
  games: (categoryId?: string) => `games:${categoryId || 'all'}`,
  registrations: (userId: string) => `registrations:${userId}`,
  posts: (page: number = 1) => `posts:page:${page}`,
  news: () => 'news:all',
  departments: () => 'departments:all',
  schedule: (gameId: string) => `schedule:${gameId}`,
  results: (gameId: string) => `results:${gameId}`,
};

// Cache wrapper for API responses
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();
  
  // Store in cache
  cache.set(key, data, ttl);
  
  return data;
}

// Invalidate related cache entries
export function invalidateCache(pattern: string): void {
  const keys = cache.getStats().keys;
  const keysToDelete = keys.filter(key => key.includes(pattern));
  
  keysToDelete.forEach(key => {
    cache.delete(key);
  });
}

// Debounce utility for search and input handling
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle utility for scroll and resize events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Lazy loading utility for images
export function createImageLoader() {
  const imageCache = new Set<string>();
  
  return {
    loadImage: (src: string): Promise<void> => {
      if (imageCache.has(src)) {
        return Promise.resolve();
      }
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          imageCache.add(src);
          resolve();
        };
        img.onerror = reject;
        img.src = src;
      });
    },
    
    preloadImages: async (srcs: string[]): Promise<void> => {
      const promises = srcs
        .filter(src => !imageCache.has(src))
        .map(src => {
          return new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              imageCache.add(src);
              resolve();
            };
            img.onerror = () => resolve(); // Don't fail on individual image errors
            img.src = src;
          });
        });
      
      await Promise.all(promises);
    }
  };
}

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(label: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(label, duration);
    };
  }

  recordMetric(label: string, value: number): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    
    const values = this.metrics.get(label)!;
    values.push(value);
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }
  }

  getMetrics(label: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(label);
    if (!values || values.length === 0) {
      return null;
    }

    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { avg, min, max, count: values.length };
  }

  getAllMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, any> = {};
    
    for (const [label] of this.metrics) {
      const metrics = this.getMetrics(label);
      if (metrics) {
        result[label] = metrics;
      }
    }
    
    return result;
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();