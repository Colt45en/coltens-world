/**
 * Export GLB: GLTFExporter orchestration
 *
 * Converts a THREE.Object3D scene to GLB binary format.
 * No DOM operations; just THREE math and serialization.
 */
import type * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

export type ExportGLBOptions = {
  binary?: boolean;
  onlyVisible?: boolean;
  margin?: number;
  maxTextureSize?: number;
};

/**
 * Export a THREE scene to GLB binary.
 * Promise-based to match GLTFExporter's callback API.
 *
 * @param scene Root object to export
 * @param opts Export options
 * @returns GLB binary as ArrayBuffer
 */
export async function exportSceneToGLB(
  scene: THREE.Object3D,
  opts: ExportGLBOptions = {},
): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter();

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          reject(new Error("GLTFExporter returned non-ArrayBuffer result"));
        }
      },
      (error) => reject(error),
      {
        binary: opts.binary ?? true,
        onlyVisible: opts.onlyVisible ?? true,
        maxTextureSize: opts.maxTextureSize ?? 4096,
      }
    );
  });
}
