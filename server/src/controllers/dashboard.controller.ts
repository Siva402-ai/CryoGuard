import { Request, Response } from 'express';
import { AlertStatus, AlertSeverity, EquipmentStatus, MaintenanceStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { redis } from '../db/redis';

// Helper to fetch latest reading for an equipment (Redis cache with DB fallback)
async function getLatestReading(equipmentId: string) {
  try {
    if (redis.status === 'ready') {
      const cached = await redis.get(`reading:latest:${equipmentId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    }
  } catch (err) {
    console.warn(`Redis get error for equipment ${equipmentId}:`, (err as Error).message);
  }

  // DB Fallback
  const dbReading = await prisma.sensorReading.findFirst({
    where: { equipment_id: equipmentId },
    orderBy: { recorded_at: 'desc' },
  });

  if (dbReading) {
    const readingData = {
      equipmentId: dbReading.equipment_id,
      temperature_c: dbReading.temperature_c,
      pressure_bar: dbReading.pressure_bar,
      level_pct: dbReading.level_pct,
      recorded_at: dbReading.recorded_at.toISOString(),
    };
    return readingData;
  }

  return null;
}

export const getDashboardSummary = async (_req: Request, res: Response) => {
  try {
    // 1. Total storage units
    const totalUnits = await prisma.equipment.count();

    // 2. Tank count by status
    const statusGroups = await prisma.equipment.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const tankCountByStatus: Record<EquipmentStatus, number> = {
      [EquipmentStatus.NORMAL]: 0,
      [EquipmentStatus.WARNING]: 0,
      [EquipmentStatus.CRITICAL]: 0,
      [EquipmentStatus.OFFLINE]: 0,
    };

    statusGroups.forEach((g) => {
      tankCountByStatus[g.status] = g._count.status;
    });

    // 3. Active alerts (OPEN + ACKNOWLEDGED) and Critical alerts count
    const [activeAlerts, criticalAlerts] = await Promise.all([
      prisma.alert.count({
        where: {
          status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
        },
      }),
      prisma.alert.count({
        where: {
          status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
          severity: AlertSeverity.CRITICAL,
        },
      }),
    ]);

    // 4. Maintenance tasks due/overdue count (overdue or due within 7 days)
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    in7Days.setHours(23, 59, 59, 999);

    const maintenanceDue = await prisma.maintenanceTask.count({
      where: {
        status: { not: MaintenanceStatus.COMPLETED },
        due_date: { lte: in7Days },
      },
    });

    // 5. Low stock inventory items count (items where quantity < min_quantity)
    const allInventoryItems = await prisma.inventoryItem.findMany({
      select: { quantity: true, min_quantity: true },
    });
    const lowStockCount = allInventoryItems.filter((i) => i.quantity < i.min_quantity).length;

    // 6. Tank table with latest Redis-cached readings
    const equipmentList = await prisma.equipment.findMany({
      orderBy: { code: 'asc' },
    });

    const tanks = await Promise.all(
      equipmentList.map(async (item) => {
        const latestReading = await getLatestReading(item.id);
        return {
          ...item,
          latestReading,
        };
      }),
    );

    // 7. 10 most recent alerts
    const recentAlerts = await prisma.alert.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      include: {
        equipment: {
          select: {
            id: true,
            code: true,
            name: true,
            material: true,
            location: true,
          },
        },
      },
    });

    return res.status(200).json({
      summary: {
        totalUnits,
        tankCountByStatus,
        activeAlerts,
        criticalAlerts,
        maintenanceDue,
        lowStockCount,
      },
      tanks,
      recentAlerts,
    });
  } catch (error) {
    console.error('getDashboardSummary error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve dashboard summary telemetry.',
    });
  }
};
