import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getMaintenanceTasks,
  createMaintenanceTask,
  updateMaintenanceTask,
  completeMaintenanceTask,
} from '../controllers/maintenance.controller';

export const maintenanceRouter = Router();

maintenanceRouter.get('/', requireAuth, getMaintenanceTasks);
maintenanceRouter.post('/', requireAuth, createMaintenanceTask);
maintenanceRouter.put('/:id', requireAuth, updateMaintenanceTask);
maintenanceRouter.patch('/:id/complete', requireAuth, completeMaintenanceTask);
