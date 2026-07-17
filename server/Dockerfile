FROM node:20-alpine AS base
WORKDIR /usr/src/app

COPY package*.json ./
#RUN npm ci --omit=dev
RUN npm install --omit=dev
COPY . .

ENV NODE_ENV=production
EXPOSE 5000

USER node
CMD ["node", "src/server.js"]
