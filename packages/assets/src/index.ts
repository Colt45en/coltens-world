/**
 * Asset loading system with caching and deterministic decode
 */

export interface AssetManifest {
  [key: string]: {
    uri: string;
    type: 'glb' | 'gltf' | 'png' | 'jpg' | 'json' | 'text';
    hash?: string;
  };
}

export interface LoadOpts {
  cache?: boolean;
  timeout?: number;
}

export class AssetLoader {
  private cache: Map<string, any> = new Map();
  private manifest: AssetManifest = {};

  loadManifest(manifest: AssetManifest): void {
    this.manifest = manifest;
  }

  async load<T>(uri: string, opts: LoadOpts = {}): Promise<T> {
    const { cache = true, timeout = 30000 } = opts;

    // Check cache
    if (cache && this.cache.has(uri)) {
      return this.cache.get(uri) as T;
    }

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(uri, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to load ${uri}: ${response.statusText}`);
      }

      const data = await response.json();
      if (cache) {
        this.cache.set(uri, data);
      }
      return data as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async loadGLB(uri: string, opts?: LoadOpts): Promise<ArrayBuffer> {
    const { cache = true, timeout = 30000 } = opts || {};

    if (cache && this.cache.has(uri)) {
      return this.cache.get(uri) as ArrayBuffer;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(uri, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to load GLB ${uri}: ${response.statusText}`);
      }

      const data = await response.arrayBuffer();
      if (cache) {
        this.cache.set(uri, data);
      }
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export default AssetLoader;
