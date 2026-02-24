import * as THREE from "three";
import { SimplifyModifier } from "three/examples/jsm/modifiers/SimplifyModifier.js";

export function buildLODForStaticMesh(
  mesh: THREE.Mesh,
  opts?: { distances?: number[]; ratios?: number[] }
): THREE.Object3D {
  const distances = opts?.distances ?? [0, 2.5, 6, 12];
  const ratios = opts?.ratios ?? [1, 0.6, 0.35, 0.2];

  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!position) return mesh;

  const baseCount = position.count;
  const modifier = new SimplifyModifier();
  const lod = new THREE.LOD();
  lod.name = `${mesh.name}_LOD`;

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

    lod.addLevel(lodMesh, distances[i] ?? i * 4);
  }

  return lod;
}

export function applyLODToMergedMeshes(
  root: THREE.Object3D,
  opts?: { distances?: number[]; ratios?: number[] }
): THREE.Group {
  const lodRoot = new THREE.Group();
  lodRoot.name = `${root.name || "Root"}_WithLOD`;

  root.children.forEach((child) => {
    const mesh = child as THREE.Mesh & { isSkinnedMesh?: boolean };
    if (mesh.isSkinnedMesh) {
      lodRoot.add(child);
      return;
    }

    if (mesh.isMesh) {
      lodRoot.add(buildLODForStaticMesh(mesh, opts));
      return;
    }

    lodRoot.add(child);
  });

  return lodRoot;
}
