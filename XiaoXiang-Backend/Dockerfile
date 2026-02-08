FROM node:18-alpine
LABEL "language"="nodejs"
LABEL "framework"="express"

RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

ENV TZ=Asia/Shanghai
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# 只复制 XiaoXiang-Backend 目录的内容
COPY XiaoXiang-Backend/ .

RUN npm install

EXPOSE 8080

CMD ["npm", "start"]