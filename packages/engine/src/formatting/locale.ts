/**
 * Locale Rules — Language-specific text formatting conventions
 */

import type { LocaleId } from "../contracts/formatting.js";

export interface LocaleRules {
  id: LocaleId;

  space: string;
  nbSpace: string;

  listSeparator: string; // ", "
  groupSeparator: string; // ". "
  enumSeparator: string; // ": "
  authorsSeparator: string; // ", "

  openBracket: string; // "("
  closeBracket: string; // ")"
  openQuote: string; // """
  closeQuote: string; // """

  endChars: string; // chars that count as "already ended"
  dot: string; // "."
  dotInitial: string; // "."

  hyphens: string; // "-–—"

  and: string; // "and"
  andOthers: string; // "et al."
  citedFmt: string; // "cited %1"

  sineNomine: string; // "sine nomine"
  sineLoco: string; // "sine loco"
}

export const EN_US: LocaleRules = {
  id: "en-US",
  space: " ",
  nbSpace: "\u00A0",
  listSeparator: ", ",
  groupSeparator: ". ",
  enumSeparator: ": ",
  authorsSeparator: ", ",
  openBracket: "(",
  closeBracket: ")",
  openQuote: '"',
  closeQuote: '"',
  endChars: ".!?…)]}\\\"'",
  dot: ".",
  dotInitial: ".",
  hyphens: "-–—",
  and: "and",
  andOthers: "et al.",
  citedFmt: "cited %1",
  sineNomine: "sine nomine",
  sineLoco: "sine loco"
};

export function getLocale(id: LocaleId | undefined): LocaleRules {
  switch (id ?? "en-US") {
    case "en-US":
      return EN_US;
    default:
      return EN_US;
  }
}
