import { Request, Response } from 'express';
import { z } from 'zod';
import { MaintenanceStatus, AlertStatus, AlertType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { redis } from '../db/redis';
import { writeAudit } from '../utils/audit';

const createMaintenanceSchema = z.object({
  equipment_id: z.string().uuid('Valid equipment ID is required'),
  title: z
    .string()
    .trim()
    .min(2, 'Title must be at least 2 characters')
    .max(150, 'Title cannot exceed 150 characters'),
  description: z
    .string()
    .trim()
    .min(2, 'Description must be at least 2 characters')
    .max(1000, 'Description cannot exceed 1000 characters'),
  due_date: z.string().datetime({ message: 'Valid due_date ISO string is required' }),
  assigned_to: z.string().trim().optional().nullable(),
  recurrence_days: z.number().int().positive('Recurrence days must be a positive integer').optional().nullable(),
});

const updateMaintenanceSchema = z.object({
  title: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().min(2).max(1000).optional(),
  due_date: z.string().datetime().optional(),
  assigned_to: z.string().trim().optional().nullable(),
  recurrence_days: z.number().int().positive().optional().nullable(),
  status: z
    .enum([
      MaintenanceStatus.PENDING,
      MaintenanceStatus.SCHEDULED,
      MaintenanceStatus.IN_PROGRESS,
    ], {
      errorMap: () => ({
        message: 'Status must be one of PENDING, SCHEDULED, or IN_PROGRESS. OVERDUE is managed by system check, and COMPLETED via complete endpoint.',
      }),
    })
    .optional(),
});

const completeMaintenanceSchema = z.object({
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const getMaintenanceTasks = async (req: Request, res: Response) => {
  try {
    const { status, equipmentId } = req.query;

    const whereClause: any = {};

    if (status && status !== 'ALL') {
      if (status === 'ACTIVE') {
        whereClause.status = {
          in: [
            MaintenanceStatus.PENDING,
            MaintenanceStatus.SCHEDULED,
            MaintenanceStatus.IN_PROGRESS,
            MaintenanceStatus.OVERDUE,
          ],
        };
      } else if (Object.values(MaintenanceStatus).includes(status as MaintenanceStatus)) {
        whereClause.status = status as MaintenanceStatus;
      }
    }

    if (equipmentId && equipmentId !== 'ALL') {
      whereClause.equipment_id = equipmentId as string;
    }

    const tasks = await prisma.maintenanceTask.findMany({
      where: whereClause,
      orderBy: { due_date: 'desc' },
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
      tasks,
      count: tasks.length,
    });
  } catch (error) {
    console.error('getMaintenanceTasks error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve maintenance tasks.',
    });
  }
};

export const createMaintenanceTask = async (req: Request, res: Response) => {
  try {
    const parseResult = createMaintenanceSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid maintenance task payload';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parseResult.error.errors,
      });
    }

    const { equipment_id, title, description, due_date, assigned_to, recurrence_days } =
      parseResult.data;

    // Verify equipment exists
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipment_id },
    });

    if (!equipment) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Equipment with ID '${equipment_id}' was not found.`,
      });
    }

    const newTask = await prisma.maintenanceTask.create({
      data: {
        equipment_id,
        title,
        description,
        due_date: new Date(due_date),
        assigned_to: assigned_to || null,
        recurrence_days: recurrence_days || null,
        status: MaintenanceStatus.PENDING,
      },
      include: {
        equipment: {
          select: { id: true, code: true, name: true, material: true, location: true },
        },
      },
    });

    await writeAudit({
      userId: req.user?.userId,
      action: 'CREATE_MAINTENANCE_TASK',
      entity: 'MaintenanceTask',
      entityId: newTask.id,
      meta: {
        equipmentCode: equipment.code,
        title: newTask.title,
        dueDate: newTask.due_date.toISOString(),
      },
    });

    return res.status(201).json({
      message: 'Maintenance task created successfully',
      task: newTask,
    });
  } catch (error) {
    console.error('createMaintenanceTask error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create maintenance task.',
    });
  }
};

export const updateMaintenanceTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.maintenanceTask.findUnique({
      where: { id },
      include: {
        equipment: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Maintenance task with ID '${id}' was not found.`,
      });
    }

    if (existing.status === MaintenanceStatus.COMPLETED) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Completed maintenance tasks cannot be modified.',
      });
    }

    const parseResult = updateMaintenanceSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid update payload';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parseResult.error.errors,
      });
    }

    const data = parseResult.data;
    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.assigned_to !== undefined) updateData.assigned_to = data.assigned_to;
    if (data.recurrence_days !== undefined) updateData.recurrence_days = data.recurrence_days;
    if (data.status !== undefined) updateData.status = data.status;

    let targetDueDate = existing.due_date;
    if (data.due_date) {
      targetDueDate = new Date(data.due_date);
      updateData.due_date = targetDueDate;
    }

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    // Rule: If an OVERDUE task's due_date is moved to today or later, set it back to PENDING and resolve its maintenance alert
    if (existing.status === MaintenanceStatus.OVERDUE && targetDueDate >= todayMidnight) {
      updateData.status = data.status || MaintenanceStatus.PENDING;

      // Resolve active maintenance alert for this task
      const activeAlert = await prisma.alert.findFirst({
        where: {
          equipment_id: existing.equipment_id,
          source_id: id,
          type: AlertType.MAINTENANCE,
          status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
        },
      });

      if (activeAlert) {
        const resolvedAlert = await prisma.alert.update({
          where: { id: activeAlert.id },
          data: {
            status: AlertStatus.RESOLVED,
            resolved_by: req.user?.name || req.user?.email || 'Authorized Staff',
            resolved_at: new Date(),
          },
          include: {
            equipment: {
              select: { id: true, code: true, name: true, material: true, location: true },
            },
          },
        });

        try {
          if (redis.status === 'ready') {
            await redis.del(`alert:active:${existing.equipment_id}:MAINTENANCE:${id}`);
            await redis.publish(
              'alerts',
              JSON.stringify({
                event: 'alert.resolved',
                alert: resolvedAlert,
              }),
            );
          }
        } catch (e) {
          console.warn('Redis notice:', (e as Error).message);
        }
      }
    }

    const updatedTask = await prisma.maintenanceTask.update({
      where: { id },
      data: updateData,
      include: {
        equipment: {
          select: { id: true, code: true, name: true, material: true, location: true },
        },
      },
    });

    await writeAudit({
      userId: req.user?.userId,
      action: 'UPDATE_MAINTENANCE_TASK',
      entity: 'MaintenanceTask',
      entityId: id,
      meta: {
        equipmentCode: existing.equipment.code,
        title: updatedTask.title,
        status: updatedTask.status,
        changedFields: Object.keys(updateData),
      },
    });

    return res.status(200).json({
      message: 'Maintenance task updated successfully',
      task: updatedTask,
    });
  } catch (error) {
    console.error('updateMaintenanceTask error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update maintenance task.',
    });
  }
};

