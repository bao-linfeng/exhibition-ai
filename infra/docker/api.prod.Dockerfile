FROM node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d AS deps

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install --global pnpm@10.34.5 --registry=https://registry.npmjs.org
WORKDIR /workspace

COPY . .
RUN pnpm install --frozen-lockfile --prod=false

FROM deps AS builder

RUN pnpm -r build
RUN pnpm deploy --filter @exhibition/api --prod --legacy /app

FROM node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d AS runtime

ENV NODE_ENV=production
ENV APP_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /app ./

USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
