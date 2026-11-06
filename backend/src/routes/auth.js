import { Router } from 'express';
import { Admin } from '../models.js';
import { verifyPassword, createToken, hashPassword } from '../security.js';
import { asyncHandler } from '../utils.js';
import { audit } from '../services/audit.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const admin = await Admin.findOne({ email });
  if (!admin || !admin.active || !(await verifyPassword(password, admin.passwordHash))) {
    return res.status(401).json({ message: 'Incorrect email or password' });
  }
  admin.lastLoginAt = new Date();
  await admin.save();
  const token = createToken(admin);
  await audit({ admin, ip: req.ip }, 'ADMIN_LOGIN', 'Admin', admin._id.toString());
  res.json({ token, admin: { id: admin._id, name: admin.name, email: admin.email } });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ admin: { id: req.admin._id, name: req.admin.name, email: req.admin.email } });
}));

router.patch('/password', requireAuth, asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < 10) return res.status(400).json({ message: 'New password must be at least 10 characters' });
  const admin = await Admin.findById(req.admin._id);
  if (!(await verifyPassword(currentPassword, admin.passwordHash))) return res.status(400).json({ message: 'Current password is incorrect' });
  admin.passwordHash = await hashPassword(newPassword);
  await admin.save();
  await audit(req, 'ADMIN_PASSWORD_CHANGED', 'Admin', admin._id.toString());
  res.json({ message: 'Password updated. Please sign in again.' });
}));

export default router;
