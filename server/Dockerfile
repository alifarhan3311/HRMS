FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./

RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "src/server.js"] 
