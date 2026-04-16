FROM node:20-alpine

WORKDIR /app

# Install dependencies for sql.js (native compilation)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies
RUN npm install && \
    cd server && npm install && \
    cd ../client && npm install && \
    cd .. && npm run build

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "server/index.js"]