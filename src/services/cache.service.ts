import { LRUCache } from 'lru-cache';
import { LinkedInProfileResponse } from '../types/linkedin';

export class CacheService {
  private cache: LRUCache<string, LinkedInProfileResponse>;
  private totalRequests = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private totalResponseTimeMs = 0;
  private startTime = Date.now();

  constructor() {
    this.cache = new LRUCache<string, LinkedInProfileResponse>({
      max: 100, // Maximum 100 items in RAM
      ttl: 1000 * 60 * 60, // 1 hour TTL
    });
  }

  public get(key: string): LinkedInProfileResponse | undefined {
    this.totalRequests++;
    const value = this.cache.get(key);
    if (value) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
    return value;
  }

  public set(key: string, value: LinkedInProfileResponse): void {
    this.cache.set(key, value);
  }

  public recordResponseTime(ms: number): void {
    this.totalResponseTimeMs += ms;
  }

  public clear(): void {
    this.cache.clear();
  }

  public getMetrics() {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const hitRatio = this.totalRequests > 0 ? (this.cacheHits / this.totalRequests) * 100 : 0;
    const avgResponseTimeMs = this.totalRequests > 0 ? Math.round(this.totalResponseTimeMs / this.totalRequests) : 0;
    const memoryUsageMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100;

    return {
      uptimeSeconds,
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRatio: `${hitRatio.toFixed(1)}%`,
      cachedProfilesCount: this.cache.size,
      avgResponseTimeMs,
      memoryUsageMb,
    };
  }
}

export const cacheService = new CacheService();
