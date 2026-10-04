import { Router } from 'express';
import { ingestReading } from '../controllers/readings.controller';

export const readingsRouter = Router();

// Ingest sensor readings (x-api-key authenticated, used by simulator)
readingsRouter.post('/', ingestReading);
