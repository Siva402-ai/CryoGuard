import { EquipmentStatus } from '@prisma/client';

export interface ThresholdConfig {
  temp_warn_c: number;
  temp_crit_c: number;
  pressure_warn_bar: number;
  pressure_crit_bar: number;
  level_warn_pct: number;
  level_crit_pct: number;
}

export interface MetricEvaluation {
  status: EquipmentStatus;
  message?: string;
}

export interface FullEvaluation {
  temp: MetricEvaluation;
  pressure: MetricEvaluation;
  level: MetricEvaluation;
  overall: EquipmentStatus;
}

export function evaluateTemperature(tempC: number, config: Pick<ThresholdConfig, 'temp_warn_c' | 'temp_crit_c'>, code = 'TANK'): MetricEvaluation {
  if (tempC >= config.temp_crit_c) {
    return {
      status: EquipmentStatus.CRITICAL,
      message: `${code} temperature ${tempC.toFixed(2)}°C exceeded critical threshold (${config.temp_crit_c.toFixed(2)}°C)`,
    };
  }
  if (tempC >= config.temp_warn_c) {
    return {
      status: EquipmentStatus.WARNING,
      message: `${code} temperature ${tempC.toFixed(2)}°C exceeded warning threshold (${config.temp_warn_c.toFixed(2)}°C)`,
    };
  }
  return { status: EquipmentStatus.NORMAL };
}

export function evaluatePressure(pressureBar: number, config: Pick<ThresholdConfig, 'pressure_warn_bar' | 'pressure_crit_bar'>, code = 'TANK'): MetricEvaluation {
  if (pressureBar >= config.pressure_crit_bar) {
    return {
      status: EquipmentStatus.CRITICAL,
      message: `${code} pressure ${pressureBar.toFixed(2)} bar exceeded critical threshold (${config.pressure_crit_bar.toFixed(2)} bar)`,
    };
  }
  if (pressureBar >= config.pressure_warn_bar) {
    return {
      status: EquipmentStatus.WARNING,
      message: `${code} pressure ${pressureBar.toFixed(2)} bar exceeded warning threshold (${config.pressure_warn_bar.toFixed(2)} bar)`,
    };
  }
  return { status: EquipmentStatus.NORMAL };
}

export function evaluateLevel(levelPct: number, config: Pick<ThresholdConfig, 'level_warn_pct' | 'level_crit_pct'>, code = 'TANK'): MetricEvaluation {
  if (levelPct <= config.level_crit_pct) {
    return {
      status: EquipmentStatus.CRITICAL,
      message: `${code} level ${levelPct.toFixed(2)}% dropped below critical threshold (${config.level_crit_pct.toFixed(2)}%)`,
    };
  }
  if (levelPct <= config.level_warn_pct) {
    return {
      status: EquipmentStatus.WARNING,
      message: `${code} level ${levelPct.toFixed(2)}% dropped below warning threshold (${config.level_warn_pct.toFixed(2)}%)`,
    };
  }
  return { status: EquipmentStatus.NORMAL };
}

export function evaluateAllThresholds(
  reading: { temperature_c: number; pressure_bar: number; level_pct: number },
  config: ThresholdConfig,
  code = 'TANK',
): FullEvaluation {
  const temp = evaluateTemperature(reading.temperature_c, config, code);
  const pressure = evaluatePressure(reading.pressure_bar, config, code);
  const level = evaluateLevel(reading.level_pct, config, code);

  let overall: EquipmentStatus = EquipmentStatus.NORMAL;
  if (
    temp.status === EquipmentStatus.CRITICAL ||
    pressure.status === EquipmentStatus.CRITICAL ||
    level.status === EquipmentStatus.CRITICAL
  ) {
    overall = EquipmentStatus.CRITICAL;
  } else if (
    temp.status === EquipmentStatus.WARNING ||
    pressure.status === EquipmentStatus.WARNING ||
    level.status === EquipmentStatus.WARNING
  ) {
    overall = EquipmentStatus.WARNING;
  }

  return { temp, pressure, level, overall };
}
