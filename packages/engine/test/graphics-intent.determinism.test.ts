import assert from "node:assert/strict";
import test from "node:test";

import {
    materialBind,
    sceneCompose,
    viewportDefine,
    viewportRender,
} from "../src/graphics-intent/builders";
import { GraphicsIntentStore } from "../src/graphics-intent/store";

function shuffle<T>(arr: T[], seed: number): T[] {
  // Deterministic shuffle for testing
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

test("Graphics Intent v1: snapshot + render packet determinism across runs", () => {
  const hashes: string[] = [];

  for (let run = 0; run < 5; run++) {
    const store = new GraphicsIntentStore();

    const nodes = [
      {
        node_id: "n_root",
        kind: "group",
        name: "Root",
        transform: {
          t: { x: 0, y: 0, z: 0 },
          r: { x: 0, y: 0, z: 0, w: 1 },
          s: { x: 1, y: 1, z: 1 },
        },
        children: ["n_mesh_b", "n_mesh_a"],
      },
      {
        node_id: "n_mesh_a",
        kind: "mesh",
        name: "Box A",
        transform: {
          t: { x: 1, y: 0, z: 0 },
          r: { x: 0, y: 0, z: 0, w: 1 },
          s: { x: 1, y: 1, z: 1 },
        },
        children: [],
        mesh: {
          primitive: { kind: "box", width: 1, height: 1, depth: 1 },
          material_id: "mat_red",
          layer: 0,
          render_order: 10,
        },
      },
      {
        node_id: "n_mesh_b",
        kind: "mesh",
        name: "Sphere B",
        transform: {
          t: { x: 0.30000000000000004, y: 0, z: 0 },
          r: { x: 0, y: 0, z: 0, w: 1 },
          s: { x: 1, y: 1, z: 1 },
        },
        children: [],
        mesh: {
          primitive: {
            kind: "sphere",
            radius: 0.5,
            width_segments: 16,
            height_segments: 12,
          },
          material_id: "mat_blue",
          layer: 0,
          render_order: 5,
        },
      },
    ];

    const sceneReq = {
      request_id: `req_scene_${run}`,
      actor_id: "alice",
      scene: {
        scene_id: "scene_main",
        root_nodes: shuffle(["n_root"], run + 1),
        nodes: shuffle(nodes, run + 2),
      },
    };

    const matsReq = {
      request_id: `req_mats_${run}`,
      actor_id: "alice",
      materials: shuffle(
        [
          {
            material_id: "mat_blue",
            kind: "standard",
            base_color: { r: 0, g: 0.2, b: 1, a: 1 },
            metallic: 0,
            roughness: 0.4,
            emissive: { r: 0, g: 0, b: 0 },
          },
          {
            material_id: "mat_red",
            kind: "standard",
            base_color: { r: 1, g: 0.1, b: 0.1, a: 1 },
            metallic: 0,
            roughness: 0.5,
            emissive: { r: 0, g: 0, b: 0 },
          },
        ],
        run + 3
      ),
    };

    const vpReq = {
      request_id: `req_vp_${run}`,
      actor_id: "alice",
      viewport: {
        viewport_id: "vp_main",
        width_px: 1280,
        height_px: 720,
        background: { r: 0.05, g: 0.05, b: 0.07, a: 1 },
        camera_node_id: "n_cam",
        tonemap: "aces",
        exposure: 1,
      },
    };

    // Define a camera node inside the scene (unsorted insertion)
    sceneReq.scene.nodes.push({
      node_id: "n_cam",
      kind: "camera",
      name: "Main Camera",
      transform: {
        t: { x: 0, y: 2, z: 5 },
        r: { x: 0, y: 0, z: 0, w: 1 },
        s: { x: 1, y: 1, z: 1 },
      },
      children: [],
      camera: { kind: "perspective", fov_deg: 60, near: 0.1, far: 1000 },
    } as any);

    const s1 = sceneCompose(store, sceneReq as any);
    const m1 = materialBind(store, matsReq as any);
    const v1 = viewportDefine(store, vpReq as any);

    const r1 = viewportRender(
      store,
      {
        request_id: `req_render_${run}`,
        actor_id: "alice",
        scene_snapshot_id: s1.res.scene_snapshot.id,
        materials_snapshot_id: m1.res.materials_snapshot.id,
        viewport_snapshot_id: v1.res.viewport_snapshot.id,
      } as any
    );

    hashes.push(
      [
        s1.res.scene_snapshot.hash_sha256,
        m1.res.materials_snapshot.hash_sha256,
        v1.res.viewport_snapshot.hash_sha256,
        r1.res.render_packet.hash_sha256,
      ].join(":")
    );
  }

  for (let i = 1; i < hashes.length; i++) {
    assert.equal(hashes[i], hashes[0], `Run ${i} hash mismatch`);
  }
});
