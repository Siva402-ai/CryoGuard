import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';

const auditQuerySchema = z.object({
  userId: z.string().uuid().optional().or(z.literal('')),
  entity: z.string().trim().optional().or(z.literal('')),
  action: z.string().trim().optional().or(z.literal('')),
  from: z.string().optional().or(z.literal('')),
  to: z.string().optional().or(z.literal('')),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

/**
 * GET /audit-log
 * ADMIN only: filter and retrieve paginated audit log entries
 */
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const parseResult = auditQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid query parameters.',
        details: parseResult.error.errors,
      });
    }

    const { userId, entity, action, from, to, page, limit } = parseResult.data;

    const where: any = {};

    if (userId && userId.trim() !== '') {
      where.user_id = userId;
    }

    if (entity && entity.trim() !== '' && entity !== 'ALL') {
      where.entity = entity;
    }

    if (action && action.trim() !== '' && action !== 'ALL') {
      where.action = action;
    }

    if (from || to) {
      where.created_at = {};
      if (from && from.trim() !== '') {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) {
          where.created_at.gte = fromDate;
        }
      }
      if (to && to.trim() !== '') {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          where.created_at.lte = toDate;
        }
      }
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.status(200).json({
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error('getAuditLogs error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve audit logs.',
    });
  }
};
