import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, AlertCircle, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
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
          <div className="mb-6">
            <h2 className="text-xl font-bold text-navy">Sign in to control panel</h2>
            <p className="text-xs text-muted mt-1">
              Enter your authorized staff credentials to continue
            </p>
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

          {/* Demo Credentials Quick-Fill Pills */}
          <div className="mt-6 pt-5 border-t border-border/80">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-2.5 text-center">
              Quick demo accounts
            </span>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin@cryoguard.com', 'Admin@123456')}
                className="w-full px-3 py-2 rounded-xl border border-border bg-[#F8FAFD] hover:bg-primary-soft hover:border-primary/30 text-left transition-colors flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-primary" strokeWidth={2} />
                  <div>
                    <span className="text-xs font-semibold text-navy block">Facility Admin</span>
                    <span className="text-[11px] text-muted">admin@cryoguard.com</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-soft text-primary uppercase">
                  Admin
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('arun@cryoguard.com', 'Staff@123456')}
                className="w-full px-3 py-2 rounded-xl border border-border bg-[#F8FAFD] hover:bg-[#E7F8F0] hover:border-emerald-300 text-left transition-colors flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-status-success" strokeWidth={2} />
                  <div>
                    <span className="text-xs font-semibold text-navy block">Arun</span>
                    <span className="text-[11px] text-muted">arun@cryoguard.com</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-success-bg text-status-success uppercase">
                  Staff
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('ravi@cryoguard.com', 'Staff@123456')}
                className="w-full px-3 py-2 rounded-xl border border-border bg-[#F8FAFD] hover:bg-[#E7F8F0] hover:border-emerald-300 text-left transition-colors flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-status-success" strokeWidth={2} />
                  <div>
                    <span className="text-xs font-semibold text-navy block">Ravi</span>
                    <span className="text-[11px] text-muted">ravi@cryoguard.com</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-success-bg text-status-success uppercase">
                  Staff
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6">
          <p className="text-xs text-muted">
            CryoGuard Facility Monitoring &bull; Authorized Personnel Only
          </p>
        </div>
      </div>
    </div>
  );
};
