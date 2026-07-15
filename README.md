# HRMS

An enterprise HR management system built as a MERN application. The project
uses a layered backend (`route -> middleware -> controller -> service ->
repository -> model`) and a feature-based React frontend.

## Current state

### Backend

The Express API lives in `server/src` and currently includes:

- Authentication: login, logout, `/me`, refresh-token sessions, bcrypt password
  checks, and HttpOnly cookie-based JWT authentication.
- Employees: CRUD, search and filters, status changes, promotion and salary
  history, department statistics, encrypted CNIC and salary fields, and soft
  deactivation.
- Attendance: sign-in/out, late and early-leave calculations, monthly summaries,
  manual corrections, regularization requests and reviews, tenant-aware access,
  and validated request inputs.
- Leaves: applications, approval/rejection/cancellation flows, and pending
  approvals.
- Payroll, expenses, and projects: domain models, API workflows, and role-based
  operations.
- Dashboard aggregation and holiday endpoints.
- Shared infrastructure for MongoDB, Redis-backed rate limiting, BullMQ, email,
  Socket.IO, logging, encryption, RBAC, and tenant/IDOR protection.

API routes are mounted below `/api/v1`; `/health` is public.

### Frontend

The Vite/React application lives in `client/src` and includes:

- Redux Toolkit and a shared RTK Query cache.
- Cookie authentication with silent access-token refresh.
- Role-aware protected routes and navigation.
- Dashboards for admin, HR, and employee roles.
- Working pages for employees, attendance, leaves, payroll, expenses, projects,
  reports, settings, and notifications.
- Reusable UI primitives, responsive layouts, dark mode, charts, dialogs, and
  toast notifications.

Some settings, reports, and notification experiences currently have frontend UI
without complete dedicated backend modules.

## Project layout

```text
client/                    React 18 + Vite + Tailwind
  src/features/            Feature pages, API endpoints, routes, and state
  src/components/          Shared layout and UI components
server/                    Node.js + Express + Mongoose
  src/modules/             Domain modules and layered business logic
  src/middlewares/         Authentication, authorization, tenant, validation
  scripts/seed.js          Development demo users
docker-compose.yml         MongoDB, Redis, API, and web application
```

## Run with Docker

1. Copy `server/.env.example` to `server/.env`.
2. Replace all placeholder secrets with strong values. Each documented 64-character
   hex secret can be generated with `openssl rand -hex 32`.
3. Start the stack:

```bash
docker compose up --build
```

The frontend runs on `http://localhost:5173`, the API on
`http://localhost:5000`, MongoDB on `27017`, and Redis on `6379`.

To create development demo accounts after the services are running:

```bash
docker compose exec server npm run seed
```

The seed command prints the demo credentials it creates. Do not use those
credentials outside a local development environment.

## Local verification

```bash
cd server
npm ci

cd ../client
npm ci
npm run build
node check-imports.cjs
```

The API requires valid environment secrets and running MongoDB/Redis services for
end-to-end execution.

## Next priorities

1. Add automated unit and integration tests for authentication, tenant isolation,
   employees, and attendance.
2. Apply the shared Joi validation middleware to leaves, payroll, expenses, and
   projects; several older validation schemas are still permissive.
3. Move office hours, grace periods, leave rules, and payroll formulas from
   environment defaults into company settings.
4. Complete backend modules for settings, notifications, reports, recruitment,
   onboarding, documents, assets, performance, training, and audit logs.
5. Review and upgrade vulnerable/deprecated npm dependencies with regression
   testing before applying breaking major-version updates.
