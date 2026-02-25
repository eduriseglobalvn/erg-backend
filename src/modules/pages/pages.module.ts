import { Module } from '@nestjs/common';
import { ReviewsModule } from '@/modules/reviews/reviews.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Page } from './entities/page.entity';

@Module({
    imports: [
        MikroOrmModule.forFeature([Page]),
        ReviewsModule,
    ],
    controllers: [PagesController],
    providers: [PagesService],
    exports: [PagesService],
})
export class PagesModule { }
