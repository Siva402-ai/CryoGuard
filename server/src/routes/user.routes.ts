import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { prisma } from '../db/prisma';

export const userRouter = Router();

// GET /users/options for any authenticated user (active users only, id and name)
userRouter.get('/options', requireAuth, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      users,
      count: users.length,
    });
  } catch (error) {
    console.error('Fetch user options error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve active users.',
    });
  }
});

// Admin-only /users list
userRouter.get('/', requireAuth, requireRole('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });

    return res.status(200).json({
      users,
      count: users.length,
    });
  } catch (error) {
    console.error('Fetch users error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve users list.',
    });
  }
});
