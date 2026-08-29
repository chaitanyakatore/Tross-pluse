import { Request, Response } from 'express';
import { linkedInService } from '../services/linkedin.service';
import { ProfileRequestSchema } from '../types/linkedin';

export class ProfileController {
  /**
   * Main controller handler to scrape and return structured profile details.
   */
  public async getProfile(req: Request, res: Response): Promise<void> {
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

      // Extract custom optional credentials passed in request headers (allows multi-tenant usage)
      const customLiAt = req.headers['x-linkedin-li-at'] as string | undefined;
      const customJsessionId = req.headers['x-linkedin-jsessionid'] as string | undefined;
      const customUserAgent = (req.headers['x-linkedin-user-agent'] || req.headers['user-agent']) as string | undefined;

      const profileData = await linkedInService.fetchProfile(
        validation.data.url,
        customLiAt,
        customJsessionId,
        customUserAgent
      );

      res.status(200).json({
        success: true,
        data: profileData,
      });
    } catch (error: any) {
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
}

export const profileController = new ProfileController();
