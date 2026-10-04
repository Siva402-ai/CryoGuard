export type MaterialType = 'LN2' | 'LOX' | 'ARGON';
export type EquipmentStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'OFFLINE';

export interface LatestReading {
  equipmentId?: string;
  temperature_c: number;
  pressure_bar: number;
  level_pct: number;
  recorded_at: string;
  status?: EquipmentStatus;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
  material: MaterialType;
  capacity_l: number;
  location: string;
  temp_warn_c: number;
  temp_crit_c: number;
  pressure_warn_bar: number;
  pressure_crit_bar: number;
  level_warn_pct: number;
  level_crit_pct: number;
  status: EquipmentStatus;
  created_at: string;
  latestReading?: LatestReading | null;
}

export interface SensorReading {
  id: string;
  equipment_id: string;
  temperature_c: number;
  pressure_bar: number;
  level_pct: number;
  recorded_at: string;
}

export interface CreateEquipmentDto {
  code: string;
  name: string;
  material: MaterialType;
  capacity_l: number;
  location: string;
  temp_warn_c: number;
  temp_crit_c: number;
  pressure_warn_bar: number;
  pressure_crit_bar: number;
  level_warn_pct: number;
  level_crit_pct: number;
  status?: EquipmentStatus;
}
