import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { getAuditLogs } from '../controllers/audit.controller';

export const auditRouter = Router();

auditRouter.get('/', requireAuth, requireRole('ADMIN'), getAuditLogs);
