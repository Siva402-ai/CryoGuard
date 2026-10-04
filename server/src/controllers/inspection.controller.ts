import { Request, Response } from 'express';
import { z } from 'zod';
import { InspectionResult, AlertType, AlertSeverity, AlertStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { redis } from '../db/redis';
import { writeAudit } from '../utils/audit';

export interface NormalizedTemplateItem {
  label: string;
  critical: boolean;
}

export function normalizeTemplateItems(rawItems: any): NormalizedTemplateItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((item) => {
    if (typeof item === 'string') {
      const lower = item.toLowerCase();
      const isCritical =
        lower.includes('pressure relief') ||
        lower.includes('emergency shutoff') ||
        lower.includes('leak detection') ||
        lower.includes('o2 monitor') ||
        lower.includes('ventilation');
      return { label: item.trim(), critical: isCritical };
    }
    if (typeof item === 'object' && item !== null) {
      return {
        label: String(item.label || item.name || item.item || '').trim(),
        critical: Boolean(item.critical),
      };
    }
    return { label: String(item).trim(), critical: false };
  });
}

// Schemas
const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required'),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1, 'Item label is required'),
        critical: z.boolean().default(false),
      }),
    )
    .min(1, 'At least one checklist item is required'),
});

const inspectionItemResultSchema = z.object({
  item: z.string().trim().min(1, 'Item name is required'),
  result: z.enum(['PASS', 'FAIL'], {
    errorMap: () => ({ message: 'Result must be PASS or FAIL' }),
  }),
  note: z.string().trim().optional(),
});

const createInspectionSchema = z.object({
  equipment_id: z.string().uuid('Valid equipment UUID is required'),
  template_id: z.string().uuid('Valid template UUID is required'),
  results: z.array(inspectionItemResultSchema).min(1, 'Inspection results cannot be empty'),
  findings: z.string().trim().optional(),
  corrective_action: z.string().trim().optional(),
});

// 1. GET /inspection-templates
export const getInspectionTemplates = async (_req: Request, res: Response) => {
  try {
    const templates = await prisma.inspectionTemplate.findMany({
      orderBy: { name: 'asc' },
    });

    const normalized = templates.map((t) => ({
      id: t.id,
      name: t.name,
      items: normalizeTemplateItems(t.items),
    }));

    return res.status(200).json({ templates: normalized });
  } catch (error) {
    console.error('Error in getInspectionTemplates:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve inspection templates',
    });
  }
};

// 2. POST /inspection-templates
export const createInspectionTemplate = async (req: Request, res: Response) => {
  try {
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || 'Invalid inspection template data';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parsed.error.errors,
      });
    }

    const { name, items } = parsed.data;

    const template = await prisma.inspectionTemplate.create({
      data: {
        name,
        items,
      },
    });

    if (req.user?.userId) {
      await writeAudit({
        userId: req.user.userId,
        action: 'CREATE_INSPECTION_TEMPLATE',
        entity: 'InspectionTemplate',
        entityId: template.id,
        meta: {
          name: template.name,
          itemCount: items.length,
        },
      });
    }

    return res.status(201).json({
      message: 'Inspection template created successfully',
      template: {
        id: template.id,
        name: template.name,
        items: normalizeTemplateItems(template.items),
      },
    });
  } catch (error) {
    console.error('Error in createInspectionTemplate:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create inspection template',
    });
  }
};

// 3. GET /inspections
export const getInspections = async (req: Request, res: Response) => {
  try {
    const { equipmentId, overall, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (equipmentId && typeof equipmentId === 'string' && equipmentId !== 'ALL') {
      where.equipment_id = equipmentId;
    }

    if (overall && typeof overall === 'string' && overall !== 'ALL') {
      if (['PASS', 'NEEDS_ATTENTION', 'FAIL'].includes(overall)) {
        where.overall = overall as InspectionResult;
      }
    }

    const [inspections, total] = await Promise.all([
      prisma.inspection.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { performed_at: 'desc' },
        include: {
          equipment: {
            select: { id: true, code: true, name: true, material: true, location: true },
          },
          template: {
            select: { id: true, name: true },
          },
          inspector: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.inspection.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      inspections,
      total,
      page: pageNum,
      totalPages,
    });
  } catch (error) {
    console.error('Error in getInspections:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve inspections',
    });
  }
};

// 4. GET /inspections/:id
export const getInspectionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const inspection = await prisma.inspection.findUnique({
      where: { id },
      include: {
        equipment: {
          select: { id: true, code: true, name: true, material: true, location: true },
        },
        template: {
          select: { id: true, name: true, items: true },
        },
        inspector: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!inspection) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Inspection record not found',
      });
    }

    const normalizedTemplate = {
      id: inspection.template.id,
      name: inspection.template.name,
      items: normalizeTemplateItems(inspection.template.items),
    };

    return res.status(200).json({
      inspection: {
        ...inspection,
        template: normalizedTemplate,
      },
    });
  } catch (error) {
    console.error('Error in getInspectionById:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve inspection record',
    });
  }
};

