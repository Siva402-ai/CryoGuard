import { Request, Response } from 'express';
import { z } from 'zod';
import { MaterialType, EquipmentStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { redis } from '../db/redis';
import { writeAudit } from '../utils/audit';

// Zod schemas for Equipment validation
const equipmentSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Equipment code must be at least 2 characters')
    .max(20, 'Equipment code cannot exceed 20 characters'),
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  material: z.nativeEnum(MaterialType, {
    errorMap: () => ({ message: 'Material must be one of LN2, LOX, or ARGON' }),
  }),
  capacity_l: z.number().positive('Capacity must be a positive number'),
  location: z.string().trim().min(2, 'Location is required'),
  temp_warn_c: z.number({ required_error: 'Temperature warning threshold is required' }),
  temp_crit_c: z.number({ required_error: 'Temperature critical threshold is required' }),
  pressure_warn_bar: z.number().positive('Pressure warning threshold must be positive'),
  pressure_crit_bar: z.number().positive('Pressure critical threshold must be positive'),
  level_warn_pct: z
    .number()
    .min(0, 'Level warning threshold cannot be below 0%')
    .max(100, 'Level warning threshold cannot exceed 100%'),
  level_crit_pct: z
    .number()
    .min(0, 'Level critical threshold cannot be below 0%')
    .max(100, 'Level critical threshold cannot exceed 100%'),
  status: z.nativeEnum(EquipmentStatus).optional().default(EquipmentStatus.NORMAL),
});

const readingsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform(Number)
    .refine((val) => val > 0 && val <= 1000, 'Limit must be between 1 and 1000')
    .optional(),
});

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
    try {
      if (redis.status === 'ready') {
        await redis.set(`reading:latest:${equipmentId}`, JSON.stringify(readingData), 'EX', 86400);
      }
    } catch (e) {
      // ignore cache write error
    }
    return readingData;
  }

  return null;
}

export const getEquipmentList = async (_req: Request, res: Response) => {
  try {
    const equipmentList = await prisma.equipment.findMany({
      orderBy: { code: 'asc' },
    });

    // Attach latest readings to each equipment
    const enrichedList = await Promise.all(
      equipmentList.map(async (item) => {
        const latestReading = await getLatestReading(item.id);
        return {
          ...item,
          latestReading,
        };
      }),
    );

    return res.status(200).json({
      equipment: enrichedList,
      count: enrichedList.length,
    });
  } catch (error) {
    console.error('getEquipmentList error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve equipment list.',
    });
  }
};

export const getEquipmentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const equipment = await prisma.equipment.findUnique({
      where: { id },
    });

    if (!equipment) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Equipment with ID '${id}' was not found.`,
      });
    }

    const latestReading = await getLatestReading(equipment.id);

    return res.status(200).json({
      equipment: {
        ...equipment,
        latestReading,
      },
    });
  } catch (error) {
    console.error('getEquipmentById error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve equipment details.',
    });
  }
};

export const createEquipment = async (req: Request, res: Response) => {
  try {
    const parseResult = equipmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid equipment data';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parseResult.error.errors,
      });
    }

    const data = parseResult.data;
    data.code = data.code.toUpperCase();

    // Check unique code
    const existing = await prisma.equipment.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: `An equipment unit with code '${data.code}' already exists.`,
      });
    }

    const newEquipment = await prisma.equipment.create({
      data,
    });

    await writeAudit({
      userId: req.user?.userId,
      action: 'CREATE_EQUIPMENT',
      entity: 'Equipment',
      entityId: newEquipment.id,
      meta: { code: newEquipment.code, name: newEquipment.name, material: newEquipment.material },
    });

    return res.status(201).json({
      message: 'Equipment created successfully',
      equipment: newEquipment,
    });
  } catch (error) {
    console.error('createEquipment error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create equipment record.',
    });
  }
};

export const updateEquipment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.equipment.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Equipment with ID '${id}' was not found.`,
      });
    }

    const parseResult = equipmentSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid equipment update data';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parseResult.error.errors,
      });
    }

    const data = parseResult.data;
    if (data.code) {
      data.code = data.code.toUpperCase();
      if (data.code !== existing.code) {
        const codeInUse = await prisma.equipment.findUnique({
          where: { code: data.code },
        });
        if (codeInUse) {
          return res.status(409).json({
            error: 'Conflict',
            message: `Equipment code '${data.code}' is already assigned to another unit.`,
          });
        }
      }
    }

    const updated = await prisma.equipment.update({
      where: { id },
      data,
    });

    await writeAudit({
      userId: req.user?.userId,
      action: 'UPDATE_EQUIPMENT',
      entity: 'Equipment',
      entityId: id,
      meta: { code: updated.code, changedFields: Object.keys(data) },
    });

    return res.status(200).json({
      message: 'Equipment updated successfully',
      equipment: updated,
    });
  } catch (error) {
    console.error('updateEquipment error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update equipment record.',
    });
  }
};

export const deleteEquipment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.equipment.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            inspections: true,
            maintenance_tasks: true,
            alerts: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Equipment with ID '${id}' was not found.`,
      });
    }

    // Check if critical operational dependencies exist (e.g. inspections/maintenance records)
    if (
      existing._count.inspections > 0 ||
      existing._count.maintenance_tasks > 0 ||
      existing._count.alerts > 0
    ) {
      return res.status(409).json({
        error: 'Conflict',
        message: `Cannot delete equipment '${existing.code}' because related operational records (inspections: ${existing._count.inspections}, maintenance: ${existing._count.maintenance_tasks}, alerts: ${existing._count.alerts}) depend on it.`,
      });
    }

    await prisma.equipment.delete({
      where: { id },
    });

    await writeAudit({
      userId: req.user?.userId,
      action: 'DELETE_EQUIPMENT',
      entity: 'Equipment',
      entityId: id,
      meta: { code: existing.code, name: existing.name },
    });

    // Invalidate Redis cache
    try {
      if (redis.status === 'ready') {
        await redis.del(`reading:latest:${id}`);
      }
    } catch (e) {
      // ignore
    }

    return res.status(200).json({
      message: `Equipment '${existing.code}' was deleted successfully.`,
    });
  } catch (error: any) {
    console.error('deleteEquipment error:', error);
    if (error.code === 'P2003') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Cannot delete equipment due to existing database foreign-key constraints.',
      });
    }
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while deleting equipment.',
    });
  }
};

export const getEquipmentReadings = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check equipment exists
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      select: { id: true, code: true, name: true },
    });

    if (!equipment) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Equipment with ID '${id}' was not found.`,
      });
    }

    const queryResult = readingsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      const firstError = queryResult.error.errors[0]?.message || 'Invalid query parameters';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: queryResult.error.errors,
      });
    }

    const { from, to, limit = 100 } = queryResult.data;

    const whereClause: any = {
      equipment_id: id,
    };

    if (from || to) {
      whereClause.recorded_at = {};
      if (from) whereClause.recorded_at.gte = new Date(from);
      if (to) whereClause.recorded_at.lte = new Date(to);
    }

    const readings = await prisma.sensorReading.findMany({
      where: whereClause,
      orderBy: { recorded_at: 'desc' },
      take: limit,
      select: {
        id: true,
        equipment_id: true,
        temperature_c: true,
        pressure_bar: true,
        level_pct: true,
        recorded_at: true,
      },
    });

    return res.status(200).json({
      equipmentId: equipment.id,
      equipmentCode: equipment.code,
      equipmentName: equipment.name,
      readings,
      count: readings.length,
    });
  } catch (error) {
    console.error('getEquipmentReadings error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve sensor readings.',
    });
  }
};
