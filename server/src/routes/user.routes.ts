import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  getUserOptions,
  getUsers,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
} from '../controllers/user.controller';

export const userRouter = Router();

// GET /users/options - Accessible by any authenticated user (staff + admin)
userRouter.get('/options', requireAuth, getUserOptions);

// Admin-only user management endpoints
userRouter.get('/', requireAuth, requireRole('ADMIN'), getUsers);
userRouter.post('/', requireAuth, requireRole('ADMIN'), createUser);
userRouter.put('/:id', requireAuth, requireRole('ADMIN'), updateUser);
userRouter.patch('/:id/deactivate', requireAuth, requireRole('ADMIN'), deactivateUser);
userRouter.patch('/:id/reactivate', requireAuth, requireRole('ADMIN'), reactivateUser);
