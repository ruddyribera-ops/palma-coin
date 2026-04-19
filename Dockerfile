FROM node:20-alpine

WORKDIR /app

COPY . .

RUN npm install && \
    cd server && npm install && \
    cd ../client && npm install && \
    cd .. && npm run build

EXPOSE ${PORT:-3001}

CMD ["node", "server/index.js"]