# Bước 1: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json yarn.lock* ./
RUN yarn install
COPY . .
RUN yarn build

# Bước 2: Run (Tối ưu dung lượng)
FROM node:20-slim
WORKDIR /app
# Copy cả thư mục node_modules và dist từ bước build sang
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

ENV PORT=7860
EXPOSE 7860

# Đảm bảo đường dẫn này khớp với cấu trúc thư mục NestJS mặc định
CMD ["node", "dist/main.js"]