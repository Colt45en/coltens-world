export interface CompileManifest {
  tool: string;
  inputs: string[];
  outputs: string[];
  deterministic: boolean;
  hash: string;
  timestamp: string;
  cacheKey?: string;
  cacheHit?: boolean;
}

export interface CompileCacheContext {
  cacheDir?: string;
}
