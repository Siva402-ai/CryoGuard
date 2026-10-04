# CryoGuard - Cryogenic Facility Control & Safety System

CryoGuard is an industrial facility management system designed for bulk cryogenic storage facilities (Liquid Nitrogen, Liquid Oxygen, and Argon). It enables operations staff and facility managers to monitor tank telemetry in real time, evaluate safety threshold boundaries, schedule preventive maintenance, perform checklist-based safety inspections, and manage cryogenic material inventory.

---

## Architecture Overview

```
React + TS (Vite)  --REST + SSE-->  Express API  -->  PostgreSQL (Permanent Data)
                                        |
                                        +--------->  Redis (Latest Readings, Cache, Pub/Sub)
Simulator script --POST /api/readings--> Express API
```

---

## Project Structure

```
cryoguard/
├── client/                 # React + TypeScript + Vite frontend
│   ├── src/                # UI pages, components, context, api
│   ├── index.html          # HTML entrypoint with Plus Jakarta Sans
│   ├── package.json
│   ├── Dockerfile
│   └── vite.config.ts
├── server/                 # Express + TypeScript backend
│   ├── src/                # Controllers, routes, middleware, db clients
│   ├── prisma/             # Schema, migrations, and seed script
│   ├── package.json
│   ├── Dockerfile
│   └── entrypoint.sh       # Auto migration + seed runner
├── simulator/              # Sensor telemetry simulation script
│   ├── src/                # Multi-scenario generator
│   └── package.json
├── docker-compose.yml      # Orchestration for all services
├── .env.example            # Environment template
├── PLAN.md                 # Master Implementation Plan (Source of Truth)
└── README.md
```

---

## Quick Start (Docker Compose)

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Start all services using Docker Compose:
   ```bash
   docker compose up --build
   ```

The server container automatically:
- Waits for PostgreSQL and Redis to become healthy
- Runs Prisma migrations (`prisma migrate deploy`)
- Seeds the database with demo users, cryogenic tanks, inspection templates, and inventory items
- Starts the Express API server on `http://localhost:4000`
- Starts the Vite frontend on `http://localhost:5173`

---

## Demo Credentials

| Name | Email | Role | Password |
|---|---|---|---|
| **Facility Admin** | `admin@cryoguard.com` | `ADMIN` | `Admin@123456` |
| **Arun** | `arun@cryoguard.com` | `STAFF` | `Staff@123456` |
| **Ravi** | `ravi@cryoguard.com` | `STAFF` | `Staff@123456` |

---

## Cryogenic Sensor Simulator

The simulator streams realistic telemetry readings (temperature, pressure, level) to `POST /api/readings` authenticated via `x-api-key`.

### Simulator Commands

Run from the `simulator/` directory:

1. **Normal Scenario** (All 6 tanks operate within normal thresholds):
   ```bash
   cd simulator
   npm run sim:normal
   ```

2. **Thermal Spike Scenario** (`C-002` temperature gradually rises above warning `-190°C` and critical `-185°C` thresholds):
   ```bash
   cd simulator
   npm run sim:temp-spike
   ```

3. **Low Level Scenario** (`C-001` liquid level drains rapidly below warning `30%` and critical `15%` thresholds):
   ```bash
   cd simulator
   npm run sim:low-level
   ```

Optional flags:
- `--ticks <N>`: Run for a specific number of ticks before exiting (e.g. `npm run sim:normal -- --ticks 5`)
- `--interval <ms>`: Set custom polling interval in milliseconds (default: 5000ms)

---

## API Endpoints (Phase 2)

### Auth
- `POST /api/auth/login` - Authenticate staff / admin
- `GET /api/auth/me` - Fetch authenticated user profile
- `POST /api/auth/logout` - Invalidate session

### Equipment & Telemetry
- `GET /api/equipment` - List all storage vessels with latest cached readings
- `POST /api/equipment` - Register a new cryogenic storage unit
- `GET /api/equipment/:id` - Fetch details for a specific storage unit
- `PUT /api/equipment/:id` - Update unit specifications or safety thresholds
- `DELETE /api/equipment/:id` - Remove unit (409 conflict if operational dependencies exist)
- `GET /api/equipment/:id/readings?from=&to=&limit=` - Fetch historical sensor readings for trend charts

### Telemetry Ingestion (Simulator)
- `POST /api/readings` - Ingest sensor readings (requires `x-api-key: SIMULATOR_API_KEY`)

### Reports (Phase 7)
- `GET /api/reports/temperature-trend?from=&to=&equipmentId=&format=json|csv` - Per-tank aggregated temperature trend buckets
- `GET /api/reports/alerts-by-month?from=&to=&equipmentId=&format=json|csv` - Alert counts grouped by month, severity, and type
- `GET /api/reports/maintenance-history?from=&to=&equipmentId=&format=json|csv` - Maintenance task statistics, monthly distribution, and task logs
- `GET /api/reports/inventory-consumption?from=&to=&format=json|csv` - Material consumption IN/OUT totals, net change, and weekly usage

### Dev Tooling: Historical Demo Data

To populate the Reports charts with 6 months of historical demo data (resolved alerts, completed maintenance tasks, and inventory transactions):

```bash
cd server
npm run seed:demo-history
```

*Note: This command is idempotent and will skip if historical demo data already exists. It inserts back-dated inventory transaction records without altering live `items.quantity` levels.*

