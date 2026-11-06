import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { config } from './config.js';
import { connectDatabase } from './db.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import eventRoutes from './routes/events.js';
import attendanceRoutes from './routes/attendance.js';
import dashboardRoutes from './routes/dashboard.js';
import auditRoutes from './routes/audit.js';
import reportRoutes from './routes/reports.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.clientOrigin.split(',').map(s => s.trim()), credentials: false, maxAge: 86400 }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', authRoutes);
app.use('/api/students', requireAuth, studentRoutes);
app.use('/api/events', requireAuth, eventRoutes);
app.use('/api/attendance', requireAuth, attendanceRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/audit', requireAuth, auditRoutes);
app.use('/api/reports', requireAuth, reportRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 11000) return res.status(409).json({ message: 'A record with that unique value already exists' });
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

connectDatabase().then(() => app.listen(config.port, () => console.log(`API listening on ${config.port}`)))
  .catch(error => { console.error('Startup failed:', error); process.exit(1); });
