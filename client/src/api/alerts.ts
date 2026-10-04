import { apiClient } from './client';
import { Alert, AlertsResponse, AlertFilters } from '../types/alert';

export const getAlertsApi = async (filters?: AlertFilters): Promise<AlertsResponse> => {
  const response = await apiClient.get<AlertsResponse>('/alerts', { params: filters });
  return response.data;
};

export const acknowledgeAlertApi = async (id: string): Promise<{ message: string; alert: Alert }> => {
  const response = await apiClient.patch<{ message: string; alert: Alert }>(`/alerts/${id}/acknowledge`);
  return response.data;
};

export const resolveAlertApi = async (id: string): Promise<{ message: string; alert: Alert }> => {
  const response = await apiClient.patch<{ message: string; alert: Alert }>(`/alerts/${id}/resolve`);
  return response.data;
};
