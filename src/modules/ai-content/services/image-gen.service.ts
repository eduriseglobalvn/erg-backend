import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ImageGenService {
  private readonly logger = new Logger(ImageGenService.name);

  constructor(private configService: ConfigService) {}

  async generateImage(prompt: string): Promise<Buffer> {
    const accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID');
    const token = this.configService.get<string>('CLOUDFLARE_API_TOKEN');
    // Model Free Tier tốt nhất hiện tại
    const model = '@cf/black-forest-labs/flux-1-schnell';

    // this.logger.debug(`Calling Cloudflare AI with prompt: ${prompt.substring(0, 30)}...`);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          num_steps: 4 // Giữ 4 bước để nhanh và tiết kiệm quota
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`Cloudflare API Error: ${errText}`);
      throw new Error(`Cloudflare Failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Cloudflare trả về base64 trong JSON
    if (result.success && result.result?.image) {
      return Buffer.from(result.result.image, 'base64');
    }

    throw new Error('Cloudflare response missing image data');
  }
}