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
    generateSchemaGraph(post: Post): any {
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
    generateArticleSchema(post: Post): any {
        const postUrl = `${this.siteConfig.url}/posts/${post.slug}`;

        return {
            '@type': post.schemaType || 'Article',
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
            author: {
                '@type': 'Person',
                '@id': `${this.siteConfig.url}/author/${post.author.id}#person`,
                name: post.author.fullName || 'Edurise Global',
                url: `${this.siteConfig.url}/author/${post.author.id}`,
            },
            publisher: {
                '@type': 'Organization',
                '@id': `${this.siteConfig.url}/#organization`,
            },
            mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': postUrl,
            },
            keywords: post.keywords || post.focusKeyword,
            articleSection: post.category.name,
            inLanguage: 'vi-VN',
        };
    }

    /**
     * Generate Breadcrumb schema
     */
    generateBreadcrumbSchema(post: Post): any {
        const postUrl = `${this.siteConfig.url}/posts/${post.slug}`;
        const categoryUrl = `${this.siteConfig.url}/${post.category.slug}`;

        return {
            '@type': 'BreadcrumbList',
            '@id': `${postUrl}#breadcrumb`,
            itemListElement: [
                {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Trang chủ',
                    item: this.siteConfig.url,
                },
                {
                    '@type': 'ListItem',
                    position: 2,
                    name: post.category.name,
                    item: categoryUrl,
                },
                {
                    '@type': 'ListItem',
                    position: 3,
                    name: post.breadcrumbTitle || post.title,
                },
            ],
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
     * Generate WebPage schema
     */
    generateWebPageSchema(post: Post): any {
        const postUrl = `${this.siteConfig.url}/posts/${post.slug}`;

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
     * Generate Course schema (for future use)
     */
    generateCourseSchema(course: any): any {
        return {
            '@type': 'Course',
            name: course.name,
            description: course.description,
            provider: {
                '@type': 'Organization',
                '@id': `${this.siteConfig.url}/#organization`,
            },
        };
    }

    /**
     * Generate JobPosting schema (for recruitment module)
     */
    generateJobPostingSchema(job: any): any {
        return {
            '@type': 'JobPosting',
            title: job.title,
            description: job.description,
            datePosted: job.createdAt,
            validThrough: job.expiresAt,
            employmentType: job.employmentType,
            hiringOrganization: {
                '@type': 'Organization',
                '@id': `${this.siteConfig.url}/#organization`,
            },
            jobLocation: {
                '@type': 'Place',
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: job.location,
                    addressCountry: 'VN',
                },
            },
        };
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
