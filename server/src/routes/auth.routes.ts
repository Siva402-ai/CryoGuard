import { Router } from 'express';
import { login, getMe, logout } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { loginRateLimiter } from '../middleware/rateLimiter';

export const authRouter = Router();

authRouter.post('/login', loginRateLimiter, login);
authRouter.get('/me', requireAuth, getMe);
authRouter.post('/logout', logout);
