import rateLimit from 'express-rate-limit';

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: any) => {
    // Enterprise Tier gets 1,000 requests per 15 min, Demo Tier gets 100 requests per 15 min
    return req.apiTier === 'Enterprise' ? 1000 : 100;
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: true, // Return `X-RateLimit-*` headers
  message: {
    success: false,
    error: 'Too Many Requests (HTTP 429)',
    message: 'You have exceeded the rate limit for this tier. Please wait 15 minutes or supply a valid Enterprise API key.',
  },
});
