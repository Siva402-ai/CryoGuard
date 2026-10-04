import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Container,
  Bell,
  Wrench,
  Package,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useAlertStream } from '../hooks/useAlertStream';
import { getEquipmentReadingsApi } from '../api/equipment';
import { Equipment } from '../types/equipment';
import { Alert } from '../types/alert';

export const DashboardPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useAlertStream();
  const [selectedTankId, setSelectedTankId] = useState<string>('');

  const tanks = data?.tanks || [];
  const summary = data?.summary;
  const recentAlerts = data?.recentAlerts || [];

  // Default selected tank to first available tank
  const activeSelectedTank = useMemo(() => {
    if (!tanks.length) return null;
    if (selectedTankId) {
      return tanks.find((t) => t.id === selectedTankId) || tanks[0];
    }
    return tanks[0];
  }, [tanks, selectedTankId]);

  // Query readings history for selected tank chart
  const { data: readingsData, isLoading: loadingReadings } = useQuery({
    queryKey: ['equipment-readings', activeSelectedTank?.id],
    queryFn: async () => {
      if (!activeSelectedTank) return { readings: [] };
      return getEquipmentReadingsApi(activeSelectedTank.id, { limit: 25 });
    },
    enabled: !!activeSelectedTank?.id,
    refetchInterval: 10000,
  });

  const chartData = useMemo(() => {
    if (!readingsData?.readings) return [];
    return [...readingsData.readings]
      .reverse()
      .map((r) => ({
        time: new Date(r.recorded_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        temp: r.temperature_c,
      }));
  }, [readingsData]);

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        {/* KPI Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-2xl p-6 animate-pulse h-32 flex flex-col justify-between"
            >
              <div className="h-4 bg-border/60 rounded w-24" />
              <div className="h-8 bg-border/60 rounded w-16" />
              <div className="h-3 bg-border/40 rounded w-32" />
            </div>
          ))}
        </div>

        {/* Table + Feed Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-surface border border-border rounded-2xl p-6 h-80 animate-pulse" />
          <div className="lg:col-span-4 bg-surface border border-border rounded-2xl p-6 h-80 animate-pulse" />
        </div>

        {/* Chart Skeleton */}
        <div className="bg-surface border border-border rounded-2xl p-6 h-72 animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 text-center max-w-lg mx-auto my-12 shadow-card">
        <AlertCircle className="w-12 h-12 text-status-critical mx-auto mb-3" />
        <h3 className="text-lg font-bold text-navy">Failed to load dashboard telemetry</h3>
        <p className="text-sm text-muted mt-1 mb-6">
          Could not establish connection to the facility control server.
        </p>
        <button
          onClick={() => refetch()}
          className="h-11 px-6 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary-hover inline-flex items-center space-x-2 shadow-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1: Storage Units */}
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
                Storage Units
              </span>
              <span className="text-3xl font-bold text-navy block">
                {summary?.totalUnits ?? tanks.length}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center flex-shrink-0">
              <Container className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-2 text-xs text-muted font-medium">
            <span className="inline-flex items-center text-status-success font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {summary?.tankCountByStatus?.NORMAL ?? 0} Normal
            </span>
            <span>•</span>
            <span>
              {(summary?.tankCountByStatus?.WARNING ?? 0) +
                (summary?.tankCountByStatus?.CRITICAL ?? 0)}{' '}
              Attention
            </span>
          </div>
        </div>

        {/* KPI 2: Active Alerts */}
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
                Active Alerts
              </span>
              <span className="text-3xl font-bold text-navy block">
                {summary?.activeAlerts ?? 0}
              </span>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                (summary?.activeAlerts ?? 0) > 0
                  ? 'bg-status-critical-bg text-status-critical'
                  : 'bg-status-success-bg text-status-success'
              }`}
            >
              <Bell className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-2 text-xs font-medium">
            {(summary?.criticalAlerts ?? 0) > 0 ? (
              <span className="text-status-critical font-bold inline-flex items-center">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                {summary?.criticalAlerts} Critical active
              </span>
            ) : (summary?.activeAlerts ?? 0) > 0 ? (
              <span className="text-status-warning font-semibold inline-flex items-center">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                {summary?.activeAlerts} Warning active
              </span>
            ) : (
              <span className="text-status-success font-semibold inline-flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                All thresholds nominal
              </span>
            )}
          </div>
        </div>

        {/* KPI 3: Maintenance Due */}
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
                Maintenance Due
              </span>
              <span className="text-3xl font-bold text-navy block">
                {summary?.maintenanceDue ?? 0}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-status-info-bg text-status-info flex items-center justify-center flex-shrink-0">
              <Wrench className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>
          <div className="mt-3 text-xs text-muted font-medium">
            <span>Preventive schedules active</span>
          </div>
        </div>

        {/* KPI 4: Low Stock Items */}
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
                Low Stock
              </span>
              <span className="text-3xl font-bold text-navy block">
                {summary?.lowStockCount ?? 0}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-status-offline-bg text-status-offline flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>
          <div className="mt-3 text-xs text-muted font-medium">
            <span>Bulk materials nominal</span>
          </div>
        </div>
      </div>

      {/* Middle Section: Tank Status Table (8 cols) + Recent Alerts Feed (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 8-col Tank Status Table */}
        <div className="lg:col-span-8 bg-surface border border-border rounded-2xl shadow-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-navy">Storage Vessels Telemetry</h2>
              <p className="text-xs text-muted">Real-time status across cryogenic storage infrastructure</p>
            </div>
            <Link
              to="/equipment"
              className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center space-x-1"
            >
              <span>Manage Units</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left text-sm border-collapse min-w-[620px]">
              <thead>
                <tr className="bg-[#F8FAFD] border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wider">
                  <th className="py-3 px-6">Unit</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Material</th>
                  <th className="py-3 px-4 text-right">Temp (°C)</th>
                  <th className="py-3 px-4 text-right">Pressure</th>
                  <th className="py-3 px-4 text-right">Level</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tanks.map((tank: Equipment) => {
                  const reading = tank.latestReading;
                  const status = tank.status;

                  return (
                    <tr
                      key={tank.id}
                      className="hover:bg-[#F8FAFD] transition-colors group"
                    >
                      <td className="py-3.5 px-6 font-bold text-navy whitespace-nowrap">
                        <Link
                          to={`/equipment/${tank.id}`}
                          className="hover:text-primary transition-colors inline-flex items-center space-x-1.5"
                        >
                          <span>{tank.code}</span>
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-text font-medium truncate max-w-[140px]">
                        {tank.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-soft text-primary">
                          {tank.material}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-navy">
                        {reading ? `${reading.temperature_c.toFixed(1)}°C` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-navy">
                        {reading ? `${reading.pressure_bar.toFixed(2)} bar` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-navy">
                        {reading ? `${reading.level_pct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            status === 'CRITICAL'
                              ? 'bg-status-critical-bg text-status-critical'
                              : status === 'WARNING'
                              ? 'bg-status-warning-bg text-status-warning'
                              : status === 'OFFLINE'
                              ? 'bg-status-offline-bg text-status-offline'
                              : 'bg-status-success-bg text-status-success'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              status === 'CRITICAL'
                                ? 'bg-status-critical'
                                : status === 'WARNING'
                                ? 'bg-status-warning'
                                : status === 'OFFLINE'
                                ? 'bg-status-offline'
                                : 'bg-status-success'
                            }`}
                          />
                          {status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <Link
                          to={`/equipment/${tank.id}`}
                          className="text-xs font-semibold text-primary hover:text-primary-hover p-1.5 rounded-lg hover:bg-primary-soft transition-colors inline-block"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4-col Recent Alerts Feed */}
        <div className="lg:col-span-4 bg-surface border border-border rounded-2xl shadow-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-navy">Recent Alerts</h2>
                <p className="text-xs text-muted">Real-time incident stream</p>
              </div>
              <Link
                to="/alerts"
                className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center space-x-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {recentAlerts.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-10 h-10 rounded-full bg-status-success-bg text-status-success flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-navy">No recent alerts</p>
                  <p className="text-xs text-muted mt-0.5">All tanks operating within thresholds</p>
                </div>
              ) : (
                recentAlerts.map((alert: Alert) => {
                  const isCrit = alert.severity === 'CRITICAL';
                  const isAck = alert.status === 'ACKNOWLEDGED';
                  const isRes = alert.status === 'RESOLVED';

                  return (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-xl border transition-colors ${
                        isCrit && !isRes
                          ? 'bg-status-critical-bg/50 border-status-critical/30'
                          : alert.severity === 'WARNING' && !isRes
                          ? 'bg-status-warning-bg/50 border-status-warning/30'
                          : 'bg-[#F8FAFD] border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              isCrit
                                ? 'bg-status-critical'
                                : alert.severity === 'WARNING'
                                ? 'bg-status-warning'
                                : 'bg-muted'
                            }`}
                          />
                          <span className="text-xs font-bold text-navy">
                            {alert.equipment?.code || 'TANK'}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              isCrit
                                ? 'bg-status-critical text-white'
                                : alert.severity === 'WARNING'
                                ? 'bg-status-warning text-white'
                                : 'bg-muted text-white'
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted whitespace-nowrap">
                          {new Date(alert.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <p className="text-xs text-text mt-1.5 line-clamp-2 leading-relaxed">
                        {alert.message}
                      </p>

                      {alert.type === 'MAINTENANCE' && (
                        <div className="mt-1">
                          <Link
                            to="/maintenance"
                            className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center space-x-1"
                          >
                            <span>Open Maintenance Schedule &rarr;</span>
                          </Link>
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                        {alert.type === 'MAINTENANCE' ? (
                          <Link
                            to="/maintenance"
                            className="font-semibold uppercase tracking-wider text-[10px] text-status-info hover:underline"
                          >
                            MAINTENANCE
                          </Link>
                        ) : (
                          <span className="font-semibold uppercase tracking-wider text-[10px]">
                            {alert.type}
                          </span>
                        )}
                        <span
                          className={`font-semibold ${
                            isRes
                              ? 'text-status-success'
                              : isAck
                              ? 'text-primary'
                              : 'text-status-critical'
                          }`}
                        >
                          {alert.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border">
            <Link
              to="/alerts"
              className="w-full h-10 rounded-xl bg-primary-soft hover:bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
            >
              <span>Open Alert Center</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Section: Temperature Trend Chart (Full width 12 cols) */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-navy">Temperature Trend Telemetry</h2>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Live telemetry series against safety warning & critical limits
            </p>
          </div>

          {/* Tank Dropdown Selector */}
          <div className="flex items-center space-x-3">
            <label htmlFor="tank-select" className="text-xs font-semibold text-muted whitespace-nowrap">
              Select Tank:
            </label>
            <select
              id="tank-select"
              value={activeSelectedTank?.id || ''}
              onChange={(e) => setSelectedTankId(e.target.value)}
              className="h-10 px-3.5 py-1.5 rounded-xl border border-border bg-surface text-sm font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {tanks.map((tank: Equipment) => (
                <option key={tank.id} value={tank.id}>
                  {tank.code} — {tank.name} ({tank.material})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Tank Summary Strip */}
        {activeSelectedTank && (
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[#F8FAFD] border border-border/80 text-xs">
            <div>
              <span className="text-muted block text-[10px] uppercase font-semibold">Current Temp</span>
              <span className="font-bold text-navy text-sm">
                {activeSelectedTank.latestReading
                  ? `${activeSelectedTank.latestReading.temperature_c.toFixed(1)}°C`
                  : '—'}
              </span>
            </div>
            <div>
              <span className="text-muted block text-[10px] uppercase font-semibold">Warning Limit</span>
              <span className="font-bold text-status-warning text-sm">
                ≥ {activeSelectedTank.temp_warn_c.toFixed(1)}°C
              </span>
            </div>
            <div>
              <span className="text-muted block text-[10px] uppercase font-semibold">Critical Limit</span>
              <span className="font-bold text-status-critical text-sm">
                ≥ {activeSelectedTank.temp_crit_c.toFixed(1)}°C
              </span>
            </div>
            <div>
              <span className="text-muted block text-[10px] uppercase font-semibold">Unit Status</span>
              <span
                className={`font-bold text-sm ${
                  activeSelectedTank.status === 'CRITICAL'
                    ? 'text-status-critical'
                    : activeSelectedTank.status === 'WARNING'
                    ? 'text-status-warning'
                    : 'text-status-success'
                }`}
              >
                {activeSelectedTank.status}
              </span>
            </div>
          </div>
        )}

        {/* Recharts Temperature Line Chart */}
        <div className="h-64 w-full">
          {loadingReadings && chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted">
              Loading temperature data...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted">
              No historical sensor readings recorded for {activeSelectedTank?.code} yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: '#5B6578' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E9F2' }}
                />
                <YAxis
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tick={{ fontSize: 11, fill: '#5B6578' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E9F2' }}
                  tickFormatter={(val) => `${val}°C`}
                  width={65}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-surface border border-border rounded-xl shadow-lg p-2.5 text-xs">
                          <p className="text-muted font-medium mb-1">{label}</p>
                          <p className="text-navy font-bold">
                            Temp: <span className="text-primary">{payload[0].value}°C</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {activeSelectedTank && (
                  <>
                    <ReferenceLine
                      y={activeSelectedTank.temp_warn_c}
                      stroke="#C77700"
                      strokeDasharray="4 4"
                      label={{
                        value: `Warn (${activeSelectedTank.temp_warn_c}°C)`,
                        fill: '#C77700',
                        fontSize: 10,
                        position: 'insideTopRight',
                      }}
                    />
                    <ReferenceLine
                      y={activeSelectedTank.temp_crit_c}
                      stroke="#D92D20"
                      strokeDasharray="4 4"
                      label={{
                        value: `Crit (${activeSelectedTank.temp_crit_c}°C)`,
                        fill: '#D92D20',
                        fontSize: 10,
                        position: 'insideTopRight',
                      }}
                    />
                  </>
                )}
                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke="#1A2BC3"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#1A2BC3' }}
                  activeDot={{ r: 5, fill: '#1422A3' }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
