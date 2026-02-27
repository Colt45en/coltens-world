/**
 * Tool Lane Adapter — Nucleus/tool_call Ready
 * Pure function tool map for Nucleus agent router
 */

import type {
    Tool_BuildSortKey_Input,
    Tool_BuildSortKey_Output,
    Tool_FormatBibliography_Input,
    Tool_FormatBibliography_Output,
    Tool_GovernText_Output,
    Tool_SortEntries_Input,
    Tool_SortEntries_Output
} from "../contracts/formatting.js";

import { buildBibSortKey, formatBibEntry } from "./biblio.js";
import { PunctuationGovernor } from "./governor.js";
import { getLocale } from "./locale.js";
import { buildSortKey, sortDeterministically } from "./sort.js";

export type ToolHandler = (input: unknown) => unknown;

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function mustString(x: unknown, name: string): string {
  if (typeof x !== "string") throw new Error(`Expected ${name} to be string`);
  return x;
}

/**
 * Create the formatting tools map for Nucleus router.
 * Add these to your existing `tools` map in your agent handler.
 */
export function createEngineFormattingTools(): Record<string, ToolHandler> {
  return {
    "engine.format.govern_text": (input: unknown): Tool_GovernText_Output => {
      if (!isObj(input)) throw new Error("Invalid input: expected object");
      const text = mustString(input.text, "text");
      const options = isObj(input.options) ? (input.options as any) : undefined;
      const gov = new PunctuationGovernor(options);
      return { text: gov.govern(text) };
    },

    "engine.sort.build_key": (input: unknown): Tool_BuildSortKey_Output => {
      const i = input as Tool_BuildSortKey_Input;
      if (!i || !i.entry || !i.plan) throw new Error("Invalid input: missing entry or plan");
      const parts = buildSortKey(i.entry, i.plan);
      return parts;
    },

    "engine.sort.sort_entries": (input: unknown): Tool_SortEntries_Output => {
      const i = input as Tool_SortEntries_Input;
      if (!i || !Array.isArray(i.entries) || !i.plan) {
        throw new Error("Invalid input: missing entries array or plan");
      }
      const ordered = sortDeterministically(i.entries, i.plan);
      return { ordered_ids: ordered.map((e) => e.id) };
    },

    "engine.bib.format": (input: unknown): Tool_FormatBibliography_Output => {
      const i = input as Tool_FormatBibliography_Input;
      if (!i || !Array.isArray(i.entries)) throw new Error("Invalid input: expected entries array");

      const loc = getLocale(i.options?.locale);
      const rules = {
        maxAuthors: i.options?.maxAuthors ?? 3,
        etAlPosition: i.options?.etAlPosition ?? 1
      };
      const gov = new PunctuationGovernor({ locale: loc.id });

      const lines = i.entries.map((e) => {
        const text = formatBibEntry(e, loc, rules, gov);
        const sk = buildBibSortKey(e);
        return { id: e.id, text, sort_key: sk.canonical_key, tie_break: sk.tie_break };
      });

      // deterministic ordering by (sort_key, tie_break)
      const ordered_ids = [...lines]
        .sort((a, b) =>
          a.sort_key < b.sort_key
            ? -1
            : a.sort_key > b.sort_key
              ? 1
              : a.tie_break < b.tie_break
                ? -1
                : a.tie_break > b.tie_break
                  ? 1
                  : 0
        )
        .map((x) => x.id);

      return { lines, ordered_ids };
    }
  };
}
