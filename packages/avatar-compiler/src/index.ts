/**
 * @world-engine/avatar-compiler
 *
 * Deterministic avatar compilation pipeline
 */

export { compileAvatar, compileBatch } from './compiler.js';
export { sha256HexBytes, sha256HexString } from './hash.js';
export * from './avatarDNA.js';
export * from './validate.js';
export * from './compileKey.js';
export * from './presets.js';
export { DEFAULT_DNA } from './types.js';
export type {
    AssetRegistry,
    CompiledAsset,
    CompileOptions,
    RegistryEntry
} from './types.js';
