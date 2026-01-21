# Building and Publishing Docker Image

## Prerequisites

1. Make sure you have a Docker Hub account
2. Log in to Docker Hub:
   ```bash
   docker login
   ```

## Building the Image

### Standard Build (requires internet during build)

The standard Dockerfile builds the client inside Docker, which requires internet access:

```bash
# Build image with tag
docker build -f docker/server.Dockerfile -t <your-dockerhub-username>/homeworkci:latest .

# Or with version tag
docker build -f docker/server.Dockerfile -t <your-dockerhub-username>/homeworkci:v1.16.3 .
```

### Offline Build (for environments with limited internet)

For environments with limited or no internet access, pre-build the client locally:

```bash
# Step 1: Pre-build client and cache Deno dependencies
./scripts/build-offline.sh

# Step 2: Build Docker image using offline Dockerfile
# Docker automatically uses server.Dockerfile.offline.dockerignore
docker build -f docker/server.Dockerfile.offline -t <your-dockerhub-username>/homeworkci:latest .

# Or with version tag
docker build -f docker/server.Dockerfile.offline -t <your-dockerhub-username>/homeworkci:v1.16.3 .

# Or tag as offline variant
docker build -f docker/server.Dockerfile.offline -t <your-dockerhub-username>/homeworkci:latest-offline .
```

**Note:** The offline build script:
- Builds the client frontend locally (requires Node.js and npm)
- Caches Deno dependencies locally
- Verifies all required files are present

This ensures the Docker build process doesn't need internet access (except for pulling base images and installing system packages, which can be done once and cached).

## Publishing to Docker Hub

### Standard Build

```bash
# Push image to Docker Hub
docker push <your-dockerhub-username>/homeworkci:latest
docker push <your-dockerhub-username>/homeworkci:v1.16.3
```

### Offline Build

After building the offline image, you can publish it to Docker Hub:

```bash
# Tag the offline image (if not already tagged)
docker tag homeworkci:latest <your-dockerhub-username>/homeworkci:latest-offline
docker tag homeworkci:latest <your-dockerhub-username>/homeworkci:v1.16.3-offline

# Or build directly with Docker Hub tag
docker build -f docker/server.Dockerfile.offline \
  -t <your-dockerhub-username>/homeworkci:latest-offline \
  -t <your-dockerhub-username>/homeworkci:v1.16.3-offline .

# Push to Docker Hub
docker push <your-dockerhub-username>/homeworkci:latest-offline
docker push <your-dockerhub-username>/homeworkci:v1.16.3-offline
```

**Note:** The offline image is identical to the standard image in functionality - it's just built differently. You can use either tag (`latest` or `latest-offline`) depending on your preference.

## Using the Published Image

Instead of building, you can use the pre-built image:

```yaml
# docker-compose.yml
services:
  server:
    image: <your-dockerhub-username>/homeworkci:latest
    # ... rest of configuration
```

## Environment Variables

All variables from `env.example` are supported and can be passed through:
- `.env` file (for docker-compose)
- Environment variables in docker-compose.yml
- `-e` flags when running `docker run`

### Main Variables:

- `PORT` - Server port (default: 8008)
- `HOST` - Host binding (default: 0.0.0.0)
- `DOCKER_ENABLED` - Enable Docker module (default: false)
- `ENABLE_SCHEDULER` - Enable scheduler (default: true)
- `SANDBOX_MAX_AGE_HOURS` - Sandbox lifetime (default: 24)
- `MAX_CONCURRENT_RUNS_PER_PIPELINE` - Maximum concurrent runs (default: 1)

See `env.example` for the complete list of variables.

## Example Usage

```bash
# Using docker-compose
cp env.example .env
# Edit .env if needed
docker compose up -d

# Or directly via docker run
docker run -d \
  --name homeworkci \
  -p 80:8008 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /tmp/homeworkci:/app/tmp \
  -e DOCKER_ENABLED=true \
  <your-dockerhub-username>/homeworkci:latest
```
