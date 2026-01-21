#!/bin/bash
# Build script for offline Docker image
# Pre-builds client and caches Deno dependencies before Docker build

set -e

echo "=== HomeworkCI Offline Build Script ==="
echo ""

# Check prerequisites
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed"
    exit 1
fi

if ! command -v deno &> /dev/null; then
    echo "Error: deno is not installed"
    exit 1
fi

# Build client
echo "[1/3] Building client..."
cd client
if [ ! -d "node_modules" ]; then
    echo "  Installing npm dependencies..."
    npm ci
fi

# Set API base URL for build
export VITE_API_BASE=/api

echo "  Running build..."
npm run build

if [ ! -d "dist" ]; then
    echo "Error: Client build failed - dist directory not found"
    exit 1
fi

echo "  ✓ Client built successfully"
cd ..

# Cache Deno dependencies
echo ""
echo "[2/3] Caching Deno dependencies..."
echo "  Caching dependencies from deno.json..."
deno cache --reload deno.json

echo "  Caching all server files..."
find server -name "*.ts" -type f | xargs deno cache || true
deno cache server/main.ts server/db.ts server/config.ts

echo "  Caching all modules..."
find modules -name "*.ts" -type f 2>/dev/null | xargs deno cache || true

echo "  ✓ Deno dependencies cached (including @db/sqlite)"

# Verify all required files exist
echo ""
echo "[3/3] Verifying build artifacts..."

REQUIRED_FILES=(
    "client/dist"
    "deno.json"
    "deno.lock"
    "server/main.ts"
    "modules"
    "pipelines"
    "config"
    "docker/server.Dockerfile.offline"
    "docker/entrypoint.sh"
)

MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -e "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
    echo "Error: Missing required files:"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    exit 1
fi

echo "  ✓ All required files present"
echo ""
echo "=== Build complete! ==="
echo ""
echo "You can now build the Docker image with:"
echo ""
echo "Option 1: Build with local tag:"
echo "  docker build -f docker/server.Dockerfile.offline -t homeworkci:latest ."
echo ""
echo "Option 2: Build and tag for Docker Hub:"
echo "  docker build -f docker/server.Dockerfile.offline \\"
echo "    -t <your-username>/homeworkci:latest-offline \\"
echo "    -t <your-username>/homeworkci:v1.16.3-offline ."
echo ""
echo "Then push to Docker Hub:"
echo "  docker push <your-username>/homeworkci:latest-offline"
echo "  docker push <your-username>/homeworkci:v1.16.3-offline"
echo ""
echo "Note: Docker automatically uses docker/server.Dockerfile.offline.dockerignore"
