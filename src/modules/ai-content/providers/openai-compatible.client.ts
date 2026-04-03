import { IAIClient, AIGenerateOptions } from './ai-provider.interface';

export class OpenAICompatibleClient implements IAIClient {
    constructor(
        private apiKey: string,
        private baseUrl: string,
        private defaultModel: string,
        private requiredAuthHeaderType: string = 'Bearer'
    ) { }

    async generateText(prompt: string, options?: AIGenerateOptions): Promise<string> {
        const messages: any[] = [];
        if (options?.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const authHeaderString = this.requiredAuthHeaderType === 'Bearer'
            ? `Bearer ${this.apiKey}`
            : `${this.requiredAuthHeaderType} ${this.apiKey}`;

        const body: Record<string, any> = {
            model: this.defaultModel,
            messages,
        };

        if (options?.maxTokens) {
            body.max_tokens = options.maxTokens;
        }
        // Deepseek v3 sometimes expects different max_tokens/temperature rules, but most are fine.
        if (options?.temperature !== undefined) {
            body.temperature = options.temperature;
        }

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': authHeaderString,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`AI API error ${response.status} from ${this.baseUrl}: ${error?.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }
}
