# API Overview

All endpoints except `POST /api/auth/login` and `GET /api/health` require:
`Authorization: Bearer <JWT>`

- `POST /api/auth/login` — `{ email, password }`
- `GET /api/auth/me` — current admin
- `PATCH /api/auth/password` — `{ currentPassword, newPassword }`
- `GET /api/students?q=&page=&limit=` — paginated student list
- `POST /api/students` — create student
- `PATCH /api/students/:id` — update profile or active state
- `PUT /api/students/:id/face` — `{ descriptors: [front, left, right, up, down] }`
- `DELETE /api/students/:id/face` — delete descriptor
- `GET /api/students/face-templates` — active student templates for browser matching
- `GET /api/events` — list events
- `POST /api/events` — create event
- `PATCH /api/events/:id` — update event
- `DELETE /api/events/:id` — archive event
- `GET /api/attendance?eventId=&studentId=` — list attendance
- `POST /api/attendance/record` — `{ studentId, eventId, action: "timeIn"|"timeOut", source }`
- `PATCH /api/attendance/:id/correct` — correction values and required reason
- `GET /api/dashboard` — summary and recent attendance
- `GET /api/reports/attendance.csv` — CSV export
- `GET /api/audit` — audit trail
