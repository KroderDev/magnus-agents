FROM node:26-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

FROM node:26-alpine

WORKDIR /app

COPY package.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist/ ./dist/
COPY personas/ ./personas/

ENV NODE_ENV=production
ENV HEALTH_PORT=3000

USER node

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${HEALTH_PORT}/ || exit 1

EXPOSE 3000

CMD ["node", "dist/main.js"]
