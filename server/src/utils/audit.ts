import { prisma } from '../db/prisma';

export interface AuditParams {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  meta?: any;
}

export async function writeAudit({ userId, action, entity, entityId, meta }: AuditParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        user_id: userId || null,
        action,
        entity,
        entity_id: entityId,
        meta: meta !== undefined ? meta : undefined,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
    return null;
  }
}
