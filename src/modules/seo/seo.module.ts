import { Module, forwardRef } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SeoHistoryService } from './services/seo-history.service';
import { GoogleSearchConsoleService } from './services/google-search-console.service';
import { SeoHistory } from './entities/seo-history.entity';
import { SchemaTemplate } from './entities/schema-template.entity';
import { GoogleSearchConsole } from './entities/google-search-console.entity';
import { SeoKeyword } from './entities/seo-keyword.entity';
import { OAuthToken } from './entities/oauth-token.entity';
import { SeoRedirect } from './entities/seo-redirect.entity';
import { Seo404Log } from './entities/seo-404-log.entity';
import { SearchEngineSubmissionLog } from './entities/search-engine-submission-log.entity';
import { SeoScoreHistory } from './entities/seo-score-history.entity';
import { RedirectService } from './services/redirect.service';
import { MonitoringService } from './services/monitoring.service';
import { DuplicateDetectionService } from './services/duplicate-detection.service';
import { SitemapService } from './services/sitemap.service';
import { SeoController } from './seo.controller';
import { SitemapController } from './sitemap.controller';
import { KeywordResearchService } from './services/keyword-research.service';
import { SeoRealtimeService } from './services/seo-realtime.service';
import { SeoContentService } from './services/seo-content.service';
import { SeoConfig } from './entities/seo-config.entity';
import { SeoConfigService } from './services/seo-config.service';
import { KeywordSuggestionController } from './controllers/keyword-suggestion.controller';
import { SearchEngineSubmissionService } from './services/search-engine-submission.service';
import { SearchEngineSubmissionController } from './controllers/search-engine-submission.controller';
import { SeoDashboardService } from './services/seo-dashboard.service';
import { SeoDashboardController } from './controllers/seo-dashboard.controller';
import { SeoScoringEngineService } from './services/seo-scoring-engine.service';
import { SeoBatchService } from './services/seo-batch.service';
import { SeoCoreModule } from './seo-core.module';
import { AiContentModule } from '@/modules/ai-content/ai-content.module';
import { SeoKeywordService } from './services/seo-keyword.service';
import { PostsModule } from '@/modules/posts/posts.module';

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
        // MongoDB entities — must specify the connection name
        MikroOrmModule.forFeature([SearchEngineSubmissionLog, SeoScoreHistory], 'mongo-connection'),
        SeoCoreModule,
        AiContentModule,
        forwardRef(() => PostsModule),
    ],
    controllers: [SeoController, SitemapController, KeywordSuggestionController, SearchEngineSubmissionController, SeoDashboardController],
    providers: [
        SeoHistoryService,
        SeoKeywordService,
        GoogleSearchConsoleService,
        RedirectService,
        MonitoringService,
        DuplicateDetectionService,
        SitemapService,
        KeywordResearchService,
        SeoRealtimeService,
        SeoContentService,
        SeoConfigService,
        SearchEngineSubmissionService,
        SeoScoringEngineService,
        SeoDashboardService,
        SeoBatchService,
    ],
    exports: [
        SeoHistoryService,
        SeoKeywordService,
        GoogleSearchConsoleService,
        RedirectService,
        MonitoringService,
        DuplicateDetectionService,
        SitemapService,
        KeywordResearchService,
        SeoRealtimeService,
        SeoContentService,
        SeoConfigService,
        SearchEngineSubmissionService,
        SeoScoringEngineService,
        SeoDashboardService,
        SeoBatchService,
        SeoCoreModule,
    ],
})
export class SeoModule { }
