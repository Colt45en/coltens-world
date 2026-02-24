import { create } from "zustand";
import { clampMorph, DEFAULT_DNA, type AvatarDNA } from "../avatar/dna";
import { BUILTIN_PRESETS, loadPresets, newId, savePresets, type BuiltinPreset, type Preset } from "./presets";

type History = {
  past: AvatarDNA[];
  present: AvatarDNA;
  future: AvatarDNA[];
};

type RuntimeQuality = {
  aoEnabled?: boolean;
  smaaEnabled?: boolean;
  bloomScale?: number;
  shadowsEnabled?: boolean;
  shadowMapSize?: 1024 | 2048;
};

export type MorphDebugMeshInfo = {
  meshName: string;
  meshPath: string;
  morphNames: string[];
};

type AvatarState = {
  history: History;
  previewMorphs: Record<string, number>;
  morphNames: string[];
  morphDebugMeshes: MorphDebugMeshInfo[];

  setMorphNames: (names: string[]) => void;
  setMorphDebugMeshes: (meshes: MorphDebugMeshInfo[]) => void;
  setPreviewMorph: (name: string, value: number) => void;
  resetPreviewMorphs: () => void;
  commitPreviewToHistory: () => void;

  setDNA: (partial: Partial<AvatarDNA>) => void;
  undo: () => void;
  redo: () => void;

  presets: Preset[];
  builtinPresets: BuiltinPreset[];
  presetSelectedId: string | null;
  refreshPresets: () => void;
  applyDNA: (dna: AvatarDNA) => void;
  loadBuiltinPreset: (id: string) => void;
  saveCurrentAsPreset: (name: string) => void;
  loadPreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;
  deletePreset: (id: string) => void;

  seed: number;
  setSeed: (seed: number) => void;
  seedRandomize: () => void;

  runtimeQuality: RuntimeQuality;
  setRuntimeQuality: (q: RuntimeQuality) => void;
  clearRuntimeQuality: () => void;
};

function cloneDNA(dna: AvatarDNA): AvatarDNA {
  return JSON.parse(JSON.stringify(dna)) as AvatarDNA;
}

function pushHistory(history: History, next: AvatarDNA): History {
  return {
    past: [...history.past, history.present],
    present: next,
    future: [],
  };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let commitTimer: number | null = null;

export const useAvatarStore = create<AvatarState>((set, get) => ({
  history: { past: [], present: cloneDNA(DEFAULT_DNA), future: [] },
  previewMorphs: {},
  morphNames: [],
  morphDebugMeshes: [],

  presets: loadPresets(),
  builtinPresets: BUILTIN_PRESETS,
  presetSelectedId: null,

  seed: 1337,
  runtimeQuality: {},

  setMorphNames(names) {
    set({ morphNames: names });
    const nextPreview = { ...get().previewMorphs };
    for (const name of names) if (nextPreview[name] === undefined) nextPreview[name] = 0;
    set({ previewMorphs: nextPreview });
  },

  setMorphDebugMeshes(meshes) {
    set({ morphDebugMeshes: meshes });
  },

  setPreviewMorph(name, value) {
    const clamped = clampMorph(value);
    set((state) => ({ previewMorphs: { ...state.previewMorphs, [name]: clamped } }));

    if (commitTimer !== null) window.clearTimeout(commitTimer);
    commitTimer = window.setTimeout(() => {
      get().commitPreviewToHistory();
      commitTimer = null;
    }, 180);
  },

  resetPreviewMorphs() {
    const nextMorphs: Record<string, number> = {};
    for (const name of get().morphNames) nextMorphs[name] = 0;
    set({ previewMorphs: nextMorphs });
    get().commitPreviewToHistory();
  },

  commitPreviewToHistory() {
    const { history, previewMorphs } = get();
    const next = cloneDNA(history.present);
    next.morphs = { ...previewMorphs };
    set({ history: pushHistory(history, next) });
  },

  setDNA(partial) {
    const { history } = get();
    const next = cloneDNA(history.present);
    Object.assign(next, partial);
    set({ history: pushHistory(history, next) });
  },

  undo() {
    const { history } = get();
    if (history.past.length === 0) return;

    const past = history.past.slice();
    const previous = past.pop();
    if (!previous) return;

    const future = [history.present, ...history.future];
    set({ history: { past, present: previous, future }, previewMorphs: { ...previous.morphs } });
  },

  redo() {
    const { history } = get();
    if (history.future.length === 0) return;

    const [next, ...rest] = history.future;
    if (!next) return;

    const past = [...history.past, history.present];
    set({ history: { past, present: next, future: rest }, previewMorphs: { ...next.morphs } });
  },

  refreshPresets() {
    set({ presets: loadPresets() });
  },

  applyDNA(dna) {
    const { history } = get();
    const next = cloneDNA(dna);
    set({ history: pushHistory(history, next), previewMorphs: { ...next.morphs } });
  },

  loadBuiltinPreset(id) {
    const preset = get().builtinPresets.find((item) => item.id === id);
    if (!preset) return;
    get().applyDNA(preset.dna);
    set({ presetSelectedId: null });
  },

  saveCurrentAsPreset(name) {
    const { history, presets } = get();
    const now = Date.now();
    const preset: Preset = {
      id: newId(),
      name: name.trim() || "Untitled",
      dna: cloneDNA(history.present),
      createdAt: now,
      updatedAt: now,
    };
    const nextPresets = [preset, ...presets];
    savePresets(nextPresets);
    set({ presets: nextPresets, presetSelectedId: preset.id });
  },

  loadPreset(id) {
    const preset = get().presets.find((item) => item.id === id);
    if (!preset) return;
    get().applyDNA(preset.dna);
    set({ presetSelectedId: id });
  },

  renamePreset(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const now = Date.now();
    const nextPresets = get().presets.map((item) =>
      item.id === id ? { ...item, name: trimmed, updatedAt: now } : item
    );
    savePresets(nextPresets);
    set({ presets: nextPresets });
  },

  deletePreset(id) {
    const nextPresets = get().presets.filter((item) => item.id !== id);
    savePresets(nextPresets);
    set((state) => ({
      presets: nextPresets,
      presetSelectedId: state.presetSelectedId === id ? null : state.presetSelectedId,
    }));
  },

  setSeed(seed) {
    set({ seed: seed | 0 });
  },

  seedRandomize() {
    const { seed, morphNames } = get();
    const random = mulberry32(seed);

    const nextMorphs: Record<string, number> = {};
    for (const name of morphNames) {
      const value = random() * 2 - 1;
      nextMorphs[name] = clampMorph(value);
    }

    set({ previewMorphs: nextMorphs });
    get().commitPreviewToHistory();
  },

  setRuntimeQuality(q) {
    set((state) => ({ runtimeQuality: { ...state.runtimeQuality, ...q } }));
  },

  clearRuntimeQuality() {
    set({ runtimeQuality: {} });
  },
}));
