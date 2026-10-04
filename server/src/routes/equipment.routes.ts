import { Router } from 'express';
import {
  getEquipmentList,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  getEquipmentReadings,
} from '../controllers/equipment.controller';
import { requireAuth } from '../middleware/auth';

export const equipmentRouter = Router();

// All equipment endpoints require valid authentication (accessible to both ADMIN and STAFF)
equipmentRouter.use(requireAuth);

equipmentRouter.get('/', getEquipmentList);
equipmentRouter.post('/', createEquipment);
equipmentRouter.get('/:id', getEquipmentById);
equipmentRouter.put('/:id', updateEquipment);
equipmentRouter.delete('/:id', deleteEquipment);
equipmentRouter.get('/:id/readings', getEquipmentReadings);
