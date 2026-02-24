# IDE Storage System

Production-grade storage wrapper for **coltens world IDE** with schema versioning, migrations, React integration, and cross-tab sync.

## Quick Start

### 1. Initialize on App Startup

In your **main entry point** (`main.tsx`):

```tsx
import { storage } from "@/utils/storage";

async function initializeApp() {
  await storage.initialize();
  console.log("✅ Storage ready");
}

initializeApp().catch(console.error);
```

### 2. Use in React Components

```tsx
import { useStorageState, useStorageSection } from "@/utils/storage";

function SettingsPanel() {
  // Get/set a single value
  const [theme, setTheme] = useStorageState("appearance.theme");

  // Get/set an entire section
  const [appearance, updateAppearance] = useStorageSection("appearance");

  return (
    <div>
      <select value={theme} onChange={(e) => setTheme(e.target.value as any)}>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
        <option value="auto">Auto</option>
      </select>

      <input
        type="range"
        min={12}
        max={18}
        value={appearance.fontSize}
        onChange={(e) =>
          updateAppearance({ fontSize: Number(e.target.value) })
        }
      />
      <span>{appearance.fontSize}px</span>
    </div>
  );
}
```

---

## API Reference

### Direct Storage Access

```tsx
import { storage } from "@/utils/storage";

// Get a value (with default fallback)
const theme = storage.get("appearance.theme", "dark");

// Get entire section
const allAppearance = storage.get("appearance");

// Set a value (auto-debounced)
storage.set("appearance.fontSize", 16);

// Batch updates
storage.setMultiple({
  appearance: { theme: "light", fontSize: 16 },
  editor: { showLineNumbers: false },
});

// Remove a value
storage.remove("workspace.activeLabPage");

// Reset all to defaults
storage.reset();

// Subscribe to changes
const unsubscribe = storage.subscribe((data) => {
  console.log("Storage updated:", data);
});

// Get storage size in bytes
const sizeBytes = storage.getSize();

// Export/import
const json = storage.export();
storage.import(json);
```

### React Hooks

#### `useStorageValue(path, defaultValue?)`

**Get a single value, auto-updates**

```tsx
const fontSize = useStorageValue("appearance.fontSize", 14);
```

#### `useStorageState(path, defaultValue?)`

**Get and set a value**

```tsx
const [theme, setTheme] = useStorageState("appearance.theme", "dark");

// Later...
setTheme("light");
```

#### `useStorageSection(section)`

**Get/set an entire config section**

```tsx
const [editor, updateEditor] = useStorageSection("editor");

updateEditor({
  tabSize: 4,
  showLineNumbers: true,
});
```

#### `useStorage()`

**Get entire storage (use sparingly - causes full re-renders)**

```tsx
const allSettings = useStorage();
```

#### `useLab(labName, defaults?)`

**Persist lab-specific state**

```tsx
const [labState, updateLabState] = useLab("LabMatrixPlaygroundPage", {
  viewportZoom: 1,
  cameraPos: [0, 0, 5],
});

// Restore on re-mount
useEffect(() => {
  if (labState.cameraPos) {
    camera.position.set(...labState.cameraPos);
  }
}, [labState.cameraPos]);

// Save on change
const handleZoom = (zoom: number) => {
  updateLabState({ viewportZoom: zoom });
};
```

#### `useStorageForm(path, defaultValue?)`

**Two-way binding without auto-save - explicit save**

```tsx
const [fontSize, setFontSize, save] = useStorageForm("appearance.fontSize", 14);

return (
  <div>
    <input
      type="number"
      value={fontSize}
      onChange={(e) => setFontSize(Number(e.target.value))}
      onBlur={save}
    />
  </div>
);
```

#### `withStorage(Component, selector?)`

**HOC for class components**

```tsx
class SettingsPanel extends React.Component<{ storage: IDEStorageSchema }> {
  render() {
    return <div>Theme: {this.props.storage.appearance.theme}</div>;
  }
}

export default withStorage(SettingsPanel);
```

---

## Storage Schema

### Full Structure

