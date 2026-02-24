#!/usr/bin/env node
/**
 * LEGO-LDU Room Prefab Generator (OBJ + JSON)
 * - Deterministic integer math in LDU
 * - Deterministic opening segmentation (no CSG)
 * - LDU-snapped Technic mount points around opening borders
 *
 * Usage:
 *   node tools/gen-room-prefab.mjs Room_16x16x10 16 16 10 1
 *
 * Args:
 *   name studsX studsZ bricksH wallThicknessStuds
 */

import fs from "node:fs";
import path from "node:path";

const [name, studsX_s, studsZ_s, bricksH_s, wallTStuds_s] = process.argv.slice(2);

if (!name || !studsX_s || !studsZ_s || !bricksH_s || !wallTStuds_s) {
  console.error("Usage: node tools/gen-room-prefab.mjs <name> <studsX> <studsZ> <bricksH> <wallThicknessStuds>");
  process.exit(1);
}

const studsX = Number.parseInt(studsX_s, 10);
const studsZ = Number.parseInt(studsZ_s, 10);
const bricksH = Number.parseInt(bricksH_s, 10);
const wallTStuds = Number.parseInt(wallTStuds_s, 10);

if (![studsX, studsZ, bricksH, wallTStuds].every(Number.isFinite) || studsX <= 0 || studsZ <= 0 || bricksH <= 0 || wallTStuds <= 0) {
  console.error("All numeric args must be positive integers.");
  process.exit(1);
}

const LDU_PER_STUD = 20;
const LDU_PER_PLATE = 8;
const LDU_PER_BRICK = 24;
const METERS_PER_LDU = 0.0004;

const floorX_LDU = studsX * LDU_PER_STUD;
const floorZ_LDU = studsZ * LDU_PER_STUD;
const wallH_LDU = bricksH * LDU_PER_BRICK;
const wallT_LDU = wallTStuds * LDU_PER_STUD;
const floorThick_LDU = LDU_PER_PLATE;

const floorX_M = floorX_LDU * METERS_PER_LDU;
const floorZ_M = floorZ_LDU * METERS_PER_LDU;
const wallH_M = wallH_LDU * METERS_PER_LDU;
const wallT_M = wallT_LDU * METERS_PER_LDU;
const floorT_M = floorThick_LDU * METERS_PER_LDU;

const mountPitchLdu = LDU_PER_STUD;
const mountInsetStuds = 0.5;

const openings = [
  { id: "door_north", wall: "north", xStud: 6, widthStud: 4, heightBrick: 6, sillBrick: 0 },
  { id: "window_east", wall: "east", xStud: 5, widthStud: 6, heightBrick: 3, sillBrick: 2 },
];

const vertices = [];
const faces = [];

