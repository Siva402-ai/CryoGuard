import { apiClient } from './client';
import { AuthResponse, LoginCredentials, User } from '../types/auth';

export const loginApi = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
  return response.data;
};

export const getMeApi = async (): Promise<{ user: User }> => {
  const response = await apiClient.get<{ user: User }>('/auth/me');
  return response.data;
};

export const logoutApi = async (): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>('/auth/logout');
  return response.data;
};

export const getUsersApi = async (): Promise<{ users: User[]; count: number }> => {
  const response = await apiClient.get<{ users: User[]; count: number }>('/users');
  return response.data;
};
