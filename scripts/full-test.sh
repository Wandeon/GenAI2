#!/bin/bash
# Full test suite for GenAI2
# Runs build, typecheck, lint, and tests

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "============================================"
echo "GenAI2 Full Test Suite"
echo "============================================"
echo ""

# Track timing
START_TIME=$(date +%s)

# 1. Environment check
echo -e "${BLUE}[1/5] Environment check...${NC}"
if ! ./scripts/env-check.sh > /dev/null 2>&1; then
  echo -e "${YELLOW}Warning: Some environment checks failed${NC}"
fi
echo ""

# 2. Build
echo -e "${BLUE}[2/5] Building packages...${NC}"
if pnpm build; then
  echo -e "${GREEN}Build passed${NC}"
else
  echo -e "${RED}Build failed!${NC}"
  exit 1
fi
echo ""

# 3. Typecheck
echo -e "${BLUE}[3/5] Type checking...${NC}"
if pnpm typecheck; then
  echo -e "${GREEN}Typecheck passed${NC}"
else
  echo -e "${RED}Typecheck failed!${NC}"
  exit 1
fi
echo ""

# 4. Lint
echo -e "${BLUE}[4/5] Linting...${NC}"
if pnpm lint; then
  echo -e "${GREEN}Lint passed${NC}"
else
  echo -e "${YELLOW}Lint warnings (non-blocking)${NC}"
fi
echo ""

# 5. Tests
echo -e "${BLUE}[5/5] Running tests...${NC}"
if pnpm test; then
  echo -e "${GREEN}Tests passed${NC}"
else
  echo -e "${RED}Tests failed!${NC}"
  exit 1
fi
echo ""

# Summary
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "============================================"
echo -e "${GREEN}All checks passed!${NC}"
echo "Duration: ${DURATION}s"
echo "============================================"
