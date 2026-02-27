/**
 * GameScene — R3F component for WebGPU swarm rendering
 *
 * Integrates NexusSwarmSystem into React Three Fiber canvas.
 * Runs compute each frame, renders 100k+ agents at 60 FPS.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { NexusSwarmSystem } from "@world-engine/graphics";
import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";

/**
 * Scene component (drop into Canvas)
 *
 * Usage:
 *   <Canvas ...>
 *     <GameScene />
 *   </Canvas>
 */
export function GameScene() {
  const { gl, scene } = useThree();

  // Create swarm system (memoized)
  const swarm = useMemo(() => {
    return new NexusSwarmSystem({
      agentCount: 100_000,

      // World bounds (adjust for your scene)
      worldMin: new THREE.Vector3(-80, -80, -80),
      worldMax: new THREE.Vector3(80, 80, 80),

      // Spatial grid parameters
      cellSize: 2.5, // world units per cell
      cellCapacity: 64, // max agents per cell (tune 32–128)

      // Flocking behavior radii
      separationRadius: 2.0, // repulsion distance
      cohesionRadius: 6.5, // grouping distance
      alignmentRadius: 6.5, // velocity matching distance

      // Behavior weights (tune these for feel)
      weights: {
        seek: 0.9, // goal attraction (low = ignore goal, high = chase)
        separation: 1.2, // repulsion strength (prevent crowding)
        cohesion: 0.25, // grouping strength (stick together)
        alignment: 0.3, // velocity matching (coordinated movement)
        damping: 0.985, // velocity decay per frame (0.95–0.99)
      },

      maxSpeed: 14.0, // world units/sec
    });
  }, []);

  // Add points to scene, cleanup on unmount
  useEffect(() => {
    scene.add(swarm.points);
    return () => {
      scene.remove(swarm.points);
      swarm.dispose();
    };
  }, [scene, swarm]);

  // Per-frame compute dispatch
  useFrame((_, deltaSeconds) => {
    const renderer = gl as unknown as THREE.Renderer;

    // Compute shader execution (WebGPU only)
    if (typeof (renderer as any).compute !== "function") {
      console.warn("Renderer.compute not available; WebGPU backend required");
      return;
    }

    swarm.step(renderer, deltaSeconds);
  });

  // Lighting
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 3]} intensity={1.2} />
    </>
  );
}
