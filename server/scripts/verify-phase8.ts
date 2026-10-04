import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const API_BASE = process.env.API_BASE || 'http://localhost:4000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'cryoguard_super_secret_jwt_key_development_2026';
const prisma = new PrismaClient();

function generateToken(user: { id: string; role: Role; email: string; name: string }): string {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ---------------------------------------------------------------------------
// 1. Mutual Demote Race (20 runs)
// ---------------------------------------------------------------------------
async function runDemoteRaceTest(adminA: any, adminB: any, tokenA: string, tokenB: string) {
  console.log('=== Scenario 1: Mutual Demote Race (20 runs) ===');
  console.log('Run | HTTP Status A | HTTP Status B | Final Active Admins | Result');
  console.log('----+---------------+---------------+---------------------+-------');

  for (let run = 1; run <= 20; run++) {
    try {
      // Restoration before every run: both admins set to active ADMIN
      await prisma.user.update({
        where: { id: adminA.id },
        data: { role: Role.ADMIN, is_active: true },
      });
      await prisma.user.update({
        where: { id: adminB.id },
        data: { role: Role.ADMIN, is_active: true },
      });

      // Simultaneous mutual demote requests
      const demoteB = fetch(`${API_BASE}/users/${adminB.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ name: adminB.name, email: adminB.email, role: 'STAFF' }),
      }).then(async (r) => ({ status: r.status, ok: r.ok, data: await r.json() }));

      const demoteA = fetch(`${API_BASE}/users/${adminA.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`,
        },
        body: JSON.stringify({ name: adminA.name, email: adminA.email, role: 'STAFF' }),
      }).then(async (r) => ({ status: r.status, ok: r.ok, data: await r.json() }));

      const [resA, resB] = await Promise.all([demoteB, demoteA]);

      // Query final active admin count directly from PostgreSQL
      const activeAdmins = await prisma.user.count({
        where: { role: Role.ADMIN, is_active: true },
      });

      const strStatusA = `${resA.status} ${resA.ok ? 'OK' : 'ERR'}`;
      const strStatusB = `${resB.status} ${resB.ok ? 'OK' : 'ERR'}`;
      const resultStr = activeAdmins === 1 ? 'PASS' : 'FAIL';

      console.log(
        `${String(run).padStart(3, ' ')} | ` +
        `${strStatusA.padEnd(13, ' ')} | ` +
        `${strStatusB.padEnd(13, ' ')} | ` +
        `${String(activeAdmins).padEnd(19, ' ')} | ` +
        `${resultStr}`
      );
    } finally {
      // Restore state after each run
      await prisma.user.update({
        where: { id: adminA.id },
        data: { role: Role.ADMIN, is_active: true },
      });
      await prisma.user.update({
        where: { id: adminB.id },
        data: { role: Role.ADMIN, is_active: true },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Mutual Deactivate Race (20 runs)
// ---------------------------------------------------------------------------
async function runDeactivateRaceTest(adminA: any, adminB: any, tokenA: string, tokenB: string) {
  console.log('\n=== Scenario 2: Mutual Deactivate Race (20 runs) ===');
  console.log('Run | HTTP Status A | HTTP Status B | Final Active Admins | Result');
  console.log('----+---------------+---------------+---------------------+-------');

  for (let run = 1; run <= 20; run++) {
    try {
      // Restoration before every run: both admins set to active ADMIN
      await prisma.user.update({
        where: { id: adminA.id },
        data: { role: Role.ADMIN, is_active: true },
      });
      await prisma.user.update({
        where: { id: adminB.id },
        data: { role: Role.ADMIN, is_active: true },
      });

      // Simultaneous mutual deactivate requests
      const deactB = fetch(`${API_BASE}/users/${adminB.id}/deactivate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
      }).then(async (r) => ({ status: r.status, ok: r.ok, data: await r.json() }));

      const deactA = fetch(`${API_BASE}/users/${adminA.id}/deactivate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`,
        },
      }).then(async (r) => ({ status: r.status, ok: r.ok, data: await r.json() }));

      const [resA, resB] = await Promise.all([deactB, deactA]);

      // Query final active admin count directly from PostgreSQL
      const activeAdmins = await prisma.user.count({
        where: { role: Role.ADMIN, is_active: true },
      });

      const strStatusA = `${resA.status} ${resA.ok ? 'OK' : 'ERR'}`;
      const strStatusB = `${resB.status} ${resB.ok ? 'OK' : 'ERR'}`;
      const resultStr = activeAdmins === 1 ? 'PASS' : 'FAIL';

      console.log(
        `${String(run).padStart(3, ' ')} | ` +
        `${strStatusA.padEnd(13, ' ')} | ` +
        `${strStatusB.padEnd(13, ' ')} | ` +
        `${String(activeAdmins).padEnd(19, ' ')} | ` +
        `${resultStr}`
      );
    } finally {
      // Restore state after each run
      await prisma.user.update({
        where: { id: adminA.id },
        data: { role: Role.ADMIN, is_active: true },
      });
      await prisma.user.update({
        where: { id: adminB.id },
        data: { role: Role.ADMIN, is_active: true },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Mixed Race: A demotes B vs B deactivates A (20 runs)
// ---------------------------------------------------------------------------
async function runMixedRaceTest(adminA: any, adminB: any, tokenA: string, tokenB: string) {
  console.log('\n=== Scenario 3: Mixed Race (A Demotes B vs B Deactivates A) (20 runs) ===');
  console.log('Run | HTTP Status A | HTTP Status B | Final Active Admins | Result');
  console.log('----+---------------+---------------+---------------------+-------');

  for (let run = 1; run <= 20; run++) {
    try {
      // Restoration before every run: both admins set to active ADMIN
      await prisma.user.update({
        where: { id: adminA.id },
        data: { role: Role.ADMIN, is_active: true },
      });
      await prisma.user.update({
        where: { id: adminB.id },
        data: { role: Role.ADMIN, is_active: true },
      });

      // Simultaneous mixed requests: A demotes B (PUT), B deactivates A (PATCH)
      const demoteB = fetch(`${API_BASE}/users/${adminB.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ name: adminB.name, email: adminB.email, role: 'STAFF' }),
      }).then(async (r) => ({ status: r.status, ok: r.ok, data: await r.json() }));

      const deactA = fetch(`${API_BASE}/users/${adminA.id}/deactivate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`,
        },
      }).then(async (r) => ({ status: r.status, ok: r.ok, data: await r.json() }));

      const [resA, resB] = await Promise.all([demoteB, deactA]);

      // Query final active admin count directly from PostgreSQL
      const activeAdmins = await prisma.user.count({
        where: { role: Role.ADMIN, is_active: true },
      });

      const strStatusA = `${resA.status} ${resA.ok ? 'OK' : 'ERR'}`;
      const strStatusB = `${resB.status} ${resB.ok ? 'OK' : 'ERR'}`;
      const resultStr = activeAdmins === 1 ? 'PASS' : 'FAIL';

      console.log(
        `${String(run).padStart(3, ' ')} | ` +
        `${strStatusA.padEnd(13, ' ')} | ` +
        `${strStatusB.padEnd(13, ' ')} | ` +
        `${String(activeAdmins).padEnd(19, ' ')} | ` +
        `${resultStr}`
      );
    } finally {
      // Restore state after each run
      await prisma.user.update({
        where: { id: adminA.id },
        data: { role: Role.ADMIN, is_active: true },
      });
      await prisma.user.update({
        where: { id: adminB.id },
        data: { role: Role.ADMIN, is_active: true },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Extra Edge Cases
// ---------------------------------------------------------------------------
async function runExtraCases() {
  console.log('\n=== Extra Edge Cases ===');

  // Ensure primary admin is ADMIN and Arun is STAFF
  await prisma.user.update({
    where: { email: 'admin@cryoguard.com' },
    data: { role: Role.ADMIN, is_active: true },
  });
  await prisma.user.update({
    where: { email: 'arun@cryoguard.com' },
    data: { role: Role.STAFF, is_active: true },
  });

  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@cryoguard.com' } });
  const staffUser = await prisma.user.findUnique({ where: { email: 'arun@cryoguard.com' } });

  if (!adminUser || !staffUser) {
    throw new Error('Default seeded users not found');
  }

  const adminToken = generateToken(adminUser);
  const staffToken = generateToken(staffUser);

  // 1. Password letters only
  const r1 = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'Letters Only', email: 'letters@test.com', role: 'STAFF', password: 'onlylettershere' }),
  });
  console.log('1. Password letters only (expect 400):', r1.status, JSON.stringify(await r1.json()));

  // 2. Password digits only
  const r2 = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'Digits Only', email: 'digits@test.com', role: 'STAFF', password: '123456789012' }),
  });
  console.log('2. Password digits only (expect 400):', r2.status, JSON.stringify(await r2.json()));

  // 3. Duplicate email with different case
  const r3 = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'Dup Case', email: 'ADMIN@CryoGuard.COM', role: 'STAFF', password: 'Password123' }),
  });
  console.log('3. Duplicate email with different casing (expect 409):', r3.status, JSON.stringify(await r3.json()));

  // 4. STAFF calling PATCH /users/:id/reactivate
  const r4 = await fetch(`${API_BASE}/users/00000000-0000-0000-0000-000000000001/reactivate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
  });
  console.log('4. STAFF calling PATCH /users/:id/reactivate (expect 403):', r4.status, JSON.stringify(await r4.json()));

  // 5. STAFF calling PUT /users/<random-uuid>
  const r5 = await fetch(`${API_BASE}/users/12345678-1234-1234-1234-123456789abc`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({ name: 'Test', email: 'test@test.com', role: 'STAFF' }),
  });
  console.log('5. STAFF calling PUT /users/<random-uuid> (expect 403):', r5.status, JSON.stringify(await r5.json()));

  // 6. Login as deactivated user with wrong password
  const tempUser = await prisma.user.create({
    data: {
      name: 'Temp Deactivated',
      email: 'temp_deactivated@cryoguard.test',
      role: Role.STAFF,
      password_hash: await bcrypt.hash('Correct123456', 10),
      is_active: false,
    },
  });

  try {
    const r6 = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'temp_deactivated@cryoguard.test',
        password: 'WrongPassword123',
      }),
    });
    console.log('6. Login deactivated user with WRONG password (expect 401 generic error):', r6.status, JSON.stringify(await r6.json()));
  } finally {
    // Clean up temporary user account (do not delete audit logs)
    await prisma.user.delete({ where: { id: tempUser.id } });
  }
}

