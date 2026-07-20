FROM node:22

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ENV NODE_ENV=production

EXPOSE 5000

# Change this: Point to the server folder inside /app
CMD ["node", "src/server.js"]
