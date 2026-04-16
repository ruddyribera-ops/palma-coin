FROM node:20-alpine

WORKDIR /app

# Install dependencies for sql.js (native compilation)
RUN apk add --no-cache python3 make g++

# Copy all source files
COPY . .

# Install dependencies and build
RUN npm install && \
    cd server && npm install && \
    cd ../client && npm install && \
    cd .. && npm run build

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "server/index.js"]