# Giai đoạn 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Cài đặt các thư viện hệ thống cần thiết cho native modules (sharp, prisma, node-gyp)
RUN apk add --no-cache libc6-compat python3 make g++

# Tắt download browser của Playwright để giảm dung lượng image
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Copy file định nghĩa thư viện
COPY package.json yarn.lock ./

# Cài đặt toàn bộ dependencies (bao gồm cả devDependencies để build)
RUN yarn install --frozen-lockfile

# Copy toàn bộ source code
COPY . .

# Build ứng dụng NestJS (tạo ra thư mục dist)
RUN yarn build

# Xóa các thư viện dev và chỉ cài các thư viện cần để chạy (production)
RUN yarn install --production --frozen-lockfile && yarn cache clean

# Giai đoạn 2: Run (Image cuối cùng siêu nhẹ)
FROM node:20-alpine AS runner
WORKDIR /app

# Cài đặt libc6-compat cho môi trường chạy
RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV PORT=3003

# Copy các file cần thiết từ giai đoạn builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Lệnh kiểm tra cấu trúc thư mục (Giúp bạn nhìn thấy file main.js nằm ở đâu trong Log Dokploy)
RUN ls -R dist/

EXPOSE 3003

# Lệnh chạy chính thức
# Nếu NestJS của bạn build ra dist/src/main.js, hãy đổi thành ["node", "dist/src/main.js"]
CMD ["node", "dist/src/main.js"]