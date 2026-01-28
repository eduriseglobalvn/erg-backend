import { Module, Global } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mysqlConfig from '@/config/mikro-orm-mysql.config';
import mongoConfig from '@/config/mikro-orm-mongo.config';

@Global()
@Module({
  imports: [
    // 1. Kết nối MySQL
    MikroOrmModule.forRoot({
      ...mysqlConfig,
      // Bật autoLoad cho MySQL vì đây là connection chính
      autoLoadEntities: true,
    }),

    // 2. Kết nối MongoDB
    MikroOrmModule.forRoot({
      ...mongoConfig,
      contextName: 'mongo-connection',
      // Tắt tự động nạp để tránh conflict với MySQL entities
      autoLoadEntities: false,
    }),
  ],
  // Không export MikroOrmModule như đã sửa ở bước trước
})
export class DatabaseModule { }
