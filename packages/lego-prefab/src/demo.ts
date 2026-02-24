import { mkdirSync, writeFileSync } from "node:fs";
import {
  AXLEHOLE_PRIMS,
  LDU,
  bevelGearMesh,
  generatePrefab,
  hingeTransform,
  m4Translate,
  mergeMeshes,
  meshToOBJ,
  snotTransform,
  spurGearMesh,
  systemRect,
  systemSlope,
  technicAxleMeshHiFi,
  technicBeamHiFi,
  technicBeamPrims,
  technicPinMesh,
  transformMesh,
  v3,
} from "./index.js";

mkdirSync("out", { recursive: true });

const brick2x4 = generatePrefab("brick_2x4");
writeFileSync("out/brick_2x4.obj", meshToOBJ(brick2x4, { name: "brick_2x4", scaleMm: true }));

const slope2x2 = systemSlope({ studsX: 2, studsY: 2, platesH: 3, lowAtNegX: true, withStuds: true });
writeFileSync("out/slope_2x2.obj", meshToOBJ(slope2x2, { name: "slope_2x2", scaleMm: true }));

writeFileSync("out/arc_tile_1to2stud_90deg.obj", meshToOBJ(generatePrefab("arc_tile_90"), { name: "arc_tile", scaleMm: true }));
writeFileSync("out/technic_beam_7.obj", meshToOBJ(generatePrefab("technic_beam_7"), { name: "technic_beam_7", scaleMm: true }));
writeFileSync("out/round_2x2_brick.obj", meshToOBJ(generatePrefab("round_2x2"), { name: "round_2x2_brick", scaleMm: true }));
writeFileSync("out/arch_4w_2d.obj", meshToOBJ(generatePrefab("arch_4x2"), { name: "arch_4w_2d", scaleMm: true }));
writeFileSync("out/hinge_plate_2x4.obj", meshToOBJ(generatePrefab("hinge_2x4"), { name: "hinge_plate_2x4", scaleMm: true }));
writeFileSync("out/technic_axle_8L.obj", meshToOBJ(generatePrefab("axle_8L"), { name: "technic_axle_8L", scaleMm: true }));

const axleHiFi = technicAxleMeshHiFi({
  nL: 8,
  endStop: true,
  grooveCount: 3,
  grooveWidth: 2.2,
  grooveDepth: 0.9,
});
writeFileSync("out/technic_axle_8L_hifi.obj", meshToOBJ(axleHiFi, { name: "technic_axle_8L_hifi", scaleMm: true }));

const pinFriction = technicPinMesh({
  lengthLdu: 3 * LDU.STUD_PITCH,
  grooveCount: 2,
  frictionRibs: 3,
  ribWidth: 1.2,
  ribHeight: 0.7,
});
writeFileSync("out/technic_pin_friction.obj", meshToOBJ(pinFriction, { name: "technic_pin_friction", scaleMm: true }));

const beamHiFi = technicBeamHiFi({
  holes: 7,
  thickness: 12,
  height: LDU.BRICK_H,
  holeVariant: "axle_semi_reduced",
});
writeFileSync("out/technic_beam_7_semireduced.obj", meshToOBJ(beamHiFi, { name: "technic_beam_7_semireduced", scaleMm: true }));

const beamPrim = technicBeamPrims({
  holes: 7,
  thickness: 12,
  height: LDU.BRICK_H,
  primitiveId: AXLEHOLE_PRIMS.AXLE_SEMI_REDUCED,
  inset: 1.0,
  segments: 128,
});
writeFileSync("out/beam_7_axlehole_prim.obj", meshToOBJ(beamPrim, { name: "beam_prim", scaleMm: true }));

const gear16 = spurGearMesh({
  teeth: 16,
  moduleLdu: 4,
  pressureAngleDeg: 20,
  thicknessLdu: 8,
  backlashLdu: 0.25,
  involuteSteps: 20,
  arcSteps: 10,
});
writeFileSync("out/gear_16T_involute.obj", meshToOBJ(gear16, { name: "gear_16T", scaleMm: true }));

const bevel12 = bevelGearMesh({
  teeth: 12,
  moduleLdu: 4,
  faceWidthLdu: 10,
  coneAngleDeg: 45,
  pressureAngleDeg: 20,
  backlashLdu: 0.25,
  involuteSteps: 20,
  arcSteps: 10,
  withHub: true,
  axleHolePrimitiveId: AXLEHOLE_PRIMS.AXLE_SEMI_REDUCED,
  axleHoleInset: 1.0,
  axleHoleSegments: 160,
});
writeFileSync("out/bevel_12T.obj", meshToOBJ(bevel12, { name: "bevel_12T", scaleMm: true }));

const bevel20 = bevelGearMesh({
  teeth: 20,
  moduleLdu: 4,
  faceWidthLdu: 12,
  coneAngleDeg: 45,
  pressureAngleDeg: 20,
  backlashLdu: 0.25,
  involuteSteps: 22,
  arcSteps: 12,
  withHub: true,
  axleHolePrimitiveId: AXLEHOLE_PRIMS.AXLE_SEMI_REDUCED,
  axleHoleInset: 1.0,
  axleHoleSegments: 160,
});
writeFileSync("out/bevel_20T.obj", meshToOBJ(bevel20, { name: "bevel_20T", scaleMm: true }));

console.log("Gear center distance (16T + 24T, module 4 LDU):", (4 * 16) / 2 + (4 * 24) / 2, "LDU");

const plate1x2 = systemRect({ studsX: 1, studsY: 2, platesH: 1, withStuds: true, withTubes: false });
const hinged = transformMesh(plate1x2, hingeTransform({ pivot: v3(0, 0, 0), axis: "z", angleDeg: 30 }));
const snot = transformMesh(hinged, snotTransform({ rotateYDeg: 90, translateLdu: v3(LDU.HALF_STUD, 0, 0) }));
const scene = mergeMeshes(brick2x4, transformMesh(slope2x2, m4Translate(80, 0, 0)), transformMesh(snot, m4Translate(0, 60, 0)));
writeFileSync("out/scene.obj", meshToOBJ(scene, { name: "scene", scaleMm: true }));

console.log("Wrote OBJ files to ./out");
