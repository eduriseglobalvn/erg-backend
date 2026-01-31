# Giai đoạn 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Cài đặt công cụ để build các thư viện native
RUN apk add --no-cache libc6-compat python3 make g++

# Copy cấu hình package trước để tận dụng cache của Docker
COPY package.json yarn.lock ./

# Cài đặt tất cả dependencies (bao gồm cả Nest CLI)
RUN yarn install --frozen-lockfile

# Copy toàn bộ source code
COPY . .

# Build ứng dụng. Sửa thành ./node_modules/.bin/nest build để chắc chắn tìm thấy lệnh nest
RUN ./node_modules/.bin/nest build

# Giai đoạn 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Cài đặt thư viện hệ thống cần thiết cho runtime
RUN apk add --no-cache libc6-compat

# Thiết lập biến môi trường
ENV NODE_ENV=production
ENV PORT=3003

# Copy file từ giai đoạn build sang
# Chỉ lấy thư mục dist và node_modules cần thiết
COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/dist ./dist

# Cài đặt CHỈ các thư viện cần cho Production ở giai đoạn này 
# giúp giảm dung lượng image xuống mức thấp nhất (siêu nhẹ)
RUN yarn install --production --frozen-lockfile && yarn cache clean

# Mở cổng 3003
EXPOSE 3003

# Lệnh chạy chính thức
# Kiểm tra lại: Nếu NestJS của bạn build ra dist/main.js thì dùng "dist/main.js"
# Nếu build ra dist/src/main.js thì dùng đường dẫn như dưới
CMD ["node", "dist/src/main.js"]