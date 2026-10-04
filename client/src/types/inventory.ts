export type StockStatus = 'GOOD' | 'LOW' | 'CRITICAL';
export type TransactionType = 'IN' | 'OUT' | 'ADJUST';
export type RestockStatus = 'PENDING' | 'APPROVED' | 'ORDERED' | 'RECEIVED' | 'REJECTED';

export interface InventoryItem {
  id: string;
  name: string;
  material: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  stockStatus: StockStatus;
  hasOpenRestock?: boolean;
  openRestockRequest?: RestockRequest | null;
}

export interface InventoryTransaction {
  id: string;
  item_id: string;
  type: TransactionType;
  quantity: number;
  reason: string | null;
  user_id: string;
  created_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface RestockRequest {
  id: string;
  item_id: string;
  quantity: number;
  status: RestockStatus;
  requested_by: string;
  created_at: string;
  item?: {
    id: string;
    name: string;
    material: string;
    unit: string;
    quantity: number;
    min_quantity: number;
    stockStatus?: StockStatus;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateInventoryItemInput {
  name: string;
  material: string;
  unit: string;
  quantity?: number;
  min_quantity: number;
}

export interface UpdateInventoryItemInput {
  name?: string;
  material?: string;
  unit?: string;
  min_quantity?: number;
}

export interface CreateTransactionInput {
  type: TransactionType;
  quantity: number;
  reason?: string;
}

export interface CreateRestockRequestInput {
  item_id: string;
  quantity: number;
}

export interface PatchRestockRequestInput {
  action: 'approve' | 'reject' | 'order' | 'receive';
}
