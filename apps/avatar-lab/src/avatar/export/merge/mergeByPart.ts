import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type PartKey = "skin" | "clothing" | "hair" | "eyes" | "other";

export function inferPartKey(object: THREE.Object3D): PartKey {
  const userData = object.userData ?? {};
  const explicit = typeof userData.part === "string" ? userData.part.toLowerCase() : undefined;
  if (explicit === "skin" || explicit === "clothing" || explicit === "hair" || explicit === "eyes") return explicit;

  const name = object.name.toLowerCase();
  if (/(skin|body|head|face|arm|leg|torso)/.test(name)) return "skin";
  if (/(shirt|cloth|clothes|pants|jeans|dress|jacket|hoodie|top|bottom)/.test(name)) return "clothing";
  if (/(hair|brow|beard|mustache)/.test(name)) return "hair";
  if (/(eye|iris|pupil)/.test(name)) return "eyes";
  return "other";
}

function bakeWorldTransformToGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  mesh.updateMatrixWorld(true);
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  return geometry;
}

export function mergeStaticMeshesByPart(
  root: THREE.Object3D,
  materialByPart: Record<PartKey, THREE.Material>
): THREE.Group {
  const geometriesByPart: Record<PartKey, THREE.BufferGeometry[]> = {
    skin: [],
    clothing: [],
    hair: [],
    eyes: [],
    other: [],
  };

  const skinnedKeep: THREE.Object3D[] = [];

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh & { isSkinnedMesh?: boolean };
    if (!mesh.isMesh) return;

    if (mesh.isSkinnedMesh) {
      skinnedKeep.push(mesh);
      return;
    }

    const part = inferPartKey(mesh);
    geometriesByPart[part].push(bakeWorldTransformToGeometry(mesh));
  });

  const mergedRoot = new THREE.Group();
  mergedRoot.name = root.name || "AvatarRootMerged";

  for (const object of skinnedKeep) {
    const clone = object.clone(true);
    object.updateMatrixWorld(true);
    clone.applyMatrix4(object.matrixWorld);
    mergedRoot.add(clone);
  }

  (Object.keys(geometriesByPart) as PartKey[]).forEach((part) => {
    const list = geometriesByPart[part];
    if (list.length === 0) return;

    const merged = BufferGeometryUtils.mergeGeometries(list, false);
    if (!merged) return;

    const mesh = new THREE.Mesh(merged, materialByPart[part]);
    mesh.name = `Merged_${part}`;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.userData = { ...mesh.userData, part };
    mergedRoot.add(mesh);
  });

  return mergedRoot;
}
