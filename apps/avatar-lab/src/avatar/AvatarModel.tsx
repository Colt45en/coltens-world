import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import type { AvatarDNA } from "./dna";
import { clampMorph } from "./dna";
import { buildMaterialsByPart, inferPart } from "./materials/buildPartMaterials";
import type { MorphDebugMeshInfo } from "../state/useAvatarStore";

type Props = {
  url: string;
  avatarGroupRef: React.RefObject<THREE.Group>;
  previewMorphs: Record<string, number>;
  committedMorphs: Record<string, number>;
  onMorphNames: (names: string[]) => void;
  onMorphDebugMeshes: (meshes: MorphDebugMeshInfo[]) => void;
  dnaForMaterial: AvatarDNA;
};

type MorphCache = {
  mesh: THREE.Mesh;
  indexByName: Record<string, number>;
};

function buildMorphCache(scene: THREE.Object3D): MorphCache | null {
  let found: THREE.Mesh | null = null;

  scene.traverse((obj) => {
    if (found) return;
    const mesh = obj as THREE.Mesh;
    const dict = (mesh as THREE.Mesh & { morphTargetDictionary?: Record<string, number> }).morphTargetDictionary;
    const influences = (mesh as THREE.Mesh & { morphTargetInfluences?: number[] }).morphTargetInfluences;
    if (mesh.isMesh && dict && influences && influences.length > 0) found = mesh;
  });

  if (!found) return null;
  const morphTargetDictionary =
    (found as THREE.Mesh & { morphTargetDictionary?: Record<string, number> }).morphTargetDictionary ?? null;
  if (!morphTargetDictionary) return null;

  const indexByName: Record<string, number> = {};
  for (const [name, idx] of Object.entries(morphTargetDictionary)) indexByName[name] = Number(idx);
  return { mesh: found, indexByName };
}

function objectPath(obj: THREE.Object3D): string {
  const parts: string[] = [];
  let current: THREE.Object3D | null = obj;
  while (current) {
    parts.push(current.name || current.type || "Object3D");
    current = current.parent;
  }
  return parts.reverse().join(" > ");
}

function collectMorphDebug(scene: THREE.Object3D): MorphDebugMeshInfo[] {
  const meshes: MorphDebugMeshInfo[] = [];
  scene.traverse((obj) => {
    const mesh = obj as unknown as THREE.Mesh;
    const dict = (mesh as THREE.Mesh & { morphTargetDictionary?: Record<string, number> }).morphTargetDictionary;
    const influences = (mesh as THREE.Mesh & { morphTargetInfluences?: number[] }).morphTargetInfluences;
    if (!mesh.isMesh || !dict || !influences || influences.length === 0) return;

    const morphNames = Object.keys(dict).sort((a, b) => a.localeCompare(b));
    meshes.push({
      meshName: mesh.name || mesh.uuid.slice(0, 8),
      meshPath: objectPath(mesh),
      morphNames,
    });
  });

  meshes.sort((a, b) => a.meshPath.localeCompare(b.meshPath));
  return meshes;
}

export default function AvatarModel({
  url,
  avatarGroupRef,
  previewMorphs,
  committedMorphs,
  onMorphNames,
  onMorphDebugMeshes,
  dnaForMaterial,
}: Props) {
  const gltf = useGLTF(url) as { scene: unknown };
  const root = gltf.scene as THREE.Object3D;

  const cacheRef = useRef<MorphCache | null>(null);

  const wrapper = useMemo(() => {
    const group = new THREE.Group();
    group.add(root);

    const box = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box.getCenter(center);
    root.position.sub(center);

    const groundedBox = new THREE.Box3().setFromObject(root);
    root.position.y -= groundedBox.min.y;

    const size = new THREE.Vector3();
    groundedBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 1.6 / maxDim;
      root.scale.setScalar(scale);
    }

    return group;
  }, [root]);

  useEffect(() => {
    cacheRef.current = buildMorphCache(root);
    onMorphDebugMeshes(collectMorphDebug(root));
    const names = Object.keys(cacheRef.current?.indexByName ?? {}).sort((a, b) => a.localeCompare(b));
    onMorphNames(names);
    return () => onMorphDebugMeshes([]);
  }, [root, onMorphNames, onMorphDebugMeshes]);

  useEffect(() => {
    const materials = buildMaterialsByPart(dnaForMaterial);

    root.traverse((obj) => {
      const mesh = obj as unknown as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.material = materials[inferPart(mesh)];
      mesh.castShadow = true;
      mesh.receiveShadow = false;
    });

    return () => {
      Object.values(materials).forEach((material) => material.dispose());
    };
  }, [root, dnaForMaterial]);

  useEffect(() => {
    const cache = cacheRef.current;
    if (!cache || !cache.mesh.morphTargetInfluences) return;

    const influences = cache.mesh.morphTargetInfluences;
    for (const [name, idx] of Object.entries(cache.indexByName)) {
      const value = previewMorphs[name] ?? 0;
      influences[idx] = clampMorph(value);
    }
  }, [previewMorphs]);

  useEffect(() => {
    const cache = cacheRef.current;
    if (!cache || !cache.mesh.morphTargetInfluences) return;

    const influences = cache.mesh.morphTargetInfluences;
    for (const [name, idx] of Object.entries(cache.indexByName)) {
      const value = committedMorphs[name] ?? 0;
      influences[idx] = clampMorph(value);
    }
  }, [committedMorphs]);

  return <primitive ref={avatarGroupRef} object={wrapper} />;
}

useGLTF.preload("/avatar.glb");
