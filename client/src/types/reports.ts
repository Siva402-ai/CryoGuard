export interface ReportMeta {
  from: string;
  to: string;
}

export interface TemperatureTrendMeta extends ReportMeta {
  bucketSize: string;
  retentionDays: number;
  dataFrom: string | null;
}

export interface TemperatureTrendPoint {
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  bucket: string;
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
  count: number;
}

export interface TemperatureTrendResponse {
  meta: TemperatureTrendMeta;
  data: TemperatureTrendPoint[];
}

export interface AlertByMonthPoint {
  month: string;
  severity: 'WARNING' | 'CRITICAL';
  type: string;
  count: number;
}

export interface AlertsByMonthResponse {
  meta: ReportMeta;
  data: AlertByMonthPoint[];
}

export interface MaintenanceTaskReportItem {
  id: string;
  title: string;
  description: string;
  status: string;
  dueDate: string;
  completedAt: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  notes: string | null;
  equipmentCode: string;
  equipmentName: string;
}

export interface MaintenanceHistoryResponse {
  meta: ReportMeta;
  summary: {
    total: number;
    completed: number;
    overdue: number;
    onTimeRate: number;
  };
  byMonth: {
    month: string;
    completed: number;
    overdue: number;
  }[];
  tasks: MaintenanceTaskReportItem[];
}

export interface InventoryConsumptionItem {
  id: string;
  name: string;
  material: string;
  unit: string;
  currentQuantity: number;
  totalIn: number;
  totalOut: number;
  netChange: number;
  weeklyOut: {
    week: string;
    totalOut: number;
  }[];
}

export interface InventoryConsumptionResponse {
  meta: ReportMeta;
  items: InventoryConsumptionItem[];
}

export interface ReportQueryParams {
  from?: string;
  to?: string;
  equipmentId?: string;
}
