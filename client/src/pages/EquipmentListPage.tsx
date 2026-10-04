import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getEquipmentListApi,
  createEquipmentApi,
  updateEquipmentApi,
  deleteEquipmentApi,
} from '../api/equipment';
import { Equipment, CreateEquipmentDto, MaterialType, EquipmentStatus } from '../types/equipment';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Flame,
  PowerOff,
  X,
  Container,
} from 'lucide-react';

interface MaterialThresholdConfig {
  temp_warn_c: number;
  temp_crit_c: number;
  pressure_warn_bar: number;
  pressure_crit_bar: number;
  level_warn_pct: number;
  level_crit_pct: number;
}

const MATERIAL_DEFAULTS: Record<MaterialType, MaterialThresholdConfig> = {
  LN2: {
    temp_warn_c: -190.0,
    temp_crit_c: -185.0,
    pressure_warn_bar: 1.8,
    pressure_crit_bar: 2.2,
    level_warn_pct: 30.0,
    level_crit_pct: 15.0,
  },
  LOX: {
    temp_warn_c: -180.0,
    temp_crit_c: -175.0,
    pressure_warn_bar: 1.8,
    pressure_crit_bar: 2.2,
    level_warn_pct: 30.0,
    level_crit_pct: 15.0,
  },
  ARGON: {
    temp_warn_c: -183.0,
    temp_crit_c: -178.0,
    pressure_warn_bar: 1.8,
    pressure_crit_bar: 2.2,
    level_warn_pct: 30.0,
    level_crit_pct: 15.0,
  },
};

