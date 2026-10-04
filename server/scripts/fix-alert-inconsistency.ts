import { PrismaClient, AlertStatus } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function fixInconsistentAlerts() {
  console.log('Fixing inconsistent alert status/ack fields...');

  // 1. If status is OPEN, clear acknowledged_by and acknowledged_at
  const openFixed = await prisma.alert.updateMany({
    where: {
      status: AlertStatus.OPEN,
      OR: [
        { acknowledged_by: { not: null } },
        { acknowledged_at: { not: null } },
      ],
    },
    data: {
      acknowledged_by: null,
      acknowledged_at: null,
    },
  });

  console.log(`Cleaned ${openFixed.count} OPEN alerts with residual ack fields.`);

  // 2. If status is ACKNOWLEDGED and acknowledged_at is missing, set to now
  const ackFixed = await prisma.alert.updateMany({
    where: {
      status: AlertStatus.ACKNOWLEDGED,
      acknowledged_at: null,
    },
    data: {
      acknowledged_at: new Date(),
    },
  });

  console.log(`Updated ${ackFixed.count} ACKNOWLEDGED alerts with missing timestamp.`);
}

fixInconsistentAlerts()
  .catch((err) => {
    console.error('Error fixing alert inconsistency:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
