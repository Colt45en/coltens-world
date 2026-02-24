/**
 * Example: Complete Settings Panel using IDE Storage
 * Shows all the hooks and patterns in one component
 */

import React, { useState } from "react";
import {
  useStorageState,
  useStorageSection,
  useStorageForm,
  storage,
} from "@/utils/storage";

export function IDESettingsPanel() {
  const [activeTab, setActiveTab] = useState<"appearance" | "editor" | "performance">(
    "appearance"
  );

  return (
    <div style={{ padding: "20px", maxWidth: "600px" }}>
      <h2>IDE Settings</h2>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "1px solid #ccc" }}>
        {(["appearance", "editor", "performance"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 16px",
              borderBottom: activeTab === tab ? "2px solid blue" : "none",
              background: "none",
              cursor: "pointer",
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === "appearance" && <AppearanceSettings />}
      {activeTab === "editor" && <EditorSettings />}
      {activeTab === "performance" && <PerformanceSettings />}

      {/* Debug Section */}
      <DebugSection />
    </div>
  );
}

// ============================================================================
// APPEARANCE TAB
// ============================================================================

function AppearanceSettings() {
  const [appearance, updateAppearance] = useStorageSection("appearance");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Theme Selector */}
      <div>
        <label>Theme:</label>
        <select
          value={appearance.theme}
          onChange={(e) => updateAppearance({ theme: e.target.value as any })}
          style={{ marginLeft: "8px", padding: "4px" }}
        >
          <option value="dark">🌙 Dark</option>
          <option value="light">☀️ Light</option>
          <option value="auto">🔄 Auto</option>
        </select>
      </div>

      {/* Font Size Slider */}
      <div>
        <label>Font Size: {appearance.fontSize}px</label>
        <input
          type="range"
          min={12}
          max={18}
          value={appearance.fontSize}
          onChange={(e) => updateAppearance({ fontSize: Number(e.target.value) })}
          style={{ marginLeft: "8px", width: "200px" }}
        />
      </div>

      {/* Font Family */}
      <div>
        <label>Font Family:</label>
        <select
          value={appearance.fontFamily}
          onChange={(e) => updateAppearance({ fontFamily: e.target.value as any })}
          style={{ marginLeft: "8px", padding: "4px" }}
        >
          <option value="system">System</option>
          <option value="mono">Monospace</option>
          <option value="sans">Sans Serif</option>
        </select>
      </div>

      {/* Compact Mode Toggle */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={appearance.compactMode}
            onChange={(e) => updateAppearance({ compactMode: e.target.checked })}
          />
          Compact Mode
        </label>
      </div>

      {/* Sidebar Width */}
      <div>
        <label>Sidebar Width: {appearance.sidebarWidth}px</label>
        <input
          type="range"
          min={200}
          max={500}
          step={20}
          value={appearance.sidebarWidth}
          onChange={(e) => updateAppearance({ sidebarWidth: Number(e.target.value) })}
          style={{ marginLeft: "8px", width: "200px" }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// EDITOR TAB
// ============================================================================

function EditorSettings() {
  const [editor, updateEditor] = useStorageSection("editor");
  const [tabSize, setTabSize, saveTabSize] = useStorageForm("editor.tabSize");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Tab Size (with manual save) */}
      <div>
        <label>Tab Size (uncommitted):</label>
        <select
          value={tabSize}
          onChange={(e) => setTabSize(Number(e.target.value))}
          style={{ marginLeft: "8px", padding: "4px" }}
        >
          <option value={2}>2 spaces</option>
          <option value={4}>4 spaces</option>
          <option value={8}>8 spaces</option>
        </select>
        <button onClick={saveTabSize} style={{ marginLeft: "8px" }}>
          Save
        </button>
      </div>

      {/* Auto Save */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={editor.autoSave}
            onChange={(e) => updateEditor({ autoSave: e.target.checked })}
          />
          Auto Save
        </label>
        {editor.autoSave && (
          <div style={{ marginLeft: "20px", marginTop: "8px" }}>
            <label>Interval (ms):</label>
            <input
              type="number"
              min={1000}
              max={60000}
              step={1000}
              value={editor.autoSaveInterval}
              onChange={(e) => updateEditor({ autoSaveInterval: Number(e.target.value) })}
              style={{ marginLeft: "8px", width: "80px" }}
            />
          </div>
        )}
      </div>

      {/* Line Numbers */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={editor.showLineNumbers}
            onChange={(e) => updateEditor({ showLineNumbers: e.target.checked })}
          />
          Show Line Numbers
        </label>
      </div>

      {/* Word Wrap */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={editor.wordWrap}
            onChange={(e) => updateEditor({ wordWrap: e.target.checked })}
          />
          Word Wrap
        </label>
      </div>

      {/* Default Language */}
      <div>
        <label>Default Language:</label>
        <select
          value={editor.defaultLanguage}
          onChange={(e) => updateEditor({ defaultLanguage: e.target.value as any })}
          style={{ marginLeft: "8px", padding: "4px" }}
        >
          <option value="typescript">TypeScript</option>
          <option value="python">Python</option>
          <option value="glsl">GLSL</option>
        </select>
      </div>
    </div>
  );
}

// ============================================================================
// PERFORMANCE TAB
// ============================================================================

function PerformanceSettings() {
  const [performance, updatePerformance] = useStorageSection("performance");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* WebGL */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={performance.enableWebGL}
            onChange={(e) => updatePerformance({ enableWebGL: e.target.checked })}
          />
          Enable WebGL
        </label>
      </div>

      {/* Target FPS */}
      <div>
        <label>Target FPS:</label>
        <select
          value={performance.targetFPS}
          onChange={(e) => updatePerformance({ targetFPS: Number(e.target.value) as any })}
          style={{ marginLeft: "8px", padding: "4px" }}
        >
          <option value={30}>30 FPS</option>
          <option value={60}>60 FPS</option>
          <option value={120}>120 FPS</option>
        </select>
      </div>

      {/* Shadows */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={performance.enableShadows}
            onChange={(e) => updatePerformance({ enableShadows: e.target.checked })}
          />
          Enable Shadows
        </label>
      </div>

      {/* Post FX */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={performance.enablePostFX}
            onChange={(e) => updatePerformance({ enablePostFX: e.target.checked })}
          />
          Enable Post-Processing
        </label>
      </div>

      {/* Mesh Detail */}
      <div>
        <label>Mesh Detail Level:</label>
        <select
          value={performance.meshDetailLevel}
          onChange={(e) => updatePerformance({ meshDetailLevel: e.target.value as any })}
          style={{ marginLeft: "8px", padding: "4px" }}
        >
          <option value="low">Low (Fast)</option>
          <option value="medium">Medium</option>
          <option value="high">High (Quality)</option>
        </select>
      </div>

      {/* Caching */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={performance.enableCaching}
            onChange={(e) => updatePerformance({ enableCaching: e.target.checked })}
          />
          Enable Caching
        </label>
      </div>
    </div>
  );
}

// ============================================================================
// DEBUG SECTION
// ============================================================================

function DebugSection() {
  const [showDebug, setShowDebug] = useState(false);

  if (!showDebug) {
    return (
      <button
        onClick={() => setShowDebug(true)}
        style={{
          marginTop: "20px",
          padding: "8px 16px",
          background: "#f0f0f0",
          border: "1px solid #ccc",
          cursor: "pointer",
        }}
      >
        🐛 Debug
      </button>
    );
  }

  const sizeKb = (storage.getSize() / 1024).toFixed(1);

  return (
    <div
      style={{
        marginTop: "20px",
        padding: "16px",
        background: "#f5f5f5",
        border: "1px solid #ddd",
        borderRadius: "4px",
      }}
    >
      <h4 style={{ marginTop: 0 }}>Debug Info</h4>

      <div style={{ fontSize: "12px", fontFamily: "monospace", marginBottom: "12px" }}>
        <div>Storage size: {sizeKb} KB</div>
        <div>Last updated: {new Date(storage.get("lastUpdated")).toLocaleString()}</div>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => {
            const json = storage.export();
            navigator.clipboard.writeText(json);
            alert("Storage exported to clipboard");
          }}
        >
          📋 Export
        </button>

        <button
          onClick={() => {
            if (confirm("Reset all settings to defaults?")) {
              storage.reset();
              window.location.reload();
            }
          }}
        >
          🔄 Reset
        </button>

        <button onClick={() => setShowDebug(false)}>Close</button>
      </div>
    </div>
  );
}

export default IDESettingsPanel;
