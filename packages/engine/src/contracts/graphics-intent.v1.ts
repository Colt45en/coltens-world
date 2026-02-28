import { z } from "zod";

/**
 * Graphics Intent Contracts v1
 * Deterministic, content-addressed scene/material/viewport snapshots
 * and a render packet the UI can interpret.
 */

export const GFX_INTENT_V1 = {
  schema_version: "gfx-intent.v1",
  id_prefix: "gfx",
  hash_alg: "sha256",
  quantize_step: 1e-6,
} as const;

const Hex64 = z.string().regex(/^[0-9a-f]{64}$/);
export const GfxIdSchema = z
  .string()
  .regex(/^gfx:[a-z0-9-]+:[0-9a-f]{64}$/);

export const IsoUtcSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

export const Vec3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});

export const QuatSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
  w: z.number().finite(),
});

export const ColorRgbSchema = z.object({
  r: z.number().finite().min(0).max(1),
  g: z.number().finite().min(0).max(1),
  b: z.number().finite().min(0).max(1),
});

export const ColorRgbaSchema = ColorRgbSchema.extend({
  a: z.number().finite().min(0).max(1),
});

export const TransformTrsSchema = z.object({
  t: Vec3Schema,
  r: QuatSchema,
  s: Vec3Schema,
});

export type Vec3 = z.infer<typeof Vec3Schema>;
export type Quat = z.infer<typeof QuatSchema>;
export type ColorRgba = z.infer<typeof ColorRgbaSchema>;
export type TransformTrs = z.infer<typeof TransformTrsSchema>;

export const PrimitiveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("box"),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    depth: z.number().finite().positive(),
  }),
  z.object({
    kind: z.literal("sphere"),
    radius: z.number().finite().positive(),
    width_segments: z.number().int().min(3).max(256),
    height_segments: z.number().int().min(2).max(256),
  }),
  z.object({
    kind: z.literal("plane"),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
  }),
  z.object({
    kind: z.literal("cylinder"),
    radius_top: z.number().finite().positive(),
    radius_bottom: z.number().finite().positive(),
    height: z.number().finite().positive(),
    radial_segments: z.number().int().min(3).max(256),
  }),
]);

export type Primitive = z.infer<typeof PrimitiveSchema>;

export const MaterialSpecV1Schema = z.object({
  material_id: z.string().min(1).max(200),
  kind: z.enum(["unlit", "standard"]),
  base_color: ColorRgbaSchema,
  metallic: z.number().finite().min(0).max(1),
  roughness: z.number().finite().min(0).max(1),
  emissive: ColorRgbSchema,
});

export type MaterialSpecV1 = z.infer<typeof MaterialSpecV1Schema>;

export const NodeSpecV1Schema = z.object({
  node_id: z.string().min(1).max(200),
  kind: z.enum(["group", "mesh", "light", "camera"]),
  name: z.string().min(1).max(200),
  transform: TransformTrsSchema,
  children: z.array(z.string().min(1).max(200)),
  mesh: z
    .object({
      primitive: PrimitiveSchema,
      material_id: z.string().min(1).max(200),
      layer: z.number().int().min(0).max(255),
      render_order: z.number().int().min(-32768).max(32767),
    })
    .optional(),
  light: z
    .object({
      kind: z.enum(["directional", "point", "ambient"]),
      color: ColorRgbSchema,
      intensity: z.number().finite().min(0).max(1000),
    })
    .optional(),
  camera: z
    .object({
      kind: z.enum(["perspective", "orthographic"]),
      // perspective
      fov_deg: z.number().finite().min(1).max(179).optional(),
      near: z.number().finite().positive().optional(),
      far: z.number().finite().positive().optional(),
      // ortho
      left: z.number().finite().optional(),
      right: z.number().finite().optional(),
      top: z.number().finite().optional(),
      bottom: z.number().finite().optional(),
    })
    .optional(),
});

export type NodeSpecV1 = z.infer<typeof NodeSpecV1Schema>;

export const SceneSpecV1Schema = z.object({
  scene_id: z.string().min(1).max(200),
  root_nodes: z.array(z.string().min(1).max(200)),
  nodes: z.array(NodeSpecV1Schema).min(1),
});

export type SceneSpecV1 = z.infer<typeof SceneSpecV1Schema>;

export const ViewportSpecV1Schema = z.object({
  viewport_id: z.string().min(1).max(200),
  width_px: z.number().int().min(1).max(16384),
  height_px: z.number().int().min(1).max(16384),
  background: ColorRgbaSchema,
  camera_node_id: z.string().min(1).max(200),
  tonemap: z.enum(["none", "aces"]).default("aces"),
  exposure: z.number().finite().min(0.01).max(10),
});

export type ViewportSpecV1 = z.infer<typeof ViewportSpecV1Schema>;

export const SnapshotKindV1Schema = z.enum([
  "scene",
  "materials",
  "viewport",
  "render-packet",
]);

export type SnapshotKindV1 = z.infer<typeof SnapshotKindV1Schema>;

export const SnapshotEnvelopeV1Schema = z.object({
  id: GfxIdSchema,
  kind: SnapshotKindV1Schema,
  created_at_utc: IsoUtcSchema,
  hash_sha256: Hex64,
  canonical_json: z.string().min(2),
});

