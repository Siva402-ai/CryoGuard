import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Menu, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TopbarProps {
  onMenuClick?: () => void;
  openAlertsCount?: number;
}

const PAGE_TITLES: Record<string, { title: string; breadcrumb: string }> = {
  '/': { title: 'Facility Overview', breadcrumb: 'Dashboard' },
  '/equipment': { title: 'Cryogenic Storage Units', breadcrumb: 'Storage Units' },
  '/alerts': { title: 'Facility Alerts & Telemetry', breadcrumb: 'Alerts' },
  '/maintenance': { title: 'Maintenance Schedules', breadcrumb: 'Maintenance' },
  '/inspections': { title: 'Safety Inspections', breadcrumb: 'Inspections' },
  '/inventory': { title: 'Bulk Material & Consumables', breadcrumb: 'Inventory' },
  '/reports': { title: 'Compliance & Telemetry Reports', breadcrumb: 'Reports' },
  '/users': { title: 'Users & Roles Administration', breadcrumb: 'Administration' },
};

export const Topbar: React.FC<TopbarProps> = ({ onMenuClick, openAlertsCount = 0 }) => {
  const { user } = useAuth();
  const location = useLocation();

  const pageInfo = PAGE_TITLES[location.pathname] || {
    title: 'CryoGuard System',
    breadcrumb: 'Operations',
  };

  return (
    <header className="sticky top-4 z-30 mx-4 md:mx-6 mb-6">
      <div className="h-16 px-6 bg-surface border border-border rounded-2xl shadow-topbar flex items-center justify-between">
        {/* Left: Mobile menu toggle + Title & Breadcrumb */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 rounded-xl text-muted hover:text-navy hover:bg-[#F3F5FA] lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
          </button>

          <div>
            <div className="flex items-center space-x-2 text-xs text-muted font-medium">
              <span>CryoGuard</span>
              <span>/</span>
              <span className="text-primary font-semibold">{pageInfo.breadcrumb}</span>
            </div>
            <h1 className="text-lg md:text-xl font-bold text-navy leading-tight">
              {pageInfo.title}
            </h1>
          </div>
        </div>

        {/* Right: Live Telemetry Indicator + Notification Bell + User Quick Tag */}
        <div className="flex items-center space-x-4">
          {/* Live Engine Indicator */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-status-success-bg text-status-success text-xs font-semibold border border-[#D0F0E4]">
            <Activity className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Telemetry Online</span>
          </div>

          {/* Alerts Bell Button */}
          <Link
            to="/alerts"
            className="relative p-2.5 rounded-xl text-muted hover:text-primary hover:bg-primary-soft transition-colors"
            title="View Alerts"
          >
            <Bell className="w-5 h-5" strokeWidth={1.75} />
            {openAlertsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-status-critical text-white text-[10px] font-bold leading-none shadow-sm">
                {openAlertsCount}
              </span>
            )}
          </Link>

          {/* User Tag */}
          <div className="hidden md:flex items-center space-x-2.5 pl-3 border-l border-border/80">
            <div className="text-right">
              <span className="block text-xs font-semibold text-navy leading-tight">{user?.name}</span>
              <span className="block text-[10px] text-muted capitalize">{user?.role?.toLowerCase()}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold text-xs">
              {user?.name?.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
