/**
 * GLB Export System
 * Serializes avatar geometry to binary GLB format with metadata manifest
 */

import type { AvatarGeometryState } from "./contract.types.js";

/**
 * Avatar Manifest: Metadata for serialized avatars
 */
export interface AvatarManifest {
  version: "1.0";
  avatar_id: string;
  created_at: number; // Unix timestamp
  modified_at: number;
  geometry_hash: string; // SHA256 of canonical pose
  format: "glb";
  bone_count: number;
  material_slots: string[];
  metadata: {
    name: string;
    description?: string;
    author?: string;
    tags?: string[];
    [key: string]: any;
  };
}

/**
 * GLB Header Structure
 */
export interface GLBHeader {
  magic: number; // 0x46546c67 (glTF in little endian)
  version: number; // 2
  length: number;
}

/**
 * GLB JSON Chunk (header + data)
 */
export interface GLBJsonChunk {
  offset: number;
  length: number;
  type: 0x4e534f4a; // "JSON"
  data: any;
}

/**
 * Serialize avatar to GLB with manifest
 */
export async function exportAvatarToGLB(
  state: AvatarGeometryState,
  manifest: AvatarManifest
): Promise<ArrayBuffer> {
  // Build glTF structure
  const gltf: any = {
    asset: { version: "2.0", generator: "WEGC v1.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: buildNodeHierarchy(state),
    meshes: buildMeshes(state),
    materials: buildMaterials(),
    buffers: [{ byteLength: 0 }], // Placeholder
    bufferViews: [],
    accessors: [],
    extensions: {
      WEGC: {
        manifest,
        geometry_state: {
          pose: state.pose,
          skeleton: {
            joint_count: state.skeleton.joints.length,
            constraint_count: state.skeleton.constraints.length,
          },
        },
      },
    },
  };

  // JSON chunk
  const jsonString = JSON.stringify(gltf);
  const jsonBuffer = new TextEncoder().encode(jsonString);
  const jsonPadded = alignToPowerOf2(jsonBuffer, 4);

  // Binary chunk (empty for now)
  const binaryBuffer = new ArrayBuffer(0);

  // GLB header
  const header = new ArrayBuffer(12);
  const headerView = new DataView(header);
  headerView.setUint32(0, 0x46546c67, true); // magic
  headerView.setUint32(4, 2, true); // version
  headerView.setUint32(8, 28 + jsonPadded.byteLength + 8 + binaryBuffer.byteLength, true); // total length

  // JSON chunk header
  const jsonChunkHeader = new ArrayBuffer(8);
  const jsonChunkView = new DataView(jsonChunkHeader);
  jsonChunkView.setUint32(0, jsonPadded.byteLength, true);
  jsonChunkView.setUint32(4, 0x4e534f4a, true); // "JSON"

  // Binary chunk header
  const binaryChunkHeader = new ArrayBuffer(8);
  const binaryChunkView = new DataView(binaryChunkHeader);
  binaryChunkView.setUint32(0, binaryBuffer.byteLength, true);
  binaryChunkView.setUint32(4, 0x004e4942, true); // "BIN\0"

  // Concatenate all
  const totalLength =
    header.byteLength +
    jsonChunkHeader.byteLength +
    jsonPadded.byteLength +
    binaryChunkHeader.byteLength +
    binaryBuffer.byteLength;

  const result = new Uint8Array(totalLength);
  let offset = 0;

  result.set(new Uint8Array(header), offset);
  offset += header.byteLength;

  result.set(new Uint8Array(jsonChunkHeader), offset);
  offset += jsonChunkHeader.byteLength;

  result.set(new Uint8Array(jsonPadded), offset);
  offset += jsonPadded.byteLength;

  if (binaryBuffer.byteLength > 0) {
    result.set(new Uint8Array(binaryChunkHeader), offset);
    offset += binaryChunkHeader.byteLength;

    result.set(new Uint8Array(binaryBuffer), offset);
  }

  return result.buffer;
}

/**
 * Build glTF node hierarchy from WEGC skeleton
 */
function buildNodeHierarchy(state: AvatarGeometryState): any[] {
  const nodes: any[] = [];
  const jointMap = new Map<string, number>();

  // First pass: create all nodes and map names to indices
  for (const joint of state.skeleton.joints) {
    jointMap.set(joint.name, nodes.length);
    nodes.push({
      name: joint.name,
      translation: [joint.position.x, joint.position.y, joint.position.z],
      rotation: [0, 0, 0, 1], // Identity quaternion
      scale: [1, 1, 1],
      children: [],
    });
  }

  // Second pass: wire up parent-child relationships
  for (const joint of state.skeleton.joints) {
    if (joint.parentName) {
      const parentIdx = jointMap.get(joint.parentName);
      const childIdx = jointMap.get(joint.name);
      if (parentIdx !== undefined && childIdx !== undefined) {
        if (!nodes[parentIdx].children) {
          nodes[parentIdx].children = [];
        }
        nodes[parentIdx].children.push(childIdx);
      }
    }
  }

  return nodes;
}

/**
 * Build glTF meshes from capsule geometry
 */
function buildMeshes(state: AvatarGeometryState): any[] {
  const meshes: any[] = [];

  // Create a single mesh with all capsules merged
  // For simplicity, this is a placeholder
  meshes.push({
    name: "Avatar_Geometry",
    primitives: [
      {
        attributes: {
          POSITION: 0,
        },
        indices: 1,
        material: 0,
      },
    ],
  });

  return meshes;
}

/**
 * Build glTF materials
 */
function buildMaterials(): any[] {
  return [
    {
      name: "skin_material",
      pbrMetallicRoughness: {
        baseColorFactor: [0.88, 0.68, 0.65, 1.0], // Skin tone
        metallicFactor: 0.0,
        roughnessFactor: 0.85,
      },
    },
  ];
}

/**
 * Align buffer to 4-byte boundary with padding
 */
function alignToPowerOf2(buffer: Uint8Array, alignment: number): Uint8Array {
  const remainder = buffer.byteLength % alignment;
  if (remainder === 0) return buffer;

  const padding = alignment - remainder;
  const padded = new Uint8Array(buffer.byteLength + padding);
  padded.set(buffer);

  // Fill padding with spaces (valid JSON whitespace)
  for (let i = buffer.byteLength; i < padded.byteLength; i++) {
    padded[i] = 0x20; // Space character
  }

  return padded;
}

/**
 * Parse GLB file
 */
export async function parseGLB(buffer: ArrayBuffer): Promise<{
  gltf: any;
  manifest?: AvatarManifest;
}> {
  const view = new DataView(buffer);

  // Read header
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const length = view.getUint32(8, true);

  if (magic !== 0x46546c67) {
    throw new Error("Invalid GLB magic number");
  }

  if (version !== 2) {
    throw new Error("Only GLB version 2 supported");
  }

  // Read JSON chunk
  let offset = 12;
  const jsonChunkLength = view.getUint32(offset, true);
  const jsonChunkType = view.getUint32(offset + 4, true);
  offset += 8;

  if (jsonChunkType !== 0x4e534f4a) {
    throw new Error("First chunk must be JSON");
  }

  const jsonBuffer = buffer.slice(offset, offset + jsonChunkLength);
  const jsonString = new TextDecoder().decode(jsonBuffer);
  const gltf = JSON.parse(jsonString);

  // Extract manifest from extensions
  const manifest = gltf.extensions?.WEGC?.manifest as AvatarManifest | undefined;

  return { gltf, manifest };
}
