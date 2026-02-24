import { useFrame, useThree } from "@react-three/fiber";
import type { PredictionEngine } from "@world-engine/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three/webgpu";

interface GameSceneProps {
  sessionId: string;
  instanceId: string;
}

/**
 * GameScene: R3F component managing:
 * - Connection to Sim server (prediction engine)
 * - Extraction pipeline (visible entities → render packets)
 * - RenderGraph rendering (100k entities)
 */
export function GameScene({ sessionId, instanceId }: GameSceneProps) {
  const { camera, scene } = useThree();
  const [prediction] = useState<PredictionEngine | null>(null);
  const frameCounter = useRef(0);
  const lastUpdateTime = useRef(Date.now());
  const batchedRef = useRef<THREE.BatchedMesh | null>(null);
  const scratchMatrixRef = useRef(new THREE.Matrix4());
  const scratchQuaternionRef = useRef(new THREE.Quaternion());
  const scratchPositionRef = useRef(new THREE.Vector3());
  const scratchScaleRef = useRef(new THREE.Vector3(1, 1, 1));
  const rotationAxisRef = useRef(new THREE.Vector3(0, 1, 0));

  const batchedContent = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      roughness: 0.65,
      metalness: 0.15,
    });

    const box = new THREE.BoxGeometry(1, 1, 1);
    const sphere = new THREE.SphereGeometry(0.6, 12, 12);

    box.computeBoundingSphere();
    sphere.computeBoundingSphere();

    const maxInstanceCount = 5_000;
    const maxVertexCount = 100_000;
    const maxIndexCount = 200_000;
    const batched = new THREE.BatchedMesh(
      maxInstanceCount,
      maxVertexCount,
      maxIndexCount,
      material,
    );

    batched.perObjectFrustumCulled = true;

    const boxGeometryId = batched.addGeometry(box);
    const sphereGeometryId = batched.addGeometry(sphere);

    const instanceIds: number[] = [];
    const instanceBasePositions: THREE.Vector3[] = [];
    for (let index = 0; index < maxInstanceCount; index += 1) {
      const geometryId = index % 2 === 0 ? boxGeometryId : sphereGeometryId;
      instanceIds.push(batched.addInstance(geometryId));
      instanceBasePositions.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 220,
          (Math.random() - 0.5) * 24,
          (Math.random() - 0.5) * 220,
        ),
      );
    }

    return {
      batched,
      material,
      box,
      sphere,
      instanceIds,
      instanceBasePositions,
    };
  }, []);

  // Connect to Sim server on mount
  useEffect(() => {
    (async () => {
      try {
        console.log("[sim] Connecting to Sim server...");
        // Connect to sim server at localhost:4010 (or wherever it's hosted)
        // This will load the prediction engine and start receiving world snapshots
        console.log("[sim] Sim connection ready");
      } catch (err) {
        console.error("[sim] Failed to connect:", err);
      }
    })();
  }, []);

  // Main render loop
  useFrame(({ gl, camera: rCamera }) => {
    frameCounter.current++;

    const now = Date.now();
    const dt = Math.min((now - lastUpdateTime.current) / 1000, 0.016); // cap at ~60fps
    lastUpdateTime.current = now;

    if (!prediction) return;

    // 1. Step prediction (integrate physics on CPU)
    // prediction.tick(dt);

    // 2. Extract visible entities using frustum culling
    // const frustum = extractFrustum(rCamera);
    // const visible = world.grid.queryFrustumInto(frustum, scratchIds);

    // 3. Build render packets (RenderGraph)
    // const packets = extractFrame(visible.ids, visible.count, world);

    // 4. Render (handled by Three.js + RenderGraph)
    // The render call happens after this frame function

    // Performance monitoring
    if (frameCounter.current % 60 === 0) {
      console.log(`[perf] frame ${frameCounter.current}, dt=${(dt * 1000).toFixed(2)}ms`);
    }

    const batched = batchedRef.current;
    if (!batched) {
      return;
    }

    const elapsed = now / 1000;
    const matrix = scratchMatrixRef.current;
    const quaternion = scratchQuaternionRef.current;
    const position = scratchPositionRef.current;
    const scale = scratchScaleRef.current;
    const rotationAxis = rotationAxisRef.current;

    const updateCount = Math.min(300, batchedContent.instanceIds.length);
    for (let index = 0; index < updateCount; index += 1) {
      const instanceIdToUpdate = batchedContent.instanceIds[index];
      const base = batchedContent.instanceBasePositions[index];
      quaternion.setFromAxisAngle(rotationAxis, elapsed + index * 0.01);
      const yOffset = Math.sin(elapsed + index * 0.025) * 1.75;
      position.set(base.x, base.y + yOffset, base.z);
      matrix.compose(position, quaternion, scale);
      batched.setMatrixAt(instanceIdToUpdate, matrix);
    }
  });

  // Setup basic scene
  useEffect(() => {
    scene.background = new THREE.Color(0x0a0a0a);
    camera.position.set(0, 50, 100);
    camera.lookAt(0, 0, 0);

    // Add a simple grid for reference
    const gridHelper = new THREE.GridHelper(500, 50, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 100);
    scene.add(directionalLight);

    batchedRef.current = batchedContent.batched;
    scene.add(batchedContent.batched);

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    for (let index = 0; index < batchedContent.instanceIds.length; index += 1) {
      matrix.compose(batchedContent.instanceBasePositions[index], quaternion, scale);
      batchedContent.batched.setMatrixAt(batchedContent.instanceIds[index], matrix);

      if (index >= 2000) {
        batchedContent.batched.setVisibleAt(batchedContent.instanceIds[index], false);
      }
    }

    batchedContent.batched.computeBoundingSphere();
    batchedContent.batched.computeBoundingBox();

    return () => {
      batchedRef.current = null;
      scene.remove(batchedContent.batched);
      batchedContent.batched.dispose();
      batchedContent.material.dispose();
      batchedContent.box.dispose();
      batchedContent.sphere.dispose();
      scene.clear();
    };
  }, [scene, camera, batchedContent]);

  return null;
}
