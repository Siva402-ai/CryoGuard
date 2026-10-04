import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
  phase: string;
  icon: LucideIcon;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  subtitle,
  phase,
  icon: Icon,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-2xl shadow-card p-6 md:p-8 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-primary uppercase tracking-wider block mb-1">
            {phase} Module Scaffold
          </span>
          <h2 className="text-2xl font-bold text-navy">{title}</h2>
          <p className="text-xs sm:text-sm text-muted mt-1">{subtitle}</p>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6" strokeWidth={1.75} />
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-card p-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto mb-4">
          <Icon className="w-7 h-7" strokeWidth={1.75} />
        </div>
        <h3 className="text-lg font-bold text-navy mb-2">{title} Ready for Implementation</h3>
        <p className="text-sm text-muted max-w-md mx-auto">
          Phase 1 Authentication & Role system is fully operational. This module will be wired to real-time telemetry and backend services in its respective phase.
        </p>
      </div>
    </div>
  );
};
