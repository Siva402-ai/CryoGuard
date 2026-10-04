# CryoGuard - Cryogenic Facility Control & Safety System

CryoGuard is a facility management control panel designed for bulk cryogenic storage facilities (Liquid Nitrogen, Liquid Oxygen, and Argon). It enables operations staff and facility managers to monitor tank telemetry in real time, handle critical threshold alerts, schedule preventive maintenance, perform checklist-based safety inspections, and manage cryogenic consumables and spare parts inventory.

---

## Architecture Overview

```
React + TS (Vite)  --REST + SSE-->  Express API  -->  PostgreSQL (Permanent Data)
                                        |
                                        +--------->  Redis (Cache, Alert Pub/Sub, BullMQ)
Simulator script --POST /api/readings--> Express API
```

---

## Project Structure

```
cryoguard/
├── client/                 # React + TypeScript + Vite frontend
│   ├── src/                # Application source code
│   ├── index.html          # HTML entrypoint
│   ├── package.json
│   ├── Dockerfile
│   └── vite.config.ts
├── server/                 # Express + TypeScript backend
│   ├── src/                # API controllers, routes, db clients
│   ├── prisma/             # Schema, migrations, and seed script
│   ├── package.json
│   ├── Dockerfile
│   └── entrypoint.sh       # Auto migration + seed runner
├── simulator/              # Sensor telemetry simulation script
│   ├── src/
│   └── package.json
├── docker-compose.yml      # Orchestration for all services
├── .env.example            # Environment template
├── PLAN.md                 # Master Implementation Plan (Source of Truth)
└── README.md
```

---

## Prerequisites

- **Docker** and **Docker Compose**
- **Node.js 20+** (if running locally without Docker)
- **PostgreSQL 16** & **Redis 7** (if running locally without Docker)

---

## Quick Start (Docker Compose)

1. Clone the repository and navigate into the root directory:
   ```bash
   cd cryoguard
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Start all services using Docker Compose:
   ```bash
   docker compose up --build
   ```

The server container will automatically:
- Wait for PostgreSQL and Redis to become healthy
- Run Prisma migrations (`prisma migrate deploy`)
- Seed the database with demo users, cryogenic tanks, inspection templates, and inventory items
- Start the Express API server on `http://localhost:4000`

---

## Service Endpoints & Ports

| Service | Port | Description |
|---|---|---|
| **Client** (Vite Dev Server) | `http://localhost:5173` | Frontend UI |
| **Server** (Express API) | `http://localhost:4000` | REST API |
| **Health Check** | `http://localhost:4000/api/health` | DB & Redis Health Status |
| **PostgreSQL** | `localhost:5432` | Database (`cryoguard` db, user: `postgres`) |
| **Redis** | `localhost:6379` | In-Memory Cache & Message Broker |

---

## Demo Seed Credentials

| Name | Email | Role | Password |
|---|---|---|---|
| Facility Admin | `admin@cryoguard.com` | `ADMIN` | `Admin@123456` |
| Arun | `arun@cryoguard.com` | `STAFF` | `Staff@123456` |
| Ravi | `ravi@cryoguard.com` | `STAFF` | `Staff@123456` |

---

## Cryogenic Thresholds Reference

| Material | Normal Operating Temp | Warning Above | Critical Above |
|---|---|---|---|
| **LN2 (Liquid Nitrogen)** | -196°C to -190°C | -190°C | -185°C |
| **LOX (Liquid Oxygen)** | -183°C to -180°C | -180°C | -175°C |
| **Argon (Liquid Argon)** | -186°C to -183°C | -183°C | -178°C |

- **Liquid Level:** Warning below 30%, Critical below 15%
- **Pressure:** Warning above 1.8 bar, Critical above 2.2 bar

---

## Verifying Phase 0

Run health check:
```bash
curl http://localhost:4000/api/health
```

Expected JSON output:
```json
{
  "status": "ok",
  "service": "cryoguard-api",
  "db": "up",
  "redis": "up",
  "uptime": 12.34,
  "timestamp": "2026-10-04T09:00:00.000Z"
}
```
