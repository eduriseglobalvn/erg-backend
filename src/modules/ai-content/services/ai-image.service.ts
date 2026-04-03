import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@/modules/users/entities/user.entity';
import { AIImageOptions } from '../providers/ai-provider.interface';
import { ApiKeyService } from './api-key.service';
import { AIProviderFactory } from '../providers/ai-provider.factory';
import { ProviderHealthService } from './provider-health.service';
import { AIProviderType } from '../entities/api-key.entity';

@Injectable()
export class AiImageService {
  private readonly logger = new Logger(AiImageService.name);

  constructor(
    private configService: ConfigService,
    private apiKeyService: ApiKeyService,
    private providerFactory: AIProviderFactory,
    private providerHealthService: ProviderHealthService,
  ) { }

  async generateImage(prompt: string, user?: User, options?: AIImageOptions): Promise<Buffer> {
    // 1-3. Try Premium AI Providers (Gemini, Together, OpenAI)
    if (user) {
      try {
        this.logger.log(`Attempting premium image generation for prompt: ${prompt.substring(0, 50)}...`);
        return await this.generateImageWithFallback(prompt, user, options);
      } catch (err) {
        this.logger.warn(`Premium image generation failed: ${err.message}`);
      }
    }

    // 4. Fallback: Cloudflare AI
    try {
      this.logger.log('Falling back to Cloudflare AI for image generation...');
      return await this.generateWithCloudflare(prompt);
    } catch (err) {
      this.logger.warn(`Cloudflare image generation failed: ${err.message}`);
    }

    // 5. Final Fallback: Pollinations.ai (Free, no key required)
    try {
      this.logger.log('Falling back to Pollinations.ai (Free) for image generation...');
      return await this.generateWithPollinations(prompt, options);
    } catch (err) {
      this.logger.error(`All image generation providers failed: ${err.message}`);
      throw new Error('All image generation providers are unavailable.');
    }
  }

  private async generateImageWithFallback(prompt: string, user: User, options?: AIImageOptions): Promise<Buffer> {
    const dynamicFallbackOrder = await this.providerHealthService.getOptimalFallbackOrder();
    const imageCapableProviders = [
      AIProviderType.GEMINI,
      AIProviderType.OPENAI,
      AIProviderType.TOGETHER
    ];

    let providersToTry = options?.preferredProviders && options.preferredProviders.length > 0
      ? options.preferredProviders
      : imageCapableProviders.filter(p => dynamicFallbackOrder.includes(p));

    for (const provider of providersToTry) {
      let keyEntity: any;
      try {
        keyEntity = await this.apiKeyService.getAvailableKey(user, provider);
      } catch {
        continue;
      }

      try {
        const client = this.providerFactory.createClient(provider, keyEntity.key);
        if (!client.supportsImageGeneration || !client.supportsImageGeneration()) {
          continue;
        }

        const startTime = Date.now();
        const buffer = await client.generateImage!(prompt, options);

        await this.apiKeyService.logUsage(keyEntity.id);
        await this.providerHealthService.recordSuccess(provider, Date.now() - startTime);

        return buffer;
      } catch (err) {
        this.logger.warn(`AI Image Provider ${provider} failed: ${err.message}`);
        await this.providerHealthService.recordFailure(provider, err.message);
      }
    }

    throw new ServiceUnavailableException('Không có AI provider nào hỗ trợ tạo ảnh hiện khả dụng.');
  }

  private async generateWithCloudflare(prompt: string): Promise<Buffer> {
    const accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID');
    const token = this.configService.get<string>('CLOUDFLARE_API_TOKEN');
    if (!accountId || !token) throw new Error('Cloudflare credentials not configured');

    const model = '@cf/black-forest-labs/flux-1-schnell';
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt, num_steps: 4 }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloudflare Failed: ${response.statusText} - ${errText}`);
    }

    const result = await response.json();
    if (result.success && result.result?.image) {
      return Buffer.from(result.result.image, 'base64');
    }

    throw new Error('Cloudflare response missing image data');
  }

  private async generateWithPollinations(prompt: string, options?: AIImageOptions): Promise<Buffer> {
    const width = options?.width || 1200;
    const height = options?.height || 630;
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Pollinations Failed: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}