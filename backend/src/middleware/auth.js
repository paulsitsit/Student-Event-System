import { verifyToken } from '../security.js';
import { Admin } from '../models.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const payload = verifyToken(token);
    const admin = await Admin.findById(payload.sub).select('_id name email active');
    if (!admin || !admin.active) return res.status(401).json({ message: 'Admin account unavailable' });
    req.admin = admin;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}
