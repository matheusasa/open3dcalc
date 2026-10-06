# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build:web

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist-web /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]