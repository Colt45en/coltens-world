/**
 * Graphics ecosystem: rendering + extraction + WebGPU integration
 * Re-exports: available at @world-engine/graphics
 */

export * from './index';

// NEW: GPU-ready render packets
export { ExtractionContext, extractFrame, type RenderPacket } from './render-extraction';
