FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./

RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production

EXPOSE 5000

# Change this: Point to the server folder inside /app
CMD ["node", "server/src/server.js"]
