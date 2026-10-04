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
| `alerts` | id, equipment_id (nullable, for tank-specific alerts), source_id (nullable, e.g. maintenance task id or inventory item id), type (`TEMPERATURE`, `PRESSURE`, `LEVEL`, `MAINTENANCE`, `INSPECTION`, `INVENTORY`), severity (`WARNING`, `CRITICAL`), message, value, status (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`), acknowledged_by, acknowledged_at, resolved_by, resolved_at, created_at |
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
- `GET /restock-requests?status=&itemId=`, `POST /restock-requests`, `PATCH /restock-requests/:id` (actions: approve/reject/order/receive)

**Reports**
- `GET /reports/temperature-trend`, `/reports/alerts-by-month`, `/reports/maintenance-history`, `/reports/inventory-consumption`
- Each supports `?format=csv`

**Users**
- `GET /users/options` (all authenticated users: active user id and name for task assignments)
- `GET /users`, `POST /users`, `PUT /users/:id`, `PATCH /users/:id/deactivate` (`ADMIN` only; `STAFF` gets 403)

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
- React: login page, auth context, protected routes, role-aware sidebar (Users & Roles visible to `ADMIN` only), app layout shell (sidebar + floating topbar + content area), all styled strictly per Section 10 (UI Design System): Tailwind theme tokens, Plus Jakarta Sans, lucide-react icons, light mode only
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
- Items, transactions (IN/OUT/ADJUST with atomic DB updates & negative stock prevention), low-stock alert evaluation (stockStatus GOOD/LOW/CRITICAL, auto-escalate and auto-resolve, Redis dedupe key `alert:active:INVENTORY:{itemId}`), restock request workflow (PENDING -> APPROVED/REJECTED -> ORDERED -> RECEIVED, receive triggers IN transaction), audit logging.
- React: inventory table with status colors & stock level bar, transaction dialog with live preview and negative prevention, item transaction history drawer, restock requests tab with action transitions and prefilled restock dialog, alert/dashboard inventory integration with item names.
- **Done when:** an `OUT` transaction below minimum triggers the alert, escalates on critical, auto-resolves on restock, and restock requests can be approved, ordered, and received.

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

---

## 10. UI Design System (applies to every phase that builds UI)

**Reference look:** the Ciklum website (ciklum.com): clean, bright, corporate-tech. White surfaces, deep royal blue as the main color, a soft mint accent, navy text, generous spacing, rounded cards and pill buttons with soft shadows. Take the *feel* only. Do not copy Ciklum's logo, text, images or other brand assets; CryoGuard has its own simple wordmark.

**Non-negotiable rules**
- Light mode only. No dark mode, no theme toggle.
- No neon, glow, glassmorphism, aurora/blob backgrounds, purple or violet gradients, particle effects, sparkle/"AI" icons, or emojis anywhere in the UI.
- Gradients are allowed only for: the blue-to-teal accent on a few headline words, the logo mark, and chart area fills (very subtle). Never on page or card backgrounds.
- Everything aligned to an 8px grid. Consistent padding, consistent card heights per row, no stray margins.
- Sentence case labels (not ALL CAPS), except tiny table column headers.
- Icons: `lucide-react` only (the one extra dependency allowed for the UI), 20px, 1.75 stroke.
- Motion: 150-200ms ease for hover/focus/expand only. No decorative animation.

### Color tokens
Values are eyeballed from the Ciklum site; tweak the hex values in one place (Tailwind config) if you want a closer match.

| Token | Hex | Use |
|---|---|---|
| `primary` | `#1A2BC3` | Primary buttons, active nav, links, main chart series |
| `primary-hover` | `#1422A3` | Hover/pressed |
| `primary-soft` | `#EEF1FF` | Active nav background, selected rows, info badges |
| `accent` | `#7EF0C9` | Secondary pill button (navy text), highlights |
| `accent-soft` | `#E6FBF3` | Light mint tint backgrounds |
| `teal` | `#4AA8B5` | Gradient end (with primary), second chart series |
| `navy` | `#0B1633` | Headings |
| `text` | `#1F2A44` | Body text |
| `muted` | `#5B6578` | Secondary text, helper text |
| `border` | `#E5E9F2` | Card/table/input borders, dividers |
| `bg` | `#F6F8FC` | App background behind cards |
| `surface` | `#FFFFFF` | Cards, sidebar, topbar |

**Status colors** (calm, not neon; always pair color with an icon or text label):
| Status | Text/icon | Background |
|---|---|---|
| Normal / success | `#0E9F6E` | `#E7F8F0` |
| Warning | `#C77700` | `#FFF4DE` |
| Critical / error | `#D92D20` | `#FDECEA` |
| Info / scheduled | `#1A2BC3` | `#EEF1FF` |
| Offline / neutral | `#5B6578` | `#EEF1F6` |

Chart series order: `#1A2BC3`, `#4AA8B5`, `#7EF0C9`, `#94A3B8`, `#6B7BE8`, `#0B1633`. Thin 2px lines, light grid `#EEF1F6`, no glow, no 3D.

### Typography
- Font: **Plus Jakarta Sans** (fallback: Inter, system-ui, sans-serif), loaded locally or via the Google Fonts link in `index.html`.
- Page title 28px/600 navy; section title 18px/600; body 14px/400; table text 14px; small/meta 12px muted.

### Layout (desktop first, must also work down to tablet)
- **Sidebar** (left, full height, white, 1px right border `border`, width 264px):
  - Top: CryoGuard logo (simple ring/snowflake mark in blue-to-teal + wordmark in navy).
  - Nav grouped with small muted group labels: **Operations** (Dashboard, Equipment, Alerts, Maintenance, Inspections, Inventory), **Insights** (Reports), **Administration** (Users & Roles, ADMIN only).
  - Icons (lucide): LayoutDashboard, Container, Bell, Wrench, ClipboardCheck, Package, BarChart3, Users.
  - Item: 44px tall, rounded-xl, 12px padding. Hover `#F3F5FA`. Active: `primary-soft` background, `primary` text and icon, semibold.
  - Alerts item shows a small red count pill when there are open alerts.
  - Bottom: user card (avatar initials, name, role badge `ADMIN`/`STAFF`, logout button).
  - Below 1280px collapse to an icon rail (72px); below 768px becomes an off-canvas drawer opened from the topbar.
- **Topbar:** floating rounded-2xl white bar with soft shadow (like Ciklum's nav), 64px tall, inset 16px from the content edge. Left: page title + breadcrumb. Right: bell with open-alert count (links to Alerts) and user menu. No search box.
- **Content area:** background `bg`, 24-32px padding, max-width 1440px, centered.
- **Page header pattern:** title + muted subtitle on the left, primary action button on the right (e.g. "Schedule maintenance").
- **Grid:** 12 columns, 24px gaps. Dashboard = 4 KPI cards on top, then tank status table (8 cols) + recent alerts (4 cols), then the trend chart full width.

### Components
- **Buttons:** pill-shaped (`rounded-full`), 44px tall. Primary = `primary` background, white text, optional arrow in a white circle (like Ciklum's "Talk to an Expert"). Secondary = `accent` background, navy text. Tertiary = white with `border` outline. Destructive = `#D92D20`, used sparingly.
- **Cards:** white, `rounded-2xl` (16px), 1px `border`, shadow `0 1px 2px rgba(11,22,51,0.04), 0 8px 24px rgba(11,22,51,0.04)`, 24px padding.
- **KPI card:** small muted label, big number (32px/600 navy), tiny icon in a `primary-soft` rounded square.
- **Tables:** inside a card, header row `#F8FAFD` with 12px muted semibold text, 56px rows, hover `#F8FAFD`, bottom borders only, right-aligned numbers, status shown as a badge.
- **Badges:** pill, 12px/600, colors from the status table, with a small dot or icon.
- **Forms:** 44px inputs, `rounded-xl`, 1px `border`, focus ring 2px `primary` at 30% opacity; labels above inputs; inline error text in critical red.
- **Modals/drawers:** white, `rounded-2xl`, dim backdrop `rgba(11,22,51,0.4)`.
- **Empty, loading and error states:** every list/table/chart has a skeleton, a friendly empty message with an icon, and an inline retry on error.
- **Login page:** centered white card on `bg`, logo above, same pill primary button, no decorative imagery.

### Acceptance check for any UI phase
Looks like a bright corporate dashboard, consistent spacing, sidebar highlights the current page, every status has both color and label, nothing is dark, glowing or gradient-heavy.
