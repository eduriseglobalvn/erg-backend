import { IAIClient, AIGenerateOptions } from './ai-provider.interface';

export class ClaudeClient implements IAIClient {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.anthropic.com/v1/messages';

  constructor(apiKey: string, model: string = 'claude-3-5-sonnet-latest') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(prompt: string, options?: AIGenerateOptions): Promise<string> {
    const body: any = {
      model: options?.model || this.model,
      max_tokens: options?.maxTokens || 8192,
      messages: [{ role: 'user', content: prompt }],
    };
    if (options?.systemPrompt) {
      body.system = options.systemPrompt;
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Claude API error ${response.status}: ${error?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }
}
