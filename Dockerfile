FROM node:18-alpine

# 安装编译工具（better-sqlite3 需要）
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 先复制 package.json 文件
COPY package.json ./
COPY server/package.json ./server/

# 安装依赖
RUN npm install
RUN cd server && npm install && cd ..

# 复制源码
COPY . .

# 暴露端口
EXPOSE 3000

ENV PORT=3000

CMD ["node", "server/index.js"]
