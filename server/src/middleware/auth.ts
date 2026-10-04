import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { AuthUser } from '../types/express';
import { prisma } from '../db/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'cryoguard_super_secret_jwt_key_development_2026';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required.',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is missing.',
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Token has expired. Please log in again.',
        });
      }
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authentication token.',
      });
    }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token payload.',
      });
    }

    // Verify user exists and is active in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, role: true, is_active: true },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User account no longer exists.',
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Your account has been deactivated. Contact an administrator.',
      });
    }

    req.user = {
      userId: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    };

    next();
  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to authenticate user.',
    });
  }
};

export const requireRole = (allowedRole: Role | Role[]) => {
  const roles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Requires ${roles.join(' or ')} privileges.`,
      });
    }

    next();
  };
};
