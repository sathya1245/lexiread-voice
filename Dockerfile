# ---------------------------------------------------------------------------
# LexiRead — single-service image (API + built client in one Node process)
# ---------------------------------------------------------------------------

# Workspace install stage: installs every workspace's dependencies.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

# Build stage: produces client/dist.
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

# Runtime: only production dependencies are needed.
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0 \
    DATA_DIR=/data
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/shared ./shared
COPY --from=build /app/server/src ./server/src
COPY --from=build /app/client/dist ./client/dist

# The SQLite database lives here — mount a volume for persistence.
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/src/index.js"]
