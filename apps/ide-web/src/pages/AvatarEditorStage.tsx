import { ContactShadows, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
// @ts-ignore - three.examples doesn't have proper TS types
import * as SkeletonUtilsModule from "three/examples/jsm/utils/SkeletonUtils.js";
const SkeletonUtils = SkeletonUtilsModule.SkeletonUtils || SkeletonUtilsModule.default || SkeletonUtilsModule;

// =============================================================
// DNA Types
// =============================================================
export type MorphMap = Record<string, number>;

export type AvatarDNA = {
  morphs: MorphMap;
  materials: {
    skinColor: string;
    hairColor: string;
    roughness: number;
    metalness: number;
  };
  textures?: {
    skinMap?: string;
    clothingMap?: string;
    maskMap?: string;
  };
  postfx: {
    bloom: number;
    ao: number;
    smaa: boolean;
  };
  quality: {
    shadows: boolean;
    shadowMapSize: 1024 | 2048;
  };
};

export type AvatarDNA2 = AvatarDNA & {
  face?: { arkit?: FaceARKit52 };
};

// =============================================================
// Your preset DNA array (8 characters)
// =============================================================
const DNA_LIBRARY: AvatarDNA[] = [
  {
    morphs: {
      height: 0.08,
      shoulderWidth: 0.14,
      bodyFat: -0.18,
      muscle: 0.22,
      headSize: 0.02,
      jawWidth: 0.18,
      jawForward: 0.06,
      cheekboneHeight: 0.16,
      cheekboneWidth: 0.06,
      chinLength: 0.04,
      noseWidth: -0.06,
      noseBridgeHeight: 0.12,
      noseTipUp: 0.02,
      eyeSize: 0.1,
      eyeSpacing: 0.04,
      browHeight: 0.06,
      browThickness: 0.1,
      lipFullness: 0.02,
      earSize: -0.02,
      neckThickness: 0.06,
    },
    materials: {
      skinColor: "#d6b08f",
      hairColor: "#1d1712",
      roughness: 0.82,
      metalness: 0.0,
    },
    textures: {
      skinMap: "/textures/skin/skin_01.jpg",
      clothingMap: "/textures/clothes/outfit_01.jpg",
    },
    postfx: { bloom: 0.22, ao: 0.42, smaa: true },
    quality: { shadows: true, shadowMapSize: 2048 },
  },
  {
    morphs: {
      height: -0.04,
      shoulderWidth: -0.06,
      bodyFat: 0.1,
      muscle: -0.06,
      headSize: 0.04,
      jawWidth: -0.1,
      jawForward: -0.02,
      cheekboneHeight: 0.06,
      cheekboneWidth: -0.02,
      chinLength: -0.04,
      noseWidth: -0.12,
      noseBridgeHeight: 0.18,
      noseTipUp: 0.1,
      eyeSize: 0.18,
      eyeSpacing: -0.02,
      browHeight: 0.12,
      browThickness: -0.08,
      lipFullness: 0.14,
      earSize: 0.06,
      neckThickness: -0.04,
    },
    materials: {
      skinColor: "#f2d6c6",
      hairColor: "#c7a06a",
      roughness: 0.75,
      metalness: 0.0,
    },
    textures: {
      skinMap: "/textures/skin/skin_02.jpg",
      clothingMap: "/textures/clothes/outfit_02.jpg",
      maskMap: "/textures/masks/makeup_01.png",
    },
    postfx: { bloom: 0.28, ao: 0.48, smaa: true },
    quality: { shadows: true, shadowMapSize: 2048 },
  },
  {
    morphs: {
      height: 0.02,
      shoulderWidth: 0.06,
      bodyFat: -0.1,
      muscle: 0.1,
      headSize: -0.02,
      jawWidth: 0.06,
      jawForward: 0.14,
      cheekboneHeight: 0.02,
      cheekboneWidth: 0.1,
      chinLength: 0.1,
      noseWidth: 0.08,
      noseBridgeHeight: -0.04,
      noseTipUp: -0.06,
      eyeSize: -0.04,
      eyeSpacing: 0.06,
      browHeight: -0.08,
      browThickness: 0.18,
      lipFullness: -0.06,
      earSize: -0.04,
      neckThickness: 0.1,
    },
    materials: {
      skinColor: "#7d5a44",
      hairColor: "#0e0d0f",
      roughness: 0.86,
      metalness: 0.02,
    },
    textures: {
      skinMap: "/textures/skin/skin_03.jpg",
      clothingMap: "/textures/clothes/outfit_03.jpg",
    },
    postfx: { bloom: 0.14, ao: 0.55, smaa: false },
    quality: { shadows: true, shadowMapSize: 1024 },
  },
  {
    morphs: {
      height: 0.14,
      shoulderWidth: 0.2,
      bodyFat: -0.24,
      muscle: 0.34,
      headSize: -0.04,
      jawWidth: 0.24,
      jawForward: 0.1,
      cheekboneHeight: 0.1,
      cheekboneWidth: 0.12,
      chinLength: 0.06,
      noseWidth: 0.0,
      noseBridgeHeight: 0.06,
      noseTipUp: -0.02,
      eyeSize: 0.02,
      eyeSpacing: 0.02,
      browHeight: 0.02,
      browThickness: 0.08,
      lipFullness: -0.02,
      earSize: 0.02,
      neckThickness: 0.16,
    },
    materials: {
      skinColor: "#c28d63",
      hairColor: "#2a2e3a",
      roughness: 0.78,
      metalness: 0.0,
    },
    textures: {
      skinMap: "/textures/skin/skin_04.jpg",
      clothingMap: "/textures/clothes/outfit_04.jpg",
      maskMap: "/textures/masks/scar_01.png",
    },
    postfx: { bloom: 0.18, ao: 0.46, smaa: true },
    quality: { shadows: true, shadowMapSize: 2048 },
  },
  {
    morphs: {
      height: -0.1,
      shoulderWidth: 0.02,
      bodyFat: 0.06,
      muscle: -0.02,
      headSize: 0.1,
      jawWidth: -0.16,
      jawForward: -0.1,
      cheekboneHeight: 0.2,
      cheekboneWidth: -0.06,
      chinLength: -0.1,
      noseWidth: -0.1,
      noseBridgeHeight: 0.1,
      noseTipUp: 0.08,
      eyeSize: 0.26,
      eyeSpacing: -0.06,
      browHeight: 0.18,
      browThickness: -0.14,
      lipFullness: 0.22,
      earSize: 0.1,
      neckThickness: -0.08,
    },
    materials: {
      skinColor: "#ffe0d3",
      hairColor: "#ff4ea3",
      roughness: 0.72,
      metalness: 0.0,
    },
    textures: {
      skinMap: "/textures/skin/skin_05.jpg",
      clothingMap: "/textures/clothes/outfit_05.jpg",
      maskMap: "/textures/masks/tattoo_01.png",
    },
    postfx: { bloom: 0.36, ao: 0.4, smaa: true },
    quality: { shadows: false, shadowMapSize: 1024 },
  },
  {
    morphs: {
      height: 0.0,
      shoulderWidth: -0.02,
      bodyFat: -0.04,
      muscle: 0.02,
      headSize: 0.0,
      jawWidth: -0.02,
      jawForward: 0.0,
      cheekboneHeight: 0.0,
      cheekboneWidth: 0.0,
      chinLength: 0.0,
      noseWidth: 0.0,
      noseBridgeHeight: 0.0,
      noseTipUp: 0.0,
      eyeSize: 0.0,
      eyeSpacing: 0.0,
      browHeight: 0.0,
      browThickness: 0.0,
      lipFullness: 0.0,
      earSize: 0.0,
      neckThickness: 0.0,
    },
    materials: {
      skinColor: "#d8b59a",
      hairColor: "#2b1d14",
      roughness: 0.85,
      metalness: 0.0,
    },
    textures: {
      skinMap: "/textures/skin/skin_neutral.jpg",
      clothingMap: "/textures/clothes/outfit_neutral.jpg",
      maskMap: "/textures/masks/mask_none.png",
    },
    postfx: { bloom: 0.2, ao: 0.45, smaa: true },
    quality: { shadows: true, shadowMapSize: 1024 },
  },
  {
    morphs: {
      height: 0.06,
      shoulderWidth: 0.1,
      bodyFat: -0.08,
      muscle: 0.06,
      headSize: -0.06,
      jawWidth: -0.04,
      jawForward: 0.02,
      cheekboneHeight: -0.06,
      cheekboneWidth: 0.02,
      chinLength: 0.02,
      noseWidth: 0.14,
      noseBridgeHeight: -0.1,
      noseTipUp: -0.12,
      eyeSize: -0.1,
      eyeSpacing: 0.1,
      browHeight: -0.14,
      browThickness: 0.06,
      lipFullness: -0.1,
      earSize: -0.06,
      neckThickness: 0.04,
    },
    materials: {
      skinColor: "#9b7a5b",
      hairColor: "#ffffff",
      roughness: 0.6,
      metalness: 0.08,
    },
    textures: {
      skinMap: "/textures/skin/skin_06.jpg",
      clothingMap: "/textures/clothes/outfit_06.jpg",
    },
    postfx: { bloom: 0.12, ao: 0.62, smaa: false },
    quality: { shadows: true, shadowMapSize: 2048 },
  },
  {
    morphs: {
      height: 0.04,
      shoulderWidth: 0.04,
      bodyFat: -0.14,
      muscle: 0.14,
      headSize: 0.02,
      jawWidth: 0.04,
      jawForward: -0.02,
      cheekboneHeight: 0.08,
      cheekboneWidth: 0.1,
      chinLength: -0.02,
      noseWidth: -0.02,
      noseBridgeHeight: 0.04,
      noseTipUp: 0.0,
      eyeSize: 0.06,
      eyeSpacing: 0.0,
      browHeight: 0.04,
      browThickness: 0.04,
      lipFullness: 0.06,
      earSize: -0.02,
      neckThickness: 0.08,
    },
    materials: {
      skinColor: "#b08a74",
      hairColor: "#3a6ff2",
      roughness: 0.7,
      metalness: 0.0,
    },
    textures: {
      skinMap: "/textures/skin/skin_07.jpg",
      clothingMap: "/textures/clothes/outfit_07.jpg",
      maskMap: "/textures/masks/warpaint_01.png",
    },
    postfx: { bloom: 0.3, ao: 0.44, smaa: true },
    quality: { shadows: true, shadowMapSize: 1024 },
  },
];

// =============================================================
// Assets (place these in /public/...)
// =============================================================
const ASSETS = {
  avatar: "/avatars/avatar_base.glb",
  clothes: {
    shirt: "/avatars/clothes/shirt_01.glb",
    pants: "/avatars/clothes/pants_01.glb",
    shoes: "/avatars/clothes/shoes_01.glb",
  },
};

// =============================================================
// Morph Target Binding Strategy
// =============================================================
const MORPH_ALIASES: Record<string, string[]> = {
  height: ["height", "Height"],
  shoulderWidth: ["shoulderWidth", "ShoulderWidth"],
  bodyFat: ["bodyFat", "BodyFat"],
  muscle: ["muscle", "Muscle"],
  headSize: ["headSize", "HeadSize"],
  jawWidth: ["jawWidth", "JawWidth"],
  jawForward: ["jawForward", "JawForward"],
  cheekboneHeight: ["cheekboneHeight", "CheekboneHeight"],
  cheekboneWidth: ["cheekboneWidth", "CheekboneWidth"],
  chinLength: ["chinLength", "ChinLength"],
  noseWidth: ["noseWidth", "NoseWidth"],
  noseBridgeHeight: ["noseBridgeHeight", "NoseBridgeHeight"],
  noseTipUp: ["noseTipUp", "NoseTipUp"],
  eyeSize: ["eyeSize", "EyeSize"],
  eyeSpacing: ["eyeSpacing", "EyeSpacing"],
  browHeight: ["browHeight", "BrowHeight"],
  browThickness: ["browThickness", "BrowThickness"],
  lipFullness: ["lipFullness", "LipFullness"],
  earSize: ["earSize", "EarSize"],
  neckThickness: ["neckThickness", "NeckThickness"],
};

// =============================================================
// ARKit 52 canonical keys
// =============================================================
const ARKIT52 = [
  "browDownLeft","browDownRight","browInnerUp","browOuterUpLeft","browOuterUpRight",
  "eyeBlinkLeft","eyeBlinkRight","eyeLookDownLeft","eyeLookDownRight","eyeLookInLeft","eyeLookInRight",
  "eyeLookOutLeft","eyeLookOutRight","eyeLookUpLeft","eyeLookUpRight","eyeSquintLeft","eyeSquintRight",
  "eyeWideLeft","eyeWideRight",
  "cheekPuff","cheekSquintLeft","cheekSquintRight",
  "noseSneerLeft","noseSneerRight",
  "jawForward","jawLeft","jawRight","jawOpen",
  "mouthClose","mouthFunnel","mouthPucker","mouthLeft","mouthRight",
  "mouthSmileLeft","mouthSmileRight","mouthFrownLeft","mouthFrownRight",
  "mouthDimpleLeft","mouthDimpleRight","mouthStretchLeft","mouthStretchRight",
  "mouthRollLower","mouthRollUpper","mouthShrugLower","mouthShrugUpper",
  "mouthPressLeft","mouthPressRight","mouthLowerDownLeft","mouthLowerDownRight",
  "mouthUpperUpLeft","mouthUpperUpRight",
  "mouthRaiserUpper","mouthRaiserLower",
  "tongueOut",
] as const;

type ARKitKey = (typeof ARKIT52)[number];
type FaceARKit52 = Partial<Record<ARKitKey, number>>;
type ARKitFrame = { timeSec: number; arkit: FaceARKit52 };

const ARKIT52_SET = new Set<string>(ARKIT52);

function isRecord(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function extractFrameArkitObject(frame: Record<string, any>): Record<string, any> | null {
  if (isRecord(frame.blendShapes)) return frame.blendShapes;
  if (isRecord(frame.arkit)) return frame.arkit;
  if (isRecord(frame.face?.arkit)) return frame.face.arkit;
  return frame;
}

/**
 * Accepts multiple JSON shapes:
 *  - {"eyeBlinkLeft":0.5,...}
 *  - {"blendShapes":{...}}
 *  - {"face":{"arkit":{...}}}
 *  - {"arkit":{...}}
 *  - [{"time":0.0,"blendShapes":{...}}, ...]  // takes first frame
 */
function extractArkitObject(input: any): Record<string, any> | null {
  if (Array.isArray(input)) {
    // common: an array of frames
    const first = input.find((x) => isRecord(x)) ?? null;
    if (!first) return null;
    if (isRecord((first as any).blendShapes)) return (first as any).blendShapes;
    if (isRecord((first as any).arkit)) return (first as any).arkit;
    if (isRecord((first as any).face?.arkit)) return (first as any).face.arkit;
    if (isRecord(first)) return first as any;
    return null;
  }

  if (!isRecord(input)) return null;

  if (isRecord((input as any).blendShapes)) return (input as any).blendShapes;
  if (isRecord((input as any).arkit)) return (input as any).arkit;
  if (isRecord((input as any).face?.arkit)) return (input as any).face.arkit;

  // assume it's already a dict of weights
  return input as any;
}

function normalizeArkitWeights(obj: Record<string, any>) {
  const out: FaceARKit52 = {};
  const unknownKeys: string[] = [];
  let used = 0;

  for (const [k, v] of Object.entries(obj)) {
    const key = String(k).trim();
    const n = Number(v);
    if (!Number.isFinite(n)) continue;

    if (!ARKIT52_SET.has(key)) {
      unknownKeys.push(key);
      continue;
    }

    (out as any)[key] = clamp01(n);
    used++;
  }

  // small deterministic sorting for display/debug (not required, but nice)
  unknownKeys.sort();

  return { arkit: out, used, unknownKeys };
}

/**
 * Extract ARKit frame timeline from various JSON formats
 * Handles missing/non-monotonic timestamps with fallback to 1/30s increments
 */
function extractArkitFrames(input: any): ARKitFrame[] {
  const source = Array.isArray(input)
    ? input
    : (isRecord(input) && Array.isArray((input as any).frames) ? (input as any).frames : null);
  if (!Array.isArray(source)) return [];

  const frames: ARKitFrame[] = [];
  let fallbackTime = 0;

  for (const item of source) {
    if (!isRecord(item)) continue;

    const raw = extractFrameArkitObject(item);
    if (!raw) continue;

    const { arkit, used } = normalizeArkitWeights(raw);
    if (used === 0) continue;

    const candidateTime = Number((item as any).timeSec ?? (item as any).time ?? (item as any).t ?? (item as any).timestamp);
    const timeSec = Number.isFinite(candidateTime) ? Math.max(0, candidateTime) : fallbackTime;
    frames.push({ timeSec, arkit });
    fallbackTime = timeSec + 1 / 30;
  }

  if (frames.length <= 1) return frames;

  // Preserve source order if timestamps are missing/non-monotonic, but enforce non-decreasing times.
  for (let i = 1; i < frames.length; i++) {
    if (frames[i]!.timeSec < frames[i - 1]!.timeSec) {
      frames[i]!.timeSec = frames[i - 1]!.timeSec + 1 / 30;
    }
  }

  return frames;
}

async function readTextFile(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsText(file);
  });
}

