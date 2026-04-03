import { Module, Global } from '@nestjs/common';
import { SeoAnalyzerService } from './services/seo-analyzer.service';
import { SchemaMarkupService } from './services/schema-markup.service';
import { AutoLinkingService } from './services/auto-linking.service';

@Global()
@Module({
    providers: [
        SeoAnalyzerService,
        SchemaMarkupService,
        AutoLinkingService,
    ],
    exports: [
        SeoAnalyzerService,
        SchemaMarkupService,
        AutoLinkingService,
    ],
})
export class SeoCoreModule { }
