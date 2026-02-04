#!/bin/bash
# Environment verification hook for GenAI2
# Runs on session start to ensure all services are ready

set -e

echo "Verifying GenAI2 development environment..."

# Check PostgreSQL
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
  echo "WARNING: PostgreSQL is not running on localhost:5432" >&2
  echo "Start with: docker compose up -d postgres" >&2
  # Don't exit with error - just warn, let user decide
fi

# Check Redis
if ! redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; then
  echo "WARNING: Redis is not running on localhost:6379" >&2
  echo "Start with: docker compose up -d redis" >&2
fi

# Check if .env exists
if [ ! -f "$CLAUDE_PROJECT_DIR/.env" ]; then
  if [ -f "$CLAUDE_PROJECT_DIR/.env.example" ]; then
    echo "WARNING: .env file not found. Copy from .env.example:" >&2
    echo "  cp .env.example .env" >&2
  fi
fi

# Check if node_modules exists
if [ ! -d "$CLAUDE_PROJECT_DIR/node_modules" ]; then
  echo "WARNING: node_modules not found. Run: pnpm install" >&2
fi

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  # Try to source .env
  if [ -f "$CLAUDE_PROJECT_DIR/.env" ]; then
    source "$CLAUDE_PROJECT_DIR/.env" 2>/dev/null || true
  fi

  if [ -z "$DATABASE_URL" ]; then
    echo "INFO: DATABASE_URL not set in environment" >&2
  fi
fi

echo "Environment check complete"
exit 0
