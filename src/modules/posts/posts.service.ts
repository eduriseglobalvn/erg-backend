import { Injectable, NotFoundException, OnModuleInit, Logger, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, wrap, FilterQuery, EntityManager } from '@mikro-orm/core';
import { Post } from './entities/post.entity';
import { PostCategory } from './entities/post-category.entity';
import { User } from '@/modules/users/entities/user.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { CreateCategoryDto } from '@/modules/posts/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/posts/dto/update-category.dto';
import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';
import { PostStatus } from '@/shared/enums/app.enum';
import { SeoAnalyzerService } from '@/modules/seo/services/seo-analyzer.service';

@Injectable()
export class PostsService implements OnModuleInit {
  private readonly logger = new Logger(PostsService.name);
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: EntityRepository<Post>,
    @InjectRepository(PostCategory)
    private readonly categoryRepository: EntityRepository<PostCategory>,
    private readonly em: EntityManager,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly seoAnalyzerService: SeoAnalyzerService,
  ) { }

  private async clearPostsCache() {
    try {
      // Assuming Redis store is used which supports 'keys' command
      // Safer way: Iterate or usage store-specific method. 
      // For now, we rely on the specific redis-store "keys" method if available, or just ignore if not supported (and rely on TTL).
      const store = this.cacheManager.store as any;
      if (store.keys && store.del) {
        const keys = await store.keys('CACHE_POSTS_QUERY_*');
        if (keys && keys.length > 0) {
          await store.del(keys);
          this.logger.log(`Cleared ${keys.length} post cache keys`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to clear post cache', error);
    }
  }

  private async clearCategoriesCache() {
    await this.cacheManager.del('CACHE_CATEGORIES_ALL');
  }

  async onModuleInit() {
    await this.clearCategoriesCache();
    await this.seedDefaultCategories();
  }

  private async seedDefaultCategories() {
    // Fork EM to avoid "Using global EntityManager..." error during init
    const em = this.em.fork();
    const categoryRepo = em.getRepository(PostCategory);

    const defaultCategories = [
      {
        name: 'Tin giáo dục',
        slug: 'tin-giao-duc',
        description: 'Tin tức mới nhất về giáo dục và đào tạo',
        icon: 'GraduationCap',
      },
      {
        name: 'Mẹo và thủ thuật',
        slug: 'meo-va-thu-thuat',
        description: 'Các mẹo hay và thủ thuật hữu ích',
        icon: 'Lightbulb',
      },
      {
        name: 'Hoạt động công ty',
        slug: 'hoat-dong-cong-ty',
        description: 'Tin tức và các hoạt động nội bộ của công ty',
        icon: 'Building2',
      },
    ];

    for (const cat of defaultCategories) {
      let category = await categoryRepo.findOne({ slug: cat.slug });
      if (!category) {
        category = categoryRepo.create(cat);
        await em.persistAndFlush(category);
        this.logger.log(`Created default category: ${cat.name}`);
      } else if (!category.icon) {
        // Cập nhật icon nếu chưa có
        category.icon = cat.icon;
        await em.flush();
        this.logger.log(`Updated icon for default category: ${cat.name}`);
      }
    }
  }

  // =================================================================
  // 1. TẠO BÀI VIẾT (CREATE)
  // =================================================================
  async create(createPostDto: CreatePostDto, user: any): Promise<Post> {
    // A. Xử lý Slug tự động nếu không nhập
    let finalSlug = createPostDto.slug;
    if (!finalSlug) {
      finalSlug =
        slugify(createPostDto.title, { lower: true, strict: true }) +
        '-' +
        uuidv4().slice(0, 4); // Suffix ngắn để tránh trùng lặp
    }

    // B. Kiểm tra Category
    const category = await this.categoryRepository.findOne({
      id: createPostDto.categoryId,
    });
    if (!category) throw new NotFoundException('Category not found');

    // C. Xử lý Content & TOC (Nếu có content)
    let finalContent = createPostDto.content;
    let toc: any[] = [];
    if (finalContent) {
      const processed = this.processContentWithTOC(finalContent);
      finalContent = processed.content;
      toc = processed.toc;
    }

    // Xử lý Meta (Lưu TOC vào đây)
    const meta = createPostDto.meta || {};
    meta.toc = toc;

    // D. Logic Published
    const finalStatus = createPostDto.status ?? PostStatus.DRAFT;
    const isPublishing = finalStatus === PostStatus.PUBLISHED;

    // E. Resolve User Entity (Fix lỗi 500 do truyền POJO vào quan hệ ManyToOne)
    // Vì req.user từ JWT Strategy trả về POJO, ta cần lấy Reference hoặc Query lại Entity
    const authorRef = this.em.getReference(User, user.id);

    // F. Tạo Entity
    const post = this.postRepository.create({
      id: undefined, // BaseEntity tự sinh UUID
      ...createPostDto,

      // --- CÁC TRƯỜNG QUAN TRỌNG ĐÃ FIX ---
      status: finalStatus,
      slug: finalSlug,
      category: category,
      content: finalContent,
      meta: meta,

      // Author info
      author: authorRef,
      createdBy: authorRef,

      // Publish Logic
      isPublished: isPublishing,
      publishedAt: isPublishing ? new Date() : undefined,
      publishedBy: isPublishing ? authorRef : undefined,

      // Giá trị mặc định
      viewCount: 0,
      commentCount: 0,
      isCreatedByAI: false,
      aiPrompt: undefined,
      // aiJobId: undefined, // Removed duplicate, it's already part of ...createPostDto if provided

      // AUTO-FILL SEO FIELDS IF MISSING
      seoScore: createPostDto.focusKeyword && finalContent ? this.seoAnalyzerService.analyze(finalContent, createPostDto.focusKeyword).score : 0,
      focusKeyword: createPostDto.focusKeyword,
      metaTitle: createPostDto.metaTitle || (createPostDto.title ? this.seoAnalyzerService.generateMeta(createPostDto.title, finalContent || '').metaTitle : undefined),
      metaDescription: createPostDto.metaDescription || (finalContent ? this.seoAnalyzerService.generateMeta(createPostDto.title, finalContent).metaDescription : undefined),
      keywords: createPostDto.keywords,
      canonicalUrl: createPostDto.canonicalUrl,
      schemaType: createPostDto.schemaType,
    });

    await this.postRepository.getEntityManager().persistAndFlush(post);
    await this.clearPostsCache(); // Invalidate cache
    return post;
  }

  // =================================================================
  // 1.5. QUẢN LÝ CATEGORIES (CRUD)
  // =================================================================
  async createCategory(dto: CreateCategoryDto) {
    let slug = dto.slug;
    if (!slug) {
      slug = slugify(dto.name, { lower: true, strict: true });
    }

    // Check exist
    const exist = await this.categoryRepository.findOne({ slug });
    if (exist) throw new BadRequestException('Category slug already exists');

    const cat = this.categoryRepository.create({ ...dto, slug });
    await this.categoryRepository.getEntityManager().persistAndFlush(cat);
    await this.clearCategoriesCache();
    return cat;
  }

  async findAllCategories() {
    const cacheKey = 'CACHE_CATEGORIES_ALL';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const categories = await this.categoryRepository.findAll();
    // Cache for 1 hour (3600000 ms)
    await this.cacheManager.set(cacheKey, categories, 3600000);

    return categories;
  }

  async findCategoryOne(id: string) {
    const cat = await this.categoryRepository.findOne({ id });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const cat = await this.findCategoryOne(id);
    if (dto.slug) {
      dto.slug = slugify(dto.slug, { lower: true, strict: true });
    }
    wrap(cat).assign(dto);
    await this.categoryRepository.getEntityManager().flush();
    await this.clearCategoriesCache();
    return cat;
  }

  async removeCategory(id: string) {
    const cat = await this.findCategoryOne(id);
    // Check constraints: Có bài viết nào đang dùng ko?
    const count = await this.postRepository.count({ category: cat });
    if (count > 0) throw new BadRequestException(`Cannot delete category with ${count} posts`);

    await this.categoryRepository.getEntityManager().removeAndFlush(cat);
    await this.clearCategoriesCache();
  }

  // =================================================================
  // 2. LẤY DANH SÁCH (FIND ALL - Pagination & Search)
  // =================================================================
  async findAll(query: PostQueryDto) {
    const cacheKey = `CACHE_POSTS_QUERY_${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const { page = 1, limit = 10, search, categoryId, category, status, sortBy = 'createdAt', order = 'DESC' } = query;
    const offset = (page - 1) * limit;

    const where: FilterQuery<Post> = {
      deletedAt: null, // Mặc định chỉ lấy bài chưa xóa
    };

    if (status) {
      where.status = status;
    }

    // Tìm kiếm (Title, Excerpt, Content)
    if (search) {
      where.$or = [
        { title: { $like: `%${search}%` } },
        { excerpt: { $like: `%${search}%` } },
        { content: { $like: `%${search}%` } },
      ];
    }

    // Lọc theo Category ID
    if (categoryId) {
      where.category = { id: categoryId };
    }

    // Lọc theo Category ID hoặc Slug (Tham số 'category' trong DTO)
    if (category) {
      // Logic thông minh: Check xem chuỗi truyền vào là UUID hay Slug
      // Regex check UUID v4
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category);

      if (isUUID) {
        where.category = { id: category };
      } else {
        // Là Slug
        const cat = await this.categoryRepository.findOne({ slug: category });
        if (cat) {
          where.category = cat;
        } else {
          return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
        }
      }
    }

    const [items, total] = await this.postRepository.findAndCount(where, {
      limit,
      offset,
      orderBy: { [sortBy]: order }, // Dynamic sorting
      populate: ['category', 'author'], // Join bảng để lấy thông tin
      exclude: ['content', 'meta'] as any,
    });

    const result = {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cacheManager.set(cacheKey, result, 300000); // Cache 5 min
    return result;
  }

  // =================================================================
  // 3. LẤY CHI TIẾT (FIND ONE)
  // =================================================================
  async findOne(id: string): Promise<Post> {
    const post = await this.postRepository.findOne(
      { id },
      { populate: ['category', 'author'] },
    );
    if (!post) throw new NotFoundException(`Post #${id} not found`);
    return post;
  }

  async findBySlug(slug: string): Promise<Post> {
    const post = await this.postRepository.findOne(
      { slug },
      { populate: ['category', 'author'] }, // Lấy kèm thông tin Category và Tác giả
    );

    if (!post) {
      throw new NotFoundException(`Post with slug '${slug}' not found`);
    }

    // Tăng viewCount lên 1 mỗi khi có người đọc (Tùy chọn)
    post.viewCount = (post.viewCount || 0) + 1;
    await this.postRepository.getEntityManager().flush();

    return post;
  }

  // =================================================================
  // 4. CẬP NHẬT BÀI VIẾT (UPDATE)
  // =================================================================
  async update(id: string, updatePostDto: UpdatePostDto, user?: User): Promise<Post> {
    const post = await this.findOne(id);

    // A. Xử lý Slug nếu có thay đổi
    if (updatePostDto.slug) {
      updatePostDto.slug = slugify(updatePostDto.slug, { lower: true, strict: true });
    }

    // B. Xử lý Content & TOC nếu có thay đổi content
    if (updatePostDto.content !== undefined) {
      const processed = this.processContentWithTOC(updatePostDto.content);
      updatePostDto.content = processed.content;

      // Update TOC in meta
      const meta = post.meta || {};
      meta.toc = processed.toc;

      // Merge meta back to dto or assign directly
      if (updatePostDto.meta) {
        updatePostDto.meta.toc = processed.toc;
      } else {
        updatePostDto.meta = meta;
      }
    }

    // C. Logic Đồng bộ trạng thái Published
    // Trường hợp 1: Chuyển sang PUBLISHED
    if (updatePostDto.status === PostStatus.PUBLISHED && post.status !== PostStatus.PUBLISHED) {
      post.isPublished = true;
      post.publishedAt = new Date(); // Cập nhật ngày đăng là thời điểm bấm nút
      if (user) post.publishedBy = user;
    }
    // Trường hợp 2: Chuyển về DRAFT hoặc ARCHIVED (Gỡ bài)
    else if (updatePostDto.status && updatePostDto.status !== PostStatus.PUBLISHED) {
      post.isPublished = false;
    }

    // D. Merge dữ liệu mới vào entity cũ
    wrap(post).assign(updatePostDto);

    // [AUTO-FILL] Recalculate SEO if content or keyword changed
    if (updatePostDto.content !== undefined || updatePostDto.focusKeyword !== undefined) {
      // Use new content or fallback to old content
      const contentToAnalyze = updatePostDto.content !== undefined ? updatePostDto.content : post.content;
      const keywordToAnalyze = updatePostDto.focusKeyword !== undefined ? updatePostDto.focusKeyword : post.focusKeyword;

      if (contentToAnalyze) {
        post.seoScore = this.seoAnalyzerService.analyze(contentToAnalyze, keywordToAnalyze).score;
      }
    }

    await this.postRepository.getEntityManager().flush();
    await this.clearPostsCache();
    return post;
  }

  // =================================================================
  // HELPER: PROCESS CONTENT & GENERATE TOC
  // =================================================================
  private processContentWithTOC(content: string): { content: string; toc: any[] } {
    if (!content) return { content: '', toc: [] };

    const toc: any[] = [];
    const headerRegex = /<(h[23])([^>]*)>(.*?)<\/\1>/gi;

    const newContent = content.replace(headerRegex, (match, tag, attrs, text) => {
      // Find existing ID
      const idMatch = attrs.match(/id=["']([^"']*)["']/);
      let id = idMatch ? idMatch[1] : null;

      // Clean text for TOC display
      const plainText = text.replace(/<[^>]*>/g, '').trim();

      if (!id) {
        // Generate new ID
        id = slugify(plainText, { lower: true, strict: true }) || `heading-${Math.random().toString(36).substr(2, 5)}`;
        // Inject ID to attributes
        // Check if there are other attributes or just empty
        if (attrs.trim() === '') {
          attrs = ` id="${id}"`;
        } else {
          attrs = ` id="${id}"` + attrs;
        }
      }

      toc.push({
        id,
        text: plainText,
        level: tag === 'h2' ? 2 : 3,
      });

      return `<${tag}${attrs}>${text}</${tag}>`;
    });

    return { content: newContent, toc };
  }

  // =================================================================
  // 5. QUẢN LÝ XÓA BÀI VIẾT (SOFT DELETE & HARD DELETE)
  // =================================================================

  /**
   * Soft Delete: Chỉ đánh dấu xóa (ẩn khỏi danh sách thông thường)
   */
  async remove(id: string): Promise<void> {
    const post = await this.findOne(id);
    post.deletedAt = new Date();
    await this.postRepository.getEntityManager().flush();
    await this.clearPostsCache();
  }

  /**
   * Khôi phục bài viết đã xóa mềm
   */
  async restore(id: string): Promise<void> {
    const post = await this.postRepository.findOne({ id }, { filters: false });
    if (!post) throw new NotFoundException('Post not found (or hard deleted)');

    post.deletedAt = undefined;
    await this.postRepository.getEntityManager().flush();
    await this.clearPostsCache();
  }

  /**
   * Xóa cứng (Vĩnh viễn)
   */
  async hardDelete(id: string): Promise<void> {
    const post = await this.postRepository.findOne({ id }, { filters: false });
    if (!post) throw new NotFoundException('Post not found');

    await this.postRepository.getEntityManager().removeAndFlush(post);
    await this.clearPostsCache();
  }

  // =================================================================
  // 3.5. LẤY BÀI VIẾT ĐÃ XÓA (ADMIN ONLY)
  // =================================================================
  async findDeleted(query: PostQueryDto) {
    const { page = 1, limit = 10 } = query;
    const offset = (page - 1) * limit;

    const [items, total] = await this.postRepository.findAndCount(
      { deletedAt: { $ne: null } },
      {
        limit,
        offset,
        orderBy: { deletedAt: 'DESC' },
        populate: ['category', 'author'],
        exclude: ['content', 'meta'] as any,
      }
    );

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // =================================================================
  // 3.6. SITEMAP HELPERS
  // =================================================================
  async getSitemapUrls() {
    const posts = await this.postRepository.find(
      { isPublished: true, deletedAt: null },
      {
        populate: ['category'], // Load Category to decide Domain
        fields: ['slug', 'updatedAt', 'publishedAt', 'title', 'category.slug', 'category.name'],
        orderBy: { updatedAt: 'DESC' },
      }
    );

    return posts.map((post) => {
      const domain = this.getDomainByCategory(post.category?.slug);
      return {
        loc: `${domain}/posts/${post.slug}`, // Full URL
        lastmod: post.updatedAt || post.publishedAt || new Date(),
        changefreq: 'weekly',
        priority: 0.8,
        title: post.title,
      };
    });
  }

  private getDomainByCategory(categorySlug?: string): string {
    if (!categorySlug) return 'https://erg.edu.vn';

    // Simple Mapping based on naming convention
    // In real app, this should be in Database or Config
    if (categorySlug.includes('ai') || categorySlug.includes('tri-tue-nhan-tao')) return 'https://ai.erg.edu.vn';
    if (categorySlug.includes('tin-hoc-quoc-te') || categorySlug.includes('mos') || categorySlug.includes('ic3')) return 'https://tinhocquocte.erg.edu.vn';
    if (categorySlug.includes('tin-hoc-quoc-gia')) return 'https://tinhocquocgia.erg.edu.vn';
    if (categorySlug.includes('thieu-nhi') || categorySlug.includes('scratch') || categorySlug.includes('kid')) return 'https://tinhocthieunhi.erg.edu.vn';
    if (categorySlug.includes('cong-dan-so')) return 'https://congdanso.erg.edu.vn';
    if (categorySlug.includes('cloud') || categorySlug.includes('dam-may')) return 'https://dientoandammay.erg.edu.vn';
    if (categorySlug.includes('tuyen-dung') || categorySlug.includes('career')) return 'https://tuyendung.erg.edu.vn';

    return 'https://erg.edu.vn'; // Default Main Domain
  }
}