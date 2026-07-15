# HRMS — Project Skeleton

This is the **wired skeleton** for the full Enterprise HRMS: every module and
feature folder exists, every file imports/exports correctly, and the request
path — route → middleware → controller → service → repository → model — is
real, working code for each module (not `// TODO` placeholders). What's
**not** filled in yet is deep business logic specific to each domain (late-policy
math, multi-stage leave approval rules, payroll formulas, animated dashboards).

## What's included right now

**Backend** (`server/src/modules/`): `auth`, `employees`, `attendance`,
`leaves`, `payroll`, `expenses`, `projects` — each with:
`model.js · repository.js · service.js · controller.js · routes.js · validation.js`

- `auth` additionally has a **real, working login flow**: bcrypt password
  check, HttpOnly cookie-based access/refresh tokens, session storage, logout,
  and `/me`. This is the one module you can actually test end-to-end today.
- Shared backend: `config/` (redis, rate limiter, bullmq, mailer, socket.io),
  `middlewares/auth.middleware.js` (JWT + RBAC + IDOR guard), `utils/crypto.js`
  (AES-256-GCM field encryption), `utils/logger.js`, `database/db.js`, `app.js`, `server.js`.

**Frontend** (`client/src/features/`): `auth`, `dashboard`, `employees`,
`attendance`, `leaves`, `payroll`, `expenses`, `projects` — each with:
`api/*.api.js` (RTK Query) · `store/*.slice.js` · `routes/*.routes.js` ·
`validation/*.validation.js` · `pages/*ListPage.jsx`

- `auth` has a real login page wired to the login mutation + session slice.
- Shared frontend: `services/apiSlice.js` (single shared RTK Query cache),
  `utils/axios.js` (cookie auth + silent refresh), `store/index.js`,
  `components/common/AppLayout.jsx`, `components/ui/Button.jsx` (pattern for
  the rest of the atomic component library), `routes.jsx`, `App.jsx`, `main.jsx`.

**Infra**: `docker-compose.yml`, `server/Dockerfile`, `server/.env.example`,
`client/.env.example`, both `package.json` files.

## What's still a stub (by design, ready to fill next)

- Business rules inside each module's `service.js` (currently generic CRUD).
- Real UI beyond the raw JSON-dump list pages — dashboards, tables, charts,
  animated modals per your Section 2 component folders.
- The 40+ full Mongoose schemas from Section 2 — currently one core schema
  per module is defined; supporting schemas (Company, Branch, Department,
  Asset, Document, Notification, etc.) come next.
- Recruitment, onboarding, documents, assets, resignation, performance,
  training, engagement, reports, company-settings, audit-logs modules — not
  yet scaffolded; same generator pattern extends to these on request.

## Running it locally

```bash
cp server/.env.example server/.env   # then fill in real secrets
docker compose up --build
```

Backend on `:5000`, frontend on `:5173`, MongoDB on `:27017`, Redis on `:6379`.

## Suggested next step

Fill in `employees` and `attendance` business logic first (they're the
dependency root for payroll, leaves, and dashboards), then move to the
dashboard aggregation queries and real UI.
