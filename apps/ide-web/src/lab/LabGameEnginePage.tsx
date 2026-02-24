/// <reference types="@react-three/fiber" />
import * as THREE from "three";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useNavigate } from "react-router-dom";
import { NeonButton } from "../ui/neon";
import { ROUTES } from "../world/routes";

type Keys = {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
  shift: boolean;
  e: boolean;
};

type InteractableUserData = {
  interactable?: boolean;
  interactName?: string;
  onInteract?: () => void;
};

const ZERO = new THREE.Vector3(0, 0, 0);

function useKeyboard() {
  const keysRef = useRef<Keys>({
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    e: false,
  });

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.code === "KeyW") keysRef.current.w = true;
      if (ev.code === "KeyA") keysRef.current.a = true;
      if (ev.code === "KeyS") keysRef.current.s = true;
      if (ev.code === "KeyD") keysRef.current.d = true;
      if (ev.code === "ShiftLeft" || ev.code === "ShiftRight") keysRef.current.shift = true;
      if (ev.code === "KeyE") keysRef.current.e = true;
    };

    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.code === "KeyW") keysRef.current.w = false;
      if (ev.code === "KeyA") keysRef.current.a = false;
      if (ev.code === "KeyS") keysRef.current.s = false;
      if (ev.code === "KeyD") keysRef.current.d = false;
      if (ev.code === "ShiftLeft" || ev.code === "ShiftRight") keysRef.current.shift = false;
      if (ev.code === "KeyE") keysRef.current.e = false;
    };

    globalThis.addEventListener("keydown", onKeyDown);
    globalThis.addEventListener("keyup", onKeyUp);
    return () => {
      globalThis.removeEventListener("keydown", onKeyDown);
      globalThis.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return keysRef;
}

function HUDSignal({ hint, active }: Readonly<{ hint: string; active: boolean }>) {
  useEffect(() => {
    const event = new CustomEvent("we-hud", { detail: { hint, active } });
    globalThis.dispatchEvent(event);
  }, [hint, active]);

  return null;
}

