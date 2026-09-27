# Docker Deployment Guide

This guide covers deploying LLKA-V (the Next.js frontend) using Docker.

## Prerequisites

- Docker installed on your system
- A running PocketBase instance (see [leihbackend](https://github.com/leih-lokal/leihbackend))

## Building the Image

```bash
docker build -t llka-verwaltung .
```

## Running the Container

```bash
docker run -p 3000:3000 llka-verwaltung
```

The application will be available at `http://localhost:3000`.

## Environment Variables

Runtime (`docker run -e …`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the server listens on |
| `HOSTNAME` | `0.0.0.0` | Hostname to bind to |

Build time (`docker build --build-arg …`). These are inlined into the client bundle, so changing them requires a rebuild:

| Build arg | Default | Description |
|-----------|---------|-------------|
| `BASE_PATH` | (empty) | Serve the app under a subpath, e.g. `/verwaltung` |
| `NEXT_PUBLIC_POCKETBASE_URL` | `http://localhost:8090` | Server URL prefilled on the login page |
| `BUILD_COMMIT` | `dev` | Commit hash shown in the menu footer (`.git` isn't copied into the image) |

```bash
docker build \
  --build-arg BASE_PATH=/verwaltung \
  --build-arg NEXT_PUBLIC_POCKETBASE_URL=https://api.example.com \
  --build-arg BUILD_COMMIT=$(git rev-parse --short HEAD) \
  -t llka-verwaltung .
```

Note: The PocketBase URL is configured at runtime through the login page and stored in the browser's localStorage.

---

## Deployment Options

### Option 1: Separate Domains (CORS required)

Run the frontend and backend on different domains/ports:

- Frontend: `https://app.example.com`
- Backend: `https://api.example.com`

**PocketBase CORS Configuration:**

PocketBase allows all origins by default. To restrict it to the frontend, start it with `--origins`:

```bash
./pocketbase serve --origins=https://app.example.com
```

### Option 2: Same-Origin with Reverse Proxy (Recommended)

Serve both frontend and backend through a single domain using path-based routing:

- `/` → Next.js frontend
- `/api/` → PocketBase API
- `/_/` → PocketBase Admin UI

This avoids CORS configuration entirely.

#### Nginx Configuration

```nginx
upstream frontend {
    server localhost:3000;
}

upstream pocketbase {
    server localhost:8090;
}

server {
    listen 80;
    server_name example.com;

    # Frontend (Next.js)
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # PocketBase API
    location /api/ {
        proxy_pass http://pocketbase/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # PocketBase Admin UI
    location /_/ {
        proxy_pass http://pocketbase/_/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Caddy Configuration

```caddyfile
example.com {
    # PocketBase API + Admin UI (paths are passed through unchanged)
    @pocketbase path /api/* /_/*
    handle @pocketbase {
        reverse_proxy localhost:8090
    }

    # Everything else: frontend (Next.js)
    handle {
        reverse_proxy localhost:3000
    }
}
```

`handle_path` would strip the `/api` prefix before proxying, and `reverse_proxy /` only matches the exact path `/`, so neither is used here.

---

## Docker Compose Example

For local development with both services:

```yaml
# docker-compose.yml
services:
  frontend:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - pocketbase
    restart: unless-stopped

  pocketbase:
    image: ghcr.io/leih-lokal/leihbackend:latest
    ports:
      - "8090:8090"
    volumes:
      - pocketbase_data:/pb/pb_data
    restart: unless-stopped

volumes:
  pocketbase_data:
```

Start both services:

```bash
docker compose up -d
```

Then access:
- Frontend: `http://localhost:3000`
- PocketBase Admin: `http://localhost:8090/_/`

On the login page, enter `http://localhost:8090` as the server URL.

---

## Production Checklist

- [ ] Use HTTPS in production (via reverse proxy or load balancer)
- [ ] Configure proper CORS if using separate domains
- [ ] Set up health checks for container orchestration
- [ ] Configure log aggregation
- [ ] Set up backup strategy for PocketBase data volume
- [ ] Consider using a container registry for versioned images

## Health Check

Add to your Docker run or compose:

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:3000/"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

## Troubleshooting

### Container won't start

Check the logs:
```bash
docker logs <container_id>
```

### Can't connect to PocketBase

1. Ensure PocketBase is running and accessible
2. Check that the URL entered on login includes the correct port
3. If using same-origin setup, verify reverse proxy configuration
4. Check browser console for CORS errors

### Static assets not loading

If serving from a subdirectory, the base path has to be set when building the image (it's compiled into the bundle; setting it at `docker run` has no effect):
```bash
docker build --build-arg BASE_PATH=/app -t llka-verwaltung .
docker run -p 3000:3000 llka-verwaltung
```
