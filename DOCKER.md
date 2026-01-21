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

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the server listens on |
| `HOSTNAME` | `0.0.0.0` | Hostname to bind to |
| `NEXT_PUBLIC_BASE_PATH` | (empty) | Base path for assets (if serving from subdirectory) |

Note: The PocketBase URL is configured at runtime through the login page and stored in the browser's localStorage.

---

## Deployment Options

### Option 1: Separate Domains (CORS required)

Run the frontend and backend on different domains/ports:

- Frontend: `https://app.example.com`
- Backend: `https://api.example.com`

**PocketBase CORS Configuration:**

In your PocketBase settings or code, configure CORS to allow the frontend origin:

```go
// In your PocketBase main.go
app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
    e.Router.Use(middleware.CORSWithConfig(middleware.CORSConfig{
        AllowOrigins:     []string{"https://app.example.com"},
        AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete},
        AllowHeaders:     []string{"*"},
        AllowCredentials: true,
    }))
    return nil
})
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
    # Frontend (Next.js)
    reverse_proxy / localhost:3000

    # PocketBase API
    handle_path /api/* {
        reverse_proxy localhost:8090
    }

    # PocketBase Admin UI
    handle_path /_/* {
        reverse_proxy localhost:8090
    }
}
```

---

## Docker Compose Example

For local development with both services:

```yaml
# docker-compose.yml
version: '3.8'

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

If serving from a subdirectory, set `NEXT_PUBLIC_BASE_PATH`:
```bash
docker run -e NEXT_PUBLIC_BASE_PATH=/app -p 3000:3000 llka-verwaltung
```
