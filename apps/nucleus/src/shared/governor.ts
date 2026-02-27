// apps/nucleus/src/shared/governor.ts
// Punctuation Governor - enforces deterministic text normalization

export interface GovernOptions {
  ensureTerminalPunct?: boolean;
  terminalPunct?: string;
  endChars?: string;

  collapseWhitespace?: boolean;
  removeSpaceBeforePunct?: boolean;
  removeSpaceAfterOpenBracket?: boolean;
  removeSpaceBeforeCloseBracket?: boolean;

  dedupePunctuation?: boolean;
  ensureSpaceAfterPunct?: boolean;

  nbsp?: string;
  space?: string;
}

const DEFAULT_ENDCHARS = ".!?…)]}\"\"\\'\\'";
const CLOSE_BRACKETS = new Set([")", "]", "}", '"', "'", "'"]);
const PUNCT_SPACE_AFTER = new Set([",", ";", ":"]);

function isWs(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\u00A0";
}

/**
 * Apply punctuation governance rules to normalize text
 */
export function governText(input: string, opts: GovernOptions = {}): string {
  const space = opts.space ?? " ";
  const nbsp = opts.nbsp ?? "\u00A0";
  const endChars = opts.endChars ?? DEFAULT_ENDCHARS;

  const collapseWhitespace = opts.collapseWhitespace ?? true;
  const removeSpaceBeforePunct = opts.removeSpaceBeforePunct ?? true;
  const removeSpaceAfterOpenBracket = opts.removeSpaceAfterOpenBracket ?? true;
  const removeSpaceBeforeCloseBracket = opts.removeSpaceBeforeCloseBracket ?? true;

  const dedupePunctuation = opts.dedupePunctuation ?? true;
  const ensureSpaceAfterPunct = opts.ensureSpaceAfterPunct ?? true;

  const ensureTerminalPunct = opts.ensureTerminalPunct ?? true;
  const terminalPunct = opts.terminalPunct ?? ".";

  let s = input.replaceAll(nbsp, space);

  if (collapseWhitespace) s = s.replace(/[\t\r\n ]+/g, space).trim();
  else s = s.trim();

  if (removeSpaceAfterOpenBracket) s = s.replace(/([([{""''])\s+/g, "$1");
  if (removeSpaceBeforeCloseBracket) s = s.replace(/\s+([)\]}""''])/g, "$1");
  if (removeSpaceBeforePunct) s = s.replace(/\s+([,.;:!?…])/g, "$1");

  if (dedupePunctuation) {
    s = s.replace(/([,;:!?])\1+/g, "$1");
    s = s.replace(/\.{4,}/g, "...");
    s = s.replace(/\.{2,3}/g, (m) => (m.length === 3 ? "..." : "."));
  }

  if (ensureSpaceAfterPunct) s = ensureSpacesAfterPunct(s, space);

  if (collapseWhitespace) s = s.replace(/ +/g, space).trim();
  else s = s.trim();

  if (ensureTerminalPunct && s.length > 0) {
    const last = s.slice(-1);
    if (!endChars.includes(last)) s += terminalPunct;
  }

  return s;
}

/**
 * Insert space after punctuation where needed
 */
function ensureSpacesAfterPunct(s: string, space: string): string {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    out.push(ch);

    if (!PUNCT_SPACE_AFTER.has(ch)) continue;

    const next = s[i + 1];
    if (next === undefined) continue;
    if (isWs(next)) continue;
    if (CLOSE_BRACKETS.has(next)) continue;
    if (",.;:!?…".includes(next)) continue;

    out.push(space);
  }
  return out.join("");
}

/**
 * Govern multiple paragraphs separately (keeps structure intact)
 */
export function governMultiParagraph(text: string): string {
  const paras = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paras.length === 0) return "";

  return paras.map((p) => governText(p)).join("\n\n");
}
