import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  lazyConnect: true,
};

export const redis = new Redis(redisUrl, redisOptions);
export const redisSub = new Redis(redisUrl, redisOptions);

redis.on('error', (err) => {
  console.error('Redis primary error:', err.message);
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis (Primary)');
});

redisSub.on('error', (err) => {
  console.error('Redis subscriber error:', err.message);
});

redisSub.on('connect', () => {
  console.log('✅ Connected to Redis (Subscriber)');
});
