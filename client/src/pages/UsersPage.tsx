import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Edit2,
  UserX,
  Eye,
  EyeOff,
  KeyRound,
  Filter,
  ChevronRight,
  ChevronDown,
  Activity,
  HelpCircle,
  X,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getUsersApi,
  createUserApi,
  updateUserApi,
  deactivateUserApi,
  reactivateUserApi,
  getAuditLogsApi,
} from '../api/users';
import { User, Role, AuditLog, AuditQueryParams } from '../types/users';

type ActiveTab = 'users' | 'audit';

// Human-readable labels and badge styles for audit log actions
const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  CREATE_USER: { label: 'User created', color: '#1A2BC3', bg: '#EEF1FF' },
  UPDATE_USER: { label: 'User updated', color: '#4AA8B5', bg: '#EBF7F9' },
  DEACTIVATE_USER: { label: 'User deactivated', color: '#D92D20', bg: '#FDECEA' },
  REACTIVATE_USER: { label: 'User reactivated', color: '#0E9F6E', bg: '#E7F8F0' },
  RESET_USER_PASSWORD: { label: 'Password reset', color: '#C77700', bg: '#FFF4DE' },
  CREATE_EQUIPMENT: { label: 'Equipment added', color: '#1A2BC3', bg: '#EEF1FF' },
  UPDATE_EQUIPMENT: { label: 'Equipment updated', color: '#4AA8B5', bg: '#EBF7F9' },
  DELETE_EQUIPMENT: { label: 'Equipment removed', color: '#D92D20', bg: '#FDECEA' },
  ACKNOWLEDGE_ALERT: { label: 'Alert acknowledged', color: '#C77700', bg: '#FFF4DE' },
  RESOLVE_ALERT: { label: 'Alert resolved', color: '#0E9F6E', bg: '#E7F8F0' },
  CREATE_MAINTENANCE_TASK: { label: 'Maintenance created', color: '#1A2BC3', bg: '#EEF1FF' },
  CREATE_RECURRING_MAINTENANCE_TASK: { label: 'Recurring task created', color: '#1A2BC3', bg: '#EEF1FF' },
  UPDATE_MAINTENANCE_TASK: { label: 'Maintenance updated', color: '#4AA8B5', bg: '#EBF7F9' },
  COMPLETE_MAINTENANCE_TASK: { label: 'Maintenance completed', color: '#0E9F6E', bg: '#E7F8F0' },
  CREATE_INSPECTION_TEMPLATE: { label: 'Template created', color: '#1A2BC3', bg: '#EEF1FF' },
  CREATE_INSPECTION: { label: 'Inspection recorded', color: '#0E9F6E', bg: '#E7F8F0' },
  CREATE_INVENTORY_ITEM: { label: 'Item registered', color: '#1A2BC3', bg: '#EEF1FF' },
  UPDATE_INVENTORY_ITEM: { label: 'Item updated', color: '#4AA8B5', bg: '#EBF7F9' },
  INVENTORY_TRANSACTION: { label: 'Inventory transaction', color: '#6B7BE8', bg: '#F0F2FD' },
  CREATE_RESTOCK_REQUEST: { label: 'Restock requested', color: '#C77700', bg: '#FFF4DE' },
  RESTOCK_REQUEST_APPROVE: { label: 'Restock approved', color: '#0E9F6E', bg: '#E7F8F0' },
  RESTOCK_REQUEST_REJECT: { label: 'Restock rejected', color: '#D92D20', bg: '#FDECEA' },
  RESTOCK_REQUEST_ORDER: { label: 'Restock ordered', color: '#4AA8B5', bg: '#EBF7F9' },
  RESTOCK_REQUEST_RECEIVE: { label: 'Restock received', color: '#0E9F6E', bg: '#E7F8F0' },
};

function generateStrongPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let pwd = 'Cryo';
  for (let i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  pwd += '2026';
  return pwd;
}

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('users');

  // -----------------------------------------------------------
  // USERS TAB STATE
  // -----------------------------------------------------------
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'STAFF' as Role,
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setErrorUsers(null);
    try {
      const data = await getUsersApi();
      setUsers(data.users || []);
    } catch (err: any) {
      setErrorUsers(err.response?.data?.message || err.response?.data?.error || 'Failed to load users list.');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      email: '',
      role: 'STAFF',
      password: generateStrongPassword(),
    });
    setFormError(null);
    setShowPassword(true);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (targetUser: User) => {
    setUserToEdit(targetUser);
    setFormData({
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      password: '',
    });
    setFormError(null);
    setShowPassword(false);
    setIsEditModalOpen(true);
  };

  // Submit Add User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      await createUserApi(formData);
      setIsAddModalOpen(false);
      await fetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.response?.data?.error || 'Failed to create user account.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Submit Update User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    setFormSubmitting(true);
    setFormError(null);
    try {
      await updateUserApi(userToEdit.id, {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        password: formData.password ? formData.password : undefined,
      });
      setIsEditModalOpen(false);
      setUserToEdit(null);
      await fetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.response?.data?.error || 'Failed to update user account.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Deactivation / Reactivation
  const handleToggleActive = async (targetUser: User) => {
    if (targetUser.is_active) {
      setUserToDeactivate(targetUser);
      setIsDeactivateModalOpen(true);
    } else {
      try {
        await reactivateUserApi(targetUser.id);
        await fetchUsers();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to reactivate user.');
      }
    }
  };

  const confirmDeactivation = async () => {
    if (!userToDeactivate) return;
    setFormSubmitting(true);
    try {
      await deactivateUserApi(userToDeactivate.id);
      setIsDeactivateModalOpen(false);
      setUserToDeactivate(null);
      await fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to deactivate user.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // -----------------------------------------------------------
  // AUDIT LOG TAB STATE
  // -----------------------------------------------------------
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(true);
  const [errorAudit, setErrorAudit] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Audit Filters
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [filterEntity, setFilterEntity] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');

  const fetchAuditLogs = useCallback(
    async (pageToLoad = 1) => {
      setLoadingAudit(true);
      setErrorAudit(null);
      try {
        const queryParams: AuditQueryParams = {
          page: pageToLoad,
          limit: 25,
          userId: filterUserId || undefined,
          entity: filterEntity || undefined,
          action: filterAction || undefined,
          from: filterFrom ? new Date(filterFrom).toISOString() : undefined,
          to: filterTo ? new Date(filterTo).toISOString() : undefined,
        };

        const res = await getAuditLogsApi(queryParams);
        setAuditLogs(res.logs || []);
        setTotalLogs(res.total || 0);
        setCurrentPage(res.page || 1);
        setTotalPages(res.totalPages || 1);
      } catch (err: any) {
        setErrorAudit(err.response?.data?.message || err.response?.data?.error || 'Failed to load audit logs.');
      } finally {
        setLoadingAudit(false);
      }
    },
    [filterUserId, filterEntity, filterAction, filterFrom, filterTo]
  );

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs(1);
    }
  }, [activeTab, fetchAuditLogs]);

  const handleResetFilters = () => {
    setFilterUserId('');
    setFilterEntity('');
    setFilterAction('');
    setFilterFrom('');
    setFilterTo('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Section 10 Clean Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1633] tracking-tight">Users & roles</h1>
          <p className="text-sm text-[#5B6578] mt-1">
            Manage authorized staff accounts, role permissions, and system compliance logs.
          </p>
        </div>

        {activeTab === 'users' && (
          <button
            id="add-user-btn"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-[#1A2BC3] hover:bg-[#142299] text-white shadow-sm transition-colors self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add user</span>
          </button>
        )}
      </div>

      {/* Tabs Switcher: Users | Audit log (No Count) */}
      <div className="flex items-center gap-2 border-b border-[#E5E9F2] pb-px">
        <button
          id="tab-users-btn"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'users'
              ? 'border-[#1A2BC3] text-[#1A2BC3]'
              : 'border-transparent text-[#5B6578] hover:text-[#0B1633]'
          }`}
        >
          Users
        </button>
        <button
          id="tab-audit-btn"
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'audit'
              ? 'border-[#1A2BC3] text-[#1A2BC3]'
              : 'border-transparent text-[#5B6578] hover:text-[#0B1633]'
          }`}
        >
          Audit log
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: USERS & ROLES */}
      {/* ============================================================ */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Users Table Card */}
          <div className="bg-white border border-[#E5E9F2] rounded-2xl shadow-[0_1px_2px_rgba(11,22,51,0.04),0_8px_24px_rgba(11,22,51,0.04)] overflow-hidden">
            {loadingUsers ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-[#1A2BC3] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-[#5B6578] font-medium">Loading user accounts...</p>
              </div>
            ) : errorUsers ? (
              <div className="p-8 text-center bg-[#FDECEA] rounded-xl m-4 border border-[#D92D20]/20">
                <AlertCircle className="w-8 h-8 text-[#D92D20] mx-auto mb-2" />
                <h3 className="text-sm font-bold text-[#D92D20]">Failed to retrieve user accounts</h3>
                <p className="text-xs text-[#5B6578] mt-1">{errorUsers}</p>
                <button
                  onClick={fetchUsers}
                  className="mt-3 px-4 py-1.5 rounded-full bg-[#D92D20] hover:bg-[#B42318] text-white text-xs font-semibold"
                >
                  Retry
                </button>
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center">
                <UserX className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#1F2A44]">No users registered in system</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F6F8FC] border-b border-[#E5E9F2] text-[#5B6578] h-11">
                      <th className="px-6 font-semibold uppercase tracking-wider">Staff member</th>
                      <th className="px-6 font-semibold uppercase tracking-wider">Email address</th>
                      <th className="px-6 font-semibold uppercase tracking-wider">Role</th>
                      <th className="px-6 font-semibold uppercase tracking-wider">Status</th>
                      <th className="px-6 font-semibold uppercase tracking-wider">Created</th>
                      <th className="px-6 font-semibold uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E9F2]">
                    {users.map((u) => {
                      const isSelf = currentUser?.id === u.id;
                      const initials = u.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);

                      return (
                        <tr key={u.id} className="h-14 hover:bg-[#F6F8FC] transition-colors">
                          {/* Member Info */}
                          <td className="px-6 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                  u.role === 'ADMIN'
                                    ? 'bg-[#EEF1FF] text-[#1A2BC3]'
                                    : 'bg-[#F3F5FA] text-[#1F2A44]'
                                }`}
                              >
                                {initials}
                              </div>
                              <div className="font-semibold text-[#0B1633] flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-[#EEF1FF] text-[#1A2BC3] px-1.5 py-0.5 rounded font-medium">
                                    You
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Email - Normal Font */}
                          <td className="px-6 text-[#5B6578]">{u.email}</td>

                          {/* Role Badge */}
                          <td className="px-6 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                u.role === 'ADMIN'
                                  ? 'bg-[#EEF1FF] text-[#1A2BC3] border border-[#1A2BC3]/20'
                                  : 'bg-[#F6F8FC] text-[#5B6578] border border-[#E5E9F2]'
                              }`}
                            >
                              {u.role === 'ADMIN' ? (
                                <ShieldCheck className="w-3 h-3 text-[#1A2BC3]" />
                              ) : (
                                <UserCheck className="w-3 h-3 text-[#5B6578]" />
                              )}
                              <span>{u.role}</span>
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="px-6 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                u.is_active
                                  ? 'bg-[#E7F8F0] text-[#0E9F6E] border border-[#0E9F6E]/20'
                                  : 'bg-[#FDECEA] text-[#D92D20] border border-[#D92D20]/20'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.is_active ? 'bg-[#0E9F6E]' : 'bg-[#D92D20]'
                                }`}
                              />
                              <span>{u.is_active ? 'Active' : 'Deactivated'}</span>
                            </span>
                          </td>

                          {/* Created Date - Normal Font */}
                          <td className="px-6 text-[#5B6578] whitespace-nowrap">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                          </td>

                          {/* Actions */}
                          <td className="px-6 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              {/* Edit Button */}
                              <button
                                onClick={() => handleOpenEditModal(u)}
                                className="p-1.5 rounded-lg border border-[#E5E9F2] bg-white text-[#1F2A44] hover:bg-[#F6F8FC] hover:text-[#1A2BC3] transition-colors"
                                title="Edit user specifications or reset password"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Deactivate/Reactivate Button */}
                              {isSelf ? (
                                <div
                                  className="p-1.5 rounded-lg border border-[#E5E9F2] bg-[#F6F8FC] text-[#94A3B8] cursor-not-allowed opacity-60"
                                  title="You cannot deactivate your own account"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleToggleActive(u)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                                    u.is_active
                                      ? 'border-[#D92D20]/30 text-[#D92D20] bg-white hover:bg-[#FDECEA]'
                                      : 'border-[#0E9F6E]/30 text-[#0E9F6E] bg-white hover:bg-[#E7F8F0]'
                                  }`}
                                  title={u.is_active ? 'Deactivate user' : 'Reactivate user'}
                                >
                                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: AUDIT LOG */}
      {/* ============================================================ */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Audit Filters Bar */}
          <div className="bg-white border border-[#E5E9F2] rounded-2xl shadow-[0_1px_2px_rgba(11,22,51,0.04),0_8px_24px_rgba(11,22,51,0.04)] p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E9F2]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B1633] uppercase tracking-wider">
                <Filter className="w-3.5 h-3.5 text-[#1A2BC3]" />
                <span>Filter audit log</span>
              </div>
              <button
                onClick={handleResetFilters}
                className="text-xs text-[#1A2BC3] hover:underline font-medium"
              >
                Reset filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* User filter */}
              <div>
                <label className="block text-[11px] font-semibold text-[#5B6578] mb-1">Actor user</label>
                <select
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                  className="w-full text-xs bg-[#F6F8FC] border border-[#E5E9F2] rounded-lg px-2.5 py-1.5 text-[#1F2A44] focus:outline-none focus:ring-1 focus:ring-[#1A2BC3]"
                >
                  <option value="">All users</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Entity filter */}
              <div>
                <label className="block text-[11px] font-semibold text-[#5B6578] mb-1">Entity type</label>
                <select
                  value={filterEntity}
                  onChange={(e) => setFilterEntity(e.target.value)}
                  className="w-full text-xs bg-[#F6F8FC] border border-[#E5E9F2] rounded-lg px-2.5 py-1.5 text-[#1F2A44] focus:outline-none focus:ring-1 focus:ring-[#1A2BC3]"
                >
                  <option value="">All entities</option>
                  <option value="User">User</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Alert">Alert</option>
                  <option value="MaintenanceTask">MaintenanceTask</option>
                  <option value="Inspection">Inspection</option>
                  <option value="InspectionTemplate">InspectionTemplate</option>
                  <option value="InventoryItem">InventoryItem</option>
                  <option value="InventoryTransaction">InventoryTransaction</option>
                  <option value="RestockRequest">RestockRequest</option>
                </select>
              </div>

              {/* Action filter */}
              <div>
                <label className="block text-[11px] font-semibold text-[#5B6578] mb-1">Action</label>
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="w-full text-xs bg-[#F6F8FC] border border-[#E5E9F2] rounded-lg px-2.5 py-1.5 text-[#1F2A44] focus:outline-none focus:ring-1 focus:ring-[#1A2BC3]"
                >
                  <option value="">All actions</option>
                  <option value="CREATE_USER">CREATE_USER</option>
                  <option value="UPDATE_USER">UPDATE_USER</option>
                  <option value="DEACTIVATE_USER">DEACTIVATE_USER</option>
                  <option value="REACTIVATE_USER">REACTIVATE_USER</option>
                  <option value="RESET_USER_PASSWORD">RESET_USER_PASSWORD</option>
                  <option value="CREATE_EQUIPMENT">CREATE_EQUIPMENT</option>
                  <option value="UPDATE_EQUIPMENT">UPDATE_EQUIPMENT</option>
                  <option value="DELETE_EQUIPMENT">DELETE_EQUIPMENT</option>
                  <option value="ACKNOWLEDGE_ALERT">ACKNOWLEDGE_ALERT</option>
                  <option value="RESOLVE_ALERT">RESOLVE_ALERT</option>
                  <option value="CREATE_MAINTENANCE_TASK">CREATE_MAINTENANCE_TASK</option>
                  <option value="CREATE_RECURRING_MAINTENANCE_TASK">CREATE_RECURRING_MAINTENANCE_TASK</option>
                  <option value="UPDATE_MAINTENANCE_TASK">UPDATE_MAINTENANCE_TASK</option>
                  <option value="COMPLETE_MAINTENANCE_TASK">COMPLETE_MAINTENANCE_TASK</option>
                  <option value="CREATE_INSPECTION_TEMPLATE">CREATE_INSPECTION_TEMPLATE</option>
                  <option value="CREATE_INSPECTION">CREATE_INSPECTION</option>
                  <option value="CREATE_INVENTORY_ITEM">CREATE_INVENTORY_ITEM</option>
                  <option value="UPDATE_INVENTORY_ITEM">UPDATE_INVENTORY_ITEM</option>
                  <option value="INVENTORY_TRANSACTION">INVENTORY_TRANSACTION</option>
                  <option value="CREATE_RESTOCK_REQUEST">CREATE_RESTOCK_REQUEST</option>
                  <option value="RESTOCK_REQUEST_APPROVE">RESTOCK_REQUEST_APPROVE</option>
                  <option value="RESTOCK_REQUEST_REJECT">RESTOCK_REQUEST_REJECT</option>
                  <option value="RESTOCK_REQUEST_ORDER">RESTOCK_REQUEST_ORDER</option>
                  <option value="RESTOCK_REQUEST_RECEIVE">RESTOCK_REQUEST_RECEIVE</option>
                </select>
              </div>

              {/* Date from */}
              <div>
                <label className="block text-[11px] font-semibold text-[#5B6578] mb-1">From date</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="w-full text-xs bg-[#F6F8FC] border border-[#E5E9F2] rounded-lg px-2.5 py-1.5 text-[#1F2A44] focus:outline-none focus:ring-1 focus:ring-[#1A2BC3]"
                />
              </div>

              {/* Date to */}
              <div>
                <label className="block text-[11px] font-semibold text-[#5B6578] mb-1">To date</label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="w-full text-xs bg-[#F6F8FC] border border-[#E5E9F2] rounded-lg px-2.5 py-1.5 text-[#1F2A44] focus:outline-none focus:ring-1 focus:ring-[#1A2BC3]"
                />
              </div>
            </div>
          </div>

          {/* Audit Log Table Card */}
          <div className="bg-white border border-[#E5E9F2] rounded-2xl shadow-[0_1px_2px_rgba(11,22,51,0.04),0_8px_24px_rgba(11,22,51,0.04)] overflow-hidden">
            {loadingAudit ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-[#1A2BC3] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-[#5B6578] font-medium">Fetching system audit logs...</p>
              </div>
            ) : errorAudit ? (
              <div className="p-8 text-center bg-[#FDECEA] rounded-xl m-4 border border-[#D92D20]/20">
                <AlertCircle className="w-8 h-8 text-[#D92D20] mx-auto mb-2" />
                <h3 className="text-sm font-bold text-[#D92D20]">Failed to retrieve audit log records</h3>
                <p className="text-xs text-[#5B6578] mt-1">{errorAudit}</p>
                <button
                  onClick={() => fetchAuditLogs(currentPage)}
                  className="mt-3 px-4 py-1.5 rounded-full bg-[#D92D20] hover:bg-[#B42318] text-white text-xs font-semibold"
                >
                  Retry
                </button>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#1F2A44]">No audit records found matching criteria</p>
                <p className="text-xs text-[#5B6578] mt-1">Try expanding the date range or clearing filter parameters.</p>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F6F8FC] border-b border-[#E5E9F2] text-[#5B6578] h-11">
                        <th className="px-4 w-8"></th>
                        <th className="px-4 font-semibold uppercase tracking-wider">Timestamp</th>
                        <th className="px-4 font-semibold uppercase tracking-wider">Actor user</th>
                        <th className="px-4 font-semibold uppercase tracking-wider">Action performed</th>
                        <th className="px-4 font-semibold uppercase tracking-wider">Target entity</th>
                        <th className="px-4 font-semibold uppercase tracking-wider">Entity ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E9F2]">
                      {auditLogs.map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        const actionMeta = ACTION_LABELS[log.action] || {
                          label: log.action,
                          color: '#5B6578',
                          bg: '#F6F8FC',
                        };

                        return (
                          <React.Fragment key={log.id}>
                            <tr
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className={`h-14 cursor-pointer transition-colors ${
                                isExpanded ? 'bg-[#EEF1FF]/30' : 'hover:bg-[#F6F8FC]'
                              }`}
                            >
                              <td className="px-4 text-center">
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-[#1A2BC3]" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
                                )}
                              </td>
                              {/* Timestamp - Normal font */}
                              <td className="px-4 whitespace-nowrap text-[#5B6578]">
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                              <td className="px-4 whitespace-nowrap">
                                {log.user ? (
                                  <span className="font-medium text-[#0B1633]">{log.user.name}</span>
                                ) : (
                                  <span className="text-[#94A3B8] italic">System</span>
                                )}
                              </td>
                              <td className="px-4 whitespace-nowrap">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                                  style={{
                                    backgroundColor: actionMeta.bg,
                                    color: actionMeta.color,
                                    borderColor: `${actionMeta.color}30`,
                                  }}
                                >
                                  {actionMeta.label}
                                </span>
                              </td>
                              <td className="px-4 whitespace-nowrap font-medium text-[#1F2A44]">
                                {log.entity}
                              </td>
                              {/* Entity ID - Monospace */}
                              <td className="px-4 whitespace-nowrap text-[#5B6578] font-mono text-[11px]">
                                {log.entity_id}
                              </td>
                            </tr>

                            {/* Expanded Row Detail */}
                            {isExpanded && (
                              <tr className="bg-[#F8FAFD] border-b border-[#E5E9F2]">
                                <td colSpan={6} className="p-4 pl-12">
                                  <div className="bg-white p-4 rounded-xl border border-[#E5E9F2] shadow-sm space-y-2">
                                    <div className="flex items-center justify-between border-b border-[#E5E9F2] pb-2">
                                      <span className="text-xs font-bold text-[#0B1633]">
                                        Audit payload metadata
                                      </span>
                                      <span className="text-[10px] text-[#5B6578] font-mono">ID: {log.id}</span>
                                    </div>

                                    {log.meta && Object.keys(log.meta).length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                                        {Object.entries(log.meta).map(([k, v]) => (
                                          <div key={k} className="bg-[#F6F8FC] p-2.5 rounded-lg border border-[#EEF1F6]">
                                            <div className="text-[10px] font-semibold uppercase text-[#5B6578]">
                                              {k}
                                            </div>
                                            <div className="text-xs font-medium text-[#1F2A44] break-words mt-0.5">
                                              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-[#94A3B8] italic py-1">No additional metadata attached.</p>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-[#E5E9F2] flex items-center justify-between bg-[#F6F8FC] text-xs">
                  <div className="text-[#5B6578]">
                    Showing Page <span className="font-semibold text-[#0B1633]">{currentPage}</span> of{' '}
                    <span className="font-semibold text-[#0B1633]">{totalPages}</span> ({totalLogs} total entries)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage <= 1 || loadingAudit}
                      onClick={() => fetchAuditLogs(currentPage - 1)}
                      className="px-3 py-1.5 rounded-lg border border-[#E5E9F2] bg-white text-[#1F2A44] hover:bg-[#F6F8FC] disabled:opacity-50 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      disabled={currentPage >= totalPages || loadingAudit}
                      onClick={() => fetchAuditLogs(currentPage + 1)}
                      className="px-3 py-1.5 rounded-lg border border-[#E5E9F2] bg-white text-[#1F2A44] hover:bg-[#F6F8FC] disabled:opacity-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ADD USER */}
      {/* ============================================================ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1633]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E5E9F2] shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9F2]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EEF1FF] flex items-center justify-center text-[#1A2BC3]">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0B1633]">Register new staff member</h3>
                  <p className="text-xs text-[#5B6578]">Create an authorized user credential</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-[#5B6578] hover:bg-[#F6F8FC] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-[#FDECEA] border border-[#D92D20]/20 rounded-xl text-xs text-[#D92D20] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="block font-semibold text-[#0B1633] mb-1">Full name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F6F8FC] border border-[#E5E9F2] rounded-xl text-[#1F2A44] focus:outline-none focus:ring-2 focus:ring-[#1A2BC3]"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block font-semibold text-[#0B1633] mb-1">Email address</label>
                <input
                  type="email"
                  required
                  placeholder="vikram@cryoguard.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F6F8FC] border border-[#E5E9F2] rounded-xl text-[#1F2A44] focus:outline-none focus:ring-2 focus:ring-[#1A2BC3]"
                />
              </div>

              {/* Role Select with descriptions */}
              <div>
                <label className="block font-semibold text-[#0B1633] mb-1">Role permissions</label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setFormData({ ...formData, role: 'STAFF' })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.role === 'STAFF'
                        ? 'border-[#1A2BC3] bg-[#EEF1FF]/30 ring-1 ring-[#1A2BC3]'
                        : 'border-[#E5E9F2] bg-[#F6F8FC] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[#0B1633]">
                      <UserCheck className="w-4 h-4 text-[#5B6578]" />
                      <span>STAFF</span>
                    </div>
                    <p className="text-[10px] text-[#5B6578] mt-1">
                      Operational access to monitoring, alerts, maintenance, inspections, and inventory.
                    </p>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, role: 'ADMIN' })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.role === 'ADMIN'
                        ? 'border-[#1A2BC3] bg-[#EEF1FF]/30 ring-1 ring-[#1A2BC3]'
                        : 'border-[#E5E9F2] bg-[#F6F8FC] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[#1A2BC3]">
                      <ShieldCheck className="w-4 h-4 text-[#1A2BC3]" />
                      <span>ADMIN</span>
                    </div>
                    <p className="text-[10px] text-[#5B6578] mt-1">
                      Full administrative access including user management and system audit log.
                    </p>
                  </div>
                </div>
              </div>

              {/* Password with generator */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#0B1633]">Temporary password</label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, password: generateStrongPassword() })}
                    className="inline-flex items-center gap-1 text-[11px] text-[#1A2BC3] hover:underline font-semibold"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 bg-[#F6F8FC] border border-[#E5E9F2] rounded-xl text-[#1F2A44] font-mono focus:outline-none focus:ring-2 focus:ring-[#1A2BC3]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6578] hover:text-[#1F2A44]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-[#5B6578] mt-1">
                  Minimum 10 characters with at least one letter and one number.
                </p>
              </div>

              {/* Action buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E5E9F2]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#E5E9F2] text-[#5B6578] hover:bg-[#F6F8FC] font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-full bg-[#1A2BC3] hover:bg-[#142299] text-white font-semibold shadow-sm transition-colors flex items-center gap-2"
                >
                  {formSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>Create account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDIT USER */}
      {/* ============================================================ */}
      {isEditModalOpen && userToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1633]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E5E9F2] shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9F2]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EBF7F9] flex items-center justify-center text-[#4AA8B5]">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0B1633]">Edit user account</h3>
                  <p className="text-xs text-[#5B6578]">Update user details or perform password reset</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setUserToEdit(null);
                }}
                className="p-1.5 rounded-lg text-[#5B6578] hover:bg-[#F6F8FC] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-[#FDECEA] border border-[#D92D20]/20 rounded-xl text-xs text-[#D92D20] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="block font-semibold text-[#0B1633] mb-1">Full name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F6F8FC] border border-[#E5E9F2] rounded-xl text-[#1F2A44] focus:outline-none focus:ring-2 focus:ring-[#1A2BC3]"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block font-semibold text-[#0B1633] mb-1">Email address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F6F8FC] border border-[#E5E9F2] rounded-xl text-[#1F2A44] focus:outline-none focus:ring-2 focus:ring-[#1A2BC3]"
                />
              </div>

              {/* Role Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#0B1633]">Assigned role</label>
                  {currentUser?.id === userToEdit.id && (
                    <span className="text-[10px] text-[#C77700] flex items-center gap-1 font-medium">
                      <HelpCircle className="w-3 h-3" />
                      Cannot change own role
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={currentUser?.id === userToEdit.id}
                    onClick={() => setFormData({ ...formData, role: 'STAFF' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      currentUser?.id === userToEdit.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      formData.role === 'STAFF'
                        ? 'border-[#1A2BC3] bg-[#EEF1FF]/30 ring-1 ring-[#1A2BC3]'
                        : 'border-[#E5E9F2] bg-[#F6F8FC] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[#0B1633]">
                      <UserCheck className="w-4 h-4 text-[#5B6578]" />
                      <span>STAFF</span>
                    </div>
                    <p className="text-[10px] text-[#5B6578] mt-1">Operational monitoring and inspection privileges.</p>
                  </button>

                  <button
                    type="button"
                    disabled={currentUser?.id === userToEdit.id}
                    onClick={() => setFormData({ ...formData, role: 'ADMIN' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      currentUser?.id === userToEdit.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      formData.role === 'ADMIN'
                        ? 'border-[#1A2BC3] bg-[#EEF1FF]/30 ring-1 ring-[#1A2BC3]'
                        : 'border-[#E5E9F2] bg-[#F6F8FC] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[#1A2BC3]">
                      <ShieldCheck className="w-4 h-4 text-[#1A2BC3]" />
                      <span>ADMIN</span>
                    </div>
                    <p className="text-[10px] text-[#5B6578] mt-1">Full administrative control and audit logs.</p>
                  </button>
                </div>
              </div>

              {/* Password Reset (Optional) */}
              <div className="pt-2 border-t border-[#E5E9F2]">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#0B1633] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#C77700]" />
                    <span>Reset password (optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, password: generateStrongPassword() });
                      setShowPassword(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-[#1A2BC3] hover:underline font-semibold"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Leave blank to keep existing password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 bg-[#F6F8FC] border border-[#E5E9F2] rounded-xl text-[#1F2A44] font-mono focus:outline-none focus:ring-2 focus:ring-[#1A2BC3]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6578] hover:text-[#1F2A44]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E5E9F2]">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setUserToEdit(null);
                  }}
                  className="px-4 py-2 rounded-full border border-[#E5E9F2] text-[#5B6578] hover:bg-[#F6F8FC] font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-full bg-[#1A2BC3] hover:bg-[#142299] text-white font-semibold shadow-sm transition-colors flex items-center gap-2"
                >
                  {formSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Save changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: DEACTIVATE CONFIRMATION */}
      {/* ============================================================ */}
      {isDeactivateModalOpen && userToDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1633]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E5E9F2] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-[#FDECEA] flex items-center justify-center text-[#D92D20] mx-auto">
              <UserX className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-[#0B1633]">Deactivate user account?</h3>
              <p className="text-xs text-[#5B6578]">
                Are you sure you want to deactivate{' '}
                <strong className="text-[#1F2A44]">{userToDeactivate.name}</strong> ({userToDeactivate.email})?
              </p>
              <p className="text-[11px] text-[#D92D20] bg-[#FDECEA] p-2 rounded-lg mt-2 font-medium">
                They will immediately lose access and be unable to log in to CryoGuard.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeactivateModalOpen(false);
                  setUserToDeactivate(null);
                }}
                className="px-4 py-2 rounded-full border border-[#E5E9F2] text-[#5B6578] hover:bg-[#F6F8FC] font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={formSubmitting}
                onClick={confirmDeactivation}
                className="px-5 py-2 rounded-full bg-[#D92D20] hover:bg-[#B42318] text-white font-semibold text-xs shadow-sm transition-colors flex items-center gap-2"
              >
                {formSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <UserX className="w-3.5 h-3.5" />
                )}
                <span>Confirm deactivate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
