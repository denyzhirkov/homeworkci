# Offline Docker Build Guide

This guide explains how to build the Docker image for environments with limited or no internet access.

## Overview

The standard Docker build process requires internet access to:
- Download npm packages for client build
- Download Deno dependencies
- Pull base Docker images

For offline environments, we pre-build everything locally and then create a Docker image that doesn't need internet during build.

## Prerequisites

On a machine **with internet access**, you need:
- Node.js 20+ and npm
- Deno 2.0+
- Docker (for building the image)

## Step-by-Step Process

### 1. Pre-build Everything Locally

Run the offline build script:

```bash
./scripts/build-offline.sh
```

This script will:
- ✅ Install npm dependencies for the client
- ✅ Build the client frontend (creates `client/dist/`)
- ✅ Cache Deno dependencies locally
- ✅ Verify all required files are present

**Output:** The script creates `client/dist/` directory with the built frontend.

### 2. Build Docker Image

Use the offline Dockerfile (Docker automatically uses `server.Dockerfile.offline.dockerignore`):

```bash
docker build -f docker/server.Dockerfile.offline -t homeworkci:latest .
```

**What happens:**
- Docker automatically uses `docker/server.Dockerfile.offline.dockerignore` (which allows `client/dist/`)
- The offline Dockerfile uses the pre-built `client/dist/` from step 1
- Deno dependencies are already cached (though Dockerfile will verify them)
- No internet access needed during Docker build (except for base images, which should be cached)

### 3. Publish to Docker Hub (Optional)

If you want to publish the offline-built image to Docker Hub:

```bash
# Tag the image for Docker Hub
docker tag homeworkci:latest <your-dockerhub-username>/homeworkci:latest-offline
docker tag homeworkci:latest <your-dockerhub-username>/homeworkci:v1.16.3-offline

# Or build directly with Docker Hub tags
docker build -f docker/server.Dockerfile.offline \
  -t <your-dockerhub-username>/homeworkci:latest-offline \
  -t <your-dockerhub-username>/homeworkci:v1.16.3-offline .

# Login to Docker Hub (if not already logged in)
docker login

# Push to Docker Hub
docker push <your-dockerhub-username>/homeworkci:latest-offline
docker push <your-dockerhub-username>/homeworkci:v1.16.3-offline
```

**Benefits of publishing:**
- Others can pull the pre-built image without building
- Can be used in CI/CD pipelines
- Version control through tags
- No need to transfer tar files manually

### 4. Transfer to Offline Environment

**Option A: Using Docker Hub (if published)**

On the offline environment, pull from Docker Hub (if it has limited internet access):

```bash
docker pull <your-dockerhub-username>/homeworkci:latest-offline
```

**Option B: Using tar file (fully offline)**

Transfer the built image to your offline environment:

```bash
# Save image to tar file
docker save homeworkci:latest -o homeworkci-latest.tar

# Transfer homeworkci-latest.tar to offline environment

# On offline environment, load the image
docker load -i homeworkci-latest.tar
```

## Alternative: Build on Offline Machine

If you have the pre-built `client/dist/` directory, you can build directly on the offline machine:

```bash
# Ensure client/dist/ exists (from previous build)
# Then build:
docker build -f docker/server.Dockerfile.offline -t homeworkci:latest .
```

**Note:** You still need Docker base images (`denoland/deno:2.6.3`). These should be pulled once on a machine with internet and then transferred or cached.

## What's Included in the Image

The offline build includes:
- ✅ Pre-built client frontend (`client/dist/`)
- ✅ Server code (Deno)
- ✅ **All Deno dependencies pre-cached** (including @db/sqlite, hono, etc.)
- ✅ All modules and pipelines
- ✅ Default configuration
- ✅ Entrypoint script
- ✅ All system dependencies (curl, git, docker-cli, etc.)

**Important:** All JSR and npm dependencies are cached during build, so the image doesn't need internet access at runtime.

## Verification

After building, verify the image:

```bash
# Check image was created
docker images | grep homeworkci

# Test run (optional)
docker run --rm homeworkci:latest deno --version
```

## Troubleshooting

### Error: "client/dist is missing or empty"

**Solution:** Run `./scripts/build-offline.sh` first to build the client.

### Error: "Some dependencies may need internet access"

**Solution:** This is a warning, not an error. Deno dependencies should be pre-cached. If you see this, ensure you ran the build script on a machine with internet.

### Base image not found

**Solution:** Pull base images on a machine with internet:
```bash
docker pull denoland/deno:2.6.3
docker pull node:20-slim
```
Then save and transfer them, or use a Docker registry mirror in your offline environment.

## Summary

1. **On machine with internet:** Run `./scripts/build-offline.sh`
2. **Build image:** `docker build -f docker/server.Dockerfile.offline -t homeworkci:latest .`
3. **Publish (optional):** Tag and push to Docker Hub
4. **Transfer:** Either pull from Docker Hub or use `docker save` → transfer → `docker load`
5. **Run:** Use the image as normal

The resulting image is completely self-contained and doesn't need internet to run.

## Publishing Workflow Example

Complete workflow for building and publishing an offline image:

```bash
# 1. Pre-build everything
./scripts/build-offline.sh

# 2. Build and tag for Docker Hub
docker build -f docker/server.Dockerfile.offline \
  -t yourusername/homeworkci:latest-offline \
  -t yourusername/homeworkci:v1.16.3-offline .

# 3. Login to Docker Hub
docker login

# 4. Push to Docker Hub
docker push yourusername/homeworkci:latest-offline
docker push yourusername/homeworkci:v1.16.3-offline

# 5. On target machine (with limited internet), pull the image
docker pull yourusername/homeworkci:latest-offline
```
