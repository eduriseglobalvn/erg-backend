export enum PostGenerationType {
    INFORMATIVE = 'informative',
    HOWTO = 'howto',
    LISTICLE = 'listicle',
    NEWS = 'news',
}

export interface PostTemplate {
    name: string;
    description: string;
    systemPrompt: string;
    userPromptTemplate: string;
    formatInstructions: string;
}

export const POST_TEMPLATES: Record<PostGenerationType, PostTemplate> = {
    [PostGenerationType.INFORMATIVE]: {
        name: 'Kiến thức chuyên sâu',
        description: 'Cung cấp thông tin chi tiết, định nghĩa và giải thích về một chủ đề công nghệ.',
        systemPrompt: 'Bạn là một chuyên gia công nghệ và biên tập viên nội dung cao cấp tại Trung tâm Tin học ERG. Hãy viết một bài viết chuyên sâu, chuyên nghiệp nhưng dễ hiểu.',
        userPromptTemplate: 'Hãy viết một bài viết chi tiết về chủ đề: {keyword}. Nội dung cần bao gồm định nghĩa, lợi ích, và các ví dụ thực tế.',
        formatInstructions: 'Trả về JSON với các trường: title, slug, summary, content (HTML), focusKeyword, metaDescription, metaKeywords (array), tags (array).',
    },
    [PostGenerationType.HOWTO]: {
        name: 'Hướng dẫn từng bước',
        description: 'Hướng dẫn người dùng thực hiện một tác vụ cụ thể hoặc giải quyết một vấn đề.',
        systemPrompt: 'Bạn là một giảng viên công nghệ tận tâm tại ERG. Hãy viết bài hướng dẫn rõ ràng, có các bước thực hiện chi tiết (Step 1, Step 2...).',
        userPromptTemplate: 'Viết hướng dẫn cách thực hiện: {keyword}. Cần có các bước rõ ràng và các lưu ý quan trọng.',
        formatInstructions: 'Trả về JSON với các trường: title, slug, summary, content (HTML), focusKeyword, metaDescription, metaKeywords (array), tags (array).',
    },
    [PostGenerationType.LISTICLE]: {
        name: 'Danh sách tổng hợp',
        description: 'Tổng hợp các công cụ, mẹo, hoặc xu hướng dưới dạng danh sách (Top 5, Top 10...).',
        systemPrompt: 'Bạn là một chuyên gia săn tin công nghệ. Hãy viết một bài listicle thu hút, súc tích và giàu thông tin.',
        userPromptTemplate: 'Tổng hợp danh sách {keyword}. Mỗi mục cần có tiêu đề phụ và mô tả ngắn gọn.',
        formatInstructions: 'Trả về JSON với các trường: title, slug, summary, content (HTML), focusKeyword, metaDescription, metaKeywords (array), tags (array).',
    },
    [PostGenerationType.NEWS]: {
        name: 'Tin tức công nghệ',
        description: 'Cập nhật tin tức mới nhất về các công nghệ đang được quan tâm.',
        systemPrompt: 'Bạn là một nhà báo công nghệ năng động. Hãy viết tin tức nhanh chóng, khách quan và nêu bật được tầm ảnh hưởng của tin tức đó.',
        userPromptTemplate: 'Viết tin tức về: {keyword}. Cần có bối cảnh, sự kiện chính và nhận định ngắn gọn.',
        formatInstructions: 'Trả về JSON với các trường: title, slug, summary, content (HTML), focusKeyword, metaDescription, metaKeywords (array), tags (array).',
    },
};
