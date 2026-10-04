import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '../db/prisma';
import { redis, redisQueueConnection } from '../db/redis';
import { AlertStatus, AlertSeverity, AlertType, MaintenanceStatus } from '@prisma/client';

export async function runMaintenanceCheck() {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const in2Days = new Date(todayMidnight.getTime() + 2 * 24 * 60 * 60 * 1000);
  in2Days.setHours(23, 59, 59, 999);

  // 1. Mark non-completed tasks with due_date before today as OVERDUE
  const overdueTasks = await prisma.maintenanceTask.findMany({
    where: {
      status: {
        in: [
          MaintenanceStatus.PENDING,
          MaintenanceStatus.SCHEDULED,
          MaintenanceStatus.IN_PROGRESS,
        ],
      },
      due_date: { lt: todayMidnight },
    },
    include: {
      equipment: {
        select: { id: true, code: true, name: true, location: true },
      },
    },
  });

  for (const task of overdueTasks) {
    if (task.status !== MaintenanceStatus.OVERDUE) {
      await prisma.maintenanceTask.update({
        where: { id: task.id },
        data: { status: MaintenanceStatus.OVERDUE },
      });
    }
  }

  // 2. Evaluate all active non-completed tasks for alerts
  const activeTasks = await prisma.maintenanceTask.findMany({
    where: {
      status: {
        in: [
          MaintenanceStatus.PENDING,
          MaintenanceStatus.SCHEDULED,
          MaintenanceStatus.IN_PROGRESS,
          MaintenanceStatus.OVERDUE,
        ],
      },
    },
    include: {
      equipment: {
        select: { id: true, code: true, name: true, location: true },
      },
    },
  });

  for (const task of activeTasks) {
    const isOverdue = task.due_date < todayMidnight || task.status === MaintenanceStatus.OVERDUE;
    const isDueSoon = !isOverdue && task.due_date <= in2Days;

    if (!isOverdue && !isDueSoon) {
      continue;
    }

    const targetSeverity = isOverdue ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;
    const alertMessage = isOverdue
      ? `${task.equipment.code} maintenance overdue: ${task.title}`
      : `${task.equipment.code} maintenance due soon: ${task.title}`;

    // DB source of truth for active alert for this task
    const activeAlert = await prisma.alert.findFirst({
      where: {
        equipment_id: task.equipment_id,
        type: AlertType.MAINTENANCE,
        source_id: task.id,
        status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
      },
      include: {
        equipment: {
          select: { id: true, code: true, name: true, material: true, location: true },
        },
      },
    });

    const redisKey = `alert:active:${task.equipment_id}:MAINTENANCE:${task.id}`;

    if (!activeAlert) {
      const newAlert = await prisma.alert.create({
        data: {
          equipment_id: task.equipment_id,
          source_id: task.id,
          type: AlertType.MAINTENANCE,
          severity: targetSeverity,
          message: alertMessage,
          status: AlertStatus.OPEN,
        },
        include: {
          equipment: {
            select: { id: true, code: true, name: true, material: true, location: true },
          },
        },
      });

      try {
        if (redis.status === 'ready') {
          await redis.set(redisKey, newAlert.id);
          await redis.publish(
            'alerts',
            JSON.stringify({
              event: 'alert.created',
              alert: newAlert,
            }),
          );
        }
      } catch (e) {
        console.warn('Redis notice on maintenance alert.created:', (e as Error).message);
      }
    } else if (
      activeAlert.severity === AlertSeverity.WARNING &&
      targetSeverity === AlertSeverity.CRITICAL
    ) {
      // In-place escalation from WARNING to CRITICAL
      const updatedAlert = await prisma.alert.update({
        where: { id: activeAlert.id },
        data: {
          severity: AlertSeverity.CRITICAL,
          message: alertMessage,
        },
        include: {
          equipment: {
            select: { id: true, code: true, name: true, material: true, location: true },
          },
        },
      });

      try {
        if (redis.status === 'ready') {
          await redis.set(redisKey, updatedAlert.id);
          await redis.publish(
            'alerts',
            JSON.stringify({
              event: 'alert.updated',
              alert: updatedAlert,
            }),
          );
        }
      } catch (e) {
        console.warn('Redis notice on maintenance alert.updated:', (e as Error).message);
      }
    }
  }

  console.log('✅ [maintenance-check] Completed maintenance evaluation pass');
}

export async function runReadingsRetention() {
  const retentionDays = parseInt(process.env.RETENTION_DAYS || '7', 10);
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const deleteResult = await prisma.sensorReading.deleteMany({
    where: {
      recorded_at: { lt: cutoffDate },
    },
  });

  console.log(
    `🧹 [readings-retention] Cleaned up ${deleteResult.count} sensor readings older than ${retentionDays} days (cutoff: ${cutoffDate.toISOString()})`,
  );
  return deleteResult.count;
}

const QUEUE_NAME = 'cryoguard-system-jobs';

export const systemQueue = new Queue(QUEUE_NAME, {
  connection: redisQueueConnection,
});

export const systemWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    if (job.name === 'maintenance-check') {
      await runMaintenanceCheck();
    } else if (job.name === 'readings-retention') {
      await runReadingsRetention();
    }
  },
  {
    connection: redisQueueConnection,
  },
);

systemWorker.on('error', (err) => {
  console.error('BullMQ systemWorker error:', err.message);
});

export async function initBackgroundJobs() {
  const maintenanceCron = process.env.MAINTENANCE_CHECK_CRON || '5 0 * * *';
  const retentionCron = process.env.RETENTION_CHECK_CRON || '0 1 * * *';

  // Clear existing repeatable jobs before registering fresh ones
  const repeatableJobs = await systemQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await systemQueue.removeRepeatableByKey(job.key);
  }

  // 1. Register repeatable maintenance-check job
  await systemQueue.add(
    'maintenance-check',
    {},
    {
      repeat: {
        pattern: maintenanceCron,
      },
    },
  );
  console.log(`⏱️ Registered repeatable job: maintenance-check (${maintenanceCron})`);

  // 2. Register repeatable readings-retention job
  await systemQueue.add(
    'readings-retention',
    {},
    {
      repeat: {
        pattern: retentionCron,
      },
    },
  );
  console.log(`⏱️ Registered repeatable job: readings-retention (${retentionCron})`);

  // 3. Run maintenance check once immediately on startup
  console.log('🚀 Running initial startup maintenance check...');
  await runMaintenanceCheck();
}
