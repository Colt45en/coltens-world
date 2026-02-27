/**
 * Bibliography Formatting
 * Type-specific formatting with explicit missing-data rules
 */

import type { BibEntry } from "../contracts/formatting.js";
import { formatContributors, type AuthorRules } from "./authors.js";
import { PunctuationGovernor } from "./governor.js";
import type { LocaleRules } from "./locale.js";
import { buildSortKey, type SortKeyParts } from "./sort.js";

function present(s?: string): string {
  const t = (s ?? "").trim();
  return t.length ? t : "";
}

function presentNum(n?: number): string {
  return typeof n === "number" ? String(n) : "";
}

function ymd(y?: number, m?: number, d?: number): string {
  if (typeof y !== "number") return "";
  const mm = typeof m === "number" ? String(m).padStart(2, "0") : "";
  const dd = typeof d === "number" ? String(d).padStart(2, "0") : "";
  if (mm && dd) return `${y}-${mm}-${dd}`;
  if (mm) return `${y}-${mm}`;
  return `${y}`;
}

function joinNonEmpty(items: string[], sep: string): string {
  return items.map((x) => x.trim()).filter(Boolean).join(sep);
}

/**
 * Format a single bibliography entry based on its type.
 * Each type has explicit rules for missing data (sine loco, sine nomine, etc.)
 */
export function formatBibEntry(e: BibEntry, loc: LocaleRules, rules: AuthorRules, gov: PunctuationGovernor): string {
  switch (e.sourceType) {
    case "Book":
      return gov.govern(formatBook(e, loc, rules, gov));
    case "JournalArticle":
      return gov.govern(formatJournal(e, loc, rules, gov));
    case "InternetSite":
    case "DocumentFromInternetSite":
      return gov.govern(formatInternet(e, loc, rules, gov));
    case "Patent":
      return gov.govern(formatPatent(e, loc, rules, gov));
    case "Case":
      return gov.govern(formatCase(e, loc, rules, gov));
    default:
      return gov.govern(formatFallback(e, loc, rules, gov));
  }
}

// Missing-data rules are explicit per type:

function formatBook(e: BibEntry, loc: LocaleRules, rules: AuthorRules, gov: PunctuationGovernor): string {
  const author = formatContributors(e.contributors?.Author, loc, rules, gov);
  const title = present(e.title) || present(e.shortTitle);
  const year = presentNum(e.year);

  const city = present(e.city) || loc.sineLoco;
  const pub = present(e.publisher) || loc.sineNomine;
  const locPub = joinNonEmpty([city, pub], loc.enumSeparator);

  const parts = [author, title, locPub, year].filter(Boolean);
  return joinNonEmpty(parts, loc.groupSeparator);
}

function formatJournal(e: BibEntry, loc: LocaleRules, rules: AuthorRules, gov: PunctuationGovernor): string {
  const author = formatContributors(e.contributors?.Author, loc, rules, gov);
  const title = present(e.title) || present(e.shortTitle);
  const year = presentNum(e.year);
  const journal = present(e.containerTitle);

  const vol = present(e.volume);
  const iss = present(e.issue);
  const pages = present(e.pages);

  let volIssue = "";
  if (vol && iss) volIssue = `${vol}${loc.openBracket}${iss}${loc.closeBracket}`;
  else volIssue = vol || iss || "";

  const tail = joinNonEmpty([journal, volIssue, pages], loc.listSeparator);

  const parts = [author, title, year, tail].filter(Boolean);
  return joinNonEmpty(parts, loc.groupSeparator);
}

function formatInternet(e: BibEntry, loc: LocaleRules, rules: AuthorRules, gov: PunctuationGovernor): string {
  const author = formatContributors(e.contributors?.Author, loc, rules, gov);
  const title = present(e.title) || present(e.shortTitle);
  const site = present(e.containerTitle);
  const url = present(e.url);

  const accessed = ymd(e.yearAccessed, e.monthAccessed, e.dayAccessed);
  const cited = accessed ? loc.citedFmt.replace("%1", accessed) : "";

  const parts = [author, title, site, cited, url].filter(Boolean);
  return joinNonEmpty(parts, loc.groupSeparator);
}

function formatPatent(e: BibEntry, loc: LocaleRules, rules: AuthorRules, gov: PunctuationGovernor): string {
  const inv = formatContributors(e.contributors?.Inventor, loc, rules, gov);
  const title = present(e.title) || present(e.shortTitle);
  const year = presentNum(e.year);
  const parts = [inv, title, year].filter(Boolean);
  return joinNonEmpty(parts, loc.groupSeparator);
}

function formatCase(e: BibEntry, loc: LocaleRules, rules: AuthorRules, gov: PunctuationGovernor): string {
  const counsel = formatContributors(e.contributors?.Counsel, loc, rules, gov);
  const title = present(e.title) || present(e.shortTitle);
  const court = present(e.institution) || present(e.publisher) || "";
  const year = presentNum(e.year);
  const parts = [title, court, year, counsel].filter(Boolean);
  return joinNonEmpty(parts, loc.groupSeparator);
}

function formatFallback(e: BibEntry, loc: LocaleRules, rules: AuthorRules, gov: PunctuationGovernor): string {
  const author = formatContributors(e.contributors?.Author, loc, rules, gov);
  const title = present(e.title) || present(e.shortTitle);
  const year = presentNum(e.year);
  const parts = [author, title, year].filter(Boolean);
  return joinNonEmpty(parts, loc.groupSeparator);
}

export function bibToSortKeyEntry(e: BibEntry): { id: string; fields: Record<string, unknown> } {
  return {
    id: e.id,
    fields: {
      // keep this canonical + simple for sorting
      author: e.contributors?.Author?.corporate ??
        (e.contributors?.Author?.people?.[0]?.last
          ? `${e.contributors.Author.people[0].last} ${e.contributors.Author.people[0].first ?? ""}`.trim()
          : ""),
      title: e.shortTitle ?? e.title ?? "",
      year: e.year ?? 0
    }
  };
}

export function buildBibSortKey(e: BibEntry): SortKeyParts {
  const ske = bibToSortKeyEntry(e);
  return buildSortKey(
    { id: ske.id, fields: ske.fields as any },
    { fieldOrder: ["author", "title", "year"], includeYear: true, yearField: "year" }
  );
}
