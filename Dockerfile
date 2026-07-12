FROM node:26-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@11
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN pnpm run build

FROM node:26-alpine

WORKDIR /app

RUN npm install -g pnpm@11
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/dist/ ./dist/
COPY personas/ ./personas/
COPY data/ ./data/

ENV NODE_ENV=production
ENV HEALTH_PORT=3000

USER node

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${HEALTH_PORT}/ || exit 1

EXPOSE 3000

CMD ["node", "dist/main.js"]
