import type { EmbeddingProvider } from './interface.js';
import { getCacheDir } from '../config/paths.js';

// Lazy singleton
let instance: TransformersEmbeddingProvider | null = null;

export function buildEmbeddingText(content: string, tags: string[]): string {
  const tagPart = tags.length > 0 ? `[${tags.join(', ')}] ` : '';
  return `search_document: ${tagPart}${content}`;
}

export function buildQueryText(query: string): string {
  return `search_query: ${query}`;
}

export class TransformersEmbeddingProvider implements EmbeddingProvider {
  readonly modelName = 'nomic-ai/nomic-embed-text-v1.5';
  readonly dimensions = 768;
  private extractor: unknown = null;

  private async getExtractor(): Promise<unknown> {
    if (this.extractor) return this.extractor;

    // Set cache dir before importing transformers
    const { env, pipeline } = await import('@huggingface/transformers');
    env.cacheDir = getCacheDir();

    this.extractor = await pipeline(
      'feature-extraction',
      this.modelName,
      { dtype: 'q8' } as Record<string, unknown>,
    );
    return this.extractor;
  }

  async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor() as (text: string, opts: Record<string, unknown>) => Promise<{ tolist(): number[][] }>;
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return output.tolist()[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}

export function getTransformersProvider(): TransformersEmbeddingProvider {
  if (!instance) {
    instance = new TransformersEmbeddingProvider();
  }
  return instance;
}
