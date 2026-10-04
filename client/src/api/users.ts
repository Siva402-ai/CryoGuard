import { apiClient } from './client';
import {
  User,
  CreateUserData,
  UpdateUserData,
  AuditLogResponse,
  AuditQueryParams,
} from '../types/users';

export const getUsersApi = async (): Promise<{ users: User[]; count: number }> => {
  const response = await apiClient.get<{ users: User[]; count: number }>('/users');
  return response.data;
};

export const createUserApi = async (data: CreateUserData): Promise<{ message: string; user: User }> => {
  const response = await apiClient.post<{ message: string; user: User }>('/users', data);
  return response.data;
};

export const updateUserApi = async (
  id: string,
  data: UpdateUserData
): Promise<{ message: string; user: User }> => {
  const response = await apiClient.put<{ message: string; user: User }>(`/users/${id}`, data);
  return response.data;
};

export const deactivateUserApi = async (id: string): Promise<{ message: string; user: User }> => {
  const response = await apiClient.patch<{ message: string; user: User }>(`/users/${id}/deactivate`);
  return response.data;
};

export const reactivateUserApi = async (id: string): Promise<{ message: string; user: User }> => {
  const response = await apiClient.patch<{ message: string; user: User }>(`/users/${id}/reactivate`);
  return response.data;
};

export const getAuditLogsApi = async (params: AuditQueryParams): Promise<AuditLogResponse> => {
  const response = await apiClient.get<AuditLogResponse>('/audit-log', { params });
  return response.data;
};
