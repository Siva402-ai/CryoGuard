import React, { useEffect, useState } from 'react';

interface HealthResponse {
  status: string;
  service: string;
  db: string;
  redis: string;
  uptime: number;
  timestamp: string;
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-cyan-500 selection:text-white">
      <div className="max-w-xl w-full bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl shadow-cyan-950/30">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="text-xl font-bold text-white">❄️</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              CryoGuard Control System
            </h1>
            <p className="text-xs text-slate-400">Cryogenic Facility Operations & Safety</p>
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-300">Phase 0: Infrastructure Status</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-950 text-cyan-300 border border-cyan-800/60">
              Monorepo Scaffold
            </span>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-slate-800/50 rounded-lg"></div>
              <div className="h-10 bg-slate-800/50 rounded-lg"></div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-sm">
              <p className="font-semibold">Backend connection note:</p>
              <p className="text-xs text-rose-400 mt-1">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-950/60 border border-slate-800/70 rounded-xl">
                <span className="text-xs text-slate-400 block mb-1">PostgreSQL DB</span>
                <div className="flex items-center space-x-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${health?.db === 'up' ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
                  <span className="text-sm font-semibold capitalize text-slate-200">{health?.db}</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-800/70 rounded-xl">
                <span className="text-xs text-slate-400 block mb-1">Redis Engine</span>
                <div className="flex items-center space-x-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${health?.redis === 'up' ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
                  <span className="text-sm font-semibold capitalize text-slate-200">{health?.redis}</span>
                </div>
              </div>

              <div className="col-span-2 p-3.5 bg-slate-950/60 border border-slate-800/70 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">API Server</span>
                  <span className="text-sm font-semibold text-emerald-400">Online & Ready</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block mb-0.5">Uptime</span>
                  <span className="text-xs font-mono text-slate-300">{health?.uptime.toFixed(1)}s</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Phase 0 Complete • Ready for Phase 1 Authentication & Roles
          </p>
        </div>
      </div>
    </div>
  );
}
