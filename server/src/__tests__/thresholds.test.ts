import { describe, it, expect } from 'vitest';
import {
  evaluateTemperature,
  evaluatePressure,
  evaluateLevel,
  evaluateAllThresholds,
  ThresholdConfig,
} from '../services/threshold.service';
import { EquipmentStatus } from '@prisma/client';

describe('Threshold Evaluation Unit Tests', () => {
  // 1. Liquid Nitrogen (LN2): normal [-196 to -190], warn >= -190, crit >= -185
  describe('LN2 Temperature Thresholds', () => {
    const ln2Config = { temp_warn_c: -190.0, temp_crit_c: -185.0 };

    it('evaluates normal temperature below warning threshold (-190.01°C)', () => {
      const result = evaluateTemperature(-190.01, ln2Config, 'C-001');
      expect(result.status).toBe(EquipmentStatus.NORMAL);
      expect(result.message).toBeUndefined();
    });

    it('evaluates warning exactly at warning threshold (-190.00°C)', () => {
      const result = evaluateTemperature(-190.0, ln2Config, 'C-001');
      expect(result.status).toBe(EquipmentStatus.WARNING);
      expect(result.message).toBe('C-001 temperature -190.00°C exceeded warning threshold (-190.00°C)');
    });

    it('evaluates warning one step above warning threshold (-189.99°C)', () => {
      const result = evaluateTemperature(-189.99, ln2Config, 'C-001');
      expect(result.status).toBe(EquipmentStatus.WARNING);
      expect(result.message).toBe('C-001 temperature -189.99°C exceeded warning threshold (-190.00°C)');
    });

    it('evaluates warning one step below critical threshold (-185.01°C)', () => {
      const result = evaluateTemperature(-185.01, ln2Config, 'C-001');
      expect(result.status).toBe(EquipmentStatus.WARNING);
      expect(result.message).toBe('C-001 temperature -185.01°C exceeded warning threshold (-190.00°C)');
    });

    it('evaluates critical exactly at critical threshold (-185.00°C)', () => {
      const result = evaluateTemperature(-185.0, ln2Config, 'C-001');
      expect(result.status).toBe(EquipmentStatus.CRITICAL);
      expect(result.message).toBe('C-001 temperature -185.00°C exceeded critical threshold (-185.00°C)');
    });

    it('evaluates critical one step above critical threshold (-184.99°C)', () => {
      const result = evaluateTemperature(-184.99, ln2Config, 'C-001');
      expect(result.status).toBe(EquipmentStatus.CRITICAL);
      expect(result.message).toBe('C-001 temperature -184.99°C exceeded critical threshold (-185.00°C)');
    });
  });

  // 2. Liquid Oxygen (LOX): normal [-183 to -180], warn >= -180, crit >= -175
  describe('LOX Temperature Thresholds', () => {
    const loxConfig = { temp_warn_c: -180.0, temp_crit_c: -175.0 };

    it('evaluates normal temperature below warning threshold (-180.01°C)', () => {
      const result = evaluateTemperature(-180.01, loxConfig, 'C-003');
      expect(result.status).toBe(EquipmentStatus.NORMAL);
    });

    it('evaluates warning exactly at warning threshold (-180.00°C)', () => {
      const result = evaluateTemperature(-180.0, loxConfig, 'C-003');
      expect(result.status).toBe(EquipmentStatus.WARNING);
      expect(result.message).toBe('C-003 temperature -180.00°C exceeded warning threshold (-180.00°C)');
    });

    it('evaluates warning one step above warning threshold (-179.99°C)', () => {
      const result = evaluateTemperature(-179.99, loxConfig, 'C-003');
      expect(result.status).toBe(EquipmentStatus.WARNING);
    });

    it('evaluates warning one step below critical threshold (-175.01°C)', () => {
      const result = evaluateTemperature(-175.01, loxConfig, 'C-003');
      expect(result.status).toBe(EquipmentStatus.WARNING);
    });

    it('evaluates critical exactly at critical threshold (-175.00°C)', () => {
      const result = evaluateTemperature(-175.0, loxConfig, 'C-003');
      expect(result.status).toBe(EquipmentStatus.CRITICAL);
      expect(result.message).toBe('C-003 temperature -175.00°C exceeded critical threshold (-175.00°C)');
    });

    it('evaluates critical one step above critical threshold (-174.99°C)', () => {
      const result = evaluateTemperature(-174.99, loxConfig, 'C-003');
      expect(result.status).toBe(EquipmentStatus.CRITICAL);
    });
  });

  // 3. Liquid Argon (Argon): normal [-186 to -183], warn >= -183, crit >= -178
  describe('Argon Temperature Thresholds', () => {
    const argonConfig = { temp_warn_c: -183.0, temp_crit_c: -178.0 };

    it('evaluates normal temperature below warning threshold (-183.01°C)', () => {
      const result = evaluateTemperature(-183.01, argonConfig, 'C-005');
      expect(result.status).toBe(EquipmentStatus.NORMAL);
    });

    it('evaluates warning exactly at warning threshold (-183.00°C)', () => {
      const result = evaluateTemperature(-183.0, argonConfig, 'C-005');
      expect(result.status).toBe(EquipmentStatus.WARNING);
      expect(result.message).toBe('C-005 temperature -183.00°C exceeded warning threshold (-183.00°C)');
    });

    it('evaluates warning one step above warning threshold (-182.99°C)', () => {
      const result = evaluateTemperature(-182.99, argonConfig, 'C-005');
      expect(result.status).toBe(EquipmentStatus.WARNING);
    });

    it('evaluates warning one step below critical threshold (-178.01°C)', () => {
      const result = evaluateTemperature(-178.01, argonConfig, 'C-005');
      expect(result.status).toBe(EquipmentStatus.WARNING);
    });

    it('evaluates critical exactly at critical threshold (-178.00°C)', () => {
      const result = evaluateTemperature(-178.0, argonConfig, 'C-005');
      expect(result.status).toBe(EquipmentStatus.CRITICAL);
      expect(result.message).toBe('C-005 temperature -178.00°C exceeded critical threshold (-178.00°C)');
    });

    it('evaluates critical one step above critical threshold (-177.99°C)', () => {
      const result = evaluateTemperature(-177.99, argonConfig, 'C-005');
      expect(result.status).toBe(EquipmentStatus.CRITICAL);
    });
  });

  // 4. Pressure: warning >= 1.80 bar, critical >= 2.20 bar
  describe('Pressure Thresholds', () => {
    const pressureConfig = { pressure_warn_bar: 1.8, pressure_crit_bar: 2.2 };

    it('evaluates normal pressure below warning (1.79 bar)', () => {
      const result = evaluatePressure(1.79, pressureConfig, 'C-001');
      expect(result.status).toBe(EquipmentStatus.NORMAL);
    });

    it('evaluates warning exactly at warning threshold (1.80 bar)', () => {
      const result = evaluatePressure(1.8, pressureConfig, 'C-001');
      expect(result.status).toBe(EquipmentStatus.WARNING);
      expect(result.message).toBe('C-001 pressure 1.80 bar exceeded warning threshold (1.80 bar)');
    });

    it('evaluates warning one step above warning (1.81 bar)', () => {
      const result = evaluatePressure(1.81, pressureConfig, 'C-001');
      expect(result.status).toBe(EquipmentStatus.WARNING);
    });

    it('evaluates warning one step below critical (2.19 bar)', () => {
      const result = evaluatePressure(2.19, pressureConfig, 'C-001');
      expect(result.status).toBe(EquipmentStatus.WARNING);
    });

    it('evaluates critical exactly at critical threshold (2.20 bar)', () => {
      const result = evaluatePressure(2.2, pressureConfig, 'C-001');
      expect(result.status).toBe(EquipmentStatus.CRITICAL);
      expect(result.message).toBe('C-001 pressure 2.20 bar exceeded critical threshold (2.20 bar)');
    });

    it('evaluates critical one step above critical (2.21 bar)', () => {
      const result = evaluatePressure(2.21, pressureConfig, 'C-001');
      expect(result.status).toBe(EquipmentStatus.CRITICAL);
    });
  });

  // 5. Level: warning <= 30.0%, critical <= 15.0%
  describe('Level Thresholds', () => {
    const levelConfig = { level_warn_pct: 30.0, level_crit_pct: 15.0 };

    it('evaluates normal level above warning (30.1%)', () => {
      const result = evaluateLevel(30.1, levelConfig, 'C-001');
      expect(result.status).toBe(EquipmentStatus.NORMAL);
    });

    it('evaluates warning exactly at warning threshold (30.0%)', () => {
      const result = evaluateLevel(30.0, levelConfig, 'C-001');
      expect(result.status).toBe(EquipmentStatus.WARNING);
      expect(result.message).toBe('C-001 level 30.00% dropped below warning threshold (30.00%)');
    });

    it('evaluates warning one step below warning (29.9%)', () => {
      const result = evaluateLevel(29.9, levelConfig, 'C-001');
      expect(result.status).toBe(EquipmentStatus.WARNING);
    });

    it('evaluates warning one step above critical (15.1%)', () => {
      const result = evaluateLevel(15.1, levelConfig, 'C-001');
      expect(result.status).toBe(EquipmentStatus.WARNING);
    });

    it('evaluates critical exactly at critical threshold (15.0%)', () => {
      const result = evaluateLevel(15.0, levelConfig, 'C-001');
      expect(result.status).toBe(EquipmentStatus.CRITICAL);
      expect(result.message).toBe('C-001 level 15.00% dropped below critical threshold (15.00%)');
    });

    it('evaluates critical one step below critical (14.9%)', () => {
      const result = evaluateLevel(14.9, levelConfig, 'C-001');
      expect(result.status).toBe(EquipmentStatus.CRITICAL);
    });
  });

  // 6. Full Multi-Metric Evaluation & Overall Status Precedence
  describe('Full Multi-Metric Evaluation', () => {
    const fullConfig: ThresholdConfig = {
      temp_warn_c: -190.0,
      temp_crit_c: -185.0,
      pressure_warn_bar: 1.8,
      pressure_crit_bar: 2.2,
      level_warn_pct: 30.0,
      level_crit_pct: 15.0,
    };

    it('returns NORMAL overall when all metrics are nominal', () => {
      const res = evaluateAllThresholds(
        { temperature_c: -192.5, pressure_bar: 1.5, level_pct: 85.0 },
        fullConfig,
        'C-001',
      );
      expect(res.overall).toBe(EquipmentStatus.NORMAL);
      expect(res.temp.status).toBe(EquipmentStatus.NORMAL);
      expect(res.pressure.status).toBe(EquipmentStatus.NORMAL);
      expect(res.level.status).toBe(EquipmentStatus.NORMAL);
    });

    it('returns WARNING overall when any metric is in WARNING', () => {
      const res = evaluateAllThresholds(
        { temperature_c: -189.0, pressure_bar: 1.5, level_pct: 85.0 },
        fullConfig,
        'C-001',
      );
      expect(res.overall).toBe(EquipmentStatus.WARNING);
    });

    it('returns CRITICAL overall when any metric is in CRITICAL, even if others are WARNING', () => {
      const res = evaluateAllThresholds(
        { temperature_c: -189.0, pressure_bar: 2.25, level_pct: 85.0 },
        fullConfig,
        'C-001',
      );
      expect(res.overall).toBe(EquipmentStatus.CRITICAL);
    });
  });
});
