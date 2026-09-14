# 本地工程依赖基线

核实日期：2026-09-14。以较新的 `REQUIREMENTS_AI_DEVELOPMENT.md` 为准，使用 Node 24，原始技术选型中的 Node 22 不是当前安装要求。

本次只引入最小可运行开发环境实际使用的依赖。Router、Pinia、Tailwind、UI registry、Drizzle、Mastra 与 AI Provider 在对应功能实现时再核实引入；不创建空 `packages/ai` 或空业务模块，不代表 T001～T005 的全部验收完成。

## Runtime 与镜像

Node `24.15.0`、pnpm `10.34.5`。版本分别固定在 `.node-version`、根 `package.json` 与 Dockerfile。Node、PG/pgvector、Redis、RustFS 镜像已实际拉取，digest 记录在 `infra/compose.dev.yaml` 与 `infra/docker/dev.Dockerfile`，不依赖浮动标签解析。

## npm 直接依赖

以下版本由 npm 官方 registry 的 `version`、`engines`、`peerDependencies`、`license` 元数据核实。精确直接版本在各 `package.json`，完整传递依赖固定在唯一 `pnpm-lock.yaml`。

| 包                 | 版本            | 兼容约束或用途                     | 许可证     |
| ------------------ | --------------- | ---------------------------------- | ---------- |
| vue                | 3.5.42          | TypeScript peer `*`                | MIT        |
| vite               | 8.3.0           | Node `^20.19.0或>=22.12.0`         | MIT        |
| @vitejs/plugin-vue | 6.0.9           | Vue `^3.2.25`，支持 Vite 8         | MIT        |
| typescript         | 5.9.3           | 项目 strict ESM                    | Apache-2.0 |
| vue-tsc            | 3.3.11          | TypeScript `>=5.0.0`               | MIT        |
| tsx                | 4.23.13         | Node `>=18`                        | MIT        |
| @types/node        | 24.13.4         | Node 24 类型                       | MIT        |
| fastify            | 5.12.4          | HTTP 服务                          | MIT        |
| @fastify/swagger   | 9.8.1           | OpenAPI 3.0.3 导出                 | MIT        |
| @sinclair/typebox  | 0.34.52         | 浏览器安全 Schema                  | MIT        |
| pg / @types/pg     | 8.23.0 / 8.23.1 | PostgreSQL 连接                    | MIT        |
| redis              | 6.2.1           | Redis 客户端                       | MIT        |
| bullmq             | 6.3.6           | Worker 本地探测队列                | MIT        |
| @aws-sdk/client-s3 | 3.1131.0        | RustFS S3 初始化、读写             | Apache-2.0 |
| openapi-typescript | 7.13.0          | OpenAPI 生成类型                   | MIT        |
| openapi-fetch      | 0.17.0          | 类型化 fetch                       | MIT        |
| eslint             | 10.10.0         | Node 24 / TypeScript / Vue lint    | MIT        |
| typescript-eslint  | 8.70.0          | ESLint 8/9/10，TS `>=4.8.4 <6.1.0` | MIT        |
| eslint-plugin-vue  | 10.11.0         | ESLint 8/9/10                      | MIT        |
| vue-eslint-parser  | 10.4.1          | Vue SFC 解析                       | MIT        |
| prettier           | 3.9.6           | 格式化                             | MIT        |

ESLint 使用 `10.10.0`，Node engine 为 `^20.19.0 || ^22.13.0 || >=24`。BullMQ 使用显式创建的 `ioredis 5.11.1`（MIT，Node `>=12.22.0`）客户端，避免缺失可选驱动。可选 `msgpackr-extract` 原生加速构建被明确跳过，纯 JavaScript 路径已通过队列往返验证。

官方来源：[npm registry](https://registry.npmjs.org/)、[Node 版本](https://nodejs.org/en/download/releases)、[Vite 8](https://vite.dev/blog/announcing-vite8)、[Fastify](https://fastify.dev/)、[OpenAPI TypeScript](https://openapi-ts.dev/)、[RustFS 安装](https://docs.rustfs.com/en/installation)、[pgvector](https://github.com/pgvector/pgvector)、[Redis 许可证](https://redis.io/legal/licenses/)。Redis 7.4 服务端许可证与 MIT 的 Node 客户端不同；正式发布时需单独评估。

安装、构建与启动的实测结果见 `DEVELOPMENT.md`。
