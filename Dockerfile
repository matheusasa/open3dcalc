# Base stage with dependencies
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Build stage for web assets
FROM base AS builder
COPY . .
RUN npm run build:web

# Migration runner — has Node + project files to run db:migrate
FROM base AS migrate
COPY . .

# API server — Express backend for web version
FROM base AS api
COPY . .
EXPOSE 3001
CMD ["npx", "tsx", "server/index.ts"]

# Production web server — nginx only, no Node
FROM nginx:alpine AS web
COPY --from=builder /app/dist-web /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]