# 使用 Node.js 18 Alpine 版本
FROM node:18-alpine

# 设置元数据
LABEL maintainer="xiaoxiang"
LABEL version="2.1.0"
LABEL description="小象兼职后端API"

# 设置时区（正确方法）
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 设置环境变量
ENV TZ=Asia/Shanghai
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# 创建工作目录
WORKDIR /app

# 1. 先复制 package.json 和 package-lock.json
COPY XiaoXiang-Backend/package*.json ./

# 2. 强制安装所有依赖（包括新增的 ws）
RUN npm install --production --no-cache --legacy-peer-deps

# 3. 复制源代码
COPY XiaoXiang-Backend/ .

# 4. 暴露端口
EXPOSE 8080

# 5. 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

# 6. 启动命令
CMD ["npm", "start"]
