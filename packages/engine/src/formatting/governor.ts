/**
 * Punctuation Governor
 * Enforces consistent spacing, terminal punctuation, and text normalization
 */

import type { GovernOptions } from "../contracts/formatting.js";
import { getLocale } from "./locale.js";

export interface GovernorConfig {
  trim: boolean;
  collapseWhitespace: boolean;

  removeSpaceBeforePunct: boolean;
  removeSpaceAfterOpenBracket: boolean;
  removeSpaceBeforeCloseBracket: boolean;

  dedupePunctuation: boolean;
  ensureSpaceAfterPunct: boolean;

  ensureTerminalPunct: boolean;
  terminalPunct: string;
  endChars: string;

  normalizeNbspToSpace: boolean;
  nbsp: string;
  space: string;
}

const DEFAULTS = (opts?: GovernOptions): GovernorConfig => {
  const loc = getLocale(opts?.locale);
  return {
    trim: true,
    collapseWhitespace: opts?.collapseWhitespace ?? true,

    removeSpaceBeforePunct: opts?.removeSpaceBeforePunct ?? true,
    removeSpaceAfterOpenBracket: opts?.removeSpaceAfterOpenBracket ?? true,
    removeSpaceBeforeCloseBracket: opts?.removeSpaceBeforeCloseBracket ?? true,

    dedupePunctuation: opts?.dedupePunctuation ?? true,
    ensureSpaceAfterPunct: opts?.ensureSpaceAfterPunct ?? true,

    ensureTerminalPunct: opts?.ensureTerminalPunct ?? true,
    terminalPunct: opts?.terminalPunct ?? loc.dot,
    endChars: loc.endChars,

    normalizeNbspToSpace: true,
    nbsp: loc.nbSpace,
    space: loc.space
  };
};

const CLOSE_BRACKETS = new Set([")", "]", "}", '"', '"', "'", "'"]);
const PUNCT_SPACE_AFTER = new Set([",", ";", ":"]);

function isWs(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\u00A0";
}

/**
 * Punctuation Governor: applies normalization rules to text.
 * All operations are deterministic and reproducible.
 */
export class PunctuationGovernor {
  private readonly cfg: GovernorConfig;

  constructor(opts?: GovernOptions) {
    this.cfg = DEFAULTS(opts);
  }

  govern(input: string): string {
    let s = input;

    if (this.cfg.normalizeNbspToSpace && this.cfg.nbsp !== this.cfg.space) {
      s = s.replaceAll(this.cfg.nbsp, this.cfg.space);
    }

    if (this.cfg.collapseWhitespace) {
      s = s.replace(/[\t\r\n ]+/g, this.cfg.space);
    }
    if (this.cfg.trim) s = s.trim();

    if (this.cfg.removeSpaceAfterOpenBracket) {
      s = s.replace(/([([{""''])\s+/g, "$1");
    }
    if (this.cfg.removeSpaceBeforeCloseBracket) {
      s = s.replace(/\s+([)\]}""''])/g, "$1");
    }
    if (this.cfg.removeSpaceBeforePunct) {
      s = s.replace(/\s+([,.;:!?…])/g, "$1");
    }

    if (this.cfg.dedupePunctuation) {
      s = s.replace(/([,;:!?])\1+/g, "$1");
      s = s.replace(/\.{4,}/g, "...");
      s = s.replace(/\.{2,3}/g, (m) => (m.length === 3 ? "..." : "."));
    }

    if (this.cfg.ensureSpaceAfterPunct) {
      s = this.ensureSpacesAfterPunct(s);
    }

    if (this.cfg.collapseWhitespace) s = s.replace(/ +/g, this.cfg.space);
    if (this.cfg.trim) s = s.trim();

    if (this.cfg.ensureTerminalPunct && s.length > 0) {
      const last = s.slice(-1);
      if (!this.cfg.endChars.includes(last)) s += this.cfg.terminalPunct;
    }

    return s;
  }

  private ensureSpacesAfterPunct(s: string): string {
    const out: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === undefined) continue;
      out.push(ch);

      if (!PUNCT_SPACE_AFTER.has(ch)) continue;

      const next = s[i + 1];
      if (next === undefined) continue;
      if (isWs(next)) continue;
      if (CLOSE_BRACKETS.has(next)) continue;

      // Don't force spaces before punctuation
      if (",.;:!?…".includes(next)) continue;

      out.push(this.cfg.space);
    }
    return out.join("");
  }
}
