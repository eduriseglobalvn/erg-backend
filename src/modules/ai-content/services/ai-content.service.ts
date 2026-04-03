import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyService } from './api-key.service';
import { User } from '@/modules/users/entities/user.entity';
import { AIProviderFactory } from '../providers/ai-provider.factory';
import { AIProviderType } from '../entities/api-key.entity';
import { ProviderHealthService } from './provider-health.service';

@Injectable()
export class AiContentService {
    private readonly logger = new Logger(AiContentService.name);

    constructor(
        private readonly apiKeyService: ApiKeyService,
        private readonly configService: ConfigService,
        private readonly providerFactory: AIProviderFactory,
        private readonly providerHealthService: ProviderHealthService,
    ) { }

    async generateWithFallback(prompt: string, user: User, options?: { maxTokens?: number; temperature?: number; systemPrompt?: string; purpose?: string; preferredProviders?: AIProviderType[] }): Promise<string> {
        let dynamicFallbackOrder = await this.providerHealthService.getOptimalFallbackOrder();

        if (options?.preferredProviders && options.preferredProviders.length > 0) {
            const preferred = options.preferredProviders;
            const others = dynamicFallbackOrder.filter(p => !preferred.includes(p));
            dynamicFallbackOrder = [...preferred, ...others];
        }

        for (const provider of dynamicFallbackOrder) {
            let keyEntity: any;
            try {
                keyEntity = await this.apiKeyService.getAvailableKey(user, provider);
            } catch {
                continue;
            }

            try {
                const startTime = Date.now();
                const client = this.providerFactory.createClient(provider, keyEntity.key);
                const result = await client.generateText(prompt, options);

                await this.apiKeyService.logUsage(keyEntity.id);
                await this.providerHealthService.recordSuccess(provider, Date.now() - startTime);

                return result;
            } catch (err) {
                await this.apiKeyService.reportError(keyEntity.id, err.message || String(err));
                await this.providerHealthService.recordFailure(provider, err.message || String(err));
                this.logger.warn(`AI Provider ${provider} failed, falling back... Error: ${err.message}`);
            }
        }

        throw new ServiceUnavailableException('Tất cả AI providers đều không khả dụng. Vui lòng kiểm tra API keys tại /admin/settings/ai-keys');
    }

    async refineText(content: string, instruction: string, user: User): Promise<string> {
        try {
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

            const refinedText = await this.generateWithFallback(prompt, user, { maxTokens: 8192 });
            return refinedText.trim();
        } catch (error) {
            this.logger.error(`Refine Text Failed: ${error.message}`);
            throw error;
        }
    }
}

