export class SeoPerformanceReportDto {
    period: 'week' | 'month' | 'year';
    overview: {
        totalClicks: number;
        totalImpressions: number;
        avgCtr: number;
        avgPosition: number;
        keywordRankingsMap: Record<number, number>; // e.g. { 1: 5, 2: 3, ... } for positions
    };
    topPerformingPosts: Array<{
        title: string;
        slug: string;
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
    }>;
    seoHealth: {
        score: number;
        issues: {
            critical: number;
            warnings: number;
            good: number;
        };
    };
}
