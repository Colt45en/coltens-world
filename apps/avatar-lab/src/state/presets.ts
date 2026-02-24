import type { AvatarDNA } from "../avatar/dna";
import { AVATAR_DNA_NAMED_PRESETS } from "../../../../packages/avatar-compiler/src/presets.js";

export type Preset = {
  id: string;
  name: string;
  dna: AvatarDNA;
  createdAt: number;
  updatedAt: number;
};

export type BuiltinPreset = {
  id: string;
  name: string;
  dna: AvatarDNA;
};

const PRESETS_KEY = "we.avatar.presets.v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadPresets(): Preset[] {
  const data = safeParse<Preset[]>(localStorage.getItem(PRESETS_KEY));
  if (!data || !Array.isArray(data)) return [];

  return data
    .filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && !!item.dna)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function savePresets(presets: Preset[]): void {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function newId(): string {
  return `p_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export const BUILTIN_PRESETS: BuiltinPreset[] = AVATAR_DNA_NAMED_PRESETS.map((preset) => ({
  id: preset.id,
  name: preset.name,
  dna: JSON.parse(JSON.stringify(preset.dna)) as AvatarDNA,
}));
