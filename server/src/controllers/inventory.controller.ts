import { Request, Response } from 'express';
import { z } from 'zod';
import { AlertSeverity, AlertStatus, AlertType, RestockStatus, TransactionType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { redis } from '../db/redis';
import { writeAudit } from '../utils/audit';

export type StockStatus = 'GOOD' | 'LOW' | 'CRITICAL';

export function isDiscreteUnit(unit: string): boolean {
  const u = unit.trim().toLowerCase();
  const continuous = ['l', 'liter', 'liters', 'litre', 'litres', 'ml', 'gal', 'gallon', 'gallons', 'kg', 'kilogram', 'kilograms', 'g', 'gram', 'grams', 'lb', 'lbs', 'm3', 'bar', 'psi'];
  return !continuous.includes(u);
}

export function computeStockStatus(quantity: number, minQuantity: number): StockStatus {
  if (quantity < 0.5 * minQuantity) {
    return 'CRITICAL';
  }
  if (quantity < minQuantity) {
    return 'LOW';
  }
  return 'GOOD';
}

// Zod Schemas
const createItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required'),
  material: z.string().trim().min(1, 'Material description is required'),
  unit: z.string().trim().min(1, 'Unit of measurement is required'),
  quantity: z.number().min(0, 'Initial quantity cannot be negative').default(0),
  min_quantity: z.number().positive('Minimum threshold quantity must be greater than 0'),
});

const updateItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name cannot be empty').optional(),
  material: z.string().trim().min(1, 'Material cannot be empty').optional(),
  unit: z.string().trim().min(1, 'Unit cannot be empty').optional(),
  min_quantity: z.number().positive('Minimum quantity must be greater than 0').optional(),
  quantity: z.any().optional(), // Ignored / rejected to enforce transaction-only mutations
});

