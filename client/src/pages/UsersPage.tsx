import React, { useEffect, useState } from 'react';
import { getUsersApi } from '../api/auth';
import { User } from '../types/auth';
import { ShieldCheck, UserCheck, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsersApi();
      setUsers(data.users);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to load users list from server.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-primary mb-1">
            <ShieldCheck className="w-4 h-4" strokeWidth={2} />
            <span>Administrator Access Level</span>
          </div>
          <h2 className="text-2xl font-bold text-navy">Users & Roles Management</h2>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Manage system access, assign roles, and review authorized user accounts.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="h-11 px-5 rounded-full bg-white border border-border hover:bg-[#F3F5FA] text-text text-sm font-semibold transition-colors flex items-center space-x-2 self-start sm:self-auto shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          <span>Refresh list</span>
        </button>
      </div>

      {/* Users Table Card */}
      <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted font-medium">Fetching authorized users...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-status-critical-bg text-status-critical flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" strokeWidth={2} />
            </div>
            <h3 className="text-base font-bold text-navy">Unable to load users</h3>
            <p className="text-xs text-muted mt-1 max-w-md mx-auto">{error}</p>
            <button
              onClick={fetchUsers}
              className="mt-4 h-10 px-5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFD] border-b border-border">
                  <th className="py-3.5 px-6 text-[12px] font-semibold text-muted uppercase tracking-wider">
                    Staff Member
                  </th>
                  <th className="py-3.5 px-6 text-[12px] font-semibold text-muted uppercase tracking-wider">
                    Email Address
                  </th>
                  <th className="py-3.5 px-6 text-[12px] font-semibold text-muted uppercase tracking-wider">
                    Assigned Role
                  </th>
                  <th className="py-3.5 px-6 text-[12px] font-semibold text-muted uppercase tracking-wider">
                    Account Status
                  </th>
                  <th className="py-3.5 px-6 text-[12px] font-semibold text-muted uppercase tracking-wider text-right">
                    Account ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="h-14 hover:bg-[#F8FAFD] transition-colors">
                    <td className="py-3 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-primary-soft text-primary font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-navy">{u.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-6 text-sm text-text font-mono text-xs">
                      {u.email}
                    </td>

                    <td className="py-3 px-6">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                          u.role === 'ADMIN'
                            ? 'bg-primary-soft text-primary'
                            : 'bg-status-success-bg text-status-success'
                        }`}
                      >
                        {u.role === 'ADMIN' ? (
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
                        )}
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3 px-6">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          u.is_active
                            ? 'bg-status-success-bg text-status-success'
                            : 'bg-status-critical-bg text-status-critical'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>

                    <td className="py-3 px-6 text-right font-mono text-xs text-muted">
                      {u.id.slice(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
