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
import { CrawlRawContent } from '../modules/crawler/entities/crawl-raw-content.entity';
import { SeoScoreHistory } from '../modules/seo/entities/seo-score-history.entity';
import { SearchEngineSubmissionLog } from '../modules/seo/entities/search-engine-submission-log.entity';
import { Review } from '../modules/interaction/entities/review.entity';
import { Comment } from '../modules/interaction/entities/comment.entity';
import { ElearningCategory } from '../modules/elearning/entities/elearning-category.entity';
import { ElearningLevel } from '../modules/elearning/entities/elearning-level.entity';
import { ElearningUnit } from '../modules/elearning/entities/elearning-unit.entity';

dotenv.config();

const config: Options = {
  driver: MongoDriver,
  clientUrl: process.env.MONGO_URL,
  dbName: process.env.MONGO_DB_NAME || 'erg_analytics',
  // Import trực tiếp các entity class thay vì dùng glob pattern
  entities: [
    Visit, AnalyticsEvent, AuthActivityLog, CrawlHistory, RssFeed, ScraperConfig, Notification,
    CrawlRawContent, SeoScoreHistory, SearchEngineSubmissionLog, Review, Comment,
    ElearningCategory, ElearningLevel, ElearningUnit,
  ],
  contextName: 'mongo-connection',
  // Allow global context for easier usage in services
  allowGlobalContext: true,
  connect: false, // Lazy connect
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
  },
  debug: process.env.NODE_ENV === 'development', // Bật debug để thấy log truy vấn Mongo
};

export default config;
