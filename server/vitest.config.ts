import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

dotenv.config();

// Ensure test execution defaults to cryoguard_test database
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/cryoguard_test?schema=public';

// Ensure valid JWT secret is set for tests
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'cryoguard_super_secret_jwt_key_at_least_32_chars_long!';
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
  },
});