function signedNames(base: string) {
  return [
    [`${base}_pos`, `${base}_neg`],
    [`${base}__pos`, `${base}__neg`],
    [`${base}Plus`, `${base}Minus`],
    [`${base}_plus`, `${base}_minus`],
  ] as const;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const clampSigned = (x: number, m = 1) => clamp(x, -m, m);
const clamp01 = (x: number) => clamp(x, 0, 1);

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function deepCloneDNA(dna: AvatarDNA): AvatarDNA {
  return JSON.parse(JSON.stringify(dna)) as AvatarDNA;
}

// =============================================================
// Optional texture loader
// =============================================================
function useOptionalTexture(url?: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let alive = true;
    if (!url) {
      setTex(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (t) => {
        if (!alive) return;
        t.colorSpace = THREE.SRGBColorSpace;
        setTex(t);
      },
      undefined,
      () => alive && setTex(null)
    );
    return () => {
      alive = false;
    };
  }, [url]);

  return tex;
}

// =============================================================
// Skeleton helpers
// =============================================================
function findBoneByNames(skeleton: THREE.Skeleton, names: string[]) {
  const set = new Set(names.map((s) => s.toLowerCase()));
  for (const b of skeleton.bones) {
    if (set.has(b.name.toLowerCase())) return b;
  }
  return null;
}

