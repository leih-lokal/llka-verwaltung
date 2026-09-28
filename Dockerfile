# Multi-stage Dockerfile for LLKA-V (Next.js 16 + standalone output)
# Build: docker build -t llka-verwaltung .
#        (optional: --build-arg BASE_PATH=/verwaltung --build-arg NEXT_PUBLIC_POCKETBASE_URL=https://…)
# Run:   docker run -p 3000:3000 llka-verwaltung

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:24-alpine AS deps

WORKDIR /app

# Install dependencies needed for some npm packages
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --ignore-scripts

# ============================================
# Stage 2: Builder
# ============================================
FROM node:24-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time settings, inlined into the client bundle by next.config.ts:
#   BASE_PATH                   serve under a subpath, e.g. /verwaltung
#   NEXT_PUBLIC_POCKETBASE_URL  server URL prefilled on the login page
#   BUILD_COMMIT                commit shown in the menu footer (.git isn't copied)
ARG BASE_PATH
ARG NEXT_PUBLIC_POCKETBASE_URL
ARG BUILD_COMMIT

# Set environment variables for standalone build
ENV DOCKER_BUILD=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# ============================================
# Stage 3: Runner (Production)
# ============================================
FROM node:24-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
# The standalone output includes a minimal server
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
