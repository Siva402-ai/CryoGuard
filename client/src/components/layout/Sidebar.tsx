import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Container,
  Bell,
  Wrench,
  ClipboardCheck,
  Package,
  BarChart3,
  Users,
  LogOut,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  openAlertsCount?: number;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  openAlertsCount = 0,
  mobileOpen = false,
  setMobileOpen,
}) => {
  const { user, isAdmin, logout } = useAuth();

  const handleNavClick = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'CG';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen && setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[264px] bg-surface border-r border-border flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Top: Logo & Branding */}
        <div>
          <div className="h-20 flex items-center px-6 border-b border-border/60">
            <div className="flex items-center space-x-3">
              {/* Logo Mark: Blue-to-teal gradient ring */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-teal flex items-center justify-center shadow-sm">
                <svg
                  className="w-6 h-6 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3v18" />
                  <path d="M3 12h18" />
                  <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" />
                </svg>
              </div>

              <div>
                <span className="text-xl font-bold tracking-tight text-navy block leading-tight">
                  Cryo<span className="bg-gradient-to-r from-primary to-teal bg-clip-text text-transparent">Guard</span>
                </span>
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                  Facility Control
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-170px)]">
            {/* Group 1: Operations */}
            <div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider px-3 mb-2 block">
                Operations
              </span>
              <ul className="space-y-1">
                <li>
                  <NavLink
                    to="/"
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3.5 h-11 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-soft text-primary font-semibold'
                          : 'text-text hover:bg-[#F3F5FA] hover:text-navy'
                      }`
                    }
                  >
                    <LayoutDashboard className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                    <span>Dashboard</span>
                  </NavLink>
                </li>

                <li>
                  <NavLink
                    to="/equipment"
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3.5 h-11 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-soft text-primary font-semibold'
                          : 'text-text hover:bg-[#F3F5FA] hover:text-navy'
                      }`
                    }
                  >
                    <Container className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                    <span>Storage Units</span>
                  </NavLink>
                </li>

                <li>
                  <NavLink
                    to="/alerts"
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3.5 h-11 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-soft text-primary font-semibold'
                          : 'text-text hover:bg-[#F3F5FA] hover:text-navy'
                      }`
                    }
                  >
                    <div className="flex items-center space-x-3">
                      <Bell className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                      <span>Alerts</span>
                    </div>
                    {openAlertsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-status-critical-bg text-status-critical">
                        {openAlertsCount}
                      </span>
                    )}
                  </NavLink>
                </li>

                <li>
                  <NavLink
                    to="/maintenance"
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3.5 h-11 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-soft text-primary font-semibold'
                          : 'text-text hover:bg-[#F3F5FA] hover:text-navy'
                      }`
                    }
                  >
                    <Wrench className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                    <span>Maintenance</span>
                  </NavLink>
                </li>

                <li>
                  <NavLink
                    to="/inspections"
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3.5 h-11 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-soft text-primary font-semibold'
                          : 'text-text hover:bg-[#F3F5FA] hover:text-navy'
                      }`
                    }
                  >
                    <ClipboardCheck className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                    <span>Safety Inspections</span>
                  </NavLink>
                </li>

                <li>
                  <NavLink
                    to="/inventory"
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3.5 h-11 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-soft text-primary font-semibold'
                          : 'text-text hover:bg-[#F3F5FA] hover:text-navy'
                      }`
                    }
                  >
                    <Package className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                    <span>Inventory</span>
                  </NavLink>
                </li>
              </ul>
            </div>

            {/* Group 2: Insights */}
            <div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider px-3 mb-2 block">
                Insights
              </span>
              <ul className="space-y-1">
                <li>
                  <NavLink
                    to="/reports"
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3.5 h-11 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-soft text-primary font-semibold'
                          : 'text-text hover:bg-[#F3F5FA] hover:text-navy'
                      }`
                    }
                  >
                    <BarChart3 className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                    <span>Reports</span>
                  </NavLink>
                </li>
              </ul>
            </div>

            {/* Group 3: Administration (ADMIN only) */}
            {isAdmin && (
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider px-3 mb-2 block">
                  Administration
                </span>
                <ul className="space-y-1">
                  <li>
                    <NavLink
                      to="/users"
                      onClick={handleNavClick}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3.5 h-11 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary-soft text-primary font-semibold'
                            : 'text-text hover:bg-[#F3F5FA] hover:text-navy'
                        }`
                      }
                    >
                      <Users className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                      <span>Users & Roles</span>
                    </NavLink>
                  </li>
                </ul>
              </div>
            )}
          </nav>
        </div>

        {/* Bottom: User Card & Logout */}
        <div className="p-4 border-t border-border bg-[#FCFDFF]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                {getInitials(user?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-navy truncate leading-tight">
                  {user?.name || 'User'}
                </div>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                      user?.role === 'ADMIN'
                        ? 'bg-primary-soft text-primary'
                        : 'bg-status-success-bg text-status-success'
                    }`}
                  >
                    {user?.role === 'ADMIN' ? (
                      <ShieldCheck className="w-3 h-3 mr-1" strokeWidth={2} />
                    ) : (
                      <UserCheck className="w-3 h-3 mr-1" strokeWidth={2} />
                    )}
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sign out"
              className="p-2 rounded-xl text-muted hover:text-status-critical hover:bg-status-critical-bg transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
