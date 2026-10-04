import { Router } from 'express';
import { healthRouter } from './health';
import { authRouter } from './auth.routes';
import { userRouter } from './user.routes';
import { equipmentRouter } from './equipment.routes';
import { readingsRouter } from './readings.routes';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/equipment', equipmentRouter);
apiRouter.use('/readings', readingsRouter);
