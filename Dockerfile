FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
RUN npm install -g bun

# Build web frontend
FROM base AS web-build
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/web/ packages/web/
COPY tsconfig.base.json ./
RUN cd packages/web && pnpm run build

# Production server
FROM base AS production
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --prod
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
COPY tsconfig.base.json ./
COPY --from=web-build /app/packages/web/dist /app/packages/server/public

ENV RV_DATA_DIR=/data
ENV RV_PORT=3000
EXPOSE 3000
VOLUME ["/data"]

CMD ["bun", "run", "packages/server/src/index.ts"]
