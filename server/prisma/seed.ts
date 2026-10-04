import { PrismaClient, Role, MaterialType, EquipmentStatus, MaintenanceStatus, InspectionResult } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
  const staffPassword = process.env.SEED_STAFF_PASSWORD || 'Staff@123456';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const staffHash = await bcrypt.hash(staffPassword, 10);

  // 1. Seed Demo Users
  const users = [
    {
      email: 'admin@cryoguard.com',
      name: 'Facility Admin',
      password_hash: adminHash,
      role: Role.ADMIN,
      is_active: true,
    },
    {
      email: 'arun@cryoguard.com',
      name: 'Arun',
      password_hash: staffHash,
      role: Role.STAFF,
      is_active: true,
    },
    {
      email: 'ravi@cryoguard.com',
      name: 'Ravi',
      password_hash: staffHash,
      role: Role.STAFF,
      is_active: true,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password_hash: user.password_hash,
        role: user.role,
        is_active: user.is_active,
      },
      create: user,
    });
  }
  console.log(`✅ Seeded ${users.length} users`);

  // 2. Seed 6 Cryogenic Tanks
  const equipmentData = [
    {
      code: 'C-001',
      name: 'Bulk Tank Alpha',
      material: MaterialType.LN2,
      capacity_l: 10000,
      location: 'Bay A - North Yard',
      temp_warn_c: -190.0,
      temp_crit_c: -185.0,
      pressure_warn_bar: 1.8,
      pressure_crit_bar: 2.2,
      level_warn_pct: 30.0,
      level_crit_pct: 15.0,
      status: EquipmentStatus.NORMAL,
    },
    {
      code: 'C-002',
      name: 'Bulk Tank Beta',
      material: MaterialType.LN2,
      capacity_l: 10000,
      location: 'Bay A - North Yard',
      temp_warn_c: -190.0,
      temp_crit_c: -185.0,
      pressure_warn_bar: 1.8,
      pressure_crit_bar: 2.2,
      level_warn_pct: 30.0,
      level_crit_pct: 15.0,
      status: EquipmentStatus.NORMAL,
    },
    {
      code: 'C-003',
      name: 'Cryo-Ox 1',
      material: MaterialType.LOX,
      capacity_l: 8000,
      location: 'Bay B - East Pad',
      temp_warn_c: -180.0,
      temp_crit_c: -175.0,
      pressure_warn_bar: 1.8,
      pressure_crit_bar: 2.2,
      level_warn_pct: 30.0,
      level_crit_pct: 15.0,
      status: EquipmentStatus.NORMAL,
    },
    {
      code: 'C-004',
      name: 'Cryo-Ox 2',
      material: MaterialType.LOX,
      capacity_l: 8000,
      location: 'Bay B - East Pad',
      temp_warn_c: -180.0,
      temp_crit_c: -175.0,
      pressure_warn_bar: 1.8,
      pressure_crit_bar: 2.2,
      level_warn_pct: 30.0,
      level_crit_pct: 15.0,
      status: EquipmentStatus.NORMAL,
    },
    {
      code: 'C-005',
      name: 'Argon Reserve 1',
      material: MaterialType.ARGON,
      capacity_l: 5000,
      location: 'Bay C - South Compound',
      temp_warn_c: -183.0,
      temp_crit_c: -178.0,
      pressure_warn_bar: 1.8,
      pressure_crit_bar: 2.2,
      level_warn_pct: 30.0,
      level_crit_pct: 15.0,
      status: EquipmentStatus.NORMAL,
    },
    {
      code: 'C-006',
      name: 'Argon Reserve 2',
      material: MaterialType.ARGON,
      capacity_l: 5000,
      location: 'Bay C - South Compound',
      temp_warn_c: -183.0,
      temp_crit_c: -178.0,
      pressure_warn_bar: 1.8,
      pressure_crit_bar: 2.2,
      level_warn_pct: 30.0,
      level_crit_pct: 15.0,
      status: EquipmentStatus.NORMAL,
    },
  ];

  for (const eq of equipmentData) {
    await prisma.equipment.upsert({
      where: { code: eq.code },
      update: eq,
      create: eq,
    });
  }
  console.log(`✅ Seeded ${equipmentData.length} cryogenic storage units`);

  // 3. Seed Inventory Items
  const inventoryData = [
    {
      name: 'Liquid Nitrogen Bulk',
      material: 'LN2',
      unit: 'Liters',
      quantity: 18500,
      min_quantity: 5000,
    },
    {
      name: 'Liquid Oxygen Bulk',
      material: 'LOX',
      unit: 'Liters',
      quantity: 14200,
      min_quantity: 4000,
    },
    {
      name: 'Liquid Argon Bulk',
      material: 'ARGON',
      unit: 'Liters',
      quantity: 9100,
      min_quantity: 2500,
    },
    {
      name: 'Cryogenic Handling Gloves (XL)',
      material: 'PPE',
      unit: 'Pairs',
      quantity: 15,
      min_quantity: 5,
    },
    {
      name: 'Full Face Cryo Protection Shield',
      material: 'PPE',
      unit: 'Units',
      quantity: 8,
      min_quantity: 3,
    },
    {
      name: 'Cryogenic Flange Gaskets (DN50)',
      material: 'Spare Parts',
      unit: 'Units',
      quantity: 24,
      min_quantity: 10,
    },
    {
      name: 'Safety Relief Valve (2.2 Bar Preset)',
      material: 'Spare Parts',
      unit: 'Units',
      quantity: 6,
      min_quantity: 2,
    },
  ];

  for (const item of inventoryData) {
    const existing = await prisma.inventoryItem.findFirst({
      where: { name: item.name },
    });
    if (existing) {
      await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: item,
      });
    } else {
      await prisma.inventoryItem.create({
        data: item,
      });
    }
  }
  console.log(`✅ Seeded ${inventoryData.length} inventory items`);

  // 4. Seed Inspection Templates
  const template1Name = 'Daily Cryogenic Storage & Pressure Vessel Inspection';
  const template1Items = [
    { label: 'Pressure relief valve seal intact and unblocked', critical: true },
    { label: 'Vacuum jacket exterior free of abnormal icing/frost spots', critical: false },
    { label: 'Digital level and pressure transmitters responding normally', critical: false },
    { label: 'Emergency shutoff valve accessible and operational', critical: true },
    { label: 'Leak detection sensor and alarm verified operational', critical: true },
    { label: 'Earthing / Static grounding clamp securely connected', critical: false },
    { label: 'Vent piping clear of ice or debris', critical: false },
    { label: 'Safety signage, MSDS, and area PPE station intact', critical: false },
  ];

  const template2Name = 'PPE & Room Safety Check';
  const template2Items = [
    { label: 'PPE available (cryo gloves, face shield, apron)', critical: false },
    { label: 'O2 monitor tested and calibrated', critical: true },
    { label: 'Ventilation system working', critical: true },
    { label: 'Eyewash station accessible and tested', critical: false },
    { label: 'Safety signage in place', critical: false },
  ];

  const seededTemplate1 = await prisma.inspectionTemplate.upsert({
    where: { id: (await prisma.inspectionTemplate.findFirst({ where: { name: template1Name } }))?.id || '00000000-0000-0000-0000-000000000001' },
    update: {
      name: template1Name,
      items: template1Items,
    },
    create: {
      name: template1Name,
      items: template1Items,
    },
  });

  const seededTemplate2 = await prisma.inspectionTemplate.upsert({
    where: { id: (await prisma.inspectionTemplate.findFirst({ where: { name: template2Name } }))?.id || '00000000-0000-0000-0000-000000000002' },
    update: {
      name: template2Name,
      items: template2Items,
    },
    create: {
      name: template2Name,
      items: template2Items,
    },
  });
  console.log('✅ Seeded 2 inspection templates');

  // Seed 2 Past PASS Inspections (idempotent)
  const staffArunUser = await prisma.user.findUnique({ where: { email: 'arun@cryoguard.com' } });
  const staffRaviUser = await prisma.user.findUnique({ where: { email: 'ravi@cryoguard.com' } });
  const tank1Equip = await prisma.equipment.findUnique({ where: { code: 'C-001' } });
  const tank2Equip = await prisma.equipment.findUnique({ where: { code: 'C-002' } });

  if (staffArunUser && staffRaviUser && tank1Equip && tank2Equip) {
    const existingInsp1 = await prisma.inspection.findFirst({
      where: {
        equipment_id: tank1Equip.id,
        template_id: seededTemplate1.id,
      },
    });

    if (!existingInsp1) {
      await prisma.inspection.create({
        data: {
          equipment_id: tank1Equip.id,
          template_id: seededTemplate1.id,
          inspector_id: staffArunUser.id,
          performed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          results: template1Items.map((item) => ({
            item: item.label,
            result: 'PASS',
          })),
          overall: InspectionResult.PASS,
          findings: 'All safety valves and transmitters nominal. Grounding clamp verified.',
          corrective_action: null,
        },
      });
    }

    const existingInsp2 = await prisma.inspection.findFirst({
      where: {
        equipment_id: tank2Equip.id,
        template_id: seededTemplate2.id,
      },
    });

    if (!existingInsp2) {
      await prisma.inspection.create({
        data: {
          equipment_id: tank2Equip.id,
          template_id: seededTemplate2.id,
          inspector_id: staffRaviUser.id,
          performed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          results: template2Items.map((item) => ({
            item: item.label,
            result: 'PASS',
          })),
          overall: InspectionResult.PASS,
          findings: 'O2 monitor and room exhaust ventilation in optimal operational condition.',
          corrective_action: null,
        },
      });
    }
    console.log('✅ Seeded past PASS inspections');
  }

  // 5. Seed Demo Maintenance Tasks
  const tank1 = await prisma.equipment.findUnique({ where: { code: 'C-001' } });
  const tank2 = await prisma.equipment.findUnique({ where: { code: 'C-002' } });
  const tank3 = await prisma.equipment.findUnique({ where: { code: 'C-003' } });
  const tank5 = await prisma.equipment.findUnique({ where: { code: 'C-005' } });

  const staffArun = await prisma.user.findUnique({ where: { email: 'arun@cryoguard.com' } });
  const staffRavi = await prisma.user.findUnique({ where: { email: 'ravi@cryoguard.com' } });

  if (tank1 && tank2 && tank3 && tank5) {
    const maintenanceSeedTasks = [
      {
        equipment_id: tank1.id,
        title: 'Annual Flange Seal & Gasket Replacement',
        description: 'Complete inspection of inlet/outlet flange seals, replaced DN50 cryogenic gaskets.',
        due_date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        status: MaintenanceStatus.COMPLETED,
        assigned_to: staffArun?.name || 'Arun',
        completed_at: new Date(Date.now() - 34 * 24 * 60 * 60 * 1000),
        notes: 'Replaced valve gasket and recalibrated pressure gauge. All nominal.',
      },
      {
        equipment_id: tank2.id,
        title: 'Vacuum Jacket Inspection & Boil-off Rate Check',
        description: 'Verify vacuum integrity and inspect outer vessel for cold spots or sweat patches.',
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: MaintenanceStatus.PENDING,
        assigned_to: staffArun?.name || 'Arun',
        recurrence_days: null,
      },
      {
        equipment_id: tank3.id,
        title: 'Monthly Cryo Relief Valve Pressure Test',
        description: 'Verify dual safety relief valve actuation setpoint at 2.2 bar.',
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: MaintenanceStatus.PENDING,
        assigned_to: staffRavi?.name || 'Ravi',
        recurrence_days: 30,
      },
      {
        equipment_id: tank5.id,
        title: 'Quarterly Telemetry Sensor Calibration & Transducer Check',
        description: 'Zero-point calibration for 4-20mA pressure and temperature transmitters.',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: MaintenanceStatus.PENDING,
        assigned_to: staffArun?.name || 'Arun',
        recurrence_days: 90,
      },
    ];

    for (const task of maintenanceSeedTasks) {
      const existingTask = await prisma.maintenanceTask.findFirst({
        where: {
          equipment_id: task.equipment_id,
          title: task.title,
        },
      });

      if (existingTask) {
        await prisma.maintenanceTask.update({
          where: { id: existingTask.id },
          data: task,
        });
      } else {
        await prisma.maintenanceTask.create({
          data: task,
        });
      }
    }
    console.log(`✅ Seeded ${maintenanceSeedTasks.length} maintenance tasks`);
  }

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