// =============================================================
// Apply DNA morphs -> morphTargetInfluences
// =============================================================
type MorphMesh = THREE.Mesh & {
  morphTargetDictionary?: Record<string, number>;
  morphTargetInfluences?: number[];
};

function applyARKitToMorphTargets(meshes: MorphMesh[], arkit: Record<string, number>) {
  for (const mesh of meshes) {
    const dict = mesh.morphTargetDictionary;
    const infl = mesh.morphTargetInfluences;
    if (!dict || !infl) continue;

    for (const [k, raw] of Object.entries(arkit)) {
      const i = dict[k];
      if (i === undefined) continue;
      infl[i] = clamp01(Number(raw) || 0);
    }
  }
}

function applyDNAToMorphTargets(meshes: MorphMesh[], morphs: MorphMap) {
  for (const mesh of meshes) {
    const dict = mesh.morphTargetDictionary;
    const infl = mesh.morphTargetInfluences;
    if (!dict || !infl) continue;

    for (let i = 0; i < infl.length; i++) infl[i] = 0;

    for (const [key, raw] of Object.entries(morphs)) {
      const v = clampSigned(safeNum(raw, 0), 1);
      const aliases = MORPH_ALIASES[key] ?? [key];

      let applied = false;
      for (const baseName of aliases) {
        for (const [posName, negName] of signedNames(baseName)) {
          const ip = dict[posName];
          const ineg = dict[negName];
          if (ip !== undefined && ineg !== undefined) {
            infl[ip] = clamp01(Math.max(0, v));
            infl[ineg] = clamp01(Math.max(0, -v));
            applied = true;
            break;
          }
        }
        if (applied) break;
      }
      if (applied) continue;

      for (const baseName of aliases) {
        const i = dict[baseName];
        if (i !== undefined) {
          infl[i] = clamp(v, -1, 1);
          applied = true;
          break;
        }
      }
    }

    mesh.updateMorphTargets?.();
  }
}

