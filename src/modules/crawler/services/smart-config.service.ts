import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser = require('rss-parser');
import { ScraperType } from '../entities/scraper-config.entity';

export interface RssAutoDetectResult {
    detectedFeedUrl: string | null;
    feedName: string;
    feedDescription: string;
    itemCount: number;
    previewItems: { title: string; link: string }[];
    suggestedConfig: {
        scraperType: ScraperType;
        cronExpression: string;
        suggestedCategory: string | null;
        selectorConfig: {
            titleSelector: string;
            contentSelector: string;
            thumbnailSelector: string;
        };
    };
    confidence: number;
}

export interface CronPreset {
    label: string;
    value: string | null;
    description: string;
}

@Injectable()
export class SmartConfigService {
    private readonly logger = new Logger(SmartConfigService.name);
    private readonly parser = new Parser({
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    /**
     * Auto-detect RSS feed info from a generic URL
     */
    async autoDetectRss(url: string): Promise<RssAutoDetectResult> {
        let feedUrl = url;
        let isDirectRss = false;

        // Try direct RSS parse first
        try {
            await this.parser.parseURL(url);
            isDirectRss = true;
        } catch (e) {
            // Not a direct RSS feed, try fetching HTML to find alternate link
            this.logger.log(`URL ${url} is not direct RSS. Searching HTML...`);
            try {
                const response = await axios.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 10000
                });
                const $ = cheerio.load(response.data);
                const alternateLink = $('link[type="application/rss+xml"]').attr('href');
                if (alternateLink) {
                    feedUrl = alternateLink.startsWith('http') ? alternateLink : new URL(alternateLink, url).toString();
                } else {
                    throw new NotFoundException('No RSS feed found on page');
                }
            } catch (err) {
                this.logger.warn(`Failed to detect RSS from HTML: ${err.message}`);
                throw new NotFoundException('Không tìm thấy RSS Feed hợp lệ từ URL này.');
            }
        }

        // We have a feedUrl, let's parse it and gather metadata
        const feed = await this.parser.parseURL(feedUrl);
        const parsedUrl = new URL(feedUrl);

        // Auto-detect Scraper Type logic (SPAs usually need Playwright)
        const isSpaLikely = ['medium.com', 'dev.to', 'facebook.com'].includes(parsedUrl.hostname);

        // Very basic DOM structure heuristics
        const defaultTitle = 'h1';
        const defaultContent = 'article, .post-content, .entry-content';
        const defaultThumb = 'meta[property="og:image"]';

        return {
            detectedFeedUrl: feedUrl,
            feedName: feed.title || parsedUrl.hostname,
            feedDescription: feed.description || `Auto-detected feed for ${parsedUrl.hostname}`,
            itemCount: feed.items?.length || 0,
            previewItems: feed.items?.slice(0, 3).map(i => ({ title: i.title || 'No Title', link: i.link || '' })) || [],
            suggestedConfig: {
                scraperType: isSpaLikely ? ScraperType.DYNAMIC : ScraperType.STATIC,
                cronExpression: '0 */6 * * *',
                suggestedCategory: null,
                selectorConfig: {
                    titleSelector: defaultTitle,
                    contentSelector: defaultContent,
                    thumbnailSelector: defaultThumb,
                },
            },
            confidence: isDirectRss ? 0.95 : 0.8,
        };
    }

    /**
     * Friendly cron presets for UI dropdown
     */
    getCronPresets(): CronPreset[] {
        return [
            { label: 'Liên tục (Mỗi 30 phút)', value: '*/30 * * * *', description: 'Cập nhật tin rất nhanh' },
            { label: 'Mỗi 1 giờ', value: '0 * * * *', description: 'Tin tức thời sự' },
            { label: 'Mỗi 3 giờ', value: '0 */3 * * *', description: 'Khuyến nghị chung' },
            { label: 'Mỗi 6 giờ (Tiết kiệm)', value: '0 */6 * * *', description: 'Blog, bài viết ít cập nhật' },
            { label: 'Mỗi ngày lúc 8h sáng', value: '0 8 * * *', description: 'Tóm tắt mỗi sáng' },
            { label: 'Chỉ cào thủ công', value: null, description: 'Tắt tính năng chạy ngầm' },
        ];
    }
}
