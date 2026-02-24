// World Space: Origin Rebasing to kill FP jitter
export interface RebaseState {
  origin: [number, number, number];
  threshold: number;
}

export function shouldRebase(
  cameraPos: [number, number, number],
  s: RebaseState
): boolean {
  const dx = cameraPos[0] - s.origin[0];
  const dy = cameraPos[1] - s.origin[1];
  const dz = cameraPos[2] - s.origin[2];
  return Math.hypot(dx, dy, dz) > s.threshold;
}

export function applyRebase(
  objects: Array<{ position: [number, number, number] }>,
  s: RebaseState
) {
  for (const o of objects) {
    o.position[0] -= s.origin[0];
    o.position[1] -= s.origin[1];
    o.position[2] -= s.origin[2];
  }
  s.origin = [0, 0, 0];
}

export function distanceFromOrigin(
  pos: [number, number, number],
  s: RebaseState
): number {
  const dx = pos[0] - s.origin[0];
  const dy = pos[1] - s.origin[1];
  const dz = pos[2] - s.origin[2];
  return Math.hypot(dx, dy, dz);
}
