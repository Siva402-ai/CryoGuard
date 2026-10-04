export type MaintenanceStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'OVERDUE';

export interface MaintenanceEquipment {
  id: string;
  code: string;
  name: string;
  material: string;
  location: string;
}

export interface MaintenanceTask {
  id: string;
  equipment_id: string;
  title: string;
  description: string;
  due_date: string;
  assigned_to: string | null;
  status: MaintenanceStatus;
  recurrence_days: number | null;
  completed_at: string | null;
  notes: string | null;
  equipment?: MaintenanceEquipment;
  assignee?: {
    id: string;
    name: string;
    email?: string;
  } | null;
}

export interface CreateMaintenanceDto {
  equipment_id: string;
  title: string;
  description: string;
  due_date: string;
  assigned_to?: string | null;
  recurrence_days?: number | null;
}

export interface UpdateMaintenanceDto {
  title?: string;
  description?: string;
  due_date?: string;
  assigned_to?: string | null;
  recurrence_days?: number | null;
  status?: MaintenanceStatus;
}

export interface CompleteMaintenanceDto {
  notes?: string | null;
}

export interface UserOption {
  id: string;
  name: string;
}
