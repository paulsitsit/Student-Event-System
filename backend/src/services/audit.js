import { AuditLog } from '../models.js';

export async function audit(req, action, entityType = '', entityId = '', details = {}) {
  try {
    await AuditLog.create({
      actor: req.admin?._id,
      action, entityType, entityId,
      details,
      ip: req.ip || ''
    });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
}