const transactionSchema = z
  .object({
    type: z.enum(['IN', 'OUT', 'ADJUST'], {
      errorMap: () => ({ message: 'Transaction type must be IN, OUT, or ADJUST' }),
    }),
    quantity: z.number({ required_error: 'Quantity is required' }),
    reason: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'IN' || data.type === 'OUT') {
      if (data.quantity <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${data.type} transaction quantity must be greater than 0`,
          path: ['quantity'],
        });
      }
    } else if (data.type === 'ADJUST') {
      if (data.quantity === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ADJUST transaction delta quantity cannot be 0',
          path: ['quantity'],
        });
      }
      if (!data.reason || data.reason.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Reason is required for ADJUST transactions',
          path: ['reason'],
        });
      }
    }
  });

const createRestockSchema = z.object({
  item_id: z.string().uuid('Invalid item ID format'),
  quantity: z.number().positive('Restock requested quantity must be greater than 0'),
});

const patchRestockSchema = z.object({
  action: z.enum(['approve', 'reject', 'order', 'receive'], {
    errorMap: () => ({ message: "Action must be 'approve', 'reject', 'order', or 'receive'" }),
  }),
});

interface AlertEvalResult {
  type: 'CREATED' | 'UPDATED' | 'RESOLVED';
  alert: any;
}

// Low-stock alert evaluator within a DB transaction
async function evaluateInventoryAlert(
  tx: any,
  item: { id: string; name: string; unit: string; quantity: number; min_quantity: number },
  _userId: string,
  userName: string,
): Promise<AlertEvalResult | null> {
  const stockStatus = computeStockStatus(item.quantity, item.min_quantity);

  if (stockStatus === 'GOOD') {
    const activeAlert = await tx.alert.findFirst({
      where: {
        source_id: item.id,
        type: AlertType.INVENTORY,
        status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
      },
    });

    if (activeAlert) {
      const resolved = await tx.alert.update({
        where: { id: activeAlert.id },
        data: {
          status: AlertStatus.RESOLVED,
          resolved_by: _userId || null,
          resolved_at: new Date(),
        },
      });
      return { type: 'RESOLVED', alert: resolved };
    }
    return null;
  }

  // LOW or CRITICAL
  const severity = stockStatus === 'CRITICAL' ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;
  const message = `${item.name} stock ${stockStatus === 'CRITICAL' ? 'critically low' : 'low'}: ${item.quantity} ${item.unit} (minimum ${item.min_quantity} ${item.unit})`;

  const activeAlert = await tx.alert.findFirst({
    where: {
      source_id: item.id,
      type: AlertType.INVENTORY,
      status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
    },
  });

  if (activeAlert) {
    const updated = await tx.alert.update({
      where: { id: activeAlert.id },
      data: {
        severity,
        message,
        value: item.quantity,
      },
    });
    return { type: 'UPDATED', alert: updated };
  } else {
    const created = await tx.alert.create({
      data: {
        equipment_id: null,
        source_id: item.id,
        type: AlertType.INVENTORY,
        severity,
        message,
        value: item.quantity,
        status: AlertStatus.OPEN,
      },
    });
    return { type: 'CREATED', alert: created };
  }
}

// Redis alert event dispatcher
async function handleAlertRedis(evalResult: AlertEvalResult | null, itemId: string) {
  if (!evalResult) return;
  try {
    if (redis.status === 'ready') {
      if (evalResult.type === 'CREATED') {
        await redis.set(`alert:active:INVENTORY:${itemId}`, evalResult.alert.id);
        await redis.publish(
          'alerts',
          JSON.stringify({
            event: 'alert.created',
            alert: evalResult.alert,
          }),
        );
      } else if (evalResult.type === 'UPDATED') {
        await redis.publish(
          'alerts',
          JSON.stringify({
            event: 'alert.updated',
            alert: evalResult.alert,
          }),
        );
      } else if (evalResult.type === 'RESOLVED') {
        await redis.del(`alert:active:INVENTORY:${itemId}`);
        await redis.publish(
          'alerts',
          JSON.stringify({
            event: 'alert.resolved',
            alert: evalResult.alert,
          }),
        );
      }
    }
  } catch (err) {
    console.warn('Redis alert event dispatch warning:', (err as Error).message);
  }
}

// ==========================================
// INVENTORY ITEMS
// ==========================================

export const getInventoryItems = async (_req: Request, res: Response) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' },
      include: {
        restock_requests: {
          where: {
            status: { in: [RestockStatus.PENDING, RestockStatus.APPROVED, RestockStatus.ORDERED] },
          },
          select: {
            id: true,
            quantity: true,
            status: true,
            created_at: true,
          },
        },
      },
    });

    const enrichedItems = items.map((item) => ({
      ...item,
      stockStatus: computeStockStatus(item.quantity, item.min_quantity),
      hasOpenRestock: item.restock_requests.length > 0,
      openRestockRequest: item.restock_requests[0] || null,
    }));

    return res.status(200).json({
      items: enrichedItems,
    });
  } catch (error) {
    console.error('getInventoryItems error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve inventory items.',
    });
  }
};

export const createInventoryItem = async (req: Request, res: Response) => {
  try {
    const parseResult = createItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid item data';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parseResult.error.errors,
      });
    }

    const { name, material, unit, quantity, min_quantity } = parseResult.data;
    const userId = req.user?.userId;
    const userName = req.user?.name || req.user?.email || 'Authorized User';

    if (isDiscreteUnit(unit)) {
      if (!Number.isInteger(quantity)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Initial quantity must be a whole number (integer) for discrete unit '${unit}'. Fractional values are not allowed.`,
        });
      }
      if (!Number.isInteger(min_quantity)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Minimum threshold quantity must be a whole number (integer) for discrete unit '${unit}'. Fractional values are not allowed.`,
        });
      }
    }

    const existing = await prisma.inventoryItem.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: `An inventory item named '${name}' already exists.`,
      });
    }

    let alertResult: AlertEvalResult | null = null;

    const newItem = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: {
          name,
          material,
          unit,
          quantity,
          min_quantity,
        },
      });

      if (quantity > 0 && userId) {
        await tx.inventoryTransaction.create({
          data: {
            item_id: created.id,
            type: TransactionType.IN,
            quantity,
            reason: 'Initial stock',
            user_id: userId,
          },
        });
      }

      alertResult = await evaluateInventoryAlert(tx, created, userId || '', userName);
      return created;
    });

    await handleAlertRedis(alertResult, newItem.id);

    await writeAudit({
      userId,
      action: 'CREATE_INVENTORY_ITEM',
      entity: 'InventoryItem',
      entityId: newItem.id,
      meta: {
        name: newItem.name,
        material: newItem.material,
        quantity: newItem.quantity,
        min_quantity: newItem.min_quantity,
      },
    });

    return res.status(201).json({
      message: 'Inventory item created successfully',
      item: {
        ...newItem,
        stockStatus: computeStockStatus(newItem.quantity, newItem.min_quantity),
      },
    });
  } catch (error) {
    console.error('createInventoryItem error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create inventory item.',
    });
  }
};

export const updateInventoryItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = updateItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid item update data';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parseResult.error.errors,
      });
    }

    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Inventory item with ID '${id}' was not found.`,
      });
    }

    const { name, material, unit, min_quantity } = parseResult.data;
    const userId = req.user?.userId;
    const userName = req.user?.name || req.user?.email || 'Authorized User';

    const finalUnit = unit !== undefined ? unit : existing.unit;
    if (isDiscreteUnit(finalUnit) && min_quantity !== undefined && !Number.isInteger(min_quantity)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Minimum threshold quantity must be a whole number (integer) for discrete unit '${finalUnit}'. Fractional values are not allowed.`,
      });
    }

    let alertResult: AlertEvalResult | null = null;

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(material !== undefined && { material }),
          ...(unit !== undefined && { unit }),
          ...(min_quantity !== undefined && { min_quantity }),
        },
      });

      alertResult = await evaluateInventoryAlert(tx, item, userId || '', userName);
      return item;
    });

    await handleAlertRedis(alertResult, updated.id);

    await writeAudit({
      userId,
      action: 'UPDATE_INVENTORY_ITEM',
      entity: 'InventoryItem',
      entityId: updated.id,
      meta: {
        name: updated.name,
        min_quantity: updated.min_quantity,
      },
    });

    return res.status(200).json({
      message: 'Inventory item updated successfully',
      item: {
        ...updated,
        stockStatus: computeStockStatus(updated.quantity, updated.min_quantity),
      },
    });
  } catch (error) {
    console.error('updateInventoryItem error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update inventory item.',
    });
  }
};

// ==========================================
// TRANSACTIONS
// ==========================================

export const recordTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = transactionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid transaction parameters';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parseResult.error.errors,
      });
    }

    const { type, quantity, reason } = parseResult.data;
    const userId = req.user?.userId;
    const userName = req.user?.name || req.user?.email || 'Authorized User';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User authentication required' });
    }

    // Check item existence and unit before transaction
    const targetItem = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!targetItem) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Inventory item with ID '${id}' was not found.`,
      });
    }

    if (isDiscreteUnit(targetItem.unit) && !Number.isInteger(quantity)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Transaction quantity must be a whole number (integer) for discrete unit '${targetItem.unit}'. Fractional amounts (e.g. ${quantity}) are not allowed.`,
      });
    }

    // Determine signed delta
    let delta = 0;
    if (type === 'IN') {
      delta = quantity;
    } else if (type === 'OUT') {
      delta = -quantity;
    } else if (type === 'ADJUST') {
      delta = quantity;
    }

    let alertResult: AlertEvalResult | null = null;
    let createdTxRecord: any = null;
    let updatedItemRecord: any = null;

    try {
      await prisma.$transaction(async (tx) => {
        // Atomic update protecting against negative quantity under parallel requests
        const updatedRows: any[] = await tx.$queryRaw`
          UPDATE "inventory_items"
          SET "quantity" = "quantity" + ${delta}
          WHERE "id" = ${id} AND ("quantity" + ${delta}) >= 0
          RETURNING *;
        `;

        if (!updatedRows || updatedRows.length === 0) {
          const oversellErr: any = new Error(
            `Insufficient stock. Current quantity is ${targetItem.quantity} ${targetItem.unit}. Transaction would result in negative stock.`,
          );
          oversellErr.statusCode = 400;
          throw oversellErr;
        }

        updatedItemRecord = updatedRows[0];

        // Record transaction row
        createdTxRecord = await tx.inventoryTransaction.create({
          data: {
            item_id: id,
            type,
            quantity: Math.abs(quantity),
            reason: reason || (type === 'IN' ? 'Stock deposit' : 'Stock withdrawal'),
            user_id: userId,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        });

        // Evaluate stock status and handle alerts
        alertResult = await evaluateInventoryAlert(tx, updatedItemRecord, userId, userName);
      });
    } catch (txError: any) {
      if (txError.statusCode === 400) {
        return res.status(400).json({
          error: 'Bad Request',
          message: txError.message,
        });
      }
      if (txError.statusCode === 404) {
        return res.status(404).json({
          error: 'Not Found',
          message: txError.message,
        });
      }
      throw txError;
    }

    // Publish Redis events
    await handleAlertRedis(alertResult, id);

    // Write audit log
    await writeAudit({
      userId,
      action: 'INVENTORY_TRANSACTION',
      entity: 'InventoryTransaction',
      entityId: createdTxRecord.id,
      meta: {
        itemId: id,
        itemName: updatedItemRecord.name,
        type,
        quantity: Math.abs(quantity),
        delta,
        newQuantity: updatedItemRecord.quantity,
        reason: createdTxRecord.reason,
      },
    });

    return res.status(200).json({
      message: 'Inventory transaction recorded successfully',
      transaction: createdTxRecord,
      item: {
        ...updatedItemRecord,
        stockStatus: computeStockStatus(updatedItemRecord.quantity, updatedItemRecord.min_quantity),
      },
    });
  } catch (error) {
    console.error('recordTransaction error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to record inventory transaction.',
    });
  }
};

export const getItemTransactions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Inventory item with ID '${id}' was not found.`,
      });
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where: { item_id: id },
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return res.status(200).json({
      item: {
        ...item,
        stockStatus: computeStockStatus(item.quantity, item.min_quantity),
      },
      transactions,
    });
  } catch (error) {
    console.error('getItemTransactions error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve transaction history.',
    });
  }
};

