/**
 * useAdvancedSearch - Fuzzy search with filters, sorting, and highlighting
 *
 * Provides powerful search capabilities with debouncing and performance optimization
 */

import { useCallback, useEffect, useMemo, useState } from "react";

export interface SearchOptions<T> {
  keys: (keyof T)[];
  threshold?: number;
  debounceMs?: number;
  caseSensitive?: boolean;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  matches: Array<{ key: keyof T; indices: [number, number][] }>;
}

export interface SearchState<T> {
  query: string;
  results: SearchResult<T>[];
  isSearching: boolean;
  totalResults: number;
}

/**
 * Simple fuzzy matching score
 */
function fuzzyScore(query: string, text: string, caseSensitive: boolean = false): number {
  if (!query) return 1;

  const q = caseSensitive ? query : query.toLowerCase();
  const t = caseSensitive ? text : text.toLowerCase();

  let score = 0;
  let lastIndex = -1;

  for (const char of q) {
    const index = t.indexOf(char, lastIndex + 1);
    if (index === -1) return 0;

    // Bonus for consecutive matches
    score += index === lastIndex + 1 ? 2 : 1;
    lastIndex = index;
  }

  // Normalize by length
  return score / (t.length + q.length);
}

export function useAdvancedSearch<T extends Record<string, any>>(
  items: T[],
  options: SearchOptions<T>
) {
  const { keys, threshold = 0.3, debounceMs = 300, caseSensitive = false } = options;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [filters, setFilters] = useState<Partial<Record<keyof T, any>>>({});
  const [sortBy, setSortBy] = useState<keyof T | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Debounce query
  useEffect(() => {
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsSearching(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const results = useMemo(() => {
    let filtered = items;

    // Apply filters
    if (Object.keys(filters).length > 0) {
      filtered = filtered.filter(item =>
        Object.entries(filters).every(([key, value]) =>
          item[key] === value || value === null || value === undefined
        )
      );
    }

    // Apply search
    if (debouncedQuery) {
      const searchResults: SearchResult<T>[] = [];

      for (const item of filtered) {
        let maxScore = 0;
        const matches: Array<{ key: keyof T; indices: [number, number][] }> = [];

        for (const key of keys) {
          const value = String(item[key] || "");
          const score = fuzzyScore(debouncedQuery, value, caseSensitive);

          if (score > maxScore) maxScore = score;
          if (score > threshold) {
            matches.push({ key, indices: [] }); // Simplified - full implementation would track indices
          }
        }

        if (maxScore >= threshold) {
          searchResults.push({ item, score: maxScore, matches });
        }
      }

      filtered = searchResults
        .sort((a, b) => b.score - a.score)
        .map(r => r.item);
    }

    // Apply sorting
    if (sortBy) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];

        if (aVal < bVal) return sortAsc ? -1 : 1;
        if (aVal > bVal) return sortAsc ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [items, debouncedQuery, filters, sortBy, sortAsc, keys, threshold, caseSensitive]);

  const setFilter = useCallback((key: keyof T, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const toggleSort = useCallback((key: keyof T) => {
    if (sortBy === key) {
      setSortAsc(prev => !prev);
    } else {
      setSortBy(key);
      setSortAsc(true);
    }
  }, [sortBy]);

  return {
    query,
    setQuery,
    results,
    isSearching,
    totalResults: results.length,
    filters,
    setFilter,
    clearFilters,
    sortBy,
    sortAsc,
    toggleSort,
  };
}
