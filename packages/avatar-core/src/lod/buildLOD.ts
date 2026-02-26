/**
 * LOD: build distance-based level-of-detail using SimplifyModifier
 */
import type * as THREE from "three";
import { SimplifyModifier } from "three/examples/jsm/modifiers/SimplifyModifier.js";
import type { LODConfig } from "../types.js";

/**
 * Build LOD levels for a single static mesh.
 * Creates a THREE.LOD with multiple levels at increasing distances.
 *
 * @param mesh Static mesh to create LODs for
 * @param config LOD distances and simplification ratios
 * @returns THREE.LOD object (or original mesh if single level)
 */
export function buildLODForStaticMesh(mesh: THREE.Mesh, config: LODConfig = {}): THREE.Object3D {
  const distances = config.distances ?? [0, 2.5, 6, 12];
  const ratios = config.ratios ?? [1, 0.6, 0.35, 0.2];

  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!position) return mesh;

  const baseCount = position.count;
  const modifier = new SimplifyModifier();
  const lod = new THREE.LOD();
  lod.name = `${mesh.name}_LOD`;

  // Build stable LOD levels
  for (let i = 0; i < ratios.length; i++) {
    const ratio = ratios[i] ?? 1;
    const targetCount = Math.max(24, Math.floor(baseCount * ratio));

    let lodGeometry: THREE.BufferGeometry;
    if (i === 0) {
      lodGeometry = geometry.clone();
    } else {
      const src = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      lodGeometry = modifier.modify(src, targetCount);
      lodGeometry.computeVertexNormals();
    }

    const lodMesh = new THREE.Mesh(lodGeometry, mesh.material);
    lodMesh.name = `${mesh.name}_L${i}`;
    lodMesh.castShadow = mesh.castShadow;
    lodMesh.receiveShadow = mesh.receiveShadow;

    const distance = distances[i] ?? i * 4;
    lod.addLevel(lodMesh, distance);
  }

  return lod;
}

/**
 * Apply LOD to all static meshes in a hierarchy.
 * Preserves skinned meshes as-is.
 *
 * @param root Root object
 * @param config LOD distances and ratios
 * @returns New group with LOD-ified meshes
 */
export function applyLODToMergedMeshes(root: THREE.Object3D, config: LODConfig = {}): THREE.Group {
  const lodRoot = new THREE.Group();
  lodRoot.name = `${root.name || "Root"}_WithLOD`;

  root.children.forEach((child) => {
    const mesh = child as any;
    if (mesh.isSkinnedMesh) {
      lodRoot.add(child);
      return;
    }

    if (mesh.isMesh) {
      lodRoot.add(buildLODForStaticMesh(mesh, config));
      return;
    }

    lodRoot.add(child);
  });

  return lodRoot;
}
