import { Router } from 'express';
import { profileController } from '../controllers/profile.controller';

const router = Router();

/**
 * @route GET /api/v1/profile?url=https://www.linkedin.com/in/username/
 * @route POST /api/v1/profile
 */
router.get('/profile', profileController.getProfile.bind(profileController));
router.post('/profile', profileController.getProfile.bind(profileController));

export default router;
