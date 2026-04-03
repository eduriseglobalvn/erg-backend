import { GoogleGenerativeAI } from '@google/generative-ai';
import { IAIClient, AIGenerateOptions, AIImageOptions } from './ai-provider.interface';

export class GeminiClient implements IAIClient {
  private genAI: GoogleGenerativeAI;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.0-flash') {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(prompt: string, options?: AIGenerateOptions): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: options?.model || this.model,
      generationConfig: {
        maxOutputTokens: options?.maxTokens || 8192,
        temperature: options?.temperature || 0.7,
      },
    });

    const systemInstruction = options?.systemPrompt;
    const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
    const result = await model.generateContent(fullPrompt);
    return result.response.text();
  }

  async generateImage(prompt: string, options?: AIImageOptions): Promise<Buffer> {
    const model = options?.model || 'imagen-3.0-generate-002';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
          safetyFilterLevel: 'BLOCK_MEDIUM_AND_ABOVE',
          personGeneration: 'DONT_ALLOW',
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini Imagen error ${response.status}: ${err}`);
    }

    const result = await response.json();
    const imageData = result.predictions?.[0]?.bytesBase64Encoded;
    if (!imageData) {
      throw new Error('Gemini Imagen: No image data returned');
    }

    return Buffer.from(imageData, 'base64');
  }

  supportsImageGeneration(): boolean {
    return true;
  }
}
