# CryoGuard: Final Implementation Plan

Cryogenic facility management system: storage monitoring, maintenance schedules, safety inspections, inventory.

**Stack:** React + TypeScript, Node.js + Express, PostgreSQL, Redis, REST API, Docker, Git/GitHub

---

## 1. Scope

A control panel for a facility with bulk cryogenic tanks (Liquid Nitrogen, Liquid Oxygen, Argon). Staff can monitor tanks, handle alerts, schedule maintenance, run safety inspections, and track bulk material inventory.

**Pages (9):** Login, Dashboard, Equipment (list + detail), Alerts, Maintenance, Safety Inspections, Inventory, Reports, Users & Roles.

**Out of scope:** per-sample rack/box tracking, real hardware sensors (we use a simulator), mobile app.

**Stretch (only after core works, pick 1-2):** depletion forecast, PDF export, email alerts.

---

## 2. Architecture

```
React + TS (Vite)  --REST + SSE-->  Express API  -->  PostgreSQL (permanent data)
                                        |
                                        +--------->  Redis (latest readings, alert pub/sub, job queue)
Simulator script --POST /api/readings--> Express API
All of it runs under docker-compose.
```

### Folder structure
```
cryoguard/
  client/                 # React + TS + Vite
    src/{pages,components,api,hooks,context,types,utils}
  server/                 # Express + TS
    src/{routes,controllers,services,middleware,db,jobs,config,utils}
    prisma/ (schema.prisma, migrations, seed.ts)
  simulator/              # Node script posting fake readings
  docker-compose.yml
  .env.example
  README.md
```

### Libraries
- **Server:** express, typescript, prisma (+ pg), zod, jsonwebtoken, bcrypt, ioredis, bullmq, helmet, cors, pino, tsx
- **Client:** vite, react-router, @tanstack/react-query, tailwindcss, recharts, react-hook-form + zod, axios
- **Dev:** eslint, prettier, vitest (a few service-level tests)

---

## 3. Database schema (PostgreSQL)

| Table | Key columns |
|---|---|
| `users` | id, name, email (unique), password_hash, role (`ADMIN`, `STAFF`; default `STAFF`), is_active, created_at. Many users allowed, each has exactly one role |
| `equipment` | id, code (unique, e.g. C-001), name, material (`LN2`, `LOX`, `ARGON`), capacity_l, location, temp_warn_c, temp_crit_c, pressure_warn_bar, pressure_crit_bar, level_warn_pct, level_crit_pct, status (`NORMAL`, `WARNING`, `CRITICAL`, `OFFLINE`), created_at |
| `sensor_readings` | id, equipment_id, temperature_c, pressure_bar, level_pct, recorded_at. Index on (equipment_id, recorded_at DESC) |
| `alerts` | id, equipment_id, type (`TEMPERATURE`, `PRESSURE`, `LEVEL`, `MAINTENANCE`, `INSPECTION`, `INVENTORY`), severity (`WARNING`, `CRITICAL`), message, value, status (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`), acknowledged_by, acknowledged_at, resolved_by, resolved_at, created_at |
| `maintenance_tasks` | id, equipment_id, title, description, due_date, assigned_to, status (`PENDING`, `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `OVERDUE`), recurrence_days (nullable), completed_at, notes |
| `inspection_templates` | id, name, items (jsonb list of checklist labels) |
| `inspections` | id, equipment_id, template_id, inspector_id (the user who performed it, any role), performed_at, results (jsonb: item -> pass/fail), overall (`PASS`, `NEEDS_ATTENTION`, `FAIL`), findings, corrective_action |
| `inventory_items` | id, name, material, unit, quantity, min_quantity |
| `inventory_transactions` | id, item_id, type (`IN`, `OUT`, `ADJUST`), quantity, reason, user_id, created_at |
| `restock_requests` | id, item_id, quantity, status (`PENDING`, `APPROVED`, `ORDERED`, `RECEIVED`, `REJECTED`), requested_by, created_at |
| `audit_log` | id, user_id, action, entity, entity_id, meta (jsonb), created_at |

### Threshold rules (stored per equipment, never hardcoded)
Values are demo defaults, seeded per material. Boiling points differ, so a single global threshold would be wrong (LOX at -183°C is normal).

| Material | Normal temp | Warning above | Critical above |
|---|---|---|---|
| LN2 | -196 to -190 | -190°C | -185°C |
| LOX | -183 to -180 | -180°C | -175°C |
| Argon | -186 to -183 | -183°C | -178°C |

Level: warning below 30%, critical below 15%. Pressure: warning above 1.8 bar, critical above 2.2 bar.

---

## 4. API endpoints (all under `/api`, JSON)

**Auth**
- `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`

**Equipment**
- `GET /equipment`, `POST /equipment`, `GET /equipment/:id`, `PUT /equipment/:id`, `DELETE /equipment/:id`
- `GET /equipment/:id/readings?from=&to=&limit=` (history for charts)

