import { Request, Response } from 'express';
import { z } from 'zod';
import { EquipmentStatus, AlertType, AlertSeverity, AlertStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { redis } from '../db/redis';

const SIMULATOR_API_KEY = process.env.SIMULATOR_API_KEY || 'cryoguard-sim-key-secret-999';

const readingIngestSchema = z.object({
  code: z.string().trim().min(1, 'Equipment code is required'),
  temperature_c: z.number({ required_error: 'temperature_c is required' }),
  pressure_bar: z.number({ required_error: 'pressure_bar is required' }),
  level_pct: z
    .number({ required_error: 'level_pct is required' })
    .min(0, 'level_pct cannot be negative')
    .max(100, 'level_pct cannot exceed 100'),
  recorded_at: z.string().datetime().optional(),
});

interface MetricAlertCheck {
  type: AlertType;
  status: EquipmentStatus;
  value: number;
  message: string;
}

async function handleMetricAlert(equipment: any, check: MetricAlertCheck) {
  if (check.status === EquipmentStatus.NORMAL || check.status === EquipmentStatus.OFFLINE) {
    return;
  }

  const targetSeverity =
    check.status === EquipmentStatus.CRITICAL ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;

  // DB source of truth for active alert (OPEN or ACKNOWLEDGED)
  const activeAlert = await prisma.alert.findFirst({
    where: {
      equipment_id: equipment.id,
      type: check.type,
      status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
    },
    include: {
      equipment: {
        select: { id: true, code: true, name: true, material: true, location: true },
      },
    },
  });

  if (!activeAlert) {
    // Create new alert row
    const newAlert = await prisma.alert.create({
      data: {
        equipment_id: equipment.id,
        type: check.type,
        severity: targetSeverity,
        message: check.message,
        value: check.value,
        status: AlertStatus.OPEN,
      },
      include: {
        equipment: {
          select: { id: true, code: true, name: true, material: true, location: true },
        },
      },
    });

    // Set fast path dedupe key in Redis and publish alert.created
    try {
      if (redis.status === 'ready') {
        await redis.set(`alert:active:${equipment.id}:${check.type}`, newAlert.id);
        await redis.publish(
          'alerts',
          JSON.stringify({
            event: 'alert.created',
            alert: newAlert,
          }),
        );
      }
    } catch (e) {
      console.warn('Redis pub/sub warning on alert.created:', (e as Error).message);
    }
  } else if (
    activeAlert.severity === AlertSeverity.WARNING &&
    targetSeverity === AlertSeverity.CRITICAL
  ) {
    // Escalate in-place
    const updatedAlert = await prisma.alert.update({
      where: { id: activeAlert.id },
      data: {
        severity: AlertSeverity.CRITICAL,
        message: check.message,
        value: check.value,
      },
      include: {
        equipment: {
          select: { id: true, code: true, name: true, material: true, location: true },
        },
      },
    });

    try {
      if (redis.status === 'ready') {
        await redis.set(`alert:active:${equipment.id}:${check.type}`, updatedAlert.id);
        await redis.publish(
          'alerts',
          JSON.stringify({
            event: 'alert.updated',
            alert: updatedAlert,
          }),
        );
      }
    } catch (e) {
      console.warn('Redis pub/sub warning on alert.updated:', (e as Error).message);
    }
  }
}

export const ingestReading = async (req: Request, res: Response) => {
  try {
    // 1. Validate API Key from x-api-key header
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== SIMULATOR_API_KEY) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or missing x-api-key header for telemetry ingestion.',
      });
    }

    // 2. Validate Reading Payload
    const parseResult = readingIngestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid reading payload';
      return res.status(400).json({
        error: 'Validation Error',
        message: firstError,
        details: parseResult.error.errors,
      });
    }

    const { code, temperature_c, pressure_bar, level_pct, recorded_at } = parseResult.data;

    // 3. Resolve Equipment
    const equipment = await prisma.equipment.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!equipment) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Equipment with code '${code}' was not found.`,
      });
    }

    // 4. Record Reading in PostgreSQL
    const recordedDate = recorded_at ? new Date(recorded_at) : new Date();
    const reading = await prisma.sensorReading.create({
      data: {
        equipment_id: equipment.id,
        temperature_c,
        pressure_bar,
        level_pct,
        recorded_at: recordedDate,
      },
    });

    // 5. Evaluate Thresholds
    let tempStatus: EquipmentStatus = EquipmentStatus.NORMAL;
    let tempMessage = '';
    if (temperature_c >= equipment.temp_crit_c) {
      tempStatus = EquipmentStatus.CRITICAL;
      tempMessage = `${equipment.code} temperature ${temperature_c.toFixed(2)}°C exceeded critical threshold (${equipment.temp_crit_c.toFixed(2)}°C)`;
    } else if (temperature_c >= equipment.temp_warn_c) {
      tempStatus = EquipmentStatus.WARNING;
      tempMessage = `${equipment.code} temperature ${temperature_c.toFixed(2)}°C exceeded warning threshold (${equipment.temp_warn_c.toFixed(2)}°C)`;
    }

    let pressureStatus: EquipmentStatus = EquipmentStatus.NORMAL;
    let pressureMessage = '';
    if (pressure_bar >= equipment.pressure_crit_bar) {
      pressureStatus = EquipmentStatus.CRITICAL;
      pressureMessage = `${equipment.code} pressure ${pressure_bar.toFixed(2)} bar exceeded critical threshold (${equipment.pressure_crit_bar.toFixed(2)} bar)`;
    } else if (pressure_bar >= equipment.pressure_warn_bar) {
      pressureStatus = EquipmentStatus.WARNING;
      pressureMessage = `${equipment.code} pressure ${pressure_bar.toFixed(2)} bar exceeded warning threshold (${equipment.pressure_warn_bar.toFixed(2)} bar)`;
    }

    let levelStatus: EquipmentStatus = EquipmentStatus.NORMAL;
    let levelMessage = '';
    if (level_pct <= equipment.level_crit_pct) {
      levelStatus = EquipmentStatus.CRITICAL;
      levelMessage = `${equipment.code} level ${level_pct.toFixed(2)}% dropped below critical threshold (${equipment.level_crit_pct.toFixed(2)}%)`;
    } else if (level_pct <= equipment.level_warn_pct) {
      levelStatus = EquipmentStatus.WARNING;
      levelMessage = `${equipment.code} level ${level_pct.toFixed(2)}% dropped below warning threshold (${equipment.level_warn_pct.toFixed(2)}%)`;
    }

    // Determine overall computedStatus for equipment
    let computedStatus: EquipmentStatus = EquipmentStatus.NORMAL;
    if (
      tempStatus === EquipmentStatus.CRITICAL ||
      pressureStatus === EquipmentStatus.CRITICAL ||
      levelStatus === EquipmentStatus.CRITICAL
    ) {
      computedStatus = EquipmentStatus.CRITICAL;
    } else if (
      tempStatus === EquipmentStatus.WARNING ||
      pressureStatus === EquipmentStatus.WARNING ||
      levelStatus === EquipmentStatus.WARNING
    ) {
      computedStatus = EquipmentStatus.WARNING;
    } else {
      computedStatus = EquipmentStatus.NORMAL;
    }

    // 6. Update Equipment status in DB if changed
    if (equipment.status !== computedStatus) {
      await prisma.equipment.update({
        where: { id: equipment.id },
        data: { status: computedStatus },
      });
    }

    // 7. Cache latest reading in Redis
    const cacheData = {
      equipmentId: equipment.id,
      code: equipment.code,
      name: equipment.name,
      material: equipment.material,
      temperature_c,
      pressure_bar,
      level_pct,
      status: computedStatus,
      recorded_at: recordedDate.toISOString(),
    };

    try {
      if (redis.status === 'ready') {
        await redis.set(`reading:latest:${equipment.id}`, JSON.stringify(cacheData), 'EX', 86400);
      }
    } catch (cacheErr) {
      console.warn(`Redis caching notice for equipment ${equipment.id}:`, (cacheErr as Error).message);
    }

    // 8. Process Alerts for Breached Thresholds
    await handleMetricAlert(equipment, {
      type: AlertType.TEMPERATURE,
      status: tempStatus,
      value: temperature_c,
      message: tempMessage,
    });

    await handleMetricAlert(equipment, {
      type: AlertType.PRESSURE,
      status: pressureStatus,
      value: pressure_bar,
      message: pressureMessage,
    });

    await handleMetricAlert(equipment, {
      type: AlertType.LEVEL,
      status: levelStatus,
      value: level_pct,
      message: levelMessage,
    });

    return res.status(201).json({
      message: 'Reading recorded and telemetry evaluated successfully',
      readingId: reading.id,
      equipmentCode: equipment.code,
      status: computedStatus,
      reading: {
        temperature_c,
        pressure_bar,
        level_pct,
        recorded_at: recordedDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('ingestReading error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to record sensor reading telemetry.',
    });
  }
};
