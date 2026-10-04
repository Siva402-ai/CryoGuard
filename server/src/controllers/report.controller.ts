import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { generateCsv } from '../utils/csv';

const reportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  equipmentId: z.string().uuid().optional().nullable(),
  format: z.enum(['json', 'csv']).default('json'),
});

interface ParsedReportQuery {
  fromDate: Date;
  toDate: Date;
  equipmentId?: string | null;
  format: 'json' | 'csv';
  fromStr: string;
  toStr: string;
}

function parseAndValidateParams(req: Request, res: Response): ParsedReportQuery | null {
  const parsed = reportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.issues });
    return null;
  }

  const { from, to, equipmentId, format } = parsed.data;

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let fromDate = defaultFrom;
  let toDate = now;

  if (from) {
    fromDate = new Date(from);
    if (isNaN(fromDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format for "from"' });
      return null;
    }
  }

  if (to) {
    toDate = new Date(to);
    if (isNaN(toDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format for "to"' });
      return null;
    }
  }

  if (fromDate.getTime() > toDate.getTime()) {
    res.status(400).json({ error: "'from' date must be before or equal to 'to' date" });
    return null;
  }

  const diffMs = toDate.getTime() - fromDate.getTime();
  const maxRangeMs = 366 * 24 * 60 * 60 * 1000;
  if (diffMs > maxRangeMs) {
    res.status(400).json({ error: 'Date range cannot exceed 366 days' });
    return null;
  }

  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr = toDate.toISOString().slice(0, 10);

  return {
    fromDate,
    toDate,
    equipmentId,
    format: format || 'json',
    fromStr,
    toStr,
  };
}

function sendCsv(res: Response, filename: string, headers: string[], rows: unknown[][]) {
  const csvData = generateCsv(headers, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csvData);
}

/**
 * GET /reports/temperature-trend
 */
export const getTemperatureTrendReport = async (req: Request, res: Response) => {
  try {
    const params = parseAndValidateParams(req, res);
    if (!params) return;

    const { fromDate, toDate, equipmentId, format, fromStr, toStr } = params;
    const diffMs = toDate.getTime() - fromDate.getTime();

    // 5 min up to 6h, 1 hour up to 3 days, 1 day beyond
    let bucketInterval = '1 day';
    let bucketSize = '1 day';
    if (diffMs <= 6 * 60 * 60 * 1000) {
      bucketInterval = '5 minutes';
      bucketSize = '5 minutes';
    } else if (diffMs <= 3 * 24 * 60 * 60 * 1000) {
      bucketInterval = '1 hour';
      bucketSize = '1 hour';
    }

    // Earliest reading available (retention metadata)
    const earliestRow = await prisma.$queryRaw<{ earliest: Date | null }[]>`
      SELECT MIN(recorded_at) as earliest FROM sensor_readings
    `;
    const earliestReading = earliestRow[0]?.earliest || null;

    // Parameterized time bucketing query with date_bin
    const rows = await prisma.$queryRaw<
      {
        equipmentId: string;
        equipmentCode: string;
        equipmentName: string;
        bucket: Date;
        avgTemp: number;
        minTemp: number;
        maxTemp: number;
        count: number;
      }[]
    >`
      SELECT
        sr.equipment_id as "equipmentId",
        e.code as "equipmentCode",
        e.name as "equipmentName",
        date_bin(${bucketInterval}::interval, sr.recorded_at, TIMESTAMP '2000-01-01 00:00:00') as bucket,
        ROUND(AVG(sr.temperature_c)::numeric, 2)::float as "avgTemp",
        ROUND(MIN(sr.temperature_c)::numeric, 2)::float as "minTemp",
        ROUND(MAX(sr.temperature_c)::numeric, 2)::float as "maxTemp",
        COUNT(*)::int as count
      FROM sensor_readings sr
      JOIN equipment e ON sr.equipment_id = e.id
      WHERE sr.recorded_at >= ${fromDate} AND sr.recorded_at <= ${toDate}
      ${equipmentId ? Prisma.sql`AND sr.equipment_id = ${equipmentId}` : Prisma.empty}
      GROUP BY sr.equipment_id, e.code, e.name, bucket
      ORDER BY bucket ASC, e.code ASC
    `;

    if (format === 'csv') {
      const csvHeaders = [
        'Timestamp',
        'Equipment Code',
        'Equipment Name',
        'Avg Temp (°C)',
        'Min Temp (°C)',
        'Max Temp (°C)',
        'Readings Count',
      ];
      const csvRows = rows.map((r) => [
        r.bucket instanceof Date ? r.bucket.toISOString() : new Date(r.bucket).toISOString(),
        r.equipmentCode,
        r.equipmentName,
        r.avgTemp,
        r.minTemp,
        r.maxTemp,
        r.count,
      ]);
      return sendCsv(
        res,
        `cryoguard-temperature-trend-${fromStr}-${toStr}.csv`,
        csvHeaders,
        csvRows
      );
    }

    return res.json({
      meta: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        bucketSize,
        retentionDays: 7,
        dataFrom: earliestReading instanceof Date ? earliestReading.toISOString() : earliestReading,
      },
      data: rows,
    });
  } catch (error: any) {
    req.log?.error?.({ err: error }, 'Failed to generate temperature trend report');
    return res.status(500).json({ error: 'Failed to generate temperature trend report' });
  }
};

