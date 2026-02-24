import { generatePrefab, meshToOBJ, type PrefabKind } from "@world-engine/lego-prefab";

export type NucleusPrefabPayload = {
  kind: PrefabKind;
  obj: string;
  triCount: number;
  createdAt: string;
};

export function buildPrefabPayload(kind: PrefabKind): NucleusPrefabPayload {
  const generated = generatePrefab(kind);
  return {
    kind,
    obj: meshToOBJ(generated, { name: `nucleus_${kind}`, scaleMm: true }),
    triCount: generated.tris.length,
    createdAt: new Date().toISOString(),
  };
}
