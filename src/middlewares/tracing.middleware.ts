import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function tracingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = performance.now();
  (req as any).startTime = startTime;

  // 1. Generate or forward Correlation ID (x-request-id)
  const incomingRequestId = req.headers['x-request-id'] as string;
  const requestId = incomingRequestId || `req_${crypto.randomBytes(4).toString('hex')}_${Date.now()}`;
  res.setHeader('X-Request-ID', requestId);

  // 2. Optional Tiered API Key Auth (x-api-key or Authorization header)
  const apiKey = (req.headers['x-api-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '')) as string | undefined;
  const validKeys = ['tross-demo-key', 'tross-enterprise-key', 'pro-key-2026'];

  if (apiKey && validKeys.includes(apiKey)) {
    (req as any).apiTier = 'Enterprise';
    res.setHeader('X-Tier', 'Enterprise');
  } else {
    (req as any).apiTier = 'Demo';
    res.setHeader('X-Tier', 'Demo');
  }

  next();
}