function PlayerController() {
  const { camera, gl, scene } = useThree();
  const keysRef = useKeyboard();

  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const rightMouseDownRef = useRef(false);
  const pointerLockedRef = useRef(false);

  const pointerNdc = useRef(new THREE.Vector2(0, 0));
  const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const desiredRef = useRef(new THREE.Vector3(0, 0, 0));

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hoveredRef = useRef<THREE.Object3D | null>(null);
  const eWasDownRef = useRef(false);
  const [hud, setHud] = useState<{ name: string; can: boolean }>({ name: "", can: false });

  const baseSpeed = 6.5;
  const sprintMult = 1.65;
  const accel = 28;
  const damping = 18;
  const mouseSensitivity = 0.0022;
  const pitchClamp = Math.PI / 2 - 0.05;
  const interactMaxDistance = 6;

  const requestLock = useCallback(() => {
    const el = gl.domElement;
    if (globalThis.document.pointerLockElement !== el) el.requestPointerLock();
  }, [gl.domElement]);

  const exitLock = useCallback(() => {
    if (globalThis.document.pointerLockElement) globalThis.document.exitPointerLock();
  }, []);

  const tryInteract = useCallback(() => {
    const source = hoveredRef.current;
    if (!source) return;

    let current: THREE.Object3D | null = source;
    while (current) {
      const data = current.userData as InteractableUserData;
      if (data.interactable && typeof data.onInteract === "function") {
        data.onInteract();
        return;
      }
      current = current.parent;
    }
  }, []);

  useEffect(() => {
    camera.position.set(0, 1.7, 6);
    camera.rotation.set(0, 0, 0);
  }, [camera]);

  useEffect(() => {
    const el = gl.domElement;

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onPointerLockChange = () => {
      pointerLockedRef.current = globalThis.document.pointerLockElement === el;
      if (!pointerLockedRef.current) rightMouseDownRef.current = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return;
      rightMouseDownRef.current = true;
      requestLock();
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 2) return;
      rightMouseDownRef.current = false;
      exitLock();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (pointerLockedRef.current) {
        yawRef.current -= e.movementX * mouseSensitivity;
        pitchRef.current -= e.movementY * mouseSensitivity;
        pitchRef.current = Math.max(-pitchClamp, Math.min(pitchClamp, pitchRef.current));
        pointerNdc.current.set(0, 0);
        return;
      }

      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      pointerNdc.current.set(x, y);

      if (!rightMouseDownRef.current) return;

      yawRef.current -= e.movementX * mouseSensitivity;
      pitchRef.current -= e.movementY * mouseSensitivity;
      pitchRef.current = Math.max(-pitchClamp, Math.min(pitchClamp, pitchRef.current));
    };

    el.addEventListener("contextmenu", onContextMenu);
    globalThis.document.addEventListener("pointerlockchange", onPointerLockChange);
    globalThis.addEventListener("mousedown", onMouseDown);
    globalThis.addEventListener("mouseup", onMouseUp);
    globalThis.addEventListener("mousemove", onMouseMove);

    return () => {
      el.removeEventListener("contextmenu", onContextMenu);
      globalThis.document.removeEventListener("pointerlockchange", onPointerLockChange);
      globalThis.removeEventListener("mousedown", onMouseDown);
      globalThis.removeEventListener("mouseup", onMouseUp);
      globalThis.removeEventListener("mousemove", onMouseMove);
      exitLock();
    };
  }, [exitLock, gl.domElement, requestLock]);

  const applyCameraRotation = () => {
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);
    const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchRef.current);
    camera.quaternion.copy(yawQ as any).multiply(pitchQ as any);
  };

  const getFlatBasis = () => {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion as unknown as THREE.Quaternion);
    forward.y = 0;
    if (forward.lengthSq() > 0) forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion as unknown as THREE.Quaternion);
    right.y = 0;
    if (right.lengthSq() > 0) right.normalize();

    return { forward, right };
  };

  const updateMovement = (dt: number) => {
    const { forward, right } = getFlatBasis();
    const input = new THREE.Vector3(0, 0, 0);
    const k = keysRef.current;
    if (k.w) input.add(forward);
    if (k.s) input.sub(forward);
    if (k.d) input.add(right);
    if (k.a) input.sub(right);
    if (input.lengthSq() > 0) input.normalize();

    const speed = baseSpeed * (k.shift ? sprintMult : 1);
    desiredRef.current.copy(input).multiplyScalar(speed);

    const velocity = velocityRef.current;
    if (input.lengthSq() > 0) {
      const t = 1 - Math.exp(-accel * dt);
      velocity.lerp(desiredRef.current, t);
    } else {
      const t = 1 - Math.exp(-damping * dt);
      velocity.lerp(ZERO, t);
    }

    camera.position.addScaledVector(velocity as unknown as THREE.Vector3, dt);
  };

  const findHoveredInteractable = () => {
    raycaster.setFromCamera(pointerNdc.current, camera as unknown as THREE.Camera);
    raycaster.far = interactMaxDistance;

    const hits = raycaster.intersectObjects(scene.children as unknown as THREE.Object3D[], true);
    for (const hit of hits) {
      let current: THREE.Object3D | null = hit.object;
      while (current) {
        const data = current.userData as InteractableUserData;
        if (data.interactable) {
          return {
            hovered: hit.object,
            name: data.interactName ?? "Interact",
            can: true,
          };
        }
        current = current.parent;
      }
    }

    return { hovered: null, name: "", can: false };
  };

  const updateInteractionHud = (name: string, can: boolean) => {
    setHud((prev) => (prev.name === name && prev.can === can ? prev : { name, can }));
  };

  const handleInteractPress = (can: boolean) => {
    const eDown = keysRef.current.e;
    if (eDown && !eWasDownRef.current && can) {
      tryInteract();
    }
    eWasDownRef.current = eDown;
  };

  useFrame((_state, dt) => {
    applyCameraRotation();
    updateMovement(dt);
    const hit = findHoveredInteractable();
    hoveredRef.current = hit.hovered;
    updateInteractionHud(hit.name, hit.can);
    handleInteractPress(hit.can);
  });

  return (
    <HUDSignal
      hint={hud.can ? `Press E to ${hud.name}` : "RMB hold: pointer-lock look · WASD glide · Shift sprint"}
      active={hud.can}
    />
  );
}

