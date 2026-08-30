import { Router } from 'express';
import { ProfileController } from '../controllers/profile.controller';
import { apiRateLimiter } from '../middlewares/ratelimit.middleware';

const router = Router();
const profileController = new ProfileController();

/**
 * @route GET /api/v1/profile
 * @route POST /api/v1/profile
 */
router.get('/profile', apiRateLimiter, profileController.getProfile.bind(profileController));
router.post('/profile', apiRateLimiter, profileController.getProfile.bind(profileController));

/**
 * @route GET /api/v1/metrics
 * @route POST /api/v1/cache/clear
 */
router.get('/metrics', profileController.getMetrics.bind(profileController));
router.post('/cache/clear', profileController.clearCache.bind(profileController));

export default router;
