/**
 * Default IDE Storage Values
 */

import type {
  AppearancePrefs,
  EditorPrefs,
  DeveloperPrefs,
  PerformancePrefs,
  WorkspaceState,
  SandboxState,
  UserProfile,
  IDEStorageSchema,
} from "./schema";
import { SCHEMA_VERSION } from "./schema";

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  theme: "dark",
  fontSize: 14,
  fontFamily: "mono",
  editorLineHeight: 1.5,
  compactMode: false,
  sidebarWidth: 300,
  panelOpacity: 0.95,
};

export const DEFAULT_EDITOR: EditorPrefs = {
  tabSize: 2,
  autoSave: true,
  autoSaveInterval: 10000, // 10 seconds
  showLineNumbers: true,
  showMinimap: false,
  wordWrap: true,
  defaultLanguage: "typescript",
};

export const DEFAULT_DEVELOPER: DeveloperPrefs = {
  enableConsole: true,
  logLevel: "info",
  enableProfiling: false,
  enableNetworkTab: false,
  showHiddenFiles: false,
  exposeInternalAPIs: false,
};

export const DEFAULT_PERFORMANCE: PerformancePrefs = {
  enableWebGL: true,
  targetFPS: 60,
  enableShadows: true,
  enablePostFX: true,
  meshDetailLevel: "medium",
  enableCaching: true,
};

export const DEFAULT_WORKSPACE: WorkspaceState = {
  labs: {},
  recentFiles: [],
  openPanels: ["console"],
  lastSaved: Date.now(),
};

export const DEFAULT_SANDBOX: SandboxState = {
  runtimeDebug: false,
};

export const DEFAULT_USER: UserProfile = {
  preferences: {
    skipTutorials: false,
    anonymousAnalytics: true,
    notifyUpdates: true,
  },
  stats: {
    totalLabsVisited: 0,
    totalPlaygroundSessions: 0,
    averageSessionDuration: 0,
  },
};

export const DEFAULT_IDE_STORAGE: IDEStorageSchema = {
  version: SCHEMA_VERSION,
  lastUpdated: Date.now(),
  appearance: DEFAULT_APPEARANCE,
  editor: DEFAULT_EDITOR,
  developer: DEFAULT_DEVELOPER,
  performance: DEFAULT_PERFORMANCE,
  workspace: DEFAULT_WORKSPACE,
  sandbox: DEFAULT_SANDBOX,
  user: DEFAULT_USER,
  migrations: {},
};
