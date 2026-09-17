# syntax=docker/dockerfile:1.7
FROM node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install --global pnpm@10.34.5 --registry=https://registry.npmjs.org
WORKDIR /workspace

COPY . .
RUN pnpm install --frozen-lockfile --prod=false
RUN pnpm --filter @exhibition/web build

FROM nginx:1.27-alpine AS runtime

COPY --from=builder /workspace/apps/web/dist/ /usr/share/nginx/html/
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # index.html 不缓存，确保发布后客户端获取最新版本
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Vite 带 hash 的静态资源长缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
