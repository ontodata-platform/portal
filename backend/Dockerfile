# WP-09 生产镜像：portal-server（Spring Boot 3.3 / Java 21，多模块 Maven）
# 构建上下文为本目录（backend/）：
#   docker build -t ontodata/portal-server:0.1.0-SNAPSHOT .

# ---- 构建阶段：Maven 打包 ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY . .
# 层级缓存：Maven 本地仓库经 BuildKit cache mount 跨构建复用，源码变更只重编译、
# 不重下依赖；COPY 层经 .dockerignore 排除 target/，仅随源码失效。
RUN --mount=type=cache,target=/root/.m2 ./mvnw -q -DskipTests package

# ---- 运行阶段：仅 JRE，非 root ----
FROM eclipse-temurin:21-jre
# 非 root：固定 UID/GID 便于 k8s securityContext（runAsUser/fsGroup）对齐
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app app
WORKDIR /app
COPY --from=build /workspace/server/target/portal-server-0.1.0-SNAPSHOT.jar app.jar
USER app
EXPOSE 18085
# JVM 参数经 JAVA_OPTS 环境变量注入（堆、GC、时区等），镜像内不固化。
ENV JAVA_OPTS=""
# sh -c 仅为展开 JAVA_OPTS；exec 保证 java 为 PID 1，正常接收 SIGTERM 优雅停机。
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
