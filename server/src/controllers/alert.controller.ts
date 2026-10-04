import { Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { AlertStatus, AlertSeverity, AlertType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { redis, redisSub } from '../db/redis';
import { writeAudit } from '../utils/audit';

const JWT_SECRET = process.env.JWT_SECRET || 'cryoguard_super_secret_jwt_key_development_2026';

const alertsQuerySchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  equipmentId: z.string().optional(),
  page: z
    .string()
    .regex(/^\d+$/, 'Page must be a positive integer')
    .transform(Number)
    .optional()
    .default('1'),
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform(Number)
    .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default('20'),
});

let isSubscribedToAlerts = false;

// Ensure subscriber is attached to 'alerts' channel once
function ensureRedisSubscribed() {
  if (!isSubscribedToAlerts) {
    redisSub.subscribe('alerts', (err) => {
      if (err) {
        console.error('Failed to subscribe to Redis alerts channel:', err.message);
      } else {
        isSubscribedToAlerts = true;
        console.log('📡 Subscribed to Redis channel: alerts');
      }
    });
  }
}

export const getAlerts = async (req: Request, res: Response) => {
  try {
    const parseResult = alertsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid query parameters';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parseResult.error.errors,
      });
    }

    const { status, severity, equipmentId, page = 1, limit = 20 } = parseResult.data;

    const whereClause: any = {};

    if (status && status !== 'ALL') {
      if (status === 'ACTIVE') {
        whereClause.status = { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] };
      } else if (Object.values(AlertStatus).includes(status as AlertStatus)) {
        whereClause.status = status as AlertStatus;
      }
    }

    if (severity && severity !== 'ALL') {
      if (Object.values(AlertSeverity).includes(severity as AlertSeverity)) {
        whereClause.severity = severity as AlertSeverity;
      }
    }

    if (equipmentId && equipmentId !== 'ALL') {
      whereClause.equipment_id = equipmentId;
    }

    const skip = (page - 1) * limit;

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          equipment: {
            select: {
              id: true,
              code: true,
              name: true,
              material: true,
              location: true,
            },
          },
        },
      }),
      prisma.alert.count({ where: whereClause }),
    ]);

    return res.status(200).json({
      alerts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error('getAlerts error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve alerts.',
    });
  }
};

export const acknowledgeAlert = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.alert.findUnique({
      where: { id },
      include: {
        equipment: {
          select: { id: true, code: true, name: true, material: true, location: true },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Alert with ID '${id}' was not found.`,
      });
    }

    if (existing.status === AlertStatus.RESOLVED) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Alert is already resolved and cannot be acknowledged.',
      });
    }

    const userName = req.user?.name || req.user?.email || 'Authorized Staff';

    const updated = await prisma.alert.update({
      where: { id },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledged_by: userName,
        acknowledged_at: new Date(),
      },
      include: {
        equipment: {
          select: { id: true, code: true, name: true, material: true, location: true },
        },
      },
    });

    // Write audit log
    await writeAudit({
      userId: req.user?.userId,
      action: 'ACKNOWLEDGE_ALERT',
      entity: 'Alert',
      entityId: id,
      meta: {
        equipmentCode: updated.equipment?.code || 'INVENTORY',
        severity: updated.severity,
        type: updated.type,
      },
    });

    // Publish alert.acknowledged event
    try {
      if (redis.status === 'ready') {
        await redis.publish(
          'alerts',
          JSON.stringify({
            event: 'alert.acknowledged',
            alert: updated,
          }),
        );
      }
    } catch (e) {
      console.warn('Redis publish notice:', (e as Error).message);
    }

    return res.status(200).json({
      message: 'Alert acknowledged successfully',
      alert: updated,
    });
  } catch (error) {
    console.error('acknowledgeAlert error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to acknowledge alert.',
    });
  }
};

export const resolveAlert = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.alert.findUnique({
      where: { id },
      include: {
        equipment: {
          select: { id: true, code: true, name: true, material: true, location: true },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Alert with ID '${id}' was not found.`,
      });
    }

    if (existing.status === AlertStatus.RESOLVED) {
      return res.status(200).json({
        message: 'Alert is already resolved',
        alert: existing,
      });
    }

    const userName = req.user?.name || req.user?.email || 'Authorized Staff';

    const updated = await prisma.alert.update({
      where: { id },
      data: {
        status: AlertStatus.RESOLVED,
        resolved_by: userName,
        resolved_at: new Date(),
      },
      include: {
        equipment: {
          select: { id: true, code: true, name: true, material: true, location: true },
        },
      },
    });

    // Delete Redis dedupe key
    try {
      if (redis.status === 'ready') {
        if (updated.equipment_id) {
          await redis.del(`alert:active:${updated.equipment_id}:${updated.type}`);
        } else if (updated.type === AlertType.INVENTORY && updated.source_id) {
          await redis.del(`alert:active:INVENTORY:${updated.source_id}`);
        }
        await redis.publish(
          'alerts',
          JSON.stringify({
            event: 'alert.resolved',
            alert: updated,
          }),
        );
      }
    } catch (e) {
      console.warn('Redis key cleanup warning:', (e as Error).message);
    }

    // Write audit log
    await writeAudit({
      userId: req.user?.userId,
      action: 'RESOLVE_ALERT',
      entity: 'Alert',
      entityId: id,
      meta: {
        equipmentCode: updated.equipment?.code || 'INVENTORY',
        severity: updated.severity,
        type: updated.type,
      },
    });

    return res.status(200).json({
      message: 'Alert resolved successfully',
      alert: updated,
    });
  } catch (error) {
    console.error('resolveAlert error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to resolve alert.',
    });
  }
};

export const streamAlerts = async (req: Request, res: Response) => {
  try {
    // 1. Authenticate token from Authorization header or ?token= query parameter
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required for alert streaming.',
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err: any) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token.',
      });
    }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token payload.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, is_active: true },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User account is invalid or inactive.',
      });
    }

    // 2. Setup Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // 3. Send connected event
    res.write('event: connected\ndata: {"status":"connected","message":"Subscribed to live alerts"}\n\n');

    // 4. Ensure Redis subscription is active
    ensureRedisSubscribed();

    // 5. Redis message listener
    const messageListener = (channel: string, message: string) => {
      if (channel === 'alerts') {
        res.write(`data: ${message}\n\n`);
      }
    };

    redisSub.on('message', messageListener);

    // 6. Send heartbeat comment every 25 seconds
    const heartbeatTimer = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25000);

    // 7. Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(heartbeatTimer);
      redisSub.removeListener('message', messageListener);
      res.end();
    });
  } catch (error) {
    console.error('streamAlerts error:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to establish alerts event stream.',
      });
    }
  }
};
