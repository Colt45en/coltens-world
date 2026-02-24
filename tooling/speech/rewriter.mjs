/**
 * BRAIN ARCHITECTURE: Perception Layer → Normalizer
 *
 * Speech/Text Normalizer - converts raw text to canonical phonetic form
 * Pipeline: tokenize → edge split → heteronym resolve → exceptions → grapheme rules
 *
 * Deterministic grapheme rewriter.
 *
 * - Heteronym resolver runs first (if rules exist for word)
 * - Exceptions override grapheme rules.
 * - Rules sorted by (priority desc, id asc) in config.
 * - Single left-to-right pass with "best rule at index i".
 * - Context flags:
 *   - vowel: next char is in vowel set
 *   - set:XYZ: next char is one of chars in XYZ
 *   - re:<regex>: applied to "after" context if provided, else to next char (or prev for some use)
 *
 * Special heuristic:
 * - TH voiced vs voiceless:
 *   - If rule.id contains "TH_VOICED" OR notes mention "voiced", apply only when
 *     token is in voicedThList OR (between vowels).
 */

import fs from "node:fs/promises";
import { resolveHeteronym } from "./heteronym_resolver.mjs";
import path from "node:path";

export function stripBom(s) {
  if (s && s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

export async function loadConfig(configPath) {
  const p = path.resolve(process.cwd(), configPath);
  const raw = stripBom(await fs.readFile(p, "utf8"));
  return JSON.parse(raw);
}

function normalizeRel(p) {
  return p.split(path.sep).join("/");
}

function isAllCaps(s) {
  return s.length > 0 && s === s.toUpperCase() && s !== s.toLowerCase();
}

function isTitleCase(s) {
  if (s.length === 0) return false;
  const first = s[0];
  const rest = s.slice(1);
  return first === first.toUpperCase() && rest === rest.toLowerCase();
}

function capitalizeFirstUnicode(s) {
  if (!s) return s;
  const [first, ...rest] = Array.from(s);
  return first.toUpperCase() + rest.join("");
}

function applyCaseLike(original, rewritten) {
  if (!rewritten) return rewritten;
  if (isAllCaps(original)) return rewritten.toUpperCase();
  if (isTitleCase(original)) return capitalizeFirstUnicode(rewritten);
  return rewritten;
}

function isLetterOrMark(ch) {
  // Keep simple: treat a-z A-Z and apostrophe as part of token; punctuation splits.
  return /[A-Za-z'']/.test(ch);
}

function splitTokenEdges(token) {
  // preserve leading/trailing punctuation
  let start = 0;
  let end = token.length;

  while (start < end && !isLetterOrMark(token[start])) start++;
  while (end > start && !isLetterOrMark(token[end - 1])) end--;

  return {
    lead: token.slice(0, start),
    core: token.slice(start, end),
    tail: token.slice(end),
  };
}

function compileExpectedRule(rule, settings) {
  const vowels = new Set(Array.from(settings.vowels || "aeiouy"));

  const compiled = {
    ...rule,
    _patternLower: rule.pattern.toLowerCase(),
    _replace: rule.replace,
    _pos: rule.pos || "any",
    _flags: Array.isArray(rule.flags) ? rule.flags : [],
    _isThVoiced:
      rule.id.includes("TH_VOICED") ||
      (typeof rule.notes === "string" && rule.notes.toLowerCase().includes("voiced th")),
    _vowels: vowels,
  };

  compiled._flagFns = compiled._flags.map((f) => {
    if (f === "vowel") {
      return (ctx) => {
        const n = ctx.next;
        return n ? vowels.has(n) : false;
      };
    }
    if (f.startsWith("set:")) {
      const set = new Set(Array.from(f.slice("set:".length)));
      return (ctx) => {
        const n = ctx.next;
        return n ? set.has(n) : false;
      };
    }
    if (f.startsWith("re:")) {
      const body = f.slice("re:".length);
      // We treat this as a regex applied to NEXT char unless ctx.afterStr is available.
      const re = new RegExp(body);
      return (ctx) => {
        if (ctx.afterStr && ctx.afterStr.length > 0) return re.test(ctx.afterStr);
        return ctx.next ? re.test(ctx.next) : false;
      };
    }
    // unknown flag -> ignore (but deterministic)
    return () => true;
  });

  // Support "before"/"after" columns if present:
  // - before: re:<regex> applied to prev char
  // - after:  re:<regex> applied to next char
  compiled._beforeFn = null;
  compiled._afterFn = null;

  if (compiled.before && compiled.before.startsWith("re:")) {
    const re = new RegExp(compiled.before.slice(3));
    compiled._beforeFn = (ctx) => (ctx.prev ? re.test(ctx.prev) : false);
  }
  if (compiled.after && compiled.after.startsWith("re:")) {
    const re = new RegExp(compiled.after.slice(3));
    compiled._afterFn = (ctx) => (ctx.next ? re.test(ctx.next) : false);
  }

  return compiled;
}

function bestMatchAt(tokenLower, i, rules, settings) {
  const prev = i > 0 ? tokenLower[i - 1] : "";
  const next = i < tokenLower.length ? tokenLower[i + 1] : "";
  const nextChar = i + 1 < tokenLower.length ? tokenLower[i + 1] : "";
  // afterStr = substring after current index (used by some re:...)
  const afterStr = tokenLower.slice(i + 1);

  const ctxBase = { prev, next: nextChar, afterStr };

  for (const r of rules) {
    const pat = r._patternLower;
    if (!tokenLower.startsWith(pat, i)) continue;

    // position constraints
    if (r._pos === "start" && i !== 0) continue;
    if (r._pos === "end" && i + pat.length !== tokenLower.length) continue;

    // heuristic: voiced TH gating
    if (r._isThVoiced) {
      const betweenVowels =
        i > 0 &&
        i + pat.length < tokenLower.length &&
        r._vowels.has(tokenLower[i - 1]) &&
        r._vowels.has(tokenLower[i + pat.length]);
      const inLex = (settings.voicedThList || []).includes(tokenLower);
      if (!(inLex || betweenVowels)) continue;
    }

    // before/after regex constraints
    if (r._beforeFn && !r._beforeFn(ctxBase)) continue;
    if (r._afterFn && !r._afterFn(ctxBase)) continue;

    // flags
    let ok = true;
    for (const fn of r._flagFns) {
      if (!fn(ctxBase)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    // first match wins because rules already sorted by priority desc, id asc
    return { rule: r, len: pat.length };
  }

  return null;
}

export function buildRewriter(config) {
  const settings = config.settings || { vowels: "aeiouy", voicedThList: [] };
  const exceptions = config.exceptions || {};
  const rawRules = Array.isArray(config.rules) ? config.rules : [];

  // compile
  const rules = rawRules.map((r) => compileExpectedRule(r, settings));

  function rewriteWordCore(word, tokenIndex, contextCores, config) {
    if (!word) return word;
    const lower = word.toLowerCase().replace(/\u2019/g, "'");

    // 1) Heteronym resolver first (if rules exist for this word)
    const hEntry = config?.heteronymRules?.[lower];
    if (hEntry) {
      const h = resolveHeteronym(lower, contextCores, tokenIndex, config);
      if (typeof h === "string" && h.length > 0) {
        return applyCaseLike(word, h);
      }
    }

    // 2) Exception exact match
    const ex = exceptions[lower];
    if (typeof ex === "string" && ex.length > 0) return applyCaseLike(word, ex);

    let out = "";
    let i = 0;

    while (i < lower.length) {
      const m = bestMatchAt(lower, i, rules, settings);
      if (!m) {
        out += lower[i];
        i += 1;
        continue;
      }
      out += m.rule._replace;
      i += m.len;
    }

    return applyCaseLike(word, out);
  }

  function rewriteToken(token, tokenIndex, contextCores, config) {
    const { lead, core, tail } = splitTokenEdges(token);
    if (!core) return token;
    const rewritten = rewriteWordCore(core, tokenIndex, contextCores, config);
    return lead + rewritten + tail;
  }

  function rewriteText(text) {
    // preserve whitespace by splitting with capture
    const parts = text.split(/(\s+)/g);

    // Build context token cores (original, no whitespace) BEFORE rewriting
    const contextCores = [];
    for (const p of parts) {
      if (!p || p.trim() === "") continue;
      const { core } = splitTokenEdges(p);
      contextCores.push(core);
    }

    // Rewrite each token with context
    let tokenIndex = 0;
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i] || parts[i].trim() === "") continue;
      parts[i] = rewriteToken(parts[i], tokenIndex, contextCores, config);
      tokenIndex++;
    }
    return parts.join("");
  }

  return {
    rewriteWord: rewriteWordCore,
    rewriteToken,
    rewriteText,
    settings,
  };
}
