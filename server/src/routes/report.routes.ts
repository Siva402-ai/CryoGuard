import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getTemperatureTrendReport,
  getAlertsByMonthReport,
  getMaintenanceHistoryReport,
  getInventoryConsumptionReport,
} from '../controllers/report.controller';

export const reportRouter = Router();

reportRouter.get('/temperature-trend', requireAuth, getTemperatureTrendReport);
reportRouter.get('/alerts-by-month', requireAuth, getAlertsByMonthReport);
reportRouter.get('/maintenance-history', requireAuth, getMaintenanceHistoryReport);
reportRouter.get('/inventory-consumption', requireAuth, getInventoryConsumptionReport);