function lduToMeters(ldu) {
  return ldu * METERS_PER_LDU;
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function snapToPitch(value, pitch) {
  return Math.round(value / pitch) * pitch;
}

function addBoxMeters(cx, cy, cz, sx, sy, sz) {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;

  const baseIndex = vertices.length + 1;
  vertices.push(
    [cx - hx, cy - hy, cz - hz],
    [cx + hx, cy - hy, cz - hz],
    [cx + hx, cy + hy, cz - hz],
    [cx - hx, cy + hy, cz - hz],
    [cx - hx, cy - hy, cz + hz],
    [cx + hx, cy - hy, cz + hz],
    [cx + hx, cy + hy, cz + hz],
    [cx - hx, cy + hy, cz + hz],
  );

  faces.push(
    [baseIndex + 0, baseIndex + 1, baseIndex + 2, baseIndex + 3],
    [baseIndex + 4, baseIndex + 5, baseIndex + 6, baseIndex + 7],
    [baseIndex + 0, baseIndex + 4, baseIndex + 7, baseIndex + 3],
    [baseIndex + 1, baseIndex + 5, baseIndex + 6, baseIndex + 2],
    [baseIndex + 3, baseIndex + 2, baseIndex + 6, baseIndex + 7],
    [baseIndex + 0, baseIndex + 1, baseIndex + 5, baseIndex + 4],
  );
}

function addBoxLdu(cxLdu, cyLdu, czLdu, sxLdu, syLdu, szLdu) {
  addBoxMeters(
    lduToMeters(cxLdu),
    lduToMeters(cyLdu),
    lduToMeters(czLdu),
    lduToMeters(sxLdu),
    lduToMeters(syLdu),
    lduToMeters(szLdu),
  );
}

function openingBoundsLdu(opening, wallLenLdu, wallHeightLdu) {
  const x0 = clampInt(opening.xStud * LDU_PER_STUD, 0, wallLenLdu);
  const w = clampInt(opening.widthStud * LDU_PER_STUD, 0, wallLenLdu);
  const x1 = clampInt(x0 + w, 0, wallLenLdu);

  const y0 = clampInt(opening.sillBrick * LDU_PER_BRICK, 0, wallHeightLdu);
  const h = clampInt(opening.heightBrick * LDU_PER_BRICK, 0, wallHeightLdu);
  const y1 = clampInt(y0 + h, 0, wallHeightLdu);

  return { x0, x1, y0, y1 };
}

function buildMountPointsForOpening(opening, wallKey, wallLengthLdu, wallHeightLdu) {
  const insetLdu = Math.round(mountInsetStuds * LDU_PER_STUD);
  const bounds = openingBoundsLdu(opening, wallLengthLdu, wallHeightLdu);
  const { x0, x1, y0, y1 } = bounds;

  const leftX = x0 + insetLdu;
  const rightX = x1 - insetLdu;
  const sillY = y0 + insetLdu;
  const headY = y1 - insetLdu;

  if (leftX > rightX || sillY > headY) return [];

  const framePoints = [];
  for (let y = snapToPitch(sillY, mountPitchLdu); y <= snapToPitch(headY, mountPitchLdu); y += mountPitchLdu) {
    framePoints.push(
      { edge: "jamb_left", xLdu: snapToPitch(leftX, mountPitchLdu), yLdu: y },
      { edge: "jamb_right", xLdu: snapToPitch(rightX, mountPitchLdu), yLdu: y },
    );
  }
  for (let x = snapToPitch(leftX, mountPitchLdu); x <= snapToPitch(rightX, mountPitchLdu); x += mountPitchLdu) {
    framePoints.push(
      { edge: "header", xLdu: x, yLdu: snapToPitch(headY, mountPitchLdu) },
      { edge: "sill", xLdu: x, yLdu: snapToPitch(sillY, mountPitchLdu) },
    );
  }

  const dedup = new Map();
  for (const p of framePoints) {
    const key = `${p.edge}:${p.xLdu}:${p.yLdu}`;
    if (!dedup.has(key)) dedup.set(key, p);
  }

  const world = [];
  const halfLenLdu = wallLengthLdu / 2;
  const faceOffsetLdu = Math.max(0, (wallT_LDU / 2) - insetLdu);

  for (const p of dedup.values()) {
    const localAxisLdu = p.xLdu - halfLenLdu;
    const yWorldLdu = floorThick_LDU + p.yLdu;

    let xWorldLdu = 0;
    let zWorldLdu = 0;
    let nx = 0;
    let nz = 0;

    if (wallKey === "north") {
      xWorldLdu = localAxisLdu;
      zWorldLdu = +(floorZ_LDU / 2) - (wallT_LDU / 2) - faceOffsetLdu;
      nz = -1;
    } else if (wallKey === "south") {
      xWorldLdu = localAxisLdu;
      zWorldLdu = -(floorZ_LDU / 2) + (wallT_LDU / 2) + faceOffsetLdu;
      nz = +1;
    } else if (wallKey === "east") {
      zWorldLdu = localAxisLdu;
      xWorldLdu = +(floorX_LDU / 2) - (wallT_LDU / 2) - faceOffsetLdu;
      nx = -1;
    } else {
      zWorldLdu = localAxisLdu;
      xWorldLdu = -(floorX_LDU / 2) + (wallT_LDU / 2) + faceOffsetLdu;
      nx = +1;
    }

    world.push({
      openingId: opening.id,
      wall: wallKey,
      edge: p.edge,
      position: {
        x: lduToMeters(xWorldLdu),
        y: lduToMeters(yWorldLdu),
        z: lduToMeters(zWorldLdu),
      },
      normal: { x: nx, y: 0, z: nz },
      ldu: { x: p.xLdu, y: p.yLdu, pitch: mountPitchLdu },
    });
  }

  world.sort((a, b) => {
    if (a.wall !== b.wall) return a.wall.localeCompare(b.wall);
    if (a.openingId !== b.openingId) return a.openingId.localeCompare(b.openingId);
    if (a.edge !== b.edge) return a.edge.localeCompare(b.edge);
    if (a.ldu.y !== b.ldu.y) return a.ldu.y - b.ldu.y;
    return a.ldu.x - b.ldu.x;
  });

  return world;
}

function buildWall(wallKey, wallLenLdu, centerXLdu, centerZLdu, runsAlong) {
  const wallOpenings = openings
    .filter((o) => o.wall === wallKey)
    .sort((a, b) => (a.xStud - b.xStud) || (a.widthStud - b.widthStud) || a.id.localeCompare(b.id));

  const mountPoints = [];

  const addSegment = (name, x0Ldu, x1Ldu, y0Ldu, y1Ldu) => {
    const widthLdu = x1Ldu - x0Ldu;
    const heightLdu = y1Ldu - y0Ldu;
    if (widthLdu <= 0 || heightLdu <= 0) return;

    const axisCenterLdu = ((x0Ldu + x1Ldu) / 2) - (wallLenLdu / 2);
    const yCenterLdu = floorThick_LDU + ((y0Ldu + y1Ldu) / 2);

    if (runsAlong === "x") {
      addBoxLdu(centerXLdu + axisCenterLdu, yCenterLdu, centerZLdu, widthLdu, heightLdu, wallT_LDU);
    } else {
      addBoxLdu(centerXLdu, yCenterLdu, centerZLdu + axisCenterLdu, wallT_LDU, heightLdu, widthLdu);
    }
  };

  if (wallOpenings.length === 0) {
    addSegment(`wall_${wallKey}`, 0, wallLenLdu, 0, wallH_LDU);
    return mountPoints;
  }

  let cursorLdu = 0;
  for (const opening of wallOpenings) {
    const bounds = openingBoundsLdu(opening, wallLenLdu, wallH_LDU);
    const { x0, x1, y0, y1 } = bounds;

    if (x0 > cursorLdu) {
      addSegment(`wall_${wallKey}_pre_${opening.id}`, cursorLdu, x0, 0, wallH_LDU);
    }

    if (y0 > 0 && x1 > x0) {
      addSegment(`wall_${wallKey}_below_${opening.id}`, x0, x1, 0, y0);
    }

    if (y1 < wallH_LDU && x1 > x0) {
      addSegment(`wall_${wallKey}_above_${opening.id}`, x0, x1, y1, wallH_LDU);
    }

    mountPoints.push(...buildMountPointsForOpening(opening, wallKey, wallLenLdu, wallH_LDU));
    cursorLdu = Math.max(cursorLdu, x1);
  }

  if (cursorLdu < wallLenLdu) {
    addSegment(`wall_${wallKey}_post`, cursorLdu, wallLenLdu, 0, wallH_LDU);
  }

  return mountPoints;
}

addBoxLdu(0, floorThick_LDU / 2, 0, floorX_LDU, floorThick_LDU, floorZ_LDU);

const mountPoints = [
  ...buildWall("north", floorX_LDU, 0, +(floorZ_LDU / 2) - (wallT_LDU / 2), "x"),
  ...buildWall("south", floorX_LDU, 0, -(floorZ_LDU / 2) + (wallT_LDU / 2), "x"),
  ...buildWall("east", floorZ_LDU, +(floorX_LDU / 2) - (wallT_LDU / 2), 0, "z"),
  ...buildWall("west", floorZ_LDU, -(floorX_LDU / 2) + (wallT_LDU / 2), 0, "z"),
];

const mountMarkerSizeLdu = 4;
for (const mp of mountPoints) {
  const xLdu = mp.position.x / METERS_PER_LDU;
  const yLdu = mp.position.y / METERS_PER_LDU;
  const zLdu = mp.position.z / METERS_PER_LDU;
  addBoxLdu(xLdu, yLdu, zLdu, mountMarkerSizeLdu, mountMarkerSizeLdu, mountMarkerSizeLdu);
}

const spec = {
  name,
  units: { ldu: "integer", meters_per_ldu: METERS_PER_LDU },
  constants: {
    ldu_per_stud: LDU_PER_STUD,
    ldu_per_plate: LDU_PER_PLATE,
    ldu_per_brick: LDU_PER_BRICK,
  },
  room: {
    studsX,
    studsZ,
    bricksH,
    wallThicknessStuds: wallTStuds,
    floor: {
      sizeLDU: { x: floorX_LDU, z: floorZ_LDU, thickness: floorThick_LDU },
      sizeM: { x: floorX_M, z: floorZ_M, thickness: floorT_M },
    },
    walls: {
      heightLDU: wallH_LDU,
      heightM: wallH_M,
      thicknessLDU: wallT_LDU,
      thicknessM: wallT_M,
    },
    origin: { note: "Centered on XZ; floor at Y=0" },
  },
  openings,
  mounts: {
    pitchLDU: mountPitchLdu,
    insetStuds: mountInsetStuds,
    count: mountPoints.length,
  },
  mountPoints,
  snap: {
    studPitchLDU: LDU_PER_STUD,
    studPitchM: lduToMeters(LDU_PER_STUD),
    halfStudLDU: 10,
    halfPlateLDU: 4,
  },
};

const outDir = path.join(process.cwd(), "prefabs", "rooms", name);
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, "room.spec.json"), JSON.stringify(spec, null, 2), "utf8");

const mtl = `newmtl roommat\nKd 0.8 0.8 0.8\nKs 0.0 0.0 0.0\nd 1.0\n`;
fs.writeFileSync(path.join(outDir, "room.mtl"), mtl, "utf8");

let obj = "";
obj += "mtllib room.mtl\n";
obj += `o ${name}\n`;
obj += "usemtl roommat\n";

for (const [x, y, z] of vertices) obj += `v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
for (const quad of faces) obj += `f ${quad[0]} ${quad[1]} ${quad[2]} ${quad[3]}\n`;

fs.writeFileSync(path.join(outDir, "room.obj"), obj, "utf8");

console.log(`✅ Wrote prefab room to: ${outDir}`);
console.log(`- room.spec.json (openings: ${openings.length}, mounts: ${mountPoints.length})`);
console.log("- room.obj");
console.log("- room.mtl");
