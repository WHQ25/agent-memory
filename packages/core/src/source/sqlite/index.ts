import type Database from 'better-sqlite3';
import type {
  MemorySource, Memory, AddInput, UpdateInput,
  SearchOpts, ListOpts, SearchResult, TagCount, SourceStats, IndexStatus,
  SourceCommandMeta, RunContext,
} from '../interface.js';
import { type DbContext, openDatabase, initSchema } from './db.js';
import { addMemory, getMemories, updateMemory, deleteMemories } from './crud.js';
import { listMemories } from './list.js';
import { getTags } from './tags.js';
import { getStats } from './stats.js';
import { searchPipeline } from '../../search/pipeline.js';
import type { EmbeddingProvider } from '../../embedding/interface.js';
import { indexUnembedded, rebuildIndex } from './embedding-sync.js';
import { getMeta, setMeta } from './meta.js';
import { getTransformersProvider, buildEmbeddingText } from '../../embedding/transformers.js';

export class SqliteSource implements MemorySource {
  readonly name = 'local';
  private ctx!: DbContext;
  private dbPath: string;
  private embeddingProvider?: EmbeddingProvider;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    this.ctx = openDatabase(this.dbPath);
    initSchema(this.ctx);
  }

  async close(): Promise<void> {
    this.ctx.db.close();
  }

  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  get vecAvailable(): boolean {
    return this.ctx.vecAvailable;
  }

  get db(): Database.Database {
    return this.ctx.db;
  }

  async add(input: AddInput): Promise<Memory> {
    const mem = addMemory(this.ctx.db, input);
    await this.embedOne(mem);
    return mem;
  }

  async get(ids: string[]): Promise<Memory[]> {
    return getMemories(this.ctx.db, ids);
  }

  async update(id: string, patch: UpdateInput): Promise<Memory> {
    const mem = updateMemory(this.ctx.db, id, patch);
    if (patch.content !== undefined || patch.tags !== undefined) {
      await this.embedOne(mem);
    }
    return mem;
  }

  async delete(ids: string[]): Promise<void> {
    deleteMemories(this.ctx.db, ids);
  }

  async search(query: string, opts: SearchOpts = {}): Promise<SearchResult[]> {
    this.ensureEmbeddingProvider();
    return searchPipeline(this.ctx.db, query, opts, this.ctx.vecAvailable, this.embeddingProvider);
  }

  async list(opts: ListOpts = {}): Promise<Memory[]> {
    return listMemories(this.ctx.db, opts);
  }

  async tags(): Promise<TagCount[]> {
    return getTags(this.ctx.db);
  }

  async stats(): Promise<SourceStats> {
    return getStats(this.ctx.db, this.dbPath, this.ctx.vecAvailable);
  }

  async index(onProgress?: (done: number, total: number) => void): Promise<number> {
    if (!this.embeddingProvider) throw new Error('No embedding provider configured');
    return indexUnembedded(this.ctx.db, this.embeddingProvider, onProgress);
  }

  async indexRebuild(onProgress?: (done: number, total: number) => void): Promise<number> {
    if (!this.embeddingProvider) throw new Error('No embedding provider configured');
    return rebuildIndex(this.ctx.db, this.embeddingProvider, onProgress);
  }

  async indexStatus(): Promise<IndexStatus> {
    const total = (this.ctx.db.prepare('SELECT COUNT(*) AS count FROM memories').get() as { count: number }).count;
    let indexed = 0;
    try {
      indexed = (this.ctx.db.prepare('SELECT COUNT(*) AS count FROM memories_vec').get() as { count: number }).count;
    } catch {
      // vec table may not exist
    }
    const model = getMeta(this.ctx.db, 'embedding.model');
    return { indexed, total, model };
  }

  // Auto-embedding helpers

  private ensureEmbeddingProvider(): EmbeddingProvider | undefined {
    if (!this.ctx.vecAvailable) return undefined;
    if (!this.embeddingProvider) {
      this.embeddingProvider = getTransformersProvider();
    }
    return this.embeddingProvider;
  }

  private async embedOne(memory: Memory): Promise<void> {
    const ep = this.ensureEmbeddingProvider();
    if (!ep) return;
    try {
      const text = buildEmbeddingText(memory.content, memory.tags);
      const embedding = await ep.embed(text);
      const buf = Buffer.from(new Float32Array(embedding).buffer);
      this.ctx.db.prepare('INSERT OR REPLACE INTO memories_vec (id, embedding) VALUES (?, ?)').run(memory.id, buf);
      setMeta(this.ctx.db, 'embedding.model', ep.modelName);
    } catch {
      // Embedding failure should not block writes
    }
  }

  // Source-provided commands

  commands(): SourceCommandMeta[] {
    return [
      { name: 'init', description: 'Initialize source (download embedding model, etc.)' },
      { name: 'status', description: 'Show source status' },
      { name: 'embed', description: 'Generate embeddings for un-indexed memories' },
      { name: 'embed-rebuild', description: 'Full rebuild of all embeddings' },
      { name: 'embed-status', description: 'Show embedding index status' },
    ];
  }

  async run(command: string, ctx?: RunContext): Promise<unknown> {
    switch (command) {
      case 'init':
        return this.runInit(ctx);
      case 'status':
        return this.runStatus();
      case 'embed':
        return this.runEmbed(ctx);
      case 'embed-rebuild':
        return this.runEmbedRebuild(ctx);
      case 'embed-status':
        return this.runEmbedStatus();
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  private async runInit(ctx?: RunContext): Promise<unknown> {
    const result: Record<string, unknown> = {
      source: this.name,
      vecAvailable: this.vecAvailable,
    };

    if (this.vecAvailable) {
      ctx?.onProgress?.('Downloading embedding model...');
      const ep = getTransformersProvider();
      await ep.embed('init');
      ctx?.onProgress?.('Model ready.');
      result.embeddingModel = ep.modelName;
      result.dimensions = ep.dimensions;
    }

    result.status = 'ready';
    return result;
  }

  private async runStatus(): Promise<unknown> {
    const stats = await this.stats();
    const embedStatus = await this.indexStatus();
    return {
      source: this.name,
      vecAvailable: this.vecAvailable,
      ...stats,
      embedding: embedStatus,
    };
  }

  private async runEmbed(ctx?: RunContext): Promise<unknown> {
    if (!this.vecAvailable) {
      throw new Error('sqlite-vec is not available. Vector embedding is disabled.');
    }

    const ep = getTransformersProvider();
    this.setEmbeddingProvider(ep);

    const count = await this.index((done, total) => {
      ctx?.onProgress?.(`Embedding... ${done}/${total}`);
    });

    return { embedded: count };
  }

  private async runEmbedRebuild(ctx?: RunContext): Promise<unknown> {
    if (!this.vecAvailable) {
      throw new Error('sqlite-vec is not available. Vector embedding is disabled.');
    }

    const ep = getTransformersProvider();
    this.setEmbeddingProvider(ep);

    const count = await this.indexRebuild((done, total) => {
      ctx?.onProgress?.(`Rebuilding... ${done}/${total}`);
    });

    return { rebuilt: count };
  }

  private async runEmbedStatus(): Promise<unknown> {
    return this.indexStatus();
  }
}
