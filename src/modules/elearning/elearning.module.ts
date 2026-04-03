import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ElearningService } from './elearning.service';
import { ElearningPublicController, ElearningAdminController } from './elearning.controller';
import { ElearningCategory } from './entities/elearning-category.entity';
import { ElearningLevel } from './entities/elearning-level.entity';
import { ElearningUnit } from './entities/elearning-unit.entity';
import { AuthModule } from '@/modules/auth/auth.module';

@Module({
    imports: [
        MikroOrmModule.forFeature(
            [ElearningCategory, ElearningLevel, ElearningUnit],
            'mongo-connection',
        ),
        AuthModule,
    ],
    controllers: [ElearningPublicController, ElearningAdminController],
    providers: [ElearningService],
    exports: [ElearningService],
})
export class ElearningModule {}
