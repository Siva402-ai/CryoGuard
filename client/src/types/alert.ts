export type AlertSeverity = 'WARNING' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type AlertType =
  | 'TEMPERATURE'
  | 'PRESSURE'
  | 'LEVEL'
  | 'MAINTENANCE'
  | 'INSPECTION'
  | 'INVENTORY';

export interface AlertEquipment {
  id: string;
  code: string;
  name: string;
  material: string;
  location: string;
}

export interface AlertUser {
  id: string;
  name: string;
  email?: string;
}

export interface Alert {
  id: string;
  equipment_id: string | null;
  source_id?: string | null;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  value: number | null;
  status: AlertStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  equipment?: AlertEquipment | null;
  acknowledgedBy?: AlertUser | null;
  resolvedBy?: AlertUser | null;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AlertFilters {
  status?: string;
  severity?: string;
  equipmentId?: string;
  page?: number;
  limit?: number;
}
