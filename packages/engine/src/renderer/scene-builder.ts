import type { NodeSpecV1 } from "../contracts/graphics-intent.v1";

/**
 * Maps NodeSpecV1 scene graph to Three.js objects.
 * Pure function: no side effects.
 */

export function buildThreeScene(
  nodes: NodeSpecV1[],
  rootNodeIds: string[],
  materialMap: Map<string, any>
): { scene: any; rootObjects: any[] } {
  // Dynamic require to avoid SSR issues
  let THREE: any;
  if (typeof window !== "undefined" && (window as any).THREE) {
    THREE = (window as any).THREE;
  } else {
    try {
      THREE = require("three");
    } catch {
      throw new Error("Three.js not found. Install via: npm install three");
    }
  }

  const scene = new THREE.Scene();
  const nodeMap = new Map<string, any>();

  // First pass: create all objects
  for (const node of nodes) {
    let object: any;

    if (node.kind === "group") {
      object = new THREE.Group();
    } else if (node.kind === "mesh" && node.mesh) {
      const geometry = buildGeometry(node.mesh.primitive, THREE);
      const material = materialMap.get(node.mesh.material_id) || new THREE.MeshStandardMaterial();
      object = new THREE.Mesh(geometry, material);
      object.renderOrder = node.mesh.render_order;
      object.userData.layer = node.mesh.layer;
    } else if (node.kind === "light" && node.light) {
      if (node.light.kind === "directional") {
        object = new THREE.DirectionalLight(
          colorHexFromRgb(node.light.color),
          node.light.intensity
        );
      } else if (node.light.kind === "point") {
        object = new THREE.PointLight(colorHexFromRgb(node.light.color), node.light.intensity);
      } else {
        object = new THREE.AmbientLight(colorHexFromRgb(node.light.color), node.light.intensity);
      }
    } else if (node.kind === "camera" && node.camera) {
      if (node.camera.kind === "perspective") {
        object = new THREE.PerspectiveCamera(
          node.camera.fov_deg ?? 60,
          1,
          node.camera.near ?? 0.1,
          node.camera.far ?? 1000
        );
      } else {
        object = new THREE.OrthographicCamera(
          node.camera.left ?? -10,
          node.camera.right ?? 10,
          node.camera.top ?? 10,
          node.camera.bottom ?? -10,
          node.camera.near ?? 0.1,
          node.camera.far ?? 1000
        );
      }
    } else {
      object = new THREE.Group();
    }

    object.name = node.name;
    object.position.set(node.transform.t.x, node.transform.t.y, node.transform.t.z);
    object.quaternion.set(
      node.transform.r.x,
      node.transform.r.y,
      node.transform.r.z,
      node.transform.r.w
    );
    object.scale.set(node.transform.s.x, node.transform.s.y, node.transform.s.z);

    nodeMap.set(node.node_id, object);
  }

  // Second pass: establish hierarchy
  for (const node of nodes) {
    const obj = nodeMap.get(node.node_id);
    if (!obj) continue;

    for (const childId of node.children) {
      const child = nodeMap.get(childId);
      if (child) {
        obj.add(child);
      }
    }
  }

  // Add roots to scene
  const rootObjects: any[] = [];
  for (const rootId of rootNodeIds) {
    const root = nodeMap.get(rootId);
    if (root) {
      scene.add(root);
      rootObjects.push(root);
    }
  }

  return { scene, rootObjects };
}

function buildGeometry(primitive: any, THREE: any): any {
  if (primitive.kind === "box") {
    return new THREE.BoxGeometry(primitive.width, primitive.height, primitive.depth);
  }
  if (primitive.kind === "sphere") {
    return new THREE.SphereGeometry(
      primitive.radius,
      primitive.width_segments,
      primitive.height_segments
    );
  }
  if (primitive.kind === "plane") {
    return new THREE.PlaneGeometry(primitive.width, primitive.height);
  }
  if (primitive.kind === "cylinder") {
    return new THREE.CylinderGeometry(
      primitive.radius_top,
      primitive.radius_bottom,
      primitive.height,
      primitive.radial_segments
    );
  }
  throw new Error(`Unknown primitive: ${primitive.kind}`);
}

function colorHexFromRgb(rgb: { r: number; g: number; b: number }): number {
  return (
    Math.round(rgb.r * 255) * 0x10000 + Math.round(rgb.g * 255) * 0x100 + Math.round(rgb.b * 255)
  );
}