function SceneObjects() {
  const { scene } = useThree();

  useEffect(() => {
    const created: THREE.Object3D[] = [];

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient as any);
    created.push(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(5, 10, 5);
    sun.castShadow = true;
    scene.add(sun as any);
    created.push(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: "#0f172a" }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    ground.receiveShadow = true;
    ground.userData = { ground: true };
    scene.add(ground as any);
    created.push(ground);

    const cubeA = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: "#38bdf8" }),
    );
    cubeA.position.set(0, 1, 0);
    cubeA.castShadow = true;
    cubeA.userData = {
      interactable: true,
      interactName: "use cube",
      onInteract: () => {
        cubeA.position.x += (Math.random() - 0.5) * 2;
        cubeA.position.z += (Math.random() - 0.5) * 2;
      },
    } satisfies InteractableUserData;
    scene.add(cubeA as any);
    created.push(cubeA);

    const cubeB = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: "#38bdf8" }),
    );
    cubeB.position.set(4, 1, -6);
    cubeB.castShadow = true;
    cubeB.userData = {
      interactable: true,
      interactName: "use cube",
      onInteract: () => {
        cubeB.position.x += (Math.random() - 0.5) * 2;
        cubeB.position.z += (Math.random() - 0.5) * 2;
      },
    } satisfies InteractableUserData;
    scene.add(cubeB as any);
    created.push(cubeB);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 24),
      new THREE.MeshStandardMaterial({ color: "#f59e0b" }),
    );
    sphere.position.set(-5, 1, -10);
    sphere.castShadow = true;
    scene.add(sphere as any);
    created.push(sphere);

    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 2, 20),
      new THREE.MeshStandardMaterial({ color: "#34d399" }),
    );
    cylinder.position.set(6, 1, -12);
    cylinder.castShadow = true;
    scene.add(cylinder as any);
    created.push(cylinder);

    return () => {
      for (const object of created) {
        scene.remove(object as any);
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const mats = Array.isArray(object.material) ? object.material : [object.material];
          for (const mat of mats) mat.dispose();
        }
      }
    };
  }, [scene]);

  return null;
}

export function LabGameEnginePage() {
  const navigate = useNavigate();
  const [hint, setHint] = useState("RMB hold: pointer-lock look · WASD glide · Shift sprint");
  const [active, setActive] = useState(false);

  useEffect(() => {
    const prevOverflow = globalThis.document.body.style.overflow;
    globalThis.document.body.style.overflow = "hidden";

    const onHud = (event: Event) => {
      const custom = event as CustomEvent<{ hint: string; active: boolean }>;
      setHint(custom.detail.hint);
      setActive(custom.detail.active);
    };

    globalThis.addEventListener("we-hud", onHud as EventListener);

    return () => {
      globalThis.removeEventListener("we-hud", onHud as EventListener);
      globalThis.document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-30 overflow-hidden bg-slate-950">
      <Canvas shadows camera={{ fov: 70, near: 0.1, far: 500 }}>
        <PlayerController />
        <SceneObjects />
      </Canvas>

      <div className="absolute top-3 left-3 flex items-center gap-2">
        <NeonButton variant="ghost" onClick={() => navigate(ROUTES.root)}>
          Back
        </NeonButton>
      </div>

      <div
        className={`absolute left-4 bottom-4 max-w-[520px] rounded-xl px-3 py-2 text-sm leading-snug text-white pointer-events-none ${
          active ? "bg-black/65" : "bg-black/35"
        }`}
      >
        {hint}
      </div>

      <div
        className={`absolute left-1/2 top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none border-2 ${
          active ? "border-white" : "border-white/50"
        }`}
      />
    </div>
  );
}
