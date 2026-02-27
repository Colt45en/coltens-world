/**
 * Author Formatting & Truncation Rules
 * Handles both people and corporate contributors with explicit rules
 */

import type { ContributorList, ContributorPerson } from "../contracts/formatting.js";
import { PunctuationGovernor } from "./governor.js";
import type { LocaleRules } from "./locale.js";

function clean(s?: string): string {
  return (s ?? "").trim();
}

function initials(name: string, dot: string): string {
  const t = name.trim();
  if (!t) return "";
  return t
    .split(/\s+/g)
    .filter(Boolean)
    .map((p) => (p.charAt(0) || "").toUpperCase() + dot)
    .join("");
}

export interface AuthorRules {
  maxAuthors: number; // truncation threshold
  etAlPosition: number; // how many authors to show before andOthers
}

/**
 * Format a single person contributor in compact citation style.
 * Output: "LASTNAME J.M." (initials follow last name)
 */
export function formatPerson(p: ContributorPerson, loc: LocaleRules): string {
  const last = clean(p.last).toUpperCase();
  const first = clean(p.first);
  const middle = clean(p.middle);

  const fi = first ? initials(first, loc.dotInitial) : "";
  const mi = middle ? initials(middle, loc.dotInitial) : "";

  // Stable citation-ish compact: "LAST J.P."
  const right = (fi + mi).trim();
  return right ? `${last}${loc.space}${right}` : last;
}

/**
 * Format a contributor list (people or corporate).
 * Applies author truncation rules: if count > maxAuthors, show first etAlPosition then "et al."
 */
export function formatContributors(
  list: ContributorList | undefined,
  loc: LocaleRules,
  rules: AuthorRules,
  gov: PunctuationGovernor
): string {
  if (!list) return "";

  const corp = clean(list.corporate);
  if (corp) return gov.govern(corp);

  const people = list.people ?? [];
  if (people.length === 0) return "";

  const max = Math.max(1, rules.maxAuthors);
  const etPos = Math.max(1, rules.etAlPosition);

  const isEtAl = people.length > max;
  const limit = isEtAl ? Math.min(etPos, people.length) : Math.min(max, people.length);

  const printed: string[] = [];
  for (let i = 0; i < limit; i++) {
    const person = people[i];
    if (person) printed.push(formatPerson(person, loc));
  }

  let out = printed.join(loc.authorsSeparator);

  if (isEtAl) {
    if (out.length > 0) out += loc.authorsSeparator;
    out += loc.andOthers;
  }

  return gov.govern(out);
}
