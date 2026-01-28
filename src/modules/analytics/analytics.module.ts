import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Visit } from './entities/visit.entity';
import { AnalyticsEvent } from './entities/event.entity';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { PostCategory } from '../posts/entities/post-category.entity';

@Module({
    imports: [
        // MongoDB entities - Specify contextName!
        MikroOrmModule.forFeature([Visit, AnalyticsEvent], 'mongo-connection'),
        // MySQL entities (Default context)
        MikroOrmModule.forFeature([User, Post, PostCategory]),
        JwtModule.register({}),
    ],
    controllers: [AnalyticsController],
    providers: [AnalyticsService],
    exports: [AnalyticsService],
})
export class AnalyticsModule { }
