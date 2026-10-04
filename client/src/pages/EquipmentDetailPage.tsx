import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getEquipmentByIdApi,
  getEquipmentReadingsApi,
} from '../api/equipment';
import { Equipment, SensorReading, EquipmentStatus } from '../types/equipment';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Flame,
  PowerOff,
  Thermometer,
  Gauge,
  Droplets,
  Clock,
  ShieldAlert,
  Wrench,
  Calendar,
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';
import { getMaintenanceTasksApi } from '../api/maintenance';
import { getInspectionsApi } from '../api/inspections';
import { MaintenanceTask } from '../types/maintenance';
import { Inspection, InspectionItemResult } from '../types/inspection';
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

type TimeRange = '1h' | '6h' | '24h';

export const EquipmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loadingEquipment, setLoadingEquipment] = useState(true);
  const [loadingReadings, setLoadingReadings] = useState(true);
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);
  const [loadingInspections, setLoadingInspections] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');

  const fetchData = async () => {
    if (!id) return;
    setError(null);
    setLoadingEquipment(true);
    setLoadingReadings(true);
    setLoadingMaintenance(true);
    setLoadingInspections(true);

    try {
      // 1. Fetch Equipment Details
      const eqData = await getEquipmentByIdApi(id);
      setEquipment(eqData.equipment);
      setLoadingEquipment(false);

      // 2. Fetch Maintenance Tasks for this unit
      try {
        const maintData = await getMaintenanceTasksApi({ equipmentId: id });
        setMaintenanceTasks(maintData.tasks || []);
      } catch (maintErr) {
        console.error('Failed to load maintenance history for unit:', maintErr);
      } finally {
        setLoadingMaintenance(false);
      }

      // 3. Fetch Safety Inspections for this unit (latest 5)
      try {
        const inspData = await getInspectionsApi({ equipmentId: id, limit: 5 });
        setInspections(inspData.inspections || []);
      } catch (inspErr) {
        console.error('Failed to load inspections for unit:', inspErr);
      } finally {
        setLoadingInspections(false);
      }

      // 4. Fetch Readings based on Time Range
      const now = new Date();
      let fromDate: Date;
      if (timeRange === '1h') {
        fromDate = new Date(now.getTime() - 60 * 60 * 1000);
      } else if (timeRange === '6h') {
        fromDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      } else {
        fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const readingsData = await getEquipmentReadingsApi(id, {
        from: fromDate.toISOString(),
        limit: 500,
      });

      // Sort readings chronologically for Recharts
      const sorted = [...readingsData.readings].reverse();
      setReadings(sorted);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to load equipment telemetry details.',
      );
    } finally {
      setLoadingEquipment(false);
      setLoadingReadings(false);
      setLoadingMaintenance(false);
      setLoadingInspections(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, timeRange]);

  const renderStatusBadge = (status?: EquipmentStatus) => {
    switch (status) {
      case 'NORMAL':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-status-success-bg text-status-success">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
            NORMAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-status-warning-bg text-status-warning">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
            WARNING
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-status-critical-bg text-status-critical">
            <Flame className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
            CRITICAL
          </span>
        );
      case 'OFFLINE':
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-status-neutral-bg text-status-neutral">
            <PowerOff className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
            OFFLINE
          </span>
        );
    }
  };

  const chartData = readings.map((r) => {
    const time = new Date(r.recorded_at);
    return {
      timeStr: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: time.getTime(),
      temperature: r.temperature_c,
      pressure: r.pressure_bar,
      level: r.level_pct,
    };
  });

  const latestReading = equipment?.latestReading;

  if (loadingEquipment) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-surface border border-border rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-surface border border-border rounded-2xl animate-pulse" />
          <div className="h-32 bg-surface border border-border rounded-2xl animate-pulse" />
          <div className="h-32 bg-surface border border-border rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !equipment) {
    return (
      <div className="bg-surface border border-border rounded-2xl shadow-card p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-status-critical-bg text-status-critical flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" strokeWidth={2} />
        </div>
        <h3 className="text-base font-bold text-navy">Telemetry Load Error</h3>
        <p className="text-xs text-muted mt-1 max-w-md mx-auto">{error || 'Storage unit not found.'}</p>
        <div className="mt-4 flex items-center justify-center space-x-3">
          <Link
            to="/equipment"
            className="h-10 px-5 rounded-full bg-white border border-border text-text text-xs font-semibold"
          >
            Back to Storage Units
          </Link>
          <button
            onClick={fetchData}
            className="h-10 px-5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Unit Header */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-6 md:p-8">
        <div className="flex items-center space-x-2 text-xs text-muted mb-4">
          <Link
            to="/equipment"
            className="inline-flex items-center space-x-1 font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Storage Units</span>
          </Link>
          <span>/</span>
          <span className="text-navy font-semibold">{equipment.code}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-1.5">
              <span className="font-mono text-base px-2.5 py-0.5 rounded-lg bg-primary-soft text-primary font-bold">
                {equipment.code}
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-navy">{equipment.name}</h2>
              {renderStatusBadge(equipment.status)}
            </div>
            <p className="text-xs sm:text-sm text-muted">
              {equipment.material} Bulk Storage &bull; {equipment.location} &bull; Capacity:{' '}
              <span className="font-semibold text-navy">{equipment.capacity_l.toLocaleString()} Liters</span>
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Time Range Selector */}
            <div className="flex items-center bg-[#F3F5FA] p-1 rounded-full border border-border">
              {(['1h', '6h', '24h'] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    timeRange === r
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted hover:text-navy'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <button
              onClick={fetchData}
              className="p-2.5 rounded-full bg-white border border-border hover:bg-[#F3F5FA] text-text transition-colors shadow-sm"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loadingReadings ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      {/* 3 Real-Time Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Temperature Card */}
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Temperature
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
              <Thermometer className="w-4 h-4" strokeWidth={2} />
            </div>
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-navy font-mono">
              {latestReading ? `${latestReading.temperature_c.toFixed(1)}°C` : '--'}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-border/80 flex items-center justify-between text-xs">
            <span className="text-muted">Warning / Crit:</span>
            <span className="font-mono font-semibold text-navy">
              &gt; {equipment.temp_warn_c}°C / &gt; {equipment.temp_crit_c}°C
            </span>
          </div>
        </div>

        {/* Pressure Card */}
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Vessel Pressure
            </span>
            <div className="w-8 h-8 rounded-lg bg-accent-soft text-teal flex items-center justify-center">
              <Gauge className="w-4 h-4" strokeWidth={2} />
            </div>
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-navy font-mono">
              {latestReading ? `${latestReading.pressure_bar.toFixed(2)} bar` : '--'}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-border/80 flex items-center justify-between text-xs">
            <span className="text-muted">Warning / Crit:</span>
            <span className="font-mono font-semibold text-navy">
              &gt; {equipment.pressure_warn_bar} bar / &gt; {equipment.pressure_crit_bar} bar
            </span>
          </div>
        </div>

        {/* Liquid Level Card */}
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Liquid Level
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#EBF7FC] text-teal flex items-center justify-center">
              <Droplets className="w-4 h-4" strokeWidth={2} />
            </div>
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-navy font-mono">
              {latestReading ? `${latestReading.level_pct.toFixed(1)}%` : '--'}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-border/80 flex items-center justify-between text-xs">
            <span className="text-muted">Warning / Crit:</span>
            <span className="font-mono font-semibold text-navy">
              &lt; {equipment.level_warn_pct}% / &lt; {equipment.level_crit_pct}%
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Graphs Section */}
      <div className="space-y-6">
        {/* 1. Temperature Chart */}
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-navy">Temperature Profile (°C)</h3>
              <p className="text-xs text-muted">
                Thermal insulation monitoring with Warning ({equipment.temp_warn_c}°C) and Critical ({equipment.temp_crit_c}°C) thresholds
              </p>
            </div>
            <span className="text-xs font-semibold text-primary font-mono">{readings.length} points</span>
          </div>

          {readings.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-border rounded-xl text-center p-6">
              <Clock className="w-8 h-8 text-muted mb-2" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-navy">No readings recorded in this time window</p>
              <p className="text-xs text-muted mt-0.5">Run the simulator to stream live telemetry.</p>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF1F6" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="timeStr"
                    tick={{ fill: '#5B6578', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E9F2' }}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fill: '#5B6578', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E9F2' }}
                    unit="°C"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E5E9F2',
                      boxShadow: '0 4px 12px rgba(11,22,51,0.08)',
                      fontSize: '12px',
                      color: '#0B1633',
                    }}
                  />
                  <ReferenceLine
                    y={equipment.temp_warn_c}
                    stroke="#C77700"
                    strokeDasharray="4 4"
                    label={{ value: 'Warn', fill: '#C77700', fontSize: 10, position: 'insideTopRight' }}
                  />
                  <ReferenceLine
                    y={equipment.temp_crit_c}
                    stroke="#D92D20"
                    strokeDasharray="4 4"
                    label={{ value: 'Crit', fill: '#D92D20', fontSize: 10, position: 'insideTopRight' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    name="Temperature"
                    stroke="#1A2BC3"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#1A2BC3' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 2. Pressure Chart */}
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-navy">Vessel Pressure Profile (bar)</h3>
              <p className="text-xs text-muted">
                Pressure safety envelope with Warning ({equipment.pressure_warn_bar} bar) and Critical ({equipment.pressure_crit_bar} bar) thresholds
              </p>
            </div>
          </div>

          {readings.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-border rounded-xl text-center p-6">
              <Clock className="w-8 h-8 text-muted mb-2" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-navy">No readings available</p>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF1F6" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="timeStr"
                    tick={{ fill: '#5B6578', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E9F2' }}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fill: '#5B6578', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E9F2' }}
                    unit=" bar"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E5E9F2',
                      boxShadow: '0 4px 12px rgba(11,22,51,0.08)',
                      fontSize: '12px',
                      color: '#0B1633',
                    }}
                  />
                  <ReferenceLine
                    y={equipment.pressure_warn_bar}
                    stroke="#C77700"
                    strokeDasharray="4 4"
                    label={{ value: 'Warn', fill: '#C77700', fontSize: 10, position: 'insideTopRight' }}
                  />
                  <ReferenceLine
                    y={equipment.pressure_crit_bar}
                    stroke="#D92D20"
                    strokeDasharray="4 4"
                    label={{ value: 'Crit', fill: '#D92D20', fontSize: 10, position: 'insideTopRight' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pressure"
                    name="Pressure"
                    stroke="#4AA8B5"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#4AA8B5' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 3. Liquid Level Chart */}
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-navy">Liquid Level Depletion (%)</h3>
              <p className="text-xs text-muted">
                Volumetric capacity tracking with Low Warning ({equipment.level_warn_pct}%) and Critical Depletion ({equipment.level_crit_pct}%) thresholds
              </p>
            </div>
          </div>

          {readings.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-border rounded-xl text-center p-6">
              <Clock className="w-8 h-8 text-muted mb-2" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-navy">No readings available</p>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF1F6" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="timeStr"
                    tick={{ fill: '#5B6578', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E9F2' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: '#5B6578', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E9F2' }}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E5E9F2',
                      boxShadow: '0 4px 12px rgba(11,22,51,0.08)',
                      fontSize: '12px',
                      color: '#0B1633',
                    }}
                  />
                  <ReferenceLine
                    y={equipment.level_warn_pct}
                    stroke="#C77700"
                    strokeDasharray="4 4"
                    label={{ value: 'Low Warn', fill: '#C77700', fontSize: 10, position: 'insideTopRight' }}
                  />
                  <ReferenceLine
                    y={equipment.level_crit_pct}
                    stroke="#D92D20"
                    strokeDasharray="4 4"
                    label={{ value: 'Low Crit', fill: '#D92D20', fontSize: 10, position: 'insideTopRight' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="level"
                    name="Level %"
                    stroke="#7EF0C9"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#7EF0C9' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Stored Threshold Specifications Table */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-6">
        <div className="flex items-center space-x-2 text-xs font-bold text-navy uppercase tracking-wider mb-4">
          <ShieldAlert className="w-4 h-4 text-primary" strokeWidth={2} />
          <span>Configured Vessel Threshold Parameters (PostgreSQL)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-[#F8FAFD] rounded-xl border border-border">
            <span className="text-muted block mb-1">Temperature Thresholds</span>
            <span className="font-semibold text-navy">
              Warn: {equipment.temp_warn_c}°C &bull; Crit: {equipment.temp_crit_c}°C
            </span>
          </div>

          <div className="p-3.5 bg-[#F8FAFD] rounded-xl border border-border">
            <span className="text-muted block mb-1">Pressure Thresholds</span>
            <span className="font-semibold text-navy">
              Warn: {equipment.pressure_warn_bar} bar &bull; Crit: {equipment.pressure_crit_bar} bar
            </span>
          </div>

          <div className="p-3.5 bg-[#F8FAFD] rounded-xl border border-border">
            <span className="text-muted block mb-1">Level Thresholds</span>
            <span className="font-semibold text-navy">
              Warn: {equipment.level_warn_pct}% &bull; Crit: {equipment.level_crit_pct}%
            </span>
          </div>
        </div>
      </div>

      {/* Maintenance History & Tasks Section */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-status-info-bg text-status-info flex items-center justify-center">
              <Wrench className="w-4 h-4" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy">Maintenance History & Upcoming Schedule</h3>
              <p className="text-xs text-muted">Preventive service records, inspections, and upcoming tasks for this unit</p>
            </div>
          </div>
          <Link
            to="/maintenance"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center space-x-1"
          >
            <span>All Facility Tasks</span>
            <Calendar className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingMaintenance ? (
          <div className="space-y-3 py-4">
            <div className="h-10 bg-border/40 rounded-xl animate-pulse" />
            <div className="h-10 bg-border/40 rounded-xl animate-pulse" />
          </div>
        ) : maintenanceTasks.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-border rounded-xl">
            <Wrench className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-navy">No Maintenance Records</p>
            <p className="text-xs text-muted mt-0.5">No upcoming or completed maintenance tasks logged for {equipment.code}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left text-sm border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-[#F8FAFD] border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wider">
                  <th className="py-3 px-6">Task Title</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Recurrence</th>
                  <th className="py-3 px-6">Completed Date / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {maintenanceTasks.map((task) => {
                  const isOverdue = task.status === 'OVERDUE';
                  const isCompleted = task.status === 'COMPLETED';
                  const isProgress = task.status === 'IN_PROGRESS' || task.status === 'SCHEDULED';

                  return (
                    <tr key={task.id} className="hover:bg-[#F8FAFD] transition-colors">
                      <td className="py-3.5 px-6 font-semibold text-navy">
                        <div>{task.title}</div>
                        {task.description && (
                          <div className="text-[11px] text-muted font-normal line-clamp-1">{task.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isOverdue
                              ? 'bg-status-critical-bg text-status-critical'
                              : isCompleted
                              ? 'bg-status-success-bg text-status-success'
                              : isProgress
                              ? 'bg-status-info-bg text-status-info'
                              : 'bg-status-neutral-bg text-status-neutral'
                          }`}
                        >
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted whitespace-nowrap font-medium">
                        {new Date(task.due_date).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-navy whitespace-nowrap">
                        {task.assignee?.name || 'Unassigned'}
                      </td>
                      <td className="py-3.5 px-4 text-muted whitespace-nowrap">
                        {task.recurrence_days ? `Every ${task.recurrence_days} days` : 'One-off'}
                      </td>
                      <td className="py-3.5 px-6 text-muted">
                        {isCompleted ? (
                          <div>
                            <span className="text-status-success font-semibold">
                              Done {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : ''}
                            </span>
                            {task.notes && <div className="text-[11px] text-navy italic mt-0.5">"{task.notes}"</div>}
                          </div>
                        ) : (
                          <span className="text-muted italic">Pending completion</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Safety Inspection History Section */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy">Safety Inspection Audits (Recent 5)</h3>
              <p className="text-xs text-muted">Integrity compliance assessments and checklist findings for this vessel</p>
            </div>
          </div>
          <Link
            to="/inspections"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center space-x-1"
          >
            <span>All Safety Audits</span>
            <ClipboardCheck className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingInspections ? (
          <div className="space-y-3 py-4">
            <div className="h-10 bg-border/40 rounded-xl animate-pulse" />
            <div className="h-10 bg-border/40 rounded-xl animate-pulse" />
          </div>
        ) : inspections.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-border rounded-xl">
            <ShieldCheck className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-navy">No Safety Inspection Records</p>
            <p className="text-xs text-muted mt-0.5">No routine safety audits have been filed for {equipment.code} yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left text-sm border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-[#F8FAFD] border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wider">
                  <th className="py-3 px-6">Audit Date</th>
                  <th className="py-3 px-4">Protocol Template</th>
                  <th className="py-3 px-4">Inspector</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">Checklist Score</th>
                  <th className="py-3 px-6 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {inspections.map((insp) => {
                  const resultsList = (Array.isArray(insp.results) ? insp.results : []) as InspectionItemResult[];
                  const failedCount = resultsList.filter((r) => r.result === 'FAIL').length;
                  const totalCount = resultsList.length;

                  return (
                    <tr key={insp.id} className="hover:bg-[#F8FAFD] transition-colors">
                      <td className="py-3.5 px-6 font-semibold text-navy whitespace-nowrap">
                        {new Date(insp.performed_at).toLocaleDateString()}
                        <span className="text-[11px] text-muted font-normal block font-mono">
                          {new Date(insp.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-navy">
                        {insp.template?.name || 'Safety Protocol'}
                      </td>
                      <td className="py-3.5 px-4 text-muted whitespace-nowrap">
                        {insp.inspector?.name || 'Staff User'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            insp.overall === 'PASS'
                              ? 'bg-status-success-bg text-status-success'
                              : insp.overall === 'FAIL'
                              ? 'bg-status-critical-bg text-status-critical'
                              : 'bg-status-warning-bg text-status-warning'
                          }`}
                        >
                          {insp.overall}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted whitespace-nowrap font-medium">
                        {failedCount > 0 ? (
                          <span className="text-status-critical font-bold">{failedCount} failed</span>
                        ) : (
                          <span className="text-status-success font-semibold">All {totalCount} passed</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        <Link
                          to={`/inspections/${insp.id}`}
                          className="h-7 px-2.5 rounded-lg bg-primary-soft hover:bg-primary/20 text-primary font-semibold text-xs inline-flex items-center space-x-1"
                        >
                          <span>View</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