// =============================================================
// Material routing
// =============================================================
function patchMaterials(root: THREE.Object3D, dna: AvatarDNA, skinMap: THREE.Texture | null, clothingMap: THREE.Texture | null) {
  const skinColor = new THREE.Color(dna.materials.skinColor);
  const hairColor = new THREE.Color(dna.materials.hairColor);

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m0 of mats) {
      const m = m0 as THREE.MeshStandardMaterial;
      if (!m || !(m as any).isMeshStandardMaterial) continue;

      const name = `${mesh.name} ${m.name}`.toLowerCase();

      const isHair = name.includes("hair") || name.includes("brow") || name.includes("eyebrow");
      const isCloth = name.includes("cloth") || name.includes("shirt") || name.includes("pants") || name.includes("shoe") || name.includes("outfit");
      const isSkin = name.includes("skin") || name.includes("body") || name.includes("face") || (!isHair && !isCloth);

      if (isSkin) {
        m.color.copy(skinColor);
        m.roughness = clamp01(dna.materials.roughness);
        m.metalness = clamp01(dna.materials.metalness);
        m.map = skinMap ?? m.map ?? null;
        m.needsUpdate = true;
      } else if (isHair) {
        m.color.copy(hairColor);
        m.roughness = clamp01(dna.materials.roughness * 0.9);
        m.metalness = clamp01(dna.materials.metalness * 0.4);
        m.needsUpdate = true;
      } else if (isCloth) {
        m.color.set("#ffffff");
        m.roughness = 0.9;
        m.metalness = 0.0;
        m.map = clothingMap ?? m.map ?? null;
        m.needsUpdate = true;
      }
    }
  });
}

// =============================================================
// Clothing binding
// =============================================================
function rebindGarmentToSkeleton(garmentRoot: THREE.Object3D, baseSkeleton: THREE.Skeleton) {
  garmentRoot.traverse((obj) => {
    const sm = obj as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;

    sm.skeleton = baseSkeleton;
    sm.bind(baseSkeleton, sm.bindMatrix);
    sm.frustumCulled = false;
    sm.castShadow = true;
    sm.receiveShadow = true;
  });
}

// =============================================================
// Garment GLB component
// =============================================================
type OutfitState = { shirt: boolean; pants: boolean; shoes: boolean; hair: boolean; mask: boolean };

function GarmentGLB({
  url,
  enabled,
  baseSkeleton,
  clothingMap,
  shadows,
}: {
  url: string;
  enabled: boolean;
  baseSkeleton: THREE.Skeleton | null;
  clothingMap: THREE.Texture | null;
  shadows: boolean;
}) {
  const gltf = useGLTF(url) as any;
  const root = useMemo(() => SkeletonUtils.clone(gltf.scene) as THREE.Object3D, [gltf.scene]);

  useEffect(() => {
    if (!enabled) return;

    if (clothingMap) {
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m0 of mats) {
          const m = m0 as THREE.MeshStandardMaterial;
          if (!m || !(m as any).isMeshStandardMaterial) continue;
          m.map = clothingMap;
          m.color.set("#ffffff");
          m.roughness = 0.9;
          m.metalness = 0.0;
          m.needsUpdate = true;
        }
        mesh.castShadow = shadows;
        mesh.receiveShadow = shadows;
      });
    }

    if (baseSkeleton) rebindGarmentToSkeleton(root, baseSkeleton);
  }, [enabled, root, baseSkeleton, clothingMap, shadows]);

  if (!enabled) return null;
  return <primitive object={root} />;
}

