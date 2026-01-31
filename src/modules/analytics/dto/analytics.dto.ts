/**
 * Analytics Module DTOs
 * Định nghĩa cấu trúc dữ liệu cho API Analytics
 */

// ========== METRIC WITH GROWTH ==========
export interface MetricWithGrowth {
    /** Giá trị hiện tại */
    value: number;
    /** Giá trị kỳ trước */
    previous: number;
    /** Phần trăm tăng/giảm (số dương = tăng, số âm = giảm) */
    growth: number;
}

// ========== TRAFFIC CHART ==========
export interface TrafficDataPoint {
    /** Nhãn thời gian (ngày hoặc giờ) */
    label: string;
    /** Lượt truy cập từ Mobile + Tablet */
    mobile: number;
    /** Lượt truy cập từ Desktop */
    desktop: number;
    /** Tổng lượt truy cập */
    total: number;
}

// ========== LOCATION STATS ==========
export interface LocationStat {
    city: string;
    country: string;
    count: number;
}

// ========== DEVICE STATS ==========
export interface DeviceTypeStat {
    name: string;
    count: number;
    percentage: number;
}

export interface DeviceStats {
    types: DeviceTypeStat[];
    os: DeviceTypeStat[];
    browsers: DeviceTypeStat[];
}

// ========== CONTENT STATS ==========
export interface ContentItem {
    url: string;
    title: string;
    views: number;
}

export interface ContentStats {
    topCourses: ContentItem[];
    topPosts: ContentItem[];
    topPages: ContentItem[];
    /** Phân loại theo Type (Post/Course) */
    interestByType?: { name: string; value: number }[];
    /** Phân loại theo Chuyên mục thực tế (AI, Marketing...) */
    interestByCategory?: { name: string; value: number }[];
    /** Các bài viết đang có xu hướng xem nhiều trong kỳ */
    trendingPosts?: ContentItem[];
}

export interface InteractionStat {
    name: string;
    count: number;
}


// ========== PEAK HOURS ==========
export interface PeakHour {
    hour: number;
    count: number;
}

// ========== TRAFFIC SOURCES ==========
export interface TrafficSource {
    source: string;
    count: number;
    percentage: number;
}

// ========== SUMMARY ==========
export interface DashboardSummary {
    totalVisits: MetricWithGrowth;
    activeUsers: MetricWithGrowth;
    newUsers: MetricWithGrowth;
    avgDuration: MetricWithGrowth;
    bounceRate: MetricWithGrowth;
}

// ========== MAIN RESPONSE ==========
export interface DashboardStatsResponse {
    /** Khoảng thời gian đang xem */
    dateRange: {
        current: { from: string; to: string };
        previous: { from: string; to: string };
    };
    /** Tổng quan với % tăng trưởng */
    summary: DashboardSummary;
    /** Biểu đồ Traffic theo thời gian (Mobile vs Desktop) */
    trafficChart: TrafficDataPoint[];
    /** Top 10 thành phố */
    locations: LocationStat[];
    /** Thống kê thiết bị */
    devices: DeviceStats;
    /** Nội dung phổ biến */
    content: ContentStats;
    /** Giờ cao điểm trong ngày */
    peakHours: PeakHour[];
    /** Nguồn truy cập */
    trafficSources: TrafficSource[];
    /** Thống kê các tương tác quan trọng (click, submit...) */
    interactions?: InteractionStat[];
}

// ========== INPUT DTO ==========
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class TrackVisitDto {
    @IsString()
    @IsNotEmpty()
    url!: string;

    @IsString()
    @IsOptional()
    referrer?: string;

    @IsString()
    @IsOptional()
    entityId?: string; // Slug của bài viết hoặc khóa học

    @IsString()
    @IsOptional()
    entityType?: string; // 'post', 'course', 'category'
}

export class TrackEventDto {
    @IsString()
    @IsNotEmpty()
    eventType!: string;

    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;

    @IsString()
    @IsNotEmpty()
    sessionInternalId!: string;
}
