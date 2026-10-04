import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getDashboardSummary } from '../controllers/dashboard.controller';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', requireAuth, getDashboardSummary);
