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
  const equipment = await prisma.equipment.findMany({ orderBy: { code: 'asc' } });
  const inventoryItems = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });

  if (!equipment.length || !inventoryItems.length || !adminUser || !staffUser) {
    console.error('Base seed data (equipment, inventory, users) must be present first. Run npm run prisma:seed.');
    return;
  }

  // Anchor to current time or latest static benchmark (guaranteeing <= now)
  const now = new Date();

  // 1. Reconcile and Seed Inventory Transactions (Idempotent + Invariant Guarantees + Discrete Integer Rule)
  console.log('Reconciling and seeding historical inventory ledger...');

  for (const item of inventoryItems) {
    const isDiscrete = !['L', 'Liters', 'liters', 'kg', 'Kg'].includes(item.unit);

    // Correct non-integer discrete item quantities (e.g. 0.5 -> 1)
    if (isDiscrete && !Number.isInteger(item.quantity)) {
      const correctedQty = Math.ceil(item.quantity);
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: correctedQty },
      });
      item.quantity = correctedQty;
    }

    // 4 weeks of history spread across past 28 days
    const plannedOut: { id: string; qty: number; date: Date; reason: string }[] = [];
    const plannedIn: { id: string; qty: number; date: Date; reason: string }[] = [];

    for (let dayOffset = 28; dayOffset >= 1; dayOffset -= 7) {
      const txBaseTime = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);

      // Deterministic consumption
      let outQty = 0;
      if (isDiscrete) {
        if (item.name.includes('Gloves')) outQty = 1;
        else if (item.name.includes('Shield') && dayOffset % 14 === 0) outQty = 1;
        else if (item.name.includes('Gaskets')) outQty = 2;
        else if (item.name.includes('Valve') && dayOffset === 14) outQty = 1;
      } else {
        if (item.material === 'LN2') outQty = 250;
        else if (item.material === 'LOX') outQty = 40;
        else if (item.material === 'ARGON') outQty = 120;
      }

      if (outQty > 0) {
        const outId = getDeterministicUuid('inv-tx', `${item.id}-day${dayOffset}-out`);
        plannedOut.push({
          id: outId,
          qty: outQty,
          date: new Date(txBaseTime.getTime() + 2 * 60 * 60 * 1000),
          reason: 'Routine operational consumption',
        });
      }

      // Deterministic restocking
      let inQty = 0;
      if (isDiscrete) {
        if (item.name.includes('Gloves') && dayOffset % 14 === 0) inQty = 4;
        else if (item.name.includes('Shield') && dayOffset === 28) inQty = 1;
        else if (item.name.includes('Gaskets') && dayOffset % 14 === 0) inQty = 4;
        else if (item.name.includes('Valve') && dayOffset === 28) inQty = 2;
      } else {
        if (item.material === 'LN2' && dayOffset % 14 === 0) inQty = 500;
        else if (item.material === 'LOX' && dayOffset % 14 === 0) inQty = 80;
        else if (item.material === 'ARGON' && dayOffset % 14 === 0) inQty = 240;
      }

      if (inQty > 0) {
        const inId = getDeterministicUuid('inv-tx', `${item.id}-day${dayOffset}-in`);
        plannedIn.push({
          id: inId,
          qty: inQty,
          date: new Date(txBaseTime.getTime() + 14 * 60 * 60 * 1000),
          reason: 'Scheduled replenishment receipt',
        });
      }
    }

    // 1. Upsert OUT transactions
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

    // 2. Upsert IN transactions
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

    const openingQty = isDiscrete
      ? Math.round(item.quantity - otherSum)
      : Math.round((item.quantity - otherSum) * 100) / 100;
    const openingDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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

  // 2. Seed Historical Alerts (Resolved) across past 30 days (Idempotent)
  console.log('Seeding historical resolved alerts...');

  for (let dayOffset = 29; dayOffset >= 2; dayOffset -= 3) {
    const alertBaseTime = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const eqIndex = Math.floor(dayOffset / 3) % equipment.length;
    const eq = equipment[eqIndex];

    // Determine realistic metric and message per alert type
    const mod = dayOffset % 5;
    let type: AlertType;
    let severity: AlertSeverity = AlertSeverity.WARNING;
    let message = '';
    let val: number | null = null;

    if (mod === 0) {
      type = AlertType.TEMPERATURE;
      severity = AlertSeverity.CRITICAL;
      val = eq.temp_crit_c + 0.5;
      message = `${eq.code} temperature ${val.toFixed(2)}°C exceeded critical threshold (${eq.temp_crit_c.toFixed(2)}°C)`;
    } else if (mod === 1) {
      type = AlertType.PRESSURE;
      severity = AlertSeverity.WARNING;
      val = eq.pressure_warn_bar + 0.05;
      message = `${eq.code} pressure ${val.toFixed(2)} bar exceeded warning threshold (${eq.pressure_warn_bar.toFixed(2)} bar)`;
    } else if (mod === 2) {
      type = AlertType.LEVEL;
      severity = AlertSeverity.WARNING;
      val = eq.level_warn_pct - 1.5;
      message = `${eq.code} level ${val.toFixed(2)}% dropped below warning threshold (${eq.level_warn_pct.toFixed(2)}%)`;
    } else if (mod === 3) {
      type = AlertType.MAINTENANCE;
      severity = AlertSeverity.CRITICAL;
      message = `${eq.code} maintenance overdue: Pressure Relief Valve Calibration`;
    } else {
      type = AlertType.INSPECTION;
      severity = AlertSeverity.WARNING;
      message = `${eq.code} inspection needs attention: Vacuum Jacket Insulation Integrity Check`;
    }

    const alertId = getDeterministicUuid('alert', `tank-day-${dayOffset}`);
    const createdAt = new Date(alertBaseTime.getTime() + 8 * 60 * 60 * 1000);
    const ackAt = new Date(createdAt.getTime() + 15 * 60 * 1000);
    const resAt = new Date(ackAt.getTime() + 45 * 60 * 1000);

    await prisma.alert.upsert({
      where: { id: alertId },
      update: {
        equipment_id: eq.id,
        type,
        severity,
        message,
        value: val,
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
        message,
        value: val,
        status: AlertStatus.RESOLVED,
        acknowledged_by: staffUser.id,
        acknowledged_at: ackAt,
        resolved_by: adminUser.id,
        resolved_at: resAt,
        created_at: createdAt,
      },
    });

    // Add inventory low-stock alerts
    if (dayOffset % 6 === 0) {
      const invItem = inventoryItems[Math.floor(dayOffset / 6) % inventoryItems.length];
      const invAlertId = getDeterministicUuid('alert', `inv-day-${dayOffset}`);
      const invCreatedAt = new Date(alertBaseTime.getTime() + 10 * 60 * 60 * 1000);
      const invAckAt = new Date(invCreatedAt.getTime() + 20 * 60 * 1000);
      const invResAt = new Date(invCreatedAt.getTime() + 90 * 60 * 1000);

      await prisma.alert.upsert({
        where: { id: invAlertId },
        update: {
          equipment_id: null,
          source_id: invItem.id,
          type: AlertType.INVENTORY,
          severity: AlertSeverity.WARNING,
          message: `${invItem.name} stock low: ${invItem.min_quantity - 1} ${invItem.unit} (minimum ${invItem.min_quantity} ${invItem.unit})`,
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
          source_id: invItem.id,
          type: AlertType.INVENTORY,
          severity: AlertSeverity.WARNING,
          message: `${invItem.name} stock low: ${invItem.min_quantity - 1} ${invItem.unit} (minimum ${invItem.min_quantity} ${invItem.unit})`,
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

  // 3. Seed Maintenance Tasks across past 30 days (Idempotent)
  console.log('Seeding historical maintenance tasks...');
  const taskTemplates = [
    { title: 'Pressure Relief Valve Calibration', desc: 'Inspect and test relief valves against ASME cryo limits' },
    { title: 'Vacuum Jacket Vacuum Test', desc: 'Measure annular space vacuum level with thermocouple gauge' },
    { title: 'Emergency Shutoff Valve Actuation Test', desc: 'Verify pneumatic actuator closing time under 2 seconds' },
    { title: 'Cryogenic Seal & Flange Inspection', desc: 'Thermal imaging and bubble leak test on primary inlet flanges' },
    { title: 'Telemetry Sensor Re-zeroing', desc: 'Calibrate differential pressure transmitter and RTD probes' },
  ];

  for (let dayOffset = 28; dayOffset >= 1; dayOffset -= 4) {
    const taskBaseTime = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const eqIndex = Math.floor(dayOffset / 4) % equipment.length;
    const eq = equipment[eqIndex];
    const tmpl = taskTemplates[Math.floor(dayOffset / 4) % taskTemplates.length];
    const taskId = getDeterministicUuid('task', `task-day-${dayOffset}`);

    let status: MaintenanceStatus = MaintenanceStatus.COMPLETED;
    let completedAt: Date | null = new Date(taskBaseTime.getTime() + 4 * 60 * 60 * 1000);
    let notes = 'Completed per standard procedure. All checks verified nominal.';

    if (dayOffset === 1) {
      status = MaintenanceStatus.OVERDUE;
      completedAt = null;
      notes = 'Task awaiting replacement spare parts.';
    }

    await prisma.maintenanceTask.upsert({
      where: { id: taskId },
      update: {
        equipment_id: eq.id,
        title: tmpl.title,
        description: tmpl.desc,
        due_date: taskBaseTime,
        assigned_to: staffUser.id,
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
        due_date: taskBaseTime,
        assigned_to: staffUser.id,
        status,
        recurrence_days: 30,
        completed_at: completedAt,
        notes,
      },
    });
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