// 5. POST /inspections
export const createInspection = async (req: Request, res: Response) => {
  try {
    const parsed = createInspectionSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || 'Invalid inspection submission';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parsed.error.errors,
      });
    }

    const { equipment_id, template_id, results, findings, corrective_action } = parsed.data;

    // Check Equipment exists
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipment_id },
    });
    if (!equipment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Equipment not found',
      });
    }

    // Check Template exists
    const template = await prisma.inspectionTemplate.findUnique({
      where: { id: template_id },
    });
    if (!template) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Inspection template not found',
      });
    }

    const templateItems = normalizeTemplateItems(template.items);

    // Rule 1: Every template item must have a result
    if (results.length !== templateItems.length) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Every template item must have a result. Expected ${templateItems.length} items, received ${results.length}.`,
      });
    }

    const itemLabelSet = new Set(templateItems.map((t) => t.label));
    for (const resItem of results) {
      if (!itemLabelSet.has(resItem.item)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Result item "${resItem.item}" does not match any checklist item in template.`,
        });
      }
    }

    // Rule 2: A FAIL requires a note
    const failedItems = results.filter((r) => r.result === 'FAIL');
    for (const failed of failedItems) {
      if (!failed.note || failed.note.trim().length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `A note is required for failed item: "${failed.item}".`,
        });
      }
    }

    // Rule 3: Corrective action is required when any item fails
    if (failedItems.length > 0) {
      if (!corrective_action || corrective_action.trim().length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Corrective action is required when one or more checklist items fail.',
        });
      }
    }

    // Rule 4: Compute overall result (server-side authority)
    let overall: InspectionResult = InspectionResult.PASS;
    if (failedItems.length > 0) {
      let hasCriticalFailure = false;
      for (const failed of failedItems) {
        const matchedTemplateItem = templateItems.find((t) => t.label === failed.item);
        if (matchedTemplateItem?.critical) {
          hasCriticalFailure = true;
          break;
        }
      }

      overall = hasCriticalFailure ? InspectionResult.FAIL : InspectionResult.NEEDS_ATTENTION;
    }

    const inspectorId = req.user?.userId;
    if (!inspectorId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    // Construct Alert message if overall is non-pass
    let alertMessage = '';
    let targetSeverity: AlertSeverity = AlertSeverity.WARNING;
    if (overall !== InspectionResult.PASS) {
      targetSeverity =
        overall === InspectionResult.FAIL ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;

      const failedLabels = failedItems.map((f) => f.item);
      let failedListStr = '';
      if (failedLabels.length <= 3) {
        failedListStr = failedLabels.join(', ');
      } else {
        failedListStr = `${failedLabels.slice(0, 3).join(', ')} +${failedLabels.length - 3} more`;
      }

      alertMessage = `${equipment.code} inspection ${overall === InspectionResult.FAIL ? 'failed' : 'needs attention'}: ${failedListStr}`;
    }

    // Perform Inspection insert and Alert creation in ONE DB transaction
    const { inspection, createdAlert } = await prisma.$transaction(async (tx) => {
      const newInspection = await tx.inspection.create({
        data: {
          equipment_id,
          template_id,
          inspector_id: inspectorId,
          performed_at: new Date(),
          results: results as any,
          overall,
          findings: findings || null,
          corrective_action: corrective_action || null,
        },
        include: {
          equipment: {
            select: { id: true, code: true, name: true, material: true, location: true },
          },
          template: {
            select: { id: true, name: true },
          },
          inspector: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      let alertRecord = null;
      if (overall !== InspectionResult.PASS) {
        alertRecord = await tx.alert.create({
          data: {
            equipment_id: equipment.id,
            source_id: newInspection.id,
            type: AlertType.INSPECTION,
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
      }

      return { inspection: newInspection, createdAlert: alertRecord };
    });

    // Publish alert event on Redis "alerts" channel if alert was created
    if (createdAlert) {
      try {
        if (redis.status === 'ready') {
          await redis.publish(
            'alerts',
            JSON.stringify({
              event: 'alert.created',
              alert: createdAlert,
            }),
          );
        }
      } catch (e) {
        console.warn('Redis notice on inspection alert.created:', (e as Error).message);
      }
    }

    // Write audit log
    await writeAudit({
      userId: inspectorId,
      action: 'CREATE_INSPECTION',
      entity: 'Inspection',
      entityId: inspection.id,
      meta: {
        equipmentCode: equipment.code,
        templateName: template.name,
        overall,
        failedCount: failedItems.length,
      },
    });

    return res.status(201).json({
      message: 'Safety inspection recorded successfully',
      inspection,
      alert: createdAlert,
    });
  } catch (error) {
    console.error('Error in createInspection:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to record safety inspection',
    });
  }
};
