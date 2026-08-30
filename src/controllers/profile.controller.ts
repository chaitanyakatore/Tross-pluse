import { Request, Response } from 'express';
import { linkedInService } from '../services/linkedin.service';
import { cacheService } from '../services/cache.service';
import { ProfileRequestSchema } from '../types/linkedin';

export class ProfileController {
  /**
   * Main controller handler to scrape and return structured profile details.
   */
  public async getProfile(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();

    try {
      // Support both POST body `{ url: "..." }` and GET query parameter `?url=...`
      const urlInput = req.body?.url || req.query?.url;

      if (!urlInput || typeof urlInput !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Please provide a valid LinkedIn profile URL via query param ?url= or JSON body { "url": "..." }',
        });
        return;
      }

      // Validate URL format with Zod
      const validation = ProfileRequestSchema.safeParse({ url: urlInput });
      if (!validation.success) {
        res.status(400).json({
          error: 'Validation Error',
          details: validation.error.errors.map((e: any) => e.message),
        });
        return;
      }

      const targetUrl = validation.data.url;
      const vanityId = targetUrl.split('/in/')[1]?.replace(/\/$/, '').split('/')[0]?.split('?')[0]?.toLowerCase() || targetUrl;

      // Extract custom optional credentials passed in request headers (allows multi-tenant usage)
      const customLiAt = req.headers['x-linkedin-li-at'] as string | undefined;
      const customJsessionId = req.headers['x-linkedin-jsessionid'] as string | undefined;
      const customUserAgent = (req.headers['x-linkedin-user-agent'] || req.headers['user-agent']) as string | undefined;

      // 1. Check In-Memory Cache (Only if default credentials are used to ensure tenant safety)
      const cacheKey = `profile:${vanityId}`;
      if (!customLiAt && !customJsessionId) {
        const cachedPayload = cacheService.get(cacheKey);
        if (cachedPayload) {
          const duration = Math.round(performance.now() - startTime);
          cacheService.recordResponseTime(duration);

          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Response-Time', `${duration}ms`);
          res.status(200).json({
            success: true,
            cached: true,
            data: cachedPayload,
          });
          return;
        }
      }

      // 2. Cache Miss: Fetch from LinkedIn Reverse Engineering Service
      const profileData = await linkedInService.fetchProfile(
        targetUrl,
        customLiAt,
        customJsessionId,
        customUserAgent
      );

      // Save to cache if fetch succeeded
      if (!customLiAt && !customJsessionId) {
        cacheService.set(cacheKey, profileData);
      }

      const duration = Math.round(performance.now() - startTime);
      cacheService.recordResponseTime(duration);

      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Response-Time', `${duration}ms`);
      res.status(200).json({
        success: true,
        cached: false,
        data: profileData,
      });

    } catch (error: any) {
      const duration = Math.round(performance.now() - startTime);
      cacheService.recordResponseTime(duration);

      const message = error.message || 'An unexpected error occurred while fetching LinkedIn profile';
      let statusCode = 500;

      if (message.includes('not found')) statusCode = 404;
      if (message.includes('Authentication failed')) statusCode = 401;
      if (message.includes('anti-bot') || message.includes('999')) statusCode = 403;
      if (message.includes('rate limit')) statusCode = 429;
      if (message.includes('Invalid LinkedIn profile URL')) statusCode = 400;

      res.status(statusCode).json({
        success: false,
        error: message,
      });
    }
  }

  /**
   * System SLA & Execution Metrics Handler.
   */
  public getMetrics(_req: Request, res: Response): void {
    const metrics = cacheService.getMetrics();
    res.status(200).json({
      success: true,
      data: metrics,
    });
  }

  /**
   * Admin Cache Purge Handler.
   */
  public clearCache(_req: Request, res: Response): void {
    cacheService.clear();
    res.status(200).json({
      success: true,
      message: 'In-memory profile cache purged successfully.',
    });
  }
}
