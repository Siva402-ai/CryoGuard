import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getAlerts,
  acknowledgeAlert,
  resolveAlert,
  streamAlerts,
} from '../controllers/alert.controller';

export const alertRouter = Router();

// Stream endpoint (handles its own token auth via Authorization header or ?token=)
alertRouter.get('/stream', streamAlerts);

// Standard CRUD endpoints
alertRouter.get('/', requireAuth, getAlerts);
alertRouter.patch('/:id/acknowledge', requireAuth, acknowledgeAlert);
alertRouter.patch('/:id/resolve', requireAuth, resolveAlert);
