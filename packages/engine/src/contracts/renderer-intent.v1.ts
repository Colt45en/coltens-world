import { z } from "zod";

/**
 * Renderer Intent Contracts v1
 * Three.js rendering of deterministic RenderPackets with HUD display
 */

export const RENDERER_INTENT_V1 = {
  schema_version: "renderer-intent.v1",
  id_prefix: "rnd",
  hash_alg: "sha256",
} as const;

export const RendererConfigSchema = z.object({
  canvas_id: z.string().min(1).max(200),
  width_px: z.number().int().min(256).max(4096),
  height_px: z.number().int().min(256).max(4096),
  pixel_ratio: z.number().finite().positive().default(1),
  background_color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#0f0f12"),
  enable_hud: z.boolean().default(true),
  enable_grid: z.boolean().default(false),
  enable_axes: z.boolean().default(false),
});

export type RendererConfig = z.infer<typeof RendererConfigSchema>;

export const RendererStateSchema = z.object({
  is_initialized: z.boolean(),
  canvas_element: z.any().optional(),
  scene: z.object({}).optional(),
  camera: z.object({}).optional(),
  renderer_instance: z.object({}).optional(),
  last_render_packet_id: z.string().optional(),
  last_render_hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  frame_count: z.number().int().min(0),
  fps: z.number().finite().min(0).max(300),
});

export type RendererState = z.infer<typeof RendererStateSchema>;

export const RenderOutputSchema = z.object({
  success: z.boolean(),
  render_packet_id: z.string().optional(),
  render_packet_hash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  rendered_command_count: z.number().int().min(0),
  frame_time_ms: z.number().finite().min(0),
  message: z.string().optional(),
});

export type RenderOutput = z.infer<typeof RenderOutputSchema>;

export const RenderCommandExecutionSchema = z.object({
  cmd_id: z.string().min(1),
  kind: z.literal("draw_primitive"),
  draw_index: z.number().int().min(0),
  node_id: z.string().min(1).max(200),
  result: z.enum(["success", "warning", "error"]),
  message: z.string().optional(),
});

export type RenderCommandExecution = z.infer<typeof RenderCommandExecutionSchema>;

export const RendererRequestV1Schema = z.object({
  request_id: z.string().min(1).max(200),
  actor_id: z.string().min(1).max(200),
  action: z.enum(["initialize", "render", "screenshot"]),
  config: RendererConfigSchema.optional(),
  render_packet_id: z.string().optional(),
});

export type RendererRequestV1 = z.infer<typeof RendererRequestV1Schema>;

export const RendererResponseV1Schema = z.object({
  request_id: z.string().min(1).max(200),
  success: z.boolean(),
  action: z.enum(["initialize", "render", "screenshot"]),
  output: RenderOutputSchema.optional(),
  executions: z.array(RenderCommandExecutionSchema).optional(),
  message: z.string().optional(),
});

export type RendererResponseV1 = z.infer<typeof RendererResponseV1Schema>;

export const RendererLedgerEventV1Schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("renderer.initialized.v1"),
    time_utc: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
    actor_id: z.string().min(1).max(200),
    request_id: z.string().min(1).max(200),
    canvas_id: z.string().min(1).max(200),
    width_px: z.number().int(),
    height_px: z.number().int(),
  }),
  z.object({
    type: z.literal("renderer.rendered.v1"),
    time_utc: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
    actor_id: z.string().min(1).max(200),
    request_id: z.string().min(1).max(200),
    render_packet_id: z.string().min(1),
    render_packet_hash: z.string().regex(/^[0-9a-f]{64}$/),
    command_count: z.number().int().min(0),
    frame_time_ms: z.number().finite().min(0),
  }),
  z.object({
    type: z.literal("renderer.error.v1"),
    time_utc: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
    actor_id: z.string().min(1).max(200),
    request_id: z.string().min(1).max(200),
    error_message: z.string().min(1),
  }),
]);

export type RendererLedgerEventV1 = z.infer<typeof RendererLedgerEventV1Schema>;
