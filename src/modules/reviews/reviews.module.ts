import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { Review } from './entities/review.entity';

@Module({
    imports: [
        MikroOrmModule.forFeature([Review]),
    ],
    controllers: [ReviewsController],
    providers: [ReviewsService],
    exports: [ReviewsService],
})
export class ReviewsModule { }
