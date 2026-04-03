export interface IAIClient {
  generateText(prompt: string, options?: AIGenerateOptions): Promise<string>;
  generateImage?(prompt: string, options?: AIImageOptions): Promise<Buffer>;
  supportsImageGeneration?(): boolean;
}

export interface AIGenerateOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  model?: string;
}

import { AIProviderType } from '../entities/api-key.entity';

export interface AIImageOptions {
  width?: number;
  height?: number;
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  model?: string;
  count?: number;
  preferredProviders?: AIProviderType[];
}

