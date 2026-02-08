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

# 3. 设置工作目录
WORKDIR /app

# 4. 复制文件
COPY . .

# 5. 自动修复 job.service.js 里的引用路径
RUN sed -i "s|import Order from './order.model.js'|import Order from '../orders/order.model.js'|g" src/modules/jobs/job.service.js

# 6. 安装依赖
RUN npm install

# 7. 👇 修正：暴露端口改为 3000，与 server.js 默认值一致
EXPOSE 3000

# 8. 启动命令
CMD ["npm", "start"]
