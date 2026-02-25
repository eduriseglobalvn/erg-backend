import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';

@Module({
    imports: [
        MikroOrmModule.forFeature([Notification], 'mongo-connection'),
    ],
    controllers: [NotificationsController],
    providers: [NotificationsService],
    exports: [NotificationsService],
})
export class NotificationsModule { }
