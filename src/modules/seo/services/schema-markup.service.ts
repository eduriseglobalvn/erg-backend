import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Post } from '@/modules/posts/entities/post.entity';
import { PostCategory } from '@/modules/posts/entities/post-category.entity';

interface SiteConfig {
    name: string;
    url: string;
    logo: string;
    description?: string;
    socialProfiles?: string[];
}

@Injectable()
export class SchemaMarkupService {
    private siteConfig: SiteConfig;

    constructor(private configService: ConfigService) {
        this.siteConfig = {
            name: this.configService.get('SITE_NAME', 'EDURISE GLOBAL'),
            url: this.configService.get('SITE_URL', 'https://erg.edu.vn'),
            logo: this.configService.get('SITE_LOGO', 'https://erg.edu.vn/logo.png'),
            description: this.configService.get('SITE_DESCRIPTION'),
            socialProfiles: [
                'https://facebook.com/eduriseglobal',
                'https://twitter.com/ergvietnam',
                'https://linkedin.com/company/edurise-global',
            ],
        };
    }

    /**
     * Generate complete schema graph for a post
     */
    generateSchemaGraph(post: Post, baseUrl?: string): any {
        const url = baseUrl || this.siteConfig.url;
        const schemas: any[] = [];

        // Always include Organization
        schemas.push(this.generateOrganizationSchema());

        // Always include WebPage
        schemas.push(this.generateWebPageSchema(post));

        // Always include Breadcrumb
        schemas.push(this.generateBreadcrumbSchema(post));

        // Article schema (main content)
        if (post.schemaType || !post.schemaType) {
            schemas.push(this.generateArticleSchema(post));
        }

        // FAQ schema if faqItems exist
        if (post.faqItems && post.faqItems.length > 0) {
            schemas.push(this.generateFAQSchema(post.faqItems));
        }

        // HowTo schema if howToSteps exist
        if (post.howToSteps && post.howToSteps.length > 0) {
            schemas.push(this.generateHowToSchema(post.howToSteps, post));
        }

        // Custom Advanced Schema if schemaData exists
        if (post.schemaData) {
            const customSchema = this.generateCustomAdvancedSchema(post.schemaData, post);
            if (customSchema) {
                schemas.push(customSchema);
            }
        }

        return {
            '@context': 'https://schema.org',
            '@graph': schemas,
        };
    }

    /**
     * Generate Article schema
     */
    generateArticleSchema(post: Post, baseUrl?: string): any {
        const url = baseUrl || this.siteConfig.url;
        const postUrl = `${url}/posts/${post.slug}`;

        const schemaType = post.schemaType || 'Article';
        const isNews = schemaType === 'NewsArticle' || post.category?.slug?.includes('tin-tuc');

        const articleSchema: any = {
            '@type': schemaType,
            '@id': `${postUrl}#article`,
            headline: post.title,
            description: post.metaDescription || post.excerpt,
            image: post.thumbnailUrl ? {
                '@type': 'ImageObject',
                url: post.thumbnailUrl,
                width: 1200,
                height: 630,
            } : undefined,
            datePublished: post.publishedAt?.toISOString() || post.createdAt.toISOString(),
            dateModified: post.updatedAt.toISOString(),
            author: { // Author Person
                '@type': 'Person',
                '@id': `${url}/author/${post.author?.id || 'erg'}#person`,
                name: post.author?.fullName || 'Edurise Global',
                url: `${url}/author/${post.author?.id || 'erg'}`,
            },
            publisher: {
                '@type': 'Organization',
                '@id': `${url}/#organization`,
            },
            mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': postUrl,
            },
            keywords: post.keywords || post.focusKeyword,
            articleSection: post.category?.name || 'Blog',
            inLanguage: 'vi-VN',
        };

        // [D1, D7] Integrate AggregateRating schema if applicable (>= 3 reviews & Not a NewsArticle)
        const rating = (post as any).rating;
        const recentReviews: any[] = (post as any).recentReviews;

