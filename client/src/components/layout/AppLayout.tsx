import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAlertStream } from '../../hooks/useAlertStream';

export const AppLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeAlertsCount } = useAlertStream();

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar: 264px width */}
      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        openAlertsCount={activeAlertsCount}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[264px]">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          openAlertsCount={activeAlertsCount}
        />
        <main className="flex-1 px-4 md:px-6 pb-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
