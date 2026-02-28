import { ArtifactMetadata, ArtifactRef } from '../contracts/artifact/schema';
import { hashBytes } from '../determinism';

/**
 * Artifact Store
 * In-memory content-addressed storage for World Core
 * Maps artifact_id (content hash) to raw bytes
 */

export class ArtifactStore {
  private store: Map<string, Buffer> = new Map();
  private metadata: Map<string, ArtifactMetadata> = new Map();

  /**
   * Store an artifact from raw bytes
   * Returns the artifact ID (content-addressed)
   */
  public add(
    data: Buffer | Uint8Array,
    type: string,
    name?: string
  ): { artifact_id: string; metadata: ArtifactMetadata } {
    const bytes = Buffer.from(data);
    const hash = hashBytes(bytes);
    const artifactId = `artifact:${hash}`;

    // Check if already stored (content-addressed, so duplicate = same ID)
    if (this.store.has(hash)) {
      const existing = this.metadata.get(hash);
      if (existing) {
        return { artifact_id: artifactId, metadata: existing };
      }
    }

    // Store new artifact
    this.store.set(hash, bytes);

    const metadata: ArtifactMetadata = {
      artifact_id: artifactId,
      type,
      name,
      byteSize: bytes.length,
      hash,
      created_at_utc: new Date().toISOString(),
    };

    this.metadata.set(hash, metadata);

    return { artifact_id: artifactId, metadata };
  }

  /**
   * Retrieve artifact by ID
   */
  public retrieve(artifactId: string): Buffer | undefined {
    const hash = this.extractHash(artifactId);
    return this.store.get(hash);
  }

  /**
   * Get artifact metadata
   */
  public getMetadata(artifactId: string): ArtifactMetadata | undefined {
    const hash = this.extractHash(artifactId);
    return this.metadata.get(hash);
  }

  /**
   * Verify artifact integrity (hash matches content)
   */
  public verify(artifactId: string): boolean {
    const data = this.retrieve(artifactId);
    if (!data) return false;

    const computedHash = hashBytes(data);
    const expectedHash = this.extractHash(artifactId);
    return computedHash === expectedHash;
  }

  /**
   * List all stored artifacts
   */
  public listArtifacts(): ArtifactMetadata[] {
    return Array.from(this.metadata.values()).sort((a, b) =>
      a.artifact_id.localeCompare(b.artifact_id)
    );
  }

  /**
   * Clear all artifacts
   */
  public clear(): void {
    this.store.clear();
    this.metadata.clear();
  }

  /**
   * Extract hash from artifact ID
   */
  private extractHash(artifactId: string): string {
    if (!artifactId.startsWith("artifact:")) {
      throw new Error(`Invalid artifact ID: ${artifactId}`);
    }
    return artifactId.slice("artifact:".length);
  }
}

/**
 * Convert ArtifactMetadata to ArtifactRef (for use in contracts)
 */
export function metadataToRef(metadata: ArtifactMetadata): ArtifactRef {
  return {
    artifact_id: metadata.artifact_id,
    hash: metadata.hash,
    type: metadata.type,
    name: metadata.name,
  };
}

/**
 * Global artifact store instance (singleton)
 * In real implementation, this might be a database or distributed store
 */
let globalStore: ArtifactStore | null = null;

export function getGlobalArtifactStore(): ArtifactStore {
  if (!globalStore) {
    globalStore = new ArtifactStore();
  }
  return globalStore;
}

export function resetGlobalArtifactStore(): void {
  if (globalStore) {
    globalStore.clear();
  }
  globalStore = null;
}
