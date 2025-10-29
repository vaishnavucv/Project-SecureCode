# Multi-stage Dockerfile for Secure File Upload Application
# Following OWASP best practices for container security

# Base image
FROM node:22-alpine AS base

# Set working directory
WORKDIR /app

# Stage 1: Install dependencies
FROM base AS deps

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Stage 2: Production stage
FROM base AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S secureapp -u 1001

# Set Environment
ENV NODE_ENV=production

# App files
COPY --from=deps /app/package*.json ./
COPY --chown=secureapp:nodejs . .

# Create necessary directories with proper permissions
RUN mkdir -p uploads logs data && \
    chown -R secureapp:nodejs uploads logs data && \
    chmod 755 uploads logs data

# Switch to non-root user
USER secureapp

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "src/main/app.js"]
