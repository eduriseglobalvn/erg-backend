import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { Visit } from './entities/visit.entity';
import { AnalyticsEvent } from './entities/event.entity';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { PostCategory } from '../posts/entities/post-category.entity';
import { PostStatus } from '@/shared/enums/app.enum';
import * as geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';

export interface MetricWithGrowth {
    value: number;
    previous: number;
    growth: number;
}

export interface TrafficDataPoint {
    label: string;
    mobile: number;
    desktop: number;
    total: number;
}

export interface VisitorStat {
    date: string;
    desktop: number;
    mobile: number;
}

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(
        @InjectRepository(Visit, 'mongo-connection')
        private readonly visitRepo: EntityRepository<Visit>,
        @InjectRepository(AnalyticsEvent, 'mongo-connection')
        private readonly eventRepo: EntityRepository<AnalyticsEvent>,
        @InjectRepository(User)
        private readonly userRepo: EntityRepository<User>,
        @InjectRepository(Post)
        private readonly postRepo: EntityRepository<Post>,
        @InjectRepository(PostCategory)
        private readonly categoryRepo: EntityRepository<PostCategory>,
    ) { }

    // ========== TRACKING METHODS ==========

    async trackVisit(data: {
        url: string;
        referrer?: string;
        ip?: string;
        userAgent?: string;
        userId?: number;
    }) {
        try {
            this.logger.log(`Tracking visit for URL: ${data.url}, IP: ${data.ip}, UserID: ${data.userId}`);

            const parser = new UAParser(data.userAgent);
            const result = parser.getResult();
            const geo = data.ip ? geoip.lookup(data.ip) : null;

            let deviceType = result.device.type || 'desktop';
            if (!['mobile', 'tablet', 'desktop'].includes(deviceType)) {
                deviceType = 'desktop';
            }

            const visit = this.visitRepo.create({
                url: data.url,
                referrer: data.referrer,
                ipAddress: data.ip,
                userAgent: data.userAgent,
                userId: data.userId,
                durationSeconds: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                deviceType: deviceType,
                os: result.os.name || 'Unknown',
                browser: result.browser.name || 'Unknown',
                country: geo?.country,
                city: geo?.city,
                region: geo?.region,
                timezone: geo?.timezone,
            });

            await this.visitRepo.getEntityManager().persistAndFlush(visit);

            this.logger.log(`Visit persisted successfully. ID: ${visit.id}, MongoID: ${visit._id}`);

            return { visitId: visit.id };
        } catch (error) {
            this.logger.error('Failed to track visit', error.stack);
            return { visitId: null };
        }
    }

    async trackEvent(data: {
        eventType: string;
        metadata: any;
        userId?: number;
        sessionInternalId: string;
    }) {
        try {
            const event = this.eventRepo.create({
                eventType: data.eventType,
                metadata: data.metadata,
                userId: data.userId,
                sessionInternalId: data.sessionInternalId,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await this.eventRepo.getEntityManager().persistAndFlush(event);
            return { success: true };
        } catch (error) {
            this.logger.error('Failed to track event', error.stack);
            return { success: false };
        }
    }

    async updateVisitDuration(visitId: string, durationSeconds: number) {
        try {
            const visit = await this.visitRepo.findOne(visitId);
            if (visit) {
                visit.durationSeconds = durationSeconds;
                await this.visitRepo.getEntityManager().flush();
            }
        } catch (error) {
            this.logger.error(`Failed to update duration for visit ${visitId}`, error.stack);
        }
    }

    // ========== NEW: VISITOR STATS (GET /analytics/visitors) ==========

    async getVisitorStats(range: string, from?: Date, to?: Date): Promise<VisitorStat[]> {
        let startTime: Date;
        let endTime: Date = to || new Date();

        // 1. Xác định range
        if (from) {
            startTime = from;
        } else {
            startTime = new Date();
            startTime.setHours(0, 0, 0, 0); // Reset time part for cleaner ranges

            switch (range) {
                case '30d':
                    startTime.setDate(startTime.getDate() - 30);
                    break;
                case '90d':
                    startTime.setDate(startTime.getDate() - 90);
                    break;
                case '7d':
                default:
                    startTime.setDate(startTime.getDate() - 7);
                    break;
            }
        }

        // 2. Query Data
        // Aggregate unique visitors by IP per day per device type?
        // For simplicity & performance given requirement: Count visits (page views) or distinct IPs.
        // Request says: "Count số lượng unique visitor (hoặc page views)"
        // Since we store each visit, let's Aggregate.

        // Vì MikroORM với lMongo driver support aggregate, nhưng ở mức repo.
        // Or simple find and process in memory if data volume isn't huge yet.
        // For a production scalable solution, we should accept 'visits' query might return large data.
        // Let's use Aggregate/Knex query builder pattern or raw query if possible. 
        // DO MikroORM Mongo allow easy robust aggregation? Yes via getCollection().aggregate()

        // Using simple JS processing for now as MVP robustness (easier to debug & maintain for this code base context)
        // But optimization: Retrieve only needed fields.
        const visits = await this.visitRepo.find(
            { createdAt: { $gte: startTime, $lte: endTime } },
            { fields: ['createdAt', 'deviceType', 'ipAddress'] } // Chỉ lấy fields cần thiết
        );

        // 3. Grouping Logic
        const statsMap: Record<string, { desktop: Set<string>; mobile: Set<string>; }> = {};

        // Helper to init date key
        const getInitStat = () => ({ desktop: new Set<string>(), mobile: new Set<string>() });

        // Iterate visits
        for (const visit of visits) {
            const dateKey = new Date(visit.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
            if (!statsMap[dateKey]) {
                statsMap[dateKey] = getInitStat();
            }

            const isMobile = visit.deviceType === 'mobile' || visit.deviceType === 'tablet';
            const identifier = visit.ipAddress || 'unknown'; // Dùng IP làm unique visitor identifier

            if (isMobile) {
                statsMap[dateKey].mobile.add(identifier);
            } else {
                statsMap[dateKey].desktop.add(identifier);
            }
        }

        // 4. Fill missing dates (để biểu đồ không bị đứt quãng)
        const result: VisitorStat[] = [];
        const currentDate = new Date(startTime);

        while (currentDate <= endTime) {
            const dateKey = currentDate.toISOString().split('T')[0];
            const stat = statsMap[dateKey] || getInitStat();

            result.push({
                date: dateKey,
                desktop: stat.desktop.size,
                mobile: stat.mobile.size,
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return result;
    }

    // ========== DASHBOARD AGGREGATION ==========

    async getDashboardStats(from: Date, to: Date) {
        const rangeDays = this.getDaysDiff(from, to);
        const previousFrom = new Date(from);
        previousFrom.setDate(previousFrom.getDate() - rangeDays - 1);
        const previousTo = new Date(from);
        previousTo.setDate(previousTo.getDate() - 1);

        const [currentVisits, previousVisits, currentNewUsers, previousNewUsers] = await Promise.all([
            this.visitRepo.find({ createdAt: { $gte: from, $lte: to } }),
            this.visitRepo.find({ createdAt: { $gte: previousFrom, $lte: previousTo } }),
            this.countNewUsers(from, to),
            this.countNewUsers(previousFrom, previousTo),
        ]);

        const currentSummary = this.calculateRawSummary(currentVisits);
        const previousSummary = this.calculateRawSummary(previousVisits);

        return {
            dateRange: {
                current: { from: from.toISOString(), to: to.toISOString() },
                previous: { from: previousFrom.toISOString(), to: previousTo.toISOString() },
            },
            summary: {
                totalVisits: this.createMetricWithGrowth(currentSummary.totalVisits, previousSummary.totalVisits),
                activeUsers: this.createMetricWithGrowth(currentSummary.activeUsers, previousSummary.activeUsers),
                newUsers: this.createMetricWithGrowth(currentNewUsers, previousNewUsers),
                avgDuration: this.createMetricWithGrowth(currentSummary.avgDuration, previousSummary.avgDuration),
                bounceRate: this.createMetricWithGrowth(currentSummary.bounceRate, previousSummary.bounceRate),
            },
            trafficChart: this.calculateAdvancedTrafficChart(currentVisits, from, to),
            locations: this.calculateLocationStats(currentVisits),
            devices: this.calculateDeviceStats(currentVisits),
            content: this.calculateContentStats(currentVisits),
            peakHours: this.calculatePeakHours(currentVisits),
            trafficSources: this.calculateTrafficSources(currentVisits),
        };
    }

    // ========== HELPER METHODS ==========

    private async countNewUsers(from: Date, to: Date): Promise<number> {
        try {
            return await this.userRepo.count({
                createdAt: { $gte: from, $lte: to },
            });
        } catch (error) {
            this.logger.error('Failed to count new users', error.stack);
            return 0;
        }
    }

    private getDaysDiff(from: Date, to: Date): number {
        const diffTime = Math.abs(to.getTime() - from.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    private createMetricWithGrowth(current: number, previous: number): MetricWithGrowth {
        let growth = 0;
        if (previous > 0) {
            growth = ((current - previous) / previous) * 100;
        } else if (current > 0) {
            growth = 100;
        }
        return {
            value: current,
            previous: previous,
            growth: Math.round(growth * 10) / 10,
        };
    }

    private calculateRawSummary(visits: Visit[]) {
        const totalVisits = visits.length;
        const uniqueIdentifiers = new Set(
            visits.map(v => v.userId?.toString() || v.ipAddress || 'unknown')
        );
        const activeUsers = uniqueIdentifiers.size;

        const validDurations = visits.filter(v => v.durationSeconds > 0);
        const avgDuration = validDurations.length > 0
            ? Math.round(validDurations.reduce((sum, v) => sum + v.durationSeconds, 0) / validDurations.length)
            : 0;

        const bounces = visits.filter(v => v.durationSeconds < 10).length;
        const bounceRate = totalVisits > 0 ? Math.round((bounces / totalVisits) * 100) : 0;

        return { totalVisits, activeUsers, avgDuration, bounceRate };
    }

    private calculateAdvancedTrafficChart(visits: Visit[], from: Date, to: Date): TrafficDataPoint[] {
        const rangeDays = this.getDaysDiff(from, to);
        const dataPoints: TrafficDataPoint[] = [];

        if (rangeDays <= 2) {
            for (let hour = 0; hour < 24; hour++) {
                const hourVisits = visits.filter(v => new Date(v.createdAt).getHours() === hour);
                dataPoints.push({
                    label: `${hour.toString().padStart(2, '0')}:00`,
                    mobile: hourVisits.filter(v => v.deviceType === 'mobile' || v.deviceType === 'tablet').length,
                    desktop: hourVisits.filter(v => v.deviceType === 'desktop').length,
                    total: hourVisits.length,
                });
            }
        } else if (rangeDays <= 90) {
            const dateMap: Record<string, { mobile: number; desktop: number; total: number }> = {};
            for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                dateMap[dateStr] = { mobile: 0, desktop: 0, total: 0 };
            }
            visits.forEach(v => {
                const dateStr = new Date(v.createdAt).toISOString().split('T')[0];
                if (dateMap[dateStr]) {
                    dateMap[dateStr].total++;
                    if (v.deviceType === 'mobile' || v.deviceType === 'tablet') {
                        dateMap[dateStr].mobile++;
                    } else {
                        dateMap[dateStr].desktop++;
                    }
                }
            });
            Object.keys(dateMap).sort().forEach(date => {
                dataPoints.push({
                    label: date,
                    mobile: dateMap[date].mobile,
                    desktop: dateMap[date].desktop,
                    total: dateMap[date].total,
                });
            });
        } else {
            const weekMap: Record<string, { mobile: number; desktop: number; total: number }> = {};
            visits.forEach(v => {
                const date = new Date(v.createdAt);
                const weekStart = this.getWeekStart(date);
                const weekKey = weekStart.toISOString().split('T')[0];
                if (!weekMap[weekKey]) {
                    weekMap[weekKey] = { mobile: 0, desktop: 0, total: 0 };
                }
                weekMap[weekKey].total++;
                if (v.deviceType === 'mobile' || v.deviceType === 'tablet') {
                    weekMap[weekKey].mobile++;
                } else {
                    weekMap[weekKey].desktop++;
                }
            });
            Object.keys(weekMap).sort().forEach(week => {
                dataPoints.push({
                    label: `Tuần ${week}`,
                    mobile: weekMap[week].mobile,
                    desktop: weekMap[week].desktop,
                    total: weekMap[week].total,
                });
            });
        }
        return dataPoints;
    }

    private getWeekStart(date: Date): Date {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    private calculatePeakHours(visits: Visit[]): { hour: number; count: number }[] {
        const hourMap: Record<number, number> = {};
        for (let i = 0; i < 24; i++) {
            hourMap[i] = 0;
        }
        visits.forEach(v => {
            const hour = new Date(v.createdAt).getHours();
            hourMap[hour]++;
        });
        return Object.entries(hourMap)
            .map(([hour, count]) => ({ hour: parseInt(hour), count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }

    private calculateTrafficSources(visits: Visit[]): { source: string; count: number; percentage: number }[] {
        const sourceMap: Record<string, number> = {
            'Direct': 0,
            'Google': 0,
            'Facebook': 0,
            'Other': 0,
        };
        visits.forEach(v => {
            const referrer = (v.referrer || '').toLowerCase();
            if (!referrer || referrer === '' || referrer.includes('erg.edu.vn')) {
                sourceMap['Direct']++;
            } else if (referrer.includes('google')) {
                sourceMap['Google']++;
            } else if (referrer.includes('facebook') || referrer.includes('fb.')) {
                sourceMap['Facebook']++;
            } else {
                sourceMap['Other']++;
            }
        });
        const total = visits.length || 1;
        return Object.entries(sourceMap)
            .map(([source, count]) => ({
                source,
                count,
                percentage: Math.round((count / total) * 100),
            }))
            .sort((a, b) => b.count - a.count);
    }

    private calculateLocationStats(visits: Visit[]) {
        const cityMap: Record<string, { city: string; country: string; count: number }> = {};
        visits.forEach(v => {
            if (v.city) {
                const key = `${v.city}-${v.country || 'Unknown'}`;
                if (!cityMap[key]) {
                    cityMap[key] = { city: v.city, country: v.country || 'Unknown', count: 0 };
                }
                cityMap[key].count++;
            }
        });
        return Object.values(cityMap)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }

    private calculateDeviceStats(visits: Visit[]) {
        const typeMap: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
        const osMap: Record<string, number> = {};
        const browserMap: Record<string, number> = {};
        visits.forEach(v => {
            const type = v.deviceType || 'desktop';
            if (typeMap[type] !== undefined) {
                typeMap[type]++;
            } else {
                typeMap['desktop']++;
            }
            const os = v.os || 'Unknown';
            osMap[os] = (osMap[os] || 0) + 1;
            const browser = v.browser || 'Unknown';
            browserMap[browser] = (browserMap[browser] || 0) + 1;
        });
        const total = visits.length || 1;
        return {
            types: Object.entries(typeMap).map(([name, count]) => ({
                name,
                count,
                percentage: Math.round((count / total) * 100),
            })),
            os: Object.entries(osMap)
                .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5),
            browsers: Object.entries(browserMap)
                .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5),
        };
    }

    private calculateContentStats(visits: Visit[]) {
        const pageMap: Record<string, { url: string; title: string; views: number }> = {};
        visits.forEach(v => {
            const url = v.url || '';
            if (!url) return;
            const cleanUrl = url.split('?')[0];
            if (!pageMap[cleanUrl]) {
                let title = cleanUrl;
                if (cleanUrl.includes('/courses/')) {
                    title = cleanUrl.split('/courses/')[1] || cleanUrl;
                } else if (cleanUrl.includes('/posts/')) {
                    title = cleanUrl.split('/posts/')[1] || cleanUrl;
                } else if (cleanUrl.includes('/tin-tuc/')) {
                    title = cleanUrl.split('/tin-tuc/')[1] || cleanUrl;
                }
                pageMap[cleanUrl] = { url: cleanUrl, title, views: 0 };
            }
            pageMap[cleanUrl].views++;
        });
        const allPages = Object.values(pageMap).sort((a, b) => b.views - a.views);
        const topCourses = allPages.filter(p => p.url.includes('/courses/')).slice(0, 5);
        const topPosts = allPages.filter(p => p.url.includes('/posts/') || p.url.includes('/tin-tuc/')).slice(0, 5);
        const topPages = allPages.slice(0, 10);
        return { topCourses, topPosts, topPages };
    }

    // ========== NEW: POST ANALYTICS SUMMARY ==========

    async getPostSummary(range: string = '90d') {
        try {
            this.logger.log(`Generating post summary for range: ${range}`);
            const now = new Date();
            let startTime = new Date();

            // 1. Calculate Start Time based on range
            switch (range) {
                case '7d': startTime.setDate(now.getDate() - 7); break;
                case '30d': startTime.setDate(now.getDate() - 30); break;
                case '90d': startTime.setDate(now.getDate() - 90); break;
                case '180d': startTime.setDate(now.getDate() - 180); break;
                case '365d': startTime.setDate(now.getDate() - 365); break;
                default: startTime.setDate(now.getDate() - 90);
            }

            // 2. Overview Stats (Total, Published, Draft)
            const [totalPosts, publishedPosts, draftPosts] = await Promise.all([
                this.postRepo.count({ deletedAt: null }),
                this.postRepo.count({ status: PostStatus.PUBLISHED, deletedAt: null }),
                this.postRepo.count({ status: PostStatus.DRAFT, deletedAt: null }),
            ]);

            // 3. Category Distribution
            // We fetch categories and their post counts (filtered by createdAt >= startTime if needed, but for redistribution usually we show all or just within range)
            // To be accurate with the range:
            const categories = await this.categoryRepo.findAll({
                populate: ['posts'],
                // Note: Filter posts within the collection if needed, but typically distribution is for all time or current state.
                // Let's use the simple approach first.
            });

            const categoryDistribution = categories.map(cat => ({
                category: cat.name,
                count: cat.posts.getItems().filter(p => !p.deletedAt && p.createdAt >= startTime).length
            })).filter(item => item.count > 0);

            // 4. Monthly Stats
            const posts = await this.postRepo.find(
                {
                    createdAt: { $gte: startTime },
                    deletedAt: null
                },
                { fields: ['createdAt', 'viewCount'] }
            );

            const monthlyStatsMap: Record<string, { posts: number; views: number }> = {};
            const monthNames = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

            // Initialize months between startTime and now
            let iterDate = new Date(startTime);
            iterDate.setDate(1);
            while (iterDate <= now) {
                const key = `${monthNames[iterDate.getMonth()]} ${iterDate.getFullYear()}`;
                monthlyStatsMap[key] = { posts: 0, views: 0 };
                iterDate.setMonth(iterDate.getMonth() + 1);
            }

            posts.forEach(post => {
                const d = new Date(post.createdAt);
                const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
                if (monthlyStatsMap[key]) {
                    monthlyStatsMap[key].posts++;
                    monthlyStatsMap[key].views += post.viewCount || 0;
                }
            });

            const monthlyStats = Object.keys(monthlyStatsMap)
                .map(month => ({
                    month,
                    posts: monthlyStatsMap[month].posts,
                    views: monthlyStatsMap[month].views,
                }))
                .reverse(); // Time order

            return {
                monthlyStats,
                categoryDistribution,
                overview: {
                    totalPosts,
                    publishedPosts,
                    draftPosts,
                }
            };
        } catch (error) {
            this.logger.error(`Error in getPostSummary: ${error.message}`, error.stack);
            throw error;
        }
    }
}
