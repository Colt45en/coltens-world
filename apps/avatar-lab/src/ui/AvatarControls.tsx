import { useMemo, useState } from "react";
import { folder, Leva, useControls } from "leva";
import type { AvatarDNA } from "../avatar/dna";
import { useAvatarStore } from "../state/useAvatarStore";
import "./AvatarControls.css";

type Props = {
  onExport: () => void;
  exportStatus?: string;
};

export default function AvatarControls({ onExport, exportStatus }: Props) {
  const morphNames = useAvatarStore((state) => state.morphNames);
  const morphDebugMeshes = useAvatarStore((state) => state.morphDebugMeshes);
  const preview = useAvatarStore((state) => state.previewMorphs);
  const setPreviewMorph = useAvatarStore((state) => state.setPreviewMorph);
  const resetPreview = useAvatarStore((state) => state.resetPreviewMorphs);
  const undo = useAvatarStore((state) => state.undo);
  const redo = useAvatarStore((state) => state.redo);

  const dna = useAvatarStore((state) => state.history.present);
  const setDNA = useAvatarStore((state) => state.setDNA);

  const presets = useAvatarStore((state) => state.presets);
  const builtinPresets = useAvatarStore((state) => state.builtinPresets);
  const selectedPresetId = useAvatarStore((state) => state.presetSelectedId);
  const loadBuiltinPreset = useAvatarStore((state) => state.loadBuiltinPreset);
  const saveCurrentAsPreset = useAvatarStore((state) => state.saveCurrentAsPreset);
  const loadPreset = useAvatarStore((state) => state.loadPreset);
  const renamePreset = useAvatarStore((state) => state.renamePreset);
  const deletePreset = useAvatarStore((state) => state.deletePreset);

  const seed = useAvatarStore((state) => state.seed);
  const setSeed = useAvatarStore((state) => state.setSeed);
  const seedRandomize = useAvatarStore((state) => state.seedRandomize);

  const [presetName, setPresetName] = useState("");
  const [rename, setRename] = useState("");
  const [selectedBuiltinPresetId, setSelectedBuiltinPresetId] = useState("");

  const morphFolderSchema = useMemo(() => {
    const schema: Record<string, any> = {};
    for (const name of morphNames) {
        schema[name] = {
          value: preview[name] ?? 0,
          min: -1,
          max: 1,
          step: 0.01,
        onChange: (value: number) => setPreviewMorph(name, value),
      };
    }
    return schema;
  }, [morphNames, preview, setPreviewMorph]);

  const renderSchema = useMemo(() => {
    return {
      postfx: folder({
        bloom: {
          value: dna.postfx.bloom,
          min: 0,
          max: 2,
          step: 0.01,
          onChange: (value: number) => setDNA({ postfx: { ...dna.postfx, bloom: value } }),
        },
        ao: {
          value: dna.postfx.ao,
          min: 0,
          max: 2,
          step: 0.01,
          onChange: (value: number) => setDNA({ postfx: { ...dna.postfx, ao: value } }),
        },
        smaa: {
          value: dna.postfx.smaa,
          onChange: (value: boolean) => setDNA({ postfx: { ...dna.postfx, smaa: value } }),
        },
      }),
      materials: folder({
        skinColor: {
          value: dna.materials.skinColor,
          onChange: (value: string) => setDNA({ materials: { ...dna.materials, skinColor: value } as AvatarDNA["materials"] }),
        },
        hairColor: {
          value: dna.materials.hairColor,
          onChange: (value: string) => setDNA({ materials: { ...dna.materials, hairColor: value } as AvatarDNA["materials"] }),
        },
        roughness: {
          value: dna.materials.roughness,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (value: number) =>
            setDNA({ materials: { ...dna.materials, roughness: value } as AvatarDNA["materials"] }),
        },
        metalness: {
          value: dna.materials.metalness,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (value: number) =>
            setDNA({ materials: { ...dna.materials, metalness: value } as AvatarDNA["materials"] }),
        },
      }),
      textures: folder({
        skinMap: {
          value: dna.textures?.skinMap ?? "/skin.jpg",
          onChange: (value: string) => setDNA({ textures: { ...dna.textures, skinMap: value } }),
        },
        clothingMap: {
          value: dna.textures?.clothingMap ?? "/clothing.jpg",
          onChange: (value: string) => setDNA({ textures: { ...dna.textures, clothingMap: value } }),
        },
        maskMap: {
          value: dna.textures?.maskMap ?? "/mask.png",
          onChange: (value: string) => setDNA({ textures: { ...dna.textures, maskMap: value } }),
        },
      }),
    };
  }, [dna, setDNA]);

  useControls(
    () => ({
      "Avatar Morphs": folder(morphFolderSchema),
      Render: folder(renderSchema),
    }),
    [morphFolderSchema, renderSchema]
  );

  return (
    <>
      <Leva collapsed={false} />

      <div className="presets-panel">
        <div className="presets-row">
          <span className="preset-label">Defaults</span>
          <select
            aria-label="Load default preset"
            value={selectedBuiltinPresetId}
            onChange={(event) => {
              const id = event.target.value;
              setSelectedBuiltinPresetId(id);
              if (id) loadBuiltinPreset(id);
            }}
            className="preset-select"
          >
            <option value="">(select default)</option>
            {builtinPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        <div className="presets-row">
          <span className="preset-label">Presets</span>
          <select
            aria-label="Load preset"
            value={selectedPresetId ?? ""}
            onChange={(event) => {
              if (event.target.value) loadPreset(event.target.value);
            }}
            className="preset-select"
          >
            <option value="">(select)</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        <div className="input-row">
          <input
            aria-label="Preset name"
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder="Preset name"
            className="preset-input"
          />
          <button onClick={() => saveCurrentAsPreset(presetName)} className="btn-small">
            Save
          </button>
        </div>

        <div className="input-row">
          <input
            aria-label="Rename preset"
            value={rename}
            onChange={(event) => setRename(event.target.value)}
            placeholder="Rename selected"
            className="preset-input-wide"
          />
          <button onClick={() => selectedPresetId && renamePreset(selectedPresetId, rename)} className="btn-small">
            Rename
          </button>
          <button onClick={() => selectedPresetId && deletePreset(selectedPresetId)} className="btn-small btn-danger">
            Delete
          </button>
        </div>

        <div className="divider" />

        <div className="seed-row">
          <span className="preset-label">Seed</span>
          <input
            aria-label="Seed value for randomization"
            type="number"
            value={seed}
            onChange={(event) => setSeed(parseInt(event.target.value || "0", 10))}
            className="seed-input"
            title="Numeric seed for avatar randomization"
          />
          <button onClick={seedRandomize} className="btn-small">
            Seed Randomize
          </button>
        </div>

        <div className="divider" />

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="preset-label">Morph Debug</span>
            <span style={{ fontSize: 12, opacity: 0.8 }}>
              {morphDebugMeshes.length} mesh{morphDebugMeshes.length === 1 ? "" : "es"}
            </span>
          </div>

          {morphDebugMeshes.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>No morph target meshes detected yet.</div>
          ) : (
            <div
              style={{
                maxHeight: 220,
                overflow: "auto",
                display: "grid",
                gap: 8,
                paddingRight: 2,
              }}
            >
              {morphDebugMeshes.map((mesh) => (
                <details
                  key={mesh.meshPath}
                  style={{
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    padding: "6px 8px",
                  }}
                >
                  <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    {mesh.meshName} <span style={{ opacity: 0.7 }}>({mesh.morphNames.length})</span>
                  </summary>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, wordBreak: "break-word" }}>
                    {mesh.meshPath}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 6,
                    }}
                  >
                    {mesh.morphNames.map((name) => (
                      <code
                        key={`${mesh.meshPath}:${name}`}
                        style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {name}
                      </code>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="controls-bottom">
        <button onClick={onExport} className="btn">
          Export GLB
        </button>
        <button onClick={resetPreview} className="btn btn-soft">
          Reset Morphs
        </button>
        <button onClick={undo} className="btn btn-soft">
          Undo
        </button>
        <button onClick={redo} className="btn btn-soft">
          Redo
        </button>
        {exportStatus ? <div className="export-status">{exportStatus}</div> : null}
      </div>
    </>
  );
}
