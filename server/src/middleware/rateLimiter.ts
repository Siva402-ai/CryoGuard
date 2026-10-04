import { Request, Response, NextFunction } from 'express';
import { redis } from '../db/redis';

const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS = 10;

// In-memory fallback if Redis is disconnected
const memoryFallbackMap = new Map<string, { count: number; resetAt: number }>();

export const loginRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `ratelimit:login:${ip}`;

  try {
    if (redis.status === 'ready') {
      const attempts = await redis.incr(key);
      if (attempts === 1) {
        await redis.expire(key, WINDOW_SECONDS);
      }

      if (attempts > MAX_ATTEMPTS) {
        const ttl = await redis.ttl(key);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Too many login attempts. Please try again in ${ttl > 0 ? ttl : WINDOW_SECONDS} seconds.`,
        });
      }

      return next();
    }
  } catch (err) {
    console.warn('Redis rate limiter notice, using in-memory tracker:', (err as Error).message);
  }

  // In-memory fallback logic
  const now = Date.now();
  const entry = memoryFallbackMap.get(ip);

  if (!entry || entry.resetAt < now) {
    memoryFallbackMap.set(ip, { count: 1, resetAt: now + WINDOW_SECONDS * 1000 });
    return next();
  }

  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    const secondsLeft = Math.ceil((entry.resetAt - now) / 1000);
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Too many login attempts. Please try again in ${secondsLeft} seconds.`,
    });
  }

  next();
};
