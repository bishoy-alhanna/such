FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.json* ./
COPY index.html ./
COPY public ./public
COPY src ./src
RUN npm install --legacy-peer-deps && npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
