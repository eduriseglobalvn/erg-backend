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
        Bạn là một chuyên gia biên tập nội dung.
        Nhiệm vụ của bạn là cải thiện nội dung sau đây dựa trên yêu cầu cụ thể.
        
        NỘI DUNG GỐC:
        ${content}
        
        YÊU CẦU CẢI THIỆN:
        ${instruction}
        
        QUY TẮC:
        1. Giữ nguyên định dạng (nếu là HTML hãy giữ các thẻ HTML cần thiết).
        2. Phản hồi CHỈ bao gồm nội dung đã được cải thiện, không thêm lời chào hay giải thích.
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
