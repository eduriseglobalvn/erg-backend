# Giai đoạn 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Cài đặt các thư viện cần thiết cho việc build native modules (sharp, v.v...)
# python3, make, g++ cần thiết cho node-gyp khi build sharp
RUN apk add --no-cache libc6-compat python3 make g++

# Skip download browser của Playwright để giảm dung lượng image
# (Lưu ý: Chế độ Dynamic Crawler dùng Playwright sẽ không hoạt động nếu không cài thêm browser)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json yarn.lock ./

# Cài đặt dependencies (bao gồm devDependencies để build NestJS)
RUN yarn install --frozen-lockfile

COPY . .

# Build ứng dụng
RUN yarn build

# Xóa devDependencies và cài lại chỉ production dependencies để giảm dung lượng
RUN yarn install --production --frozen-lockfile && yarn cache clean

# Giai đoạn 2: Run (Production Image)
FROM node:20-alpine AS runner
WORKDIR /app

# Cài đặt libc6-compat cho môi trường chạy (cần thiết cho sharp/prisma/etc trên Alpine)
RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Copy file từ builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]