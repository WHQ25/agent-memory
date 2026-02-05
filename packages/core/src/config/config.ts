import { readFileSync, writeFileSync } from 'node:fs';
import { getConfigPath } from './paths.js';

interface AgmemConfig {
  global: Record<string, string>;
  sources: Record<string, Record<string, string>>;
}

function defaultConfig(): AgmemConfig {
  return { global: {}, sources: {} };
}

export function loadConfig(): AgmemConfig {
  try {
    const raw = readFileSync(getConfigPath(), 'utf-8');
    return JSON.parse(raw) as AgmemConfig;
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config: AgmemConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

export function getConfigValue(key: string, source?: string): string | undefined {
  const config = loadConfig();
  if (source) {
    return config.sources[source]?.[key];
  }
  return config.global[key];
}

export function setConfigValue(key: string, value: string, source?: string): void {
  const config = loadConfig();
  if (source) {
    if (!config.sources[source]) {
      config.sources[source] = {};
    }
    config.sources[source][key] = value;
  } else {
    config.global[key] = value;
  }
  saveConfig(config);
}

export function deleteConfigValue(key: string, source?: string): void {
  const config = loadConfig();
  if (source) {
    if (config.sources[source]) {
      delete config.sources[source][key];
      if (Object.keys(config.sources[source]).length === 0) {
        delete config.sources[source];
      }
    }
  } else {
    delete config.global[key];
  }
  saveConfig(config);
}

export function listConfig(source?: string): Record<string, string> {
  const config = loadConfig();
  if (source) {
    return config.sources[source] ?? {};
  }
  return config.global;
}

export function getSourceMetadata(source: string): Record<string, string> {
  const config = loadConfig();
  return config.sources[source] ?? {};
}
