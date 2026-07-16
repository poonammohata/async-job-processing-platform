# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

RUN npm ci

COPY apps/api/prisma ./apps/api/prisma

RUN npm exec --workspace=apps/api -- prisma generate

COPY apps/api/nest-cli.json \
  apps/api/tsconfig.json \
  apps/api/tsconfig.build.json \
  ./apps/api/
COPY apps/api/src ./apps/api/src

RUN npm run build --workspace=apps/api

FROM node:22-alpine AS production

WORKDIR /app

RUN apk add --no-cache openssl wget \
  && addgroup -g 1001 -S appgroup \
  && adduser -S appuser -u 1001 -G appgroup

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=appuser:appgroup /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=appuser:appgroup /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/@prisma ./node_modules/@prisma

USER appuser

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