export const EquipmentListPage: React.FC = () => {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [materialFilter, setMaterialFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [deletingEquipment, setDeletingEquipment] = useState<Equipment | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CreateEquipmentDto>({
    code: '',
    name: '',
    material: 'LN2',
    capacity_l: 10000,
    location: '',
    temp_warn_c: -190.0,
    temp_crit_c: -185.0,
    pressure_warn_bar: 1.8,
    pressure_crit_bar: 2.2,
    level_warn_pct: 30.0,
    level_crit_pct: 15.0,
    status: 'NORMAL',
  });

  const fetchEquipment = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEquipmentListApi();
      setEquipmentList(data.equipment);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to load cryogenic storage units.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipment();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      code: '',
      name: '',
      material: 'LN2',
      capacity_l: 10000,
      location: 'Bay A - North Yard',
      ...MATERIAL_DEFAULTS.LN2,
      status: 'NORMAL',
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (eq: Equipment) => {
    setEditingEquipment(eq);
    setFormData({
      code: eq.code,
      name: eq.name,
      material: eq.material,
      capacity_l: eq.capacity_l,
      location: eq.location,
      temp_warn_c: eq.temp_warn_c,
      temp_crit_c: eq.temp_crit_c,
      pressure_warn_bar: eq.pressure_warn_bar,
      pressure_crit_bar: eq.pressure_crit_bar,
      level_warn_pct: eq.level_warn_pct,
      level_crit_pct: eq.level_crit_pct,
      status: eq.status,
    });
    setFormError(null);
  };

  const handleMaterialChange = (mat: MaterialType) => {
    const defaults = MATERIAL_DEFAULTS[mat];
    setFormData((prev) => ({
      ...prev,
      material: mat,
      ...defaults,
    }));
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setActionLoading(true);

    try {
      if (editingEquipment) {
        await updateEquipmentApi(editingEquipment.id, formData);
        setEditingEquipment(null);
      } else {
        await createEquipmentApi(formData);
        setIsAddModalOpen(false);
      }
      await fetchEquipment();
    } catch (err: any) {
      setFormError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to save storage unit record.',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEquipment) return;
    setActionLoading(true);
    setFormError(null);

    try {
      await deleteEquipmentApi(deletingEquipment.id);
      setDeletingEquipment(null);
      await fetchEquipment();
    } catch (err: any) {
      setFormError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to delete storage unit.',
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Filter Logic
  const filteredList = equipmentList.filter((eq) => {
    const matchesSearch =
      eq.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMaterial = materialFilter === 'ALL' || eq.material === materialFilter;
    const matchesStatus = statusFilter === 'ALL' || eq.status === statusFilter;
    return matchesSearch && matchesMaterial && matchesStatus;
  });

  const renderStatusBadge = (status: EquipmentStatus) => {
    switch (status) {
      case 'NORMAL':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-status-success-bg text-status-success">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
            NORMAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-status-warning-bg text-status-warning">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
            WARNING
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-status-critical-bg text-status-critical">
            <Flame className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
            CRITICAL
          </span>
        );
      case 'OFFLINE':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-status-neutral-bg text-status-neutral">
            <PowerOff className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
            OFFLINE
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-primary uppercase tracking-wider block mb-1">
            Cryogenic Storage Infrastructure
          </span>
          <h2 className="text-2xl font-bold text-navy">Storage Units & Telemetry</h2>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Real-time bulk tank telemetry, operating thresholds, and pressure vessel units.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <button
            onClick={fetchEquipment}
            disabled={loading}
            className="h-11 px-4 rounded-full bg-white border border-border hover:bg-[#F3F5FA] text-text text-sm font-semibold transition-colors flex items-center space-x-2 shadow-sm"
            title="Refresh equipment list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            <span className="hidden md:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="h-11 px-5 rounded-full bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors flex items-center space-x-2 shadow-sm"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            <span>Add storage unit</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code, name, location..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-white text-sm text-text placeholder-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          {/* Material Filter */}
          <div className="flex items-center space-x-2 flex-1 md:flex-initial">
            <Filter className="w-4 h-4 text-muted flex-shrink-0" strokeWidth={1.75} />
            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="h-11 px-3 rounded-xl border border-border bg-white text-xs font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="ALL">All Materials</option>
              <option value="LN2">Liquid Nitrogen (LN2)</option>
              <option value="LOX">Liquid Oxygen (LOX)</option>
              <option value="ARGON">Liquid Argon (ARGON)</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 px-3 rounded-xl border border-border bg-white text-xs font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="ALL">All Statuses</option>
            <option value="NORMAL">NORMAL</option>
            <option value="WARNING">WARNING</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="OFFLINE">OFFLINE</option>
          </select>
        </div>
      </div>

      {/* Equipment Table Card */}
      <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted font-medium">Loading cryogenic equipment telemetry...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-status-critical-bg text-status-critical flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" strokeWidth={2} />
            </div>
            <h3 className="text-base font-bold text-navy">Failed to load equipment</h3>
            <p className="text-xs text-muted mt-1 max-w-md mx-auto">{error}</p>
            <button
              onClick={fetchEquipment}
              className="mt-4 h-10 px-5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto mb-3">
              <Container className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h3 className="text-base font-bold text-navy">No storage units found</h3>
            <p className="text-xs text-muted mt-1">
              {searchQuery || materialFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No units match your search or filter criteria.'
                : 'No cryogenic tanks have been configured yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFD] border-b border-border">
                  <th className="py-3.5 px-5 text-[12px] font-semibold text-muted uppercase tracking-wider">
                    Unit / Code
                  </th>
                  <th className="py-3.5 px-4 text-[12px] font-semibold text-muted uppercase tracking-wider">
                    Material
                  </th>
                  <th className="py-3.5 px-4 text-[12px] font-semibold text-muted uppercase tracking-wider">
                    Location
                  </th>
                  <th className="py-3.5 px-4 text-[12px] font-semibold text-muted uppercase tracking-wider text-right">
                    Capacity
                  </th>
                  <th className="py-3.5 px-4 text-[12px] font-semibold text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="py-3.5 px-4 text-[12px] font-semibold text-muted uppercase tracking-wider text-right">
                    Temperature
                  </th>
                  <th className="py-3.5 px-4 text-[12px] font-semibold text-muted uppercase tracking-wider text-right">
                    Pressure
                  </th>
                  <th className="py-3.5 px-4 text-[12px] font-semibold text-muted uppercase tracking-wider text-right">
                    Level
                  </th>
                  <th className="py-3.5 px-5 text-[12px] font-semibold text-muted uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredList.map((eq) => {
                  const reading = eq.latestReading;
                  return (
                    <tr key={eq.id} className="h-14 hover:bg-[#F8FAFD] transition-colors">
                      <td className="py-3 px-5">
                        <Link
                          to={`/equipment/${eq.id}`}
                          className="group flex items-center space-x-2.5 font-semibold text-navy hover:text-primary transition-colors"
                        >
                          <span className="font-mono text-sm px-2 py-0.5 rounded bg-primary-soft text-primary font-bold">
                            {eq.code}
                          </span>
                          <span className="text-sm text-navy group-hover:underline">{eq.name}</span>
                        </Link>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#F0F3F9] text-navy">
                          {eq.material}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-muted truncate max-w-[140px]">
                        {eq.location}
                      </td>

                      <td className="py-3 px-4 text-xs font-semibold text-navy text-right font-mono">
                        {eq.capacity_l.toLocaleString()} L
                      </td>

                      <td className="py-3 px-4">{renderStatusBadge(eq.status)}</td>

                      <td className="py-3 px-4 text-right">
                        {reading ? (
                          <span className="font-mono text-xs font-semibold text-navy">
                            {reading.temperature_c.toFixed(1)}°C
                          </span>
                        ) : (
                          <span className="text-xs text-muted">--</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {reading ? (
                          <span className="font-mono text-xs font-semibold text-navy">
                            {reading.pressure_bar.toFixed(2)} bar
                          </span>
                        ) : (
                          <span className="text-xs text-muted">--</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {reading ? (
                          <div className="flex items-center justify-end space-x-2">
                            <span className="font-mono text-xs font-semibold text-navy">
                              {reading.level_pct.toFixed(1)}%
                            </span>
                            <div className="w-12 bg-[#EEF1F6] rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  reading.level_pct <= eq.level_crit_pct
                                    ? 'bg-status-critical'
                                    : reading.level_pct <= eq.level_warn_pct
                                    ? 'bg-status-warning'
                                    : 'bg-primary'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, reading.level_pct))}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">--</span>
                        )}
                      </td>

                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <Link
                            to={`/equipment/${eq.id}`}
                            className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary-soft transition-colors"
                            title="View trend telemetry"
                          >
                            <ExternalLink className="w-4 h-4" strokeWidth={1.75} />
                          </Link>

                          <button
                            onClick={() => handleOpenEdit(eq)}
                            className="p-1.5 rounded-lg text-muted hover:text-navy hover:bg-[#F3F5FA] transition-colors"
                            title="Edit thresholds & unit"
                          >
                            <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                          </button>

                          <button
                            onClick={() => {
                              setDeletingEquipment(eq);
                              setFormError(null);
                            }}
                            className="p-1.5 rounded-lg text-muted hover:text-status-critical hover:bg-status-critical-bg transition-colors"
                            title="Delete unit"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Equipment Modal */}
      {(isAddModalOpen || editingEquipment) && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl max-w-2xl w-full p-6 md:p-8 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingEquipment(null);
              }}
              className="absolute top-6 right-6 p-2 rounded-xl text-muted hover:text-navy hover:bg-[#F3F5FA]"
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>

            <div className="mb-6">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider block mb-1">
                {editingEquipment ? 'Modify Vessel Configuration' : 'Register New Storage Vessel'}
              </span>
              <h3 className="text-xl font-bold text-navy">
                {editingEquipment ? `Edit ${editingEquipment.code}` : 'Add Cryogenic Storage Unit'}
              </h3>
            </div>

            {formError && (
              <div className="mb-4 p-3.5 rounded-xl bg-status-critical-bg border border-rose-200 text-status-critical text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEquipment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Unit code</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. C-007"
                    className="w-full h-11 px-3.5 rounded-xl border border-border text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Unit name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Reserve Tank 3"
                    className="w-full h-11 px-3.5 rounded-xl border border-border text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Cryogenic material</label>
                  <select
                    value={formData.material}
                    onChange={(e) => handleMaterialChange(e.target.value as MaterialType)}
                    className="w-full h-11 px-3 rounded-xl border border-border text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="LN2">Liquid Nitrogen (LN2)</option>
                    <option value="LOX">Liquid Oxygen (LOX)</option>
                    <option value="ARGON">Liquid Argon (ARGON)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Capacity (Liters)</label>
                  <input
                    type="number"
                    required
                    min="100"
                    value={formData.capacity_l}
                    onChange={(e) => setFormData({ ...formData, capacity_l: parseFloat(e.target.value) || 0 })}
                    className="w-full h-11 px-3.5 rounded-xl border border-border text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-navy mb-1">Facility location</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Yard 2 - Pad C"
                    className="w-full h-11 px-3.5 rounded-xl border border-border text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* Thresholds Section */}
              <div className="pt-3 border-t border-border">
                <span className="text-xs font-bold text-navy uppercase tracking-wider block mb-3">
                  Safety & Telemetry Thresholds
                </span>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-[#F8FAFD] rounded-xl border border-border">
                    <span className="text-[11px] font-semibold text-muted block mb-1">Temp Warn (°C)</span>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={formData.temp_warn_c}
                      onChange={(e) => setFormData({ ...formData, temp_warn_c: parseFloat(e.target.value) })}
                      className="w-full h-9 px-2.5 rounded-lg border border-border text-xs font-mono font-bold bg-white"
                    />
                  </div>

                  <div className="p-3 bg-[#F8FAFD] rounded-xl border border-border">
                    <span className="text-[11px] font-semibold text-muted block mb-1">Temp Crit (°C)</span>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={formData.temp_crit_c}
                      onChange={(e) => setFormData({ ...formData, temp_crit_c: parseFloat(e.target.value) })}
                      className="w-full h-9 px-2.5 rounded-lg border border-border text-xs font-mono font-bold bg-white text-status-critical"
                    />
                  </div>

                  <div className="p-3 bg-[#F8FAFD] rounded-xl border border-border">
                    <span className="text-[11px] font-semibold text-muted block mb-1">Pressure Warn (bar)</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.pressure_warn_bar}
                      onChange={(e) => setFormData({ ...formData, pressure_warn_bar: parseFloat(e.target.value) })}
                      className="w-full h-9 px-2.5 rounded-lg border border-border text-xs font-mono font-bold bg-white"
                    />
                  </div>

                  <div className="p-3 bg-[#F8FAFD] rounded-xl border border-border">
                    <span className="text-[11px] font-semibold text-muted block mb-1">Pressure Crit (bar)</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.pressure_crit_bar}
                      onChange={(e) => setFormData({ ...formData, pressure_crit_bar: parseFloat(e.target.value) })}
                      className="w-full h-9 px-2.5 rounded-lg border border-border text-xs font-mono font-bold bg-white text-status-critical"
                    />
                  </div>

                  <div className="p-3 bg-[#F8FAFD] rounded-xl border border-border">
                    <span className="text-[11px] font-semibold text-muted block mb-1">Level Warn (%)</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      required
                      value={formData.level_warn_pct}
                      onChange={(e) => setFormData({ ...formData, level_warn_pct: parseFloat(e.target.value) })}
                      className="w-full h-9 px-2.5 rounded-lg border border-border text-xs font-mono font-bold bg-white"
                    />
                  </div>

                  <div className="p-3 bg-[#F8FAFD] rounded-xl border border-border">
                    <span className="text-[11px] font-semibold text-muted block mb-1">Level Crit (%)</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      required
                      value={formData.level_crit_pct}
                      onChange={(e) => setFormData({ ...formData, level_crit_pct: parseFloat(e.target.value) })}
                      className="w-full h-9 px-2.5 rounded-lg border border-border text-xs font-mono font-bold bg-white text-status-critical"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingEquipment(null);
                  }}
                  className="h-11 px-5 rounded-full bg-white border border-border hover:bg-[#F3F5FA] text-text text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="h-11 px-6 rounded-full bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors disabled:opacity-70 shadow-sm"
                >
                  {actionLoading ? 'Saving...' : editingEquipment ? 'Update unit' : 'Register unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingEquipment && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="w-12 h-12 rounded-full bg-status-critical-bg text-status-critical flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" strokeWidth={2} />
            </div>

            <h3 className="text-lg font-bold text-navy mb-1">
              Delete Unit {deletingEquipment.code}?
            </h3>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              Are you sure you want to remove <span className="font-semibold text-navy">{deletingEquipment.name}</span>?
              If operational inspection or maintenance records depend on this unit, deletion will be safely rejected.
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-status-critical-bg border border-rose-200 text-status-critical text-xs">
                {formError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingEquipment(null)}
                className="h-10 px-4 rounded-full bg-white border border-border hover:bg-[#F3F5FA] text-text text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteConfirm}
                className="h-10 px-5 rounded-full bg-status-critical hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-70"
              >
                {actionLoading ? 'Deleting...' : 'Confirm deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
