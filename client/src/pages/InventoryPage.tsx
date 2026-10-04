import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Plus,
  ArrowUpDown,
  History,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  X,
  Filter,
  RefreshCw,
  AlertCircle,
  Check,
  XCircle,
  Truck,
  Edit2,
  TrendingDown,
  Layers,
} from 'lucide-react';
import { inventoryApi } from '../api/inventory';
import {
  InventoryItem,
  InventoryTransaction,
  StockStatus,
  TransactionType,
  RestockStatus,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  CreateTransactionInput,
  CreateRestockRequestInput,
  PatchRestockRequestInput,
} from '../types/inventory';

export const InventoryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'stock' | 'restock'>('stock');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StockStatus>('ALL');
  const [restockStatusFilter, setRestockStatusFilter] = useState<'ALL' | RestockStatus>('ALL');

  // Modals & Drawers State
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [transactionItem, setTransactionItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [restockModalItem, setRestockModalItem] = useState<{ item: InventoryItem; suggestedQty: number } | null>(null);
  const [isNewRestockModalOpen, setIsNewRestockModalOpen] = useState(false);

  // Form error messages
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const {
    data: itemsData,
    isLoading: isItemsLoading,
    isError: isItemsError,
    error: itemsError,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: inventoryApi.getItems,
  });

  const {
    data: restockData,
    isLoading: isRestockLoading,
    isError: isRestockError,
    error: restockError,
    refetch: refetchRestock,
  } = useQuery({
    queryKey: ['restock-requests', restockStatusFilter],
    queryFn: () =>
      inventoryApi.getRestockRequests({
        status: restockStatusFilter !== 'ALL' ? restockStatusFilter : undefined,
      }),
  });

  const {
    data: historyData,
    isLoading: isHistoryLoading,
  } = useQuery({
    queryKey: ['inventory-transactions', historyItem?.id],
    queryFn: () => (historyItem ? inventoryApi.getItemTransactions(historyItem.id) : null),
    enabled: !!historyItem,
  });

  // Mutations
  const createItemMutation = useMutation({
    mutationFn: (data: CreateInventoryItemInput) => inventoryApi.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setIsAddItemOpen(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Failed to create item');
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInventoryItemInput }) =>
      inventoryApi.updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setEditingItem(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Failed to update item');
    },
  });

  const recordTransactionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateTransactionInput }) =>
      inventoryApi.recordTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setTransactionItem(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Transaction failed');
    },
  });

  const createRestockMutation = useMutation({
    mutationFn: (data: CreateRestockRequestInput) => inventoryApi.createRestockRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restock-requests'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      setRestockModalItem(null);
      setIsNewRestockModalOpen(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Failed to create restock request');
    },
  });

  const updateRestockMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PatchRestockRequestInput }) =>
      inventoryApi.updateRestockRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restock-requests'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Failed to update request');
    },
  });

  // Filter items
  const items = itemsData?.items || [];
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.material.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || item.stockStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Counts for overview banner
  const goodCount = items.filter((i) => i.stockStatus === 'GOOD').length;
  const lowCount = items.filter((i) => i.stockStatus === 'LOW').length;
  const critCount = items.filter((i) => i.stockStatus === 'CRITICAL').length;
  const pendingRestockCount = (restockData?.requests || []).filter(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'ORDERED',
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Cryogenic & Material Inventory</h1>
          <p className="text-sm text-muted mt-0.5">
            Bulk consumables, spare parts, and replenishment lifecycle
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setFormError(null);
              setIsAddItemOpen(true);
            }}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm inline-flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Total Managed Items
            </span>
            <span className="text-2xl font-bold text-navy">{items.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
            <Package className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Normal Stock (Good)
            </span>
            <span className="text-2xl font-bold text-status-success">{goodCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-status-success-bg text-status-success flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Low / Critical Stock
            </span>
            <span
              className={`text-2xl font-bold ${
                critCount > 0
                  ? 'text-status-critical'
                  : lowCount > 0
                  ? 'text-status-warning'
                  : 'text-navy'
              }`}
            >
              {lowCount + critCount}
            </span>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              critCount > 0
                ? 'bg-status-critical-bg text-status-critical'
                : lowCount > 0
                ? 'bg-status-warning-bg text-status-warning'
                : 'bg-status-offline-bg text-status-offline'
            }`}
          >
            <TrendingDown className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Active Restock Orders
            </span>
            <span className="text-2xl font-bold text-navy">{pendingRestockCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-status-info-bg text-status-info flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="flex border-b border-border px-6 pt-4 space-x-6">
          <button
            onClick={() => setActiveTab('stock')}
            className={`pb-3.5 text-sm font-bold transition-colors relative inline-flex items-center space-x-2 ${
              activeTab === 'stock' ? 'text-primary' : 'text-muted hover:text-text'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Stock Inventory ({items.length})</span>
            {activeTab === 'stock' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('restock')}
            className={`pb-3.5 text-sm font-bold transition-colors relative inline-flex items-center space-x-2 ${
              activeTab === 'restock' ? 'text-primary' : 'text-muted hover:text-text'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Restock Requests</span>
            {pendingRestockCount > 0 && (
              <span className="px-2 py-0.2 rounded-full text-xs font-bold bg-primary-soft text-primary">
                {pendingRestockCount}
              </span>
            )}
            {activeTab === 'restock' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
        </div>

        {/* TAB 1: STOCK TAB */}
        {activeTab === 'stock' && (
          <div className="p-6 space-y-5">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search item name or material..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-border bg-[#F8FAFD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <Package className="w-4 h-4 text-muted absolute left-3 top-2.5" />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <Filter className="w-4 h-4 text-muted" />
                <span className="text-xs font-semibold text-muted uppercase">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="GOOD">Good (&gt;= Minimum)</option>
                  <option value="LOW">Low (&lt; Minimum)</option>
                  <option value="CRITICAL">Critical (&lt; 50% Min)</option>
                </select>
              </div>
            </div>

            {/* Stock Table */}
            {isItemsLoading ? (
              <div className="py-16 text-center text-muted">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-sm">Loading stock inventory...</p>
              </div>
            ) : isItemsError ? (
              <div className="py-12 bg-status-critical-bg/30 border border-status-critical/30 rounded-2xl p-6 text-center">
                <AlertCircle className="w-8 h-8 text-status-critical mx-auto mb-2" />
                <p className="text-sm font-bold text-navy">Failed to load inventory</p>
                <p className="text-xs text-muted mt-1">{(itemsError as any)?.message}</p>
                <button
                  onClick={() => refetchItems()}
                  className="mt-4 px-4 py-1.5 rounded-full text-xs font-semibold bg-white border border-border text-navy hover:bg-slate-50"
                >
                  Retry
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-16 text-center text-muted">
                <Package className="w-10 h-10 mx-auto mb-2 text-muted/50" />
                <p className="text-sm font-semibold text-navy">No inventory items found</p>
                <p className="text-xs text-muted mt-1">
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'Try adjusting your search query or status filter.'
                    : 'Click "Add Item" to register stock materials.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-left text-sm border-collapse min-w-[760px]">
                  <thead>
                    <tr className="bg-[#F8FAFD] border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wider">
                      <th className="py-3 px-6">Item Name</th>
                      <th className="py-3 px-4">Material / Category</th>
                      <th className="py-3 px-4 text-right">Current Quantity</th>
                      <th className="py-3 px-4 text-right">Min Threshold</th>
                      <th className="py-3 px-6">Stock Level</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredItems.map((item) => {
                      const isLow = item.stockStatus === 'LOW';
                      const isCrit = item.stockStatus === 'CRITICAL';

                      return (
                        <tr key={item.id} className="hover:bg-[#F8FAFD] transition-colors">
                          <td className="py-4 px-6 font-bold text-navy">
                            <div className="flex items-center space-x-2">
                              <span>{item.name}</span>
                              <button
                                onClick={() => {
                                  setFormError(null);
                                  setEditingItem(item);
                                }}
                                title="Edit Item Details"
                                className="text-muted hover:text-primary transition-colors p-1 rounded hover:bg-slate-100"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-muted">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-soft text-primary">
                              {item.material}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-right font-bold text-navy">
                            {item.quantity.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-muted">{item.unit}</span>
                          </td>

                          <td className="py-4 px-4 text-right text-muted font-medium">
                            {item.min_quantity.toLocaleString()}{' '}
                            <span className="text-xs text-muted">{item.unit}</span>
                          </td>

                          {/* Slim Stock Level Bar */}
                          <td className="py-4 px-6 w-44">
                            <div className="space-y-1">
                              <div className="w-full h-2 bg-[#E5E9F2] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isCrit
                                      ? 'bg-status-critical'
                                      : isLow
                                      ? 'bg-status-warning'
                                      : 'bg-status-success'
                                  }`}
                                  style={{
                                    width: `${Math.max(
                                      5,
                                      Math.min(100, (item.quantity / Math.max(item.min_quantity * 1.5, item.quantity)) * 100),
                                    )}%`,
                                  }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] text-muted font-medium">
                                <span>0</span>
                                <span>Min: {item.min_quantity}</span>
                              </div>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                isCrit
                                  ? 'bg-status-critical-bg text-status-critical'
                                  : isLow
                                  ? 'bg-status-warning-bg text-status-warning'
                                  : 'bg-status-success-bg text-status-success'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  isCrit
                                    ? 'bg-status-critical'
                                    : isLow
                                    ? 'bg-status-warning'
                                    : 'bg-status-success'
                                }`}
                              />
                              {item.stockStatus}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1.5 justify-end">
                              <button
                                onClick={() => {
                                  setFormError(null);
                                  setTransactionItem(item);
                                }}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary-soft text-primary hover:bg-primary hover:text-white transition-colors inline-flex items-center space-x-1"
                              >
                                <ArrowUpDown className="w-3.5 h-3.5" />
                                <span>Transact</span>
                              </button>

                              <button
                                onClick={() => setHistoryItem(item)}
                                className="p-1.5 rounded-full text-muted hover:text-navy hover:bg-slate-100 transition-colors"
                                title="Transaction History"
                              >
                                <History className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => {
                                  setFormError(null);
                                  const suggested = Math.max(
                                    item.min_quantity,
                                    Math.round(2 * item.min_quantity - item.quantity),
                                  );
                                  setRestockModalItem({ item, suggestedQty: suggested });
                                }}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border text-navy hover:border-primary hover:text-primary transition-colors inline-flex items-center space-x-1"
                                title="Request Restock"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                <span>Restock</span>
                              </button>
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
        )}

        {/* TAB 2: RESTOCK REQUESTS TAB */}
        {activeTab === 'restock' && (
          <div className="p-6 space-y-5">
            {/* Action & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setFormError(null);
                    setIsNewRestockModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-full text-xs font-bold bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm inline-flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Restock Request</span>
                </button>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <Filter className="w-4 h-4 text-muted" />
                <span className="text-xs font-semibold text-muted uppercase">Filter Status:</span>
                <select
                  value={restockStatusFilter}
                  onChange={(e) => setRestockStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="ALL">All Requests</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="ORDERED">Ordered</option>
                  <option value="RECEIVED">Received</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            {/* Restock Requests Table */}
            {isRestockLoading ? (
              <div className="py-16 text-center text-muted">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-sm">Loading restock orders...</p>
              </div>
            ) : isRestockError ? (
              <div className="py-12 bg-status-critical-bg/30 border border-status-critical/30 rounded-2xl p-6 text-center">
                <AlertCircle className="w-8 h-8 text-status-critical mx-auto mb-2" />
                <p className="text-sm font-bold text-navy">Failed to load restock requests</p>
                <p className="text-xs text-muted mt-1">{(restockError as any)?.message}</p>
                <button
                  onClick={() => refetchRestock()}
                  className="mt-4 px-4 py-1.5 rounded-full text-xs font-semibold bg-white border border-border text-navy hover:bg-slate-50"
                >
                  Retry
                </button>
              </div>
            ) : (restockData?.requests || []).length === 0 ? (
              <div className="py-16 text-center text-muted">
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-muted/50" />
                <p className="text-sm font-semibold text-navy">No restock requests found</p>
                <p className="text-xs text-muted mt-1">
                  {restockStatusFilter !== 'ALL'
                    ? 'No requests match the selected status filter.'
                    : 'Click "New Restock Request" or "Restock" from a stock row to initiate an order.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-left text-sm border-collapse min-w-[760px]">
                  <thead>
                    <tr className="bg-[#F8FAFD] border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wider">
                      <th className="py-3 px-6">Item</th>
                      <th className="py-3 px-4">Material</th>
                      <th className="py-3 px-4 text-right">Requested Qty</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Requested By</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-6 text-right">Workflow Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(restockData?.requests || []).map((req) => {
                      const isPending = req.status === 'PENDING';
                      const isApproved = req.status === 'APPROVED';
                      const isOrdered = req.status === 'ORDERED';
                      const isReceived = req.status === 'RECEIVED';
                      const isRejected = req.status === 'REJECTED';

                      return (
                        <tr key={req.id} className="hover:bg-[#F8FAFD] transition-colors">
                          <td className="py-4 px-6 font-bold text-navy">
                            {req.item?.name || 'Item'}
                          </td>

                          <td className="py-4 px-4 text-muted">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-soft text-primary">
                              {req.item?.material || 'Material'}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-right font-bold text-navy">
                            {req.quantity.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-muted">{req.item?.unit}</span>
                          </td>

                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                isReceived
                                  ? 'bg-status-success-bg text-status-success'
                                  : isRejected
                                  ? 'bg-status-critical-bg text-status-critical'
                                  : isOrdered
                                  ? 'bg-status-info-bg text-status-info'
                                  : isApproved
                                  ? 'bg-accent-soft text-navy'
                                  : 'bg-status-warning-bg text-status-warning'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  isReceived
                                    ? 'bg-status-success'
                                    : isRejected
                                    ? 'bg-status-critical'
                                    : isOrdered
                                    ? 'bg-status-info'
                                    : isApproved
                                    ? 'bg-accent'
                                    : 'bg-status-warning'
                                }`}
                              />
                              {req.status}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-text font-medium">
                            {req.user?.name || req.user?.email || 'Staff'}
                          </td>

                          <td className="py-4 px-4 text-muted text-xs whitespace-nowrap">
                            {new Date(req.created_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>

                          {/* Action Buttons based on allowed transitions */}
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <div className="inline-flex items-center space-x-2 justify-end">
                              {/* PENDING -> Approve or Reject */}
                              {isPending && (
                                <>
                                  <button
                                    onClick={() =>
                                      updateRestockMutation.mutate({
                                        id: req.id,
                                        data: { action: 'approve' },
                                      })
                                    }
                                    disabled={updateRestockMutation.isPending}
                                    className="px-3 py-1 rounded-full text-xs font-bold bg-accent text-navy hover:opacity-90 transition-opacity inline-flex items-center space-x-1"
                                    title="Approve Restock"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Approve</span>
                                  </button>

                                  <button
                                    onClick={() =>
                                      updateRestockMutation.mutate({
                                        id: req.id,
                                        data: { action: 'reject' },
                                      })
                                    }
                                    disabled={updateRestockMutation.isPending}
                                    className="px-3 py-1 rounded-full text-xs font-bold bg-status-critical-bg text-status-critical hover:bg-status-critical hover:text-white transition-colors inline-flex items-center space-x-1"
                                    title="Reject Restock"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

                              {/* APPROVED -> Mark Ordered or Mark Received */}
                              {isApproved && (
                                <>
                                  <button
                                    onClick={() =>
                                      updateRestockMutation.mutate({
                                        id: req.id,
                                        data: { action: 'order' },
                                      })
                                    }
                                    disabled={updateRestockMutation.isPending}
                                    className="px-3 py-1 rounded-full text-xs font-bold bg-status-info-bg text-status-info hover:bg-status-info hover:text-white transition-colors inline-flex items-center space-x-1"
                                    title="Mark Ordered with Vendor"
                                  >
                                    <Truck className="w-3.5 h-3.5" />
                                    <span>Mark Ordered</span>
                                  </button>

                                  <button
                                    onClick={() =>
                                      updateRestockMutation.mutate({
                                        id: req.id,
                                        data: { action: 'receive' },
                                      })
                                    }
                                    disabled={updateRestockMutation.isPending}
                                    className="px-3 py-1 rounded-full text-xs font-bold bg-status-success-bg text-status-success hover:bg-status-success hover:text-white transition-colors inline-flex items-center space-x-1"
                                    title="Receive Inventory Stock"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Receive</span>
                                  </button>
                                </>
                              )}

                              {/* ORDERED -> Mark Received */}
                              {isOrdered && (
                                <button
                                  onClick={() =>
                                    updateRestockMutation.mutate({
                                      id: req.id,
                                      data: { action: 'receive' },
                                    })
                                  }
                                  disabled={updateRestockMutation.isPending}
                                  className="px-3.5 py-1 rounded-full text-xs font-bold bg-status-success text-white hover:opacity-90 transition-opacity inline-flex items-center space-x-1 shadow-sm"
                                  title="Receive Inventory Stock"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Receive Stock</span>
                                </button>
                              )}

                              {/* Terminal States */}
                              {isReceived && (
                                <span className="text-xs font-semibold text-status-success inline-flex items-center space-x-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Fulfilled</span>
                                </span>
                              )}

                              {isRejected && (
                                <span className="text-xs font-semibold text-status-critical inline-flex items-center space-x-1">
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Rejected</span>
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
        )}
      </div>

      {/* ==========================================
          MODAL 1: ADD ITEM MODAL
      ========================================== */}
      {isAddItemOpen && (
        <AddItemModal
          onClose={() => setIsAddItemOpen(false)}
          onSubmit={(data) => createItemMutation.mutate(data)}
          isLoading={createItemMutation.isPending}
          error={formError}
        />
      )}

      {/* ==========================================
          MODAL 2: EDIT ITEM MODAL (No Quantity)
      ========================================== */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSubmit={(data) => updateItemMutation.mutate({ id: editingItem.id, data })}
          isLoading={updateItemMutation.isPending}
          error={formError}
        />
      )}

      {/* ==========================================
          MODAL 3: RECORD TRANSACTION MODAL
      ========================================== */}
      {transactionItem && (
        <TransactionModal
          item={transactionItem}
          onClose={() => setTransactionItem(null)}
          onSubmit={(data) =>
            recordTransactionMutation.mutate({ id: transactionItem.id, data })
          }
          isLoading={recordTransactionMutation.isPending}
          error={formError}
        />
      )}

      {/* ==========================================
          DRAWER: TRANSACTION HISTORY
      ========================================== */}
      {historyItem && (
        <HistoryDrawer
          item={historyItem}
          transactions={historyData?.transactions || []}
          isLoading={isHistoryLoading}
          onClose={() => setHistoryItem(null)}
        />
      )}

      {/* ==========================================
          MODAL 4: REQUEST RESTOCK MODAL (Row Prefill)
      ========================================== */}
      {restockModalItem && (
        <RestockRequestModal
          item={restockModalItem.item}
          initialQuantity={restockModalItem.suggestedQty}
          onClose={() => setRestockModalItem(null)}
          onSubmit={(qty) =>
            createRestockMutation.mutate({
              item_id: restockModalItem.item.id,
              quantity: qty,
            })
          }
          isLoading={createRestockMutation.isPending}
          error={formError}
        />
      )}

      {/* ==========================================
          MODAL 5: NEW RESTOCK REQUEST (Select Item)
      ========================================== */}
      {isNewRestockModalOpen && (
        <NewRestockRequestModal
          items={items}
          onClose={() => setIsNewRestockModalOpen(false)}
          onSubmit={(data) => createRestockMutation.mutate(data)}
          isLoading={createRestockMutation.isPending}
          error={formError}
        />
      )}
    </div>
  );
};

// =========================================================================
// SUBCOMPONENTS: MODALS & DRAWERS
// =========================================================================

// ADD ITEM MODAL
interface AddItemModalProps {
  onClose: () => void;
  onSubmit: (data: CreateInventoryItemInput) => void;
  isLoading: boolean;
  error: string | null;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ onClose, onSubmit, isLoading, error }) => {
  const [name, setName] = useState('');
  const [material, setMaterial] = useState('LN2');
  const [unit, setUnit] = useState('Liters');
  const [quantity, setQuantity] = useState<number>(100);
  const [minQuantity, setMinQuantity] = useState<number>(50);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      material: material.trim(),
      unit: unit.trim(),
      quantity: Number(quantity) || 0,
      min_quantity: Number(minQuantity) || 1,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1633]/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-card w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-navy">Add Inventory Item</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-muted hover:text-navy hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-status-critical-bg text-status-critical text-xs font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted uppercase mb-1">
              Item Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Liquid Oxygen Bulk Tank"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1">
                Material / Category *
              </label>
              <input
                type="text"
                required
                placeholder="LN2, LOX, PPE, Parts"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1">
                Unit of Measure *
              </label>
              <input
                type="text"
                required
                placeholder="Liters, Units, Pairs, Kg"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1">
                Initial Stock Quantity
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <p className="text-[11px] text-muted mt-1">Writes Initial Stock transaction.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1">
                Minimum Alert Threshold *
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                value={minQuantity}
                onChange={(e) => setMinQuantity(Number(e.target.value))}
                className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <p className="text-[11px] text-muted mt-1">Triggers low-stock alert when below.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-sm font-semibold border border-border text-navy hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 rounded-full text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// EDIT ITEM MODAL (NO QUANTITY EDIT)
