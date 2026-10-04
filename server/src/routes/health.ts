import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { redis } from '../db/redis';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  let dbStatus = 'down';
  let redisStatus = 'down';

  // Check PostgreSQL connection via Prisma
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'up';
  } catch (error) {
    dbStatus = 'down';
  }

  // Check Redis connection
  try {
    if (redis.status !== 'ready') {
      await redis.connect().catch(() => {});
    }
    const pong = await redis.ping();
    if (pong === 'PONG') {
      redisStatus = 'up';
    }
  } catch (error) {
    redisStatus = 'down';
  }

  const isHealthy = dbStatus === 'up' && redisStatus === 'up';

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'cryoguard-api',
    db: dbStatus,
    redis: redisStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/test-error', (_req: Request, _res: Response) => {
  throw new Error('Deliberately triggered server test error');
});
