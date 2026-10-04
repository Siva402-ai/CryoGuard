import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from simulator folder or root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:4000/api';
const SIMULATOR_API_KEY = process.env.SIMULATOR_API_KEY || 'cryoguard-sim-key-secret-999';

// Parse command line arguments
const args = process.argv.slice(2);
let scenario: 'normal' | 'temp-spike' | 'low-level' = 'normal';
let intervalMs = 5000;
let runOnce = false;
let maxTicks = Infinity;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--scenario' && args[i + 1]) {
    scenario = args[i + 1] as any;
    i++;
  } else if (args[i] === '--interval' && args[i + 1]) {
    intervalMs = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--once') {
    runOnce = true;
  } else if (args[i] === '--ticks' && args[i + 1]) {
    maxTicks = parseInt(args[i + 1], 10);
    i++;
  }
}

interface TankState {
  code: string;
  name: string;
  material: 'LN2' | 'LOX' | 'ARGON';
  temp: number;
  pressure: number;
  level: number;
}

const tanks: TankState[] = [
  { code: 'C-001', name: 'Bulk Tank Alpha', material: 'LN2', temp: -194.5, pressure: 1.25, level: 88.0 },
  { code: 'C-002', name: 'Bulk Tank Beta', material: 'LN2', temp: -194.0, pressure: 1.20, level: 82.5 },
  { code: 'C-003', name: 'Cryo-Ox 1', material: 'LOX', temp: -182.2, pressure: 1.30, level: 79.0 },
  { code: 'C-004', name: 'Cryo-Ox 2', material: 'LOX', temp: -182.0, pressure: 1.28, level: 74.0 },
  { code: 'C-005', name: 'Argon Reserve 1', material: 'ARGON', temp: -185.0, pressure: 1.22, level: 85.0 },
  { code: 'C-006', name: 'Argon Reserve 2', material: 'ARGON', temp: -184.8, pressure: 1.24, level: 70.0 },
];

let tickCount = 0;

function randomNoise(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

async function sendReading(tank: TankState) {
  const payload = {
    code: tank.code,
    temperature_c: parseFloat(tank.temp.toFixed(2)),
    pressure_bar: parseFloat(tank.pressure.toFixed(2)),
    level_pct: parseFloat(tank.level.toFixed(2)),
    recorded_at: new Date().toISOString(),
  };

  try {
    const res = await axios.post(`${API_URL}/readings`, payload, {
      headers: {
        'x-api-key': SIMULATOR_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 4000,
    });

    const status = res.data.status || 'NORMAL';
    console.log(
      `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [${tank.code}] ` +
        `Temp: ${payload.temperature_c.toFixed(1)}°C | ` +
        `Press: ${payload.pressure_bar.toFixed(2)} bar | ` +
        `Level: ${payload.level_pct.toFixed(1)}% | ` +
        `Status: ${status}`,
    );
  } catch (err: any) {
    console.error(
      `❌ [${tank.code}] Ingestion failed:`,
      err.response?.data?.message || err.message,
    );
  }
}

async function tick() {
  tickCount++;
  console.log(`\n--- Tick #${tickCount} [Scenario: ${scenario.toUpperCase()}] ---`);

  for (const tank of tanks) {
    // 1. Natural fluctuations
    const tempNoise = randomNoise(-0.15, 0.15);
    const pressureNoise = randomNoise(-0.02, 0.02);
    const naturalDrain = 0.02; // slow continuous consumption

    tank.temp += tempNoise;
    tank.pressure = Math.max(1.0, tank.pressure + pressureNoise);
    tank.level = Math.max(0.5, tank.level - naturalDrain);

    // 2. Scenario specific deviations
    if (scenario === 'temp-spike' && tank.code === 'C-002') {
      // Temperature steadily increases past warning (-190°C) and critical (-185°C)
      tank.temp += 1.8;
      tank.pressure += 0.08; // thermal expansion pressure rise
      console.log(`⚠️ [SCENARIO ACTIVE] Injecting thermal spike on ${tank.code}: Temp is rising rapidly...`);
    } else if (scenario === 'low-level' && tank.code === 'C-001') {
      // Level drains rapidly past warning (30%) and critical (15%)
      tank.level = Math.max(0.0, tank.level - 4.5);
      console.log(`⚠️ [SCENARIO ACTIVE] Rapid volume depletion on ${tank.code}: Level is draining...`);
    }

    await sendReading(tank);
  }

  if (runOnce || tickCount >= maxTicks) {
    console.log(`\n🎉 Simulation batch finished after ${tickCount} tick(s).`);
    process.exit(0);
  }
}

async function main() {
  console.log('====================================================');
  console.log('       ❄️  CryoGuard Sensor Telemetry Simulator     ');
  console.log('====================================================');
  console.log(`📡 Target API:    ${API_URL}/readings`);
  console.log(`🎭 Scenario:      ${scenario.toUpperCase()}`);
  console.log(`⏱️  Interval:      ${intervalMs} ms`);
  console.log(`📦 Seeded Tanks:  ${tanks.map((t) => t.code).join(', ')}`);
  console.log('----------------------------------------------------');

  // Initial tick immediately
  await tick();

  if (!runOnce) {
    setInterval(tick, intervalMs);
  }
}

main().catch((err) => {
  console.error('Simulator fatal error:', err);
  process.exit(1);
});
