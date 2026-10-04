import { apiClient } from './client';
import {
  InspectionTemplate,
  Inspection,
  CreateInspectionTemplateDto,
  CreateInspectionDto,
} from '../types/inspection';

export interface GetInspectionsParams {
  equipmentId?: string;
  overall?: string;
  page?: number;
  limit?: number;
}

export interface InspectionsResponse {
  inspections: Inspection[];
  total: number;
  page: number;
  totalPages: number;
}

export interface InspectionTemplatesResponse {
  templates: InspectionTemplate[];
}

export interface InspectionDetailResponse {
  inspection: Inspection;
}

export interface CreateInspectionResponse {
  message: string;
  inspection: Inspection;
  alert?: any;
}

export interface CreateTemplateResponse {
  message: string;
  template: InspectionTemplate;
}

// 1. Get All Templates
export const getInspectionTemplatesApi = async (): Promise<InspectionTemplatesResponse> => {
  const response = await apiClient.get<InspectionTemplatesResponse>('/inspection-templates');
  return response.data;
};

// 2. Create Template
export const createInspectionTemplateApi = async (
  dto: CreateInspectionTemplateDto,
): Promise<CreateTemplateResponse> => {
  const response = await apiClient.post<CreateTemplateResponse>('/inspection-templates', dto);
  return response.data;
};

// 3. Get Inspections List
export const getInspectionsApi = async (
  params?: GetInspectionsParams,
): Promise<InspectionsResponse> => {
  const query = new URLSearchParams();
  if (params?.equipmentId && params.equipmentId !== 'ALL') {
    query.append('equipmentId', params.equipmentId);
  }
  if (params?.overall && params.overall !== 'ALL') {
    query.append('overall', params.overall);
  }
  if (params?.page) {
    query.append('page', params.page.toString());
  }
  if (params?.limit) {
    query.append('limit', params.limit.toString());
  }

  const endpoint = `/inspections${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await apiClient.get<InspectionsResponse>(endpoint);
  return response.data;
};

// 4. Get Inspection Details By ID
export const getInspectionByIdApi = async (id: string): Promise<InspectionDetailResponse> => {
  const response = await apiClient.get<InspectionDetailResponse>(`/inspections/${id}`);
  return response.data;
};

// 5. Submit Inspection Record
export const createInspectionApi = async (
  dto: CreateInspectionDto,
): Promise<CreateInspectionResponse> => {
  const response = await apiClient.post<CreateInspectionResponse>('/inspections', dto);
  return response.data;
};
