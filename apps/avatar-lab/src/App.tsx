import { useCallback, useRef, useState } from "react";
import * as THREE from "three";
import AvatarScene from "./avatar/AvatarScene";
import AvatarControls from "./ui/AvatarControls";
import { useAvatarStore } from "./state/useAvatarStore";
import { exportAvatarGLB } from "./avatar/export/exportGLB";

export default function App() {
  const avatarGroupRef = useRef<THREE.Group>(null);

  const dna = useAvatarStore((state) => state.history.present);
  const previewMorphs = useAvatarStore((state) => state.previewMorphs);
  const setMorphNames = useAvatarStore((state) => state.setMorphNames);
  const setMorphDebugMeshes = useAvatarStore((state) => state.setMorphDebugMeshes);

  const [exportStatus, setExportStatus] = useState("");

  const onExport = useCallback(async () => {
    const group = avatarGroupRef.current;
    if (!group) return;

    setExportStatus("Exporting...");

    try {
      const { ms, bytes } = await exportAvatarGLB(group, dna, {
        filename: "avatar_v13.glb",
        clone: true,
        bakeMorphs: true,
        bakeNormals: true,
        applyPartMaterials: true,
        atlas: { enabled: true, size: 2048 },
        mergeByPart: true,
        lod: { enabled: true, distances: [0, 3, 7, 14], ratios: [1, 0.6, 0.35, 0.2] },
      });
      setExportStatus(`Exported in ${ms.toFixed(0)}ms • ${(bytes / 1024 / 1024).toFixed(2)} MB`);
      window.setTimeout(() => setExportStatus(""), 2400);
    } catch (error) {
      console.error(error);
      setExportStatus("Export failed (see console)");
      window.setTimeout(() => setExportStatus(""), 3200);
    }
  }, [dna]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <AvatarControls onExport={onExport} exportStatus={exportStatus} />
      <div style={{ position: "absolute", inset: 0 }}>
        <AvatarScene
          dna={dna}
          previewMorphs={previewMorphs}
          onMorphNames={setMorphNames}
          onMorphDebugMeshes={setMorphDebugMeshes}
          avatarGroupRef={avatarGroupRef}
        />
      </div>
    </div>
  );
}
