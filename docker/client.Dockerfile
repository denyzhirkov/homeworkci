# HomeworkCI Client Dockerfile
# Multi-stage build: Node.js for build, Nginx for serving

# === Build Stage ===
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY client/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY client/ ./

# Build argument for API base URL (used at build time)
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE

# Build the app
RUN npm run build

# === Production Stage ===
FROM nginx:alpine

LABEL maintainer="HomeworkCI"
LABEL description="HomeworkCI Web Interface"

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1001 -S homeworkci && \
    adduser -u 1001 -S homeworkci -G homeworkci && \
    chown -R homeworkci:homeworkci /usr/share/nginx/html && \
    chown -R homeworkci:homeworkci /var/cache/nginx && \
    chown -R homeworkci:homeworkci /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R homeworkci:homeworkci /var/run/nginx.pid

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Run as non-root (optional, nginx needs to bind to port 80)
# USER homeworkci

CMD ["nginx", "-g", "daemon off;"]