// =============================================================
// Avatar GLB component
// =============================================================
function AvatarGLB({
  dna,
  outfit,
  activeClip,
  speed,
  paused,
  crossfadeSec,
  onSkeletonReady,
}: {
  dna: AvatarDNA;
  outfit: OutfitState;
  activeClip: string;
  speed: number;
  paused: boolean;
  crossfadeSec: number;
  onSkeletonReady: (skel: THREE.Skeleton | null) => void;
}) {
  const group = useRef<THREE.Group>(null);

  const gltf = useGLTF(ASSETS.avatar) as any;
  const root = useMemo(() => SkeletonUtils.clone(gltf.scene) as THREE.Object3D, [gltf.scene]);

  const skinMap = useOptionalTexture(dna.textures?.skinMap);
  const clothingMap = useOptionalTexture(dna.textures?.clothingMap);
  const maskMap = useOptionalTexture(dna.textures?.maskMap);

  const morphMeshes = useMemo(() => {
    const out: MorphMesh[] = [];
    root.traverse((obj) => {
      const m = obj as MorphMesh;
      if ((m as any).isMesh && m.morphTargetDictionary && m.morphTargetInfluences) out.push(m);
    });
    return out;
  }, [root]);

  const baseSkeleton = useMemo(() => {
    let skel: THREE.Skeleton | null = null;
    root.traverse((obj) => {
      const sm = obj as THREE.SkinnedMesh;
      if (!skel && sm.isSkinnedMesh && sm.skeleton) skel = sm.skeleton;
    });
    return skel;
  }, [root]);

  useEffect(() => {
    onSkeletonReady(baseSkeleton);
  }, [baseSkeleton, onSkeletonReady]);

  useEffect(() => {
    patchMaterials(root, dna, skinMap, clothingMap);
  }, [root, dna, skinMap, clothingMap]);

  useEffect(() => {
    applyDNAToMorphTargets(morphMeshes, dna.morphs);
    applyARKitToMorphTargets(morphMeshes, (dna as any).face?.arkit ?? {});
  }, [morphMeshes, dna.morphs, dna]);

  const { actions, names, mixer } = useAnimations(gltf.animations ?? [], group);

  const lastClip = useRef<string>("");

  useEffect(() => {
    if (!actions) return;

    const clipName = actions[activeClip] ? activeClip : names?.[0] ?? "";
    if (!clipName) return;

    const next = actions[clipName];
    if (!next) return;

    const prevName = lastClip.current;
    const prev = prevName ? actions[prevName] : undefined;

    next.reset().setEffectiveTimeScale(speed).setEffectiveWeight(1).play();

    if (prev && prev !== next) {
      prev.crossFadeTo(next, Math.max(0.01, crossfadeSec), false);
    }

    lastClip.current = clipName;
  }, [actions, names, activeClip, crossfadeSec, speed]);

  useEffect(() => {
    if (mixer) mixer.timeScale = paused ? 0 : 1;
    if (actions) {
      for (const a of Object.values(actions)) a?.setEffectiveTimeScale(speed);
    }
  }, [paused, speed, mixer, actions]);

  const maskDecal = useMemo(() => {
    if (!maskMap || !outfit.mask || !baseSkeleton) return null;
    const head = findBoneByNames(baseSkeleton, ["Head", "mixamorigHead", "head"]);
    if (!head) return null;

    const mat = new THREE.MeshStandardMaterial({
      map: maskMap,
      transparent: true,
      opacity: 0.95,
      roughness: 0.6,
      metalness: 0.0,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.18), mat);
    mesh.position.set(0, 0.06, 0.12);
    mesh.renderOrder = 10;
    head.add(mesh);
    return mesh;
  }, [maskMap, outfit.mask, baseSkeleton]);

  useEffect(() => {
    return () => {
      if (maskDecal && maskDecal.parent) maskDecal.parent.remove(maskDecal);
    };
  }, [maskDecal]);

  const rimIntensity = clamp01(dna.postfx.bloom) * 2.2;

  return (
    <group ref={group}>
      <primitive object={root} />
      <pointLight position={[0.6, 1.7, 0.8]} intensity={rimIntensity} distance={4} />
    </group>
  );
}

