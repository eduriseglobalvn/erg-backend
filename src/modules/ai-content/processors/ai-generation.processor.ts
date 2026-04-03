import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ApiKeyService } from '../services/api-key.service';
import { StorageService } from '@/shared/services/storage.service';
import { AiImageService } from '../services/ai-image.service';
import { AiContentService } from '../services/ai-content.service';
import { SeoAnalyzerService } from '@/modules/seo/services/seo-analyzer.service';
import { ConfigService } from '@nestjs/config';

import { v4 as uuidv4 } from 'uuid';
import { EntityManager } from '@mikro-orm/core';
import slugify from 'slugify';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationType, NotificationPriority } from '@/modules/notifications/entities/notification.entity';
import { SeoTitleService } from '@/modules/seo/services/seo-title.service';
import { SeoMetaService } from '@/modules/seo/services/seo-meta.service';
import { SeoImageAltService } from '@/modules/seo/services/seo-image-alt.service';
import { AutoLinkingService } from '@/modules/seo/services/auto-linking.service';
import { PostGenerationType, POST_TEMPLATES } from '../templates/post-generation.template';

import { Post } from '@/modules/posts/entities/post.entity';
import { PostCategory } from '@/modules/posts/entities/post-category.entity';
import { User } from '@/modules/users/entities/user.entity';
import { PostStatus } from '@/shared/enums/app.enum';

// [UPDATE 1] Định nghĩa Style chuẩn cho ảnh Blog (Giúp ảnh nhìn thật, không bị hoạt hình)
const IMAGE_STYLE_SUFFIX = ", photorealistic, cinematic lighting, 8k resolution, highly detailed, depth of field, professional photography, soft natural light --no text";

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SchemaMarkupService } from '@/modules/seo/services/schema-markup.service';
import { Inject } from '@nestjs/common';