**Readings (simulator ingest)**
- `POST /readings` (requires `x-api-key` header, not JWT)

**Alerts**
- `GET /alerts?status=&severity=&equipmentId=`, `PATCH /alerts/:id/acknowledge`, `PATCH /alerts/:id/resolve`
- `GET /alerts/stream` (Server-Sent Events, live alert push)

**Dashboard**
- `GET /dashboard/summary` (counts, tank statuses, recent alerts)

**Maintenance**
- `GET /maintenance?status=&equipmentId=`, `POST /maintenance`, `PUT /maintenance/:id`, `PATCH /maintenance/:id/complete`

**Inspections**
- `GET /inspection-templates`, `POST /inspection-templates`
- `GET /inspections`, `POST /inspections`, `GET /inspections/:id`

**Inventory**
- `GET /inventory`, `POST /inventory`, `PUT /inventory/:id`
- `POST /inventory/:id/transactions`, `GET /inventory/:id/transactions`
- `GET /restock-requests`, `POST /restock-requests`, `PATCH /restock-requests/:id` (approve/reject/receive)

**Reports**
- `GET /reports/temperature-trend`, `/reports/alerts-by-month`, `/reports/maintenance-history`, `/reports/inventory-consumption`
- Each supports `?format=csv`

**Users (`ADMIN` only; `STAFF` gets 403)**
- `GET /users`, `POST /users`, `PUT /users/:id`, `PATCH /users/:id/deactivate`

### Roles & permissions

Only two backend roles: `ADMIN` (Admin / Facility Manager) and `STAFF` (Staff / Technician). The system supports any number of user accounts, but each account has exactly one of these roles.

| Area | ADMIN | STAFF |
|---|---|---|
| Dashboard | Yes | Yes |
| Storage Units / Equipment | Yes | Yes |
| Alerts (view, acknowledge, resolve) | Yes | Yes |
| Maintenance | Yes | Yes |
| Safety Inspections | Yes | Yes |
| Inventory (incl. restock requests) | Yes | Yes |
| Reports | Yes | Yes |
| Users & Roles | Yes | **No** |

The only difference between the roles is access to Users & Roles (and the audit log viewer that lives on that page).

### Authorization rules
- The JWT payload carries `userId` and `role`.
- All `/api/*` routes except login and the simulator ingest require a valid JWT.
- `requireRole('ADMIN')` guards every `/users` route and the audit log endpoint; `STAFF` receives `403`. Every other route only needs authentication.
- The client hides the "Users & Roles" sidebar item for `STAFF` and redirects them if they open its URL, but the server check is the real enforcement.
- An `ADMIN` cannot deactivate or demote their own account (prevents locking everyone out).

### Seeded demo users
| Name | Email | Role |
|---|---|---|
| Facility Admin | `admin@cryoguard.com` | `ADMIN` |
| Arun | `arun@cryoguard.com` | `STAFF` |
| Ravi | `ravi@cryoguard.com` | `STAFF` |

Passwords are set in the seed script (documented in the README for demo only, never real credentials).

---

## 5. Core logic

### Reading ingestion flow
1. Simulator sends `POST /readings` with equipment code and values.
2. Validate with zod, store in `sensor_readings`.
3. Cache latest reading in Redis: `reading:latest:{equipmentId}` (dashboard reads from here).
4. Compare against that equipment's thresholds and update its `status`.
5. If a threshold is crossed, create an alert unless one is already open. Dedupe key in Redis: `alert:active:{equipmentId}:{type}`.
6. Publish the new alert on the Redis channel `alerts`; the SSE endpoint forwards it to the browser.

### Redis usage (keep all four so it has a real purpose)
- Latest-reading cache for the dashboard
- Alert dedupe keys
- Pub/sub for live alerts
- BullMQ jobs: a daily maintenance check (mark overdue, create reminder alerts, create the next task if `recurrence_days` is set), plus login rate limiting

### Other rules
- Inspection with any failed item: `overall = FAIL` or `NEEDS_ATTENTION`, and an `INSPECTION` alert is auto-created.
- Inventory `OUT` that drops quantity below `min_quantity`: create an `INVENTORY` alert and offer a restock request.
- Every create/update/delete on core entities writes an `audit_log` row.
- Reading retention: simulator inserts one reading per tank every 5 seconds; keep it modest (one reading per tank per 5-10 seconds) so the DB stays small.

### Simulator behavior
- Seeds 6 tanks (2 LN2, 2 LOX, 2 Argon).
- Each tick adds small random noise to temperature/pressure and slowly drains level.
- Supports a `--scenario` flag: `normal`, `temp-spike` (pushes C-002 into warning/critical), `low-level`, so you can trigger alerts on demand during the demo.

---

## 6. Build phases

Each phase ends with something runnable and a Git commit/PR.

