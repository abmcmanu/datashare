# ── Stage 1 : build Angular ──────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /build

# pnpm via corepack (évite un npm install global)
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ── Stage 2 : nginx non-root ─────────────────────────────────────────────────
# nginxinc/nginx-unprivileged tourne sur le port 8080 sans root
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Fichiers Angular (Angular 17+ génère dist/datashare/browser/)
COPY --from=builder /build/dist/datashare/browser /usr/share/nginx/html

# Configuration nginx custom
COPY ops/nginx/nginx.conf      /etc/nginx/nginx.conf
COPY ops/nginx/conf.d/         /etc/nginx/conf.d/

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/ || exit 1