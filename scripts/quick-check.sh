#!/bin/bash
# Quick verification for GenAI2
# Runs only typecheck and tests (skips build/lint for speed)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "Quick verification (typecheck + test)..."
echo ""

# Typecheck
echo -n "Typecheck... "
if pnpm typecheck > /dev/null 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAILED${NC}"
  pnpm typecheck
  exit 1
fi

# Tests
echo -n "Tests... "
if pnpm test > /dev/null 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAILED${NC}"
  pnpm test
  exit 1
fi

echo ""
echo -e "${GREEN}All checks passed!${NC}"
