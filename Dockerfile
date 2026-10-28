# Tasklore application image: API, collaboration server and worker in one process (role via MODE),
# serving the built web app.

FROM node:24-alpine AS base
ENV TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build \
 && pnpm --filter @tasklore/api deploy --prod --legacy /out/api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    MODE=all \
    API_PORT=4000 \
    COLLAB_PORT=4001 \
    WEB_DIST_DIR=/app/web
WORKDIR /app
COPY --from=build --chown=node:node /out/api ./api
COPY --from=build --chown=node:node /repo/apps/web/dist ./web
USER node
EXPOSE 4000 4001
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health/live > /dev/null || exit 1
CMD ["node", "--enable-source-maps", "api/dist/main.js"]
