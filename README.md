# Student Event Attendance System — Full MERN Starter

Admin-only attendance management system for Passi City College.

## Included
- Admin login with JWT authentication
- Student create, edit, deactivate/reactivate, and search
- Event create, edit, archive, and event list
- Attendance records with Time-In / Time-Out and duplicate protection
- Manual attendance entry and correction with reason
- Dashboard statistics
- CSV export for attendance
- Audit log for administrative actions
- Optional browser-side face enrollment and matching using face-api.js

## Requirements
- Node.js 20+
- MongoDB 6+ (local or Atlas)
- npm

## 1. Configure backend
```bash
cd backend
cp .env.example .env
npm install
npm run seed:admin
npm run dev
```
Edit `.env` before seeding. The default seed admin is created from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.

## 2. Configure frontend
Open another terminal:
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Open the Vite URL (normally http://localhost:5173).

## Face recognition setup
Face recognition is optional. The app stores face descriptors, not face photographs. To enable it:
1. Run `cd frontend && npm run download:models`.
2. Ensure the browser can access `/models`.
3. Enroll each student with a clear, front-facing image in good lighting.
4. Use the Attendance Scanner page. Matching happens in the browser; the server receives only the selected student ID and attendance action.
5. If models or camera are unavailable, use manual attendance.

**Important:** This is a development starter, not a certified biometric attendance product. Before using real student data, obtain school approval, complete a privacy impact assessment and legal review, define retention/deletion rules, secure the hosting environment, and evaluate false-match / false-reject rates. Always provide a manual alternative. Do not use face matching as the sole basis for disciplinary action.

## Tests
```bash
cd backend
npm test
```

## Production
Build frontend with `npm run build`, serve the `frontend/dist` directory from a static host, and deploy the backend separately. Use HTTPS, a strong JWT secret, managed MongoDB access controls, backups, rate limiting, and a secure admin password.

## Frontend organization
Pages are separated under `frontend/src/pages`, reusable UI and layout under `frontend/src/components`, and API access under `frontend/src/services`.

- Five-angle face enrollment (front, left, right, up, down)
- Administrator password settings
