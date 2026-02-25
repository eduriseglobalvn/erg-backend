import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/core';
import { GoogleSearchConsole } from '../entities/google-search-console.entity';
import { Post } from '@/modules/posts/entities/post.entity';
import { google } from 'googleapis';
import { OAuthToken } from '../entities/oauth-token.entity';

/**
 * Service to integrate with Google Search Console API
 * Requires Google Search Console API credentials
 */
@Injectable()
export class GoogleSearchConsoleService {
    private readonly logger = new Logger(GoogleSearchConsoleService.name);
    private siteUrl: string;
    private oauth2Client: any;

    constructor(
        private readonly em: EntityManager,
        private readonly configService: ConfigService,
    ) {
        this.siteUrl = this.configService.get('SITE_URL', 'https://erg.edu.vn');
        this.oauth2Client = new google.auth.OAuth2(
            this.configService.get('GOOGLE_CLIENT_ID'),
            this.configService.get('GOOGLE_CLIENT_SECRET'),
            this.configService.get('GOOGLE_REDIRECT_URI'),
        );
    }

    /**
     * Generate Google Auth URL
     */
    async getAuthUrl(): Promise<string> {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: [
                'https://www.googleapis.com/auth/webmasters.readonly',
            ],
        });
    }

    /**
     * Handle OAuth callback and store tokens
     */
    async handleCallback(code: string): Promise<void> {
        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);

        // Store tokens in DB
        const existing = await this.em.findOne(OAuthToken, { service: 'google_search_console' });
        if (existing) {
            existing.accessToken = tokens.access_token!;
            if (tokens.refresh_token) {
                existing.refreshToken = tokens.refresh_token;
            }
            existing.expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;
        } else {
            const oauthToken = this.em.create(OAuthToken, {
                service: 'google_search_console',
                accessToken: tokens.access_token!,
                refreshToken: tokens.refresh_token!,
                expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
            });
            this.em.persist(oauthToken);
        }

        await this.em.flush();
    }

    /**
     * Set credentials from DB
     */
    private async ensureAuthenticated(): Promise<boolean> {
        const token = await this.em.findOne(OAuthToken, { service: 'google_search_console' });
        if (!token) return false;

        this.oauth2Client.setCredentials({
            access_token: token.accessToken,
            refresh_token: token.refreshToken,
            expiry_date: token.expiresAt?.getTime(),
        });

        return true;
    }

    /**
     * Fetch search analytics data from Google Search Console
     * https://developers.google.com/webmaster-tools/v1/searchanalytics/query
     */
    async fetchSearchAnalytics(startDate: string, endDate: string, dimensions: string[] = ['page']): Promise<any> {
        const authenticated = await this.ensureAuthenticated();
        if (!authenticated) {
            this.logger.warn('Google Search Console not authenticated. Please run OAuth flow.');
            return null;
        }

        try {
            const searchconsole = google.searchconsole({ version: 'v1', auth: this.oauth2Client });

            const response = await searchconsole.searchanalytics.query({
                siteUrl: this.siteUrl,
                requestBody: {
                    startDate,
                    endDate,
                    dimensions,
                    rowLimit: 5000,
                },
            });

            return response.data;
        } catch (error) {
            this.logger.error(`Failed to fetch GSC data: ${error.message}`);
            return null;
        }
    }

    /**
     * Sync Google Search Console data for all posts
     */
    async syncData(days: number = 7): Promise<void> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Fetch daily data per page
        const data = await this.fetchSearchAnalytics(
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0],
            ['date', 'page']
        );

        if (!data || !data.rows) {
            this.logger.warn('No data received from Google Search Console');
            return;
        }

        for (const row of data.rows) {
            // Keys order matches dimensions: [date, page]
            const dateStr = row.keys[0];
            const url = row.keys[1];
            const slug = this.extractSlugFromUrl(url);

            if (!slug) continue;

            const post = await this.em.findOne(Post, { slug });
            if (!post) continue;

            // Create or update GSC record for specific date
            const recordDate = new Date(dateStr);

            const existing = await this.em.findOne(GoogleSearchConsole, {
                post,
                date: recordDate,
            });

            if (existing) {
                existing.clicks = row.clicks;
                existing.impressions = row.impressions;
                existing.ctr = row.ctr;
                existing.position = row.position;
            } else {
                const gscData = this.em.create(GoogleSearchConsole, {
                    post,
                    url,
                    clicks: row.clicks,
                    impressions: row.impressions,
                    ctr: row.ctr,
                    position: row.position,
                    date: recordDate,
                });
                this.em.persist(gscData);
            }
        }

        await this.em.flush();
        this.logger.log(`Synced GSC data for ${data.rows.length} records (Daily/Page)`);
    }

    /**
     * Get search console data for a specific post
     */
    async getPostData(postId: string, days: number = 30): Promise<GoogleSearchConsole[]> {
        const since = new Date();
        since.setDate(since.getDate() - days);

        return this.em.find(GoogleSearchConsole, {
            post: postId,
            date: { $gte: since },
        }, {
            orderBy: { date: 'DESC' },
        });
    }

    /**
     * Get top performing posts by clicks
     */
    async getTopPosts(limit: number = 10, days: number = 30): Promise<any[]> {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const results = await this.em.getConnection().execute(
            `
      SELECT 
        p.id,
        p.title,
        p.slug,
        SUM(gsc.clicks) as total_clicks,
        SUM(gsc.impressions) as total_impressions,
        AVG(gsc.ctr) as avg_ctr,
        AVG(gsc.position) as avg_position
      FROM google_search_console gsc
      JOIN posts p ON gsc.post_id = p.id
      WHERE gsc.date >= ?
      GROUP BY p.id, p.title, p.slug
      ORDER BY total_clicks DESC
      LIMIT ?
      `,
            [since, limit],
        );

        return results;
    }

    /**
     * Get aggregated overview stats
     */
    async getOverviewStats(days: number = 30): Promise<any> {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const [result] = await this.em.getConnection().execute(
            `
            SELECT 
                SUM(clicks) as total_clicks,
                SUM(impressions) as total_impressions,
                AVG(ctr) as avg_ctr,
                AVG(position) as avg_position
            FROM google_search_console
            WHERE date >= ?
            `,
            [since]
        );

        return {
            totalClicks: parseInt(result?.total_clicks || '0'),
            totalImpressions: parseInt(result?.total_impressions || '0'),
            avgCtr: parseFloat(result?.avg_ctr || '0'),
            avgPosition: parseFloat(result?.avg_position || '0'),
        };
    }

    /**
     * Get top search queries from GSC API
     */
    async getTopQueries(startDate: string, endDate: string, limit: number = 10): Promise<any[]> {
        const authenticated = await this.ensureAuthenticated();
        if (!authenticated) return [];

        try {
            const searchconsole = google.searchconsole({ version: 'v1', auth: this.oauth2Client });
            const response = await searchconsole.searchanalytics.query({
                siteUrl: this.siteUrl,
                requestBody: {
                    startDate,
                    endDate,
                    dimensions: ['query'],
                    rowLimit: limit,
                },
            });

            return response.data.rows || [];
        } catch (error) {
            this.logger.error(`Failed to fetch top queries: ${error.message}`);
            return [];
        }
    }

    /**
     * Extract slug from full URL
     */
    private extractSlugFromUrl(url: string): string | null {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            return pathParts[pathParts.length - 1] || null;
        } catch {
            return null;
        }
    }
}
