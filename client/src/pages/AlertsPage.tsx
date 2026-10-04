import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  AlertCircle,
  Filter,
  RefreshCw,
  Check,
} from 'lucide-react';
import { getAlertsApi, acknowledgeAlertApi, resolveAlertApi } from '../api/alerts';
import { getEquipmentListApi } from '../api/equipment';
import { Alert } from '../types/alert';

export const AlertsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [tankFilter, setTankFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // 1. Fetch alerts with active filters
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['alerts', statusFilter, severityFilter, tankFilter, currentPage],
    queryFn: () =>
      getAlertsApi({
        status: statusFilter,
        severity: severityFilter,
        equipmentId: tankFilter,
        page: currentPage,
        limit: pageSize,
      }),
  });

  // 2. Fetch tanks for filter dropdown
  const { data: equipmentData } = useQuery({
    queryKey: ['equipment-list'],
    queryFn: getEquipmentListApi,
  });

  const tanks = equipmentData?.equipment || [];

  // Mutations for Acknowledge and Resolve
  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => acknowledgeAlertApi(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (alertId: string) => resolveAlertApi(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeMutation.mutateAsync(id);
    } catch (err: any) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveMutation.mutateAsync(id);
    } catch (err: any) {
      console.error('Failed to resolve alert:', err);
    }
  };

  const alerts = data?.alerts || [];
  const totalAlerts = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header & Description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Facility Alerts & Telemetry</h2>
          <p className="text-sm text-muted mt-0.5">
            Real-time threshold incident stream, safety alarms, and operator resolution log
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-10 px-4 rounded-xl border border-border bg-surface text-xs font-semibold text-text hover:text-navy hover:bg-[#F3F5FA] inline-flex items-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters Bar Card */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-4 sm:p-5">
        <div className="flex items-center space-x-2 mb-3 text-xs font-semibold text-muted uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter Incidents</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Status Filter */}
          <div>
            <label htmlFor="status-filter" className="block text-xs font-semibold text-navy mb-1.5">
              Incident Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active (Open + Acknowledged)</option>
              <option value="OPEN">Open Only</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <label htmlFor="severity-filter" className="block text-xs font-semibold text-navy mb-1.5">
              Severity Level
            </label>
            <select
              id="severity-filter"
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
            </select>
          </div>

          {/* Storage Tank Filter */}
          <div>
            <label htmlFor="tank-filter" className="block text-xs font-semibold text-navy mb-1.5">
              Storage Tank
            </label>
            <select
              id="tank-filter"
              value={tankFilter}
              onChange={(e) => {
                setTankFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="ALL">All Storage Units</option>
              {tanks.map((tank) => (
                <option key={tank.id} value={tank.id}>
                  {tank.code} — {tank.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alerts Table Card */}
      <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-border/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-status-critical mx-auto mb-2" />
            <h3 className="text-base font-bold text-navy">Unable to fetch alerts</h3>
            <p className="text-xs text-muted mt-1 mb-4">
              An error occurred while loading alert records.
            </p>
            <button
              onClick={() => refetch()}
              className="h-10 px-5 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors"
            >
              Retry
            </button>
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-status-success-bg text-status-success flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-navy">No Alerts Found</h3>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              There are no active or historical alerts matching your selected filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-[#F8FAFD] border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wider">
                  <th className="py-3.5 px-6">Severity</th>
                  <th className="py-3.5 px-4">Unit</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Message</th>
                  <th className="py-3.5 px-4 text-right">Value</th>
                  <th className="py-3.5 px-4">Triggered At</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Handled By</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {alerts.map((alert: Alert) => {
                  const isCrit = alert.severity === 'CRITICAL';
                  const isAck = alert.status === 'ACKNOWLEDGED';
                  const isRes = alert.status === 'RESOLVED';
                  const isOpen = alert.status === 'OPEN';

                  return (
                    <tr
                      key={alert.id}
                      className={`hover:bg-[#F8FAFD] transition-colors ${
                        isCrit && !isRes
                          ? 'bg-status-critical-bg/25'
                          : alert.severity === 'WARNING' && !isRes
                          ? 'bg-status-warning-bg/25'
                          : ''
                      }`}
                    >
                      {/* Severity Badge */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            isCrit
                              ? 'bg-status-critical-bg text-status-critical'
                              : 'bg-status-warning-bg text-status-warning'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              isCrit ? 'bg-status-critical' : 'bg-status-warning'
                            }`}
                          />
                          {alert.severity}
                        </span>
                      </td>

                      {/* Equipment / Target Link */}
                      <td className="py-4 px-4 font-bold text-navy whitespace-nowrap">
                        {alert.type === 'INVENTORY' ? (
                          <Link
                            to="/inventory"
                            className="text-primary hover:underline inline-flex items-center space-x-1"
                          >
                            <span>INVENTORY</span>
                          </Link>
                        ) : alert.equipment_id ? (
                          <Link
                            to={`/equipment/${alert.equipment_id}`}
                            className="text-primary hover:underline inline-flex items-center space-x-1"
                          >
                            <span>{alert.equipment?.code || 'UNIT'}</span>
                          </Link>
                        ) : (
                          <span className="text-muted text-sm font-normal">FACILITY</span>
                        )}
                      </td>

                      {/* Type */}
                      <td className="py-4 px-4">
                        {alert.type === 'MAINTENANCE' ? (
                          <Link
                            to="/maintenance"
                            className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-status-info-bg text-status-info hover:underline inline-flex items-center"
                          >
                            MAINTENANCE
                          </Link>
                        ) : alert.type === 'INSPECTION' ? (
                          <Link
                            to={alert.source_id ? `/inspections/${alert.source_id}` : '/inspections'}
                            className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-status-critical-bg text-status-critical hover:underline inline-flex items-center"
                          >
                            INSPECTION
                          </Link>
                        ) : alert.type === 'INVENTORY' ? (
                          <Link
                            to="/inventory"
                            className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-status-warning-bg text-status-warning hover:underline inline-flex items-center"
                          >
                            INVENTORY
                          </Link>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-primary-soft text-primary">
                            {alert.type}
                          </span>
                        )}
                      </td>

                      {/* Message */}
                      <td className="py-4 px-4 text-text font-medium max-w-xs">
                        <div>{alert.message}</div>
                        {alert.type === 'MAINTENANCE' && (
                          <Link
                            to="/maintenance"
                            className="text-xs text-primary font-semibold hover:underline inline-flex items-center space-x-1 mt-0.5"
                          >
                            <span>View Task in Schedule &rarr;</span>
                          </Link>
                        )}
                        {alert.type === 'INSPECTION' && (
                          <Link
                            to={alert.source_id ? `/inspections/${alert.source_id}` : '/inspections'}
                            className="text-xs text-primary font-semibold hover:underline inline-flex items-center space-x-1 mt-0.5"
                          >
                            <span>View Inspection Audit &rarr;</span>
                          </Link>
                        )}
                      </td>

                      {/* Value */}
                      <td className="py-4 px-4 text-right font-bold text-navy whitespace-nowrap">
                        {alert.value !== null
                          ? alert.type === 'TEMPERATURE'
                            ? `${alert.value.toFixed(1)}°C`
                            : alert.type === 'PRESSURE'
                            ? `${alert.value.toFixed(2)} bar`
                            : alert.type === 'LEVEL'
                            ? `${alert.value.toFixed(1)}%`
                            : alert.value
                          : '—'}
                      </td>

                      {/* Timestamp */}
                      <td className="py-4 px-4 text-xs text-muted whitespace-nowrap">
                        <div>{new Date(alert.created_at).toLocaleDateString()}</div>
                        <div className="font-mono text-[11px]">
                          {new Date(alert.created_at).toLocaleTimeString()}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isRes
                              ? 'bg-status-success-bg text-status-success'
                              : isAck
                              ? 'bg-status-info-bg text-status-info'
                              : 'bg-status-critical-bg text-status-critical'
                          }`}
                        >
                          {alert.status}
                        </span>
                      </td>

                      {/* Handled By */}
                      <td className="py-4 px-4 text-xs text-muted">
                        {isRes ? (
                          <div>
                            <span className="font-semibold text-status-success block">
                              Res: {alert.resolved_by}
                            </span>
                            {alert.resolved_at && (
                              <span className="text-[10px] text-muted">
                                {new Date(alert.resolved_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        ) : isAck ? (
                          <div>
                            <span className="font-semibold text-primary block">
                              Ack: {alert.acknowledged_by}
                            </span>
                            {alert.acknowledged_at && (
                              <span className="text-[10px] text-muted">
                                {new Date(alert.acknowledged_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted italic">Unacknowledged</span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-2">
                          {isOpen && (
                            <button
                              onClick={() => handleAcknowledge(alert.id)}
                              disabled={acknowledgeMutation.isPending}
                              className="h-8 px-3 rounded-lg bg-primary-soft hover:bg-primary/20 text-primary text-xs font-semibold transition-colors disabled:opacity-50 inline-flex items-center space-x-1"
                              title="Acknowledge Alert"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Ack</span>
                            </button>
                          )}

                          {!isRes && (
                            <button
                              onClick={() => handleResolve(alert.id)}
                              disabled={resolveMutation.isPending}
                              className="h-8 px-3 rounded-lg bg-status-success-bg hover:bg-status-success/25 text-status-success text-xs font-semibold transition-colors disabled:opacity-50 inline-flex items-center space-x-1"
                              title="Resolve Alert"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Resolve</span>
                            </button>
                          )}

                          {isRes && (
                            <span className="text-xs font-semibold text-status-success inline-flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Closed</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalAlerts > 0 && (
          <div className="py-4 px-6 bg-[#F8FAFD] border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
            <div>
              Showing <span className="font-semibold text-navy">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-navy">
                {Math.min(currentPage * pageSize, totalAlerts)}
              </span>{' '}
              of <span className="font-semibold text-navy">{totalAlerts}</span> alert incidents
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-8 px-3 rounded-lg border border-border bg-surface text-navy font-semibold hover:bg-[#EEF1F6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-2 font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 px-3 rounded-lg border border-border bg-surface text-navy font-semibold hover:bg-[#EEF1F6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
