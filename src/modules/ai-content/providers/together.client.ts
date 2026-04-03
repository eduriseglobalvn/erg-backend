import { IAIClient, AIGenerateOptions, AIImageOptions } from './ai-provider.interface';

export class TogetherClient implements IAIClient {
    private chatUrl = 'https://api.together.xyz/v1/chat/completions';
    private imageUrl = 'https://api.together.xyz/v1/images/generations';

    constructor(
        private apiKey: string,
        private defaultModel: string = 'meta-llama/Llama-3.3-70B-Instruct-Turbo'
    ) { }

    async generateText(prompt: string, options?: AIGenerateOptions): Promise<string> {
        const messages: any[] = [];
        if (options?.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(this.chatUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: options?.model || this.defaultModel,
                messages,
                max_tokens: options?.maxTokens || 4096,
                temperature: options?.temperature || 0.7,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Together Text error ${response.status}: ${error?.error?.message || response.statusText}`);
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
                model: options?.model || 'black-forest-labs/FLUX.1-schnell-Free',
                prompt,
                width: options?.width || 1024,
                height: options?.height || 768,
                steps: 4,
                n: 1,
                response_format: 'base64',
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Together Image error ${response.status}: ${error?.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const b64 = data.data?.[0]?.b64_json;
        if (!b64) throw new Error('Together Image: No image data returned');

        return Buffer.from(b64, 'base64');
    }

    supportsImageGeneration(): boolean {
        return true;
    }
}
