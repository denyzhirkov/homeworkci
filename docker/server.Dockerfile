# HomeworkCI Server Dockerfile
# Deno runtime with all server dependencies

FROM denoland/deno:2.1.4

LABEL maintainer="HomeworkCI"
LABEL description="HomeworkCI Pipeline Server"

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 homeworkci && \
    adduser --system --uid 1001 --ingroup homeworkci homeworkci

# Copy dependency files first (for better layer caching)
COPY deno.json deno.lock ./

# Cache dependencies
RUN deno cache --reload deno.json

# Copy server code
COPY server/ ./server/

# Copy default modules (can be overridden by volume)
COPY modules/ ./modules/

# Copy default pipelines (can be overridden by volume)
COPY pipelines/ ./pipelines/

# Create directories for volumes
RUN mkdir -p /app/data /app/config /app/tmp && \
    chown -R homeworkci:homeworkci /app

# Cache main entry point
RUN deno cache server/main.ts

# Switch to non-root user
USER homeworkci

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD deno eval "const r = await fetch('http://localhost:8000/api/health').catch(() => null); Deno.exit(r?.ok ? 0 : 1);" || exit 1

# Expose port
EXPOSE 8000

# Default environment variables
ENV PORT=8000 \
    HOST=0.0.0.0 \
    PIPELINES_DIR=/app/pipelines \
    MODULES_DIR=/app/modules \
    DATA_DIR=/app/data \
    CONFIG_DIR=/app/config \
    SANDBOX_DIR=/app/tmp \
    SANDBOX_MAX_AGE_HOURS=24 \
    ENABLE_SCHEDULER=true

# Run server
CMD ["deno", "run", "--allow-all", "server/main.ts"]

