# 1. 基础镜像
FROM node:18-alpine

# 2. 修复时区
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

# 设置环境变量
ENV TZ=Asia/Shanghai
ENV NODE_ENV=production
# 👇 统一改为 8080
ENV PORT=8080

# 3. 设置工作目录
WORKDIR /app

# 4. 只复制 XiaoXiang-Backend 目录下的内容到 /app
COPY XiaoXiang-Backend/ .

# 5. 修复代码里的引用路径
RUN sed -i "s|import Order from './order.model.js'|import Order from '../orders/order.model.js'|g" src/modules/jobs/job.service.js

# 6. 安装依赖
RUN npm install

# 7. 暴露 8080 端口
EXPOSE 8080

# 8. 启动命令
CMD ["npm", "start"]
