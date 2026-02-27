import { AlertCircle, Download, RotateCw, Upload } from "lucide-react";
import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";

interface CompileJob {
  id: string;
  status: "pending" | "running" | "success" | "error";
  avatarCount: number;
  output?: {
    registryUrl: string;
    avatarCount: number;
    totalBytes: number;
  };
  error?: string;
}

export function LabAvatarCompilerPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<CompileJob[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atlasSize, setAtlasSize] = useState(512);
  const [lodLevels, setLodLevels] = useState(3);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (!file.name.endsWith(".json")) {
          setError("Please select a JSON file");
          return;
        }
        setUploadFile(file);
        setError(null);
      }
    },
    []
  );

  const handleCompile = useCallback(async () => {
    if (!uploadFile) {
      setError("Please select a JSON file first");
      return;
    }

    setCompiling(true);
    setError(null);

    const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newJob: CompileJob = {
      id: fileId,
      status: "pending",
      avatarCount: 0,
    };

    setJobs((prev) => [newJob, ...prev]);

    try {
      // Read file and parse JSON
      const content = await uploadFile.text();
      const avatars = JSON.parse(content);

      if (!Array.isArray(avatars)) {
        throw new Error("JSON must be an array of avatar DNA objects");
      }

      // Call Nucleus compile API
      const response = await fetch(
        `http://localhost:3000/api/avatars/compile?atlasSize=${atlasSize}&lodLevels=${lodLevels}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            avatars,
            jobId: fileId,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`API error: ${err}`);
      }

      const result = await response.json();

      setJobs((prev) =>
        prev.map((j) =>
          j.id === fileId
            ? {
                ...j,
                status: "success",
                avatarCount: avatars.length,
                output: result,
              }
            : j
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === fileId ? { ...j, status: "error", error: message } : j
        )
      );
    } finally {
      setCompiling(false);
      setUploadFile(null);
    }
  }, [uploadFile, atlasSize, lodLevels]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassPanel className="rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <NeonTitle as="h2" className="text-2xl">
              Avatar Compiler (V2)
            </NeonTitle>
            <p className="text-white/60 mt-2">
              Deterministic avatar compilation with content addressing. Upload a JSON array of
              avatar DNA objects to compile in batch.
            </p>
          </div>
          <NeonButton variant="ghost" onClick={() => navigate("/")} className="ml-4">
            Back
          </NeonButton>
        </div>
      </GlassPanel>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-red-300 font-semibold">Error</h3>
            <p className="text-red-200/80 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Input Controls */}
      <GlassPanel className="rounded-2xl p-6 space-y-4">
        <h3 className="text-white/90 font-semibold">Compilation Settings</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="atlas-size" className="block text-sm text-white/60 mb-2">
              Atlas Size
            </label>
            <select
              id="atlas-size"
              value={atlasSize}
              onChange={(e) => setAtlasSize(Number(e.target.value))}
              disabled={compiling}
              className="w-full px-3 py-2 bg-slate-800/50 border border-cyan-500/30 rounded text-white text-sm"
            >
              <option value={256}>256px</option>
              <option value={512} selected>
                512px
              </option>
              <option value={1024}>1024px</option>
              <option value={2048}>2048px</option>
            </select>
          </div>

          <div>
            <label htmlFor="lod-levels" className="block text-sm text-white/60 mb-2">
              LOD Levels
            </label>
            <select
              id="lod-levels"
              value={lodLevels}
              onChange={(e) => setLodLevels(Number(e.target.value))}
              disabled={compiling}
              className="w-full px-3 py-2 bg-slate-800/50 border border-cyan-500/30 rounded text-white text-sm"
            >
              <option value={1}>1 (Full detail)</option>
              <option value={2}>2</option>
              <option value={3} selected>
                3 (Default)
              </option>
              <option value={4}>4 (Max detail reduction)</option>
            </select>
          </div>
        </div>

        <div className="border-t border-slate-700/50 pt-4">
          <div className="flex items-center gap-3 mb-3">
            <Upload className="w-4 h-4 text-cyan-400" />
            <label className="block text-sm font-semibold text-white">Upload Avatars (JSON)</label>
          </div>

          <div className="flex gap-3">
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              disabled={compiling}
              title="Upload a JSON file containing avatar DNA objects"
              className="flex-1 px-3 py-2 bg-slate-800/50 border border-dashed border-cyan-500/30 rounded text-white text-sm"
            />

            <NeonButton
              onClick={handleCompile}
              disabled={!uploadFile || compiling}
              className="flex items-center gap-2"
            >
              {compiling ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Compiling...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Compile
                </>
              )}
            </NeonButton>
          </div>

          <p className="text-xs text-white/40 mt-2">
            Expected format: Array of avatar DNA objects with morphs, materials, postfx, quality
          </p>
        </div>
      </GlassPanel>

      {/* Jobs History */}
      {jobs.length > 0 && (
        <GlassPanel className="rounded-2xl p-6">
          <h3 className="text-white/90 font-semibold mb-4">Compilation History</h3>

          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="border border-slate-700/50 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        job.status === "success"
                          ? "bg-green-400"
                          : job.status === "error"
                            ? "bg-red-400"
                            : job.status === "running"
                              ? "bg-yellow-400 animate-pulse"
                              : "bg-slate-400"
                      }`}
                    />
                    <span className="text-sm font-mono text-white/70">{job.id}</span>
                  </div>

                  {job.output && (
                    <div className="mt-2 text-xs text-white/60 space-y-1">
                      <div>✓ {job.output.avatarCount} avatars compiled</div>
                      <div>✓ {(job.output.totalBytes / 1024 / 1024).toFixed(2)} MB total</div>
                      <div>✓ Registry: {job.output.registryUrl}</div>
                    </div>
                  )}

                  {job.error && <div className="mt-2 text-xs text-red-400">{job.error}</div>}
                </div>

                <div className="text-xs font-semibold text-white/50 uppercase">{job.status}</div>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Format Example */}
      <GlassPanel className="rounded-2xl p-6 bg-slate-900/40">
        <h3 className="text-white/90 font-semibold mb-3">Example JSON Format</h3>
        <pre className="text-xs text-white/60 overflow-auto bg-black/30 p-3 rounded border border-slate-700/50">
          {`[
  {
    "avatar_id": "user_001",
    "morphs": { "smile": 0.5, "brow_raise": 0.2 },
    "materials": {
      "skinColor": "#d8b59a",
      "hairColor": "#8b4513",
      "roughness": 0.85,
      "metalness": 0.1
    },
    "postfx": { "bloom": 0.25, "ao": 0.45, "smaa": true },
    "quality": { "shadows": true, "shadowMapSize": 1024 }
  }
]`}
        </pre>
      </GlassPanel>
    </div>
  );
}
