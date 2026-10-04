import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const TEST_DB_URL = 'postgresql://postgres:postgres@localhost:5432/cryoguard_test?schema=public';
const ADMIN_DB_URL = 'postgresql://postgres:postgres@localhost:5432/cryoguard?schema=public';

async function getCounts(prisma: PrismaClient) {
  const [users, equipment, inventoryItems, transactions, inspections, templates, maintenanceTasks, alerts, auditLogs] = await Promise.all([
    prisma.user.count(),
    prisma.equipment.count(),
    prisma.inventoryItem.count(),
    prisma.inventoryTransaction.count(),
    prisma.inspection.count(),
    prisma.inspectionTemplate.count(),
    prisma.maintenanceTask.count(),
    prisma.alert.count(),
    prisma.auditLog.count()
  ]);
  return { users, equipment, inventoryItems, transactions, inspections, templates, maintenanceTasks, alerts, auditLogs };
}

async function main() {
  console.log('=== Fresh-DB Proof on cryoguard_test ===\n');

  // Step 1: Drop and recreate cryoguard_test
  console.log('1. Dropping and recreating cryoguard_test...');
  const adminPrisma = new PrismaClient({ datasources: { db: { url: ADMIN_DB_URL } } });
  await adminPrisma.$executeRawUnsafe(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'cryoguard_test' AND pid <> pg_backend_pid();
  `);
  await adminPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS cryoguard_test;`);
  await adminPrisma.$executeRawUnsafe(`CREATE DATABASE cryoguard_test;`);
  await adminPrisma.$disconnect();
  console.log('Database cryoguard_test recreated successfully.');

  // Step 2: Deploy migrations
  console.log('\n2. Running prisma migrate deploy on cryoguard_test...');
  execSync('npx prisma migrate deploy', {
    cwd: './server',
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'inherit'
  });

  const testPrisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

  // Step 3: Run base seed
  console.log('\n3. Running base seed on cryoguard_test...');
  execSync('npx tsx prisma/seed.ts', {
    cwd: './server',
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'inherit'
  });
  const countsAfterBase = await getCounts(testPrisma);
  console.log('Row counts after Base Seed:', countsAfterBase);

  // Step 4: Run seed:demo-history run 1
  console.log('\n4. Running seed:demo-history (Run 1)...');
  execSync('npx tsx src/db/seedDemoHistory.ts', {
    cwd: './server',
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'inherit'
  });
  const countsAfterDemo1 = await getCounts(testPrisma);
  console.log('Row counts after Demo History Run 1:', countsAfterDemo1);

  // Step 5: Run seed:demo-history run 2 (Idempotency proof)
  console.log('\n5. Running seed:demo-history (Run 2 - Idempotency Proof)...');
  execSync('npx tsx src/db/seedDemoHistory.ts', {
    cwd: './server',
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'inherit'
  });
  const countsAfterDemo2 = await getCounts(testPrisma);
  console.log('Row counts after Demo History Run 2:', countsAfterDemo2);

  // Verification of identical counts
  console.log('\nIdempotency check (Run 1 vs Run 2 identical):', JSON.stringify(countsAfterDemo1) === JSON.stringify(countsAfterDemo2) ? 'PASS' : 'FAIL');

  // Step 6: Inventory Invariant SQL
  console.log('\n=== Inventory Invariant Check ===');
  const inventoryInvariant: any = await testPrisma.$queryRawUnsafe(`
    SELECT 
      i.id,
      i.name,
      i.quantity as item_stock,
      COALESCE(SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE -t.quantity END), 0) as ledger_sum,
      CASE WHEN i.quantity = COALESCE(SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE -t.quantity END), 0) THEN 'MATCH' ELSE 'MISMATCH' END as invariant
    FROM inventory_items i
    LEFT JOIN inventory_transactions t ON i.id = t.item_id
    GROUP BY i.id, i.name, i.quantity
    ORDER BY i.name;
  `);
  console.table(inventoryInvariant);

  // Step 7: Future-dated rows count
  console.log('\n=== Future-Dated Rows Check (Must be 0) ===');
  const futureRows: any = await testPrisma.$queryRawUnsafe(`
    SELECT 'alerts' as tbl, count(*) FROM alerts WHERE created_at > NOW() OR acknowledged_at > NOW() OR resolved_at > NOW()
    UNION ALL
    SELECT 'inspections' as tbl, count(*) FROM inspections WHERE performed_at > NOW()
    UNION ALL
    SELECT 'inventory_transactions' as tbl, count(*) FROM inventory_transactions WHERE created_at > NOW()
    UNION ALL
    SELECT 'restock_requests' as tbl, count(*) FROM restock_requests WHERE created_at > NOW()
    UNION ALL
    SELECT 'audit_log' as tbl, count(*) FROM audit_log WHERE created_at > NOW();
  `);
  console.table(futureRows);

  // Step 8: Group by reason
  console.log('\n=== Inventory Transactions By Reason ===');
  const txByReason: any = await testPrisma.$queryRawUnsafe(`
    SELECT reason, count(*) as count 
    FROM inventory_transactions 
    GROUP BY reason 
    ORDER BY count DESC;
  `);
  console.table(txByReason);

  // Step 9: Case-insensitive search for "demo"
  console.log('\n=== Case-Insensitive Search for "demo" (Must be 0 hits) ===');
  const demoHits: any = await testPrisma.$queryRawUnsafe(`
    SELECT 'alerts.message' as location, count(*) as hits FROM alerts WHERE message ILIKE '%demo%'
    UNION ALL
    SELECT 'maintenance_tasks.title' as location, count(*) as hits FROM maintenance_tasks WHERE title ILIKE '%demo%'
    UNION ALL
    SELECT 'maintenance_tasks.description' as location, count(*) as hits FROM maintenance_tasks WHERE description ILIKE '%demo%'
    UNION ALL
    SELECT 'maintenance_tasks.notes' as location, count(*) as hits FROM maintenance_tasks WHERE notes ILIKE '%demo%'
    UNION ALL
    SELECT 'inventory_transactions.reason' as location, count(*) as hits FROM inventory_transactions WHERE reason ILIKE '%demo%'
    UNION ALL
    SELECT 'inspections.findings' as location, count(*) as hits FROM inspections WHERE findings ILIKE '%demo%'
    UNION ALL
    SELECT 'inspections.corrective_action' as location, count(*) as hits FROM inspections WHERE corrective_action ILIKE '%demo%'
    UNION ALL
    SELECT 'audit_log.meta' as location, count(*) as hits FROM audit_log WHERE meta::text ILIKE '%demo%';
  `);
  console.table(demoHits);

  await testPrisma.$disconnect();
}

main().catch(console.error);
