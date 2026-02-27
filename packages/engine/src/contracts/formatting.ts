/**
 * Formatting Kernel — Contract Definitions
 * Deterministic text normalization, sort keys, and bibliography
 */

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [k: string]: Json };

export type LocaleId = "en-US";

export interface ContributorPerson {
  first?: string;
  middle?: string;
  last?: string;
}

export interface ContributorList {
  corporate?: string;
  people?: ContributorPerson[];
}

/**
 * Generic record for sort key building.
 * You can use it for bibliography entries, memory nodes, artifacts, etc.
 */
export interface SortKeyEntry {
  id: string; // stable unique id in your system (hash id is perfect)
  type?: string; // optional category (book, node, artifact, etc)
  fields: Record<string, Json>; // structured facts
}

/**
 * Sort plan: choose fields + order + whether to include year.
 * The plan is explicit: no hidden behavior.
 */
export interface SortKeyPlan {
  fieldOrder: string[]; // e.g. ["title", "author", "year"] or ["author", "title", "year"]
  includeYear?: boolean;
  yearField?: string; // default "year"
}

export interface GovernOptions {
  locale?: LocaleId;

  // Behavior toggles (safe defaults if omitted)
  ensureTerminalPunct?: boolean;
  terminalPunct?: string; // default "."
  collapseWhitespace?: boolean;
  removeSpaceBeforePunct?: boolean;
  removeSpaceAfterOpenBracket?: boolean;
  removeSpaceBeforeCloseBracket?: boolean;
  dedupePunctuation?: boolean;
  ensureSpaceAfterPunct?: boolean;
}

export interface Tool_GovernText_Input {
  text: string;
  options?: GovernOptions;
}
export interface Tool_GovernText_Output {
  text: string;
}

export interface Tool_BuildSortKey_Input {
  entry: SortKeyEntry;
  plan: SortKeyPlan;
  locale?: LocaleId;
}
export interface Tool_BuildSortKey_Output {
  canonical_key: string;
  tie_break: string;
  raw_key: string;
}

export interface Tool_SortEntries_Input {
  entries: SortKeyEntry[];
  plan: SortKeyPlan;
  locale?: LocaleId;
}
export interface Tool_SortEntries_Output {
  ordered_ids: string[];
}

/**
 * Bibliography-friendly entry (optional specialized schema).
 * This is what you'll use if you want GB7714/ISO690-like formatting.
 */
export type BibSourceType =
  | "Book"
  | "BookSection"
  | "JournalArticle"
  | "ArticleInAPeriodical"
  | "ConferenceProceedings"
  | "Report"
  | "InternetSite"
  | "DocumentFromInternetSite"
  | "Patent"
  | "Case"
  | "Film"
  | "Misc";

export interface BibEntry {
  id: string;
  sourceType: BibSourceType;

  title?: string;
  shortTitle?: string;
  containerTitle?: string; // journal/site title
  publisher?: string;
  city?: string;
  institution?: string;

  year?: number;
  month?: number;
  day?: number;

  yearAccessed?: number;
  monthAccessed?: number;
  dayAccessed?: number;

  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;

  contributors?: {
    Author?: ContributorList;
    Editor?: ContributorList;
    Translator?: ContributorList;
    Inventor?: ContributorList;
    Director?: ContributorList;
    Counsel?: ContributorList;
  };
}

export interface BibFormatOptions {
  locale?: LocaleId;
  maxAuthors?: number; // default 3
  etAlPosition?: number; // default 1
}

export interface Tool_FormatBibliography_Input {
  entries: BibEntry[];
  options?: BibFormatOptions;
}
export interface Tool_FormatBibliography_Output {
  lines: { id: string; text: string; sort_key: string; tie_break: string }[];
  ordered_ids: string[];
}
