import { Alert } from './alert';
import { Equipment } from './equipment';

export interface DashboardSummaryCounts {
  totalUnits: number;
  tankCountByStatus: {
    NORMAL: number;
    WARNING: number;
    CRITICAL: number;
    OFFLINE: number;
  };
  activeAlerts: number;
  criticalAlerts: number;
  maintenanceDue: number;
  lowStockCount: number;
}

export interface DashboardSummaryResponse {
  summary: DashboardSummaryCounts;
  tanks: Equipment[];
  recentAlerts: Alert[];
}
