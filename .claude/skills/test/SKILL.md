# /test - Run Tests

Run unit tests or E2E tests.

## Instructions

Accept an optional argument: `unit`, `e2e`, or `all` (default: `unit`).

### Options:
- `unit` (default): Run `npm run test` - Jest unit tests
- `e2e`: Run E2E tests (requires backend on port 3000 and frontend on port 5173)
  - First verify backend is running: `curl -s http://localhost:3000/api/health`
  - Then run: `npm run test:e2e` (in frontend directory)
- `all`: Run both unit and E2E tests

### E2E Prerequisites:
1. Backend running: `npm run start:dev` (in magnetic-backend)
2. Seeds executed: `npm run seed:demo`
3. Frontend running: `npm run dev` (in magnetic-frontend)

### E2E Test Files:
- `auth.spec.ts` - Login, register, forgot password (8 tests)
- `dashboard.spec.ts` - Products, TopBanner, AI, FAQ (7 tests)
- `connect-product.spec.ts` - Connection modal, metrics (5 tests)
- `admin.spec.ts` - Admin panel, CRUD, access control (8 tests)
- `profile.spec.ts` - Profile, change password (8 tests)
- `forgot-password.spec.ts` - Password recovery, registration (9 tests)

Total: 45+ tests
