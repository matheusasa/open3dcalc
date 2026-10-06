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

# Production web server — nginx only, no Node
FROM nginx:alpine AS web
COPY --from=builder /app/dist-web /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]