        if (!isNews && rating && rating.count >= 3) {
            articleSchema.aggregateRating = {
                '@type': 'AggregateRating',
                ratingValue: rating.average,
                reviewCount: rating.count,
                bestRating: '5',
                worstRating: '1',
            };

            if (recentReviews && recentReviews.length > 0) {
                articleSchema.review = recentReviews.map(r => ({
                    '@type': 'Review',
                    reviewRating: {
                        '@type': 'Rating',
                        ratingValue: r.rating,
                        bestRating: '5',
                        worstRating: '1',
                    },
                    author: {
                        '@type': 'Person',
                        name: r.userName || r.user?.fullName || 'Anonymous'
                    },
                    reviewBody: r.comment || '',
                    datePublished: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : undefined
                }));
            }
        }

        return articleSchema;
    }

    /**
     * Generate Breadcrumb schema with full tree hierarchy
     */
    generateBreadcrumbSchema(post: Post): any {
        const postUrl = `${this.siteConfig.url}/posts/${post.slug}`;

        let currentCategory = post.category;
        const categoryPath: Array<{ name: string, url: string }> = [];

        // Build path backwards
        while (currentCategory) {
            categoryPath.unshift({
                name: currentCategory.name,
                url: `${this.siteConfig.url}/${currentCategory.slug}`
            });
            // Assuming category entity can have parent (e.g., currentCategory.parent)
            // If the entity doesn't officially load it right now, it will at least include the main category
            currentCategory = (currentCategory as any).parent || null;
        }

        const itemListElement = [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Trang chủ',
                item: this.siteConfig.url,
            }
        ];

        let position = 2;
        for (const cat of categoryPath) {
            itemListElement.push({
                '@type': 'ListItem',
                position: position,
                name: cat.name,
                item: cat.url,
            });
            position++;
        }

        // Add the post itself
        itemListElement.push({
            '@type': 'ListItem',
            position: position,
            name: post.breadcrumbTitle || post.title,
            item: postUrl,
        } as any);

        return {
            '@type': 'BreadcrumbList',
            '@id': `${postUrl}#breadcrumb`,
            itemListElement,
        };
    }

    /**
     * Generate Organization schema
     */
    generateOrganizationSchema(): any {
        return {
            '@type': 'Organization',
            '@id': `${this.siteConfig.url}/#organization`,
            name: this.siteConfig.name,
            url: this.siteConfig.url,
            logo: {
                '@type': 'ImageObject',
                url: this.siteConfig.logo,
            },
            description: this.siteConfig.description,
            sameAs: this.siteConfig.socialProfiles,
        };
    }

    /**
     * Generate Hreflang tags data (Task 4.2.6)
     * For multi-language SEO, returns an array of object mappings for Head tags
     */
    generateHreflangTags(post: Post): any[] {
        const languagesStr = this.configService.get<string>('SUPPORTED_LANGUAGES', 'vi-VN,en-US');
        const supportedLanguages = languagesStr.split(',').map(l => l.trim());
        const baseUrl = `${this.siteConfig.url}/posts`;
        const hreflangs: Array<{ rel: string, hreflang: string, href: string }> = [];

        // Default (x-default) pointing to the original post (typically Vietnamese)
        hreflangs.push({
            rel: 'alternate',
            hreflang: 'x-default',
            href: `${baseUrl}/${post.slug}`
        });

        // Depending on language implementation (whether slug differs or prefix is used)
        for (const lang of supportedLanguages) {
            let href = `${baseUrl}/${post.slug}`;
            // If it's not the default Vietnamese, we assume a language prefix in the route for this example
            if (lang !== 'vi-VN') {
                const langPrefix = lang.split('-')[0]; // e.g., 'en'
                href = `${this.siteConfig.url}/${langPrefix}/posts/${post.slug}`;
            }

            hreflangs.push({
                rel: 'alternate',
                hreflang: lang,
                href: href
            });
        }

        return hreflangs;
    }

    /**
     * Generate WebPage schema
     */
    generateWebPageSchema(post: Post, baseUrl?: string): any {
        const url = baseUrl || this.siteConfig.url;
        const postUrl = `${url}/posts/${post.slug}`;

        return {
            '@type': 'WebPage',
            '@id': postUrl,
            url: postUrl,
            name: post.title,
            description: post.metaDescription || post.excerpt,
            isPartOf: {
                '@type': 'WebSite',
                '@id': `${this.siteConfig.url}/#website`,
                name: this.siteConfig.name,
                url: this.siteConfig.url,
            },
            primaryImageOfPage: post.thumbnailUrl ? {
                '@type': 'ImageObject',
                url: post.thumbnailUrl,
            } : undefined,
            datePublished: post.publishedAt?.toISOString() || post.createdAt.toISOString(),
            dateModified: post.updatedAt.toISOString(),
            inLanguage: 'vi-VN',
        };
    }

    /**
     * Generate FAQ schema
     */
    generateFAQSchema(faqItems: Array<{ question: string; answer: string }>): any {
        return {
            '@type': 'FAQPage',
            mainEntity: faqItems.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: item.answer,
                },
            })),
        };
    }

    /**
     * Generate HowTo schema
     */
    generateHowToSchema(
        steps: Array<{ name: string; text: string; image?: string; url?: string }>,
        post: Post,
    ): any {
        return {
            '@type': 'HowTo',
            name: post.title,
            description: post.metaDescription || post.excerpt,
            image: post.thumbnailUrl ? {
                '@type': 'ImageObject',
                url: post.thumbnailUrl,
            } : undefined,
            step: steps.map((step, index) => ({
                '@type': 'HowToStep',
                position: index + 1,
                name: step.name,
                text: step.text,
                image: step.image ? {
                    '@type': 'ImageObject',
                    url: step.image,
                } : undefined,
                url: step.url,
            })),
        };
    }

    /**
     * Generate Course schema
     */
    generateCourseSchema(course: any, baseUrl?: string): any {
        const url = baseUrl || this.siteConfig.url;
        const schema: any = {
            '@type': 'Course',
            name: course.title, // course.title in new entity
            description: course.metaDescription || course.summary || course.title,
            provider: {
                '@type': 'Organization',
                '@id': `${url}/#organization`,
                name: 'Edurise Global'
            },
        };

        if (course.code) schema.courseCode = course.code;
        if (course.educationalLevel) schema.educationalLevel = course.educationalLevel;
        if (course.inLanguage) schema.inLanguage = course.inLanguage;

        // F2.1: Add hasCourseInstance
        schema.hasCourseInstance = {
            '@type': 'CourseInstance',
            courseMode: course.courseMode || 'Online',
        };
        if (course.courseWorkload) schema.hasCourseInstance.courseWorkload = course.courseWorkload;
        if (course.instructorName) {
            schema.hasCourseInstance.instructor = {
                '@type': 'Person',
                name: course.instructorName
            };
        }

        // Offers Price
        if (course.offersPrice !== undefined && course.offersPrice !== null) {
            schema.offers = {
                '@type': 'Offer',
                price: course.offersPrice,
                priceCurrency: course.offersCurrency || 'VND',
                category: 'Course'
            };
        }

        // AggregateRating
        if (course.averageRating && course.totalReviews && course.totalReviews > 0) {
            schema.aggregateRating = {
                '@type': 'AggregateRating',
                ratingValue: course.averageRating,
                reviewCount: course.totalReviews,
                bestRating: '5',
                worstRating: '1',
            };
        }

        return schema;
    }

    /**
     * Generate JobPosting schema (for recruitment module)
     */
    generateJobPostingSchema(job: any, baseUrl?: string): any {
        const url = baseUrl || this.siteConfig.url;
        const schema: any = {
            '@type': 'JobPosting',
            title: job.title,
            description: job.summary || job.title,
            datePosted: job.postDate || job.createdAt?.toISOString() || new Date().toISOString(),
            hiringOrganization: {
                '@type': 'Organization',
                '@id': `${url}/#organization`,
                name: 'Edurise Global'
            },
            jobLocation: {
                '@type': 'Place',
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: job.city || job.location, // fallback to old location
                    addressCountry: job.country || 'VN',
                    streetAddress: job.streetAddress,
                },
            },
        };

        // F2.2 Job specific fields
        if (job.deadlineDate) schema.validThrough = job.deadlineDate.toISOString();
        if (job.employmentType) schema.employmentType = job.employmentType; // FULL_TIME etc

        // Only add baseSalary if > 0 (F1.3 from frontend mapped back to backend API)
        if (job.salaryMin !== undefined && job.salaryMin !== null && job.salaryMin > 0) {
            schema.baseSalary = {
                '@type': 'MonetaryAmount',
                currency: job.salaryCurrency || 'VND',
                value: {
                    '@type': 'QuantitativeValue',
                    minValue: job.salaryMin,
                    maxValue: job.salaryMax || job.salaryMin,
                    unitText: 'MONTH'
                }
            };
        }

        return schema;
    }

    /**
     * Validate schema against Schema.org spec (basic validation)
     */
    validateSchema(schema: any): { valid: boolean; errors: string[]; warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!schema) {
            errors.push('Schema is empty');
            return { valid: false, errors, warnings };
        }

        if (!schema['@context']) {
            errors.push('Missing @context');
        }

        if (!schema['@type'] && !schema['@graph']) {
            errors.push('Missing @type or @graph');
        }

        // Basic warnings logic
        if (schema['@type'] === 'Article' && !schema.image) {
            warnings.push('Recommended property "image" is missing');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Generate custom advanced schema based on type and data
     */
    generateCustomAdvancedSchema(schemaData: { type: string; data: any }, post: Post): any {
        const { type, data } = schemaData;

        switch (type) {
            case 'FAQ':
                return data.questions ? this.generateFAQSchema(data.questions) : null;
            case 'HowTo':
                return data.steps ? this.generateHowToSchema(data.steps, post) : null;
            case 'Video':
                return {
                    '@type': 'VideoObject',
                    name: data.name || post.title,
                    description: data.description || post.metaDescription,
                    thumbnailUrl: data.thumbnailUrl,
                    uploadDate: data.uploadDate || post.createdAt,
                    contentUrl: data.contentUrl,
                    embedUrl: data.embedUrl,
                };
            case 'Course':
                return {
                    '@type': 'Course',
                    name: data.name || post.title,
                    description: data.description || post.metaDescription,
                    provider: {
                        '@type': 'Organization',
                        name: this.siteConfig.name,
                        sameAs: this.siteConfig.url,
                    },
                };
            case 'LocalBusiness':
                return {
                    '@type': 'LocalBusiness',
                    name: data.name || this.siteConfig.name,
                    image: data.image || this.siteConfig.logo,
                    address: data.address,
                    telephone: data.telephone,
                };
            case 'Review':
                return {
                    '@type': 'Review',
                    itemReviewed: {
                        '@type': 'Thing',
                        name: data.itemName || post.title,
                    },
                    author: {
                        '@type': 'Person',
                        name: data.author || (post.author?.fullName),
                    },
                    reviewRating: {
                        '@type': 'Rating',
                        ratingValue: data.ratingValue,
                        bestRating: data.bestRating || '5',
                    },
                };
            default:
                return null;
        }
    }

    /**
     * Merge multiple schemas into a single @graph
     */
    mergeSchemas(schemas: any[]): any {
        return {
            '@context': 'https://schema.org',
            '@graph': schemas,
        };
    }
}
