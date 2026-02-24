import { Suspense, useMemo, type ReactElement } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer, SMAA, SSAO } from "@react-three/postprocessing";
import AvatarModel from "./AvatarModel";
import type { AvatarDNA } from "./dna";
import PerfHUD from "../perf/PerfHUD";
import AutoQualityScaler from "../perf/AutoQualityScaler";
import { useAvatarStore } from "../state/useAvatarStore";
import type { MorphDebugMeshInfo } from "../state/useAvatarStore";

function Ground() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial roughness={0.98} metalness={0} />
    </mesh>
  );
}

type Props = {
  dna: AvatarDNA;
  previewMorphs: Record<string, number>;
  onMorphNames: (names: string[]) => void;
  onMorphDebugMeshes: (meshes: MorphDebugMeshInfo[]) => void;
  avatarGroupRef: React.RefObject<THREE.Group>;
};

export default function AvatarScene({ dna, previewMorphs, onMorphNames, onMorphDebugMeshes, avatarGroupRef }: Props) {
  const runtimeQ = useAvatarStore((state) => state.runtimeQuality);

  const shadowsEnabled = runtimeQ.shadowsEnabled ?? dna.quality.shadows;
  const shadowMapSize = runtimeQ.shadowMapSize ?? dna.quality.shadowMapSize;
  const aoEnabled = runtimeQ.aoEnabled ?? true;
  const smaaEnabled = runtimeQ.smaaEnabled ?? dna.postfx.smaa;
  const bloomScale = runtimeQ.bloomScale ?? 1;

  const lightConfig = useMemo(
    () => ({ direction: new THREE.Vector3(3, 6, 2), intensity: 1.15 }),
    []
  );

  const composerPasses = useMemo(() => {
    const passes: ReactElement[] = [];
    if (smaaEnabled) passes.push(<SMAA key="smaa" />);
    if (aoEnabled) {
      passes.push(<SSAO key="ao" intensity={dna.postfx.ao} radius={0.12} luminanceInfluence={0.6} />);
    }
    passes.push(
      <Bloom
        key="bloom"
        intensity={dna.postfx.bloom * bloomScale}
        luminanceThreshold={0.65}
        luminanceSmoothing={0.2}
      />
    );
    return passes;
  }, [aoEnabled, bloomScale, dna.postfx.ao, dna.postfx.bloom, smaaEnabled]);

  return (
    <Canvas
      shadows={shadowsEnabled}
      camera={{ position: [0, 1.2, 2.8], fov: 45, near: 0.01, far: 200 }}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={0.35} />

      <directionalLight
        position={lightConfig.direction.toArray()}
        intensity={lightConfig.intensity}
        castShadow={shadowsEnabled}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
      />

      <Ground />

      <Suspense fallback={null}>
        <AvatarModel
          url="/avatar.glb"
          avatarGroupRef={avatarGroupRef}
          previewMorphs={previewMorphs}
          committedMorphs={dna.morphs}
          onMorphNames={onMorphNames}
          onMorphDebugMeshes={onMorphDebugMeshes}
          dnaForMaterial={dna}
        />
        <Environment preset="studio" />
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={1.2}
        maxDistance={6}
        maxPolarAngle={Math.PI * 0.49}
        target={[0, 1, 0]}
      />

      <PerfHUD />
      <AutoQualityScaler />

      <EffectComposer>{composerPasses}</EffectComposer>
    </Canvas>
  );
}
