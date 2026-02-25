import { Injectable } from '@nestjs/common';
import { Post } from '@/modules/posts/entities/post.entity';
// import { YoastService } from './yoast.service'; // Removed

export interface TitleAnalysis {
    length: number;
    hasKeyword: boolean;
    suggestions: string[];
}

export interface MetaAnalysis {
    length: number;
    hasKeyword: boolean;
    suggestions: string[];
}

export interface ContentAnalysis {
    wordCount: number;
    keywordDensity: number;
    readabilityScore: number;
    headingStructure: {
        h1: number;
        h2: number;
        h3: number;
        valid: boolean;
    };
    paragraphCount: number;
}

export interface TechnicalAnalysis {
    hasCanonical: boolean;
    hasSchema: boolean;
    imageAltTags: {
        total: number;
        withAlt: number;
    };
    internalLinks: number;
    externalLinks: number;
}

export interface ComprehensiveSeoAnalysis {
    overallScore: number;
    titleAnalysis: TitleAnalysis;
    metaAnalysis: MetaAnalysis;
    contentAnalysis: ContentAnalysis;
    technicalAnalysis: TechnicalAnalysis;
    suggestions: string[];
}

@Injectable()
export class SeoAnalyzerService {

    constructor(
        // private readonly yoastService: YoastService // Removed
    ) { }

    /**
     * Simplified analysis for backward compatibility (Synchronous wrapper)
     */
    analyze(content: string, keyword: string = ''): { score: number; readabilityScore: number; keywordDensity: number } {
        // Simplified analysis (No longer uses Yoast Backend)
        // Returns basic placeholders or could implement simple length check
        return {
            score: 0,
            readabilityScore: 0,
            keywordDensity: 0,
        };
    }

    /**
     * Comprehensive SEO analysis
     */
    analyzeComprehensive(post: Post, siteUrl: string = 'https://erg.edu.vn'): ComprehensiveSeoAnalysis {
        // 1. Scores are now provided by Frontend (stored in Post entity)
        // We use them directly.
        const seoScore = post.seoScore || 0;
        const readabilityScore = post.readabilityScore || 0;
        const keywordDensity = post.keywordDensity || 0;

        // 2. Technical Analysis (Manual checks for things Yoast JS might miss or we treat differently)
        const cleanContent = post.content || '';
        const imgRegex = /<img[^>]*>/gi;
        const images: string[] = cleanContent.match(imgRegex) || [];
        const imagesWithAlt = images.filter(img =>
            img.includes('alt=') && !img.includes('alt=""') && !img.includes("alt=''")
        ).length;

        const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi;
        const links: string[] = [];
        let match;
        while ((match = linkRegex.exec(cleanContent)) !== null) {
            links.push(match[1]);
        }
        const internalLinks = links.filter(link => link.startsWith(siteUrl) || link.startsWith('/')).length;
        const externalLinks = links.length - internalLinks;

        const technicalAnalysis: TechnicalAnalysis = {
            hasCanonical: !!post.canonicalUrl,
            hasSchema: !!post.schemaMarkup,
            imageAltTags: {
                total: images.length,
                withAlt: imagesWithAlt
            },
            internalLinks,
            externalLinks
        };

        // 3. Technical Suggestions
        const technicalSuggestions: string[] = [];
        if (internalLinks === 0) technicalSuggestions.push('Thiếu liên kết nội bộ (Internal links).');
        if (images.length === 0) technicalSuggestions.push('Hãy thêm ít nhất một hình ảnh minh họa.');
        if (imagesWithAlt < images.length) technicalSuggestions.push('Hãy thêm Alt tag cho tất cả hình ảnh.');
        if (!technicalAnalysis.hasSchema) technicalSuggestions.push('Chưa cấu hình Schema Markup.');

        // 4. Word Count & Heading Structure (Recalculate or extract from Yoast if needed)
        // We'll calculate word count manually to populate the specific field
        const cleanText = this.stripHtml(cleanContent);
        const words = cleanText.split(/\s+/).filter(w => w.length > 0);
        const wordCount = words.length;

        const h1Count = (cleanContent.match(/<h1/gi) || []).length;
        const h2Count = (cleanContent.match(/<h2/gi) || []).length;
        const h3Count = (cleanContent.match(/<h3/gi) || []).length;

        // Helper to check valid heading structure
        const validHeadings = h1Count === 1; // Simplified check

        // 5. Construct Result
        // We defer to Yoast for the Score and Text Suggestions

        return {
            overallScore: seoScore,
            titleAnalysis: {
                length: post.metaTitle?.length || post.title?.length || 0,
                hasKeyword: false,
                suggestions: []
            },
            metaAnalysis: {
                length: post.metaDescription?.length || 0,
                hasKeyword: false,
                suggestions: []
            },
            contentAnalysis: {
                wordCount,
                keywordDensity: keywordDensity,
                readabilityScore: readabilityScore,
                headingStructure: {
                    h1: h1Count,
                    h2: h2Count,
                    h3: h3Count,
                    valid: validHeadings
                },
                paragraphCount: 0
            },
            technicalAnalysis,
            suggestions: [
                ...technicalSuggestions
            ]
        };
    }

    /**
     * Helper for legacy calls or internal uses
     */
    private analyzeComprehensiveSync(post: Post, siteUrl: string): ComprehensiveSeoAnalysis {
        return this.analyzeComprehensive(post, siteUrl);
    }

    /**
     * Tự động tạo Meta Title & Description từ nội dung
     */
    generateMeta(title: string, content: string): { metaTitle: string; metaDescription: string } {
        const cleanText = this.stripHtml(content);

        // Meta Title: Title + Suffix
        let metaTitle = title;
        if (metaTitle.length > 60) metaTitle = metaTitle.substring(0, 57) + '...';

        // Meta Description: First 150-160 chars
        let metaDescription = cleanText.substring(0, 160).trim();
        if (cleanText.length > 160) metaDescription += '...';

        return { metaTitle, metaDescription };
    }

    private stripHtml(html: string): string {
        return html ? html.replace(/<[^>]*>?/gm, '') : '';
    }
}
