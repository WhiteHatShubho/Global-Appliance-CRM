FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app files
COPY . .

# Expose port
EXPOSE 8080

# Set environment
ENV PORT=8080

# Start server
CMD ["node", "backend/server.js"]
