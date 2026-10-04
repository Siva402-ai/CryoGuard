import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../db/prisma';
import { writeAudit } from '../utils/audit';

const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{10,}$/;

const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address')
    .transform((val) => val.toLowerCase()),
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'Role must be either ADMIN or STAFF' }),
  }),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters long')
    .regex(passwordRegex, 'Password must contain at least one letter and at least one number'),
});

const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address')
    .transform((val) => val.toLowerCase()),
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'Role must be either ADMIN or STAFF' }),
  }),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters long')
    .regex(passwordRegex, 'Password must contain at least one letter and at least one number')
    .optional()
    .or(z.literal('')),
});

/**
 * GET /users/options
 * Accessible by any authenticated user for assigning tasks
 */
export const getUserOptions = async (_req: Request, res: Response) => {
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
    console.error('getUserOptions error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve active users.',
    });
  }
};

/**
 * GET /users
 * ADMIN only: list all users
 */
export const getUsers = async (_req: Request, res: Response) => {
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
    console.error('getUsers error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve users list.',
    });
  }
};

/**
 * POST /users
 * ADMIN only: create a new user
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid input data';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parseResult.error.errors,
      });
    }

    const { name, email, role, password } = parseResult.data;

    // Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A user with this email address already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        role,
        password_hash: passwordHash,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        created_at: true,
      },
    });

    // Write audit log (NEVER include password or hash)
    await writeAudit({
      userId: req.user?.userId,
      action: 'CREATE_USER',
      entity: 'User',
      entityId: newUser.id,
      meta: {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });

    return res.status(201).json({
      message: 'User created successfully',
      user: newUser,
    });
  } catch (error) {
    console.error('createUser error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create user.',
    });
  }
};

/**
 * PUT /users/:id
 * ADMIN only: update user details and optional password reset
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.userId;

    const parseResult = updateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid input data';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parseResult.error.errors,
      });
    }

    const { name, email, role, password } = parseResult.data;

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: `User with ID '${id}' was not found.`,
      });
    }

    // Safety rule 1: An admin cannot demote their own account
    if (currentUserId === targetUser.id && targetUser.role === Role.ADMIN && role === Role.STAFF) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'You cannot demote your own account from ADMIN.',
      });
    }

    // Check duplicate email
    if (email !== targetUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });
      if (emailExists) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'A user with this email address already exists.',
        });
      }
    }

    // Transaction to safely update and enforce the last-admin rule
    const result = await prisma.$transaction(async (tx) => {
      // Safety rule 2: If demoting an active ADMIN, ensure at least one active ADMIN remains
      if (targetUser.role === Role.ADMIN && role === Role.STAFF && targetUser.is_active) {
        await tx.$executeRaw`LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE`;
        const activeAdminsCount = await tx.user.count({
          where: {
            role: Role.ADMIN,
            is_active: true,
          },
        });

        if (activeAdminsCount <= 1) {
          throw new Error('LAST_ACTIVE_ADMIN');
        }
      }

      const updateData: any = {
        name,
        email,
        role,
      };

      let passwordChanged = false;
      if (password && password.trim().length > 0) {
        updateData.password_hash = await bcrypt.hash(password, 10);
        passwordChanged = true;
      }

      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          is_active: true,
          created_at: true,
        },
      });

      return { updated, passwordChanged };
    });

    // Determine changed fields for audit log
    const changes: string[] = [];
    if (targetUser.name !== name) changes.push('name');
    if (targetUser.email !== email) changes.push('email');
    if (targetUser.role !== role) changes.push('role');

    const meta: any = {
      changedFields: changes,
    };

    if (targetUser.role !== role) {
      meta.oldRole = targetUser.role;
      meta.newRole = role;
    }

    await writeAudit({
      userId: currentUserId,
      action: 'UPDATE_USER',
      entity: 'User',
      entityId: id,
      meta,
    });

    if (result.passwordChanged) {
      await writeAudit({
        userId: currentUserId,
        action: 'RESET_USER_PASSWORD',
        entity: 'User',
        entityId: id,
        meta: {
          email: result.updated.email,
        },
      });
    }

    return res.status(200).json({
      message: 'User updated successfully',
      user: result.updated,
    });
  } catch (error: any) {
    if (error.message === 'LAST_ACTIVE_ADMIN') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot demote the last remaining active administrator.',
      });
    }
    console.error('updateUser error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update user.',
    });
  }
};

/**
 * PATCH /users/:id/deactivate
 * ADMIN only: deactivate user
 */
export const deactivateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.userId;

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: `User with ID '${id}' was not found.`,
      });
    }

    // Safety rule 1: An admin cannot deactivate their own account
    if (currentUserId === targetUser.id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'You cannot deactivate your own account.',
      });
    }

    if (!targetUser.is_active) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'User is already deactivated.',
      });
    }

    // Transaction to safely deactivate and enforce last-admin rule
    const updated = await prisma.$transaction(async (tx) => {
      if (targetUser.role === Role.ADMIN) {
        await tx.$executeRaw`LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE`;
        const activeAdminsCount = await tx.user.count({
          where: {
            role: Role.ADMIN,
            is_active: true,
          },
        });

        if (activeAdminsCount <= 1) {
          throw new Error('LAST_ACTIVE_ADMIN');
        }
      }

      return await tx.user.update({
        where: { id },
        data: { is_active: false },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          is_active: true,
          created_at: true,
        },
      });
    });

    await writeAudit({
      userId: currentUserId,
      action: 'DEACTIVATE_USER',
      entity: 'User',
      entityId: id,
      meta: {
        email: targetUser.email,
        role: targetUser.role,
      },
    });

    return res.status(200).json({
      message: 'User deactivated successfully',
      user: updated,
    });
  } catch (error: any) {
    if (error.message === 'LAST_ACTIVE_ADMIN') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot deactivate the last remaining active administrator.',
      });
    }
    console.error('deactivateUser error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to deactivate user.',
    });
  }
};

/**
 * PATCH /users/:id/reactivate
 * ADMIN only: reactivate user
 */
export const reactivateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.userId;

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: `User with ID '${id}' was not found.`,
      });
    }

    if (targetUser.is_active) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'User is already active.',
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { is_active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        created_at: true,
      },
    });

    await writeAudit({
      userId: currentUserId,
      action: 'REACTIVATE_USER',
      entity: 'User',
      entityId: id,
      meta: {
        email: targetUser.email,
        role: targetUser.role,
      },
    });

    return res.status(200).json({
      message: 'User reactivated successfully',
      user: updated,
    });
  } catch (error) {
    console.error('reactivateUser error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reactivate user.',
    });
  }
};
