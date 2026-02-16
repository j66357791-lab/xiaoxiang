# 使用 Node.js 18 Alpine 版本
FROM node:18-alpine

# 设置元数据
LABEL maintainer="xiaoxiang"
LABEL version="2.0.0"
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
# 注意：根据你的结构，Dockerfile 在 XiaoXiang-Backend 的父目录
COPY XiaoXiang-Backend/package*.json ./

# 2. 安装依赖
RUN npm install --production --silent

# 3. 复制源代码
COPY XiaoXiang-Backend/ .

# 4. 创建非 root 用户（安全最佳实践）
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs
    
# 5. 设置权限
RUN chown -R nodejs:nodejs /app

# 6. 切换到非 root 用户
USER nodejs

# 7. 暴露端口
EXPOSE 8080

# 8. 健康检查（使用我们添加的 /health 端点）
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

# 9. 启动命令
CMD ["npm", "start"]