```typescript
{
  version: 2,
  lastUpdated: 1708700000000,

  // Appearance & UI
  appearance: {
    theme: "dark" | "light" | "auto",
    fontSize: 12-18,
    fontFamily: "system" | "mono" | "sans",
    editorLineHeight: 1.2-2.0,
    compactMode: boolean,
    sidebarWidth: 200-500,
    panelOpacity: 0.8-1.0,
  },

  // Editor settings
  editor: {
    tabSize: 2 | 4 | 8,
    autoSave: boolean,
    autoSaveInterval: number,
    showLineNumbers: boolean,
    showMinimap: boolean,
    wordWrap: boolean,
    defaultLanguage: "typescript" | "python" | "glsl",
  },

  // Developer settings
  developer: {
    enableConsole: boolean,
    logLevel: "debug" | "info" | "warn" | "error",
    enableProfiling: boolean,
    enableNetworkTab: boolean,
    showHiddenFiles: boolean,
    exposeInternalAPIs: boolean,
  },

  // Performance settings
  performance: {
    enableWebGL: boolean,
    targetFPS: 30 | 60 | 120,
    enableShadows: boolean,
    enablePostFX: boolean,
    meshDetailLevel: "low" | "medium" | "high",
    enableCaching: boolean,
  },

  // Workspace state
  workspace: {
    activeLabPage?: string,
    labs: {
      [labName: string]: {
        lastActive: number,
        viewportZoom: number,
        cameraPos?: [x, y, z],
        cameraTarget?: [x, y, z],
        selectedTool?: string,
        panelLayout?: "horizontal" | "vertical" | "tabbed",
      },
    },
    recentFiles: string[],
    openPanels: string[],
    lastSaved: number,
  },

  // Sandbox/runtime
  sandbox: {
    pythonEnv?: string,
    nodeVersion?: string,
    runtimeDebug: boolean,
    lastRuntimeError?: string,
    lastRuntimeErrorTime?: number,
    systemMemoryEstimate?: number,
  },

  // User profile
  user: {
    userId?: string,
    username?: string,
    preferences: {
      skipTutorials: boolean,
      anonymousAnalytics: boolean,
      notifyUpdates: boolean,
    },
    stats: {
      totalLabsVisited: number,
      totalPlaygroundSessions: number,
      averageSessionDuration: number,
    },
  },

  migrations: {
    [version: number]: timestamp,
  },
}
```

---

## Advanced Patterns

### Theme Toggle Component

```tsx
import { useStorageState } from "@/utils/storage";

export function ThemeToggle() {
  const [theme, setTheme] = useStorageState("appearance.theme");

  const handleToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return <button onClick={handleToggle}>🌓 Switch Theme</button>;
}
```

### Persist Canvas State

```tsx
import { useLab } from "@/utils/storage";
import { useEffect, useRef } from "react";

export function GraphicsLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [labState, updateLabState] = useLab("LabGraphicsLabPage", {
    viewportZoom: 1,
    cameraPos: [0, 5, 10],
  });

  // Restore camera on mount
  useEffect(() => {
    if (canvasRef.current && labState.cameraPos) {
      const [x, y, z] = labState.cameraPos;
      console.log(`Restoring camera to (${x}, ${y}, ${z})`);
      // Your 3D camera setup...
    }
  }, [labState.cameraPos]);

  const handleCameraMove = (x: number, y: number, z: number) => {
    updateLabState({ cameraPos: [x, y, z] });
  };

  return <canvas ref={canvasRef} />;
}
```

### Form with Uncommitted Changes

```tsx
import { useStorageForm, useStorageValue } from "@/utils/storage";
import { useState } from "react";

export function EditorPrefsForm() {
  const [tabSize, setTabSize, saveTabSize] = useStorageForm("editor.tabSize", 2);
  const [isDirty, setIsDirty] = useState(false);

  const handleChange = (value: number) => {
    setTabSize(value);
    setIsDirty(true);
  };

  const handleSave = () => {
    saveTabSize();
    setIsDirty(false);
  };

  const handleCancel = () => {
    setTabSize(useStorageValue("editor.tabSize", 2));
    setIsDirty(false);
  };

  return (
    <div>
      <input
        type="number"
        value={tabSize}
        onChange={(e) => handleChange(Number(e.target.value))}
      />
      {isDirty && (
        <>
          <button onClick={handleSave}>Save</button>
          <button onClick={handleCancel}>Cancel</button>
        </>
      )}
    </div>
  );
}
```

