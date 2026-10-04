import { PrismaClient, AlertType, AlertSeverity, AlertStatus, MaintenanceStatus, TransactionType } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function seedDemoHistory() {
  console.log('🔄 Checking if demo history is already seeded...');

  // 1. Idempotency Check
  const existingTx = await prisma.inventoryTransaction.findFirst({
    where: { reason: 'demo history' },
  });
  const existingTask = await prisma.maintenanceTask.findFirst({
    where: { notes: { contains: 'demo history' } },
  });

  if (existingTx || existingTask) {
    console.log('ℹ️  Demo history marker found. Skipping seeding to maintain idempotency.');
    return;
  }

  console.log('🌱 Seeding 6 months of historical demo data (alerts, maintenance, inventory transactions)...');

  const users = await prisma.user.findMany();
  const adminUser = users.find((u) => u.role === 'ADMIN') || users[0];
  const staffUser = users.find((u) => u.role === 'STAFF') || users[0];
  const equipment = await prisma.equipment.findMany();
  const inventoryItems = await prisma.inventoryItem.findMany();

  if (!equipment.length || !inventoryItems.length) {
    console.error('❌ Base seed data (equipment, inventory) must be present first. Run npm run prisma:seed.');
    return;
  }

  const now = new Date();

  // 2. Seed Historical Alerts (Resolved) across past 6 months
  const alertTypes: AlertType[] = [
    AlertType.TEMPERATURE,
    AlertType.PRESSURE,
    AlertType.LEVEL,
    AlertType.INSPECTION,
    AlertType.MAINTENANCE,
  ];

  const historicalAlerts: any[] = [];

  // Generate 4-8 alerts per month for the last 6 months
  for (let m = 5; m >= 0; m--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 5);
    const countForMonth = 4 + Math.floor(Math.random() * 4);

    for (let i = 0; i < countForMonth; i++) {
      const eq = equipment[Math.floor(Math.random() * equipment.length)];
      const type = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      const isCritical = Math.random() > 0.65;
      const severity = isCritical ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;

      const alertDay = 2 + i * 3 + Math.floor(Math.random() * 3);
      const createdAt = new Date(monthDate.getFullYear(), monthDate.getMonth(), Math.min(28, alertDay), 8 + i, 15);
      const ackAt = new Date(createdAt.getTime() + (15 + Math.floor(Math.random() * 45)) * 60 * 1000);
      const resAt = new Date(ackAt.getTime() + (30 + Math.floor(Math.random() * 120)) * 60 * 1000);

      historicalAlerts.push({
        equipment_id: eq.id,
        type,
        severity,
        message: `[demo history] ${eq.code} ${type.toLowerCase()} threshold exceeded during routine shift check`,
        value: type === AlertType.TEMPERATURE ? (isCritical ? -184.2 : -188.5) : (isCritical ? 2.3 : 1.9),
        status: AlertStatus.RESOLVED,
        acknowledged_by: staffUser.id,
        acknowledged_at: ackAt,
        resolved_by: adminUser.id,
        resolved_at: resAt,
        created_at: createdAt,
      });
    }

    // Add a couple inventory alerts (equipment_id = null)
    if (m % 2 === 0) {
      const item = inventoryItems[Math.floor(Math.random() * inventoryItems.length)];
      const invCreatedAt = new Date(monthDate.getFullYear(), monthDate.getMonth(), 14, 10, 0);
      historicalAlerts.push({
        equipment_id: null,
        source_id: item.id,
        type: AlertType.INVENTORY,
        severity: AlertSeverity.WARNING,
        message: `[demo history] Item ${item.name} stock fell below threshold`,
        status: AlertStatus.RESOLVED,
        acknowledged_by: staffUser.id,
        acknowledged_at: new Date(invCreatedAt.getTime() + 30 * 60 * 1000),
        resolved_by: adminUser.id,
        resolved_at: new Date(invCreatedAt.getTime() + 180 * 60 * 1000),
        created_at: invCreatedAt,
      });
    }
  }

  await prisma.alert.createMany({ data: historicalAlerts });
  console.log(`✅ Seeded ${historicalAlerts.length} historical resolved alerts`);

  // 3. Seed Maintenance Tasks across past 6 months
  const taskTemplates = [
    { title: 'Pressure Relief Valve Calibration', desc: 'Inspect and test relief valves against ASME cryo limits' },
    { title: 'Vacuum Jacket Vacuum Test', desc: 'Measure annular space vacuum level with thermocouple gauge' },
    { title: 'Emergency Shutoff Valve Actuation Test', desc: 'Verify pneumatic actuator closing time under 2 seconds' },
    { title: 'Cryogenic Seal & Flange Inspection', desc: 'Thermal imaging and bubble leak test on primary inlet flanges' },
    { title: 'Telemetry Sensor Re-zeroing', desc: 'Calibrate differential pressure transmitter and RTD probes' },
  ];

  const historicalTasks: any[] = [];

  for (let m = 5; m >= 0; m--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const countForMonth = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < countForMonth; i++) {
      const eq = equipment[i % equipment.length];
      const tmpl = taskTemplates[i % taskTemplates.length];
      const dueDay = 5 + i * 7;
      const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), Math.min(28, dueDay), 14, 0);

      // 80% completed on time, 10% completed late, 10% overdue if in current/past month
      const rand = Math.random();
      let status: MaintenanceStatus = MaintenanceStatus.COMPLETED;
      let completedAt: Date | null = null;
      let notes = `[demo history] Completed per SOP. All checks verified normal.`;

      if (m === 0 && rand > 0.8) {
        status = MaintenanceStatus.OVERDUE;
        notes = `[demo history] Task delayed due to replacement part procurement.`;
      } else if (rand > 0.85) {
        // Completed late (1-2 days after due date)
        completedAt = new Date(dueDate.getTime() + (24 + Math.floor(Math.random() * 24)) * 60 * 60 * 1000);
        notes = `[demo history] Completed with slight delay due to weather conditions.`;
      } else {
        // Completed on time (a few hours before or on due date)
        completedAt = new Date(dueDate.getTime() - Math.floor(Math.random() * 8) * 60 * 60 * 1000);
      }

      historicalTasks.push({
        equipment_id: eq.id,
        title: tmpl.title,
        description: tmpl.desc,
        due_date: dueDate,
        assigned_to: i % 2 === 0 ? staffUser.id : adminUser.id,
        status,
        recurrence_days: 30,
        completed_at: completedAt,
        notes,
      });
    }
  }

  await prisma.maintenanceTask.createMany({ data: historicalTasks });
  console.log(`✅ Seeded ${historicalTasks.length} historical maintenance tasks`);

  // 4. Seed Inventory Transactions across past 6 months
  // Requirement: Insert transaction rows without changing items.quantity, and say so clearly.
  console.log('ℹ️  Inserting inventory transaction records without modifying live items.quantity.');

  const historicalTx: any[] = [];

  // Generate weekly IN and OUT transactions for each item
  for (let m = 5; m >= 0; m--) {
    for (let w = 0; w < 4; w++) {
      const txDate = new Date(now.getFullYear(), now.getMonth() - m, 1 + w * 7, 11, 30);

      for (const item of inventoryItems) {
        const isDiscrete = !['L', 'Liters', 'liters', 'kg', 'Kg'].includes(item.unit);

        // Weekly OUT consumption
        const baseOut = isDiscrete ? Math.floor(2 + Math.random() * 8) : Math.round((20 + Math.random() * 60) * 10) / 10;
        historicalTx.push({
          item_id: item.id,
          type: TransactionType.OUT,
          quantity: baseOut,
          reason: 'demo history',
          user_id: staffUser.id,
          created_at: new Date(txDate.getTime() + (Math.random() * 24) * 60 * 60 * 1000),
        });

        // Bi-weekly or monthly IN restocking
        if (w === 1 || w === 3) {
          const baseIn = isDiscrete ? baseOut * 2 : Math.round(baseOut * 2.2 * 10) / 10;
          historicalTx.push({
            item_id: item.id,
            type: TransactionType.IN,
            quantity: baseIn,
            reason: 'demo history',
            user_id: adminUser.id,
            created_at: new Date(txDate.getTime() + (24 + Math.random() * 24) * 60 * 60 * 1000),
          });
        }
      }
    }
  }

  await prisma.inventoryTransaction.createMany({ data: historicalTx });
  console.log(`✅ Seeded ${historicalTx.length} historical inventory transactions`);

  console.log('🎉 Demo history seeding completed successfully.');
}

seedDemoHistory()
  .catch((e) => {
    console.error('Error during demo history seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