// ==========================================
// RESTOCK REQUESTS
// ==========================================

export const getRestockRequests = async (req: Request, res: Response) => {
  try {
    const { status, itemId } = req.query;

    const whereClause: any = {};

    if (status && status !== 'ALL') {
      if (Object.values(RestockStatus).includes(status as RestockStatus)) {
        whereClause.status = status as RestockStatus;
      }
    }

    if (itemId && typeof itemId === 'string' && itemId !== 'ALL') {
      whereClause.item_id = itemId;
    }

    const requests = await prisma.restockRequest.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            material: true,
            unit: true,
            quantity: true,
            min_quantity: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const enriched = requests.map((r) => ({
      ...r,
      item: {
        ...r.item,
        stockStatus: computeStockStatus(r.item.quantity, r.item.min_quantity),
      },
    }));

    return res.status(200).json({
      requests: enriched,
    });
  } catch (error) {
    console.error('getRestockRequests error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve restock requests.',
    });
  }
};

export const createRestockRequest = async (req: Request, res: Response) => {
  try {
    const parseResult = createRestockSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid restock request data';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parseResult.error.errors,
      });
    }

    const { item_id, quantity } = parseResult.data;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User authentication required' });
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id: item_id },
    });

    if (!item) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Inventory item with ID '${item_id}' was not found.`,
      });
    }

    if (isDiscreteUnit(item.unit) && !Number.isInteger(quantity)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Restock requested quantity must be a whole number (integer) for discrete unit '${item.unit}'. Fractional values (e.g. ${quantity}) are not allowed.`,
      });
    }

    // Only one open request (PENDING, APPROVED, ORDERED) per item
    const openRequest = await prisma.restockRequest.findFirst({
      where: {
        item_id,
        status: { in: [RestockStatus.PENDING, RestockStatus.APPROVED, RestockStatus.ORDERED] },
      },
    });

    if (openRequest) {
      return res.status(409).json({
        error: 'Conflict',
        message: `An active restock request already exists for '${item.name}' (Status: ${openRequest.status}).`,
        existingRequestId: openRequest.id,
      });
    }

    const request = await prisma.restockRequest.create({
      data: {
        item_id,
        quantity,
        status: RestockStatus.PENDING,
        requested_by: userId,
      },
      include: {
        item: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await writeAudit({
      userId,
      action: 'CREATE_RESTOCK_REQUEST',
      entity: 'RestockRequest',
      entityId: request.id,
      meta: {
        itemId: item.id,
        itemName: item.name,
        quantity,
      },
    });

    return res.status(201).json({
      message: 'Restock request created successfully',
      request: {
        ...request,
        item: {
          ...request.item,
          stockStatus: computeStockStatus(request.item.quantity, request.item.min_quantity),
        },
      },
    });
  } catch (error) {
    console.error('createRestockRequest error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create restock request.',
    });
  }
};

