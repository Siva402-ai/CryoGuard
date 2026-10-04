import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  recordTransaction,
  getItemTransactions,
  getRestockRequests,
  createRestockRequest,
  updateRestockRequestStatus,
} from '../controllers/inventory.controller';

export const inventoryRouter = Router();
export const restockRouter = Router();

// All inventory endpoints require authentication (any role: ADMIN or STAFF)
inventoryRouter.use(requireAuth);
inventoryRouter.get('/', getInventoryItems);
inventoryRouter.post('/', createInventoryItem);
inventoryRouter.put('/:id', updateInventoryItem);
inventoryRouter.post('/:id/transactions', recordTransaction);
inventoryRouter.get('/:id/transactions', getItemTransactions);

// Restock request endpoints
restockRouter.use(requireAuth);
restockRouter.get('/', getRestockRequests);
restockRouter.post('/', createRestockRequest);
restockRouter.patch('/:id', updateRestockRequestStatus);
