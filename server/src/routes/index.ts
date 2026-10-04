import { Router } from 'express';
import { healthRouter } from './health';
import { authRouter } from './auth.routes';
import { userRouter } from './user.routes';
import { equipmentRouter } from './equipment.routes';
import { readingsRouter } from './readings.routes';
import { alertRouter } from './alert.routes';
import { dashboardRouter } from './dashboard.routes';
import { maintenanceRouter } from './maintenance.routes';
import { inspectionTemplateRouter, inspectionRouter } from './inspection.routes';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/equipment', equipmentRouter);
apiRouter.use('/readings', readingsRouter);
apiRouter.use('/alerts', alertRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/maintenance', maintenanceRouter);
apiRouter.use('/inspection-templates', inspectionTemplateRouter);
apiRouter.use('/inspections', inspectionRouter);
