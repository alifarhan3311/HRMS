FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install -g npm@11.14.1

RUN npm install

COPY . .

# Direct ENV define kar diya bina kisi ARG ke
ENV VITE_API_BASE_URL=https://www.mhcirclesolutions.com/api/v1

RUN npm run build

FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx","-g","daemon off;"]