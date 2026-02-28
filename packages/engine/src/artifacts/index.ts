// Artifacts for World Core
// Content-addressed storage for meshes, textures, and generated files

export {
    ArtifactStore, getGlobalArtifactStore, metadataToRef, resetGlobalArtifactStore
} from './store';

export type { ArtifactMetadata, ArtifactRef } from '../contracts/artifact/schema';
