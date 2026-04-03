import { Options, MySqlDriver } from '@mikro-orm/mysql';
import * as dotenv from 'dotenv';

// Nạp biến môi trường từ file .env
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const config: Options = {
  driver: MySqlDriver,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  dbName: process.env.DB_NAME,
  // Entities are collected via autoLoadEntities + MikroOrmModule.forFeature() in each module.
  // Do NOT use glob patterns here — they are incompatible with SWC (disableDynamicFileAccess).
  entities: [],
  allowGlobalContext: true,
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
  },
  debug: process.env.NODE_ENV === 'development',
  driverOptions: {
    connection: {
      connectTimeout: 10000,
      // PlanetScale / managed MySQL: dùng SSL. Local dev: không cần.
      ssl: isProduction
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: false },
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
    },
  },
};

export default config;
