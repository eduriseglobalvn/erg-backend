# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app
# Sử dụng Yarn theo sở thích của bạn
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# Stage 2: Run
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

ENV PORT=7860
EXPOSE 7860

# Thử trỏ vào dist/src/main.js nếu dist/main.js không tồn tại
CMD ["sh", "-c", "node dist/main.js || node dist/src/main.js"]