# WP-09 生产镜像：portal-ui（Vue 3 + Vite 静态构建，nginx 托管）
# 构建上下文为本目录（frontend/）：
#   docker build -t ontodata/portal-ui:0.1.0 .

# ---- 构建阶段：pnpm 安装依赖并产出 dist/ ----
# 注：node:20-alpine 无法运行 pnpm@11.9.0（其要求 Node ≥22.13，依赖 node:sqlite
# 内建模块），故构建阶段用 node:22-alpine（满足 package.json engines >=20）。
FROM node:22-alpine AS build
WORKDIR /app
# corepack 按 package.json 的 packageManager 字段激活 pnpm@11.9.0
RUN corepack enable
# 层级缓存：依赖层仅随清单文件变化失效，源码变更不重装依赖。
# pnpm-workspace.yaml 必须一并拷贝：其中的 allowBuilds 白名单（esbuild/core-js）
# 决定 pnpm 11 是否允许依赖的 postinstall 脚本，缺失会报 ERR_PNPM_IGNORED_BUILDS。
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# VITE_* 环境变量为构建期注入：Vite 将其静态替换进产物 JS，改值必须重建镜像。
# 取舍：运行期注入需 entrypoint 启动时渲染 config 文件，多一层启动复杂度；
# 当前按构建参数固化，多环境差异由 CI 按环境传 --build-arg 构建对应 tag 解决。
ARG VITE_IAM_ENABLED
ARG VITE_OIDC_CLIENT_ID
ARG VITE_OIDC_REDIRECT_URI
ARG VITE_OIDC_SCOPE
ARG VITE_OIDC_AUTHORIZE_ENDPOINT
ARG VITE_OIDC_TOKEN_ENDPOINT
RUN pnpm build

# ---- 运行阶段：nginx 非 root 官方镜像（默认以 nginx 用户运行、监听 8080）----
FROM nginxinc/nginx-unprivileged:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
