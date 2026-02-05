// Source interface & types
export type {
  Memory, AddInput, UpdateInput,
  SearchOpts, ListOpts, SearchResult,
  TagCount, SourceStats, IndexStatus,
  MemorySource, SourceCommandMeta, RunContext,
} from './source/interface.js';

// SQLite source
export { SqliteSource } from './source/sqlite/index.js';

// Embedding
export type { EmbeddingProvider } from './embedding/interface.js';
export { getTransformersProvider, buildEmbeddingText, buildQueryText, TransformersEmbeddingProvider } from './embedding/transformers.js';

// Config
export { getDbPath, getConfigDir, getDataDir, getCacheDir, getConfigPath } from './config/paths.js';
export { loadConfig, saveConfig, getConfigValue, setConfigValue, deleteConfigValue, listConfig, getSourceMetadata } from './config/config.js';

// Search
export { searchPipeline } from './search/pipeline.js';
export { rrfFuse } from './search/rrf.js';
export type { RrfResult } from './search/rrf.js';
