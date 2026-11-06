import { Router } from 'express';
import { AuditLog } from '../models.js';
import { asyncHandler } from '../utils.js';
const router = Router();
router.get('/', asyncHandler(async (req, res) => {
  const items = await AuditLog.find().populate('actor', 'name email').sort({ createdAt: -1 }).limit(200);
  res.json({ items });
}));
export default router;
