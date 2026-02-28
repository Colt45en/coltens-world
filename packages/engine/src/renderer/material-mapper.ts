import type { MaterialSpecV1 } from "../contracts/graphics-intent.v1";

/**
 * Maps MaterialSpecV1 to Three.js materials.
 * Handles standard PBR properties.
 */

export function createThreeMaterial(spec: MaterialSpecV1, THREE: any): any {
  if (spec.kind === "unlit") {
    const material = new THREE.MeshBasicMaterial({
      color: colorHexFromRgba(spec.base_color),
      fog: false,
    });
    return material;
  }

  if (spec.kind === "standard") {
    const material = new THREE.MeshStandardMaterial({
      color: colorHexFromRgba(spec.base_color),
      metalness: spec.metallic,
      roughness: spec.roughness,
      emissive: colorHexFromRgb(spec.emissive),
    });
    return material;
  }

  throw new Error(`Unknown material kind: ${spec.kind}`);
}

export function buildMaterialMap(materials: MaterialSpecV1[]): Map<string, any> {
  let THREE: any;
  if (typeof window !== "undefined" && (window as any).THREE) {
    THREE = (window as any).THREE;
  } else {
    try {
      THREE = require("three");
    } catch {
      throw new Error("Three.js not found");
    }
  }

  const map = new Map<string, any>();
  for (const spec of materials) {
    map.set(spec.material_id, createThreeMaterial(spec, THREE));
  }
  return map;
}

function colorHexFromRgba(rgba: { r: number; g: number; b: number; a: number }): number {
  return (
    Math.round(rgba.r * 255) * 0x10000 + Math.round(rgba.g * 255) * 0x100 + Math.round(rgba.b * 255)
  );
}

function colorHexFromRgb(rgb: { r: number; g: number; b: number }): number {
  return (
    Math.round(rgb.r * 255) * 0x10000 + Math.round(rgb.g * 255) * 0x100 + Math.round(rgb.b * 255)
  );
}
