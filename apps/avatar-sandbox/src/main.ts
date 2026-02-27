/**
 * World Engine Avatar Sandbox
 * WEGC v1.0 Interactive Geometry Editor & Export Tool
 */

import {
    buildCanonicalSkeleton,
    calculatePoseEnergy,
    CANONICAL_JOINTS,
    canonicalStringify,
    DEFAULT_ROTATION_LIMITS,
    exportAvatarToGLB,
    generateAvatarId,
    hashCanonicalState,
    SKELETON_HIERARCHY,
    type AvatarGeometryState,
    type AvatarManifest,
    type JointConstraint,
    type Quat,
} from "@world-engine/wegc-geometry";
import * as THREE from "three";

interface AppState {
  avatarId: string;
  avatarName: string;
  joints: Map<string, THREE.Bone>;
  geometryState: AvatarGeometryState;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  selectedJoint: string | null;
  lastLoadTime: number;
}

const state: AppState = {
  avatarId: generateAvatarId(),
  avatarName: "CustomAvatar",
  joints: new Map(),
  geometryState: initializeGeometryState(),
  scene: null as any,
  camera: null as any,
  renderer: null as any,
  selectedJoint: null,
  lastLoadTime: 0,
};

/**
 * Initialize empty geometry state
 */
function initializeGeometryState(): AvatarGeometryState {
  const skeleton = buildCanonicalSkeleton();

  const constraints: JointConstraint[] = skeleton.map((joint) => ({
    joint: joint.name,
    mode: "ARMOR_SAFE",
    limits: DEFAULT_ROTATION_LIMITS[joint.name] || [],
    damping: 0.1,
  }));

  return {
    version: "1.0",
    skeleton: {
      joints: skeleton,
      constraints,
    },
    geometry: {
      capsule_limbs: generateCapsuleLimbs(skeleton),
      gear_envelopes: [],
    },
    pose: {
      joint_rotations: Object.fromEntries(
        skeleton.map((j) => [j.name, { x: 0, y: 0, z: 0, w: 1 } as Quat])
      ),
      energy: { global: 0, per_joint: {}, violations: [] },
    },
    ik: {
      goals: [],
      weights_per_goal: new Map(),
    },
    contact: {
      multi_contacts: new Map(),
      surface_patches: [],
      active_stacks: new Map(),
    },
    temporal: {
      face_features: {
        eye_mid: { x: 0, y: 1.78, z: 0.09 },
        mouth_point: { x: 0, y: 1.65, z: 0.05 },
        stabilization_alpha: 0.85,
      },
      bands: [],
      micro_jitter_filter: new Map(),
    },
  };
}

function generateCapsuleLimbs(skeleton: any[]) {
  const limbs = [];
  for (const [child, parent] of SKELETON_HIERARCHY) {
    if (parent) {
      limbs.push({
        from_joint: parent,
        to_joint: child,
        radius: 0.02,
      });
    }
  }
  return limbs;
}

/**
 * Initialize Three.js scene
 */