### Phase 0: Setup
- Monorepo, TypeScript configs, ESLint/Prettier, `.env.example`
- `docker-compose.yml` with postgres, redis, server, client
- Prisma schema + first migration + seed (the 3 demo users from "Seeded demo users", 6 tanks, inventory items, inspection template)
- **Done when:** `docker compose up` starts everything and `/api/health` responds.

### Phase 1: Auth & roles (ADMIN / STAFF)
- Login, JWT (payload: `userId`, `role`), bcrypt, `requireAuth` + `requireRole('ADMIN')` middleware, login rate limiting
- React: login page, auth context, protected routes, role-aware sidebar (Users & Roles visible to `ADMIN` only), app layout
- **Done when:** `admin@cryoguard.com` sees all 8 menu items including Users & Roles; `arun@cryoguard.com` (`STAFF`) sees every menu item except Users & Roles, and calling a `/users` endpoint as `STAFF` returns `403`.

### Phase 2: Equipment & readings
- Equipment CRUD, readings ingest, Redis caching, threshold evaluation
- Simulator script
- React: equipment list and detail page with Recharts graphs
- **Done when:** the simulator runs and charts update on refresh.

### Phase 3: Dashboard & alerts
- Alert creation, dedupe, acknowledge/resolve, SSE stream
- React: dashboard cards + tank table + alert feed, alerts page with filters
- **Done when:** running the `temp-spike` scenario shows a live alert without refreshing.

### Phase 4: Maintenance
- CRUD, complete flow, recurrence, BullMQ daily job for overdue
- React: table/calendar, schedule form, history view
- **Done when:** an overdue task is flagged and raises an alert.

### Phase 5: Safety inspections
- Templates, create inspection, auto-alert on failure
- React: checklist form, findings/corrective action, history list
- **Done when:** a failed item creates an `INSPECTION` alert.

### Phase 6: Inventory
- Items, transactions, low-stock alert, restock request workflow
- React: inventory table with status colors, transaction dialog, restock requests list
- **Done when:** an `OUT` transaction below minimum triggers the alert and a restock request can be approved.

### Phase 7: Reports
- Four report endpoints + CSV export
- React: reports page with date range filter and charts
- **Done when:** each chart renders from real simulator data and CSV downloads.

### Phase 8: Users & audit (ADMIN only)
- Users & Roles page: list users, add a user, assign `ADMIN` or `STAFF`, edit, deactivate/reactivate; audit log viewer. All guarded by `requireRole('ADMIN')`; an admin cannot deactivate or demote themselves.
- **Done when:** an `ADMIN` can add a `STAFF` user, change a role, and deactivate a user (who can then no longer log in); actions appear in the audit log; a `STAFF` user gets `403` on these endpoints and never sees the page.

### Phase 9: Polish & delivery
- Loading/empty/error states, form validation messages, responsive layout
- A handful of tests (threshold evaluation, role middleware, inventory logic)
- README with setup steps, architecture diagram, ER diagram, screenshots
- Demo seed + scenarios; optionally one stretch feature

---

## 7. Antigravity workflow

1. Put this file in the repo root as `PLAN.md` and tell Antigravity to treat it as the source of truth.
2. Work one phase at a time. Prompt shape:
   > Read PLAN.md. Implement **Phase N** only. Follow the schema, endpoints, and role rules exactly. Don't touch other phases. When done, list what you built and how to run/test it.
3. After each phase: run it yourself, check the "Done when" line, fix issues, commit.
4. Don't ask for the whole app in one prompt. Backend of a phase first, then its UI.
5. If Antigravity wants to change the schema or an endpoint, update `PLAN.md` first so the spec stays accurate.

---

## 8. Demo script (viva/presentation)

1. Show `docker compose up` bringing the whole stack up.
2. Log in as **STAFF** (`arun@cryoguard.com`); show the dashboard with all tanks normal. Point out there is no Users & Roles in the sidebar, and that opening its URL redirects away.
3. Run `simulator --scenario temp-spike`; C-002 turns red and a live alert appears.
4. Acknowledge the alert, open the tank detail, show the trend graph.
5. Schedule maintenance for it; show an overdue task and its alert.
6. Run a safety inspection with one failed item; show the auto-alert.
7. Withdraw LOX below minimum in Inventory and create a restock request.
8. Log out and log in as **ADMIN** (`admin@cryoguard.com`); show reports and CSV export, then the Users & Roles page (add a new STAFF user, deactivate one) and the audit log.
9. Mention the architecture: Redis for live data and jobs, Postgres for permanent data, JWT auth with two roles (`ADMIN`, `STAFF`) enforced on the server.

---

## 9. Risks & how to avoid them

- **Scope creep:** finish phases in order; stretch features only after Phase 8.
- **Hardcoded thresholds:** always read from the equipment row.
- **Alert spam:** the Redis dedupe key prevents one alert per reading.
- **Too much readings data:** keep the simulator interval modest and paginate/limit history queries.
- **Spec drift with Antigravity:** keep `PLAN.md` updated and commit after every phase.
