import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Redirect } from './entities/redirect.entity';
import { RedirectsService } from './services/redirects.service';
import { RedirectsController } from './redirects.controller';

import { SeoAnalyzerService } from './services/seo-analyzer.service';

@Module({
    imports: [MikroOrmModule.forFeature([Redirect])],
    controllers: [RedirectsController],
    providers: [RedirectsService, SeoAnalyzerService],
    exports: [RedirectsService, SeoAnalyzerService],
})
export class SeoModule { }
