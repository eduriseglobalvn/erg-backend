import { IAIClient, AIGenerateOptions, AIImageOptions } from './ai-provider.interface';

export class OpenAIClient implements IAIClient {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.openai.com/v1/chat/completions';
  private imageUrl = 'https://api.openai.com/v1/images/generations';

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(prompt: string, options?: AIGenerateOptions): Promise<string> {
    const messages: any[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model || this.model,
        messages,
        max_tokens: options?.maxTokens || 8192,
        temperature: options?.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error ${response.status}: ${error?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async generateImage(prompt: string, options?: AIImageOptions): Promise<Buffer> {
    const response = await fetch(this.imageUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model || 'dall-e-3',
        prompt,
        n: 1, // Only support one image for now to match Buffer return type
        size: `${options?.width || 1024}x${options?.height || 1024}`,
        quality: options?.quality || 'standard',
        style: options?.style || 'vivid',
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenAI Image error ${response.status}: ${error?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI Image: No image data returned');

    return Buffer.from(b64, 'base64');
  }

  supportsImageGeneration(): boolean {
    return true;
  }
}
