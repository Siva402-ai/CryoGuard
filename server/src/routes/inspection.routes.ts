import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getInspectionTemplates,
  createInspectionTemplate,
  getInspections,
  createInspection,
  getInspectionById,
} from '../controllers/inspection.controller';

export const inspectionTemplateRouter = Router();
inspectionTemplateRouter.use(requireAuth);

inspectionTemplateRouter.get('/', getInspectionTemplates);
inspectionTemplateRouter.post('/', createInspectionTemplate);

export const inspectionRouter = Router();
inspectionRouter.use(requireAuth);

inspectionRouter.get('/', getInspections);
inspectionRouter.post('/', createInspection);
inspectionRouter.get('/:id', getInspectionById);
