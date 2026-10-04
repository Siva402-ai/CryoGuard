import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { prisma } from '../db/prisma';

export const userRouter = Router();

// Only ADMIN can access /api/users
userRouter.use(requireAuth, requireRole('ADMIN'));

userRouter.get('/', async (_req: Request, res: Response) => {
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
