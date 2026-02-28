/**
 * Renderer Intent Contract v1
 * (Stub implementation - to be completed)
 */

import { z } from 'zod';

export const RendererIntentSchema = z.object({
  type: z.literal('renderer'),
  target: z.string(),
  config: z.record(z.any()).optional(),
});

export type RendererIntent = z.infer<typeof RendererIntentSchema>;
