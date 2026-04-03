# 🚀 ERG Production Migration Checklist

## Tổng Quan Chi Phí

| Dịch vụ | Free Tier | Chi phí khi scale |
|---------|-----------|-------------------|
| MySQL → PlanetScale | Serverless Free | $0 → ~$30/tháng |
| MongoDB → Atlas M0 | 512MB | $0 → ~$9/tháng |
| Redis → Redis Cloud | 30MB, unlimited | $0 → ~$5/tháng |
| **Tổng khởi điểm** | | **$0/tháng** |

---

## Phase 1: Chuẩn Bị (Ngày 1)

### 1.1. Backup Database Hiện Tại

```bash
# Backup MySQL local
docker exec erg_mysql mysqldump -u erg -pDev.erg.edu.vn erg_db > backup_$(date +%Y%m%d).sql

# Backup MongoDB local (nếu có)
mongodump --uri="mongodb://erg:Dev.erg.edu.vn@localhost:27017/erg" --out=./backup_mongo_$(date +%Y%m%d)
```

### 1.2. Tạo Tài Khoản và Database

#### PlanetScale (MySQL)
```bash
# 1. Sign up tại https://app.planetscale.com (dùng GitHub)
# 2. Tạo organization "erg-global"
# 3. Tạo database: erg-prod
# 4. Tạo branch: main (production), dev (staging)
# 5. Tạo password cho từng branch
# 6. Copy connection string từ dashboard
```

#### MongoDB Atlas M0
```bash
# 1. Sign up tại https://www.mongodb.com/atlas (dùng GitHub)
# 2. Build a Database → M0 Sandbox (FREE) → Singapore region
# 3. Tạo database user (KHÔNG dùng root)
# 4. Network Access → Add IP: 0.0.0.0/0 (hoặc IP server)
# 5. Copy connection string SRV
```

#### Redis Cloud
```bash
# 1. Sign up tại https://redis.cloud (Redis Labs)
# 2. Create Free Database → Subscription: Fixed, Plan: 30MB
# 3. Region: Singapore (low latency Việt Nam)
# 4. Enable TLS
# 5. Copy Public Endpoint URL
```

---

## Phase 2: Code Changes Đã Thực Hiện ✅

- [x] Fix `app.module.ts` Joi validation: `MYSQL_*` → `DB_*`
- [x] Update `mikro-orm-mysql.config.ts`: SSL mode, production-ready
- [x] Update `app.module.ts` BullMQ: TLS support cho Upstash/RedisCloud
- [x] Update `app.module.ts` CacheModule: `servername` TLS option
- [x] Tạo `.env.production.example` với tất cả biến cần thiết

---

## Phase 3: Migration Data

### 3.1. MySQL → PlanetScale

```bash
# Cách 1: Dùng PlanetScale CLI (Khuyến nghị)
# Cài: npm i -g pscale
pscale auth login
pscale database create erg-prod --org erg-global
pscale database import erg-prod main < backup_YYYYMMDD.sql

# Cách 2: Dùng mysqldump trực tiếp
# Export
mysqldump -h localhost -u erg -pDev.erg.edu.vn erg_db \
  --no-data > schema.sql
mysqldump -h localhost -u erg -pDev.erg.edu.vn erg_db \
  --ignore-table=erg_db.migrations --skip-triggers > data.sql

# Import vào PlanetScale
mysql -h aws.connect.psdb.cloud -u erg -p -D erg_db < schema.sql
mysql -h aws.connect.psdb.cloud -u erg -p -D erg_db < data.sql
```

### 3.2. MongoDB → Atlas

```bash
# Export từ local
mongodump --uri="mongodb://erg:Dev.erg.edu.vn@localhost:27017/erg_analytics" \
  --out=./mongo_backup

# Import vào Atlas
mongorestore --uri="mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/erg" \
  ./mongo_backup --nsFrom="erg_analytics.*" --nsTo="erg.*"
```

---

## Phase 4: Deployment

### 4.1. Build Production

