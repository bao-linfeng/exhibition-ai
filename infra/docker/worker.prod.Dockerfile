FROM node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d AS deps

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install --global pnpm@10.34.5 --registry=https://registry.npmjs.org
WORKDIR /workspace

COPY . .
RUN pnpm install --frozen-lockfile --prod=false

FROM deps AS builder

RUN pnpm -r build
RUN pnpm deploy --filter @exhibition/worker --prod --legacy /app

FROM node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d AS runtime

ENV NODE_ENV=production
ENV APP_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /app ./

USER node
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD node -e "const f=require('node:fs'),p=process.env.WORKER_HEALTH_FILE||'/tmp/exhibition-worker-health';try{process.exit(Date.now()-f.statSync(p).mtimeMs<30000?0:1)}catch{process.exit(1)}"
CMD ["node", "dist/index.js"]