/**
 * GET /reports/alerts-by-month
 */
export const getAlertsByMonthReport = async (req: Request, res: Response) => {
  try {
    const params = parseAndValidateParams(req, res);
    if (!params) return;

    const { fromDate, toDate, equipmentId, format, fromStr, toStr } = params;

    const rows = await prisma.$queryRaw<
      {
        month: string;
        severity: string;
        type: string;
        count: number;
      }[]
    >`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
        severity::text as severity,
        type::text as type,
        COUNT(*)::int as count
      FROM alerts
      WHERE created_at >= ${fromDate} AND created_at <= ${toDate}
      ${equipmentId ? Prisma.sql`AND equipment_id = ${equipmentId}` : Prisma.empty}
      GROUP BY DATE_TRUNC('month', created_at), severity, type
      ORDER BY month ASC, severity ASC, type ASC
    `;

    if (format === 'csv') {
      const csvHeaders = ['Month', 'Severity', 'Type', 'Count'];
      const csvRows = rows.map((r) => [r.month, r.severity, r.type, r.count]);
      return sendCsv(
        res,
        `cryoguard-alerts-by-month-${fromStr}-${toStr}.csv`,
        csvHeaders,
        csvRows
      );
    }

    return res.json({
      meta: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      data: rows,
    });
  } catch (error: any) {
    req.log?.error?.({ err: error }, 'Failed to generate alerts report');
    return res.status(500).json({ error: 'Failed to generate alerts report' });
  }
};

/**
 * GET /reports/maintenance-history
 */
export const getMaintenanceHistoryReport = async (req: Request, res: Response) => {
  try {
    const params = parseAndValidateParams(req, res);
    if (!params) return;

    const { fromDate, toDate, equipmentId, format, fromStr, toStr } = params;

    const tasks = await prisma.$queryRaw<
      {
        id: string;
        title: string;
        description: string;
        status: string;
        dueDate: Date;
        completedAt: Date | null;
        assignedTo: string | null;
        assigneeName: string | null;
        notes: string | null;
        equipmentCode: string;
        equipmentName: string;
      }[]
    >`
      SELECT
        mt.id,
        mt.title,
        mt.description,
        mt.status::text as status,
        mt.due_date as "dueDate",
        mt.completed_at as "completedAt",
        mt.assigned_to as "assignedTo",
        u.name as "assigneeName",
        mt.notes,
        e.code as "equipmentCode",
        e.name as "equipmentName"
      FROM maintenance_tasks mt
      JOIN equipment e ON mt.equipment_id = e.id
      LEFT JOIN users u ON mt.assigned_to = u.id
      WHERE mt.due_date >= ${fromDate} AND mt.due_date <= ${toDate}
      ${equipmentId ? Prisma.sql`AND mt.equipment_id = ${equipmentId}` : Prisma.empty}
      ORDER BY mt.due_date DESC
    `;

    // Summary calculations
    const total = tasks.length;
    let completed = 0;
    let overdue = 0;
    let onTimeCount = 0;

    const monthlyMap = new Map<string, { month: string; completed: number; overdue: number }>();

    for (const t of tasks) {
      const monthStr = (t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate))
        .toISOString()
        .slice(0, 7);

      if (!monthlyMap.has(monthStr)) {
        monthlyMap.set(monthStr, { month: monthStr, completed: 0, overdue: 0 });
      }
      const mData = monthlyMap.get(monthStr)!;

      if (t.status === 'COMPLETED') {
        completed++;
        mData.completed++;
        if (t.completedAt) {
          const compTime = new Date(t.completedAt).getTime();
          const dueTime = new Date(t.dueDate).getTime();
          if (compTime <= dueTime) {
            onTimeCount++;
          }
        }
      } else if (t.status === 'OVERDUE' || new Date(t.dueDate).getTime() < Date.now()) {
        overdue++;
        mData.overdue++;
      }
    }

    const onTimeRate = completed > 0 ? Math.round((onTimeCount / completed) * 100) : 0;
    const byMonth = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    if (format === 'csv') {
      const csvHeaders = [
        'Equipment Code',
        'Equipment Name',
        'Task Title',
        'Assigned To',
        'Due Date',
        'Completed At',
        'Status',
        'Notes',
      ];
      const csvRows = tasks.map((t) => [
        t.equipmentCode,
        t.equipmentName,
        t.title,
        t.assigneeName || 'Unassigned',
        t.dueDate ? (t.dueDate instanceof Date ? t.dueDate.toISOString() : new Date(t.dueDate).toISOString()) : '',
        t.completedAt ? (t.completedAt instanceof Date ? t.completedAt.toISOString() : new Date(t.completedAt).toISOString()) : '',
        t.status,
        t.notes || '',
      ]);
      return sendCsv(
        res,
        `cryoguard-maintenance-history-${fromStr}-${toStr}.csv`,
        csvHeaders,
        csvRows
      );
    }

    return res.json({
      meta: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      summary: {
        total,
        completed,
        overdue,
        onTimeRate,
      },
      byMonth,
      tasks,
    });
  } catch (error: any) {
    req.log?.error?.({ err: error }, 'Failed to generate maintenance history report');
    return res.status(500).json({ error: 'Failed to generate maintenance history report' });
  }
};

