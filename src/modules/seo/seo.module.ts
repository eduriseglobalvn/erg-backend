import { Module, forwardRef } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SeoAnalyzerService } from './services/seo-analyzer.service';
import { SchemaMarkupService } from './services/schema-markup.service';
import { SeoHistoryService } from './services/seo-history.service';
import { GoogleSearchConsoleService } from './services/google-search-console.service';
import { AutoLinkingService } from './services/auto-linking.service'; // Added
import { SeoHistory } from './entities/seo-history.entity';
import { SchemaTemplate } from './entities/schema-template.entity';
import { GoogleSearchConsole } from './entities/google-search-console.entity';
import { SeoKeyword } from './entities/seo-keyword.entity';
import { OAuthToken } from './entities/oauth-token.entity';
import { SeoRedirect } from './entities/seo-redirect.entity';
import { Seo404Log } from './entities/seo-404-log.entity';
import { RedirectService } from './services/redirect.service';
import { MonitoringService } from './services/monitoring.service';
import { DuplicateDetectionService } from './services/duplicate-detection.service';
import { SitemapService } from './services/sitemap.service';
import { SeoController } from './seo.controller';
import { SitemapController } from './sitemap.controller';
// import { YoastService } from './services/yoast.service'; // Removed
import { SeoTitleService } from './services/seo-title.service';
import { SeoMetaService } from './services/seo-meta.service';
import { SeoImageAltService } from './services/seo-image-alt.service';
import { KeywordResearchService } from './services/keyword-research.service';
import { SeoRealtimeService } from './services/seo-realtime.service';
import { SeoContentService } from './services/seo-content.service';
import { AiContentModule } from '@/modules/ai-content/ai-content.module';
import { SeoConfig } from './entities/seo-config.entity';
import { SeoConfigService } from './services/seo-config.service';

@Module({
    imports: [
        MikroOrmModule.forFeature([
            SeoHistory,
            SchemaTemplate,
            GoogleSearchConsole,
            SeoKeyword,
            OAuthToken,
            SeoRedirect,
            Seo404Log,
            SeoConfig,
        ]),
        forwardRef(() => AiContentModule),
    ],
    controllers: [SeoController, SitemapController],
    providers: [
        SeoAnalyzerService,
        SchemaMarkupService,
        SeoHistoryService,
        GoogleSearchConsoleService,
        AutoLinkingService,
        RedirectService,
        MonitoringService,
        DuplicateDetectionService,
        SitemapService,
        SitemapService,
        // YoastService, // Removed
        SeoTitleService,
        SeoTitleService,
        SeoMetaService,
        SeoImageAltService,
        KeywordResearchService,
        SeoRealtimeService,
        SeoContentService,
        SeoConfigService,
    ],
    exports: [
        SeoAnalyzerService,
        SchemaMarkupService,
        SeoHistoryService,
        GoogleSearchConsoleService,
        AutoLinkingService,
        RedirectService,
        MonitoringService,
        DuplicateDetectionService,
        SitemapService,
        SitemapService,
        // YoastService, // Removed
        SeoTitleService,
        SeoTitleService,
        SeoMetaService,
        SeoImageAltService,
        KeywordResearchService,
        SeoRealtimeService,
        SeoContentService,
        SeoConfigService,
    ],
})
export class SeoModule { }
