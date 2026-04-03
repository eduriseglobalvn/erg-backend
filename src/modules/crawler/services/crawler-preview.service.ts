import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, wrap } from '@mikro-orm/core';
import Parser from 'rss-parser';
import axios from 'axios';
import { RssFeed } from '../entities/rss-feed.entity';
import { CrawlHistory } from '../entities/crawl-history.entity';
import { Post } from '../../posts/entities/post.entity';
import { CrawlBatchTrackerService } from './crawl-batch-tracker.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class CrawlerPreviewService {
    private readonly logger = new Logger(CrawlerPreviewService.name);
    private readonly rssParser = new Parser();

    constructor(
        @InjectRepository(RssFeed, 'mongo-connection')
        private readonly rssRepository: EntityRepository<RssFeed>,
        @InjectRepository(CrawlHistory, 'mongo-connection')
        private readonly historyRepository: EntityRepository<CrawlHistory>,
        @InjectRepository(Post)
        private readonly postRepository: EntityRepository<Post>,
        private readonly crawlBatchTracker: CrawlBatchTrackerService,
        @InjectQueue('crawl_scrape') private scrapeQueue: Queue,
    ) { }

    async peekRss(rssId: string) {
        const feed = await this.rssRepository.findOne({ id: rssId });
        if (!feed) throw new NotFoundException('RSS Feed not found');

        const response = await axios.get(feed.url, { responseType: 'text' });
        const xml = response.data.toString().trim().replace(/^\uFEFF/, '');
        const parsed = await this.rssParser.parseString(xml);

        const getThumbnail = (item: any) => {
            if (item.enclosure && item.enclosure.url) return item.enclosure.url;
            if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) return item['media:content'].$.url;
            const content = item['content:encoded'] || item.content || item.description || '';
            const match = content.match(/src="([^"]+)"/);
            return match ? match[1] : null;
        };

        const links = parsed.items.map(i => i.link).filter((link): link is string => !!link);
        const histories = await this.historyRepository.find({ url: { $in: links } });
        const historyMap = new Map(histories.map(h => [h.url, h]));

        const validPostIds = histories.map(h => h.postId).filter((id): id is string => !!id);
        let postMap = new Map();
        if (validPostIds.length > 0) {
            const posts = await this.postRepository.find({ id: { $in: validPostIds }, deletedAt: null });
            postMap = new Map(posts.map(p => [p.id, p]));
        }

        let fallbackPostMap = new Map();
        if (links.length > 0) {
            const likeConditions = links.map(link => ({ aiPrompt: { $like: `%${link}%` } }));
            const fallbackPosts = await this.postRepository.find({ $or: likeConditions, deletedAt: null });

            for (const post of fallbackPosts) {
                if (post.aiPrompt) {
                    for (const link of links) {
                        if (post.aiPrompt.includes(link)) {
                            fallbackPostMap.set(link, post);
                            break;
                        }
                    }
                }
            }
        }

        return {
            feedName: feed.name,
            items: parsed.items.map(item => {
                const link = item.link;
                const history = link ? historyMap.get(link) : null;
                let isFoundInDb = false;
                let existingPostId = history?.postId;

                if (existingPostId && postMap.has(existingPostId)) isFoundInDb = true;

                if (!isFoundInDb && link) {
                    const postByUrl = fallbackPostMap.get(link);
                    if (postByUrl) {
                        isFoundInDb = true;
                        existingPostId = postByUrl.id;
                    }
                }

                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    guid: item.guid,
                    thumbnail: getThumbnail(item),
                    isCrawled: isFoundInDb,
                    status: isFoundInDb ? 'SUCCESS' : (history?.status || 'PENDING'),
                    postId: existingPostId
                };
            })
        };
    }

    async previewRssByUrl(url: string) {
        try {
            const response = await axios.get(url, { responseType: 'text' });
            const xml = response.data.toString().trim().replace(/^\uFEFF/, '');
            const parsed = await this.rssParser.parseString(xml);

            const getThumbnail = (item: any) => {
                if (item.enclosure && item.enclosure.url) return item.enclosure.url;
                if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) return item['media:content'].$.url;
                const content = item['content:encoded'] || item.content || item.description || '';
                const match = content.match(/src="([^"]+)"/);
                return match ? match[1] : null;
            };

            const links = parsed.items.map(i => i.link).filter((link): link is string => !!link);
            const histories = await this.historyRepository.find({ url: { $in: links } });
            const historyMap = new Map(histories.map(h => [h.url, h]));

            const validPostIds = histories.map(h => h.postId).filter((id): id is string => !!id);
            let postMap = new Map();
            if (validPostIds.length > 0) {
                const posts = await this.postRepository.find({ id: { $in: validPostIds }, deletedAt: null });
                postMap = new Map(posts.map(p => [p.id, p]));
            }

            let fallbackPostMap = new Map();
            if (links.length > 0) {
                const likeConditions = links.map(link => ({ aiPrompt: { $like: `%${link}%` } }));
                const fallbackPosts = await this.postRepository.find({ $or: likeConditions, deletedAt: null });

                for (const post of fallbackPosts) {
                    if (post.aiPrompt) {
                        for (const link of links) {
                            if (post.aiPrompt.includes(link)) {
                                fallbackPostMap.set(link, post);
                                break;
                            }
                        }
                    }
                }
            }

            return {
                feedTitle: parsed.title,
                feedUrl: url,
                items: parsed.items.map(item => {
                    const link = item.link;
                    const history = link ? historyMap.get(link) : null;
                    let isFoundInDb = false;
                    if (history && history.postId && postMap.has(history.postId)) isFoundInDb = true;

                    if (!isFoundInDb && link) {
                        const postByUrl = fallbackPostMap.get(link);
                        if (postByUrl) isFoundInDb = true;
                    }

                    return {
                        title: item.title,
                        link: item.link,
                        pubDate: item.pubDate,
                        guid: item.guid,
                        thumbnail: getThumbnail(item),
                        isCrawled: isFoundInDb,
                        status: isFoundInDb ? 'SUCCESS' : (history?.status || 'PENDING')
                    };
                })
            };
        } catch (error) {
            this.logger.error(`Failed to preview RSS ${url}`, error);
            throw new BadRequestException(`Failed to parse RSS URL: ${error.message}`);
        }
    }

    async createRssWithSelection(dto: { feed: Partial<RssFeed>, selectedLinks: string[] }) {
        let feed: RssFeed;
        if (dto.feed.id) {
            const existing = await this.rssRepository.findOne({ id: dto.feed.id } as any);
            if (existing) {
                wrap(existing).assign(dto.feed);
                feed = existing;
            } else {
                feed = this.rssRepository.create(dto.feed as any);
            }
        } else {
            feed = this.rssRepository.create(dto.feed as any);
        }
        await this.rssRepository.getEntityManager().persistAndFlush(feed);

        if (dto.selectedLinks && dto.selectedLinks.length > 0) {
            this.logger.log(`[RSS Selection] Manual triggered for ${dto.selectedLinks.length} items. Feed: ${feed.name}`);
            const batchId = `rss-batch-${feed.id}-${Date.now()}`;
            await this.crawlBatchTracker.registerBatch(batchId, dto.selectedLinks.length, feed.id, feed.name);

            dto.selectedLinks.forEach(async (link, index) => {
                const safeUrl = Buffer.from(link).toString('base64').substring(0, 20);
                const jobId = `manual-crawl-${safeUrl}-${Date.now()}-${index}`;

                await this.scrapeQueue.add('scrape_url', {
                    url: link,
                    rssId: feed.id,
                    targetCategoryId: dto.feed.targetCategoryId || feed.targetCategoryId,
                    autoPublish: feed.autoPublish,
                    selectorConfig: feed.selectorConfig,
                    manual: true,
                    batchId
                }, { jobId });
            });
        }
        return feed;
    }
}
