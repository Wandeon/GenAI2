#!/bin/bash
# Database reset script for GenAI2
# WARNING: This destroys all data! Only use in development.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}============================================${NC}"
echo -e "${YELLOW}WARNING: This will DELETE ALL DATA${NC}"
echo -e "${YELLOW}============================================${NC}"
echo ""

# Safety check - don't run in production
if [ "$NODE_ENV" = "production" ]; then
  echo -e "${RED}ERROR: Cannot reset database in production!${NC}"
  exit 1
fi

# Confirm action
read -p "Are you sure you want to reset the database? (type 'yes' to confirm): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Resetting database..."

# Load environment
if [ -f ".env" ]; then
  source .env 2>/dev/null || true
fi

# Check if database is running
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
  echo -e "${RED}ERROR: PostgreSQL is not running${NC}"
  echo "Start with: docker compose up -d postgres"
  exit 1
fi

# Reset database using Prisma
echo "Running prisma migrate reset..."
pnpm prisma migrate reset --force

# Regenerate Prisma client
echo "Regenerating Prisma client..."
pnpm db:generate

# Seed database if seed script exists
if grep -q "\"db:seed\"" package.json; then
  echo "Running seed script..."
  pnpm db:seed
fi

echo ""
echo -e "${GREEN}Database reset complete!${NC}"