/**
 * GET /reports/inventory-consumption
 */
export const getInventoryConsumptionReport = async (req: Request, res: Response) => {
  try {
    const params = parseAndValidateParams(req, res);
    if (!params) return;

    const { fromDate, toDate, format, fromStr, toStr } = params;

    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' },
    });

    const transactions = await prisma.$queryRaw<
      {
        itemId: string;
        type: string;
        quantity: number;
        createdAt: Date;
        week: string;
        weekStart: Date;
      }[]
    >`
      SELECT
        it.item_id as "itemId",
        it.type::text as type,
        it.quantity::float as quantity,
        it.created_at as "createdAt",
        TO_CHAR(DATE_TRUNC('week', it.created_at), 'YYYY-"W"IW') as week,
        DATE_TRUNC('week', it.created_at) as "weekStart"
      FROM inventory_transactions it
      WHERE it.created_at >= ${fromDate} AND it.created_at <= ${toDate}
      ORDER BY it.created_at ASC
    `;

    // Map item aggregates
    const itemMap = new Map<
      string,
      {
        id: string;
        name: string;
        material: string;
        unit: string;
        currentQuantity: number;
        totalIn: number;
        totalOut: number;
        netChange: number;
        weeklyOut: Map<string, number>;
      }
    >();

    const allWeeksSet = new Set<string>();

    for (const item of items) {
      itemMap.set(item.id, {
        id: item.id,
        name: item.name,
        material: item.material,
        unit: item.unit,
        currentQuantity: item.quantity,
        totalIn: 0,
        totalOut: 0,
        netChange: 0,
        weeklyOut: new Map(),
      });
    }

    for (const tx of transactions) {
      let entry = itemMap.get(tx.itemId);
      if (!entry) continue;

      const weekStr = tx.week || (tx.createdAt instanceof Date ? tx.createdAt : new Date(tx.createdAt)).toISOString().slice(0, 10);
      allWeeksSet.add(weekStr);

      if (tx.type === 'IN') {
        entry.totalIn = Math.round((entry.totalIn + tx.quantity) * 100) / 100;
      } else if (tx.type === 'OUT') {
        entry.totalOut = Math.round((entry.totalOut + tx.quantity) * 100) / 100;
        const currentWOut = entry.weeklyOut.get(weekStr) || 0;
        entry.weeklyOut.set(weekStr, Math.round((currentWOut + tx.quantity) * 100) / 100);
      }
      entry.netChange = Math.round((entry.totalIn - entry.totalOut) * 100) / 100;
    }

    const itemAggregates = Array.from(itemMap.values()).map((item) => ({
      id: item.id,
      name: item.name,
      material: item.material,
      unit: item.unit,
      currentQuantity: item.currentQuantity,
      totalIn: item.totalIn,
      totalOut: item.totalOut,
      netChange: item.netChange,
      weeklyOut: Array.from(item.weeklyOut.entries()).map(([week, out]) => ({ week, totalOut: out })),
    }));

    if (format === 'csv') {
      const csvHeaders = ['Item Name', 'Material', 'Unit', 'Total IN', 'Total OUT', 'Net Change'];
      const csvRows = itemAggregates.map((item) => [
        item.name,
        item.material,
        item.unit,
        item.totalIn,
        item.totalOut,
        item.netChange,
      ]);
      return sendCsv(
        res,
        `cryoguard-inventory-consumption-${fromStr}-${toStr}.csv`,
        csvHeaders,
        csvRows
      );
    }

    return res.json({
      meta: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      items: itemAggregates,
    });
  } catch (error: any) {
    req.log?.error?.({ err: error }, 'Failed to generate inventory consumption report');
    return res.status(500).json({ error: 'Failed to generate inventory consumption report' });
  }
};
