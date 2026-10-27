FROM node:22-alpine AS builder

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 5173;
    root /usr/share/nginx/html;
    index index.html;

    location /v1/ {
        proxy_pass http://api:8080/v1/;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
