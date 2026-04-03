# CI/CD & VPS Infrastructure Strategy — ERG Backend

> VPS: Tencent Cloud 2vCPU / 2GB RAM · OS: Ubuntu 22.04 LTS
> Ưu tiên: **Free tier**, tối ưu RAM, đơn giản vận hành.

---

## 1. Tổng quan kiến trúc đề xuất

```
GitHub (source)
    │
    ├── GitHub Actions (free CI — build, test, push image)
    │       └── Self-hosted Runner trên VPS (miễn phí, không giới hạn phút)
    │
    ▼
Docker Hub / GHCR (registry — free)
    │
    ▼
Tencent VPS 2c2ram
    ├── Nginx (reverse proxy, TLS via Let's Encrypt)
    ├── NestJS API container  (~300MB RAM)
    ├── NestJS Worker container  (~250MB RAM)
    └── Uptime Kuma + Netdata (monitoring ~100MB RAM)

Cloud Managed Services (free tier)
    ├── Aiven MySQL    — primary database
    ├── MongoDB Atlas  — analytics / secondary DB (M0 free)
    └── Upstash Redis  — cache + BullMQ queues (free tier)
```

> **Tại sao không chạy MySQL/Redis/MongoDB trên VPS?**
> 2GB RAM không đủ chạy cả app + 3 database cùng lúc ổn định. Dùng managed services free tier giải phóng toàn bộ RAM cho ứng dụng, đồng thời có backup tự động.

---

## 2. Managed Services — Free Tier

### 2.1 Aiven MySQL (thay docker MySQL local)

| | |
|---|---|
| Free tier | Hobbiest plan — 1 node, 5GB storage |
| Region | Singapore (gần VPS Tencent nhất) |
| Connection | TLS/SSL bắt buộc (đã config sẵn trong mikro-orm-mysql.config.ts) |
| Limit | Không giới hạn thời gian (free mãi trên Hobbyist) |

