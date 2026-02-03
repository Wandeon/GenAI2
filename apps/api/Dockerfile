# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/trpc/package.json ./packages/trpc/
COPY packages/llm/package.json ./packages/llm/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm db:generate
RUN pnpm build --filter @genai/api

# Create deployment with pnpm deploy (self-contained node_modules)
RUN pnpm --filter @genai/api deploy --prod /app/deploy

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api

# Copy deployed package (includes node_modules)
COPY --from=builder /app/deploy ./
# Copy built dist
COPY --from=builder /app/apps/api/dist ./dist
# Copy prisma for migrations
COPY --from=builder /app/packages/db/prisma ./prisma

USER api
EXPOSE 4000
ENV PORT=4000
ENV HOST="0.0.0.0"

CMD ["node", "dist/index.js"]