function initScene() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const container = document.getElementById("viewport")!;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );

  camera.position.set(0, 1.5, 3);
  camera.lookAt(0, 1, 0);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  // Grid
  const grid = new THREE.GridHelper(20, 20, 0x404040, 0x303030);
  scene.add(grid);

  // Axes
  const axesHelper = new THREE.AxesHelper(1);
  scene.add(axesHelper);

  state.scene = scene;
  state.camera = camera;
  state.renderer = renderer;

  // Build skeleton mesh
  buildSkeletonMesh();

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  animate();

  // Handle resize
  window.addEventListener("resize", () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

/**
 * Build 3D skeleton mesh from geometry state
 */
function buildSkeletonMesh() {
  // Clear existing
  state.joints.forEach((bone) => state.scene.remove(bone));
  state.joints.clear();

  const geometry = state.geometryState.skeleton.joints;

  // Create bones
  const boneMap = new Map<string, THREE.Bone>();

  for (const joint of geometry) {
    const bone = new THREE.Bone();
    bone.name = joint.name;
    bone.position.set(joint.position.x, joint.position.y, joint.position.z);
    boneMap.set(joint.name, bone);

    // Add sphere visualization
    const sphereGeo = new THREE.SphereGeometry(joint.radius * 1.5, 8, 8);
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0x3B82F6 });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    bone.add(sphere);

    // Add interaction
    bone.userData.isJoint = true;
    sphere.userData.jointName = joint.name;

    state.joints.set(joint.name, bone);
  }

  // Wire up hierarchy
  for (const [child, parent] of SKELETON_HIERARCHY) {
    if (parent && boneMap.has(parent) && boneMap.has(child)) {
      const childBone = boneMap.get(child)!;
      boneMap.get(parent)!.add(childBone);
      childBone.position.copy(CANONICAL_JOINTS[child]).sub(CANONICAL_JOINTS[parent as any]);
    }
  }

  // Add root to scene
  const root = boneMap.get("Hips");
  if (root) {
    state.scene.add(root);
  }

  // Draw capsules
  for (const limb of state.geometryState.geometry.capsule_limbs) {
    const fromJoint = CANONICAL_JOINTS[limb.from_joint];
    const toJoint = CANONICAL_JOINTS[limb.to_joint];

    const p1 = new THREE.Vector3(fromJoint.x, fromJoint.y, fromJoint.z);
    const p2 = new THREE.Vector3(toJoint.x, toJoint.y, toJoint.z);

    const distance = p1.distanceTo(p2);
    const midpoint = p1.clone().add(p2).multiplyScalar(0.5);
    const direction = p2.clone().sub(p1).normalize();

    const capsule = new THREE.CapsuleGeometry(limb.radius, distance, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0x60A5FA, transparent: true, opacity: 0.3 });
    const mesh = new THREE.Mesh(capsule, material);

    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction
    );
    mesh.quaternion.copy(quaternion);
    mesh.position.copy(midpoint);

    state.scene.add(mesh);
  }

  updateSkeletonList();
}

/**
 * Update skeleton list in sidebar
 */
function updateSkeletonList() {
  const list = document.getElementById("skeleton-list")!;
  list.innerHTML = "";

  for (const joint of state.geometryState.skeleton.joints) {
    const item = document.createElement("div");
    item.className =
      "p-2 bg-slate-800 rounded cursor-pointer hover:bg-slate-700 transition-colors " +
      (state.selectedJoint === joint.name ? "bg-blue-600" : "");
    item.textContent = joint.name;
    item.onclick = () => selectJoint(joint.name);
    list.appendChild(item);
  }
}

/**
 * Select a joint for editing
 */
function selectJoint(jointName: string) {
  state.selectedJoint = jointName;
  updateSkeletonList();
  updateJointInfo();

  // Highlight in scene
  state.joints.forEach((bone, name) => {
    const sphere = bone.children[0] as THREE.Mesh;
    if (sphere && sphere.material instanceof THREE.MeshStandardMaterial) {
      sphere.material.color.setHex(name === jointName ? 0xFF6B6B : 0x3B82F6);
      sphere.material.emissive.setHex(name === jointName ? 0xFF6B6B : 0x000000);
    }
  });
}

/**
 * Update joint info panel
 */
function updateJointInfo() {
  const infoBox = document.getElementById("joint-info")!;

  if (!state.selectedJoint) {
    infoBox.innerHTML = '<div class="text-slate-500">No joint selected</div>';
    return;
  }

  const joint = state.geometryState.skeleton.joints.find((j) => j.name === state.selectedJoint);
  const quat = state.geometryState.pose.joint_rotations[state.selectedJoint];

  if (!joint || !quat) return;

  infoBox.innerHTML = `
        <div class="text-sm space-y-1">
            <div><strong>Name:</strong> <code>${joint.name}</code></div>
            <div><strong>Type:</strong> <code>${joint.limb_type}</code></div>
            <div><strong>Position:</strong> <code>({joint.position.x.toFixed(3)}, ${joint.position.y.toFixed(3)}, ${joint.position.z.toFixed(3)})</code></div>
            <div><strong>Rotation:</strong> <code>({quat.x.toFixed(3)}, ${quat.y.toFixed(3)}, ${quat.z.toFixed(3)}, ${quat.w.toFixed(3)})</code></div>
        </div>
    `;
}

/**
 * Update energy metrics
 */
