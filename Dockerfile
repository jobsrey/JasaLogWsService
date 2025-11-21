# Dockerfile untuk AIS WebSocket Server
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Expose WebSocket port
EXPOSE 8080


# Start the application
CMD ["node", "server.js"]