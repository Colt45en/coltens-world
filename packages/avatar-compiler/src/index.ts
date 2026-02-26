/**
 * @world-engine/avatar-compiler
 * Headless avatar compilation orchestration
 */

export * from './avatarDNA.js';
export { compileAvatar as compileAvatarNew } from "./compileAvatar.js";
export * from './compileKey.js';
export { compileAvatar, compileBatch } from "./compiler.js";
export * from "./export/index.js";
export { hashBuffer, hashObject, sha256HexBytes, sha256HexString } from "./hash.js";
export * from './presets.js';
export { DEFAULT_DNA } from './types.js';
export type {
  AssetRegistry,
  CompileAvatarOptions,
  CompileAvatarResult,
  CompileOptions,
  CompiledAsset,
  RegistryEntry,
} from "./types.js";
export * from "./validate.js";