// =============================================================
// Scene
// =============================================================
function Scene({
  dna,
  outfit,
  activeClip,
  speed,
  paused,
  crossfadeSec,
}: {
  dna: AvatarDNA;
  outfit: OutfitState;
  activeClip: string;
  speed: number;
  paused: boolean;
  crossfadeSec: number;
}) {
  const [skeleton, setSkeleton] = useState<THREE.Skeleton | null>(null);

  const antialias = dna.postfx.smaa;
  const enableShadows = dna.quality.shadows;
  const shadowSize = dna.quality.shadowMapSize;

  const clothingMap = useOptionalTexture(dna.textures?.clothingMap);
  const aoOpacity = clamp01(dna.postfx.ao) * 0.9;

  return (
    <Canvas
      shadows={enableShadows}
      gl={{ antialias, powerPreference: "high-performance" }}
      camera={{ position: [2.8, 1.6, 3.6], fov: 50, near: 0.1, far: 100 }}
    >
      <color attach="background" args={["#0b0e12"]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[3.5, 6.5, 3.5]}
        intensity={1.1}
        castShadow={enableShadows}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color={"#0f1520"} roughness={1} metalness={0} />
      </mesh>

      <Suspense fallback={null}>
        <AvatarGLB
          dna={dna}
          outfit={outfit}
          activeClip={activeClip}
          speed={speed}
          paused={paused}
          crossfadeSec={crossfadeSec}
          onSkeletonReady={setSkeleton}
        />

        {skeleton && (
          <>
            <GarmentGLB url={ASSETS.clothes.shirt} enabled={outfit.shirt} baseSkeleton={skeleton} clothingMap={clothingMap} shadows={enableShadows} />
            <GarmentGLB url={ASSETS.clothes.pants} enabled={outfit.pants} baseSkeleton={skeleton} clothingMap={clothingMap} shadows={enableShadows} />
            <GarmentGLB url={ASSETS.clothes.shoes} enabled={outfit.shoes} baseSkeleton={skeleton} clothingMap={clothingMap} shadows={enableShadows} />
          </>
        )}
      </Suspense>

      <ContactShadows position={[0, 0.001, 0]} opacity={aoOpacity} width={6} height={6} blur={2.5} far={4} />

      <OrbitControls makeDefault target={[0, 1.3, 0]} enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}

// =============================================================
// UI Constants
// =============================================================
const MORPH_ORDER = [
  "height",
  "shoulderWidth",
  "bodyFat",
  "muscle",
  "headSize",
  "jawWidth",
  "jawForward",
  "cheekboneHeight",
  "cheekboneWidth",
  "chinLength",
  "noseWidth",
  "noseBridgeHeight",
  "noseTipUp",
  "eyeSize",
  "eyeSpacing",
  "browHeight",
  "browThickness",
  "lipFullness",
  "earSize",
  "neckThickness",
] as const;

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// =============================================================
// Main Page
// =============================================================
export default function AvatarEditorStage() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [dna, setDna] = useState<AvatarDNA2>(() => deepCloneDNA(DNA_LIBRARY[0] ?? ({} as any)));

  const [outfit, setOutfit] = useState({ shirt: true, pants: true, shoes: true, hair: true, mask: true });
  const [activeClip, setActiveClip] = useState("Idle");
  const [speed, setSpeed] = useState(1.0);
  const [paused, setPaused] = useState(false);
  const [crossfadeSec, setCrossfadeSec] = useState(0.2);
  const [arkitImportInfo, setArkitImportInfo] = useState<{ used: number; unknown: string[] } | null>(null);
  const [mergeArkit, setMergeArkit] = useState(false);
  const [arkitFrames, setArkitFrames] = useState<ARKitFrame[]>([]);
  const [arkitFrameIndex, setArkitFrameIndex] = useState(0);
  const [arkitTimelinePlaying, setArkitTimelinePlaying] = useState(false);
  const [arkitTimelineLoop, setArkitTimelineLoop] = useState(true);
  const [arkitTimelineRate, setArkitTimelineRate] = useState(1);
  const [arkitTimelineBase, setArkitTimelineBase] = useState<FaceARKit52>({});

  const applyPreset = useCallback((idx: number) => {
    const i = Math.max(0, Math.min((DNA_LIBRARY.length || 1) - 1, idx));
    setPresetIdx(i);
    setDna(deepCloneDNA(DNA_LIBRARY[i] ?? DNA_LIBRARY[0] ?? ({} as AvatarDNA)));
  }, []);

  const setMorph = useCallback((key: string, val: number) => {
    setDna((prev) => ({
      ...prev,
      morphs: { ...prev.morphs, [key]: clampSigned(safeNum(val, 0), 1) },
    }));
  }, []);

  const setMat = useCallback((patch: Partial<AvatarDNA["materials"]>) => {
    setDna((prev) => ({ ...prev, materials: { ...prev.materials, ...patch } }));
  }, []);

  const setTex = useCallback((patch: Partial<NonNullable<AvatarDNA["textures"]>>) => {
    setDna((prev) => ({ ...prev, textures: { ...(prev.textures ?? {}), ...patch } }));
  }, []);

  const setPost = useCallback((patch: Partial<AvatarDNA["postfx"]>) => {
    setDna((prev) => ({ ...prev, postfx: { ...prev.postfx, ...patch } }));
  }, []);

  const setQuality = useCallback((patch: Partial<AvatarDNA["quality"]>) => {
    setDna((prev) => ({ ...prev, quality: { ...prev.quality, ...patch } }));
  }, []);

  const importArkitFromJsonText = useCallback((text: string) => {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      alert("Invalid JSON ❌");
      return;
    }

    const timelineFrames = extractArkitFrames(parsed);
    if (timelineFrames.length > 0) {
      const base = mergeArkit ? ((((dna as any).face?.arkit ?? {}) as FaceARKit52)) : {};
      const firstFrame = timelineFrames[0]?.arkit ?? {};

      setArkitFrames(timelineFrames);
      setArkitFrameIndex(0);
      setArkitTimelinePlaying(false);
      setArkitTimelineBase(base);
      setArkitImportInfo({ used: Object.keys(firstFrame).length, unknown: [] });

      setDna((prev) => ({
        ...prev,
        face: { ...(prev as any).face ?? {}, arkit: { ...base, ...firstFrame } },
      }));
      return;
    }

    const raw = extractArkitObject(parsed);
    if (!raw) {
      alert("JSON parsed, but no ARKit/blendShapes object found ❌");
      return;
    }

    const { arkit, used, unknownKeys } = normalizeArkitWeights(raw);

    setDna((prev) => {
      const prevArkit = (prev as any).face?.arkit ?? {};
      const nextArkit = mergeArkit ? ({ ...prevArkit, ...arkit } as FaceARKit52) : arkit;

      return {
        ...prev,
        face: { ...(prev as any).face ?? {}, arkit: nextArkit },
      };
    });

    setArkitImportInfo({ used, unknown: unknownKeys });
    setArkitFrames([]);
    setArkitFrameIndex(0);
    setArkitTimelinePlaying(false);
    setArkitTimelineBase({});

    if (used === 0) {
      alert("Imported 0 ARKit keys (none matched ARKit52). Check naming. ⚠️");
    }
  }, [mergeArkit, setDna, dna]);

  useEffect(() => {
    if (arkitFrames.length === 0) return;
    const idx = Math.max(0, Math.min(arkitFrameIndex, arkitFrames.length - 1));
    const frame = arkitFrames[idx];
    if (!frame) return;
    setDna((prev) => ({
      ...prev,
      face: { ...(prev as any).face ?? {}, arkit: { ...arkitTimelineBase, ...frame.arkit } },
    }));
  }, [arkitFrames, arkitFrameIndex, arkitTimelineBase]);

  useEffect(() => {
    if (!arkitTimelinePlaying || arkitFrames.length <= 1) return;

    const idx = Math.max(0, Math.min(arkitFrameIndex, arkitFrames.length - 1));
    const current = arkitFrames[idx];
    const next = arkitFrames[Math.min(idx + 1, arkitFrames.length - 1)];
    const dtSec = Math.max(1 / 120, (next?.timeSec ?? ((current?.timeSec ?? 0) + 1 / 30)) - (current?.timeSec ?? 0));
    const delayMs = Math.max(8, Math.round((dtSec * 1000) / Math.max(0.1, arkitTimelineRate)));

    const timer = window.setTimeout(() => {
      setArkitFrameIndex((prev) => {
        if (prev >= arkitFrames.length - 1) {
          if (arkitTimelineLoop) return 0;
          setArkitTimelinePlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [arkitTimelinePlaying, arkitFrames, arkitFrameIndex, arkitTimelineLoop, arkitTimelineRate]);

  const exportJson = useMemo(() => JSON.stringify(dna, null, 2), [dna]);
  const arkitTimelineExportJson = useMemo(
    () =>
      JSON.stringify(
        {
          frames: arkitFrames.map((frame) => ({
            timeSec: +frame.timeSec.toFixed(6),
            arkit: frame.arkit,
          })),
        },
        null,
        2
      ),
    [arkitFrames]
  );

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ background: "#141821", color: "#e6eefc" }}>
      {/* Sidebar */}
      <div
        className="w-[460px] min-w-[360px] max-w-[620px] overflow-auto border-r border-black/70"
        style={{ background: "linear-gradient(180deg,#1c2230,#161b26)" }}
      >
        <div className="m-4">
          <div className="text-xl font-extrabold">Avatar Editor — GLB + MorphTargets</div>
          <div className="text-xs text-sky-200/70 mt-1">
            Base: <span className="font-mono">{ASSETS.avatar}</span>
          </div>
        </div>

        {/* Presets */}
        <section className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="font-semibold mb-2">Presets</div>
          <div className="flex items-center gap-2">
            <select
              className="flex-1 px-2 py-2 rounded-md bg-white/10 border border-white/20"
              value={presetIdx}
              onChange={(e) => applyPreset(parseInt(e.target.value, 10))}
            >
              {DNA_LIBRARY.map((_, i) => (
                <option key={i} value={i}>
                  Preset #{i + 1}
                </option>
              ))}
            </select>
            <button className="px-3 py-2 rounded-md border border-white/20 bg-white/10 hover:bg-white/20" onClick={() => applyPreset(presetIdx)}>
              Reset
            </button>
          </div>
        </section>

        {/* Outfit */}
        <section className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="font-semibold mb-2">Clothes Staging</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(["shirt", "pants", "shoes", "mask"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 p-2 rounded bg-black/20 border border-white/10">
                <input checked={(outfit as any)[k]} type="checkbox" onChange={(e) => setOutfit((o) => ({ ...o, [k]: e.target.checked }))} />
                <span className="capitalize">{k}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Animation */}
        <section className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="font-semibold mb-2">Animation</div>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 px-2 py-2 rounded-md bg-white/10 border border-white/20 font-mono text-xs"
              value={activeClip}
              onChange={(e) => setActiveClip(e.target.value)}
              placeholder="GLB clip name"
            />
            <button
              className={`px-3 py-2 rounded-md border border-white/20 font-semibold ${
                paused ? "bg-slate-500/40 hover:bg-slate-500/50" : "bg-emerald-500/40 hover:bg-emerald-500/50"
              }`}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? "▶" : "⏸"}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-black/20 border border-white/10">
              <div className="text-sky-200/80">Speed</div>
              <input type="range" min={0.1} max={2.0} step={0.05} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-full" title="Animation speed multiplier" />
              <div className="font-mono">{speed.toFixed(2)}x</div>
            </div>
            <div className="p-2 rounded bg-black/20 border border-white/10">
              <div className="text-sky-200/80">Crossfade</div>
              <input type="range" min={0.01} max={1.0} step={0.01} value={crossfadeSec} onChange={(e) => setCrossfadeSec(parseFloat(e.target.value))} className="w-full" title="Crossfade duration in seconds" />
              <div className="font-mono">{crossfadeSec.toFixed(2)}s</div>
            </div>
          </div>
        </section>

        {/* Materials */}
        <section className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="font-semibold mb-2">Materials</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="p-2 rounded bg-black/20 border border-white/10">
              <div className="text-xs text-sky-200/80 mb-1">Skin</div>
              <input type="color" value={dna.materials.skinColor} onChange={(e) => setMat({ skinColor: e.target.value })} className="w-full h-9" />
            </label>
            <label className="p-2 rounded bg-black/20 border border-white/10">
              <div className="text-xs text-sky-200/80 mb-1">Hair</div>
              <input type="color" value={dna.materials.hairColor} onChange={(e) => setMat({ hairColor: e.target.value })} className="w-full h-9" />
            </label>
            <label className="p-2 rounded bg-black/20 border border-white/10 col-span-2">
              <div className="flex justify-between">
                <span className="text-xs text-sky-200/80">Roughness</span>
                <span className="font-mono text-xs">{dna.materials.roughness.toFixed(2)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={dna.materials.roughness} onChange={(e) => setMat({ roughness: parseFloat(e.target.value) })} className="w-full" />
            </label>
            <label className="p-2 rounded bg-black/20 border border-white/10 col-span-2">
              <div className="flex justify-between">
                <span className="text-xs text-sky-200/80">Metalness</span>
                <span className="font-mono text-xs">{dna.materials.metalness.toFixed(2)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={dna.materials.metalness} onChange={(e) => setMat({ metalness: parseFloat(e.target.value) })} className="w-full" />
            </label>
          </div>
        </section>

        {/* Textures */}
        <section className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="font-semibold mb-2">Textures</div>
          {(["skinMap", "clothingMap", "maskMap"] as const).map((k) => (
            <label key={k} className="block p-2 rounded bg-black/20 border border-white/10 mb-2">
              <div className="text-xs text-sky-200/80">{k}</div>
              <input
                className="w-full px-2 py-2 rounded-md bg-white/10 border border-white/20 font-mono text-xs"
                value={(dna.textures as any)?.[k] ?? ""}
                onChange={(e) => setTex({ [k]: e.target.value } as any)}
              />
            </label>
          ))}
        </section>

        {/* PostFX + Quality */}
        <section className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="font-semibold mb-2">PostFX + Quality</div>

          <label className="block p-2 rounded bg-black/20 border border-white/10 mb-2">
            <div className="flex justify-between">
              <span className="text-xs text-sky-200/80">Bloom (rim light)</span>
              <span className="font-mono text-xs">{dna.postfx.bloom.toFixed(2)}</span>
            </div>
            <input type="range" min={0} max={0.6} step={0.01} value={dna.postfx.bloom} onChange={(e) => setPost({ bloom: parseFloat(e.target.value) })} className="w-full" />
          </label>

          <label className="block p-2 rounded bg-black/20 border border-white/10 mb-2">
            <div className="flex justify-between">
              <span className="text-xs text-sky-200/80">AO (contact shadows)</span>
              <span className="font-mono text-xs">{dna.postfx.ao.toFixed(2)}</span>
            </div>
            <input type="range" min={0} max={0.8} step={0.01} value={dna.postfx.ao} onChange={(e) => setPost({ ao: parseFloat(e.target.value) })} className="w-full" />
          </label>

          <label className="flex items-center gap-2 p-2 rounded bg-black/20 border border-white/10 text-sm mb-2">
            <input type="checkbox" checked={dna.postfx.smaa} onChange={(e) => setPost({ smaa: e.target.checked })} />
            <span>SMAA → Antialias</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded bg-black/20 border border-white/10 text-sm mb-2">
            <input type="checkbox" checked={dna.quality.shadows} onChange={(e) => setQuality({ shadows: e.target.checked })} />
            <span>Shadows</span>
          </label>

          <label className="block p-2 rounded bg-black/20 border border-white/10 text-sm">
            <div className="flex justify-between">
              <span className="text-xs text-sky-200/80">Shadow Map Size</span>
              <span className="font-mono text-xs">{dna.quality.shadowMapSize}</span>
            </div>
            <select
              aria-label="Shadow map size selection"
              value={dna.quality.shadowMapSize}
              onChange={(e) => setQuality({ shadowMapSize: parseInt(e.target.value, 10) as any })}
              className="w-full px-2 py-2 rounded-md bg-white/10 border border-white/20 mt-1"
            >
              <option value={1024}>1024</option>
              <option value={2048}>2048</option>
            </select>
          </label>
        </section>

        {/* Morphs */}
        <section className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="font-semibold mb-2">Morph Targets</div>
          <div className="space-y-2">
            {MORPH_ORDER.map((k) => {
              const v = safeNum(dna.morphs[k], 0);
              return (
                <div key={k} className="p-2 rounded bg-black/20 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-sky-200/85">{k}</div>
                    <input
                      className="w-24 px-2 py-1 rounded bg-white/10 border border-white/20 font-mono text-xs"
                      value={v.toFixed(3)}
                      onChange={(e) => setMorph(k, safeNum(e.target.value, 0))}
                      title={`Morph target value for ${k}`}
                    />
                  </div>
                  <input type="range" min={-1} max={1} step={0.01} value={v} onChange={(e) => setMorph(k, parseFloat(e.target.value))} className="w-full" title={`Adjust morph target slider for ${k}`} />
                </div>
              );
            })}
          </div>
        </section>

        {/* ARKit Import (JSON) */}
        <section className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="font-semibold mb-2">ARKit Import (JSON)</div>

          <label className="flex items-center gap-2 p-2 rounded bg-black/20 border border-white/10 text-sm mb-2">
            <input type="checkbox" checked={mergeArkit} onChange={(e) => setMergeArkit(e.target.checked)} />
            <span>Merge into existing (else replace)</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              className="px-3 py-2 rounded-md border border-white/20 bg-emerald-400/20 hover:bg-emerald-400/30 font-bold"
              onClick={() => {
                const raw = prompt(
                  "Paste ARKit JSON.\nAccepted forms:\n- { eyeBlinkLeft: 0.2, ... }\n- { blendShapes: {...} }\n- { face: { arkit: {...} } }\n- [ { blendShapes: {...} }, ... ]\n- { frames: [ { timeSec, arkit }, ... ] }"
                );
                if (!raw) return;
                importArkitFromJsonText(raw);
              }}
            >
              Paste JSON
            </button>

            <label className="px-3 py-2 rounded-md border border-white/20 bg-white/10 hover:bg-white/20 font-bold text-center cursor-pointer">
              Load .json
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const text = await readTextFile(f);
                  importArkitFromJsonText(text);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <button
              className="px-3 py-2 rounded-md border border-white/20 bg-white/10 hover:bg-white/20 font-bold col-span-1"
              onClick={async () => {
                const arkit = (dna as any).face?.arkit ?? {};
                try {
                  await navigator.clipboard.writeText(JSON.stringify(arkit, null, 2));
                  alert("Copied ARKit JSON ✅");
                } catch (err) {
                  alert("Failed to copy ❌");
                }
              }}
            >
              Copy ARKit
            </button>

            <button
              className="px-3 py-2 rounded-md border border-white/20 bg-rose-500/20 hover:bg-rose-500/30 font-bold col-span-1"
              onClick={() => {
                setDna((prev) => ({ ...prev, face: { ...(prev as any).face ?? {}, arkit: {} } }));
                setArkitImportInfo(null);
                setArkitFrames([]);
                setArkitFrameIndex(0);
                setArkitTimelinePlaying(false);
                setArkitTimelineBase({});
              }}
            >
              Clear
            </button>

            <button
              className="px-3 py-2 rounded-md border border-white/20 bg-white/10 hover:bg-white/20 font-bold col-span-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={arkitFrames.length === 0}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(arkitTimelineExportJson);
                  alert("Copied ARKit timeline JSON ({ frames }) ✅");
                } catch (err) {
                  alert("Failed to copy ❌");
                }
              }}
              title="Export { frames: [...] } with preserved timeSec"
            >
              Copy Timeline ({'{'} frames {'}'})
            </button>
          </div>

          <div className="text-xs text-sky-200/70 mt-2">
            ARKit keys accepted: <span className="font-mono">{ARKIT52.length}</span> (0..1 weights)
          </div>

          {arkitImportInfo && (
            <div className="mt-2 p-2 rounded bg-black/20 border border-white/10 text-xs">
              <div>
                Imported: <b className="font-mono">{arkitImportInfo.used}</b> keys ✅
              </div>
              {arkitImportInfo.unknown.length > 0 && (
                <div className="mt-1 text-amber-200/90">
                  Ignored (non-ARKit52):{" "}
                  <span className="font-mono">
                    {arkitImportInfo.unknown.slice(0, 10).join(", ")}
                    {arkitImportInfo.unknown.length > 10 ? " …" : ""}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Export */}
        <section className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="font-semibold mb-2">Export DNA JSON</div>
          <div className="flex gap-2">
            <button
              className="flex-1 px-3 py-2 rounded-md border border-white/20 bg-emerald-400/20 hover:bg-emerald-400/30 font-bold"
              onClick={async () => alert((await copyToClipboard(exportJson)) ? "Copied ✅" : "Clipboard blocked ❌")}
            >
              Copy JSON
            </button>
            <button
              className="flex-1 px-3 py-2 rounded-md border border-white/20 bg-white/10 hover:bg-white/20 font-bold"
              onClick={() => {
                const raw = prompt("Paste AvatarDNA JSON:");
                if (!raw) return;
                try {
                  const parsed = JSON.parse(raw) as AvatarDNA;
                  if (!parsed?.morphs || !parsed?.materials || !parsed?.postfx || !parsed?.quality) {
                    alert("Invalid DNA shape.");
                    return;
                  }
                  setDna(deepCloneDNA(parsed));
                } catch {
                  alert("Invalid JSON.");
                }
              }}
            >
              Paste JSON
            </button>
          </div>
        </section>
      </div>

      {/* Viewer */}
      <div className="flex-1 relative">
        <Scene dna={dna} outfit={outfit} activeClip={activeClip} speed={speed} paused={paused} crossfadeSec={crossfadeSec} />
      </div>
    </div>
  );
}

useGLTF.preload(ASSETS.avatar);
useGLTF.preload(ASSETS.clothes.shirt);
useGLTF.preload(ASSETS.clothes.pants);
useGLTF.preload(ASSETS.clothes.shoes);
