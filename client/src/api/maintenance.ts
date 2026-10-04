import { apiClient } from './client';
import {
  MaintenanceTask,
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
  CompleteMaintenanceDto,
  UserOption,
} from '../types/maintenance';

export const getMaintenanceTasksApi = async (params?: {
  status?: string;
  equipmentId?: string;
}): Promise<{ tasks: MaintenanceTask[]; count: number }> => {
  const response = await apiClient.get<{ tasks: MaintenanceTask[]; count: number }>('/maintenance', {
    params,
  });
  return response.data;
};

export const createMaintenanceTaskApi = async (
  data: CreateMaintenanceDto,
): Promise<{ message: string; task: MaintenanceTask }> => {
  const response = await apiClient.post<{ message: string; task: MaintenanceTask }>(
    '/maintenance',
    data,
  );
  return response.data;
};

export const updateMaintenanceTaskApi = async (
  id: string,
  data: UpdateMaintenanceDto,
): Promise<{ message: string; task: MaintenanceTask }> => {
  const response = await apiClient.put<{ message: string; task: MaintenanceTask }>(
    `/maintenance/${id}`,
    data,
  );
  return response.data;
};

export const completeMaintenanceTaskApi = async (
  id: string,
  data: CompleteMaintenanceDto,
): Promise<{
  message: string;
  task: MaintenanceTask;
  nextTask: MaintenanceTask | null;
}> => {
  const response = await apiClient.patch<{
    message: string;
    task: MaintenanceTask;
    nextTask: MaintenanceTask | null;
  }>(`/maintenance/${id}/complete`, data);
  return response.data;
};

export const getUserOptionsApi = async (): Promise<{
  users: UserOption[];
  count: number;
}> => {
  const response = await apiClient.get<{ users: UserOption[]; count: number }>('/users/options');
  return response.data;
};
