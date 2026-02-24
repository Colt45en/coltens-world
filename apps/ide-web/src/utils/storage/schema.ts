/**
 * IDE Storage Schema v2
 * Defines all persistent preferences and state for coltens world IDE
 */

export const SCHEMA_VERSION = 2;
export const STORAGE_PREFIX = "coltens-world-ide";

// ============================================================================
// THEME & APPEARANCE
// ============================================================================

export type Theme = "dark" | "light" | "auto";

export interface AppearancePrefs {
  theme: Theme;
  fontSize: number; // 12-18px
  fontFamily: "system" | "mono" | "sans";
  editorLineHeight: number; // 1.2-2.0
  compactMode: boolean;
  sidebarWidth: number; // pixels, 200-500
  panelOpacity: number; // 0.8-1.0
}

// ============================================================================
// WORKSPACE STATE
// ============================================================================

export interface LabState {
  [labName: string]: {
    lastActive: number; // timestamp
    viewportZoom: number;
    cameraPos?: [number, number, number];
    cameraTarget?: [number, number, number];
    selectedTool?: string;
    panelLayout?: "horizontal" | "vertical" | "tabbed";
  };
}

export interface WorkspaceState {
  activeLabPage?: string;
  labs: LabState;
  recentFiles: string[];
  openPanels: string[]; // "console", "inspector", "output", etc.
  lastSaved: number;
}

// ============================================================================
// EDITOR PREFERENCES
// ============================================================================

export interface EditorPrefs {
  tabSize: number; // 2, 4, 8
  autoSave: boolean;
  autoSaveInterval: number; // milliseconds
  showLineNumbers: boolean;
  showMinimap: boolean;
  wordWrap: boolean;
  defaultLanguage: "typescript" | "python" | "glsl";
}

// ============================================================================
// DEVELOPER SETTINGS
// ============================================================================

export interface DeveloperPrefs {
  enableConsole: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  enableProfiling: boolean;
  enableNetworkTab: boolean;
  showHiddenFiles: boolean;
  exposeInternalAPIs: boolean;
}

// ============================================================================
// PERFORMANCE & DEBUGGING
// ============================================================================

export interface PerformancePrefs {
  enableWebGL: boolean;
  targetFPS: 30 | 60 | 120;
  enableShadows: boolean;
  enablePostFX: boolean;
  meshDetailLevel: "low" | "medium" | "high";
  enableCaching: boolean;
}

// ============================================================================
// SANDBOX / RUNTIME STATE
// ============================================================================

export interface SandboxState {
  pythonEnv?: string;
  nodeVersion?: string;
  runtimeDebug: boolean;
  lastRuntimeError?: string;
  lastRuntimeErrorTime?: number;
  systemMemoryEstimate?: number;
}

// ============================================================================
// USER PROFILE & ANALYTICS
// ============================================================================

export interface UserProfile {
  userId?: string;
  username?: string;
  preferences: {
    skipTutorials: boolean;
    anonymousAnalytics: boolean;
    notifyUpdates: boolean;
  };
  stats: {
    totalLabsVisited: number;
    totalPlaygroundSessions: number;
    averageSessionDuration: number;
  };
}

// ============================================================================
// MAIN STORAGE SCHEMA
// ============================================================================

export interface IDEStorageSchema {
  version: number;
  lastUpdated: number;

  // Core preferences
  appearance: AppearancePrefs;
  editor: EditorPrefs;
  developer: DeveloperPrefs;
  performance: PerformancePrefs;

  // State
  workspace: WorkspaceState;
  sandbox: SandboxState;
  user: UserProfile;

  // Migrations tracking
  migrations: {
    [version: number]: number; // timestamp of when migration was run
  };
}
