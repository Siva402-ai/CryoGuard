import { apiClient } from './client';
import {
  InventoryItem,
  InventoryTransaction,
  RestockRequest,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  CreateTransactionInput,
  CreateRestockRequestInput,
  PatchRestockRequestInput,
} from '../types/inventory';

export const inventoryApi = {
  getItems: async (): Promise<{ items: InventoryItem[] }> => {
    const response = await apiClient.get<{ items: InventoryItem[] }>('/inventory');
    return response.data;
  },

  createItem: async (data: CreateInventoryItemInput): Promise<{ message: string; item: InventoryItem }> => {
    const response = await apiClient.post<{ message: string; item: InventoryItem }>('/inventory', data);
    return response.data;
  },

  updateItem: async (
    id: string,
    data: UpdateInventoryItemInput,
  ): Promise<{ message: string; item: InventoryItem }> => {
    const response = await apiClient.put<{ message: string; item: InventoryItem }>(`/inventory/${id}`, data);
    return response.data;
  },

  recordTransaction: async (
    itemId: string,
    data: CreateTransactionInput,
  ): Promise<{ message: string; transaction: InventoryTransaction; item: InventoryItem }> => {
    const response = await apiClient.post<{
      message: string;
      transaction: InventoryTransaction;
      item: InventoryItem;
    }>(`/inventory/${itemId}/transactions`, data);
    return response.data;
  },

  getItemTransactions: async (
    itemId: string,
  ): Promise<{ item: InventoryItem; transactions: InventoryTransaction[] }> => {
    const response = await apiClient.get<{
      item: InventoryItem;
      transactions: InventoryTransaction[];
    }>(`/inventory/${itemId}/transactions`);
    return response.data;
  },

  getRestockRequests: async (params?: {
    status?: string;
    itemId?: string;
  }): Promise<{ requests: RestockRequest[] }> => {
    const response = await apiClient.get<{ requests: RestockRequest[] }>('/restock-requests', { params });
    return response.data;
  },

  createRestockRequest: async (
    data: CreateRestockRequestInput,
  ): Promise<{ message: string; request: RestockRequest }> => {
    const response = await apiClient.post<{ message: string; request: RestockRequest }>(
      '/restock-requests',
      data,
    );
    return response.data;
  },

  updateRestockRequest: async (
    id: string,
    data: PatchRestockRequestInput,
  ): Promise<{ message: string; request: RestockRequest }> => {
    const response = await apiClient.patch<{ message: string; request: RestockRequest }>(
      `/restock-requests/${id}`,
      data,
    );
    return response.data;
  },
};
