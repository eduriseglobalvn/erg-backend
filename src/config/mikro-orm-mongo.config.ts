import { Options } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import * as dotenv from 'dotenv';

// Import entities trực tiếp để đảm bảo MikroORM tìm thấy
import { Visit } from '../modules/analytics/entities/visit.entity';
import { AnalyticsEvent } from '../modules/analytics/entities/event.entity';
import { AuthActivityLog } from '../modules/auth/entities/auth-activity-log.entity';

dotenv.config();

const config: Options = {
  driver: MongoDriver,
  clientUrl: process.env.MONGO_URL,
  dbName: process.env.MONGO_DB_NAME || 'erg_analytics',
  // Import trực tiếp các entity class thay vì dùng glob pattern
  entities: [Visit, AnalyticsEvent, AuthActivityLog],
  contextName: 'mongo-connection',
  // Allow global context for easier usage in services
  allowGlobalContext: true,
};

export default config;
