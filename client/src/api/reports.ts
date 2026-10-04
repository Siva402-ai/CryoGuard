import { apiClient } from './client';
import {
  ReportQueryParams,
  TemperatureTrendResponse,
  AlertsByMonthResponse,
  MaintenanceHistoryResponse,
  InventoryConsumptionResponse,
} from '../types/reports';

export async function getTemperatureTrendReportApi(
  params: ReportQueryParams
): Promise<TemperatureTrendResponse> {
  const res = await apiClient.get<TemperatureTrendResponse>('/reports/temperature-trend', {
    params,
  });
  return res.data;
}

export async function getAlertsByMonthReportApi(
  params: ReportQueryParams
): Promise<AlertsByMonthResponse> {
  const res = await apiClient.get<AlertsByMonthResponse>('/reports/alerts-by-month', {
    params,
  });
  return res.data;
}

export async function getMaintenanceHistoryReportApi(
  params: ReportQueryParams
): Promise<MaintenanceHistoryResponse> {
  const res = await apiClient.get<MaintenanceHistoryResponse>('/reports/maintenance-history', {
    params,
  });
  return res.data;
}

export async function getInventoryConsumptionReportApi(
  params: ReportQueryParams
): Promise<InventoryConsumptionResponse> {
  const res = await apiClient.get<InventoryConsumptionResponse>('/reports/inventory-consumption', {
    params,
  });
  return res.data;
}

/**
 * Downloads report as CSV using authenticated axios client (blob)
 * and extracts the filename from the Content-Disposition header.
 */
export async function downloadReportCsvApi(
  endpoint: 'temperature-trend' | 'alerts-by-month' | 'maintenance-history' | 'inventory-consumption',
  params: ReportQueryParams,
  fallbackFilename: string
): Promise<void> {
  const res = await apiClient.get(`/reports/${endpoint}`, {
    params: {
      ...params,
      format: 'csv',
    },
    responseType: 'blob',
  });

  // Extract filename from Content-Disposition header if available
  let filename = fallbackFilename;
  const disposition = res.headers['content-disposition'];
  if (disposition && disposition.indexOf('filename=') !== -1) {
    const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].replace(/['"]/g, '');
    }
  }

  // Create blob and trigger browser download
  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
