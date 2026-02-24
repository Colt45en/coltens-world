import * as THREE from "three";

type BakeOptions = {
  bakeNormals?: boolean;
  clampWeights?: boolean;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function bakeMorphTargetsIntoGeometry(mesh: THREE.Mesh | THREE.SkinnedMesh, opts: BakeOptions = {}): void {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const influences = (mesh as THREE.Mesh).morphTargetInfluences;
  const dict = (mesh as THREE.Mesh).morphTargetDictionary;
  const morphPos = geometry.morphAttributes.position as THREE.BufferAttribute[] | undefined;

  if (!influences || !dict || !morphPos || morphPos.length === 0) return;

  const bakeNormals = opts.bakeNormals ?? true;
  const clampWeights = opts.clampWeights ?? true;

  const basePosAttr = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!basePosAttr) return;

  const basePos = basePosAttr.array as Float32Array;
  const bakedPos = new Float32Array(basePos.length);
  bakedPos.set(basePos);

  const relative = (geometry as THREE.BufferGeometry & { morphTargetsRelative?: boolean }).morphTargetsRelative === true;

  for (let i = 0; i < morphPos.length; i++) {
    const morphAttr = morphPos[i];
    if (!morphAttr) continue;
    let weight = influences[i] ?? 0;
    if (clampWeights) weight = clamp01(weight);
    if (weight === 0) continue;

    const morph = morphAttr.array as Float32Array;

    if (relative) {
      for (let k = 0; k < bakedPos.length; k++) bakedPos[k] = (bakedPos[k] ?? 0) + weight * (morph[k] ?? 0);
    } else {
      for (let k = 0; k < bakedPos.length; k++) {
        bakedPos[k] = (bakedPos[k] ?? 0) + weight * ((morph[k] ?? 0) - (basePos[k] ?? 0));
      }
    }
  }

  const newGeometry = geometry.clone();
  newGeometry.setAttribute("position", new THREE.BufferAttribute(bakedPos, 3));
  const positionAttr = newGeometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (positionAttr) positionAttr.needsUpdate = true;

  if (bakeNormals) {
    const baseNormalAttr = newGeometry.getAttribute("normal") as THREE.BufferAttribute | undefined;
    const morphNormals = newGeometry.morphAttributes.normal as THREE.BufferAttribute[] | undefined;

    if (baseNormalAttr && morphNormals && morphNormals.length > 0) {
      const baseNormals = baseNormalAttr.array as Float32Array;
      const bakedNormals = new Float32Array(baseNormals.length);
      bakedNormals.set(baseNormals);

      const normalsRelative =
        (newGeometry as THREE.BufferGeometry & { morphTargetsRelative?: boolean }).morphTargetsRelative === true;

      for (let i = 0; i < morphNormals.length; i++) {
        const morphAttr = morphNormals[i];
        if (!morphAttr) continue;
        let weight = influences[i] ?? 0;
        if (clampWeights) weight = clamp01(weight);
        if (weight === 0) continue;

        const morph = morphAttr.array as Float32Array;
        if (normalsRelative) {
          for (let k = 0; k < bakedNormals.length; k++) {
            bakedNormals[k] = (bakedNormals[k] ?? 0) + weight * (morph[k] ?? 0);
          }
        } else {
          for (let k = 0; k < bakedNormals.length; k++) {
            bakedNormals[k] = (bakedNormals[k] ?? 0) + weight * ((morph[k] ?? 0) - (baseNormals[k] ?? 0));
          }
        }
      }

      for (let k = 0; k < bakedNormals.length; k += 3) {
        const x = bakedNormals[k] ?? 0;
        const y = bakedNormals[k + 1] ?? 0;
        const z = bakedNormals[k + 2] ?? 1;
        const length = Math.sqrt(x * x + y * y + z * z) || 1;
        bakedNormals[k] = x / length;
        bakedNormals[k + 1] = y / length;
        bakedNormals[k + 2] = z / length;
      }

      newGeometry.setAttribute("normal", new THREE.BufferAttribute(bakedNormals, 3));
      const normalAttr = newGeometry.getAttribute("normal") as THREE.BufferAttribute | undefined;
      if (normalAttr) normalAttr.needsUpdate = true;
    } else {
      newGeometry.computeVertexNormals();
    }
  }

  newGeometry.morphAttributes = {};
  (newGeometry as THREE.BufferGeometry & { morphTargetsRelative?: boolean }).morphTargetsRelative = false;

  mesh.geometry = newGeometry;

  for (let i = 0; i < influences.length; i++) influences[i] = 0;
  (mesh as THREE.Mesh).morphTargetDictionary = undefined;
  (mesh as THREE.Mesh).morphTargetInfluences = undefined;
}
