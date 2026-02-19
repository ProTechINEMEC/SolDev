FROM node:18-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source code
COPY . .

# Create required directories
RUN mkdir -p /app/uploads /app/logs

# Create non-root user for security
RUN addgroup -S app && adduser -S app -G app && \
    chown -R app:app /app

USER app

# Expose port
EXPOSE 11001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:11001/health || exit 1

# Start the application
CMD ["node", "src/index.js"]
