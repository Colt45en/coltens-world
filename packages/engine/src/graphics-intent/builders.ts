import {
    GFX_INTENT_V1,
    MaterialBindRequestV1Schema,
    SceneComposeRequestV1Schema,
    ViewportDefineRequestV1Schema,
    ViewportRenderRequestV1Schema,
    type GfxLedgerEventV1,
    type MaterialBindRequestV1,
    type MaterialBindResponseV1,
    type RenderPacketBodyV1,
    type SceneComposeRequestV1,
    type SceneComposeResponseV1,
    type SnapshotEnvelopeV1,
    type ViewportDefineRequestV1,
    type ViewportDefineResponseV1,
    type ViewportRenderRequestV1,
    type ViewportRenderResponseV1,
} from "../contracts/graphics-intent.v1";
import { canonicalStringify, type Json } from "./canonical";
import { sha256Hex } from "./hash";
import { normalizeMaterials, normalizeScene, normalizeViewport } from "./normalize";
import { GraphicsIntentStore } from "./store";

function isoUtcNowSeconds(now: Date): string {
  // matches YYYY-MM-DDTHH:mm:SSZ (no millis)
  return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function makeId(kind: string, hashHex: string): string {
  return `gfx:${kind}:${hashHex}`;
}

function makeSnapshot(
  kind: SnapshotEnvelopeV1["kind"],
  createdAtUtc: string,
  body: Json
): SnapshotEnvelopeV1 {
  const canonical = canonicalStringify(body);
  const hash = sha256Hex(canonical);
  const id = makeId(`${kind}-snap`, hash);
  return {
    id,
    kind,
    created_at_utc: createdAtUtc,
    hash_sha256: hash,
    canonical_json: canonical,
  };
}

export function sceneCompose(
  store: GraphicsIntentStore,
  req: SceneComposeRequestV1,
  now: Date = new Date()
): { res: SceneComposeResponseV1; ledger: GfxLedgerEventV1 } {
  const parsed = SceneComposeRequestV1Schema.parse(req);
  const created = isoUtcNowSeconds(now);

  const sceneNorm = normalizeScene(parsed.scene, GFX_INTENT_V1.quantize_step);

  const body: Json = {
    schema_version: GFX_INTENT_V1.schema_version,
    scene: sceneNorm,
  };

  const snap = makeSnapshot("scene", created, body);
  store.ingest(snap);

  return {
    res: { scene_snapshot: snap },
    ledger: {
      type: "gfx.scene_composed.v1",
      time_utc: created,
      actor_id: parsed.actor_id,
      request_id: parsed.request_id,
      scene_snapshot_id: snap.id,
      scene_hash_sha256: snap.hash_sha256,
    },
  };
}

export function materialBind(
  store: GraphicsIntentStore,
  req: MaterialBindRequestV1,
  now: Date = new Date()
): { res: MaterialBindResponseV1; ledger: GfxLedgerEventV1 } {
  const parsed = MaterialBindRequestV1Schema.parse(req);
  const created = isoUtcNowSeconds(now);

  const matsNorm = normalizeMaterials(parsed.materials, GFX_INTENT_V1.quantize_step);

  const body: Json = {
    schema_version: GFX_INTENT_V1.schema_version,
    materials: matsNorm,
  };

  const snap = makeSnapshot("materials", created, body);
  store.ingest(snap);

  return {
    res: { materials_snapshot: snap },
    ledger: {
      type: "gfx.materials_bound.v1",
      time_utc: created,
      actor_id: parsed.actor_id,
      request_id: parsed.request_id,
      materials_snapshot_id: snap.id,
      materials_hash_sha256: snap.hash_sha256,
    },
  };
}

export function viewportDefine(
  store: GraphicsIntentStore,
  req: ViewportDefineRequestV1,
  now: Date = new Date()
): { res: ViewportDefineResponseV1; ledger: GfxLedgerEventV1 } {
  const parsed = ViewportDefineRequestV1Schema.parse(req);
  const created = isoUtcNowSeconds(now);

  const vpNorm = normalizeViewport(parsed.viewport, GFX_INTENT_V1.quantize_step);

  const body: Json = {
    schema_version: GFX_INTENT_V1.schema_version,
    viewport: vpNorm,
  };

  const snap = makeSnapshot("viewport", created, body);
  store.ingest(snap);

  return {
    res: { viewport_snapshot: snap },
    ledger: {
      type: "gfx.viewport_defined.v1",
      time_utc: created,
      actor_id: parsed.actor_id,
      request_id: parsed.request_id,
      viewport_snapshot_id: snap.id,
      viewport_hash_sha256: snap.hash_sha256,
    },
  };
}

type SceneBody = { schema_version: string; scene: any };
type MatsBody = { schema_version: string; materials: any[] };
type VpBody = { schema_version: string; viewport: any };

function parseSnapshotJson<T>(snap: SnapshotEnvelopeV1): T {
  return JSON.parse(snap.canonical_json) as T;
}

export function viewportRender(
  store: GraphicsIntentStore,
  req: ViewportRenderRequestV1,
  now: Date = new Date()
): { res: ViewportRenderResponseV1; ledger: GfxLedgerEventV1 } {
  const parsed = ViewportRenderRequestV1Schema.parse(req);
  const created = isoUtcNowSeconds(now);

  const sceneSnap = store.get(parsed.scene_snapshot_id);
  const matsSnap = store.get(parsed.materials_snapshot_id);
  const vpSnap = store.get(parsed.viewport_snapshot_id);

  const sceneBody = parseSnapshotJson<SceneBody>(sceneSnap);
  const matsBody = parseSnapshotJson<MatsBody>(matsSnap);
  const vpBody = parseSnapshotJson<VpBody>(vpSnap);

  const materialsById = new Map<string, any>();
  for (const m of matsBody.materials) materialsById.set(m.material_id, m);

  // Deterministic traversal:
  const nodesById = new Map<string, any>();
  for (const n of sceneBody.scene.nodes) nodesById.set(n.node_id, n);

  const roots: string[] = [...sceneBody.scene.root_nodes].sort();

  const commands: any[] = [];
  const visited = new Set<string>();

  function walk(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodesById.get(nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    if (node.kind === "mesh" && node.mesh) {
      const mat = materialsById.get(node.mesh.material_id);
      if (!mat) throw new Error(`Material not found: ${node.mesh.material_id}`);

      commands.push({
        kind: "draw_primitive",
        node_id: node.node_id,
        primitive: node.mesh.primitive,
        transform: node.transform,
        material: mat,
        layer: node.mesh.layer,
        render_order: node.mesh.render_order,
      });
    }

    const children: string[] = [...node.children].sort();
    for (const c of children) walk(c);
  }

  for (const r of roots) walk(r);

  // Deterministic command ordering: (layer asc, render_order asc, node_id asc)
  commands.sort((a, b) => {
    if (a.layer !== b.layer) return a.layer - b.layer;
    if (a.render_order !== b.render_order) return a.render_order - b.render_order;
    return a.node_id < b.node_id ? -1 : a.node_id > b.node_id ? 1 : 0;
  });

  // Assign deterministic cmd IDs and draw indices
  const finalized = commands.map((c, i) => {
    const cmdBody: Json = {
      draw_index: i,
      kind: "draw_primitive",
      layer: c.layer,
      material: c.material,
      node_id: c.node_id,
      primitive: c.primitive,
      render_order: c.render_order,
      transform: c.transform,
    };
    const cmdCanonical = canonicalStringify(cmdBody);
    const cmdHash = sha256Hex(cmdCanonical);
    return {
      cmd_id: makeId("cmd", cmdHash),
      ...cmdBody,
    };
  });

  const packetBody: RenderPacketBodyV1 = {
    schema_version: GFX_INTENT_V1.schema_version,
    scene_snapshot_id: sceneSnap.id,
    materials_snapshot_id: matsSnap.id,
    viewport_snapshot_id: vpSnap.id,
    commands: finalized as any,
  };

  const packetSnap = makeSnapshot("render-packet", created, packetBody as unknown as Json);
  store.ingest(packetSnap);

  return {
    res: { render_packet: packetSnap },
    ledger: {
      type: "gfx.render_packet_created.v1",
      time_utc: created,
      actor_id: parsed.actor_id,
      request_id: parsed.request_id,
      render_packet_id: packetSnap.id,
      render_packet_hash_sha256: packetSnap.hash_sha256,
      scene_snapshot_id: sceneSnap.id,
      materials_snapshot_id: matsSnap.id,
      viewport_snapshot_id: vpSnap.id,
      command_count: finalized.length,
    },
  };
}