interface EditItemModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSubmit: (data: UpdateInventoryItemInput) => void;
  isLoading: boolean;
  error: string | null;
}

const EditItemModal: React.FC<EditItemModalProps> = ({ item, onClose, onSubmit, isLoading, error }) => {
  const [name, setName] = useState(item.name);
  const [material, setMaterial] = useState(item.material);
  const [unit, setUnit] = useState(item.unit);
  const [minQuantity, setMinQuantity] = useState(item.min_quantity);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      material: material.trim(),
      unit: unit.trim(),
      min_quantity: Number(minQuantity),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1633]/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-card w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-navy">Edit Item Parameters</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-muted hover:text-navy hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-status-critical-bg text-status-critical text-xs font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted uppercase mb-1">
              Item Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1">
                Material / Category
              </label>
              <input
                type="text"
                required
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1">
                Unit of Measure
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase mb-1">
              Minimum Alert Threshold ({unit}) *
            </label>
            <input
              type="number"
              min="0.1"
              step="any"
              required
              value={minQuantity}
              onChange={(e) => setMinQuantity(Number(e.target.value))}
              className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Note regarding quantity */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFD] border border-border text-xs text-muted flex items-start space-x-2">
            <Package className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>
              Current physical stock is <strong>{item.quantity} {item.unit}</strong>. Stock quantities can only be modified through audited <strong>Record Transaction</strong> operations.
            </span>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-sm font-semibold border border-border text-navy hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 rounded-full text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// RECORD TRANSACTION MODAL (LIVE PREVIEW & NEGATIVE PREVENTION)