**Cách dùng:**
1. Tạo project tại [aiven.io](https://aiven.io)
2. Tạo MySQL service → chọn Free plan → Singapore
3. Copy connection string → cập nhật `.env` production:
```env
DB_HOST=<aiven-host>.aivencloud.com
DB_PORT=<port>
DB_NAME=erg_db
DB_USER=avnadmin
DB_PASS=<password>
DB_SSL=true
```

### 2.2 MongoDB Atlas (thay MongoDB Atlas hiện tại nếu chưa có)

| | |
|---|---|
| Free tier | M0 Shared — 512MB storage, mãi mãi |
| Region | Singapore |

Dự án đã cấu hình sẵn `MONGO_URL` Atlas. Giữ nguyên, không cần thay đổi.

### 2.3 Upstash Redis (thay docker Redis local)

| | |
|---|---|
| Free tier | 10,000 commands/day, 256MB |
| Hỗ trợ | TLS, REST API và Redis protocol |
| BullMQ | Tương thích 100% |

```env
REDIS_HOST=<upstash-endpoint>.upstash.io
REDIS_PORT=6379
REDIS_PASS=<upstash-token>
REDIS_TLS=true
```

> **Lưu ý:** Nếu traffic BullMQ lớn hơn 10k/ngày, dùng **Aiven Redis** (free 30 ngày, sau đó ~$19/tháng) hoặc tự host 1 Redis nhẹ trên VPS (~30MB RAM).

---

## 3. Dockerfile tối ưu cho VPS 2GB

File `Dockerfile.prod` tối ưu hơn Dockerfile hiện tại:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Chỉ cài build deps khi cần native modules
RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

COPY . .
RUN yarn build

# Stage 2: Production deps only
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
# Bỏ playwright, crawlee dev deps nặng
RUN yarn install --frozen-lockfile --production=true \
    && yarn cache clean

# Stage 3: Runner (minimal)
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Non-root user
RUN addgroup -g 1001 nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3003
CMD ["dumb-init", "node", "dist/src/main.js"]
```

> **Quan trọng:** `Playwright` (~1GB) chỉ dùng trong crawler worker. Tách `Dockerfile.worker` riêng nếu cần crawl — hoặc chạy crawler trên GitHub Actions (runner miễn phí, có đủ RAM).

---

## 4. Docker Compose Production

`docker-compose.prod.yml` trên VPS — không chứa MySQL/Redis (đã dùng cloud):

```yaml
version: '3.8'

services:
  api:
    image: ghcr.io/<your-org>/erg-backend:${IMAGE_TAG:-latest}
    container_name: erg_api
    restart: unless-stopped
    env_file: .env.production
    environment:
      - START_MODE=api
      - NODE_ENV=production
    ports:
      - "127.0.0.1:3003:3003"   # Chỉ expose localhost, Nginx proxy
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3003/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  worker:
    image: ghcr.io/<your-org>/erg-backend:${IMAGE_TAG:-latest}
    container_name: erg_worker
    restart: unless-stopped
    env_file: .env.production
    environment:
      - START_MODE=worker
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          memory: 400M
          cpus: '0.8'
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    image: nginx:alpine
    container_name: erg_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot_www:/var/www/certbot:ro
      - certbot_conf:/etc/letsencrypt:ro
    depends_on:
      - api

  certbot:
    image: certbot/certbot
    volumes:
      - certbot_www:/var/www/certbot
      - certbot_conf:/etc/letsencrypt
    entrypoint: /bin/sh -c "trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done"

volumes:
  certbot_www:
  certbot_conf:

networks:
  default:
    name: erg_network
```

---

## 5. CI/CD — GitHub Actions + Self-hosted Runner

### Chiến lược: Hybrid Runner

- **GitHub-hosted runner** (Ubuntu): Build Docker image, chạy tests (miễn phí 2000 phút/tháng)
- **Self-hosted runner** trên VPS: Deploy (kéo image mới, restart container) — **miễn phí, không giới hạn**

### 5.1 Cài đặt Self-hosted Runner trên VPS

```bash
# Trên VPS
mkdir ~/actions-runner && cd ~/actions-runner

# Download runner (lấy link mới nhất từ: Settings > Actions > Runners > New)
curl -o actions-runner-linux-x64-2.x.x.tar.gz -L https://github.com/actions/runner/releases/...
tar xzf ./actions-runner-linux-x64-2.x.x.tar.gz

# Cấu hình (lấy token từ GitHub Settings)
./config.sh --url https://github.com/<org>/<repo> --token <TOKEN>

# Cài service để tự động start
sudo ./svc.sh install
sudo ./svc.sh start
```

### 5.2 GitHub Actions Workflow

`.github/workflows/deploy.yml`:

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ─── JOB 1: Build & Test (GitHub-hosted, miễn phí) ───────────────────────
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    outputs:
      image_tag: ${{ steps.meta.outputs.tags }}
      sha_tag: ${{ steps.sha.outputs.tag }}

    steps:
      - uses: actions/checkout@v4

      - name: Set short SHA
        id: sha
        run: echo "tag=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=sha-
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.prod
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ─── JOB 2: Run Migrations (GitHub-hosted) ────────────────────────────────
  migrate:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'

      - run: yarn install --frozen-lockfile

      - name: Run migrations
        env:
          DB_HOST: ${{ secrets.PROD_DB_HOST }}
          DB_PORT: ${{ secrets.PROD_DB_PORT }}
          DB_NAME: ${{ secrets.PROD_DB_NAME }}
          DB_USER: ${{ secrets.PROD_DB_USER }}
          DB_PASS: ${{ secrets.PROD_DB_PASS }}
          DB_SSL: "true"
        run: yarn mikro-orm migration:up

  # ─── JOB 3: Deploy (Self-hosted Runner trên VPS) ─────────────────────────
  deploy:
    needs: [build, migrate]
    runs-on: self-hosted    # <-- Chạy trực tiếp trên VPS
    steps:
      - uses: actions/checkout@v4

      - name: Pull new image & restart
        env:
          IMAGE_TAG: sha-${{ needs.build.outputs.sha_tag }}
        run: |
          # Login GHCR
          echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io \
            -u ${{ github.actor }} --password-stdin

          # Pull new image
          docker pull ghcr.io/${{ github.repository }}:$IMAGE_TAG

          # Zero-downtime: start new, stop old
          IMAGE_TAG=$IMAGE_TAG docker compose \
            -f docker-compose.prod.yml up -d \
            --no-deps api worker

          # Cleanup old images
          docker image prune -f --filter "until=24h"

      - name: Health check
        run: |
          sleep 10
          curl -f http://localhost:3003/api/health || \
            (docker compose -f docker-compose.prod.yml logs api && exit 1)
```

### 5.3 GitHub Secrets cần thiết

```
PROD_DB_HOST, PROD_DB_PORT, PROD_DB_NAME, PROD_DB_USER, PROD_DB_PASS
PROD_REDIS_HOST, PROD_REDIS_PASS
PROD_MONGO_URL
PROD_JWT_ACCESS_SECRET, PROD_JWT_REFRESH_SECRET
PROD_API_KEY_ENCRYPTION_SECRET
PROD_R2_ACCESS_KEY, PROD_R2_SECRET_KEY, PROD_R2_ENDPOINT
PROD_MAIL_USER, PROD_MAIL_PASS
```

---

## 6. Nginx Config

`nginx/conf.d/erg.conf`:

```nginx
server {
    listen 80;
    server_name api.erg.edu.vn;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.erg.edu.vn;

    ssl_certificate /etc/letsencrypt/live/api.erg.edu.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.erg.edu.vn/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
    limit_req zone=api burst=10 nodelay;

    location /api {
        proxy_pass http://api:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 30s;
        client_max_body_size 50m;
    }
}
```

**Lấy SSL miễn phí:**
```bash
docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot --webroot-path=/var/www/certbot \
  -d api.erg.edu.vn --email admin@erg.edu.vn --agree-tos
```

---

## 7. Monitoring Stack (nhẹ, free)

### 7.1 Uptime Kuma — Uptime monitoring

- **RAM**: ~50MB
- **Free**: Self-hosted, mãi mãi
- **Cung cấp**: HTTP monitoring, alert qua Telegram/Email/Discord, status page

```yaml
# Thêm vào docker-compose.prod.yml
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: uptime_kuma
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3001"
    volumes:
      - uptime_kuma_data:/app/data
    deploy:
      resources:
        limits:
          memory: 100M
```

Monitor các endpoint:
- `https://api.erg.edu.vn/api/health` — API health
- `https://erg.edu.vn` — Frontend
- Aiven MySQL connection

### 7.2 Netdata — Server & Container monitoring

- **RAM**: ~80MB
- **Free**: Open source, real-time metrics
- **Cung cấp**: CPU, RAM, disk, network, Docker container stats, alerts

```bash
# Cài nhanh trên VPS (không cần Docker)
curl https://get.netdata.cloud/kickstart.sh > /tmp/netdata-kickstart.sh
sh /tmp/netdata-kickstart.sh --stable-channel --disable-cloud

# Truy cập: http://<vps-ip>:19999
# Bind localhost nếu muốn expose qua Nginx:
# /etc/netdata/netdata.conf → bind to = 127.0.0.1
```

### 7.3 Portainer CE — Docker UI

- **RAM**: ~50MB
- **Free**: Community Edition, quản lý container qua web UI

```yaml
  portainer:
    image: portainer/portainer-ce:latest
    container_name: portainer
    restart: unless-stopped
    ports:
      - "127.0.0.1:9000:9000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data
    deploy:
      resources:
        limits:
          memory: 100M
```

### 7.4 Tổng RAM monitoring stack

| Service | RAM |
|---|---|
| Uptime Kuma | ~50MB |
| Netdata | ~80MB |
| Portainer CE | ~50MB |
| **Tổng** | **~180MB** |

---

## 8. Ước tính RAM trên VPS 2GB

| Service | RAM dự kiến |
|---|---|
| OS + kernel | ~300MB |
| Docker daemon | ~80MB |
| NestJS API | ~350MB |
| NestJS Worker | ~250MB |
| Nginx | ~30MB |
| Uptime Kuma | ~50MB |
| Netdata | ~80MB |
| Portainer | ~50MB |
| **Tổng** | **~1.19GB** |
| **Buffer còn lại** | **~800MB** |

> Thoải mái, còn buffer ~800MB cho spike traffic và OS cache.

---

## 9. Deployment Scripts

### `scripts/deploy.sh` — chạy thủ công khi cần

```bash
#!/bin/bash
set -e

IMAGE_TAG=${1:-latest}
COMPOSE_FILE="docker-compose.prod.yml"

echo ">>> Pulling image: $IMAGE_TAG"
IMAGE_TAG=$IMAGE_TAG docker compose -f $COMPOSE_FILE pull api worker

echo ">>> Restarting services..."
IMAGE_TAG=$IMAGE_TAG docker compose -f $COMPOSE_FILE up -d --no-deps api worker

echo ">>> Waiting for health check..."
sleep 15
curl -sf http://localhost:3003/api/health && echo "OK" || echo "FAILED"

echo ">>> Cleaning up old images..."
docker image prune -f --filter "until=24h"
```

### `scripts/rollback.sh` — rollback khi deploy lỗi

```bash
#!/bin/bash
PREV_TAG=${1:?"Usage: ./rollback.sh <image-tag>"}

echo ">>> Rolling back to: $PREV_TAG"
IMAGE_TAG=$PREV_TAG docker compose -f docker-compose.prod.yml up -d --no-deps api worker
```

---

## 10. Checklist Setup

### Phase 1 — Chuẩn bị managed services (30 phút)
- [ ] Tạo Aiven MySQL → lấy connection string → test kết nối
- [ ] Tạo Upstash Redis → lấy endpoint + token
- [ ] Verify MongoDB Atlas đang hoạt động
- [ ] Tạo `.env.production` với đầy đủ biến production

### Phase 2 — Chuẩn bị VPS (1 giờ)
- [ ] Cài Docker + Docker Compose v2
- [ ] Cài Git
- [ ] Cài self-hosted GitHub Actions runner
- [ ] Tạo `docker-compose.prod.yml` + nginx config
- [ ] Mở port 80, 443 trên Tencent firewall
- [ ] Lấy SSL certificate qua certbot

### Phase 3 — CI/CD Pipeline (30 phút)
- [ ] Thêm `.github/workflows/deploy.yml`
- [ ] Thêm tất cả GitHub Secrets
- [ ] Push lên main → xem Actions chạy lần đầu

### Phase 4 — Monitoring (30 phút)
- [ ] Deploy Uptime Kuma → cấu hình monitors + Telegram alert
- [ ] Cài Netdata trên VPS
- [ ] Deploy Portainer CE
- [ ] Expose monitoring qua Nginx (basic auth)

---

## 11. Tối ưu thêm (nếu cần)

### Crawler Processor nặng (Playwright)
App có `Playwright` + `Crawlee` — đây là dependencies rất nặng (~1GB). Hai lựa chọn:
1. **Tách image riêng** cho worker có Playwright, image API không cài
2. **Chạy crawl jobs trên GitHub Actions** (runner có 7GB RAM, miễn phí) và push kết quả về DB

### Zero-downtime deployment
Khi VPS chỉ có 2GB, chạy `rolling update` với 2 replica không khả thi. Thay vào đó dùng:
- `docker compose up -d --no-deps service` — Docker tự restart container với image mới (downtime ~3-5s)
- Nginx sẽ trả 502 trong thời gian container khởi động → client tự retry

### Log Management
Giới hạn log trong docker-compose để tránh đầy disk:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### Auto-restart + Watchdog
```bash
# Crontab trên VPS — kiểm tra container mỗi 5 phút
*/5 * * * * docker ps | grep -q erg_api || \
  docker compose -f /home/ubuntu/erg/docker-compose.prod.yml up -d api
```

---

## 12. Chi phí tóm tắt

| Service | Cost |
|---|---|
| Tencent VPS 2c2ram | ~$5-8/tháng |
| Aiven MySQL (Hobbyist) | **Free** |
| MongoDB Atlas M0 | **Free** |
| Upstash Redis | **Free** (10k cmd/day) |
| GitHub Actions | **Free** (2000 min + self-hosted) |
| GHCR (image registry) | **Free** (500MB public) |
| Let's Encrypt SSL | **Free** |
| Uptime Kuma | **Free** (self-hosted) |
| Netdata | **Free** (self-hosted) |
| Portainer CE | **Free** |
| **Tổng/tháng** | **~$5-8** |

---

*Viết bởi Claude Code — 2026-03-15*