export const updateRestockRequestStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = patchRestockSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid action parameter';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parseResult.error.errors,
      });
    }

    const { action } = parseResult.data;
    const userId = req.user?.userId;
    const userName = req.user?.name || req.user?.email || 'Authorized User';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User authentication required' });
    }

    const existing = await prisma.restockRequest.findUnique({
      where: { id },
      include: { item: true },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Restock request with ID '${id}' was not found.`,
      });
    }

    // Allowed transition mapping
    // PENDING -> APPROVED or REJECTED
    // APPROVED -> ORDERED or RECEIVED
    // ORDERED -> RECEIVED
    let nextStatus: RestockStatus;

    if (action === 'approve') {
      if (existing.status !== RestockStatus.PENDING) {
        return res.status(409).json({
          error: 'Conflict',
          message: `Cannot approve request in status '${existing.status}'. Only PENDING requests can be approved.`,
        });
      }
      nextStatus = RestockStatus.APPROVED;
    } else if (action === 'reject') {
      if (existing.status !== RestockStatus.PENDING) {
        return res.status(409).json({
          error: 'Conflict',
          message: `Cannot reject request in status '${existing.status}'. Only PENDING requests can be rejected.`,
        });
      }
      nextStatus = RestockStatus.REJECTED;
    } else if (action === 'order') {
      if (existing.status !== RestockStatus.APPROVED) {
        return res.status(409).json({
          error: 'Conflict',
          message: `Cannot mark ordered for request in status '${existing.status}'. Request must be APPROVED first.`,
        });
      }
      nextStatus = RestockStatus.ORDERED;
    } else if (action === 'receive') {
      if (existing.status !== RestockStatus.APPROVED && existing.status !== RestockStatus.ORDERED) {
        return res.status(409).json({
          error: 'Conflict',
          message: `Cannot receive stock for request in status '${existing.status}'. Request must be in APPROVED or ORDERED status.`,
        });
      }
      nextStatus = RestockStatus.RECEIVED;
    } else {
      return res.status(400).json({ error: 'Bad Request', message: `Unknown action '${action}'.` });
    }

    let alertResult: AlertEvalResult | null = null;
    let updatedRequest: any = null;
    let updatedItem: any = null;

    if (action === 'receive') {
      // Execute transaction and item update atomically
      await prisma.$transaction(async (tx) => {
        // Update request status
        updatedRequest = await tx.restockRequest.update({
          where: { id },
          data: { status: nextStatus },
          include: {
            item: true,
            user: { select: { id: true, name: true, email: true } },
          },
        });

        // Add quantity to inventory item
        const rows: any[] = await tx.$queryRaw`
          UPDATE "inventory_items"
          SET "quantity" = "quantity" + ${existing.quantity}
          WHERE "id" = ${existing.item_id}
          RETURNING *;
        `;
        updatedItem = rows[0];

        // Create transaction record
        await tx.inventoryTransaction.create({
          data: {
            item_id: existing.item_id,
            type: TransactionType.IN,
            quantity: existing.quantity,
            reason: 'Restock request received',
            user_id: userId,
          },
        });

        // Evaluate alert (auto-resolve if stock returned to >= min)
        alertResult = await evaluateInventoryAlert(tx, updatedItem, userId, userName);
      });

      await handleAlertRedis(alertResult, existing.item_id);

      // Audit logs
      await writeAudit({
        userId,
        action: 'RESTOCK_REQUEST_RECEIVE',
        entity: 'RestockRequest',
        entityId: id,
        meta: {
          itemId: existing.item_id,
          itemName: existing.item.name,
          quantity: existing.quantity,
          previousStatus: existing.status,
          newStatus: nextStatus,
        },
      });
    } else {
      updatedRequest = await prisma.restockRequest.update({
        where: { id },
        data: { status: nextStatus },
        include: {
          item: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await writeAudit({
        userId,
        action: `RESTOCK_REQUEST_${action.toUpperCase()}`,
        entity: 'RestockRequest',
        entityId: id,
        meta: {
          itemId: existing.item_id,
          itemName: existing.item.name,
          quantity: existing.quantity,
          previousStatus: existing.status,
          newStatus: nextStatus,
        },
      });
    }

    return res.status(200).json({
      message: `Restock request ${action}d successfully`,
      request: {
        ...updatedRequest,
        item: {
          ...updatedRequest.item,
          ...(updatedItem && { quantity: updatedItem.quantity }),
          stockStatus: computeStockStatus(
            updatedItem ? updatedItem.quantity : updatedRequest.item.quantity,
            updatedRequest.item.min_quantity,
          ),
        },
      },
    });
  } catch (error) {
    console.error('updateRestockRequestStatus error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update restock request status.',
    });
  }
};
