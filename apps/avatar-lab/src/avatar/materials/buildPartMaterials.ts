import * as THREE from "three";
import type { AvatarDNA } from "../dna";

export type Part = "skin" | "clothing" | "hair" | "eyes" | "other";

const textureLoader = new THREE.TextureLoader();

function loadTex(url?: string, srgb = true): THREE.Texture | null {
  if (!url) return null;
  const texture = textureLoader.load(url);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function inferPart(mesh: THREE.Object3D): Part {
  const userData = (mesh as THREE.Mesh).userData ?? {};
  const explicit = typeof userData.part === "string" ? userData.part.toLowerCase() : undefined;
  if (explicit === "skin" || explicit === "clothing" || explicit === "hair" || explicit === "eyes") return explicit;

  const name = mesh.name.toLowerCase();
  if (/(skin|body|head|face|arm|leg|torso)/.test(name)) return "skin";
  if (/(shirt|cloth|clothes|pants|jeans|dress|jacket|hoodie|top|bottom)/.test(name)) return "clothing";
  if (/(hair|brow|beard|mustache)/.test(name)) return "hair";
  if (/(eye|iris|pupil)/.test(name)) return "eyes";

  return "other";
}

export function buildMaterialsByPart(dna: AvatarDNA): Record<Part, THREE.MeshStandardMaterial> {
  const skinMap = loadTex(dna.textures?.skinMap);
  const clothingMap = loadTex(dna.textures?.clothingMap);

  return {
    skin: new THREE.MeshStandardMaterial({
      color: new THREE.Color(dna.materials.skinColor),
      roughness: Math.max(0.55, dna.materials.roughness),
      metalness: dna.materials.metalness,
      map: skinMap,
    }),
    clothing: new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ffffff"),
      roughness: 0.9,
      metalness: 0,
      map: clothingMap,
    }),
    hair: new THREE.MeshStandardMaterial({
      color: new THREE.Color(dna.materials.hairColor),
      roughness: 0.55,
      metalness: 0.05,
    }),
    eyes: new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ffffff"),
      roughness: 0.25,
      metalness: 0,
    }),
    other: new THREE.MeshStandardMaterial({
      color: new THREE.Color("#bdbdbd"),
      roughness: 0.85,
      metalness: 0,
    }),
  };
}
