import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { apiRouter } from './routes';
import { redis } from './db/redis';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '4000', 10);
const isDev = process.env.NODE_ENV === 'development';

const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
});

// Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/api/health',
    },
  }),
);

// Mount API routes under /api
app.use('/api', apiRouter);

// Connect Redis on boot
redis.connect().catch((err) => {
  logger.warn(`Redis initial connection notice: ${err.message}`);
});

const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`🚀 CryoGuard Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
  logger.info(`🔗 Health check available at http://localhost:${port}/api/health`);
});

// Graceful shutdown
const handleShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed');
  });
  try {
    await redis.quit();
    logger.info('Redis connection closed');
  } catch (err) {
    // ignore
  }
  process.exit(0);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default app;