### Cross-Tab Sync

Automatically synced! Just use the hooks anywhere:

```tsx
// Tab 1: Change theme
// Tab 2: Automatically reflects new theme
const [theme] = useStorageState("appearance.theme");
```

---

## Performance Tips

### 1. Debounce Heavy Writes

```tsx
// Auto-debounced with default 500ms
storage.set("workspace.labs.physics.cameraPos", [1, 2, 3]);

// Custom debounce
storage.set("appearance.fontSize", 16, { debounce: 100 });
```

### 2. Use Specific Hooks

```tsx
// ❌ Avoid - causes full re-render
const allStorage = useStorage();

// ✅ Good - minimal re-render
const [fontSize] = useStorageState("appearance.fontSize");
```

### 3. Batch Updates

```tsx
// ❌ Three writes
storage.set("appearance.theme", "dark");
storage.set("appearance.fontSize", 16);
storage.set("appearance.fontFamily", "mono");

// ✅ One write
storage.setMultiple({
  appearance: {
    theme: "dark",
    fontSize: 16,
    fontFamily: "mono",
  },
});
```

### 4. Monitor Storage Size

```tsx
const sizeKb = storage.getSize() / 1024;
console.log(`Storage: ${sizeKb.toFixed(1)}KB`);

// Monitor limits (localStorage usually ~5-10MB)
if (sizeKb > 5000) {
  console.warn("Storage approaching quota");
}
```

---

## Migrations & Schema Changes

### Adding a New Preference (v3+)

1. **Update schema.ts:**

```typescript
export interface AppearancePrefs {
  // ... existing
  newSetting: SomeType;
}
```

2. **Update defaults.ts:**

```typescript
export const DEFAULT_APPEARANCE: AppearancePrefs = {
  // ... existing
  newSetting: defaultValue,
};
```

3. **Update storage.ts migrations:**

```typescript
private async runMigrations(old: IDEStorageSchema): Promise<IDEStorageSchema> {
  let current = { ...old };

  // V2 -> V3: Add newSetting
  if (current.version < 3) {
    current.appearance = {
      ...current.appearance,
      newSetting: defaultValue,
    };
    current.migrations[3] = Date.now();
  }

  current.version = SCHEMA_VERSION;
  return current;
}
```

---

## Debugging

```tsx
// Export current storage
const exported = storage.export();
console.log(exported);

// Import from JSON
storage.import(exported);

// Check size
console.log(`${(storage.getSize() / 1024).toFixed(1)}KB`);

// Reset to defaults (⚠️ data loss!)
storage.reset();

// Listen to all changes
storage.subscribe((data) => {
  console.log("Storage changed:", data);
});
```

---

## Limitations & Design Decisions

### Why localStorage vs IndexedDB?

- **localStorage** ✅ Simple key-value, perfect for <5MB settings
- **IndexedDB** ⚠️ Needed if storing >5MB (files, large caches)

We chose **localStorage** because:
- IDE preferences fit comfortably
- Synchronous API simpler for settings
- If you need >5MB, we can swap to IndexedDB later

### Not for Secrets

- Don't store tokens, passwords, or API keys
- localStorage is readable by any JS on the page
- Use secure httpOnly cookies for auth

### Quota Exceeded?

The storage module auto-detects quota errors. But if you hit the limit:
1. Check `storage.getSize()`
2. Clear old lab states (not needed every session)
3. Or migrate to IndexedDB if growing

---

## File Structure

```
src/utils/storage/
├── schema.ts       # Type definitions
├── defaults.ts     # Default values
├── storage.ts      # Core class + singleton
├── hooks.ts        # React integration
├── index.ts        # Central export
└── README.md       # This file
```

## License

Part of coltens world IDE. Internal use.
