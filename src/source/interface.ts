export interface Memory {
  id: string;
  hash: string;
  content: string;
  digest: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  accessCount: number;
}

export interface AddInput {
  content: string;
  digest?: string;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface UpdateInput {
  content?: string;
  digest?: string;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface SearchOpts {
  tags?: string[];
  after?: string;
  before?: string;
  limit?: number;
  metadata?: Record<string, string>;
}

export interface ListOpts {
  tags?: string[];
  after?: string;
  before?: string;
  limit?: number;
  offset?: number;
  sort?: 'time' | 'access';
  metadata?: Record<string, string>;
}

export interface SearchResult {
  id: string;
  digest: string;
  tags: string[];
  score: number;
  createdAt: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface SourceStats {
  totalMemories: number;
  totalTags: number;
  storageSize?: number;
  indexStatus?: {
    indexed: number;
    total: number;
    model?: string;
  };
}

export interface IndexStatus {
  indexed: number;
  total: number;
  model?: string;
}

export interface SourceCommandMeta {
  name: string;
  description: string;
}

export interface RunContext {
  onProgress?: (message: string) => void;
}

export interface MemorySource {
  readonly name: string;
  readonly vecAvailable: boolean;

  init(): Promise<void>;
  close(): Promise<void>;

  add(input: AddInput): Promise<Memory>;
  get(ids: string[]): Promise<Memory[]>;
  update(id: string, patch: UpdateInput): Promise<Memory>;
  delete(ids: string[]): Promise<void>;

  search(query: string, opts?: SearchOpts): Promise<SearchResult[]>;
  list(opts?: ListOpts): Promise<Memory[]>;

  tags(): Promise<TagCount[]>;
  stats(): Promise<SourceStats>;

  // Index management
  index(onProgress?: (done: number, total: number) => void): Promise<number>;
  indexRebuild(onProgress?: (done: number, total: number) => void): Promise<number>;
  indexStatus(): Promise<IndexStatus>;

  // Source-provided runnable commands
  commands(): SourceCommandMeta[];
  run(command: string, ctx?: RunContext): Promise<unknown>;
}
