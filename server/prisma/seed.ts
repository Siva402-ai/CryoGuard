import { PrismaClient, Role, MaterialType, EquipmentStatus } from '@prisma/client';
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

  // 4. Seed Inspection Template
  const templateName = 'Daily Cryogenic Storage & Pressure Vessel Inspection';
  const checklistItems = [
    'Pressure relief valve seal intact and unblocked',
    'Vacuum jacket exterior free of abnormal icing/frost spots',
    'Digital level and pressure transmitters responding normally',
    'Emergency shutoff valve accessible and operational',
    'Earthing / Static grounding clamp securely connected',
    'Vent piping clear of ice or debris',
    'Safety signage, MSDS, and area PPE station intact',
  ];

  const existingTemplate = await prisma.inspectionTemplate.findFirst({
    where: { name: templateName },
  });

  if (existingTemplate) {
    await prisma.inspectionTemplate.update({
      where: { id: existingTemplate.id },
      data: {
        name: templateName,
        items: checklistItems,
      },
    });
  } else {
    await prisma.inspectionTemplate.create({
      data: {
        name: templateName,
        items: checklistItems,
      },
    });
  }
  console.log('✅ Seeded inspection template');

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
