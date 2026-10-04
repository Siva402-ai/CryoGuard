import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Filter,
  AlertCircle,
  Clock,
  Wrench,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { getEquipmentListApi } from '../api/equipment';
import {
  getTemperatureTrendReportApi,
  getAlertsByMonthReportApi,
  getMaintenanceHistoryReportApi,
  getInventoryConsumptionReportApi,
  downloadReportCsvApi,
} from '../api/reports';
import { Equipment } from '../types/equipment';
import {
  TemperatureTrendResponse,
  AlertsByMonthResponse,
  MaintenanceHistoryResponse,
  InventoryConsumptionResponse,
  ReportQueryParams,
} from '../types/reports';

// Section 10 chart palette: 6 series
const CHART_PALETTE = ['#1A2BC3', '#4AA8B5', '#7EF0C9', '#94A3B8', '#6B7BE8', '#0B1633'];

// Status colors
const STATUS_COLORS = {
  warning: '#C77700',
  critical: '#D92D20',
  success: '#0E9F6E',
  info: '#1A2BC3',
  neutral: '#5B6578',
};

type DatePreset = '24h' | '7d' | '30d' | '6m' | 'custom';

export const ReportsPage: React.FC = () => {
  // Global filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);

  // Range dates computed from preset or custom
  const queryRange = useMemo<{ from: string; to: string }>(() => {
    const now = new Date();
    let fromDate: Date;
    if (datePreset === '24h') {
      fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (datePreset === '7d') {
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (datePreset === '30d') {
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (datePreset === '6m') {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    } else {
      const parsedFrom = customFrom ? new Date(customFrom) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const parsedTo = customTo ? new Date(customTo) : now;
      return {
        from: isNaN(parsedFrom.getTime()) ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() : parsedFrom.toISOString(),
        to: isNaN(parsedTo.getTime()) ? now.toISOString() : parsedTo.toISOString(),
      };
    }
    return {
      from: fromDate.toISOString(),
      to: now.toISOString(),
    };
  }, [datePreset, customFrom, customTo]);

  const queryParams: ReportQueryParams = useMemo(() => {
    return {
      from: queryRange.from,
      to: queryRange.to,
      equipmentId: selectedEquipmentId || undefined,
    };
  }, [queryRange, selectedEquipmentId]);

  // Load equipment list for dropdown
  useEffect(() => {
    getEquipmentListApi()
      .then((data) => {
        setEquipmentList(data.equipment || []);
      })
      .catch((err) => console.error('Failed to load equipment list:', err));
  }, []);

  // ----------------------------------------------------
  // CARD 1: Temperature Trend State
  // ----------------------------------------------------
  const [tempData, setTempData] = useState<TemperatureTrendResponse | null>(null);
  const [loadingTemp, setLoadingTemp] = useState<boolean>(true);
  const [errorTemp, setErrorTemp] = useState<string | null>(null);
  const [selectedTanks, setSelectedTanks] = useState<string[]>([]);
  const [exportingTemp, setExportingTemp] = useState(false);

  const fetchTempTrend = useCallback(async () => {
    setLoadingTemp(true);
    setErrorTemp(null);
    try {
      const data = await getTemperatureTrendReportApi(queryParams);
      setTempData(data);
      // Auto-select up to first 4 tanks if selection is empty
      const uniqueTanks = Array.from(new Set(data.data.map((d) => d.equipmentCode)));
      setSelectedTanks((prev) => {
        if (prev.length > 0) return prev;
        return uniqueTanks.slice(0, 4);
      });
    } catch (err: any) {
      setErrorTemp(err.response?.data?.error || 'Failed to load temperature trend report');
    } finally {
      setLoadingTemp(false);
    }
  }, [queryParams]);

  useEffect(() => {
    fetchTempTrend();
  }, [fetchTempTrend]);

  // Transform temperature points into chart rows grouped by timestamp
  const { tempChartRows, allTanksInTrend } = useMemo(() => {
    if (!tempData || !tempData.data.length) return { tempChartRows: [], allTanksInTrend: [] };

    const tankCodes = Array.from(new Set(tempData.data.map((d) => d.equipmentCode))).sort();
    const timeMap = new Map<string, any>();

    for (const p of tempData.data) {
      const timeKey = new Date(p.bucket).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: tempData.meta.bucketSize === '1 day' ? undefined : '2-digit',
        minute: tempData.meta.bucketSize === '5 minutes' ? '2-digit' : undefined,
      });

      if (!timeMap.has(p.bucket)) {
        timeMap.set(p.bucket, {
          rawTime: p.bucket,
          formattedTime: timeKey,
        });
      }
      const row = timeMap.get(p.bucket);
      row[p.equipmentCode] = p.avgTemp;
      row[`${p.equipmentCode}_min`] = p.minTemp;
      row[`${p.equipmentCode}_max`] = p.maxTemp;
    }

    const rows = Array.from(timeMap.values()).sort(
      (a, b) => new Date(a.rawTime).getTime() - new Date(b.rawTime).getTime()
    );

    return { tempChartRows: rows, allTanksInTrend: tankCodes };
  }, [tempData]);

  // ----------------------------------------------------
  // CARD 2: Alerts by Month State
  // ----------------------------------------------------
  const [alertsData, setAlertsData] = useState<AlertsByMonthResponse | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState<boolean>(true);
  const [errorAlerts, setErrorAlerts] = useState<string | null>(null);
  const [alertGroupBy, setAlertGroupBy] = useState<'severity' | 'type'>('severity');
  const [exportingAlerts, setExportingAlerts] = useState(false);

  const fetchAlertsReport = useCallback(async () => {
    setLoadingAlerts(true);
    setErrorAlerts(null);
    try {
      const data = await getAlertsByMonthReportApi(queryParams);
      setAlertsData(data);
    } catch (err: any) {
      setErrorAlerts(err.response?.data?.error || 'Failed to load alerts report');
    } finally {
      setLoadingAlerts(false);
    }
  }, [queryParams]);

  useEffect(() => {
    fetchAlertsReport();
  }, [fetchAlertsReport]);

  const alertsChartData = useMemo(() => {
    if (!alertsData || !alertsData.data.length) return [];

    const monthMap = new Map<string, any>();

    for (const item of alertsData.data) {
      if (!monthMap.has(item.month)) {
        monthMap.set(item.month, {
          month: item.month,
          WARNING: 0,
          CRITICAL: 0,
          TEMPERATURE: 0,
          PRESSURE: 0,
          LEVEL: 0,
          INSPECTION: 0,
          MAINTENANCE: 0,
          INVENTORY: 0,
        });
      }
      const entry = monthMap.get(item.month);
      if (item.severity === 'WARNING') entry.WARNING += item.count;
      if (item.severity === 'CRITICAL') entry.CRITICAL += item.count;

      if (item.type && entry[item.type] !== undefined) {
        entry[item.type] += item.count;
      }
    }

    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [alertsData]);

  // ----------------------------------------------------
  // CARD 3: Maintenance History State
  // ----------------------------------------------------
  const [maintData, setMaintData] = useState<MaintenanceHistoryResponse | null>(null);
  const [loadingMaint, setLoadingMaint] = useState<boolean>(true);
  const [errorMaint, setErrorMaint] = useState<string | null>(null);
  const [exportingMaint, setExportingMaint] = useState(false);

  const fetchMaintReport = useCallback(async () => {
    setLoadingMaint(true);
    setErrorMaint(null);
    try {
      const data = await getMaintenanceHistoryReportApi(queryParams);
      setMaintData(data);
    } catch (err: any) {
      setErrorMaint(err.response?.data?.error || 'Failed to load maintenance history report');
    } finally {
      setLoadingMaint(false);
    }
  }, [queryParams]);

  useEffect(() => {
    fetchMaintReport();
  }, [fetchMaintReport]);

  // ----------------------------------------------------
  // CARD 4: Inventory Consumption State
  // ----------------------------------------------------
  const [invData, setInvData] = useState<InventoryConsumptionResponse | null>(null);
  const [loadingInv, setLoadingInv] = useState<boolean>(true);
  const [errorInv, setErrorInv] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>('All');
  const [exportingInv, setExportingInv] = useState(false);

  const fetchInvReport = useCallback(async () => {
    setLoadingInv(true);
    setErrorInv(null);
    try {
      const data = await getInventoryConsumptionReportApi(queryParams);
      setInvData(data);
      // Determine unique units
      if (data.items.length > 0 && selectedUnit === 'All') {
        const units = Array.from(new Set(data.items.map((i) => i.unit)));
        if (units.length > 0) {
          // Default to first unit or keep 'All'
        }
      }
    } catch (err: any) {
      setErrorInv(err.response?.data?.error || 'Failed to load inventory consumption report');
    } finally {
      setLoadingInv(false);
    }
  }, [queryParams, selectedUnit]);

  useEffect(() => {
    fetchInvReport();
  }, [fetchInvReport]);

  // Available units for inventory selector
  const availableUnits = useMemo(() => {
    if (!invData || !invData.items.length) return ['All'];
    const units = Array.from(new Set(invData.items.map((i) => i.unit)));
    return ['All', ...units];
  }, [invData]);

  const filteredInventoryItems = useMemo(() => {
    if (!invData || !invData.items.length) return [];
    if (selectedUnit === 'All') return invData.items;
    return invData.items.filter((i) => i.unit.toLowerCase() === selectedUnit.toLowerCase());
  }, [invData, selectedUnit]);

  // Handler for exporting CSVs
  const handleExportCsv = async (
    endpoint: 'temperature-trend' | 'alerts-by-month' | 'maintenance-history' | 'inventory-consumption',
    setLoading: (val: boolean) => void
  ) => {
    setLoading(true);
    try {
      const fromStr = queryParams.from?.slice(0, 10) || 'from';
      const toStr = queryParams.to?.slice(0, 10) || 'to';
      const fallbackName = `cryoguard-${endpoint}-${fromStr}-${toStr}.csv`;
      await downloadReportCsvApi(endpoint, queryParams, fallbackName);
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Unable to download CSV'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1633] tracking-tight">Reports & Compliance</h1>
          <p className="text-sm text-[#5B6578] mt-1">
            Historical telemetry trends, safety alert analytics, maintenance performance, and material consumption
          </p>
        </div>
      </div>

      {/* Top Controls Bar */}
      <div className="bg-white rounded-2xl border border-[#E5E9F2] p-4 shadow-[0_1px_2px_rgba(11,22,51,0.04),0_8px_24px_rgba(11,22,51,0.04)] flex flex-wrap items-center justify-between gap-4">
        {/* Date Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6578] mr-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#1A2BC3]" />
            Range:
          </span>
          {(['24h', '7d', '30d', '6m'] as DatePreset[]).map((preset) => {
            const labelMap: Record<DatePreset, string> = {
              '24h': 'Last 24 Hours',
              '7d': 'Last 7 Days',
              '30d': 'Last 30 Days',
              '6m': 'Last 6 Months',
              custom: 'Custom',
            };
            const active = datePreset === preset;
            return (
              <button
                key={preset}
                id={`preset-${preset}`}
                onClick={() => setDatePreset(preset)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  active
                    ? 'bg-[#1A2BC3] text-white shadow-sm'
                    : 'bg-[#F6F8FC] text-[#1F2A44] hover:bg-[#EEF1F6] border border-[#E5E9F2]'
                }`}
              >
                {labelMap[preset]}
              </button>
            );
          })}
          <button
            id="preset-custom"
            onClick={() => setDatePreset('custom')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              datePreset === 'custom'
                ? 'bg-[#1A2BC3] text-white shadow-sm'
                : 'bg-[#F6F8FC] text-[#1F2A44] hover:bg-[#EEF1F6] border border-[#E5E9F2]'
            }`}
          >
            Custom
          </button>
        </div>

        {/* Custom Range Inputs (if custom selected) */}
        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 bg-[#F6F8FC] p-2 rounded-xl border border-[#E5E9F2]">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-[#5B6578]">From:</label>
              <input
                type="date"
                id="custom-from"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1 text-xs bg-white border border-[#E5E9F2] rounded-lg text-[#1F2A44] focus:outline-none focus:ring-1 focus:ring-[#1A2BC3]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-[#5B6578]">To:</label>
              <input
                type="date"
                id="custom-to"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1 text-xs bg-white border border-[#E5E9F2] rounded-lg text-[#1F2A44] focus:outline-none focus:ring-1 focus:ring-[#1A2BC3]"
              />
            </div>
          </div>
        )}

        {/* Equipment Filter Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#5B6578] flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-[#1A2BC3]" />
            Equipment:
          </label>
          <div className="relative">
            <select
              id="equipment-filter-select"
              value={selectedEquipmentId}
              onChange={(e) => setSelectedEquipmentId(e.target.value)}
              aria-label="Filter reports by equipment"
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-[#F6F8FC] border border-[#E5E9F2] rounded-xl text-[#1F2A44] focus:outline-none focus:ring-2 focus:ring-[#1A2BC3] cursor-pointer"
            >
              <option value="">All Equipment</option>
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.code} - {eq.name} ({eq.material})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#5B6578] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Grid of 4 Report Cards */}
      <div className="grid grid-cols-1 gap-8">
        {/* ===================================================== */}
        {/* CARD 1: Temperature Trend */}
        {/* ===================================================== */}
        <div className="bg-white rounded-2xl border border-[#E5E9F2] p-6 shadow-[0_1px_2px_rgba(11,22,51,0.04),0_8px_24px_rgba(11,22,51,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E9F2]">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EEF1FF] flex items-center justify-center text-[#1A2BC3]">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#0B1633]">Cryogenic Temperature Trend</h2>
                  <p className="text-xs text-[#5B6578]">
                    Multi-tank average temperature time series with min/max bounds
                  </p>
                </div>
              </div>
            </div>

            <button
              id="export-temp-csv"
              disabled={loadingTemp || exportingTemp || !tempChartRows.length}
              onClick={() => handleExportCsv('temperature-trend', setExportingTemp)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border border-[#E5E9F2] bg-white text-[#1F2A44] hover:bg-[#F6F8FC] disabled:opacity-50 transition-colors self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5 text-[#1A2BC3]" />
              {exportingTemp ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>

          {/* Retention / Range Notice */}
          {tempData?.meta && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[#5B6578] bg-[#F6F8FC] px-3 py-2 rounded-xl border border-[#EEF1F6]">
              <Info className="w-3.5 h-3.5 text-[#1A2BC3] flex-shrink-0" />
              <span>
                Bucket resolution: <strong>{tempData.meta.bucketSize}</strong>.
                {tempData.meta.dataFrom && (
                  <span className="ml-1">
                    Telemetry available since{' '}
                    <strong>{new Date(tempData.meta.dataFrom).toLocaleString()}</strong> (7-day raw retention policy).
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Tank Multi-select filter chips */}
          {allTanksInTrend.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#5B6578] font-medium mr-1">Tanks:</span>
              {allTanksInTrend.map((tankCode, idx) => {
                const color = CHART_PALETTE[idx % CHART_PALETTE.length];
                const isSelected = selectedTanks.includes(tankCode);
                return (
                  <button
                    key={tankCode}
                    onClick={() => {
                      setSelectedTanks((prev) =>
                        isSelected ? prev.filter((t) => t !== tankCode) : [...prev, tankCode]
                      );
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-white text-[#1F2A44] shadow-sm'
                        : 'bg-[#F6F8FC] text-[#94A3B8] border-transparent opacity-60'
                    }`}
                    style={{
                      borderColor: isSelected ? color : 'transparent',
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {tankCode}
                  </button>
                );
              })}
            </div>
          )}

          {/* Body content / Loading / Error / Empty states */}
          <div className="mt-6">
            {loadingTemp ? (
              <div className="h-72 w-full animate-pulse flex flex-col justify-end gap-3 p-4 bg-[#F6F8FC] rounded-xl">
                <div className="h-4 bg-[#E5E9F2] rounded w-1/4 mb-auto"></div>
                <div className="h-48 bg-[#E5E9F2] rounded"></div>
              </div>
            ) : errorTemp ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#FDECEA] rounded-xl border border-[#D92D20]/20">
                <AlertCircle className="w-8 h-8 text-[#D92D20] mb-2" />
                <p className="text-sm font-semibold text-[#D92D20]">{errorTemp}</p>
                <button
                  onClick={fetchTempTrend}
                  className="mt-3 px-4 py-1.5 rounded-full text-xs font-medium bg-[#D92D20] text-white hover:bg-[#B42318] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : tempChartRows.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#F6F8FC] rounded-xl border border-[#E5E9F2]">
                <Clock className="w-8 h-8 text-[#94A3B8] mb-2" />
                <p className="text-sm font-semibold text-[#1F2A44]">No data in this range</p>
                <p className="text-xs text-[#5B6578] mt-1">
                  Adjust date parameters or select a different vessel to view telemetry history.
                </p>
              </div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={tempChartRows}
                    margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                    <XAxis
                      dataKey="formattedTime"
                      tick={{ fill: '#5B6578', fontSize: 11 }}
                      stroke="#E5E9F2"
                      dy={10}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fill: '#5B6578', fontSize: 11 }}
                      stroke="#E5E9F2"
                      unit="°C"
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-[#0B1633] text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[160px]">
                              <div className="font-semibold border-b border-white/10 pb-1 text-[#7EF0C9]">
                                {label}
                              </div>
                              {payload.map((entry: any) => {
                                const tankCode = entry.dataKey;
                                const min = entry.payload[`${tankCode}_min`];
                                const max = entry.payload[`${tankCode}_max`];
                                return (
                                  <div key={tankCode} className="flex flex-col gap-0.5 pt-0.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="flex items-center gap-1.5 font-medium">
                                        <span
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: entry.color }}
                                        />
                                        {tankCode}:
                                      </span>
                                      <span className="font-bold">{Number(entry.value).toFixed(1)}°C</span>
                                    </div>
                                    {min !== undefined && max !== undefined && (
                                      <div className="text-[10px] text-[#94A3B8] pl-3.5">
                                        Min: {min.toFixed(1)}°C | Max: {max.toFixed(1)}°C
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 10 }} />
                    {allTanksInTrend
                      .filter((t) => selectedTanks.includes(t))
                      .map((tankCode) => {
                        const idx = allTanksInTrend.indexOf(tankCode);
                        const color = CHART_PALETTE[idx % CHART_PALETTE.length];
                        return (
                          <Line
                            key={tankCode}
                            type="monotone"
                            dataKey={tankCode}
                            name={tankCode}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                        );
                      })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* ===================================================== */}
        {/* CARD 2: Alerts by Month */}
        {/* ===================================================== */}
        <div className="bg-white rounded-2xl border border-[#E5E9F2] p-6 shadow-[0_1px_2px_rgba(11,22,51,0.04),0_8px_24px_rgba(11,22,51,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E9F2]">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FFF4DE] flex items-center justify-center text-[#C77700]">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#0B1633]">Safety & Threshold Alerts Analysis</h2>
                  <p className="text-xs text-[#5B6578]">
                    Monthly distribution grouped by severity level or alarm trigger category
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Toggle Grouping */}
              <div className="flex items-center bg-[#F6F8FC] p-1 rounded-full border border-[#E5E9F2] text-xs">
                <button
                  id="group-by-severity"
                  onClick={() => setAlertGroupBy('severity')}
                  className={`px-3 py-1 rounded-full font-medium transition-all ${
                    alertGroupBy === 'severity'
                      ? 'bg-white text-[#0B1633] shadow-sm'
                      : 'text-[#5B6578] hover:text-[#1F2A44]'
                  }`}
                >
                  By Severity
                </button>
                <button
                  id="group-by-type"
                  onClick={() => setAlertGroupBy('type')}
                  className={`px-3 py-1 rounded-full font-medium transition-all ${
                    alertGroupBy === 'type'
                      ? 'bg-white text-[#0B1633] shadow-sm'
                      : 'text-[#5B6578] hover:text-[#1F2A44]'
                  }`}
                >
                  By Type
                </button>
              </div>

              <button
                id="export-alerts-csv"
                disabled={loadingAlerts || exportingAlerts || !alertsChartData.length}
                onClick={() => handleExportCsv('alerts-by-month', setExportingAlerts)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border border-[#E5E9F2] bg-white text-[#1F2A44] hover:bg-[#F6F8FC] disabled:opacity-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#1A2BC3]" />
                {exportingAlerts ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>
          </div>

          <div className="mt-6">
            {loadingAlerts ? (
              <div className="h-64 w-full animate-pulse flex flex-col justify-end gap-3 p-4 bg-[#F6F8FC] rounded-xl">
                <div className="h-4 bg-[#E5E9F2] rounded w-1/4 mb-auto"></div>
                <div className="h-40 bg-[#E5E9F2] rounded"></div>
              </div>
            ) : errorAlerts ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#FDECEA] rounded-xl border border-[#D92D20]/20">
                <AlertCircle className="w-8 h-8 text-[#D92D20] mb-2" />
                <p className="text-sm font-semibold text-[#D92D20]">{errorAlerts}</p>
                <button
                  onClick={fetchAlertsReport}
                  className="mt-3 px-4 py-1.5 rounded-full text-xs font-medium bg-[#D92D20] text-white hover:bg-[#B42318] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : alertsChartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#F6F8FC] rounded-xl border border-[#E5E9F2]">
                <CheckCircle2 className="w-8 h-8 text-[#0E9F6E] mb-2" />
                <p className="text-sm font-semibold text-[#1F2A44]">No data in this range</p>
                <p className="text-xs text-[#5B6578] mt-1">
                  No safety alerts logged during the selected operational timeframe.
                </p>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={alertsChartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#5B6578', fontSize: 11 }} stroke="#E5E9F2" />
                    <YAxis allowDecimals={false} tick={{ fill: '#5B6578', fontSize: 11 }} stroke="#E5E9F2" />
                    <Tooltip
                      cursor={{ fill: 'rgba(238,241,246,0.6)' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-[#0B1633] text-white p-3 rounded-xl shadow-xl text-xs space-y-1 min-w-[140px]">
                              <div className="font-semibold border-b border-white/10 pb-1 text-[#7EF0C9]">
                                Month: {label}
                              </div>
                              {payload.map((entry: any) => (
                                <div key={entry.dataKey} className="flex justify-between items-center gap-3">
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    {entry.name}:
                                  </span>
                                  <span className="font-bold">{entry.value}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 8 }} />
                    {alertGroupBy === 'severity' ? (
                      <>
                        <Bar
                          dataKey="WARNING"
                          name="Warning Alerts"
                          stackId="a"
                          fill={STATUS_COLORS.warning}
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="CRITICAL"
                          name="Critical Alerts"
                          stackId="a"
                          fill={STATUS_COLORS.critical}
                          radius={[4, 4, 0, 0]}
                        />
                      </>
                    ) : (
                      <>
                        <Bar dataKey="TEMPERATURE" name="Temperature" stackId="a" fill={CHART_PALETTE[0]} />
                        <Bar dataKey="PRESSURE" name="Pressure" stackId="a" fill={CHART_PALETTE[1]} />
                        <Bar dataKey="LEVEL" name="Level" stackId="a" fill={CHART_PALETTE[2]} />
                        <Bar dataKey="INSPECTION" name="Inspection" stackId="a" fill={CHART_PALETTE[3]} />
                        <Bar dataKey="MAINTENANCE" name="Maintenance" stackId="a" fill={CHART_PALETTE[4]} />
                        <Bar dataKey="INVENTORY" name="Inventory" stackId="a" fill={CHART_PALETTE[5]} radius={[4, 4, 0, 0]} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* ===================================================== */}
        {/* CARD 3: Maintenance History */}
        {/* ===================================================== */}
        <div className="bg-white rounded-2xl border border-[#E5E9F2] p-6 shadow-[0_1px_2px_rgba(11,22,51,0.04),0_8px_24px_rgba(11,22,51,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E9F2]">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EEF1FF] flex items-center justify-center text-[#1A2BC3]">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#0B1633]">Preventive Maintenance Performance</h2>
                  <p className="text-xs text-[#5B6578]">
                    Task execution compliance, on-time completion rates, and recent log records
                  </p>
                </div>
              </div>
            </div>

            <button
              id="export-maint-csv"
              disabled={loadingMaint || exportingMaint || !maintData?.tasks?.length}
              onClick={() => handleExportCsv('maintenance-history', setExportingMaint)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border border-[#E5E9F2] bg-white text-[#1F2A44] hover:bg-[#F6F8FC] disabled:opacity-50 transition-colors self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5 text-[#1A2BC3]" />
              {exportingMaint ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>

          <div className="mt-6">
            {loadingMaint ? (
              <div className="space-y-4 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="h-20 bg-[#F6F8FC] rounded-xl"></div>
                  <div className="h-20 bg-[#F6F8FC] rounded-xl"></div>
                  <div className="h-20 bg-[#F6F8FC] rounded-xl"></div>
                </div>
                <div className="h-48 bg-[#F6F8FC] rounded-xl"></div>
              </div>
            ) : errorMaint ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#FDECEA] rounded-xl border border-[#D92D20]/20">
                <AlertCircle className="w-8 h-8 text-[#D92D20] mb-2" />
                <p className="text-sm font-semibold text-[#D92D20]">{errorMaint}</p>
                <button
                  onClick={fetchMaintReport}
                  className="mt-3 px-4 py-1.5 rounded-full text-xs font-medium bg-[#D92D20] text-white hover:bg-[#B42318] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : !maintData || maintData.tasks.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#F6F8FC] rounded-xl border border-[#E5E9F2]">
                <CheckCircle2 className="w-8 h-8 text-[#0E9F6E] mb-2" />
                <p className="text-sm font-semibold text-[#1F2A44]">No data in this range</p>
                <p className="text-xs text-[#5B6578] mt-1">
                  No scheduled or completed maintenance tasks within the selected range.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 3 Stat Tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#E7F8F0] border border-[#0E9F6E]/20 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#0E9F6E] uppercase tracking-wider">Completed Tasks</p>
                      <p className="text-2xl font-bold text-[#0B1633] mt-0.5">{maintData.summary.completed}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#0E9F6E] shadow-sm">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-[#FDECEA] border border-[#D92D20]/20 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#D92D20] uppercase tracking-wider">Overdue Tasks</p>
                      <p className="text-2xl font-bold text-[#0B1633] mt-0.5">{maintData.summary.overdue}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#D92D20] shadow-sm">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-[#EEF1FF] border border-[#1A2BC3]/20 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#1A2BC3] uppercase tracking-wider">On-Time Completion Rate</p>
                      <p className="text-2xl font-bold text-[#0B1633] mt-0.5">{maintData.summary.onTimeRate}%</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#1A2BC3] shadow-sm">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Monthly Completed vs Overdue Bar Chart */}
                {maintData.byMonth.length > 0 && (
                  <div className="h-60 w-full pt-2">
                    <p className="text-xs font-semibold text-[#5B6578] mb-2 uppercase tracking-wider">
                      Monthly Work Order Breakdown
                    </p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={maintData.byMonth} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: '#5B6578', fontSize: 11 }} stroke="#E5E9F2" />
                        <YAxis allowDecimals={false} tick={{ fill: '#5B6578', fontSize: 11 }} stroke="#E5E9F2" />
                        <Tooltip
                          cursor={{ fill: 'rgba(238,241,246,0.6)' }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-[#0B1633] text-white p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                                  <div className="font-semibold text-[#7EF0C9] border-b border-white/10 pb-1">
                                    Month: {label}
                                  </div>
                                  {payload.map((entry: any) => (
                                    <div key={entry.dataKey} className="flex justify-between gap-4">
                                      <span style={{ color: entry.color }}>{entry.name}:</span>
                                      <span className="font-bold">{entry.value}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="completed" name="Completed" fill={STATUS_COLORS.success} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="overdue" name="Overdue" fill={STATUS_COLORS.critical} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Latest 10 Maintenance Tasks Table */}
                <div className="pt-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5B6578] mb-3">
                    Recent Maintenance Tasks (Latest 10)
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-[#E5E9F2]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F6F8FC] border-b border-[#E5E9F2] text-[#5B6578]">
                          <th className="py-2.5 px-3 font-semibold">Equipment</th>
                          <th className="py-2.5 px-3 font-semibold">Task Title</th>
                          <th className="py-2.5 px-3 font-semibold">Assignee</th>
                          <th className="py-2.5 px-3 font-semibold">Due Date</th>
                          <th className="py-2.5 px-3 font-semibold">Completed At</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          <th className="py-2.5 px-3 font-semibold">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E9F2] bg-white">
                        {maintData.tasks.slice(0, 10).map((t) => {
                          const isCompleted = t.status === 'COMPLETED';
                          const isOverdue = t.status === 'OVERDUE';
                          return (
                            <tr key={t.id} className="hover:bg-[#F6F8FC] transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-[#0B1633] whitespace-nowrap">
                                {t.equipmentCode}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-[#1F2A44]">{t.title}</td>
                              <td className="py-2.5 px-3 text-[#5B6578]">{t.assigneeName || 'Unassigned'}</td>
                              <td className="py-2.5 px-3 text-[#5B6578] whitespace-nowrap">
                                {new Date(t.dueDate).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 px-3 text-[#5B6578] whitespace-nowrap">
                                {t.completedAt ? new Date(t.completedAt).toLocaleDateString() : '—'}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    isCompleted
                                      ? 'bg-[#E7F8F0] text-[#0E9F6E]'
                                      : isOverdue
                                      ? 'bg-[#FDECEA] text-[#D92D20]'
                                      : 'bg-[#EEF1FF] text-[#1A2BC3]'
                                  }`}
                                >
                                  {t.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-[#5B6578] max-w-xs truncate" title={t.notes || ''}>
                                {t.notes || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===================================================== */}
        {/* CARD 4: Inventory Consumption */}
        {/* ===================================================== */}
        <div className="bg-white rounded-2xl border border-[#E5E9F2] p-6 shadow-[0_1px_2px_rgba(11,22,51,0.04),0_8px_24px_rgba(11,22,51,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E9F2]">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E7F8F0] flex items-center justify-center text-[#0E9F6E]">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#0B1633]">Material & Inventory Consumption</h2>
                  <p className="text-xs text-[#5B6578]">
                    Material outflow, inbound replenishment, and overall stock delta
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Unit Selector */}
              {availableUnits.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-semibold text-[#5B6578] uppercase tracking-wider">Unit:</label>
                  <select
                    id="inventory-unit-select"
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-[#F6F8FC] border border-[#E5E9F2] rounded-lg text-[#1F2A44] focus:outline-none focus:ring-1 focus:ring-[#1A2BC3]"
                  >
                    {availableUnits.map((u) => (
                      <option key={u} value={u}>
                        {u === 'All' ? 'All Units' : u}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                id="export-inv-csv"
                disabled={loadingInv || exportingInv || !filteredInventoryItems.length}
                onClick={() => handleExportCsv('inventory-consumption', setExportingInv)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border border-[#E5E9F2] bg-white text-[#1F2A44] hover:bg-[#F6F8FC] disabled:opacity-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#1A2BC3]" />
                {exportingInv ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>
          </div>

          <div className="mt-6">
            {loadingInv ? (
              <div className="h-64 w-full animate-pulse flex flex-col justify-end gap-3 p-4 bg-[#F6F8FC] rounded-xl">
                <div className="h-4 bg-[#E5E9F2] rounded w-1/4 mb-auto"></div>
                <div className="h-40 bg-[#E5E9F2] rounded"></div>
              </div>
            ) : errorInv ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#FDECEA] rounded-xl border border-[#D92D20]/20">
                <AlertCircle className="w-8 h-8 text-[#D92D20] mb-2" />
                <p className="text-sm font-semibold text-[#D92D20]">{errorInv}</p>
                <button
                  onClick={fetchInvReport}
                  className="mt-3 px-4 py-1.5 rounded-full text-xs font-medium bg-[#D92D20] text-white hover:bg-[#B42318] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : filteredInventoryItems.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#F6F8FC] rounded-xl border border-[#E5E9F2]">
                <Package className="w-8 h-8 text-[#94A3B8] mb-2" />
                <p className="text-sm font-semibold text-[#1F2A44]">No data in this range</p>
                <p className="text-xs text-[#5B6578] mt-1">
                  No inventory transactions recorded during the specified period.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Horizontal Bar Chart of Total OUT per item */}
                <div className="h-64 w-full">
                  <p className="text-xs font-semibold text-[#5B6578] mb-2 uppercase tracking-wider">
                    Total Outflow (Consumption) by Item {selectedUnit !== 'All' ? `(${selectedUnit})` : ''}
                  </p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={filteredInventoryItems}
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#5B6578', fontSize: 11 }} stroke="#E5E9F2" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: '#0B1633', fontSize: 11, fontWeight: 500 }}
                        stroke="#E5E9F2"
                        width={130}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(238,241,246,0.6)' }}
                        formatter={(value: any, _name: any, item: any) => [
                          `${value} ${item.payload.unit}`,
                          'Consumed (OUT)',
                        ]}
                      />
                      <Bar dataKey="totalOut" fill={CHART_PALETTE[0]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Table of all items with IN, OUT, Net */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5B6578] mb-3">
                    All Items Inventory Summary
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-[#E5E9F2]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F6F8FC] border-b border-[#E5E9F2] text-[#5B6578]">
                          <th className="py-2.5 px-3 font-semibold">Item Name</th>
                          <th className="py-2.5 px-3 font-semibold">Material</th>
                          <th className="py-2.5 px-3 font-semibold">Unit</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Total Inbound (IN)</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Total Outflow (OUT)</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Net Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E9F2] bg-white">
                        {invData?.items.map((item) => {
                          const isNetPositive = item.netChange > 0;
                          const isNetNegative = item.netChange < 0;
                          return (
                            <tr key={item.id} className="hover:bg-[#F6F8FC] transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-[#0B1633]">{item.name}</td>
                              <td className="py-2.5 px-3 text-[#5B6578]">{item.material}</td>
                              <td className="py-2.5 px-3 text-[#5B6578]">{item.unit}</td>
                              <td className="py-2.5 px-3 text-right font-medium text-[#0E9F6E]">
                                +{item.totalIn} {item.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium text-[#D92D20]">
                                -{item.totalOut} {item.unit}
                              </td>
                              <td
                                className={`py-2.5 px-3 text-right font-bold ${
                                  isNetPositive
                                    ? 'text-[#0E9F6E]'
                                    : isNetNegative
                                    ? 'text-[#D92D20]'
                                    : 'text-[#5B6578]'
                                }`}
                              >
                                {isNetPositive ? `+${item.netChange}` : item.netChange} {item.unit}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
