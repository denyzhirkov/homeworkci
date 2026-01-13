# HomeworkCI Server Dockerfile
# Deno runtime with bundled frontend build

# === Frontend Build Stage ===
FROM node:20-slim AS client-build

WORKDIR /app/client

# Install dependencies
COPY client/package*.json ./
RUN npm ci

# Build frontend
COPY client/ ./
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# === Server Stage ===
FROM denoland/deno:2.6.3

LABEL maintainer="HomeworkCI"
LABEL description="HomeworkCI Pipeline Server (with frontend)"

WORKDIR /app

# Install common CI/CD utilities and Docker CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    git \
    jq \
    iputils-ping \
    dnsutils \
    netcat-openbsd \
    openssh-client \
    ca-certificates \
    unzip \
    zip \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Install Docker CLI (for docker module)
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && \
    apt-get install -y --no-install-recommends docker-ce-cli && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for security (using Debian commands)
# Add user to docker group for Docker socket access
RUN groupadd --system --gid 1001 homeworkci && \
    useradd --system --uid 1001 --gid homeworkci --shell /bin/false homeworkci && \
    usermod -aG docker homeworkci 2>/dev/null || true

# Create DENO_DIR inside app for proper permissions
ENV DENO_DIR=/app/.deno

# Copy dependency files first (for better layer caching)
COPY deno.json deno.lock ./

# Cache dependencies (as root, before switching user)
RUN deno cache --reload deno.json

# Copy server code
COPY server/ ./server/

# Copy default modules and pipelines to a backup location
# These will be copied to volumes if empty on first run
COPY modules/ ./defaults/modules/
COPY pipelines/ ./defaults/pipelines/
COPY config/ ./defaults/config/

# Also copy to actual locations (for non-volume usage)
COPY modules/ ./modules/
COPY pipelines/ ./pipelines/

# Copy built frontend
COPY --from=client-build /app/client/dist ./client/dist/

# Copy entrypoint script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create directories for volumes and set permissions
RUN mkdir -p /app/data /app/config /app/tmp /app/.deno && \
    chown -R homeworkci:homeworkci /app

# Cache main entry point (as root, to populate .deno cache)
RUN deno cache server/main.ts

# Ensure all cached files are owned by homeworkci
RUN chown -R homeworkci:homeworkci /app

# Switch to non-root user
USER homeworkci

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD deno eval "const r = await fetch('http://localhost:8008/api/health').catch(() => null); Deno.exit(r?.ok ? 0 : 1);" || exit 1

# Expose port
EXPOSE 8008

# Default environment variables
ENV PORT=8008 \
    HOST=0.0.0.0 \
    PIPELINES_DIR=/app/pipelines \
    MODULES_DIR=/app/modules \
    DATA_DIR=/app/data \
    CONFIG_DIR=/app/config \
    SANDBOX_DIR=/app/tmp \
    SANDBOX_MAX_AGE_HOURS=24 \
    ENABLE_SCHEDULER=true \
    DOCKER_ENABLED=false \
    DOCKER_DEFAULT_IMAGE=alpine:3.19 \
    DOCKER_MEMORY_LIMIT=512m \
    DOCKER_CPU_LIMIT=1 \
    DOCKER_NETWORK_DEFAULT=bridge \
    DOCKER_TIMEOUT_MS=600000

# Use entrypoint to initialize volumes
ENTRYPOINT ["/entrypoint.sh"]

# Run server
CMD ["deno", "run", "--allow-all", "server/main.ts"]