async function main() {
  const adminA = await prisma.user.findUnique({ where: { email: 'admin@cryoguard.com' } });
  const adminB = await prisma.user.findUnique({ where: { email: 'arun@cryoguard.com' } });

  if (!adminA || !adminB) {
    throw new Error('Required seeded users admin@cryoguard.com and arun@cryoguard.com not found');
  }

  // Ensure other seeded users (Ravi) are STAFF so active admin count starts at exactly 2
  await prisma.user.updateMany({
    where: { email: { notIn: ['admin@cryoguard.com', 'arun@cryoguard.com'] } },
    data: { role: Role.STAFF },
  });

  const tokenA = generateToken({ id: adminA.id, role: Role.ADMIN, email: adminA.email, name: adminA.name });
  const tokenB = generateToken({ id: adminB.id, role: Role.ADMIN, email: adminB.email, name: adminB.name });

  try {
    await runDemoteRaceTest(adminA, adminB, tokenA, tokenB);
    await runDeactivateRaceTest(adminA, adminB, tokenA, tokenB);
    await runMixedRaceTest(adminA, adminB, tokenA, tokenB);
    await runExtraCases();
  } catch (err) {
    console.error('Execution error:', err);
  } finally {
    // Final restoration: admin@cryoguard.com is ADMIN and active, arun@cryoguard.com is STAFF and active
    try {
      await prisma.user.update({
        where: { email: 'admin@cryoguard.com' },
        data: { role: Role.ADMIN, is_active: true },
      });
      await prisma.user.update({
        where: { email: 'arun@cryoguard.com' },
        data: { role: Role.STAFF, is_active: true },
      });
      await prisma.user.update({
        where: { email: 'ravi@cryoguard.com' },
        data: { role: Role.STAFF, is_active: true },
      });
    } catch (cleanupErr) {
      console.error('Final restore error:', cleanupErr);
    }
    await prisma.$disconnect();
  }
}

main();
