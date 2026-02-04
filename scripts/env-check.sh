#!/bin/bash
# Environment verification script for GenAI2
# Run this before starting development to ensure all services are ready

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================"
echo "GenAI2 Environment Check"
echo "============================================"

ERRORS=0
WARNINGS=0

# Check PostgreSQL
echo -n "PostgreSQL (localhost:5432)... "
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}NOT RUNNING${NC}"
  echo "  Start with: docker compose up -d postgres"
  ERRORS=$((ERRORS + 1))
fi

# Check Redis
echo -n "Redis (localhost:6379)... "
if redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}NOT RUNNING${NC}"
  echo "  Start with: docker compose up -d redis"
  WARNINGS=$((WARNINGS + 1))
fi

# Check .env file
echo -n ".env file... "
if [ -f ".env" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}MISSING${NC}"
  if [ -f ".env.example" ]; then
    echo "  Copy from example: cp .env.example .env"
  fi
  WARNINGS=$((WARNINGS + 1))
fi

# Check node_modules
echo -n "node_modules... "
if [ -d "node_modules" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}MISSING${NC}"
  echo "  Run: pnpm install"
  ERRORS=$((ERRORS + 1))
fi

# Check Prisma client
echo -n "Prisma client... "
if [ -d "node_modules/.prisma/client" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}NOT GENERATED${NC}"
  echo "  Run: pnpm db:generate"
  WARNINGS=$((WARNINGS + 1))
fi

# Check DATABASE_URL
echo -n "DATABASE_URL... "
if [ -f ".env" ]; then
  source .env 2>/dev/null || true
fi
if [ -n "$DATABASE_URL" ]; then
  echo -e "${GREEN}SET${NC}"
else
  echo -e "${YELLOW}NOT SET${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

# Summary
echo ""
echo "============================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}All checks passed! Ready to develop.${NC}"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}$WARNINGS warning(s) - development may work but review above${NC}"
  exit 0
else
  echo -e "${RED}$ERRORS error(s), $WARNINGS warning(s) - fix before proceeding${NC}"
  exit 1
fi