@Processor('ai-content-queue')
export class AiGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiGenerationProcessor.name);

  constructor(
    private apiKeyService: ApiKeyService,
    private storageService: StorageService,
    private aiImageService: AiImageService,
    private aiContentService: AiContentService,
    private seoAnalyzerService: SeoAnalyzerService,
    private configService: ConfigService,
    private readonly em: EntityManager,
    private readonly schemaMarkupService: SchemaMarkupService,
    private readonly notificationsService: NotificationsService,
    private readonly seoTitleService: SeoTitleService,
    private readonly seoMetaService: SeoMetaService,
    private readonly seoImageAltService: SeoImageAltService,
    private readonly autoLinkingService: AutoLinkingService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'generate-post':
        return this.handleGeneratePost(job);
      case 'refine-content':
        return this.handleRefineContent(job);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private parseAiResponse(raw: string): any {
    try {
      let clean = raw.replace(/```json|```/g, '').trim();
      clean = clean.replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(clean);
    } catch (e) {
      this.logger.error(`AI JSON Parse Error. Raw: ${raw.substring(0, 100)}...`);
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0].replace(/,\s*([\]}])/g, '$1'));
      } catch (e2) { }
      throw new Error(`AI Response JSON Syntax Error: ${e.message}`);
    }
  }

  private processContentWithTOC(content: string): { content: string; toc: any[] } {
    if (!content) return { content: '', toc: [] };
    const toc: any[] = [];
    const headerRegex = /<(h[23])([^>]*)>(.*?)<\/\1>/gi;
    let newContent = content.replace(headerRegex, (match, tag, attrs, text) => {
      const idMatch = attrs.match(/id=["']([^"']*)["']/);
      let id = idMatch ? idMatch[1] : null;
      const plainText = text.replace(/<[^>]*>/g, '').trim();
      if (!id) {
        id = slugify(plainText, { lower: true, strict: true }) || `heading-${Math.random().toString(36).substr(2, 5)}`;
        attrs = attrs.trim() === '' ? ` id="${id}"` : ` id="${id}"` + attrs;
      }
      toc.push({ id, text: plainText, level: tag === 'h2' ? 2 : 3 });
      return `<${tag}${attrs}>${text}</${tag}>`;
    });
    return { content: newContent, toc };
  }

  private async handleRefineContent(job: Job<any>): Promise<any> {
    const { content, instruction, userId } = job.data;
    const em = this.em.fork();
    try {
      const user = em.getReference(User, userId);
      const refinedText = await this.aiContentService.refineText(content, instruction, user);
      await job.updateProgress(100);
      await this.notificationsService.create({
        userId,
        type: NotificationType.AI_REFINE_COMPLETED,
        title: 'Tinh chỉnh nội dung AI thành công',
        message: 'Nội dung của bạn đã được refine xong.',
        metadata: { jobId: job.id },
      });
      return { refinedContent: refinedText, status: 'completed' };
    } catch (error) {
      this.logger.error(`Refine Job Failed: ${error.message}`);
      await this.notificationsService.create({
        userId,
        type: NotificationType.AI_REFINE_FAILED,
        title: 'Tinh chỉnh nội dung AI thất bại',
        message: `Lỗi: ${error.message}`,
        priority: NotificationPriority.HIGH,
        metadata: { jobId: job.id, error: error.message },
      });
      throw error;
    }
  }

  private async handleGeneratePost(job: Job<any>): Promise<any> {
    const em = this.em.fork();
    const { topic, userId, categoryId, template: templateType = PostGenerationType.INFORMATIVE } = job.data;

    try {
      this.logger.log(`[Job ${job.id}] Processing Topic: ${topic} with template: ${templateType}`);

      // 1. Lấy dữ liệu
      const user = em.getReference(User, userId);
      const category = await em.findOne(PostCategory, { id: categoryId } as any);
      if (!category) throw new Error('Category not found');

      // 2. Load Template
      const template = POST_TEMPLATES[templateType as PostGenerationType] || POST_TEMPLATES[PostGenerationType.INFORMATIVE];
      const prompt = `
          ${template.systemPrompt}
          
          NHIỆM VỤ:
          ${template.userPromptTemplate.replace('{keyword}', topic)}
          
          QUY TẮC NGÔN NGỮ:
          1. Nội dung bài viết (Title, Summary, HTML): Viết hoàn toàn bằng TIẾNG VIỆT.
          2. Mô tả hình ảnh (Prompt): Viết hoàn toàn bằng TIẾNG ANH (English).
          
          YÊU CẦU SEO & CẤU TRÚC:
          - Sử dụng các thẻ Heading (h2, h3) chuẩn.
          - Nội dung chi tiết, độ dài khoảng 1000-1500 từ.
          - Chèn <image-placeholder prompt="..." /> ở vị trí thích hợp.

          YÊU CẦU JSON:
          ${template.formatInstructions}
          Bổ sung thêm:
          - thumbnailPrompt: Mô tả ảnh nền bằng TIẾNG ANH.
          - excerpt: Đoạn sapo tiếng Việt ngắn.
          - tableOfContents: array { id, title, level }.
      `;

      const rawResult = await this.aiContentService.generateWithFallback(prompt, user, { maxTokens: 8192 });
      const aiData = this.parseAiResponse(rawResult);

      // Đồng bộ hóa các trường (AI có thể trả về content thay vì htmlContent tùy template)
      if (!aiData.htmlContent && aiData.content) aiData.htmlContent = aiData.content;
      if (!aiData.excerpt && aiData.summary) aiData.excerpt = aiData.summary;
      if (!aiData.excerpt && aiData.description) aiData.excerpt = aiData.description;

      await job.updateProgress(40);

      // --- 4. XỬ LÝ HÌNH ẢNH ---
      const postSlug = slugify(aiData.title, { lower: true, strict: true });
      let thumbnailUrl: string | null = null;

      // A. Tạo Thumbnail (Hero Image)
      const thumbnailPromise = async () => {
        if (aiData.thumbnailPrompt) {
          try {
            const finalThumbPrompt = `${aiData.thumbnailPrompt} ${IMAGE_STYLE_SUFFIX} `;
            const thumbBuffer = await this.aiImageService.generateImage(finalThumbPrompt, user, { width: 1200, height: 630, quality: 'standard' });
            const thumbFileName = `posts/${postSlug}/thumbnail-${uuidv4().slice(0, 4)}`;
            thumbnailUrl = await this.storageService.processAndUpload(thumbBuffer, 'posts', thumbFileName);
          } catch (err) {
            this.logger.error(`Thumbnail Gen Failed: ${err.message}`);
          }
        }
      };

      // B. Xử lý ảnh trong Content (LIMIT 4 ẢNH)
      let processedHtml = aiData.htmlContent;
      const matches = [...processedHtml.matchAll(/<image-placeholder prompt=['"](.*?)['"]\s*\/?>/g)];

      // Chỉ lấy tối đa 4 ảnh đầu tiên
      const maxImages = 4;
      const imagesToProcess = matches.slice(0, maxImages);

      // Xóa các thẻ placeholder thừa (từ cái thứ 5 trở đi)
      for (let i = maxImages; i < matches.length; i++) {
        processedHtml = processedHtml.replace(matches[i][0], '');
      }

      // Xử lý song song (Promise.all) — 4 ảnh chạy đồng thời
      const contentImagesPromise = async () => {
        const imageResults = await Promise.all(
          imagesToProcess.map(async (match) => {
            const originalTag = match[0];
            const imagePrompt = match[1];

            try {
              const finalPrompt = `${imagePrompt} ${IMAGE_STYLE_SUFFIX}`;
              const imgBuffer = await this.aiImageService.generateImage(finalPrompt, user, { width: 1200, height: 630, quality: 'standard' });
              const fileName = `posts/${postSlug}/image-${uuidv4().slice(0, 4)}`;
              const publicUrl = await this.storageService.processAndUpload(imgBuffer, 'posts', fileName);
              const altText = await this.seoImageAltService.generateSingleAltText(processedHtml, topic, publicUrl, user);
              const imgHtml = `
              <figure class="my-8">
                <img src="${publicUrl}" alt="${altText}" title="${aiData.title}" class="w-full rounded-xl shadow-lg border border-gray-100" loading="lazy" />
                <figcaption class="text-center text-sm text-gray-500 mt-3 italic font-medium">${altText}</figcaption>
              </figure>
            `;
              return { originalTag, imgHtml };
            } catch (err) {
              this.logger.error(`Image Gen Failed (${imagePrompt}): ${err.message}`);
              return { originalTag, imgHtml: '' };
            }
          })
        );

        for (const { originalTag, imgHtml } of imageResults) {
          processedHtml = processedHtml.replace(originalTag, imgHtml);
        }
      };

      // Chạy cả Thumbnail và Content Images cùng lúc
      await Promise.all([thumbnailPromise(), contentImagesPromise()]);

      await job.updateProgress(90);

      // --- 5. PREMIUM SEO OPTIMIZATION ---
      const appUser = await em.findOne(User, { id: userId });

      // A. Generate High-Quality Metadata
      const [finalTitles, finalMetas] = await Promise.all([
        this.seoTitleService.generateTitles(topic, processedHtml, appUser as User),
        this.seoMetaService.generateMetaDescriptions(topic, processedHtml, appUser as User)
      ]);

      const metaTitle = finalTitles[0]?.title || aiData.title;
      const metaDescription = finalMetas[0]?.description || aiData.excerpt;

      // B. Final Content Polish (Auto-linking)
      const linkResult = await this.autoLinkingService.applyAutoLinks(processedHtml, ""); // temporary
      processedHtml = linkResult.updatedContent;

      const { content: finalContent, toc } = this.processContentWithTOC(processedHtml);
      const seoAnalysis = this.seoAnalyzerService.analyze(finalContent, topic);

      // Replicating PostsService.create logic
      const post = em.create(Post, {
        title: aiData.title,
        slug: slugify(aiData.title, { lower: true, strict: true }) + '-' + uuidv4().slice(0, 4),
        excerpt: aiData.excerpt,
        content: finalContent,
        category,
        author: user,
        createdBy: user,
        status: PostStatus.DRAFT,
        isCreatedByAI: true,
        aiPrompt: topic,
        aiJobId: job.id,
        thumbnailUrl: thumbnailUrl || undefined,
        seoScore: seoAnalysis.score,
        focusKeyword: topic,
        metaTitle,
        metaDescription,
        meta: { toc, aiJobId: job.id }
      } as any);

      // Generate Schema
      post.schemaMarkup = this.schemaMarkupService.generateSchemaGraph(post);

      await em.persistAndFlush(post);
      this.logger.log(`[Job ${job.id}] ✅ Created Post: ${post.id}`);

      // Invalidate Cache
      await this.cacheManager.del('posts:list:*').catch(() => { });
      await this.cacheManager.del('CACHE_POSTS_ALL').catch(() => { });

      await this.notificationsService.create({
        userId,
        type: NotificationType.AI_POST_COMPLETED,
        title: 'Tạo bài viết AI thành công',
        message: `Bài viết "${aiData.title}" đã được tạo xong.`,
        actionUrl: `/admin/posts/${post.id}/edit`,
        metadata: { jobId: job.id, postId: post.id }
      });

      await job.updateProgress(100);
      return { postId: post.id, slug: post.slug, status: 'completed' };

    } catch (error) {
      this.logger.error(`Generate Post Failed: ${error.message}`);
      await this.notificationsService.create({
        userId,
        type: NotificationType.AI_POST_FAILED,
        title: 'Tạo bài viết AI thất bại',
        message: error.message,
        priority: NotificationPriority.HIGH,
        metadata: { jobId: job.id, error: error.message }
      });
      throw error;
    }
  }
}