export const completeMaintenanceTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.maintenanceTask.findUnique({
      where: { id },
      include: {
        equipment: {
          select: { id: true, code: true, name: true, material: true, location: true },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Maintenance task with ID '${id}' was not found.`,
      });
    }

    if (existing.status === MaintenanceStatus.COMPLETED) {
      return res.status(200).json({
        message: 'Task is already marked as completed',
        task: existing,
      });
    }

    const parseResult = completeMaintenanceSchema.safeParse(req.body);
    const notes = parseResult.success ? parseResult.data.notes || null : null;
    const completedDate = new Date();
    const userName = req.user?.name || req.user?.email || 'Authorized Staff';

    // 1. Mark task as COMPLETED
    const completedTask = await prisma.maintenanceTask.update({
      where: { id },
      data: {
        status: MaintenanceStatus.COMPLETED,
        completed_at: completedDate,
        notes: notes || existing.notes,
      },
      include: {
        equipment: {
          select: { id: true, code: true, name: true, material: true, location: true },
        },
      },
    });

    // 2. Resolve active maintenance alert for this task if one exists
    const activeAlert = await prisma.alert.findFirst({
      where: {
        equipment_id: existing.equipment_id,
        source_id: id,
        type: AlertType.MAINTENANCE,
        status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
      },
    });

    if (activeAlert) {
      const resolvedAlert = await prisma.alert.update({
        where: { id: activeAlert.id },
        data: {
          status: AlertStatus.RESOLVED,
          resolved_by: userName,
          resolved_at: completedDate,
        },
        include: {
          equipment: {
            select: { id: true, code: true, name: true, material: true, location: true },
          },
        },
      });

      try {
        if (redis.status === 'ready') {
          await redis.del(`alert:active:${existing.equipment_id}:MAINTENANCE:${id}`);
          await redis.publish(
            'alerts',
            JSON.stringify({
              event: 'alert.resolved',
              alert: resolvedAlert,
            }),
          );
        }
      } catch (e) {
        console.warn('Redis notice:', (e as Error).message);
      }
    }

    // 3. Recurrence: If recurrence_days set, create next task
    let nextTask = null;
    if (existing.recurrence_days && existing.recurrence_days > 0) {
      const baseTime = Math.max(new Date(existing.due_date).getTime(), completedDate.getTime());
      const nextDueDate = new Date(baseTime + existing.recurrence_days * 24 * 60 * 60 * 1000);

      nextTask = await prisma.maintenanceTask.create({
        data: {
          equipment_id: existing.equipment_id,
          title: existing.title,
          description: existing.description,
          assigned_to: existing.assigned_to,
          recurrence_days: existing.recurrence_days,
          due_date: nextDueDate,
          status: MaintenanceStatus.PENDING,
        },
        include: {
          equipment: {
            select: { id: true, code: true, name: true, material: true, location: true },
          },
        },
      });

      await writeAudit({
        userId: req.user?.userId,
        action: 'CREATE_RECURRING_MAINTENANCE_TASK',
        entity: 'MaintenanceTask',
        entityId: nextTask.id,
        meta: {
          parentTaskId: id,
          title: nextTask.title,
          dueDate: nextTask.due_date.toISOString(),
        },
      });
    }

    // 4. Audit log for completion
    await writeAudit({
      userId: req.user?.userId,
      action: 'COMPLETE_MAINTENANCE_TASK',
      entity: 'MaintenanceTask',
      entityId: id,
      meta: {
        equipmentCode: existing.equipment.code,
        title: existing.title,
        notes,
        nextTaskId: nextTask?.id || null,
      },
    });

    return res.status(200).json({
      message: 'Maintenance task marked as completed successfully',
      task: completedTask,
      nextTask,
    });
  } catch (error) {
    console.error('completeMaintenanceTask error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to complete maintenance task.',
    });
  }
};
