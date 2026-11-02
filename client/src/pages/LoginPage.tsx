import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle,
  ArrowRight,
  KeyRound,
  Copy,
  Check,
  X,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo Credentials Modal state
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const demoAccounts = {
    admin: {
      role: 'Admin Account',
      badge: 'Full Access',
      email: 'admin@cryoguard.com',
      password: 'Admin@123456',
      description: 'System configuration, user management, and safety threshold overrides.',
    },
    staff: {
      role: 'Staff Account',
      badge: 'Operator',
      email: 'arun@cryoguard.com',
      password: 'Staff@123456',
      description: 'Tank telemetry monitoring, safety inspections, and inventory management.',
    },
  };

  // If already logged in, redirect
  React.useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await login({ email: email.trim(), password });
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Authentication failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleUseAccount = (accEmail: string, accPass: string) => {
    setEmail(accEmail);
    setPassword(accPass);
    setShowDemoModal(false);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-teal text-white shadow-md mb-3">
            <svg
              className="w-8 h-8"
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
              <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.25" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy">
            Cryo<span className="bg-gradient-to-r from-primary to-teal bg-clip-text text-transparent">Guard</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Cryogenic Facility Control & Safety System
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6 sm:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-navy">Sign in to control panel</h2>
              <p className="text-xs text-muted mt-1">
                Enter your authorized staff credentials to continue
              </p>
            </div>
            {/* View Demo Credentials Pill */}
            <button
              type="button"
              onClick={() => setShowDemoModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all flex-shrink-0"
              title="Click to view evaluation login credentials"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Demo Credentials</span>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-status-critical-bg border border-rose-200 text-status-critical text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1.5" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@cryoguard.com"
                required
                className="w-full h-11 px-3.5 rounded-xl border border-border text-sm text-text bg-white placeholder-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-11 px-3.5 rounded-xl border border-border text-sm text-text bg-white placeholder-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 rounded-full bg-primary hover:bg-primary-hover text-white text-sm font-semibold flex items-center justify-center space-x-2 transition-colors disabled:opacity-70 shadow-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign in to system</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          {/* Evaluation Quick Access Link */}
          <div className="mt-5 pt-4 border-t border-border/80 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setShowDemoModal(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors font-medium"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Need evaluation credentials? <strong className="font-semibold text-primary underline">View Demo Accounts</strong></span>
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6">
          <p className="text-xs text-muted">
            CryoGuard Facility Monitoring &bull; Authorized Personnel Only
          </p>
        </div>
      </div>

      {/* Demo Credentials Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl p-6 sm:p-7 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-navy">Evaluation Demo Credentials</h3>
                  <p className="text-xs text-muted mt-0.5">
                    Use either account to explore the CryoGuard application.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-navy hover:bg-black/5 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Two Sections */}
            <div className="space-y-4 my-5">
              {/* 1. Admin Account */}
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/[0.03]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold text-navy">{demoAccounts.admin.role}</span>
                  </div>
                  <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {demoAccounts.admin.badge}
                  </span>
                </div>
                <p className="text-xs text-muted mb-3">
                  {demoAccounts.admin.description}
                </p>

                <div className="space-y-2 bg-white rounded-lg p-3 border border-border/80 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-sans font-medium text-[11px]">Email:</span>
                    <span className="text-navy font-semibold select-all">{demoAccounts.admin.email}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <span className="text-muted font-sans font-medium text-[11px]">Password:</span>
                    <span className="text-navy font-semibold select-all">{demoAccounts.admin.password}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        `Email: ${demoAccounts.admin.email}\nPassword: ${demoAccounts.admin.password}`,
                        'admin'
                      )
                    }
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold bg-white border border-border text-navy hover:bg-black/[0.02] transition-colors"
                  >
                    {copiedKey === 'admin' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-muted" />
                        <span>Copy Credentials</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUseAccount(demoAccounts.admin.email, demoAccounts.admin.password)}
                    className="px-4 h-9 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-white transition-colors"
                  >
                    Auto-fill & Sign In
                  </button>
                </div>
              </div>

              {/* 2. Staff / User Account */}
              <div className="p-4 rounded-xl border border-teal/20 bg-teal/[0.03]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-teal" />
                    <span className="text-sm font-bold text-navy">{demoAccounts.staff.role}</span>
                  </div>
                  <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-teal/10 text-teal">
                    {demoAccounts.staff.badge}
                  </span>
                </div>
                <p className="text-xs text-muted mb-3">
                  {demoAccounts.staff.description}
                </p>

                <div className="space-y-2 bg-white rounded-lg p-3 border border-border/80 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-sans font-medium text-[11px]">Email:</span>
                    <span className="text-navy font-semibold select-all">{demoAccounts.staff.email}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <span className="text-muted font-sans font-medium text-[11px]">Password:</span>
                    <span className="text-navy font-semibold select-all">{demoAccounts.staff.password}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        `Email: ${demoAccounts.staff.email}\nPassword: ${demoAccounts.staff.password}`,
                        'staff'
                      )
                    }
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold bg-white border border-border text-navy hover:bg-black/[0.02] transition-colors"
                  >
                    {copiedKey === 'staff' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-muted" />
                        <span>Copy Credentials</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUseAccount(demoAccounts.staff.email, demoAccounts.staff.password)}
                    className="px-4 h-9 rounded-lg text-xs font-semibold bg-teal hover:bg-teal/90 text-white transition-colors"
                  >
                    Auto-fill & Sign In
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <span className="text-[11px] text-muted">
                CryoGuard Evaluator Mode &bull; Auto-fill fills the form instantly
              </span>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-muted hover:text-navy transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
