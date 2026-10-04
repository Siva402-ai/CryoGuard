import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.JWT_SECRET;

if (!secret || secret.trim().length < 32) {
  console.error(
    'FATAL: JWT_SECRET environment variable is missing or shorter than 32 characters. Server startup aborted.',
  );
  process.exit(1);
}

export const JWT_SECRET: string = secret.trim();
export const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '8h';
