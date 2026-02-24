/**
 * React Hooks for IDE Storage
 * Integrates storage with React state management
 */

import { createElement, useCallback, useEffect, useState, type ComponentType, type FC } from "react";
import type { IDEStorageSchema } from "./schema";
import { storage } from "./storage";

/**
 * Hook: Subscribe to entire storage (use sparingly - causes full re-renders)
 * @example
 * const allSettings = useStorage();
 */
export function useStorage(): IDEStorageSchema {
  const [data, setData] = useState<IDEStorageSchema>(() => storage.getAll());

  useEffect(() => {
    return storage.subscribe((newData) => {
      setData(newData);
    });
  }, []);

  return data;
}

/**
 * Hook: Get a single nested value with auto-update
 * @example
 * const theme = useStorageValue("appearance.theme");
 * const fps = useStorageValue("performance.targetFPS", 60);
 */
export function useStorageValue<T>(path: string, defaultValue?: T): T {
  const [value, setValue] = useState<T>(() => storage.get(path, defaultValue));

  useEffect(() => {
    const unsubscribe = storage.subscribe((data) => {
      const newValue = getPath(data, path);
      setValue(newValue !== undefined ? newValue : defaultValue);
    });

    return unsubscribe;
  }, [path, defaultValue]);

  return value;
}

/**
 * Hook: Get and set a single nested value
 * Returns [value, setter]
 * @example
 * const [theme, setTheme] = useStorageState("appearance.theme");
 * setTheme("light");
 */
export function useStorageState<T>(
  path: string,
  defaultValue?: T
): [T, (value: T) => void] {
  const value = useStorageValue(path, defaultValue);

  const setValue = useCallback(
    (newValue: T) => {
      storage.set(path, newValue, { debounce: 300 });
    },
    [path]
  );

  return [value, setValue];
}

/**
 * Hook: Get/set an entire config section
 * @example
 * const [appearance, updateAppearance] = useStorageSection("appearance");
 */
export function useStorageSection<K extends keyof IDEStorageSchema>(
  section: K
): [IDEStorageSchema[K], (updates: Partial<IDEStorageSchema[K]>) => void] {
  const [data, setData] = useState<IDEStorageSchema[K]>(() => storage.get(section));

  useEffect(() => {
    const unsubscribe = storage.subscribe((newData) => {
      setData(newData[section]);
    });

    return unsubscribe;
  }, [section]);

  const updateSection = useCallback(
    (updates: Partial<IDEStorageSchema[K]>) => {
      const current = storage.get(section);
      storage.set(section, { ...current, ...updates }, { debounce: 300 });
    },
    [section]
  );

  return [data, updateSection];
}

/**
 * Hook: Track a lab's state persistently
 * @example
 * const [labState, updateLabState] = useLab("LabMatrixPlaygroundPage", {
 *   viewportZoom: 1,
 * });
 * updateLabState({ cameraPos: [1, 2, 3] });
 */
export function useLab<T extends Record<string, any>>(
  labName: string,
  defaults?: T
): [T, (updates: Partial<T>) => void] {
  const path = `workspace.labs.${labName}`;
  const [labState, setLabState] = useState<T>(() => {
    const stored = storage.get(path, {});
    return { ...defaults, ...stored } as T;
  });

  useEffect(() => {
    const unsubscribe = storage.subscribe((data) => {
      const stored = getPath(data, path) ?? {};
      setLabState({ ...defaults, ...stored } as T);
    });

    return unsubscribe;
  }, [labName, defaults]);

  const updateLabState = useCallback(
    (updates: Partial<T>) => {
      const merged = { ...labState, ...updates };
      storage.set(path, merged, { debounce: 500 });
    },
    [labState, path]
  );

  return [labState, updateLabState];
}

/**
 * Hook: Sync a local component state with storage
 * Useful for forms, settings panels, etc.
 * Only persists on blur or explicit save
 * @example
 * const [value, setValue, save] = useStorageForm("appearance.fontSize");
 */
export function useStorageForm<T>(
  path: string,
  defaultValue?: T
): [T, (value: T) => void, () => void] {
  const storedValue = useStorageValue(path, defaultValue);
  const [localValue, setLocalValue] = useState<T>(storedValue);

  useEffect(() => {
    setLocalValue(storedValue);
  }, [storedValue]);

  const save = useCallback(() => {
    storage.set(path, localValue, { debounce: 100 });
  }, [path, localValue]);

  return [localValue, setLocalValue, save];
}

// ============================================================================
// HELPER: Get nested value from object
// ============================================================================

function getPath(obj: any, path: string): any {
  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }

  return current;
}

// ============================================================================
// HELPER: Higher-order component pattern (for class components)
// ============================================================================

export function withStorage<P extends object>(
  Component: ComponentType<P & { storage: IDEStorageSchema }>,
  selector?: (storage: IDEStorageSchema) => Partial<P>
): FC<Omit<P, "storage">> {
  return function WithStorageComponent(props: Omit<P, "storage">) {
    const allSettings = useStorage();
    const selectedProps = selector ? selector(allSettings) : ({} as Partial<P>);

    return createElement(Component, { ...(props as P), ...selectedProps, storage: allSettings } as P & { storage: IDEStorageSchema });
  };
}
