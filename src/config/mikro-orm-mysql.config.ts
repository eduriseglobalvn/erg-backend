import { Options, MySqlDriver } from '@mikro-orm/mysql';
import * as dotenv from 'dotenv';

// Nạp biến môi trường từ file .env
dotenv.config();

const config: Options = {
  driver: MySqlDriver,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS, // Khớp với .env của bạn
  dbName: process.env.DB_NAME,
  entities: [
    'dist/modules/access-control/**/*.entity.js',
    'dist/modules/sessions/**/*.entity.js',
    'dist/modules/courses/**/*.entity.js',
    'dist/modules/operations/**/*.entity.js',
    'dist/modules/organization/**/*.entity.js',
    'dist/modules/posts/**/*.entity.js',
    'dist/modules/profiles/**/*.entity.js',
    'dist/modules/users/**/*.entity.js',
    'dist/modules/ai-content/**/*.entity.js',
    'dist/modules/seo/**/*.entity.js',
  ],
  entitiesTs: [
    'src/modules/access-control/**/*.entity.ts',
    'src/modules/sessions/**/*.entity.ts',
    'src/modules/courses/**/*.entity.ts',
    'src/modules/operations/**/*.entity.ts',
    'src/modules/organization/**/*.entity.ts',
    'src/modules/posts/**/*.entity.ts',
    'src/modules/profiles/**/*.entity.ts',
    'src/modules/users/**/*.entity.ts',
    'src/modules/ai-content/**/*.entity.ts',
    'src/modules/seo/**/*.entity.ts',
  ],
  allowGlobalContext: true,
  debug: process.env.NODE_ENV === 'development',
  driverOptions: {
    connection: {
      ssl: { rejectUnauthorized: false },
    },
  },
};

export default config;
