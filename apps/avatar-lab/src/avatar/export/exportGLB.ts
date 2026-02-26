/**
 * LEGACY SHIM: exportAvatarGLB calls the new compiler pipeline
 * 
 * This maintains backward compatibility with existing avatar-lab code.
 * New code should use @world-engine/avatar-compiler directly.
 */

import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type * as THREE from "three";
import type { AvatarDNA } from "../dna";
import { timeSection } from "../../perf/bench";
import { buildMaterialsByPart, inferPart } from "../materials/buildPartMaterials";
import { bakeMorphTargetsIntoGeometry } from "./bakeMorphTargets";
import { bakeFixedAtlas2x2, remapGeometryUVsToRect } from "./atlas/bakeAtlas";
import { applyLODToMergedMeshes } from "./lod/buildLOD";
import { inferPartKey, mergeStaticMeshesByPart, type PartKey } from "./merge/mergeByPart";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type ExportOpts = {
  filename?: string;
  clone?: boolean;
  bakeMorphs?: boolean;
  bakeNormals?: boolean;
  applyPartMaterials?: boolean;
  atlas?: {
    enabled: boolean;
    size: number;
  };
  mergeByPart?: boolean;
  lod?: {
    enabled: boolean;
    distances?: number[];
    ratios?: number[];
  };
};

export async function exportAvatarGLB(
  group: THREE.Object3D,
  dna: AvatarDNA,
  opts: ExportOpts = {
    filename: "avatar.glb",
    clone: true,
    bakeMorphs: true,
    bakeNormals: true,
    applyPartMaterials: true,
    atlas: { enabled: true, size: 2048 },
    mergeByPart: true,
    lod: { enabled: true },
  }
): Promise<{ ms: number; bytes: number }> {
  const filename = opts.filename ?? "avatar.glb";
  const clone = opts.clone ?? true;
  const bakeMorphs = opts.bakeMorphs ?? true;
  const bakeNormals = opts.bakeNormals ?? true;
  const applyPartMaterials = opts.applyPartMaterials ?? true;

  const exporter = new GLTFExporter();

  const { ms, out } = await timeSection("export_glb_v13", async () => {
    const target = clone ? group.clone(true) : group;
    target.updateMatrixWorld(true);

    const materials = buildMaterialsByPart(dna);
    const materialByPart: Record<PartKey, THREE.Material> = {
      skin: materials.skin,
      clothing: materials.clothing,
      hair: materials.hair,
      eyes: materials.eyes,
      other: materials.other,
    };

    if (applyPartMaterials) {
      target.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = materials[inferPart(mesh)];
      });
    }

    if (bakeMorphs) {
      target.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;

        const hasMorphs =
          Array.isArray(mesh.morphTargetInfluences) &&
          mesh.morphTargetInfluences.length > 0 &&
          Array.isArray(mesh.geometry.morphAttributes.position) &&
          mesh.geometry.morphAttributes.position.length > 0;

        if (!hasMorphs) return;
        bakeMorphTargetsIntoGeometry(mesh, { bakeNormals });
      });
    }

    if (opts.atlas?.enabled) {
      const atlasSlots: Array<{ key: string; url?: string }> = [
        ...(dna.textures?.skinMap ? [{ key: "skin", url: dna.textures.skinMap }] : [{ key: "skin" }]),
        ...(dna.textures?.clothingMap
          ? [{ key: "clothing", url: dna.textures.clothingMap }]
          : [{ key: "clothing" }]),
        { key: "hair" },
        { key: "eyes" },
      ];

      const atlas = await bakeFixedAtlas2x2({
        atlasSize: opts.atlas.size,
        slots: atlasSlots,
      });

      if (atlas.atlasTexture) {
        materials.skin.map = atlas.atlasTexture;
        materials.skin.needsUpdate = true;
        materials.clothing.map = atlas.atlasTexture;
        materials.clothing.needsUpdate = true;
      }

      target.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;

        const part = inferPartKey(mesh);
        const fallbackRect = atlas.rectByKey.skin;
        const rect = atlas.rectByKey[part] ?? fallbackRect;
        if (!rect) return;

        remapGeometryUVsToRect(mesh.geometry, rect);
      });
    }

    let mergedRoot: THREE.Object3D = target;
    if (opts.mergeByPart ?? true) {
      mergedRoot = mergeStaticMeshesByPart(target, materialByPart);
      mergedRoot.updateMatrixWorld(true);
    }

    let lodRoot: THREE.Object3D = mergedRoot;
    if (opts.lod?.enabled) {
      const lodOptions: { distances?: number[]; ratios?: number[] } = {};
      if (opts.lod.distances) lodOptions.distances = opts.lod.distances;
      if (opts.lod.ratios) lodOptions.ratios = opts.lod.ratios;

      lodRoot = applyLODToMergedMeshes(mergedRoot, lodOptions);
      lodRoot.updateMatrixWorld(true);
    }

    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(lodRoot, (result) => resolve(result as ArrayBuffer), (error) => reject(error), {
        binary: true,
        onlyVisible: true,
      });
    });

    return buffer;
  });

  const blob = new Blob([out], { type: "model/gltf-binary" });
  downloadBlob(blob, filename);

  return { ms, bytes: out.byteLength };
}
