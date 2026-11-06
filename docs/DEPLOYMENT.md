# Deployment checklist

1. Set `NODE_ENV=production`, a long random `JWT_SECRET`, `MONGODB_URI`, and exact `CLIENT_ORIGIN`.
2. Use HTTPS for frontend and API.
3. Restrict MongoDB network access and use a least-privilege database user.
4. Configure backups, monitoring, and log retention.
5. Seed the first administrator once, then change the initial password.
6. Do not commit `.env` files or face descriptors.
7. Confirm privacy notice, consent/authority, retention period, deletion process, and manual alternative with the school before biometric enrollment.
8. Evaluate face match performance under actual lighting, camera, and demographic conditions before operational use.
