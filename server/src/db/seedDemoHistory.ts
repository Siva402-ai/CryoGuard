import { PrismaClient, AlertType, AlertSeverity, AlertStatus, MaintenanceStatus, TransactionType } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

export function getDeterministicUuid(namespace: string, key: string | number): string {
  const hash = crypto.createHash('sha256').update(`${namespace}:${key}`).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    '8' + hash.substring(17, 20),
    hash.substring(20, 32),
  ].join('-');
}

export async function seedDemoHistory() {
  console.log('Checking demo history seeding state...');

  const users = await prisma.user.findMany();
  const adminUser = users.find((u) => u.role === 'ADMIN') || users[0];
  const staffUser = users.find((u) => u.role === 'STAFF') || users[0];
  const equipment = await prisma.equipment.findMany();
  const inventoryItems = await prisma.inventoryItem.findMany();

  if (!equipment.length || !inventoryItems.length || !adminUser || !staffUser) {
    console.error('Base seed data (equipment, inventory, users) must be present first. Run npm run prisma:seed.');
    return;
  }

  // Base timestamp anchored to fixed 6-month window
  const baseNow = new Date('2026-10-04T12:00:00.000Z');

  // 1. Reconcile and Seed Inventory Transactions (Idempotent + Invariant Guarantees)
  console.log('Reconciling and seeding historical inventory ledger...');

  for (const item of inventoryItems) {
    const isDiscrete = !['L', 'Liters', 'liters', 'kg', 'Kg'].includes(item.unit);

    // Plan transactions: 6 months (months 5 down to 0), 4 weeks per month = 24 weeks
    const plannedOut: { id: string; qty: number; date: Date; reason: string }[] = [];
    const plannedIn: { id: string; qty: number; date: Date; reason: string }[] = [];

    for (let m = 5; m >= 0; m--) {
      for (let w = 0; w < 4; w++) {
        const txDate = new Date(baseNow.getFullYear(), baseNow.getMonth() - m, 1 + w * 7, 10, 0);

        // Deterministic consumption amounts
        let outQty = 0;
        if (isDiscrete) {
          if (item.name.includes('Gloves')) {
            if (w === 0 || w === 2) outQty = 1; // 12 total
          } else if (item.name.includes('Shield')) {
            if (w === 1 && m % 2 === 0) outQty = 1; // 3 total
          } else if (item.name.includes('Gaskets')) {
            if (w === 0 && m % 2 === 0) outQty = 2; // 6 total
          } else if (item.name.includes('Valve')) {
            if (w === 2 && (m === 1 || m === 4)) outQty = 1; // 2 total
          }
        } else {
          if (item.material === 'LN2') {
            outQty = 200; // 24 * 200 = 4800
          } else if (item.material === 'LOX') {
            outQty = 30; // 24 * 30 = 720
          } else if (item.material === 'ARGON') {
            outQty = 100; // 24 * 100 = 2400
          }
        }

        if (outQty > 0) {
          const outId = getDeterministicUuid('inv-tx', `${item.id}-m${m}-w${w}-out`);
          plannedOut.push({
            id: outId,
            qty: outQty,
            date: new Date(txDate.getTime() + 2 * 60 * 60 * 1000),
            reason: 'Routine operational consumption',
          });
        }

        // Deterministic restocking amounts
        let inQty = 0;
        if (isDiscrete) {
          if (item.name.includes('Gloves')) {
            if (w === 3 && (m === 1 || m === 3 || m === 5)) inQty = 4; // 12 total
          } else if (item.name.includes('Shield')) {
            if (w === 3 && (m === 2 || m === 4 || m === 5)) inQty = 1; // 3 total
          } else if (item.name.includes('Gaskets')) {
            if (w === 3 && (m === 1 || m === 3 || m === 5)) inQty = 2; // 6 total
          } else if (item.name.includes('Valve')) {
            if (w === 3 && (m === 2 || m === 5)) inQty = 1; // 2 total
          }
        } else {
          if (item.material === 'LN2') {
            if (w === 1 || w === 3) inQty = 300; // 12 * 300 = 3600
          } else if (item.material === 'LOX') {
            if (w === 1 || w === 3) inQty = 30; // 12 * 30 = 360
          } else if (item.material === 'ARGON') {
            if (w === 1 || w === 3) inQty = 150; // 12 * 150 = 1800
          }
        }

        if (inQty > 0) {
          const inId = getDeterministicUuid('inv-tx', `${item.id}-m${m}-w${w}-in`);
          plannedIn.push({
            id: inId,
            qty: inQty,
            date: new Date(txDate.getTime() + 26 * 60 * 60 * 1000),
            reason: 'Scheduled replenishment receipt',
          });
        }
      }
    }

    // 1. Upsert weekly OUT transactions
    for (const outTx of plannedOut) {
      await prisma.inventoryTransaction.upsert({
        where: { id: outTx.id },
        update: {
          item_id: item.id,
          type: TransactionType.OUT,
          quantity: outTx.qty,
          reason: outTx.reason,
          user_id: staffUser.id,
          created_at: outTx.date,
        },
        create: {
          id: outTx.id,
          item_id: item.id,
          type: TransactionType.OUT,
          quantity: outTx.qty,
          reason: outTx.reason,
          user_id: staffUser.id,
          created_at: outTx.date,
        },
      });
    }

    // 2. Upsert weekly IN transactions
    for (const inTx of plannedIn) {
      await prisma.inventoryTransaction.upsert({
        where: { id: inTx.id },
        update: {
          item_id: item.id,
          type: TransactionType.IN,
          quantity: inTx.qty,
          reason: inTx.reason,
          user_id: adminUser.id,
          created_at: inTx.date,
        },
        create: {
          id: inTx.id,
          item_id: item.id,
          type: TransactionType.IN,
          quantity: inTx.qty,
          reason: inTx.reason,
          user_id: adminUser.id,
          created_at: inTx.date,
        },
      });
    }

    // 3. Dynamically calculate exact opening balance so opening + other = item.quantity
    const openingId = getDeterministicUuid('inv-tx', `${item.id}-opening`);
    const otherTxs = await prisma.inventoryTransaction.findMany({
      where: {
        item_id: item.id,
        id: { not: openingId },
      },
    });

    const otherSum = otherTxs.reduce((acc, t) => {
      if (t.type === 'IN') return acc + t.quantity;
      if (t.type === 'OUT') return acc - t.quantity;
      if (t.type === 'ADJUST') return acc + t.quantity;
      return acc;
    }, 0);

    const openingQty = Math.round((item.quantity - otherSum) * 100) / 100;
    const openingDate = new Date(baseNow.getFullYear(), baseNow.getMonth() - 5, 1, 8, 0);

    // Upsert opening balance transaction
    await prisma.inventoryTransaction.upsert({
      where: { id: openingId },
      update: {
        item_id: item.id,
        type: TransactionType.IN,
        quantity: openingQty,
        reason: 'Initial opening balance',
        user_id: adminUser.id,
        created_at: openingDate,
      },
      create: {
        id: openingId,
        item_id: item.id,
        type: TransactionType.IN,
        quantity: openingQty,
        reason: 'Initial opening balance',
        user_id: adminUser.id,
        created_at: openingDate,
      },
    });
  }

  // 2. Seed Historical Alerts (Resolved) across past 6 months (Idempotent)
  console.log('Seeding historical resolved alerts...');
  const alertTypes: AlertType[] = [
    AlertType.TEMPERATURE,
    AlertType.PRESSURE,
    AlertType.LEVEL,
    AlertType.INSPECTION,
    AlertType.MAINTENANCE,
  ];

  for (let m = 5; m >= 0; m--) {
    const monthDate = new Date(baseNow.getFullYear(), baseNow.getMonth() - m, 5);
    const countForMonth = 5;

    for (let i = 0; i < countForMonth; i++) {
      const eq = equipment[(m * 5 + i) % equipment.length];
      const type = alertTypes[(m + i) % alertTypes.length];
      const isCritical = (i + m) % 3 === 0;
      const severity = isCritical ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;

      const alertDay = Math.min(28, 2 + i * 5);
      const createdAt = new Date(monthDate.getFullYear(), monthDate.getMonth(), alertDay, 8 + (i % 8), 15);
      const ackAt = new Date(createdAt.getTime() + (20 + (i % 30)) * 60 * 1000);
      const resAt = new Date(ackAt.getTime() + (45 + (i % 60)) * 60 * 1000);
      const alertId = getDeterministicUuid('alert', `tank-${m}-${i}`);

      const alertVal =
        type === AlertType.TEMPERATURE
          ? isCritical
            ? -184.2
            : -188.5
          : type === AlertType.PRESSURE
            ? isCritical
              ? 2.3
              : 1.9
            : null;

      await prisma.alert.upsert({
        where: { id: alertId },
        update: {
          equipment_id: eq.id,
          type,
          severity,
          message: `${eq.code} ${type.toLowerCase()} threshold exceeded during routine shift check`,
          value: alertVal,
          status: AlertStatus.RESOLVED,
          acknowledged_by: staffUser.id,
          acknowledged_at: ackAt,
          resolved_by: adminUser.id,
          resolved_at: resAt,
          created_at: createdAt,
        },
        create: {
          id: alertId,
          equipment_id: eq.id,
          type,
          severity,
          message: `${eq.code} ${type.toLowerCase()} threshold exceeded during routine shift check`,
          value: alertVal,
          status: AlertStatus.RESOLVED,
          acknowledged_by: staffUser.id,
          acknowledged_at: ackAt,
          resolved_by: adminUser.id,
          resolved_at: resAt,
          created_at: createdAt,
        },
      });
    }

    // Add inventory alerts (equipment_id = null)
    if (m % 2 === 0) {
      const item = inventoryItems[m % inventoryItems.length];
      const invCreatedAt = new Date(monthDate.getFullYear(), monthDate.getMonth(), 14, 10, 0);
      const invAckAt = new Date(invCreatedAt.getTime() + 30 * 60 * 1000);
      const invResAt = new Date(invCreatedAt.getTime() + 180 * 60 * 1000);
      const invAlertId = getDeterministicUuid('alert', `inv-${m}`);

      await prisma.alert.upsert({
        where: { id: invAlertId },
        update: {
          equipment_id: null,
          source_id: item.id,
          type: AlertType.INVENTORY,
          severity: AlertSeverity.WARNING,
          message: `Item ${item.name} stock fell below threshold`,
          status: AlertStatus.RESOLVED,
          acknowledged_by: staffUser.id,
          acknowledged_at: invAckAt,
          resolved_by: adminUser.id,
          resolved_at: invResAt,
          created_at: invCreatedAt,
        },
        create: {
          id: invAlertId,
          equipment_id: null,
          source_id: item.id,
          type: AlertType.INVENTORY,
          severity: AlertSeverity.WARNING,
          message: `Item ${item.name} stock fell below threshold`,
          status: AlertStatus.RESOLVED,
          acknowledged_by: staffUser.id,
          acknowledged_at: invAckAt,
          resolved_by: adminUser.id,
          resolved_at: invResAt,
          created_at: invCreatedAt,
        },
      });
    }
  }

  // 3. Seed Maintenance Tasks across past 6 months (Idempotent)
  console.log('Seeding historical maintenance tasks...');
  const taskTemplates = [
    { title: 'Pressure Relief Valve Calibration', desc: 'Inspect and test relief valves against ASME cryo limits' },
    { title: 'Vacuum Jacket Vacuum Test', desc: 'Measure annular space vacuum level with thermocouple gauge' },
    { title: 'Emergency Shutoff Valve Actuation Test', desc: 'Verify pneumatic actuator closing time under 2 seconds' },
    { title: 'Cryogenic Seal & Flange Inspection', desc: 'Thermal imaging and bubble leak test on primary inlet flanges' },
    { title: 'Telemetry Sensor Re-zeroing', desc: 'Calibrate differential pressure transmitter and RTD probes' },
  ];

  for (let m = 5; m >= 0; m--) {
    const monthDate = new Date(baseNow.getFullYear(), baseNow.getMonth() - m, 1);
    const countForMonth = 4;

    for (let i = 0; i < countForMonth; i++) {
      const eq = equipment[(m * 4 + i) % equipment.length];
      const tmpl = taskTemplates[(m + i) % taskTemplates.length];
      const dueDay = Math.min(28, 5 + i * 6);
      const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay, 14, 0);
      const taskId = getDeterministicUuid('task', `task-${m}-${i}`);

      let status: MaintenanceStatus = MaintenanceStatus.COMPLETED;
      let completedAt: Date | null = new Date(dueDate.getTime() - 4 * 60 * 60 * 1000);
      let notes = 'Completed per SOP. All checks verified normal.';

      if (m === 0 && i === 3) {
        status = MaintenanceStatus.OVERDUE;
        completedAt = null;
        notes = 'Task delayed due to replacement part procurement.';
      } else if ((m + i) % 5 === 0) {
        completedAt = new Date(dueDate.getTime() + 36 * 60 * 60 * 1000);
        notes = 'Completed with slight delay due to weather conditions.';
      }

      await prisma.maintenanceTask.upsert({
        where: { id: taskId },
        update: {
          equipment_id: eq.id,
          title: tmpl.title,
          description: tmpl.desc,
          due_date: dueDate,
          assigned_to: i % 2 === 0 ? staffUser.id : adminUser.id,
          status,
          recurrence_days: 30,
          completed_at: completedAt,
          notes,
        },
        create: {
          id: taskId,
          equipment_id: eq.id,
          title: tmpl.title,
          description: tmpl.desc,
          due_date: dueDate,
          assigned_to: i % 2 === 0 ? staffUser.id : adminUser.id,
          status,
          recurrence_days: 30,
          completed_at: completedAt,
          notes,
        },
      });
    }
  }

  console.log('Demo history seeding and ledger reconciliation completed successfully.');
}

if (require.main === module) {
  seedDemoHistory()
    .catch((e) => {
      console.error('Error during demo history seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
