FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json* ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application source
COPY . .

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "src/server.js"]
