import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Container, Bell, Wrench, ShieldCheck, Activity, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 mb-1.5">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                user?.role === 'ADMIN'
                  ? 'bg-primary-soft text-primary'
                  : 'bg-status-success-bg text-status-success'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
              {user?.role === 'ADMIN' ? 'Facility Manager (ADMIN)' : 'Operations Technician (STAFF)'}
            </span>
            <span className="text-xs text-muted font-medium">Session Authenticated</span>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-navy">
            Welcome back, {user?.name}
          </h2>
          <p className="text-sm text-muted mt-1 max-w-2xl">
            Cryogenic storage infrastructure is currently operating within nominal parameters. Telemetry ingestion is active.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/equipment"
            className="h-11 px-5 rounded-full bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors flex items-center space-x-2 shadow-sm"
          >
            <Container className="w-4 h-4" strokeWidth={2} />
            <span>View Storage Units</span>
          </Link>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6 flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Active Vessels
            </span>
            <span className="text-3xl font-bold text-navy block">6</span>
            <span className="text-xs text-status-success font-medium mt-2 inline-flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
              All units online
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center flex-shrink-0">
            <Container className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl shadow-card p-6 flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Open Alerts
            </span>
            <span className="text-3xl font-bold text-navy block">0</span>
            <span className="text-xs text-status-success font-medium mt-2 inline-flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
              No active warnings
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-status-success-bg text-status-success flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl shadow-card p-6 flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Pending Tasks
            </span>
            <span className="text-3xl font-bold text-navy block">0</span>
            <span className="text-xs text-muted font-medium mt-2 inline-flex items-center">
              Preventive maintenance
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-status-info-bg text-status-info flex items-center justify-center flex-shrink-0">
            <Wrench className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl shadow-card p-6 flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Telemetry Status
            </span>
            <span className="text-3xl font-bold text-navy block">100%</span>
            <span className="text-xs text-status-success font-medium mt-2 inline-flex items-center">
              <Activity className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
              Redis & PostgreSQL up
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-accent-soft text-teal flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </div>
      </div>

      {/* Overview Card: System Status & Information */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-6 md:p-8">
        <div className="flex items-center justify-between mb-4 border-b border-border/80 pb-4">
          <div>
            <h3 className="text-lg font-bold text-navy">Authentication & Role Scope Verified</h3>
            <p className="text-xs text-muted mt-0.5">
              Current user permissions and accessibility tier
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              user?.role === 'ADMIN'
                ? 'bg-primary-soft text-primary'
                : 'bg-status-success-bg text-status-success'
            }`}
          >
            Role: {user?.role}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[#F8FAFD] border border-border/70">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Active Account
            </span>
            <p className="text-sm font-semibold text-navy">{user?.name}</p>
            <p className="text-xs text-muted mt-0.5">{user?.email}</p>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFD] border border-border/70">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Authorized Modules
            </span>
            <p className="text-xs text-text">
              {user?.role === 'ADMIN'
                ? 'All 8 Facility Modules: Dashboard, Storage Units, Alerts, Maintenance, Safety Inspections, Inventory, Reports, Users & Roles (ADMIN)'
                : 'All 7 Operational Modules: Dashboard, Storage Units, Alerts, Maintenance, Safety Inspections, Inventory, Reports (Users & Roles restricted)'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
