/**
 * IDE Storage - Central Export
 * Production-grade storage wrapper for coltens world IDE
 */

export type { IDEStorageSchema, Theme, AppearancePrefs, EditorPrefs, DeveloperPrefs, PerformancePrefs, WorkspaceState, SandboxState, UserProfile, LabState } from "./schema";
export { SCHEMA_VERSION, STORAGE_PREFIX } from "./schema";

export { DEFAULT_IDE_STORAGE, DEFAULT_APPEARANCE, DEFAULT_EDITOR, DEFAULT_DEVELOPER, DEFAULT_PERFORMANCE, DEFAULT_WORKSPACE, DEFAULT_SANDBOX, DEFAULT_USER } from "./defaults";

export { IDEStorage, storage, getStorageInstance } from "./storage";

export { useStorage, useStorageValue, useStorageState, useStorageSection, useLab, useStorageForm, withStorage } from "./hooks";
