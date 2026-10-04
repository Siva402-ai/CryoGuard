import { apiClient } from './client';
import { Equipment, CreateEquipmentDto, SensorReading } from '../types/equipment';

export const getEquipmentListApi = async (): Promise<{ equipment: Equipment[]; count: number }> => {
  const response = await apiClient.get<{ equipment: Equipment[]; count: number }>('/equipment');
  return response.data;
};

export const getEquipmentByIdApi = async (id: string): Promise<{ equipment: Equipment }> => {
  const response = await apiClient.get<{ equipment: Equipment }>(`/equipment/${id}`);
  return response.data;
};

export const createEquipmentApi = async (
  data: CreateEquipmentDto,
): Promise<{ message: string; equipment: Equipment }> => {
  const response = await apiClient.post<{ message: string; equipment: Equipment }>('/equipment', data);
  return response.data;
};

export const updateEquipmentApi = async (
  id: string,
  data: Partial<CreateEquipmentDto>,
): Promise<{ message: string; equipment: Equipment }> => {
  const response = await apiClient.put<{ message: string; equipment: Equipment }>(`/equipment/${id}`, data);
  return response.data;
};

export const deleteEquipmentApi = async (id: string): Promise<{ message: string }> => {
  const response = await apiClient.delete<{ message: string }>(`/equipment/${id}`);
  return response.data;
};

export const getEquipmentReadingsApi = async (
  id: string,
  params?: { from?: string; to?: string; limit?: number },
): Promise<{
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  readings: SensorReading[];
  count: number;
}> => {
  const response = await apiClient.get<{
    equipmentId: string;
    equipmentCode: string;
    equipmentName: string;
    readings: SensorReading[];
    count: number;
  }>(`/equipment/${id}/readings`, { params });
  return response.data;
};
