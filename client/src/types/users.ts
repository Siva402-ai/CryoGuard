import { Role, User } from './auth';

export interface CreateUserData {
  name: string;
  email: string;
  role: Role;
  password: string;
}

export interface UpdateUserData {
  name: string;
  email: string;
  role: Role;
  password?: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  meta: any;
  created_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditQueryParams {
  userId?: string;
  entity?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export type { User, Role };
