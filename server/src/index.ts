import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { apiRouter } from './routes';
import { redis, redisSub } from './db/redis';
import { initBackgroundJobs, systemWorker, systemQueue } from './jobs';
import './config/auth'; // Validates JWT_SECRET presence and >= 32 chars on boot

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

// CORS allowlist configuration
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (e.g. curl, server-to-server) where origin header is absent
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger with token redaction
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/api/health',
    },
    serializers: {
      req: (req) => {
        const rawUrl = req.raw ? req.raw.url || req.url : req.url;
        const sanitizedUrl = rawUrl
          ? rawUrl.replace(/[?&]token=[^&]+/gi, (match: string) => (match.startsWith('?') ? '?[REDACTED]' : '&[REDACTED]'))
          : rawUrl;
        return {
          id: req.id,
          method: req.method,
          url: sanitizedUrl,
          remoteAddress: req.remoteAddress,
          remotePort: req.remotePort,
        };
      },
    },
    customReceivedMessage: (req) => {
      const rawUrl = req.url || '';
      const sanitizedUrl = rawUrl.replace(/[?&]token=[^&]+/gi, (match: string) => (match.startsWith('?') ? '?[REDACTED]' : '&[REDACTED]'));
      return `request received: ${req.method} ${sanitizedUrl}`;
    },
    customSuccessMessage: (req, res) => {
      const rawUrl = req.url || '';
      const sanitizedUrl = rawUrl.replace(/[?&]token=[^&]+/gi, (match: string) => (match.startsWith('?') ? '?[REDACTED]' : '&[REDACTED]'));
      return `request completed: ${req.method} ${sanitizedUrl} ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
      const rawUrl = req.url || '';
      const sanitizedUrl = rawUrl.replace(/[?&]token=[^&]+/gi, (match: string) => (match.startsWith('?') ? '?[REDACTED]' : '&[REDACTED]'));
      return `request errored: ${req.method} ${sanitizedUrl} ${res.statusCode} - ${err.message}`;
    },
  }),
);

// Mount API routes under /api
app.use('/api', apiRouter);

// Connect Redis on boot
redis.connect().catch((err) => {
  logger.warn(`Redis initial connection notice: ${err.message}`);
});

const server = app.listen(port, '0.0.0.0', async () => {
  logger.info(`CryoGuard Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
  logger.info(`Health check available at http://localhost:${port}/api/health`);

  // Initialize BullMQ background workers and jobs
  try {
    await initBackgroundJobs();
  } catch (err: any) {
    logger.error(`Failed to initialize background jobs: ${err.message}`);
  }
});

// Graceful shutdown
const handleShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed');
  });
  try {
    await systemWorker.close();
    await systemQueue.close();
    await redis.quit();
    await redisSub.quit();
    logger.info('Redis and BullMQ connections closed');
  } catch (err) {
    // ignore
  }
  process.exit(0);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default app;
