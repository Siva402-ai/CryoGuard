import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole } from '../middleware/auth';
import { JWT_SECRET } from '../config/auth';

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cryoguard_test?schema=public';

if (!dbUrl.includes('cryoguard_test')) {
  throw new Error('Test suite must run against cryoguard_test database only. Refusing execution.');
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

describe('Live Role & DB Authorization Middleware Tests', () => {
  let testAdminUser: any;
  let testStaffUser: any;

  beforeAll(async () => {
    // Create dedicated test users in cryoguard_test
    testAdminUser = await prisma.user.upsert({
      where: { email: 'auth_test_admin@cryoguard.test' },
      update: { role: Role.ADMIN, is_active: true },
      create: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Test Admin Live',
        email: 'auth_test_admin@cryoguard.test',
        password_hash: 'hash',
        role: Role.ADMIN,
        is_active: true,
      },
    });

    testStaffUser = await prisma.user.upsert({
      where: { email: 'auth_test_staff@cryoguard.test' },
      update: { role: Role.STAFF, is_active: true },
      create: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Test Staff Live',
        email: 'auth_test_staff@cryoguard.test',
        password_hash: 'hash',
        role: Role.STAFF,
        is_active: true,
      },
    });
  });

  afterAll(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        email: { in: ['auth_test_admin@cryoguard.test', 'auth_test_staff@cryoguard.test'] },
      },
    });
    await prisma.$disconnect();
  });

  it('authenticates active user and populates req.user from live database record', async () => {
    // Issue token with role: ADMIN in JWT payload
    const token = jwt.sign(
      { userId: testAdminUser.id, role: 'ADMIN', email: testAdminUser.email },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const req: any = {
      headers: { authorization: `Bearer ${token}` },
    };
    const res: any = {
      status: (code: number) => ({
        json: (data: any) => ({ statusCode: code, data }),
      }),
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await requireAuth(req, res, next);
    expect(nextCalled).toBe(true);
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe(testAdminUser.id);
    expect(req.user.role).toBe(Role.ADMIN);
  });

  it('rejects deactivated user with 401 even if JWT is valid and says active', async () => {
    // Deactivate user in database
    await prisma.user.update({
      where: { id: testStaffUser.id },
      data: { is_active: false },
    });

    // JWT payload still claims user is active
    const token = jwt.sign(
      { userId: testStaffUser.id, role: 'STAFF', email: testStaffUser.email },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    let responseCode = 0;
    let responseBody: any = null;
    const req: any = {
      headers: { authorization: `Bearer ${token}` },
    };
    const res: any = {
      status: (code: number) => {
        responseCode = code;
        return {
          json: (data: any) => {
            responseBody = data;
          },
        };
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await requireAuth(req, res, next);
    expect(nextCalled).toBe(false);
    expect(responseCode).toBe(401);
    expect(responseBody.message).toContain('deactivated');

    // Restore active state
    await prisma.user.update({
      where: { id: testStaffUser.id },
      data: { is_active: true },
    });
  });

  it('denies access (403) to a demoted admin whose JWT payload still says ADMIN', async () => {
    // 1. Demote testAdminUser to STAFF in the live database
    await prisma.user.update({
      where: { id: testAdminUser.id },
      data: { role: Role.STAFF },
    });

    // 2. Token was minted previously with role: 'ADMIN' in the payload
    const staleAdminToken = jwt.sign(
      { userId: testAdminUser.id, role: 'ADMIN', email: testAdminUser.email },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const req: any = {
      headers: { authorization: `Bearer ${staleAdminToken}` },
    };
    let authNextCalled = false;
    const authNext = () => {
      authNextCalled = true;
    };

    const res: any = {
      status: (code: number) => ({
        json: (data: any) => ({ statusCode: code, data }),
      }),
    };

    // requireAuth reads live role from DB -> req.user.role becomes 'STAFF'
    await requireAuth(req, res, authNext);
    expect(authNextCalled).toBe(true);
    expect(req.user.role).toBe(Role.STAFF);

    // 3. requireRole('ADMIN') evaluates req.user.role (from live DB) and denies access with 403
    let roleResponseCode = 0;
    let roleResponseBody: any = null;
    const roleRes: any = {
      status: (code: number) => {
        roleResponseCode = code;
        return {
          json: (data: any) => {
            roleResponseBody = data;
          },
        };
      },
    };
    let roleNextCalled = false;
    const roleNext = () => {
      roleNextCalled = true;
    };

    const adminGuard = requireRole(Role.ADMIN);
    adminGuard(req, roleRes, roleNext);

    expect(roleNextCalled).toBe(false);
    expect(roleResponseCode).toBe(403);
    expect(roleResponseBody.error).toBe('Forbidden');

    // Restore admin role
    await prisma.user.update({
      where: { id: testAdminUser.id },
      data: { role: Role.ADMIN },
    });
  });
});
