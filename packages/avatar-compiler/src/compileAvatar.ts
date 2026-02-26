/**
 * Main compiler orchestration API
 *
 * Bundles avatar compilation: morph baking, LOD, atlas, merge, GLB export.
 */
import {
    applyLODToMergedMeshes,
    bakeAtlas,
    bakeMorphTargetsInMesh,
    inferPartKey,
    mergeStaticMeshesByPart,
    remapGeometryUVsToRect,
    type AtlasRect,
    type LODConfig,
    type PartKey,
} from "@world-engine/avatar-core";
import type * as THREE from "three";

import { exportSceneToGLB } from "./export/exportGLB.js";
import { hashBuffer } from "./hash.js";

export type CompileAvatarOptions = {
  filename?: string;
  clone?: boolean;
  bakeMorphs?: boolean;
  bakeNormals?: boolean;
  mergeByPart?: boolean;
  lod?: LODConfig & { enabled?: boolean };
  atlas?: {
    enabled?: boolean;
    size?: number;
    slots?: Array<{ key: string; pixelBuffer?: Uint8ClampedArray }>;
  };
};

export type CompileAvatarResult = {
  glbBuffer: ArrayBuffer;
  glbHash: string;
  byteLength: number;
  ms: number;
};

/**
 * Compile an avatar to GLB.
 * Pure pipeline: morph baking → merge → LOD → atlas → GLB.
 *
 * @param group Avatar root object
 * @param opts Compilation options
 * @returns GLB binary + hash + perf metrics
 */
export async function compileAvatar(
  group: THREE.Object3D,
  opts: CompileAvatarOptions = {},
): Promise<CompileAvatarResult> {
  const start = performance.now();

  const clone = opts.clone ?? true;
  const bakeMorphs = opts.bakeMorphs ?? true;
  const bakeNormals = opts.bakeNormals ?? true;
  const mergeByPart = opts.mergeByPart ?? true;

  // Step 1: Clone if needed
  let target = clone ? group.clone(true) : group;
  target.updateMatrixWorld(true);

  // Step 2: Bake morphs
  if (bakeMorphs) {
    target.traverse((obj) => {
      const mesh = obj as any;
      if (!mesh.isMesh) return;

      const hasActive =
        Array.isArray(mesh.morphTargetInfluences) &&
        mesh.morphTargetInfluences.length > 0 &&
        mesh.morphTargetInfluences.some((w: number) => w !== 0);

      if (hasActive) {
        bakeMorphTargetsInMesh(mesh, { bakeNormals });
      }
    });
  }

  // Step 3: Bake atlas if enabled
  let rectByKey: Record<string, AtlasRect> = {};
  let atlasMaterial: THREE.Material | undefined;

  if (opts.atlas?.enabled) {
    const atlasSlots = opts.atlas.slots ?? [];
    const atlasResult = bakeAtlas({
      atlasSize: opts.atlas.size ?? 2048,
      slots: atlasSlots,
    });

    rectByKey = atlasResult.rectByKey;

    // Convert pixel buffer to THREE.DataTexture
    const w = opts.atlas.size ?? 2048;
    const h = w;
    const data = atlasResult.surface.getPixels();
    atlasMaterial = new THREE.MeshStandardMaterial({
      map: new THREE.DataTexture(data, w,h, THREE.RGBAFormat),
    });

    // Remap UVs for all meshes
    target.traverse((obj) => {
      const mesh = obj as any;
      if (!mesh.isMesh) return;

      const part = inferPartKey(mesh);
      const rect = rectByKey[part];
      if (rect) {
        remapGeometryUVsToRect(mesh.geometry, rect);
      }
    });
  }

  // Step 4: Merge by part
  let merged: THREE.Object3D = target;
  if (mergeByPart) {
    const materials: Record<PartKey, THREE.Material> = {
      skin: atlasMaterial ?? new THREE.MeshStandardMaterial(),
      clothing: atlasMaterial ?? new THREE.MeshStandardMaterial(),
      hair: atlasMaterial ?? new THREE.MeshStandardMaterial(),
      eyes: atlasMaterial ?? new THREE.MeshStandardMaterial(),
      other: atlasMaterial ?? new THREE.MeshStandardMaterial(),
    };
    merged = mergeStaticMeshesByPart(target, materials);
    merged.updateMatrixWorld(true);
  }

  // Step 5: Apply LOD
  let final: THREE.Object3D = merged;
  if (opts.lod?.enabled) {
    final = applyLODToMergedMeshes(merged, {
      distances: opts.lod.distances,
      ratios: opts.lod.ratios,
    });
    final.updateMatrixWorld(true);
  }

  // Step 6: Export GL B
  const glbBuffer = await exportSceneToGLB(final);
  const glbHash = hashBuffer(glbBuffer);
  const ms = performance.now() - start;

  return {
    glbBuffer,
    glbHash,
    byteLength: glbBuffer.byteLength,
    ms,
  };
}
