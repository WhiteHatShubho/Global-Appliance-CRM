FROM node:18-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy backend directory with its dependencies
COPY backend ./backend

# Install root dependencies
RUN npm ci --only=production

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --only=production || true

WORKDIR /app

# Expose port
EXPOSE 8080

# Set environment
ENV PORT=8080

# Start backend server
CMD ["node", "backend/server.js"]
