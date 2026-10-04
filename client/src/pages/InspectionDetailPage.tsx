import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  User,
  Calendar,
  FileText,
  Wrench,
  RefreshCw,
} from 'lucide-react';
import { getInspectionByIdApi } from '../api/inspections';
import { InspectionResult, InspectionItemResult } from '../types/inspection';

export const InspectionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inspection', id],
    queryFn: () => getInspectionByIdApi(id!),
    enabled: !!id,
  });

  const inspection = data?.inspection;

  const renderResultBadge = (result?: InspectionResult) => {
    switch (result) {
      case 'PASS':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-status-success-bg text-status-success">
            <ShieldCheck className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
            PASS — All Parameters Verified
          </span>
        );
      case 'NEEDS_ATTENTION':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-status-warning-bg text-status-warning">
            <AlertTriangle className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
            NEEDS ATTENTION — Non-Critical Defects Logged
          </span>
        );
      case 'FAIL':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-status-critical-bg text-status-critical">
            <ShieldAlert className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
            FAIL — Safety-Critical Defect Identified
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-28 bg-surface border border-border rounded-2xl animate-pulse" />
        <div className="h-72 bg-surface border border-border rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (isError || !inspection) {
    return (
      <div className="bg-surface border border-border rounded-2xl shadow-card p-12 text-center max-w-lg mx-auto">
        <AlertCircle className="w-10 h-10 text-status-critical mx-auto mb-2" />
        <h3 className="text-base font-bold text-navy">Inspection Record Not Found</h3>
        <p className="text-xs text-muted mt-1 mb-6">
          The requested safety audit document could not be retrieved from the database.
        </p>
        <div className="flex items-center justify-center space-x-3">
          <button
            onClick={() => navigate('/inspections')}
            className="h-10 px-5 rounded-full border border-border bg-white text-xs font-semibold text-text hover:text-navy"
          >
            Back to Audit Log
          </button>
          <button
            onClick={() => refetch()}
            className="h-10 px-5 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary-hover"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const resultsList = (Array.isArray(inspection.results) ? inspection.results : []) as InspectionItemResult[];
  const failedCount = resultsList.filter((r) => r.result === 'FAIL').length;
  const totalCount = resultsList.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-muted">
          <Link
            to="/inspections"
            className="inline-flex items-center space-x-1 font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Safety Inspections</span>
          </Link>
          <span>/</span>
          <span className="text-navy font-semibold">Report #{inspection.id.slice(0, 8)}</span>
        </div>

        <button
          onClick={() => refetch()}
          className="p-2 rounded-xl border border-border bg-surface text-muted hover:text-navy hover:bg-[#F3F5FA] transition-colors"
          title="Refresh report"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Header Card */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-3">
              <span className="font-mono text-base px-2.5 py-0.5 rounded-lg bg-primary-soft text-primary font-bold">
                {inspection.equipment?.code || 'TANK'}
              </span>
              <h2 className="text-2xl font-bold text-navy">{inspection.equipment?.name}</h2>
            </div>
            <p className="text-xs text-muted">
              {inspection.equipment?.material} Storage &bull; {inspection.equipment?.location} &bull; Protocol:{' '}
              <span className="font-semibold text-navy">{inspection.template?.name}</span>
            </p>
          </div>

          <div>{renderResultBadge(inspection.overall)}</div>
        </div>

        {/* Inspection Meta Information Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-xs">
          <div>
            <span className="text-muted block mb-1">Performed By</span>
            <div className="inline-flex items-center space-x-1.5 font-bold text-navy">
              <User className="w-3.5 h-3.5 text-primary" />
              <span>{inspection.inspector?.name || 'Staff Inspector'}</span>
            </div>
          </div>

          <div>
            <span className="text-muted block mb-1">Audit Timestamp</span>
            <div className="inline-flex items-center space-x-1.5 font-bold text-navy">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{new Date(inspection.performed_at).toLocaleDateString()}</span>
              <span className="font-normal text-muted">
                {new Date(inspection.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div>
            <span className="text-muted block mb-1">Checklist Score</span>
            <span
              className={`font-bold ${
                failedCount > 0 ? 'text-status-critical' : 'text-status-success'
              }`}
            >
              {totalCount - failedCount} of {totalCount} Passed ({failedCount} Defects)
            </span>
          </div>

          <div>
            <span className="text-muted block mb-1">Quick Link</span>
            <Link
              to={`/equipment/${inspection.equipment_id}`}
              className="font-semibold text-primary hover:underline inline-flex items-center space-x-1"
            >
              <span>View Unit Telemetry</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Checklist Breakdown Card */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-navy">Evaluated Checklist Items</h3>
          </div>
          <span className="text-xs text-muted font-medium">{resultsList.length} items logged</span>
        </div>

        <div className="space-y-3">
          {resultsList.map((resItem, idx) => {
            const isPass = resItem.result === 'PASS';
            const matchedTemplateItem = inspection.template?.items?.find((t) => t.label === resItem.item);
            const isCritical = matchedTemplateItem?.critical || false;

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition-all ${
                  !isPass
                    ? 'bg-status-critical-bg/20 border-status-critical/40'
                    : 'bg-[#F8FAFD] border-border'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start space-x-2.5">
                    <span className="font-mono text-xs font-bold text-muted mt-0.5">{idx + 1}.</span>
                    <div>
                      <span className="text-xs font-bold text-navy leading-relaxed block">
                        {resItem.item}
                      </span>
                      {isCritical && (
                        <span className="inline-block px-2 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-status-critical-bg text-status-critical mt-1">
                          Safety-Critical Check
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="self-start sm:self-center">
                    {isPass ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-status-success-bg text-status-success">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        PASS
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-status-critical-bg text-status-critical">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        FAIL
                      </span>
                    )}
                  </div>
                </div>

                {/* Defect Note */}
                {!isPass && resItem.note && (
                  <div className="mt-3 pt-3 border-t border-status-critical/20 text-xs">
                    <span className="font-bold text-status-critical block mb-0.5">Deficiency Finding:</span>
                    <p className="text-navy font-medium italic">"{resItem.note}"</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Findings and Corrective Actions Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Findings Card */}
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6">
          <div className="flex items-center space-x-2 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-bold text-navy">General Inspector Findings</h4>
          </div>
          {inspection.findings ? (
            <p className="text-xs text-navy leading-relaxed whitespace-pre-wrap">{inspection.findings}</p>
          ) : (
            <p className="text-xs text-muted italic">No additional general observations recorded.</p>
          )}
        </div>

        {/* Corrective Action Card */}
        <div
          className={`bg-surface border rounded-2xl shadow-card p-6 ${
            inspection.overall !== 'PASS'
              ? 'border-status-critical/40 bg-status-critical-bg/10'
              : 'border-border'
          }`}
        >
          <div className="flex items-center space-x-2 mb-3">
            <Wrench
              className={`w-4 h-4 ${
                inspection.overall !== 'PASS' ? 'text-status-critical' : 'text-primary'
              }`}
            />
            <h4 className="text-sm font-bold text-navy">Corrective Action Plan</h4>
          </div>
          {inspection.corrective_action ? (
            <p className="text-xs text-navy font-medium leading-relaxed whitespace-pre-wrap">
              {inspection.corrective_action}
            </p>
          ) : (
            <p className="text-xs text-muted italic">No corrective remedial action required for this audit.</p>
          )}
        </div>
      </div>
    </div>
  );
};
