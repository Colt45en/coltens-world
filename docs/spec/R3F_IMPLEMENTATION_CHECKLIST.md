# R3F Implementation Checklist (Repo-Mapped)

This checklist maps mathematical 3D foundations to concrete files currently in this repository.

## Scope

Primary R3F implementation target:

- [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx)

Related non-R3F canvas-based render surfaces (for parity checks only):

- [apps/ide-web/src/panels/FlowStatePanel.tsx](apps/ide-web/src/panels/FlowStatePanel.tsx)
- [apps/ide-web/src/panels/WorldGraphPanel.tsx](apps/ide-web/src/panels/WorldGraphPanel.tsx)
- [apps/ide-web/src/OntologyIDE.tsx](apps/ide-web/src/OntologyIDE.tsx)
- [apps/ide-web/src/fx/NeonPhysicsCanvas.tsx](apps/ide-web/src/fx/NeonPhysicsCanvas.tsx)

Type support for Three examples controls:

- [apps/ide-web/src/types/three-jsm.d.ts](apps/ide-web/src/types/three-jsm.d.ts)

---

## 1) Coordinate System & Space Contracts

- [ ] Confirm right-handed, Y-up assumptions are documented in scene entry docs.
- [ ] Ensure imported assets are normalized to world conventions before interaction logic.
- [ ] Keep world/local transform semantics explicit when adding nested groups.

Current anchors:

- Canvas scene entry: [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx#L403)
- Camera initialization: [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx#L122)

---

## 2) Vector Math Correctness

- [ ] Keep movement basis vectors normalized before velocity integration.
- [ ] Maintain flat-ground movement by projecting forward/right onto XZ plane.
- [ ] Guard all `lengthSq` checks before normalize.

Current anchors:

- Quaternion look and basis vectors: [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx#L193)
- Movement integration and damping: [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx#L210)

---

## 3) Rotation Model (Euler vs Quaternion)

- [ ] Prefer quaternion composition for look controls.
- [ ] Avoid incremental Euler accumulation in interactive first-person controls.
- [ ] Keep pitch clamp to avoid singular look states.

Current anchors:

- Yaw/pitch state + clamps: [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx#L76)
- Quaternion application: [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx#L193)

---

## 4) Camera, Frustum, and Precision

- [ ] Validate `near/far` ranges per scene scale to reduce z-fighting risk.
- [ ] Ensure FOV aligns with intended UX (first-person vs overview).
- [ ] Introduce explicit camera presets for deterministic scene testing.

Current anchors:

- Canvas camera params: [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx#L403)

---

## 5) Geometry/Material Lifecycle & GPU Hygiene

- [ ] Ensure explicit disposal for geometry/materials created imperatively.
- [ ] Avoid recreation of static geometry/material each frame.
- [ ] Consider switching repeated primitives to instancing once counts increase.

Current anchors:

- Scene object creation + cleanup: [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx#L267)
- Disposal on unmount: [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx#L374)

---

## 6) Lighting and Surface Response

- [ ] Keep ambient + directional setup deterministic and documented.
- [ ] Verify cast/receive shadow flags per mesh category.
- [ ] Align material choice (`MeshStandardMaterial`) with target lighting model.

Current anchors:

- Ambient + directional light setup: [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx#L271)
- Material usage examples: [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx#L280)

---

## 7) Interaction Raycasting & Determinism

- [ ] Keep raycaster max distance explicit and tested.
- [ ] Normalize interaction selection order (first valid hit in sorted hit list).
- [ ] Keep interaction userData contract typed and centralized.

Current anchors:

- Raycaster setup + hit traversal: [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx#L238)
- Interactable userData type: [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx#L16)

---

## 8) Controls Integration

- [ ] Choose one camera control strategy per mode (pointer-lock vs orbit).
- [ ] Keep control typings in sync for examples/jsm imports.
- [ ] Add integration notes when introducing `OrbitControls` or `PointerLockControls` usage.

Current anchors:

- Three JSM control typings: [apps/ide-web/src/types/three-jsm.d.ts](apps/ide-web/src/types/three-jsm.d.ts)

---

## 9) Performance & Testing Gates

- [ ] Add deterministic scene smoke test for movement + interaction loop.
- [ ] Track frame-time budget for `useFrame` logic expansions.
- [ ] Add guardrails before introducing custom shaders or postprocessing passes.

Recommended follow-up files:

- [docs/spec/MATHEMATICAL_FOUNDATIONS_R3F.md](docs/spec/MATHEMATICAL_FOUNDATIONS_R3F.md)
- [docs/spec/ARCHITECTURE.md](docs/spec/ARCHITECTURE.md)

---

## Minimal Contributor Workflow

1. Validate math assumptions (space, basis vectors, rotation model).
2. Implement feature in [apps/ide-web/src/lab/LabGameEnginePage.tsx](apps/ide-web/src/lab/LabGameEnginePage.tsx).
3. Confirm lifecycle/disposal and interaction contracts.
4. Run typecheck for affected package/app.
5. Update this checklist with any new R3F entry points.
