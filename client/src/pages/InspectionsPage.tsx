import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Plus,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  User,
  Calendar,
  X,
  Trash2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  getInspectionsApi,
  getInspectionTemplatesApi,
  createInspectionApi,
  createInspectionTemplateApi,
} from '../api/inspections';
import { getEquipmentListApi } from '../api/equipment';
import {
  Inspection,
  InspectionTemplate,
  InspectionResult,
  TemplateItem,
  InspectionItemResult,
} from '../types/inspection';

export const InspectionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'history' | 'templates'>('history');

  // History Tab Filters & Pagination
  const [tankFilter, setTankFilter] = useState<string>('ALL');
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Modals state
  const [isNewInspectionOpen, setIsNewInspectionOpen] = useState(false);
  const [isNewTemplateOpen, setIsNewTemplateOpen] = useState(false);

  // New Inspection Form State
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [itemResponses, setItemResponses] = useState<Record<string, { result?: 'PASS' | 'FAIL'; note: string }>>({});
  const [findings, setFindings] = useState<string>('');
  const [correctiveAction, setCorrectiveAction] = useState<string>('');
  const [inspectionFormError, setInspectionFormError] = useState<string | null>(null);

  // New Template Form State
  const [templateName, setTemplateName] = useState<string>('');
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([
    { label: '', critical: false },
    { label: '', critical: false },
  ]);
  const [templateFormError, setTemplateFormError] = useState<string | null>(null);

  // 1. Fetch Inspections
  const {
    data: inspectionsData,
    isLoading: loadingInspections,
    isError: errorInspections,
    refetch: refetchInspections,
    isFetching: fetchingInspections,
  } = useQuery({
    queryKey: ['inspections', tankFilter, resultFilter, currentPage],
    queryFn: () =>
      getInspectionsApi({
        equipmentId: tankFilter,
        overall: resultFilter,
        page: currentPage,
        limit: pageSize,
      }),
  });

  // 2. Fetch Templates
  const {
    data: templatesData,
    isLoading: loadingTemplates,
    isError: errorTemplates,
  } = useQuery({
    queryKey: ['inspection-templates'],
    queryFn: getInspectionTemplatesApi,
  });

  // 3. Fetch Equipment list for dropdowns
  const { data: equipmentData } = useQuery({
    queryKey: ['equipment-list'],
    queryFn: getEquipmentListApi,
  });

  const inspections = inspectionsData?.inspections || [];
  const totalInspections = inspectionsData?.total || 0;
  const totalPages = inspectionsData?.totalPages || 1;
  const templates = templatesData?.templates || [];
  const tanks = equipmentData?.equipment || [];

  // Active template object when filling out new inspection
  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  // Compute live result badge for the inspection in progress
  const liveEvaluation = useMemo(() => {
    if (!activeTemplate || activeTemplate.items.length === 0) {
      return { status: 'INCOMPLETE', overall: null, message: 'Select a template to begin' };
    }

    const total = activeTemplate.items.length;
    const answeredCount = activeTemplate.items.filter((it) => itemResponses[it.label]?.result).length;

    if (answeredCount < total) {
      return {
        status: 'INCOMPLETE',
        overall: null,
        message: `Incomplete (${answeredCount} of ${total} answered)`,
      };
    }

    const failedItems = activeTemplate.items.filter(
      (it) => itemResponses[it.label]?.result === 'FAIL',
    );

    if (failedItems.length === 0) {
      return {
        status: 'COMPLETE',
        overall: 'PASS' as InspectionResult,
        message: 'PASS — All safety items verified nominal',
      };
    }

    const hasCritical = failedItems.some((it) => it.critical);
    if (hasCritical) {
      return {
        status: 'COMPLETE',
        overall: 'FAIL' as InspectionResult,
        message: 'FAIL — Critical safety threshold defect identified',
      };
    }

    return {
      status: 'COMPLETE',
      overall: 'NEEDS_ATTENTION' as InspectionResult,
      message: 'NEEDS ATTENTION — Non-critical defects require maintenance review',
    };
  }, [activeTemplate, itemResponses]);

  // Mutations
  const createInspectionMutation = useMutation({
    mutationFn: createInspectionApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setIsNewInspectionOpen(false);
      resetInspectionForm();
    },
    onError: (err: any) => {
      setInspectionFormError(
        err.response?.data?.message || err.response?.data?.error || 'Failed to submit inspection record.',
      );
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: createInspectionTemplateApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-templates'] });
      setIsNewTemplateOpen(false);
      resetTemplateForm();
    },
    onError: (err: any) => {
      setTemplateFormError(
        err.response?.data?.message || err.response?.data?.error || 'Failed to create inspection template.',
      );
    },
  });

  const resetInspectionForm = () => {
    setSelectedEquipmentId('');
    setSelectedTemplateId('');
    setItemResponses({});
    setFindings('');
    setCorrectiveAction('');
    setInspectionFormError(null);
  };

  const resetTemplateForm = () => {
    setTemplateName('');
    setTemplateItems([
      { label: '', critical: false },
      { label: '', critical: false },
    ]);
    setTemplateFormError(null);
  };

  const handleOpenNewInspection = () => {
    resetInspectionForm();
    if (tanks.length > 0) setSelectedEquipmentId(tanks[0].id);
    if (templates.length > 0) setSelectedTemplateId(templates[0].id);
    setIsNewInspectionOpen(true);
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setItemResponses({});
    setInspectionFormError(null);
  };

  const handleSetItemResult = (label: string, result: 'PASS' | 'FAIL') => {
    setItemResponses((prev) => ({
      ...prev,
      [label]: {
        ...prev[label],
        result,
        note: prev[label]?.note || '',
      },
    }));
    setInspectionFormError(null);
  };

  const handleSetItemNote = (label: string, note: string) => {
    setItemResponses((prev) => ({
      ...prev,
      [label]: {
        ...prev[label],
        note,
      },
    }));
  };

  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    setInspectionFormError(null);

    if (!selectedEquipmentId) {
      setInspectionFormError('Please select a storage unit.');
      return;
    }

    if (!activeTemplate) {
      setInspectionFormError('Please select an inspection template.');
      return;
    }

    // Check all items answered
    const unanswered = activeTemplate.items.filter((it) => !itemResponses[it.label]?.result);
    if (unanswered.length > 0) {
      setInspectionFormError(`Please answer all ${activeTemplate.items.length} checklist items.`);
      return;
    }

    // Check notes for failed items
    const failedWithoutNote = activeTemplate.items.find(
      (it) => itemResponses[it.label]?.result === 'FAIL' && !itemResponses[it.label]?.note?.trim(),
    );
    if (failedWithoutNote) {
      setInspectionFormError(`A note is required explaining the failure for: "${failedWithoutNote.label}".`);
      return;
    }

    // Check corrective action if any failed
    const hasFailures = activeTemplate.items.some((it) => itemResponses[it.label]?.result === 'FAIL');
    if (hasFailures && !correctiveAction.trim()) {
      setInspectionFormError('Corrective action is required when one or more items fail.');
      return;
    }

    const payloadResults: InspectionItemResult[] = activeTemplate.items.map((it) => ({
      item: it.label,
      result: itemResponses[it.label].result as 'PASS' | 'FAIL',
      note: itemResponses[it.label].note?.trim() || undefined,
    }));

    createInspectionMutation.mutate({
      equipment_id: selectedEquipmentId,
      template_id: activeTemplate.id,
      results: payloadResults,
      findings: findings.trim() || undefined,
      corrective_action: correctiveAction.trim() || undefined,
    });
  };

  // Template items dynamic rows management
  const handleAddTemplateItem = () => {
    setTemplateItems((prev) => [...prev, { label: '', critical: false }]);
  };

  const handleRemoveTemplateItem = (index: number) => {
    setTemplateItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateTemplateItem = (index: number, field: 'label' | 'critical', value: any) => {
    setTemplateItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)),
    );
  };

  const handleSubmitTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    setTemplateFormError(null);

    if (!templateName.trim()) {
      setTemplateFormError('Template name is required.');
      return;
    }

    const validItems = templateItems.filter((it) => it.label.trim().length > 0);
    if (validItems.length === 0) {
      setTemplateFormError('Please add at least one valid checklist item.');
      return;
    }

    createTemplateMutation.mutate({
      name: templateName.trim(),
      items: validItems.map((it) => ({ label: it.label.trim(), critical: it.critical })),
    });
  };

  const renderResultBadge = (result: InspectionResult) => {
    switch (result) {
      case 'PASS':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-status-success-bg text-status-success">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />
            PASS
          </span>
        );
      case 'NEEDS_ATTENTION':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-status-warning-bg text-status-warning">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />
            NEEDS ATTENTION
          </span>
        );
      case 'FAIL':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-status-critical-bg text-status-critical">
            <ShieldAlert className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />
            FAIL
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Safety & Compliance Inspections</h2>
          <p className="text-sm text-muted mt-0.5">
            Pressure vessel integrity checklists, regulatory safety protocols, and incident records
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Tab Switcher */}
          <div className="flex items-center bg-[#F3F5FA] p-1 rounded-full border border-border">
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all inline-flex items-center space-x-1.5 ${
                activeTab === 'history'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-navy'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Audit History</span>
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all inline-flex items-center space-x-1.5 ${
                activeTab === 'templates'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-navy'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Templates ({templates.length})</span>
            </button>
          </div>

          <button
            id="new-inspection-btn"
            onClick={handleOpenNewInspection}
            className="h-10 px-5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm inline-flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Inspection</span>
          </button>
        </div>
      </div>

      {/* TAB 1: HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Filters Bar Card */}
          <div className="bg-surface border border-border rounded-2xl shadow-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-muted uppercase tracking-wider">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter Inspection Log</span>
              </div>

              <button
                onClick={() => refetchInspections()}
                disabled={fetchingInspections}
                className="text-xs text-primary font-semibold hover:underline inline-flex items-center space-x-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${fetchingInspections ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Equipment Filter */}
              <div>
                <label htmlFor="equip-filter" className="block text-xs font-semibold text-navy mb-1.5">
                  Storage Unit
                </label>
                <select
                  id="equip-filter"
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
                      {tank.code} — {tank.name} ({tank.material})
                    </option>
                  ))}
                </select>
              </div>

              {/* Result Filter */}
              <div>
                <label htmlFor="result-filter" className="block text-xs font-semibold text-navy mb-1.5">
                  Inspection Outcome
                </label>
                <select
                  id="result-filter"
                  value={resultFilter}
                  onChange={(e) => {
                    setResultFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="PASS">PASS Only</option>
                  <option value="NEEDS_ATTENTION">Needs Attention</option>
                  <option value="FAIL">FAIL (Critical)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Inspections Table Card */}
          <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
            {loadingInspections ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-border/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : errorInspections ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-10 h-10 text-status-critical mx-auto mb-2" />
                <h3 className="text-base font-bold text-navy">Failed to load inspection records</h3>
                <p className="text-xs text-muted mt-1 mb-4">An error occurred while communicating with the server.</p>
                <button
                  onClick={() => refetchInspections()}
                  className="h-10 px-5 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary-hover"
                >
                  Retry
                </button>
              </div>
            ) : inspections.length === 0 ? (
              <div className="py-16 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-status-success-bg text-status-success flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-navy">No Inspection Records Found</h3>
                <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                  There are no safety inspection records matching the selected filter criteria.
                </p>
                <button
                  onClick={handleOpenNewInspection}
                  className="mt-4 h-9 px-4 rounded-full bg-primary text-white text-xs font-semibold inline-flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log First Inspection</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-[#F8FAFD] border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wider">
                      <th className="py-3.5 px-6">Date & Time</th>
                      <th className="py-3.5 px-4">Unit</th>
                      <th className="py-3.5 px-4">Protocol Template</th>
                      <th className="py-3.5 px-4">Inspector</th>
                      <th className="py-3.5 px-4">Outcome</th>
                      <th className="py-3.5 px-4">Checks Summary</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {inspections.map((insp: Inspection) => {
                      const resultsList = (Array.isArray(insp.results) ? insp.results : []) as InspectionItemResult[];
                      const failedCount = resultsList.filter((r) => r.result === 'FAIL').length;
                      const totalCount = resultsList.length;

                      return (
                        <tr key={insp.id} className="hover:bg-[#F8FAFD] transition-colors">
                          {/* Date */}
                          <td className="py-4 px-6 text-xs whitespace-nowrap">
                            <div className="font-semibold text-navy">
                              {new Date(insp.performed_at).toLocaleDateString()}
                            </div>
                            <div className="text-[11px] text-muted font-mono">
                              {new Date(insp.performed_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>

                          {/* Unit */}
                          <td className="py-4 px-4 font-bold text-navy whitespace-nowrap">
                            <Link
                              to={`/equipment/${insp.equipment_id}`}
                              className="text-primary hover:underline inline-flex items-center space-x-1"
                            >
                              <span>{insp.equipment?.code || 'TANK'}</span>
                            </Link>
                            <span className="text-xs text-muted block font-normal">{insp.equipment?.name}</span>
                          </td>

                          {/* Template */}
                          <td className="py-4 px-4 text-xs font-semibold text-navy max-w-xs truncate">
                            {insp.template?.name || 'Standard Inspection'}
                          </td>

                          {/* Inspector */}
                          <td className="py-4 px-4 text-xs text-navy whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1.5">
                              <User className="w-3.5 h-3.5 text-muted" />
                              <span className="font-medium">{insp.inspector?.name || 'Staff User'}</span>
                            </div>
                          </td>

                          {/* Outcome Badge */}
                          <td className="py-4 px-4 whitespace-nowrap">{renderResultBadge(insp.overall)}</td>

                          {/* Checks Summary */}
                          <td className="py-4 px-4 text-xs whitespace-nowrap">
                            {failedCount > 0 ? (
                              <span className="font-semibold text-status-critical">
                                {failedCount} of {totalCount} failed
                              </span>
                            ) : (
                              <span className="font-semibold text-status-success">
                                All {totalCount} checks passed
                              </span>
                            )}
                          </td>

                          {/* View Detail Action */}
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <button
                              onClick={() => navigate(`/inspections/${insp.id}`)}
                              className="h-8 px-3 rounded-lg bg-primary-soft hover:bg-primary/20 text-primary text-xs font-semibold transition-colors inline-flex items-center space-x-1"
                            >
                              <span>View Report</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Bar */}
            {totalInspections > 0 && (
              <div className="py-4 px-6 bg-[#F8FAFD] border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
                <div>
                  Showing <span className="font-semibold text-navy">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-semibold text-navy">
                    {Math.min(currentPage * pageSize, totalInspections)}
                  </span>{' '}
                  of <span className="font-semibold text-navy">{totalInspections}</span> inspection audits
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
      )}

      {/* TAB 2: TEMPLATES TAB */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-navy">Active Inspection Checklists</h3>
              <p className="text-xs text-muted">Standard Operating Procedure templates used by technicians during inspections</p>
            </div>

            <button
              id="new-template-btn"
              onClick={() => {
                resetTemplateForm();
                setIsNewTemplateOpen(true);
              }}
              className="h-9 px-4 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm inline-flex items-center space-x-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Template</span>
            </button>
          </div>

          {loadingTemplates ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-56 bg-surface border border-border rounded-2xl animate-pulse" />
              <div className="h-56 bg-surface border border-border rounded-2xl animate-pulse" />
            </div>
          ) : errorTemplates ? (
            <div className="p-8 text-center bg-surface border border-border rounded-2xl">
              <AlertCircle className="w-8 h-8 text-status-critical mx-auto mb-2" />
              <p className="text-sm font-semibold text-navy">Failed to load templates</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {templates.map((tpl: InspectionTemplate) => {
                const critCount = tpl.items.filter((it) => it.critical).length;
                return (
                  <div
                    key={tpl.id}
                    className="bg-surface border border-border rounded-2xl shadow-card p-6 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h4 className="text-base font-bold text-navy">{tpl.name}</h4>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-soft text-primary whitespace-nowrap">
                          {tpl.items.length} items
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        {tpl.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="text-xs p-2.5 rounded-xl bg-[#F8FAFD] border border-border/80 flex items-center justify-between gap-2"
                          >
                            <span className="text-navy font-medium leading-relaxed">{item.label}</span>
                            {item.critical ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-status-critical-bg text-status-critical whitespace-nowrap">
                                Critical
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#E5E9F2] text-muted whitespace-nowrap">
                                Standard
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
                      <span>{critCount} safety-critical parameters</span>
                      <button
                        onClick={() => {
                          handleOpenNewInspection();
                          setSelectedTemplateId(tpl.id);
                        }}
                        className="text-primary font-semibold hover:underline inline-flex items-center space-x-1"
                      >
                        <span>Use This Template</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: NEW INSPECTION AUDIT FORM */}
      {isNewInspectionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-navy">Execute Safety Inspection</h3>
                  <p className="text-xs text-muted">Submit official equipment compliance and safety evaluation</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewInspectionOpen(false)}
                className="p-2 rounded-xl text-muted hover:text-navy hover:bg-[#F3F5FA] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Scroll Area */}
            <form onSubmit={handleSubmitInspection} className="space-y-6 pt-5 overflow-y-auto pr-1 flex-grow">
              {inspectionFormError && (
                <div className="p-3.5 rounded-xl bg-status-critical-bg text-status-critical text-xs font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{inspectionFormError}</span>
                </div>
              )}

              {/* Unit & Template Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modal-tank-select" className="block text-xs font-semibold text-navy mb-1.5">
                    Storage Unit <span className="text-status-critical">*</span>
                  </label>
                  <select
                    id="modal-tank-select"
                    value={selectedEquipmentId}
                    onChange={(e) => setSelectedEquipmentId(e.target.value)}
                    required
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {tanks.map((tank) => (
                      <option key={tank.id} value={tank.id}>
                        {tank.code} — {tank.name} ({tank.material})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="modal-tpl-select" className="block text-xs font-semibold text-navy mb-1.5">
                    Inspection Template <span className="text-status-critical">*</span>
                  </label>
                  <select
                    id="modal-tpl-select"
                    value={selectedTemplateId}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    required
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name} ({tpl.items.length} checks)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Outcome Banner */}
              <div
                id="live-evaluation-banner"
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                  liveEvaluation.overall === 'PASS'
                    ? 'bg-status-success-bg/60 border-status-success/30 text-status-success'
                    : liveEvaluation.overall === 'FAIL'
                    ? 'bg-status-critical-bg/60 border-status-critical/30 text-status-critical'
                    : liveEvaluation.overall === 'NEEDS_ATTENTION'
                    ? 'bg-status-warning-bg/60 border-status-warning/30 text-status-warning'
                    : 'bg-[#F8FAFD] border-border text-muted'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {liveEvaluation.overall === 'PASS' ? (
                    <ShieldCheck className="w-4 h-4 font-bold" />
                  ) : liveEvaluation.overall === 'FAIL' ? (
                    <ShieldAlert className="w-4 h-4 font-bold" />
                  ) : liveEvaluation.overall === 'NEEDS_ATTENTION' ? (
                    <AlertTriangle className="w-4 h-4 font-bold" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                  <span className="font-bold">{liveEvaluation.message}</span>
                </div>

                {liveEvaluation.overall && renderResultBadge(liveEvaluation.overall)}
              </div>

              {/* Checklist Items Breakdown */}
              {activeTemplate && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-navy uppercase tracking-wider block">
                    Checklist Items ({activeTemplate.items.length})
                  </span>

                  <div className="space-y-3">
                    {activeTemplate.items.map((item, idx) => {
                      const response = itemResponses[item.label] || { note: '' };
                      const isFail = response.result === 'FAIL';
                      const isPass = response.result === 'PASS';

                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border transition-all ${
                            isFail
                              ? 'bg-status-critical-bg/20 border-status-critical/40'
                              : isPass
                              ? 'bg-status-success-bg/15 border-status-success/30'
                              : 'bg-[#F8FAFD] border-border'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start space-x-2">
                              <span className="font-mono text-xs font-bold text-muted mt-0.5">{idx + 1}.</span>
                              <div>
                                <span className="text-xs font-bold text-navy leading-relaxed block">
                                  {item.label}
                                </span>
                                {item.critical && (
                                  <span className="inline-block px-2 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-status-critical-bg text-status-critical mt-1">
                                    Safety-Critical
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Pass / Fail Segmented Control */}
                            <div className="inline-flex rounded-xl p-1 bg-white border border-border shadow-xs self-start sm:self-center">
                              <button
                                type="button"
                                onClick={() => handleSetItemResult(item.label, 'PASS')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-1 ${
                                  isPass
                                    ? 'bg-status-success text-white shadow-sm'
                                    : 'text-muted hover:text-navy'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Pass</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetItemResult(item.label, 'FAIL')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-1 ${
                                  isFail
                                    ? 'bg-status-critical text-white shadow-sm'
                                    : 'text-muted hover:text-navy'
                                }`}
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Fail</span>
                              </button>
                            </div>
                          </div>

                          {/* Fail Note Field (Required if Fail) */}
                          {isFail && (
                            <div className="mt-3 pt-3 border-t border-status-critical/20">
                              <label
                                htmlFor={`note-${idx}`}
                                className="block text-[11px] font-bold text-status-critical mb-1"
                              >
                                Deficiency Observation / Failure Reason <span className="text-status-critical">*</span>
                              </label>
                              <input
                                id={`note-${idx}`}
                                type="text"
                                value={response.note}
                                onChange={(e) => handleSetItemNote(item.label, e.target.value)}
                                placeholder="State exact finding (e.g. pressure relief valve seal cracked)"
                                required
                                className="w-full h-9 px-3 rounded-lg border border-status-critical/40 bg-white text-xs font-medium text-navy focus:outline-none focus:ring-2 focus:ring-status-critical/30"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Findings (Optional) */}
              <div>
                <label htmlFor="inspection-findings" className="block text-xs font-semibold text-navy mb-1.5">
                  General Findings & Observations (Optional)
                </label>
                <textarea
                  id="inspection-findings"
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="Record overall observations, ambient yard conditions, or technician notes..."
                  rows={2}
                  className="w-full p-3 rounded-xl border border-border bg-surface text-xs font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Corrective Action (Required if any failed) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="inspection-corrective" className="text-xs font-semibold text-navy">
                    Corrective Action Plan
                  </label>
                  {liveEvaluation.overall && liveEvaluation.overall !== 'PASS' && (
                    <span className="text-[11px] font-bold text-status-critical">Required (Defect Logged)</span>
                  )}
                </div>
                <textarea
                  id="inspection-corrective"
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  placeholder={
                    liveEvaluation.overall && liveEvaluation.overall !== 'PASS'
                      ? 'Specify mandatory remedial action taken or work order assigned...'
                      : 'Recommended follow-up actions (if any)...'
                  }
                  rows={2}
                  required={liveEvaluation.overall !== null && liveEvaluation.overall !== 'PASS'}
                  className={`w-full p-3 rounded-xl border text-xs font-medium text-navy focus:outline-none focus:ring-2 ${
                    liveEvaluation.overall && liveEvaluation.overall !== 'PASS'
                      ? 'border-status-critical/50 focus:ring-status-critical/30 bg-status-critical-bg/10'
                      : 'border-border bg-surface focus:ring-primary/30'
                  }`}
                />
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-border flex items-center justify-end space-x-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewInspectionOpen(false)}
                  className="h-10 px-5 rounded-full border border-border text-xs font-semibold text-text hover:text-navy hover:bg-[#F3F5FA] transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="submit-inspection-btn"
                  type="submit"
                  disabled={createInspectionMutation.isPending || liveEvaluation.status !== 'COMPLETE'}
                  className="h-10 px-6 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-1.5"
                >
                  {createInspectionMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording Audit...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Submit Official Record</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NEW TEMPLATE FORM */}
      {isNewTemplateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl max-w-xl w-full p-6 sm:p-8 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-border flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent-soft text-teal flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-navy">Create Inspection Protocol</h3>
                  <p className="text-xs text-muted">Build a standardized SOP checklist template</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewTemplateOpen(false)}
                className="p-2 rounded-xl text-muted hover:text-navy hover:bg-[#F3F5FA] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTemplate} className="space-y-5 pt-5 overflow-y-auto pr-1 flex-grow">
              {templateFormError && (
                <div className="p-3.5 rounded-xl bg-status-critical-bg text-status-critical text-xs font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{templateFormError}</span>
                </div>
              )}

              <div>
                <label htmlFor="tpl-name-input" className="block text-xs font-semibold text-navy mb-1.5">
                  Template Protocol Name <span className="text-status-critical">*</span>
                </label>
                <input
                  id="tpl-name-input"
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Weekly Vaporizer & Manifold Pressure Integrity"
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-navy uppercase tracking-wider">
                    Checklist Items ({templateItems.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTemplateItem}
                    className="text-xs text-primary font-semibold hover:underline inline-flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {templateItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#F8FAFD] border border-border flex items-center gap-3"
                    >
                      <span className="text-xs font-mono font-bold text-muted w-4">{idx + 1}.</span>
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => handleUpdateTemplateItem(idx, 'label', e.target.value)}
                        placeholder="Checklist parameter description..."
                        required
                        className="flex-grow h-9 px-3 rounded-lg border border-border bg-white text-xs font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />

                      <label className="flex items-center space-x-1.5 cursor-pointer whitespace-nowrap text-xs font-semibold text-navy">
                        <input
                          type="checkbox"
                          checked={item.critical}
                          onChange={(e) => handleUpdateTemplateItem(idx, 'critical', e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary/30"
                        />
                        <span>Critical</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleRemoveTemplateItem(idx)}
                        disabled={templateItems.length <= 1}
                        className="p-1.5 rounded-lg text-muted hover:text-status-critical hover:bg-white transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end space-x-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewTemplateOpen(false)}
                  className="h-10 px-5 rounded-full border border-border text-xs font-semibold text-text hover:text-navy hover:bg-[#F3F5FA] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTemplateMutation.isPending}
                  className="h-10 px-6 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 inline-flex items-center space-x-1.5"
                >
                  {createTemplateMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Create Template</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
