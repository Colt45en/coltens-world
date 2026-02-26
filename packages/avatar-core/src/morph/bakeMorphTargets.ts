/**
 * Morph target baking: flatten morphTargetInfluences into geometry
 *
 * This module is DOM-free and works directly with THREE.BufferGeometry.
 * It deterministically bakes all active morph targets into the position and normal attributes.
 */
import * as THREE from "three";
import type { BakeMorphOptions } from "../types";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Bake all morph target influences into a geometry's position and normal attributes.
 * Returns a new geometry; does not mutate the input.
 *
 * @param geometry The source geometry (must have position and optionally normal/morph attributes)
 * @param influences Current morph target influence weights
 * @param opts Baking options (bakeNormals, clampWeights)
 * @returns New geometry with baked morphs, no morphTargetInfluences
 */
export function bakeMorphTargets(
  geometry: THREE.BufferGeometry,
  influences: number[],
  opts: BakeMorphOptions = {},
): THREE.BufferGeometry {
  const morphPos = geometry.morphAttributes.position as THREE.BufferAttribute[] | undefined;
  if (!morphPos || morphPos.length === 0) {
    // No morphs to bake, return clone
    return geometry.clone();
  }

  const bakeNormals = opts.bakeNormals ?? true;
  const clampWeights = opts.clampWeights ?? true;

  const basePosAttr = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!basePosAttr) return geometry.clone();

  const basePos = basePosAttr.array as Float32Array;
  const bakedPos = new Float32Array(basePos.length);
  bakedPos.set(basePos);

  const relative = (geometry as any).morphTargetsRelative === true;

  // Accumulate morphs into bakedPos
  for (let i = 0; i < morphPos.length; i++) {
    const morphAttr = morphPos[i];
    if (!morphAttr) continue;

    let weight = influences[i] ?? 0;
    if (clampWeights) weight = clamp01(weight);
    if (weight === 0) continue;

    const morph = morphAttr.array as Float32Array;

    if (relative) {
      for (let k = 0; k < bakedPos.length; k++) {
        bakedPos[k] = (bakedPos[k] ?? 0) + weight * (morph[k] ?? 0);
      }
    } else {
      for (let k = 0; k < bakedPos.length; k++) {
        bakedPos[k] = (bakedPos[k] ?? 0) + weight * ((morph[k] ?? 0) - (basePos[k] ?? 0));
      }
    }
  }

  const newGeometry = geometry.clone();
  newGeometry.setAttribute("position", new THREE.BufferAttribute(bakedPos, 3));

  if (bakeNormals) {
    const baseNormalAttr = newGeometry.getAttribute("normal") as THREE.BufferAttribute | undefined;
    const morphNormals = newGeometry.morphAttributes.normal as THREE.BufferAttribute[] | undefined;

    if (baseNormalAttr && morphNormals && morphNormals.length > 0) {
      const baseNormals = baseNormalAttr.array as Float32Array;
      const bakedNormals = new Float32Array(baseNormals.length);
      bakedNormals.set(baseNormals);

      const normalsRelative = (newGeometry as any).morphTargetsRelative === true;

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

      // Normalize baked normals
      for (let k = 0; k < bakedNormals.length; k += 3) {
        const x = bakedNormals[k] ?? 0;
        const y = bakedNormals[k + 1] ?? 0;
        const z = bakedNormals[k + 2] ?? 1;
        const len = Math.sqrt(x * x + y * y + z * z) || 1;
        bakedNormals[k] = x / len;
        bakedNormals[k + 1] = y / len;
        bakedNormals[k + 2] = z / len;
      }

      newGeometry.setAttribute("normal", new THREE.BufferAttribute(bakedNormals, 3));
    } else {
      newGeometry.computeVertexNormals();
    }
  }

  // Clear morphTargets
  newGeometry.morphAttributes = {};
  (newGeometry as any).morphTargetsRelative = false;

  return newGeometry;
}

/**
 * Convenience wrapper: bake morphs for a mesh in-place.
 * Replaces mesh.geometry with baked version and clears influences.
 */
export function bakeMorphTargetsInMesh(
  mesh: THREE.Mesh | THREE.SkinnedMesh,
  opts: BakeMorphOptions = {},
): void {
  const influences = (mesh as any).morphTargetInfluences as number[] | undefined;
  if (!influences || influences.length === 0) return;

  const bakedGeom = bakeMorphTargets(mesh.geometry as THREE.BufferGeometry, influences, opts);
  mesh.geometry = bakedGeom;

  // Clear influences
  (mesh as any).morphTargetInfluences = Array(influences.length).fill(0);
  (mesh as any).morphTargetDictionary = undefined;
}