export type SnapshotEnvelopeV1 = z.infer<typeof SnapshotEnvelopeV1Schema>;

export const SceneComposeRequestV1Schema = z.object({
  request_id: z.string().min(1).max(200),
  actor_id: z.string().min(1).max(200),
  scene: SceneSpecV1Schema,
});

export const SceneComposeResponseV1Schema = z.object({
  scene_snapshot: SnapshotEnvelopeV1Schema,
});

export type SceneComposeRequestV1 = z.infer<typeof SceneComposeRequestV1Schema>;
export type SceneComposeResponseV1 = z.infer<typeof SceneComposeResponseV1Schema>;

export const MaterialBindRequestV1Schema = z.object({
  request_id: z.string().min(1).max(200),
  actor_id: z.string().min(1).max(200),
  materials: z.array(MaterialSpecV1Schema).min(1),
});

export const MaterialBindResponseV1Schema = z.object({
  materials_snapshot: SnapshotEnvelopeV1Schema,
});

export type MaterialBindRequestV1 = z.infer<typeof MaterialBindRequestV1Schema>;
export type MaterialBindResponseV1 = z.infer<typeof MaterialBindResponseV1Schema>;

export const ViewportDefineRequestV1Schema = z.object({
  request_id: z.string().min(1).max(200),
  actor_id: z.string().min(1).max(200),
  viewport: ViewportSpecV1Schema,
});

export const ViewportDefineResponseV1Schema = z.object({
  viewport_snapshot: SnapshotEnvelopeV1Schema,
});

export type ViewportDefineRequestV1 = z.infer<typeof ViewportDefineRequestV1Schema>;
export type ViewportDefineResponseV1 = z.infer<typeof ViewportDefineResponseV1Schema>;

export const RenderCommandV1Schema = z.object({
  cmd_id: GfxIdSchema,
  kind: z.literal("draw_primitive"),
  draw_index: z.number().int().min(0),
  node_id: z.string().min(1).max(200),
  primitive: PrimitiveSchema,
  transform: TransformTrsSchema,
  material: MaterialSpecV1Schema,
  layer: z.number().int().min(0).max(255),
  render_order: z.number().int().min(-32768).max(32767),
});

export type RenderCommandV1 = z.infer<typeof RenderCommandV1Schema>;

export const RenderPacketBodyV1Schema = z.object({
  schema_version: z.literal(GFX_INTENT_V1.schema_version),
  scene_snapshot_id: GfxIdSchema,
  materials_snapshot_id: GfxIdSchema,
  viewport_snapshot_id: GfxIdSchema,
  commands: z.array(RenderCommandV1Schema),
});

export type RenderPacketBodyV1 = z.infer<typeof RenderPacketBodyV1Schema>;

export const ViewportRenderRequestV1Schema = z.object({
  request_id: z.string().min(1).max(200),
  actor_id: z.string().min(1).max(200),
  scene_snapshot_id: GfxIdSchema,
  materials_snapshot_id: GfxIdSchema,
  viewport_snapshot_id: GfxIdSchema,
});

export const ViewportRenderResponseV1Schema = z.object({
  render_packet: SnapshotEnvelopeV1Schema,
});

export type ViewportRenderRequestV1 = z.infer<typeof ViewportRenderRequestV1Schema>;
export type ViewportRenderResponseV1 = z.infer<typeof ViewportRenderResponseV1Schema>;

/**
 * Ledger event shapes (append-only).
 * These are intentionally "thin": they point to content-addressed snapshots.
 */
export const GfxLedgerEventV1Schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("gfx.scene_composed.v1"),
    time_utc: IsoUtcSchema,
    actor_id: z.string().min(1).max(200),
    request_id: z.string().min(1).max(200),
    scene_snapshot_id: GfxIdSchema,
    scene_hash_sha256: Hex64,
  }),
  z.object({
    type: z.literal("gfx.materials_bound.v1"),
    time_utc: IsoUtcSchema,
    actor_id: z.string().min(1).max(200),
    request_id: z.string().min(1).max(200),
    materials_snapshot_id: GfxIdSchema,
    materials_hash_sha256: Hex64,
  }),
  z.object({
    type: z.literal("gfx.viewport_defined.v1"),
    time_utc: IsoUtcSchema,
    actor_id: z.string().min(1).max(200),
    request_id: z.string().min(1).max(200),
    viewport_snapshot_id: GfxIdSchema,
    viewport_hash_sha256: Hex64,
  }),
  z.object({
    type: z.literal("gfx.render_packet_created.v1"),
    time_utc: IsoUtcSchema,
    actor_id: z.string().min(1).max(200),
    request_id: z.string().min(1).max(200),
    render_packet_id: GfxIdSchema,
    render_packet_hash_sha256: Hex64,
    scene_snapshot_id: GfxIdSchema,
    materials_snapshot_id: GfxIdSchema,
    viewport_snapshot_id: GfxIdSchema,
    command_count: z.number().int().min(0),
  }),
]);

export type GfxLedgerEventV1 = z.infer<typeof GfxLedgerEventV1Schema>;
