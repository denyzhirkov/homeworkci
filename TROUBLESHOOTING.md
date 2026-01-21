# Troubleshooting Guide

## SQLite Dependency Not Found in Offline Environment

### Problem

When running the Docker image on a server with limited internet access, you may see errors like:

```
error: Module not found "jsr:@db/sqlite@^0.12"
error: Module not found "@db/sqlite"
```

### Root Cause

Deno tries to download dependencies from JSR (JavaScript Registry) at runtime if they're not properly cached in the image.

### Solution

The Dockerfile has been updated to cache all dependencies during build. However, if you still encounter this issue:

#### 1. Verify Dependencies Are Cached During Build

Check the build logs for lines like:
```
Caching dependencies from deno.json...
Caching all server files...
```

If you see errors during the cache step, the build machine needs internet access.

#### 2. Rebuild the Image

Make sure to rebuild the image with the updated Dockerfile:

```bash
# For offline build
./scripts/build-offline.sh
docker build -f docker/server.Dockerfile.offline -t homeworkci:latest .

# For standard build
docker build -f docker/server.Dockerfile -t homeworkci:latest .
```

#### 3. Verify Cache in Image

You can verify that dependencies are cached by inspecting the image:

```bash
# Check if .deno cache exists
docker run --rm homeworkci:latest ls -la /app/.deno

# Try to verify cache
docker run --rm homeworkci:latest deno cache --check server/db.ts
```

#### 4. Manual Cache Verification

If the issue persists, you can manually verify the cache:

```bash
# Run container interactively
docker run -it --rm homeworkci:latest sh

# Inside container, check cache
ls -la /app/.deno/deps/

# Try to import manually (should use existing cache)
deno eval "import('@db/sqlite').then(() => console.log('OK')).catch(e => console.error('Error:', e))"
```

### Prevention

1. **Always build on a machine with internet access** - The build process needs internet to download dependencies from JSR and npm.

2. **Use the offline build script** - The `build-offline.sh` script pre-caches dependencies locally before building the image.

3. **Verify build logs** - Check that the cache step completes without errors.

4. **Test the image before deployment** - Run a quick test to ensure dependencies are available:

```bash
docker run --rm homeworkci:latest deno eval "import('@db/sqlite').then(() => console.log('✓ SQLite available')).catch(e => { console.error('✗ SQLite not available:', e); Deno.exit(1); })"
```

### Alternative: Pre-download Dependencies

If you need to work in a completely offline environment, you can:

1. Build the image on a machine with internet
2. Export the `.deno` cache from the built image
3. Include it in your offline build

```bash
# Extract cache from built image
docker create --name temp homeworkci:latest
docker cp temp:/app/.deno ./deno-cache
docker rm temp

# In offline Dockerfile, copy cache before running
COPY deno-cache /app/.deno
```

## Other Common Issues

### Module Not Found Errors

If you see "Module not found" errors for other dependencies:

1. Check `deno.json` - Ensure all dependencies are listed
2. Rebuild the image - Dependencies may not have been cached
3. Check build logs - Look for cache errors during build

### Permission Errors

If you see permission errors with `.deno` directory:

1. Ensure the Dockerfile sets correct ownership:
   ```dockerfile
   RUN chown -R homeworkci:homeworkci /app/.deno
   ```

2. Check that DENO_DIR is set correctly:
   ```dockerfile
   ENV DENO_DIR=/app/.deno
   ```

### Network Issues During Build

If the build fails to download dependencies:

1. Check internet connection on build machine
2. Verify DNS resolution
3. Check for firewall/proxy issues
4. Try building with `--network=host` flag (Linux only)