function updateEnergyMetrics() {
  const energy = calculatePoseEnergy(state.geometryState);
  state.geometryState.pose.energy = energy;

  const metricsDiv = document.getElementById("energy-metrics")!;
  metricsDiv.innerHTML = `
        <div class="metric">
            <span class="metric-label">Global Energy</span>
            <span class="metric-value">${(energy.global * 100).toFixed(1)}%</span>
        </div>
        <div class="metric">
            <span class="metric-label">Violations</span>
            <span class="metric-value">${energy.violations.length}</span>
        </div>
    `;
}

/**
 * Export to GLB
 */
async function exportGLB() {
  const manifest: AvatarManifest = {
    version: "1.0",
    avatar_id: state.avatarId,
    created_at: state.lastLoadTime || Math.floor(Date.now() / 1000),
    modified_at: Math.floor(Date.now() / 1000),
    geometry_hash: hashCanonicalState(
      canonicalStringify(state.geometryState.skeleton)
    ),
    format: "glb",
    bone_count: state.geometryState.skeleton.joints.length,
    material_slots: ["skin"],
    metadata: {
      name: state.avatarName,
      description: "World Engine WEGC Avatar",
      tags: ["wegc", "avatar", "procedural"],
    },
  };

  try {
    const buffer = await exportAvatarToGLB(state.geometryState, manifest);
    const blob = new Blob([buffer], { type: "model/gltf-binary" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.avatarName}-${state.avatarId}.glb`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Export failed:", error);
    alert("Failed to export avatar");
  }
}

/**
 * Export manifest as JSON
 */
function exportJSON() {
  const manifest: AvatarManifest = {
    version: "1.0",
    avatar_id: state.avatarId,
    created_at: state.lastLoadTime || Math.floor(Date.now() / 1000),
    modified_at: Math.floor(Date.now() / 1000),
    geometry_hash: hashCanonicalState(
      canonicalStringify(state.geometryState.skeleton)
    ),
    format: "glb",
    bone_count: state.geometryState.skeleton.joints.length,
    material_slots: ["skin"],
    metadata: {
      name: state.avatarName,
      description: "World Engine WEGC Avatar",
      tags: ["wegc", "avatar", "procedural"],
    },
  };

  const json = JSON.stringify(
    { manifest, geometry: state.geometryState },
    null,
    2
  );
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.avatarName}-${state.avatarId}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Avatar info
  (document.getElementById("avatar-name") as HTMLInputElement)!.addEventListener(
    "change",
    (e) => {
      state.avatarName = (e.target as HTMLInputElement).value || "CustomAvatar";
    }
  );

  (document.getElementById("avatar-id") as HTMLInputElement)!.value = state.avatarId;

  document.getElementById("btn-gen-id")!.addEventListener("click", () => {
    state.avatarId = generateAvatarId();
    (document.getElementById("avatar-id") as HTMLInputElement)!.value = state.avatarId;
  });

  // Buttons
  document.getElementById("btn-reset")!.addEventListener("click", () => {
    state.geometryState = initializeGeometryState();
    buildSkeletonMesh();
    updateEnergyMetrics();
  });

  document.getElementById("btn-export")!.addEventListener("click", exportGLB);
  document.getElementById("btn-export-json")!.addEventListener("click", exportJSON);

  document.getElementById("btn-manifest")!.addEventListener("click", () => {
    const data = {
      version: "1.0",
      avatar_id: state.avatarId,
      name: state.avatarName,
      joint_count: state.geometryState.skeleton.joints.length,
      pose_energy: state.geometryState.pose.energy,
    };
    alert(JSON.stringify(data, null, 2));
  });

  // Material controls
  (document.getElementById("roughness") as HTMLInputElement)!.addEventListener(
    "input",
    (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      (document.getElementById("roughness-val") as HTMLElement)!.textContent =
        val.toFixed(2);
    }
  );

  // Update metrics on load
  updateEnergyMetrics();
}

/**
 * Main initialization
 */
function main() {
  initScene();
  setupEventListeners();
  console.log("✓ World Engine Avatar Sandbox initialized");
  console.log("✓ WEGC v1.0 loaded");
  console.log("✓ Avatar ID:", state.avatarId);
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