```bash
cd erg-backend
yarn build
```

### 4.2. Cấu Hình Environment Variables

```bash
# Production server - KHÔNG dùng file .env trong git
# Dùng secrets manager hoặc environment variables của hosting

# Ví dụ: Railway, Render, Fly.io
# Lưu từng biến trong dashboard hoặc dùng CLI:
pscale variable create erg-prod main NODE_ENV=production --replicate
```

### 4.3. Run Migrations

```bash
# Chạy migrations trên PlanetScale
pscale branch promote erg-prod main
yarn mikro-orm migration:run

# Hoặc qua CLI:
pscale database shell erg-prod main
```

---

## Phase 5: Verification

### 5.1. Health Check

```bash
curl https://api.erg.edu.vn/api/health

# Expected:
# {
#   "status": "ok",
#   "services": {
#     "mysql": "up",
#     "mongodb": "up",
#     "redis": "up"
#   }
# }
```

### 5.2. Test Chức Năng Quan Trọng

- [ ] Auth: Login/Logout
- [ ] Posts: CRUD operations
- [ ] Courses: Enrollment flow
- [ ] AI Content: Generate content
- [ ] Crawler: Queue jobs execute
- [ ] Cache: Hit/miss working
- [ ] Rate limiting: Throttle working

### 5.3. Monitor

```bash
# PlanetScale: Dashboard → Monitor connections, queries
# Atlas: Dashboard → Monitor storage, connections
# Redis Cloud: Dashboard → Monitor memory, commands

# Logs
pm2 logs erg-backend --lines 100 --nostream
```

---

## Phase 6: Post-Migration

### 6.1. Database Cleanup

```sql
-- PlanetScale: Kiểm tra unused indexes
-- Atlas: Xóa TTL logs cũ (đã tự động)

-- MySQL local: Dừng Docker
docker-compose -f erg-backend/docker-compose.yml down

-- MongoDB local: Backup và stop
mongodump --uri="..." --out=./final_backup
docker stop erg_mongo  # nếu có
```

### 6.2. Security Hardening

- [ ] Xóa `.env` khỏi git (nếu chưa)
- [ ] Thêm `DB_PASS`, `JWT_*` vào secrets manager
- [ ] Enable PlanetScale "VNet" (private networking)
- [ ] Whitelist MongoDB Atlas IP (server IP only)
- [ ] Enable Redis ACL (nếu dùng Redis Cloud paid)

---

## Troubleshooting

### Lỗi PlanetScale

```bash
# Lỗi: connection refused
# → Kiểm tra password (dùng password từ dashboard, không phải branch name)

# Lỗi: SSL handshake failed
# → Đã có SSL trong driverOptions ✅

# Lỗi: Too many connections
# → PlanetScale free: 1000 concurrent connections
# → MikroORM pool: giữ min:2, max:10 ✅
```

### Lỗi MongoDB Atlas

```bash
# Lỗi: Authentication failed
# → Kiểm tra username/password database user (không phải Atlas login)

# Lỗi: IP not whitelisted
# → Network Access → Add 0.0.0.0/0

# Lỗi: exceeded storage quota
# → Xóa TTL cũ, monitor storage trong Atlas dashboard
```

### Lỗi Redis

```bash
# Lỗi: Redis connection refused
# → Kiểm tra REDIS_TLS=true (bắt buộc cho Upstash/RedisCloud)

# Lỗi: Redis out of memory (Redis Cloud free)
# → Upgrade plan hoặc giảm cache TTL
# → BullMQ: xóa completed jobs thủ công
```

---

## Rollback Plan

Nếu migration thất bại:

```bash
# 1. Dừng production
pm2 stop erg-backend

# 2. Khởi động lại local Docker
cd erg-backend && docker-compose up -d

# 3. Update .env về local
# DB_HOST=127.0.0.1
# MONGO_URL=mongodb://erg:Dev.erg.edu.vn@localhost:27017/erg
# REDIS_HOST=127.0.0.1

# 4. Restart
pm2 start dist/src/main.js
```
