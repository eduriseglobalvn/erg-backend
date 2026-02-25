import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { ApiKeyService } from './api-key.service';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class AiContentService {
    private readonly logger = new Logger(AiContentService.name);

    constructor(
        private readonly apiKeyService: ApiKeyService,
        private readonly configService: ConfigService,
    ) { }

    async refineText(content: string, instruction: string, user: User): Promise<string> {
        let currentApiKey = '';
        try {
            const apiKeyEntity = await this.apiKeyService.getAvailableKey(user);
            currentApiKey = apiKeyEntity.key;

            const modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-1.5-flash';

            const genAI = new GoogleGenerativeAI(currentApiKey);
            const model = genAI.getGenerativeModel({ model: modelName });

            const prompt = `
        Bạn là một chuyên gia biên tập nội dung SEO cao cấp tại ERG (Education Rise Global).
        Nhiệm vụ của bạn là tối ưu hóa nội dung dựa trên yêu cầu cụ thể, đảm bảo tính chuyên nghiệp, thu hút và chuẩn SEO.
        
        NỘI DUNG GỐC:
        ${content}
        
        YÊU CẦU CỤ THỂ:
        ${instruction}
        
        QUY TẮC BẮT BUỘC:
        1. Duy trì giọng văn chuyên nghiệp, giáo dục, truyền cảm hứng.
        2. Giữ nguyên định dạng HTML nếu có, không làm hỏng cấu trúc thẻ.
        3. Tuyệt đối không thêm văn bản rác, lời chào, hay giải thích (VD: "Đây là kết quả của bạn...").
        4. Tối ưu hóa từ khóa một cách tự nhiên (không nhồi nhét).
        5. Phản hồi CHỈ bao gồm nội dung đã xử lý.
      `;

            const result = await model.generateContent(prompt);
            const refinedText = result.response.text().trim();

            // Log usage after success
            await this.apiKeyService.logUsage(apiKeyEntity.id);

            return refinedText;
        } catch (error) {
            this.logger.error(`Refine Text Failed: ${error.message}`);
            if (currentApiKey && (error.message.includes('429') || error.message.includes('Quota'))) {
                await this.apiKeyService.reportError(currentApiKey, error);
            }
            throw error;
        }
    }
}
