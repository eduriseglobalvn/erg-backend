import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ApiKeyService } from '../services/api-key.service';
import { StorageService } from '@/shared/services/storage.service';
import { ImageGenService } from '../services/image-gen.service';
import { AiContentService } from '../services/ai-content.service';
import { SeoAnalyzerService } from '@/modules/seo/services/seo-analyzer.service';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import { EntityManager } from '@mikro-orm/core';
import slugify from 'slugify';

import { Post } from '@/modules/posts/entities/post.entity';
import { PostCategory } from '@/modules/posts/entities/post-category.entity';
import { User } from '@/modules/users/entities/user.entity';
import { PostStatus } from '@/shared/enums/app.enum';

// [UPDATE 1] Định nghĩa Style chuẩn cho ảnh Blog (Giúp ảnh nhìn thật, không bị hoạt hình)
const IMAGE_STYLE_SUFFIX = ", photorealistic, cinematic lighting, 8k resolution, highly detailed, depth of field, professional photography, soft natural light --no text";

@Processor('ai-content-queue')
export class AiGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiGenerationProcessor.name);

  constructor(
    private apiKeyService: ApiKeyService,
    private storageService: StorageService,
    private imageGenService: ImageGenService,
    private aiContentService: AiContentService,
    private seoAnalyzerService: SeoAnalyzerService,
    private configService: ConfigService,
    private readonly em: EntityManager,
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

  private async handleRefineContent(job: Job<any>): Promise<any> {
    const { content, instruction, userId } = job.data;
    const em = this.em.fork();

    try {
      const user = em.getReference(User, userId);
      const refinedText = await this.aiContentService.refineText(content, instruction, user);

      await job.updateProgress(100);

      return {
        refinedContent: refinedText,
        status: 'completed'
      };
    } catch (error) {
      this.logger.error(`Refine Job Failed: ${error.message}`);
      throw error;
    }
  }

  private async handleGeneratePost(job: Job<any>): Promise<any> {
    const em = this.em.fork();
    let currentApiKey = '';

    try {
      const { topic, userId, categoryId } = job.data;
      this.logger.log(`[Job ${job.id}] Processing Topic: ${topic}`);

      // 1. Lấy dữ liệu
      const user = em.getReference(User, userId);
      const category = await em.findOne(PostCategory, { id: categoryId } as any);
      if (!category) throw new Error('Category not found');

      // 2. Lấy Key
      const apiKeyEntity = await this.apiKeyService.getAvailableKey(user);
      currentApiKey = apiKeyEntity.key;

      // 3. Gọi Gemini tạo nội dung
      const modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-3-flash-preview';
      const genAI = new GoogleGenerativeAI(currentApiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      // [UPDATE 2] PROMPT NÂNG CAO: Tách biệt ngôn ngữ (Việt) và Image Prompt (Anh)
      const prompt = `
          Bạn là một Senior Content Writer và Art Director chuyên nghiệp.
          
          NHIỆM VỤ:
          Viết một bài blog chi tiết, chuyên sâu về chủ đề: "${topic}".
          
          QUY TẮC NGÔN NGỮ (QUAN TRỌNG NHẤT):
          1.  **Nội dung bài viết (Title, Excerpt, HTML):** Viết hoàn toàn bằng **TIẾNG VIỆT**.
          2.  **Mô tả hình ảnh (Prompt trong thẻ placeholder):** Viết hoàn toàn bằng **TIẾNG ANH (English)**.
          
          YÊU CẦU VỀ HÌNH ẢNH (ART DIRECTION):
          - Đừng viết prompt ngắn cũn cỡn (Ví dụ SAI: "Laptop").
          - Hãy viết prompt chi tiết để AI vẽ ảnh hiểu được bối cảnh.
          - Công thức prompt: [Subject] + [Action] + [Context/Background] + [Lighting/Mood].
          - Ví dụ ĐÚNG: "A focused software engineer typing on a laptop with matrix code on screen, dark modern office background, neon blue and purple lighting, cinematic, photorealistic".

          YÊU CẦU CẤU TRÚC JSON OUTPUT:
          {
            "title": "Tiêu đề tiếng Việt chuẩn SEO, giật tít hấp dẫn",
            "excerpt": "Đoạn sapo tiếng Việt ngắn 2-3 câu",
            "thumbnailPrompt": "Mô tả ảnh nền (Hero Image) thu hút cho bài viết bằng TIẾNG ANH",
            "tableOfContents": [
               { "id": "slug-muc-1", "title": "1. Tiêu đề mục 1", "level": 2 }
            ],
            "htmlContent": "Nội dung HTML tiếng Việt. Các thẻ <h2> phải có id khớp với tableOfContents. Sau mỗi phần quan trọng, chèn thẻ <image-placeholder prompt='Mô tả ảnh bằng TIẾNG ANH ở đây...' />."
          }
      `;

      const result = await model.generateContent(prompt);
      const cleanJson = result.response.text().replace(/```json|```/g, '').trim();

      // Log usage after success
      await this.apiKeyService.logUsage(apiKeyEntity.id);

      let aiData;
      try {
        aiData = JSON.parse(cleanJson);
      } catch (e) {
        throw new Error('AI Response JSON Syntax Error');
      }

      await job.updateProgress(40);

      // --- 4. XỬ LÝ HÌNH ẢNH ---
      const postSlug = slugify(aiData.title, { lower: true, strict: true });
      let thumbnailUrl: string | null = null;

      // A. Tạo Thumbnail (Hero Image)
      if (aiData.thumbnailPrompt) {
        try {
          const finalThumbPrompt = `${aiData.thumbnailPrompt} ${IMAGE_STYLE_SUFFIX}`;
          const thumbBuffer = await this.imageGenService.generateImage(finalThumbPrompt);
          const thumbFileName = `posts/${postSlug}/thumbnail-${uuidv4().slice(0, 4)}`;
          thumbnailUrl = await this.storageService.processAndUpload(thumbBuffer, 'posts', thumbFileName);
        } catch (err) {
          this.logger.error(`Thumbnail Gen Failed: ${err.message}`);
        }
      }

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

      // Xử lý song song hoặc tuần tự
      for (const match of imagesToProcess) {
        const originalTag = match[0];
        let imagePrompt = match[1]; // Prompt gốc từ Gemini (Tiếng Anh)

        try {
          // [UPDATE 3] Cộng thêm Style Suffix để ảnh đẹp hơn
          const finalPrompt = `${imagePrompt} ${IMAGE_STYLE_SUFFIX}`;

          // A. Worker AI vẽ (nhận Buffer)
          const imgBuffer = await this.imageGenService.generateImage(finalPrompt);

          // B. Upload R2 (Resize -> WebP)
          const fileName = `posts/${postSlug}/image-${uuidv4().slice(0, 4)}`;
          const publicUrl = await this.storageService.processAndUpload(imgBuffer, 'posts', fileName);

          // C. Replace HTML
          const imgHtml = `
            <figure class="my-6">
              <img src="${publicUrl}" alt="${imagePrompt}" class="w-full rounded-lg shadow-md" loading="lazy" />
              <figcaption class="text-center text-sm text-gray-500 mt-2 italic">${imagePrompt}</figcaption>
            </figure>
          `;
          processedHtml = processedHtml.replace(originalTag, imgHtml);

        } catch (err) {
          this.logger.error(`Image Gen Failed (${imagePrompt}): ${err.message}`);
          processedHtml = processedHtml.replace(originalTag, ''); // Lỗi thì xóa placeholder
        }
      }

      await job.updateProgress(90);

      // --- 5. SEO & SAVE ---
      // [UPDATE 4] Tính điểm SEO & Tạo Meta
      const seoAnalysis = this.seoAnalyzerService.analyze(processedHtml, topic);
      const autoMeta = this.seoAnalyzerService.generateMeta(aiData.title, processedHtml);

      // 5. Lưu Database
      const uniqueSlug = slugify(aiData.title, { lower: true, strict: true }) + '-' + uuidv4().slice(0, 4);

      const newPost = em.create(Post, {
        title: aiData.title,
        slug: uniqueSlug,
        excerpt: aiData.excerpt,
        content: processedHtml,

        // Lưu TOC vào meta
        meta: {
          toc: aiData.tableOfContents,
          aiJobId: job.id
        },

        status: PostStatus.DRAFT,
        category: category,
        thumbnailUrl: thumbnailUrl,
        author: user,
        createdBy: user,
        isCreatedByAI: true,
        aiPrompt: topic,
        isPublished: false,

        viewCount: 0,
        commentCount: 0,

        // SEO Fields
        seoScore: seoAnalysis.score,
        focusKeyword: topic,
        metaTitle: autoMeta.metaTitle,
        metaDescription: autoMeta.metaDescription,
      });

      await em.persistAndFlush(newPost);
      await job.updateProgress(100);

      return {
        postId: newPost.id,
        slug: newPost.slug,
        status: 'completed'
      };

    } catch (error) {
      this.logger.error(`Generate Post Job Failed: ${error.message}`);
      if (currentApiKey && (error.message.includes('429') || error.message.includes('Quota'))) {
        await this.apiKeyService.reportError(currentApiKey, error);
      }
      throw error;
    }
  }
}