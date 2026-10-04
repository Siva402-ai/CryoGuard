import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  Calendar as CalendarIcon,
  List as ListIcon,
  Plus,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Repeat,
  ChevronLeft,
  ChevronRight,
  Edit2,
  X,
} from 'lucide-react';
import {
  getMaintenanceTasksApi,
  createMaintenanceTaskApi,
  updateMaintenanceTaskApi,
  completeMaintenanceTaskApi,
  getUserOptionsApi,
} from '../api/maintenance';
import { getEquipmentListApi } from '../api/equipment';
import {
  MaintenanceTask,
  MaintenanceStatus,
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
} from '../types/maintenance';

export const MaintenancePage: React.FC = () => {
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [equipmentFilter, setEquipmentFilter] = useState<string>('ALL');

  // Calendar State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [completingTask, setCompletingTask] = useState<MaintenanceTask | null>(null);

  // Form States for Create/Edit
  const [formEquipmentId, setFormEquipmentId] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formDueDate, setFormDueDate] = useState<string>('');
  const [formAssignee, setFormAssignee] = useState<string>('');
  const [formRecurrenceDays, setFormRecurrenceDays] = useState<string>('');
  const [formStatus, setFormStatus] = useState<MaintenanceStatus>('PENDING');
  const [formError, setFormError] = useState<string | null>(null);

  // Form State for Complete
  const [completionNotes, setCompletionNotes] = useState<string>('');

  // 1. Fetch Maintenance Tasks
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['maintenance-tasks', statusFilter, equipmentFilter],
    queryFn: () =>
      getMaintenanceTasksApi({
        status: statusFilter,
        equipmentId: equipmentFilter,
      }),
  });

  // 2. Fetch Equipment List for Selectors
  const { data: equipmentData } = useQuery({
    queryKey: ['equipment-list'],
    queryFn: getEquipmentListApi,
  });

  // 3. Fetch Active Users Options
  const { data: usersData } = useQuery({
    queryKey: ['users-options'],
    queryFn: getUserOptionsApi,
  });

  const tasks = data?.tasks || [];
  const tanks = equipmentData?.equipment || [];
  const activeUsers = usersData?.users || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (dto: CreateMaintenanceDto) => createMaintenanceTaskApi(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateMaintenanceDto }) =>
      updateMaintenanceTaskApi(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      closeModal();
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      completeMaintenanceTaskApi(id, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setCompletingTask(null);
      setCompletionNotes('');
    },
  });

  const openCreateModal = () => {
    setEditingTask(null);
    setFormEquipmentId(tanks[0]?.id || '');
    setFormTitle('');
    setFormDescription('');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormDueDate(tomorrow.toISOString().slice(0, 10));
    setFormAssignee(activeUsers[0]?.name || '');
    setFormRecurrenceDays('');
    setFormStatus('PENDING');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (task: MaintenanceTask) => {
    setEditingTask(task);
    setFormEquipmentId(task.equipment_id);
    setFormTitle(task.title);
    setFormDescription(task.description);
    setFormDueDate(new Date(task.due_date).toISOString().slice(0, 10));
    setFormAssignee(task.assigned_to || '');
    setFormRecurrenceDays(task.recurrence_days ? String(task.recurrence_days) : '');
    setFormStatus(task.status === 'COMPLETED' ? 'PENDING' : task.status);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const closeModal = () => {
    setIsCreateOpen(false);
    setEditingTask(null);
    setFormError(null);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formEquipmentId) {
      setFormError('Please select a storage unit.');
      return;
    }
    if (!formTitle.trim()) {
      setFormError('Please enter a task title.');
      return;
    }
    if (!formDescription.trim()) {
      setFormError('Please enter a description.');
      return;
    }
    if (!formDueDate) {
      setFormError('Please select a valid due date.');
      return;
    }

    const recurrenceDaysNum = formRecurrenceDays ? parseInt(formRecurrenceDays, 10) : null;
    const isoDueDate = new Date(`${formDueDate}T09:00:00Z`).toISOString();

    try {
      if (editingTask) {
        await updateMutation.mutateAsync({
          id: editingTask.id,
          dto: {
            title: formTitle.trim(),
            description: formDescription.trim(),
            due_date: isoDueDate,
            assigned_to: formAssignee || null,
            recurrence_days: recurrenceDaysNum,
            status: formStatus,
          },
        });
      } else {
        await createMutation.mutateAsync({
          equipment_id: formEquipmentId,
          title: formTitle.trim(),
          description: formDescription.trim(),
          due_date: isoDueDate,
          assigned_to: formAssignee || null,
          recurrence_days: recurrenceDaysNum,
        });
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save maintenance task.');
    }
  };

  const handleConfirmComplete = async () => {
    if (!completingTask) return;
    try {
      await completeMutation.mutateAsync({
        id: completingTask.id,
        notes: completionNotes.trim() || undefined,
      });
    } catch (err: any) {
      console.error('Failed to complete task:', err);
    }
  };

  // Calendar Helpers
  const calendarYear = currentDate.getFullYear();
  const calendarMonth = currentDate.getMonth();

  const daysInMonth = useMemo(() => {
    const date = new Date(calendarYear, calendarMonth, 1);
    const days = [];
    const firstDayIndex = date.getDay(); // 0 = Sunday

    // Previous month padding days
    const prevMonthLastDate = new Date(calendarYear, calendarMonth, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(calendarYear, calendarMonth - 1, prevMonthLastDate - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(calendarYear, calendarMonth, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding days to make grid complete (multiples of 7)
    const remainingDays = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(calendarYear, calendarMonth + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [calendarYear, calendarMonth]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Maintenance Schedules</h2>
          <p className="text-sm text-muted mt-0.5">
            Preventive maintenance tasks, recurrence schedules, and technician assignments
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* View Toggle Segmented Control */}
          <div className="bg-[#EEF1F6] p-1 rounded-xl flex items-center">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-muted hover:text-navy'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-muted hover:text-navy'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
          </div>

          {/* Schedule Button */}
          <button
            onClick={openCreateModal}
            className="h-11 px-5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors flex items-center space-x-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Maintenance</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Card */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-muted uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Tasks</span>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs text-primary font-semibold hover:underline inline-flex items-center space-x-1"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="status-filter" className="block text-xs font-semibold text-navy mb-1.5">
              Task Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active (Pending / Scheduled / In Progress / Overdue)</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PENDING">Pending</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <div>
            <label htmlFor="tank-filter" className="block text-xs font-semibold text-navy mb-1.5">
              Storage Vessel
            </label>
            <select
              id="tank-filter"
              value={equipmentFilter}
              onChange={(e) => setEquipmentFilter(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="ALL">All Storage Units</option>
              {tanks.map((tank) => (
                <option key={tank.id} value={tank.id}>
                  {tank.code} — {tank.name} ({tank.material})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area: Table or Calendar */}
      {viewMode === 'table' ? (
        <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-border/40 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-10 h-10 text-status-critical mx-auto mb-2" />
              <h3 className="text-base font-bold text-navy">Unable to load maintenance tasks</h3>
              <button
                onClick={() => refetch()}
                className="mt-3 h-10 px-5 rounded-full bg-primary text-white text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center mx-auto mb-3">
                <Wrench className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-navy">No Maintenance Tasks Found</h3>
              <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                No maintenance tasks matching your filter criteria. Click "Schedule Maintenance" to add one.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[880px]">
                <thead>
                  <tr className="bg-[#F8FAFD] border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wider">
                    <th className="py-3.5 px-6">Unit</th>
                    <th className="py-3.5 px-4">Task Details</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Assignee</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Recurrence</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tasks.map((task: MaintenanceTask) => {
                    const isOverdue = task.status === 'OVERDUE';
                    const isCompleted = task.status === 'COMPLETED';

                    return (
                      <tr
                        key={task.id}
                        className={`hover:bg-[#F8FAFD] transition-colors ${
                          isOverdue ? 'bg-status-critical-bg/20' : ''
                        }`}
                      >
                        {/* Equipment Code & Badge */}
                        <td className="py-4 px-6 font-bold text-navy whitespace-nowrap">
                          <Link
                            to={`/equipment/${task.equipment_id}`}
                            className="text-primary hover:underline inline-flex items-center space-x-1.5"
                          >
                            <span>{task.equipment?.code || 'UNIT'}</span>
                          </Link>
                          {task.equipment?.material && (
                            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary-soft text-primary">
                              {task.equipment.material}
                            </span>
                          )}
                        </td>

                        {/* Title & Description */}
                        <td className="py-4 px-4 max-w-xs">
                          <span className="font-bold text-navy block leading-tight">
                            {task.title}
                          </span>
                          <span className="text-xs text-muted block mt-0.5 line-clamp-1">
                            {task.description}
                          </span>
                        </td>

                        {/* Due Date */}
                        <td className="py-4 px-4 text-xs whitespace-nowrap">
                          <span
                            className={`font-semibold block ${
                              isOverdue
                                ? 'text-status-critical'
                                : 'text-navy'
                            }`}
                          >
                            {new Date(task.due_date).toLocaleDateString()}
                          </span>
                          {isCompleted && task.completed_at ? (
                            <span className="text-[10px] text-status-success block">
                              Done {new Date(task.completed_at).toLocaleDateString()}
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[10px] font-bold text-status-critical block">
                              Overdue
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted block">
                              Scheduled
                            </span>
                          )}
                        </td>

                        {/* Assignee */}
                        <td className="py-4 px-4 text-xs text-text whitespace-nowrap">
                          {task.assigned_to ? (
                            <div className="flex items-center space-x-1.5">
                              <div className="w-5 h-5 rounded-full bg-primary-soft text-primary flex items-center justify-center text-[10px] font-bold">
                                {task.assigned_to[0]}
                              </div>
                              <span className="font-medium">{task.assigned_to}</span>
                            </div>
                          ) : (
                            <span className="text-muted italic">Unassigned</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              task.status === 'OVERDUE'
                                ? 'bg-status-critical-bg text-status-critical'
                                : task.status === 'COMPLETED'
                                ? 'bg-status-success-bg text-status-success'
                                : task.status === 'SCHEDULED' || task.status === 'IN_PROGRESS'
                                ? 'bg-status-info-bg text-status-info'
                                : 'bg-status-offline-bg text-status-offline'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                task.status === 'OVERDUE'
                                  ? 'bg-status-critical'
                                  : task.status === 'COMPLETED'
                                  ? 'bg-status-success'
                                  : task.status === 'SCHEDULED' || task.status === 'IN_PROGRESS'
                                  ? 'bg-status-info'
                                  : 'bg-status-offline'
                              }`}
                            />
                            {task.status.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Recurrence */}
                        <td className="py-4 px-4 text-xs text-muted whitespace-nowrap">
                          {task.recurrence_days ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-surface border border-border text-navy font-semibold text-[11px]">
                              <Repeat className="w-3 h-3 text-primary" />
                              <span>Every {task.recurrence_days}d</span>
                            </span>
                          ) : (
                            <span>One-time</span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center space-x-2">
                            {!isCompleted ? (
                              <>
                                <button
                                  onClick={() => openEditModal(task)}
                                  className="p-1.5 rounded-lg hover:bg-primary-soft text-muted hover:text-primary transition-colors"
                                  title="Edit Task"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setCompletingTask(task);
                                    setCompletionNotes('');
                                  }}
                                  className="h-8 px-3 rounded-lg bg-status-success-bg hover:bg-status-success/25 text-status-success text-xs font-semibold transition-colors inline-flex items-center space-x-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Complete</span>
                                </button>
                              </>
                            ) : (
                              <span className="text-xs font-semibold text-status-success inline-flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Completed</span>
                              </span>
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
      ) : (
        /* Calendar View */
        <div className="bg-surface border border-border rounded-2xl shadow-card p-6">
          {/* Month Navigation Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <h3 className="text-xl font-bold text-navy">
                {monthNames[calendarMonth]} {calendarYear}
              </h3>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-2.5 py-1 rounded-lg border border-border text-xs font-semibold text-muted hover:text-navy hover:bg-[#F3F5FA] transition-colors"
              >
                Today
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentDate(new Date(calendarYear, calendarMonth - 1, 1))}
                className="p-2 rounded-xl border border-border hover:bg-[#F3F5FA] text-muted hover:text-navy transition-colors"
                aria-label="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date(calendarYear, calendarMonth + 1, 1))}
                className="p-2 rounded-xl border border-border hover:bg-[#F3F5FA] text-muted hover:text-navy transition-colors"
                aria-label="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 7-column Calendar Grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="bg-[#F8FAFD] py-2 text-center text-xs font-semibold text-muted uppercase tracking-wider"
              >
                {day}
              </div>
            ))}

            {daysInMonth.map(({ date, isCurrentMonth }, idx) => {
              const dateStr = date.toISOString().slice(0, 10);
              const isToday = new Date().toDateString() === date.toDateString();

              // Find tasks due on this date
              const dayTasks = tasks.filter((t) => {
                const taskDateStr = new Date(t.due_date).toISOString().slice(0, 10);
                return taskDateStr === dateStr;
              });

              return (
                <div
                  key={idx}
                  className={`min-h-[105px] p-2 bg-surface flex flex-col justify-between transition-colors ${
                    !isCurrentMonth ? 'bg-[#FAFBFC] opacity-40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-primary text-white'
                          : isCurrentMonth
                          ? 'text-navy'
                          : 'text-muted'
                      }`}
                    >
                      {date.getDate()}
                    </span>

                    {dayTasks.length > 0 && (
                      <span className="text-[10px] text-muted font-bold">
                        {dayTasks.length} task{dayTasks.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-[75px] pr-0.5">
                    {dayTasks.map((t) => {
                      const isOverdue = t.status === 'OVERDUE';
                      const isDone = t.status === 'COMPLETED';

                      return (
                        <div
                          key={t.id}
                          onClick={() => (!isDone ? openEditModal(t) : undefined)}
                          className={`p-1 rounded text-[10px] font-semibold truncate cursor-pointer transition-transform hover:scale-[1.02] ${
                            isDone
                              ? 'bg-status-success-bg text-status-success border border-[#D0F0E4]'
                              : isOverdue
                              ? 'bg-status-critical-bg text-status-critical border border-status-critical/30'
                              : 'bg-primary-soft text-primary border border-primary/20'
                          }`}
                          title={`${t.equipment?.code || 'UNIT'}: ${t.title} (${t.status})`}
                        >
                          <span className="font-bold mr-1">{t.equipment?.code || 'TANK'}:</span>
                          <span>{t.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Schedule / Edit Task Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-lg w-full p-6 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <Wrench className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-navy">
                  {editingTask ? 'Edit Maintenance Task' : 'Schedule Maintenance Task'}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg text-muted hover:text-navy hover:bg-[#F3F5FA]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="mt-4 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-status-critical-bg text-status-critical text-xs font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Equipment Selection */}
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Storage Vessel *
                </label>
                <select
                  value={formEquipmentId}
                  onChange={(e) => setFormEquipmentId(e.target.value)}
                  disabled={!!editingTask}
                  className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-[#EEF1F6]"
                >
                  {tanks.map((tank) => (
                    <option key={tank.id} value={tank.id}>
                      {tank.code} — {tank.name} ({tank.material})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Monthly Safety Valve Calibration"
                  className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Task Description & Scope *
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe maintenance procedure, replacement parts, or checklist requirements..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Due Date */}
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Assignee */}
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">
                    Assignee
                  </label>
                  <select
                    value={formAssignee}
                    onChange={(e) => setFormAssignee(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Unassigned</option>
                    {activeUsers.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Recurrence Days */}
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">
                    Recurrence (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formRecurrenceDays}
                    onChange={(e) => setFormRecurrenceDays(e.target.value)}
                    placeholder="e.g. 30 for monthly"
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Status (Edit Mode Only) */}
                {editingTask && (
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">
                      Status
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as MaintenanceStatus)}
                      className="w-full h-11 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="IN_PROGRESS">In Progress</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-border">
                <button
                  type="button"
                  onClick={closeModal}
                  className="h-11 px-5 rounded-full border border-border bg-surface text-xs font-semibold text-text hover:bg-[#F3F5FA] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="h-11 px-6 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingTask
                    ? 'Update Task'
                    : 'Schedule Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Complete Modal */}
      {completingTask && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-status-success" />
                <h3 className="text-lg font-bold text-navy">Complete Task</h3>
              </div>
              <button
                onClick={() => setCompletingTask(null)}
                className="p-1 rounded-lg text-muted hover:text-navy hover:bg-[#F3F5FA]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-3 rounded-xl bg-[#F8FAFD] border border-border text-xs">
                <span className="font-bold text-navy block text-sm">{completingTask.title}</span>
                <span className="text-muted block mt-0.5">
                  Unit: <strong className="text-navy">{completingTask.equipment?.code}</strong> · Due:{' '}
                  {new Date(completingTask.due_date).toLocaleDateString()}
                </span>
                {completingTask.recurrence_days && (
                  <span className="mt-2 text-[11px] text-primary font-semibold block">
                    🔄 Recurring every {completingTask.recurrence_days} days. Next task will be auto-generated.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">
                  Completion Notes & Actions Taken
                </label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="e.g. Replaced flange seal, calibrated relief valve setpoint to 2.2 bar. All tests passed."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-border bg-surface text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCompletingTask(null)}
                  className="h-11 px-5 rounded-full border border-border bg-surface text-xs font-semibold text-text hover:bg-[#F3F5FA] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmComplete}
                  disabled={completeMutation.isPending}
                  className="h-11 px-6 rounded-full bg-status-success hover:bg-opacity-90 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  {completeMutation.isPending ? 'Completing...' : 'Mark as Completed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
