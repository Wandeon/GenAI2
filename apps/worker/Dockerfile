# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/llm/package.json ./packages/llm/
COPY packages/ui/package.json ./packages/ui/
COPY packages/trpc/package.json ./packages/trpc/
RUN pnpm install --frozen-lockfile

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm db:generate
RUN pnpm build --filter @genai/worker

# Create deployment with pnpm deploy (self-contained node_modules)
RUN pnpm --filter @genai/worker deploy --prod /app/deploy

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker

# Copy deployed package (includes node_modules)
COPY --from=builder /app/deploy ./
# Copy built dist
COPY --from=builder /app/apps/worker/dist ./dist
# Copy prisma for migrations
COPY --from=builder /app/packages/db/prisma ./prisma

USER worker

CMD ["node", "dist/index.js"]
