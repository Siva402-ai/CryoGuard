#!/bin/sh
set -e

echo "⏳ Running Prisma migrations..."
npx prisma migrate deploy

echo "🌱 Running Prisma seed..."
npx tsx prisma/seed.ts

echo "🚀 Starting server..."
exec "$@"
