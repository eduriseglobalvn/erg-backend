import { Injectable } from '@nestjs/common';
import { AIProviderType } from '../entities/api-key.entity';
import { IAIClient } from './ai-provider.interface';
import { GeminiClient } from './gemini.client';
import { GroqClient } from './groq.client';
import { OpenAIClient } from './openai.client';
import { ClaudeClient } from './claude.client';
import { TogetherClient } from './together.client';
import { OpenAICompatibleClient } from './openai-compatible.client';

@Injectable()
export class AIProviderFactory {
  createClient(provider: AIProviderType, apiKey: string, model?: string): IAIClient {
    switch (provider) {
      case AIProviderType.GEMINI:
        return new GeminiClient(apiKey, model || 'gemini-1.5-pro');
      case AIProviderType.GROQ:
        return new GroqClient(apiKey, model || 'llama-3.3-70b-versatile');
      case AIProviderType.OPENAI:
        return new OpenAIClient(apiKey, model || 'gpt-4o');
      case AIProviderType.CLAUDE:
        return new ClaudeClient(apiKey, model || 'claude-3-5-sonnet-latest');
      case AIProviderType.MISTRAL:
        return new OpenAICompatibleClient(apiKey, 'https://api.mistral.ai/v1/chat/completions', model || 'mistral-small-latest');
      case AIProviderType.DEEPSEEK:
        return new OpenAICompatibleClient(apiKey, 'https://api.deepseek.com/chat/completions', model || 'deepseek-chat');
      case AIProviderType.TOGETHER:
        return new TogetherClient(apiKey, model || 'meta-llama/Llama-3.3-70B-Instruct-Turbo');
      case AIProviderType.COHERE:
        return new OpenAICompatibleClient(apiKey, 'https://api.cohere.com/v2/chat/completions', model || 'command-r-plus');
      case AIProviderType.SAMBANOVA:
        return new OpenAICompatibleClient(apiKey, 'https://api.sambanova.ai/v1/chat/completions', model || 'Meta-Llama-3.1-70B-Instruct');
      case AIProviderType.CEREBRAS:
        return new OpenAICompatibleClient(apiKey, 'https://api.cerebras.ai/v1/chat/completions', model || 'llama3.1-8b');
      case AIProviderType.OPENROUTER:
        return new OpenAICompatibleClient(apiKey, 'https://openrouter.ai/api/v1/chat/completions', model || 'google/gemini-2.0-flash-lite-preview-02-05:free');
      case AIProviderType.HYPERBOLIC:
        return new OpenAICompatibleClient(apiKey, 'https://api.hyperbolic.xyz/v1/chat/completions', model || 'meta-llama/Llama-3.3-70B-Instruct');
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }
}
