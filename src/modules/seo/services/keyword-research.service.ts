import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAdsApi } from 'google-ads-api';

export interface KeywordData {
    keyword: string;
    searchVolume: number; // Monthly average
    competition: 'LOW' | 'MEDIUM' | 'HIGH';
    competitionScore: number; // 0-100
    suggestedBid: number; // VND
    difficulty: number; // 0-100 (calculated)
}

export interface KeywordResearchResult {
    seed: string;
    relatedKeywords: KeywordData[];
    longtailSuggestions: KeywordData[];
}

@Injectable()
export class KeywordResearchService {
    private readonly logger = new Logger(KeywordResearchService.name);
    private googleAds: any;
    private customerId: string;

    constructor(private readonly configService: ConfigService) {
        this.initGoogleAds();
    }

    private initGoogleAds() {
        try {
            const clientId = this.configService.get('GOOGLE_ADS_CLIENT_ID');
            const clientSecret = this.configService.get('GOOGLE_ADS_CLIENT_SECRET');
            const developerToken = this.configService.get('GOOGLE_ADS_DEVELOPER_TOKEN');
            this.customerId = this.configService.get('GOOGLE_ADS_CUSTOMER_ID') || '';

            if (clientId && clientSecret && developerToken && this.customerId) {
                this.googleAds = new GoogleAdsApi({
                    client_id: clientId,
                    client_secret: clientSecret,
                    developer_token: developerToken,
                });
                this.logger.log('Google Ads API initialized successfully');
            } else {
                this.logger.warn('Google Ads API credentials missing. Running in fallback mode.');
            }
        } catch (error) {
            this.logger.warn('Failed to initialize Google Ads API. Running in fallback mode.', error);
        }
    }

    async researchKeyword(seed: string): Promise<KeywordResearchResult> {
        if (!this.googleAds) {
            return this.fallbackResearch(seed);
        }

        try {
            const customer = this.googleAds.Customer({
                customer_id: this.customerId,
                refresh_token: this.configService.get('GOOGLE_ADS_REFRESH_TOKEN'),
            });

            // Get keyword ideas
            // Note: The structure of response depends on google-ads-api version
            // This is a standard implementation pattern
            const results = await customer.keywordPlanIdeas.generateKeywordIdeas({
                keywordSeed: seed,
                locationIds: ['2704'], // Vietnam Geo Target Constant
                languageCode: 'vi', // Vietnamese
            });

            // Transform results
            // Note: The actual property names from API response need to be verified with actual response structure
            // Assuming standard mapping here.
            const relatedKeywords: KeywordData[] = results.map((idea: any) => ({
                keyword: idea.text,
                searchVolume: idea.keywordIdeaMetrics?.avgMonthlySearches || 0,
                competition: idea.keywordIdeaMetrics?.competition || 'UNKNOWN',
                competitionScore: this.mapCompetitionScore(idea.keywordIdeaMetrics?.competition),
                suggestedBid: (idea.keywordIdeaMetrics?.highTopOfPageBidMicros || 0) / 1000000, // Convert to unit
                difficulty: this.calculateDifficulty(idea.keywordIdeaMetrics),
            }));

            // Filter longtail (3+ words, lower competition)
            const longtailSuggestions = relatedKeywords.filter(
                kw => kw.keyword.split(' ').length >= 3 && kw.competitionScore < 60
            );

            return {
                seed,
                relatedKeywords: relatedKeywords.slice(0, 20), // Top 20
                longtailSuggestions: longtailSuggestions.slice(0, 10), // Top 10 longtails
            };
        } catch (error) {
            this.logger.error(`Google Ads API error: ${error.message}`);
            return this.fallbackResearch(seed);
        }
    }

    private calculateDifficulty(metrics: any): number {
        if (!metrics) return 50;
        // Simple heuristic: higher competition + higher bid = harder
        const competitionFactor = this.mapCompetitionScore(metrics.competition);
        const volumeFactor = Math.min(100, (metrics.avgMonthlySearches || 0) / 1000);

        return Math.round((competitionFactor * 0.7) + (volumeFactor * 0.3));
    }

    private mapCompetitionScore(competition: string): number {
        switch (competition) {
            case 'LOW': return 30;
            case 'MEDIUM': return 60;
            case 'HIGH': return 90;
            default: return 50;
        }
    }

    private fallbackResearch(seed: string): KeywordResearchResult {
        // Simple rule-based generation when API not available
        const variations = [
            `${seed} là gì`,
            `cách ${seed}`,
            `hướng dẫn ${seed}`,
            `${seed} 2025`,
            `${seed} tốt nhất`,
            `${seed} hiệu quả`,
            `so sánh ${seed}`,
            `review ${seed}`,
            `mua ${seed} ở đâu`,
            `giá ${seed}`,
        ];

        return {
            seed,
            relatedKeywords: variations.map(kw => ({
                keyword: kw,
                searchVolume: 0, // Unknown
                competition: 'MEDIUM',
                competitionScore: 50,
                suggestedBid: 0,
                difficulty: 50,
            })),
            longtailSuggestions: variations.filter(v => v.split(' ').length >= 3).map(kw => ({
                keyword: kw,
                searchVolume: 0,
                competition: 'LOW',
                competitionScore: 30,
                suggestedBid: 0,
                difficulty: 30,
            })),
        };
    }
}