interface TransactionModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSubmit: (data: CreateTransactionInput) => void;
  isLoading: boolean;
  error: string | null;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ item, onClose, onSubmit, isLoading, error }) => {
  const [type, setType] = useState<TransactionType>('OUT');
  const [rawQuantity, setRawQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  const numQty = parseFloat(rawQuantity) || 0;

  // Compute live preview
  let newQuantity = item.quantity;
  if (type === 'IN') {
    newQuantity = item.quantity + Math.abs(numQty);
  } else if (type === 'OUT') {
    newQuantity = item.quantity - Math.abs(numQty);
  } else if (type === 'ADJUST') {
    newQuantity = item.quantity + numQty;
  }

  const isNegative = newQuantity < 0;
  const isBelowMin = newQuantity < item.min_quantity;
  const isCritBelow = newQuantity < 0.5 * item.min_quantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNegative) return;
    if (type === 'ADJUST' && !reason.trim()) return;

    onSubmit({
      type,
      quantity: type === 'ADJUST' ? numQty : Math.abs(numQty),
      reason: reason.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1633]/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-card w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
              <ArrowUpDown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-navy">Record Stock Transaction</h3>
              <p className="text-xs text-muted">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-muted hover:text-navy hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-status-critical-bg text-status-critical text-xs font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Stock Banner */}
          <div className="p-4 rounded-xl bg-[#F8FAFD] border border-border flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted uppercase block">Current Balance</span>
              <span className="text-xl font-bold text-navy">
                {item.quantity.toLocaleString()} {item.unit}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-muted uppercase block">Min Threshold</span>
              <span className="text-sm font-semibold text-text">
                {item.min_quantity.toLocaleString()} {item.unit}
              </span>
            </div>
          </div>

          {/* Transaction Type Radio Selector */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase mb-2">
              Transaction Action
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('OUT')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                  type === 'OUT'
                    ? 'bg-status-warning-bg border-status-warning text-status-warning'
                    : 'bg-white border-border text-muted hover:text-navy'
                }`}
              >
                OUT (Withdraw)
              </button>

              <button
                type="button"
                onClick={() => setType('IN')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                  type === 'IN'
                    ? 'bg-status-success-bg border-status-success text-status-success'
                    : 'bg-white border-border text-muted hover:text-navy'
                }`}
              >
                IN (Deposit)
              </button>

              <button
                type="button"
                onClick={() => setType('ADJUST')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                  type === 'ADJUST'
                    ? 'bg-primary-soft border-primary text-primary'
                    : 'bg-white border-border text-muted hover:text-navy'
                }`}
              >
                ADJUST (Delta)
              </button>
            </div>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase mb-1">
              {type === 'ADJUST' ? 'Adjustment Delta (+ / -)' : 'Transaction Quantity'} ({item.unit}) *
            </label>
            <input
              type="number"
              step="any"
              required
              placeholder={type === 'ADJUST' ? 'e.g. -50 or +100' : 'e.g. 100'}
              value={rawQuantity}
              onChange={(e) => setRawQuantity(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase mb-1">
              Reason / Notes {type === 'ADJUST' && <span className="text-status-critical">*</span>}
            </label>
            <input
              type="text"
              required={type === 'ADJUST'}
              placeholder={
                type === 'ADJUST'
                  ? 'Audit reason is required for manual stock adjustments'
                  : 'Optional description or requisition reference'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Live Preview Box */}
          {rawQuantity && (
            <div
              className={`p-4 rounded-xl border transition-all ${
                isNegative
                  ? 'bg-status-critical-bg/60 border-status-critical text-status-critical'
                  : isCritBelow
                  ? 'bg-status-critical-bg/30 border-status-critical/50 text-navy'
                  : isBelowMin
                  ? 'bg-status-warning-bg/40 border-status-warning text-navy'
                  : 'bg-[#F8FAFD] border-border text-navy'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Live Preview:</span>
                <span className="text-base font-bold">
                  New Quantity: {newQuantity.toLocaleString()} {item.unit}
                </span>
              </div>

              {isNegative ? (
                <p className="text-xs font-bold text-status-critical mt-1 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                  <span>Cannot submit: stock would drop below zero ({newQuantity} {item.unit}).</span>
                </p>
              ) : isCritBelow ? (
                <p className="text-xs font-semibold text-status-critical mt-1 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                  <span>Warning: will trigger a CRITICAL low-stock alert (&lt; 50% threshold).</span>
                </p>
              ) : isBelowMin ? (
                <p className="text-xs font-semibold text-status-warning mt-1 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                  <span>Warning: will trigger a LOW stock alert (&lt; {item.min_quantity} {item.unit}).</span>
                </p>
              ) : (
                <p className="text-xs text-status-success mt-1 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                  <span>Stock level will remain nominal (GOOD).</span>
                </p>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-border flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-sm font-semibold border border-border text-navy hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isNegative || !rawQuantity || numQty === 0}
              className="px-6 py-2.5 rounded-full text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50"
            >
              {isLoading ? 'Recording...' : 'Submit Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// TRANSACTION HISTORY DRAWER
interface HistoryDrawerProps {
  item: InventoryItem;
  transactions: InventoryTransaction[];
  isLoading: boolean;
  onClose: () => void;
}

const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ item, transactions, isLoading, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-[#0B1633]/40 backdrop-blur-sm flex justify-end">
      <div className="bg-surface border-l border-border w-full max-w-lg h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-navy">Transaction History</h3>
              <p className="text-xs text-muted">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-muted hover:text-navy hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-muted">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm">Loading ledger history...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center text-muted">
              <History className="w-10 h-10 mx-auto mb-2 text-muted/50" />
              <p className="text-sm font-semibold text-navy">No transactions recorded yet</p>
              <p className="text-xs text-muted mt-1">
                Stock changes and audits will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const isDeposit = tx.type === 'IN';
                const isWithdraw = tx.type === 'OUT';

                return (
                  <div
                    key={tx.id}
                    className="p-4 rounded-xl border border-border bg-[#F8FAFD] space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          isDeposit
                            ? 'bg-status-success-bg text-status-success'
                            : isWithdraw
                            ? 'bg-status-warning-bg text-status-warning'
                            : 'bg-primary-soft text-primary'
                        }`}
                      >
                        {tx.type}
                      </span>
                      <span className="text-sm font-bold text-navy">
                        {isDeposit ? '+' : isWithdraw ? '-' : ''}
                        {tx.quantity.toLocaleString()} {item.unit}
                      </span>
                    </div>

                    <p className="text-xs text-text font-medium leading-relaxed">
                      {tx.reason || 'No description provided'}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-muted pt-2 border-t border-border/60">
                      <span>By: {tx.user?.name || tx.user?.email || 'System'}</span>
                      <span>
                        {new Date(tx.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// REQUEST RESTOCK MODAL (ROW PREFILL)
interface RestockRequestModalProps {
  item: InventoryItem;
  initialQuantity: number;
  onClose: () => void;
  onSubmit: (quantity: number) => void;
  isLoading: boolean;
  error: string | null;
}

const RestockRequestModal: React.FC<RestockRequestModalProps> = ({
  item,
  initialQuantity,
  onClose,
  onSubmit,
  isLoading,
  error,
}) => {
  const [quantity, setQuantity] = useState<number>(initialQuantity);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(Number(quantity));
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1633]/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-card w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-navy">Initiate Restock Request</h3>
              <p className="text-xs text-muted">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-muted hover:text-navy hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-status-critical-bg text-status-critical text-xs font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-4 rounded-xl bg-[#F8FAFD] border border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Current Stock:</span>
              <span className="font-bold text-navy">{item.quantity} {item.unit}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Minimum Threshold:</span>
              <span className="font-bold text-navy">{item.min_quantity} {item.unit}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
              <span className="text-muted">Suggested Target (2x Min - Stock):</span>
              <span className="font-bold text-primary">{initialQuantity} {item.unit}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase mb-1">
              Replenishment Order Quantity ({item.unit}) *
            </label>
            <input
              type="number"
              min="1"
              step="any"
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-sm font-semibold border border-border text-navy hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !quantity || quantity <= 0}
              className="px-6 py-2.5 rounded-full text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50"
            >
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// NEW RESTOCK REQUEST MODAL (SELECT FROM DROPDOWN)
interface NewRestockRequestModalProps {
  items: InventoryItem[];
  onClose: () => void;
  onSubmit: (data: CreateRestockRequestInput) => void;
  isLoading: boolean;
  error: string | null;
}

const NewRestockRequestModal: React.FC<NewRestockRequestModalProps> = ({
  items,
  onClose,
  onSubmit,
  isLoading,
  error,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(500);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) return;
    onSubmit({
      item_id: selectedItemId,
      quantity: Number(quantity),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1633]/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-card w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-navy">New Restock Request</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-muted hover:text-navy hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-status-critical-bg text-status-critical text-xs font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted uppercase mb-1">
              Select Inventory Item *
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (Current: {item.quantity} {item.unit}, Min: {item.min_quantity})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase mb-1">
              Order Quantity ({selectedItem?.unit || 'Units'}) *
            </label>
            <input
              type="number"
              min="1"
              step="any"
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full h-11 px-3.5 rounded-xl text-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-sm font-semibold border border-border text-navy hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !quantity || quantity <= 0}
              className="px-6 py-2.5 rounded-full text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
