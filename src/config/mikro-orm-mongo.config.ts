import { Options } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import * as dotenv from 'dotenv';

// Import entities trực tiếp để đảm bảo MikroORM tìm thấy
import { Visit } from '../modules/analytics/entities/visit.entity';
import { AnalyticsEvent } from '../modules/analytics/entities/event.entity';
import { AuthActivityLog } from '../modules/auth/entities/auth-activity-log.entity';
import { CrawlHistory } from '../modules/crawler/entities/crawl-history.entity';
import { RssFeed } from '../modules/crawler/entities/rss-feed.entity';
import { ScraperConfig } from '../modules/crawler/entities/scraper-config.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';

dotenv.config();

const config: Options = {
  driver: MongoDriver,
  clientUrl: process.env.MONGO_URL,
  dbName: process.env.MONGO_DB_NAME || 'erg_analytics',
  // Import trực tiếp các entity class thay vì dùng glob pattern
  entities: [Visit, AnalyticsEvent, AuthActivityLog, CrawlHistory, RssFeed, ScraperConfig, Notification],
  contextName: 'mongo-connection',
  // Allow global context for easier usage in services
  allowGlobalContext: true,
  debug: true, // Bật debug để thấy log truy vấn Mongo
};

export default config;
