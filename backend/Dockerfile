FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/migrations ./dist/migrations
COPY --from=builder /app/src/migrations ./src/migrations
EXPOSE 5000
USER node
CMD ["sh", "-c", "node dist/config/initDb.js && node dist/index.js"]
