// tooling/speech/heteronym_resolver.mjs
//
// BRAIN ARCHITECTURE: Perception Layer → Normalizer (context-aware heteronym resolution)
//
// Deterministic heteronym disambiguation for raw token streams (no POS tagger)
// Uses linguistic heuristics (determiners, modals, time markers) within ±4 token window

const DETERMINERS = new Set([
  "the","a","an","this","that","these","those",
  "my","your","his","her","our","their","its"
]);

const MODALS = new Set([
  "will","would","can","could","shall","should","may","might","must"
]);

const AUX_HAVE = new Set(["have","has","had","having"]);
const AUX_BE = new Set(["am","is","are","was","were","been","being"]);
const NEGATIONS = new Set(["not","n't","never"]);
const PAST_TIME = new Set(["yesterday","ago","last","earlier","previously","once"]);

function norm(tok) {
  return String(tok || "")
    .toLowerCase()
    .replace(/[.,!?;:]+$/g, "");  // Strip trailing punctuation for matching
}

function inSet(tok, set) {
  const t = norm(tok);
  return t !== "" && set.has(t);
}

function anyInWindow(tokens, i, set, radius = 3) {
  const lo = Math.max(0, i - radius);
  const hi = Math.min(tokens.length - 1, i + radius);
  for (let j = lo; j <= hi; j++) {
    if (inSet(tokens[j], set)) return true;
  }
  return false;
}

function prevTok(tokens, i, k = 1) {
  return i - k >= 0 ? tokens[i - k] : "";
}
function nextTok(tokens, i, k = 1) {
  return i + k < tokens.length ? tokens[i + k] : "";
}

function looksLikePastVerbSuffix(tok) {
  const t = norm(tok);
  return t.endsWith("ed"); // crude, but helpful sometimes
}

function looksLikeGerund(tok) {
  const t = norm(tok);
  return t.endsWith("ing");
}

// Main entry: returns pronunciation string or null if no heteronym handling
export function resolveHeteronym(word, tokens, i, cfg) {
  const w = norm(word);
  const rules = (cfg?.heteronymRules || cfg?.heteronymsRules || {});
  const entry = rules[w];
  if (!entry) return null;

  const p1 = norm(prevTok(tokens, i, 1));
  const p2 = norm(prevTok(tokens, i, 2));
  const n1 = norm(nextTok(tokens, i, 1));
  const n2 = norm(nextTok(tokens, i, 2));

  // Helper booleans
  const prevIsDet = DETERMINERS.has(p1);
  const prevIsModal = MODALS.has(p1);
  const prevIsTo = p1 === "to";
  const prevIsHave = AUX_HAVE.has(p1);
  const prev2IsHave = AUX_HAVE.has(p2);
  const pastMarkerNearby = anyInWindow(tokens, i, PAST_TIME, 4);
  const modalNearby = anyInWindow(tokens, i, MODALS, 2);

  // Evaluate ordered rules
  for (const r of entry.ordered || []) {
    if (matchRule(r, { w, p1, p2, n1, n2, prevIsDet, prevIsModal, prevIsTo, prevIsHave, prev2IsHave, pastMarkerNearby, modalNearby })) {
      return r.pron;
    }
  }

  // Default fallback
  return entry.default || null;
}

function matchRule(rule, ctx) {
  // Rule schema:
  // { when: { prevIn:[], nextIn:[], prevEq:"", pastMarker:true, prevHave:true, ... }, pron:"..." }

  const w = ctx.w;
  const when = rule.when || {};

  if (when.prevDet === true && !ctx.prevIsDet) return false;
  if (when.prevModal === true && !ctx.prevIsModal) return false;
  if (when.prevTo === true && !ctx.prevIsTo) return false;
  if (when.prevHave === true && !(ctx.prevIsHave || ctx.prev2IsHave)) return false;
  if (when.pastMarker === true && !ctx.pastMarkerNearby) return false;

  if (Array.isArray(when.prevIn) && when.prevIn.length) {
    if (!when.prevIn.map(x => String(x).toLowerCase()).includes(ctx.p1)) return false;
  }
  if (Array.isArray(when.nextIn) && when.nextIn.length) {
    if (!when.nextIn.map(x => String(x).toLowerCase()).includes(ctx.n1)) return false;
  }
  if (typeof when.prevEq === "string" && when.prevEq) {
    if (ctx.p1 !== when.prevEq.toLowerCase()) return false;
  }
  if (typeof when.nextEq === "string" && when.nextEq) {
    if (ctx.n1 !== when.nextEq.toLowerCase()) return false;
  }
  if (typeof when.prevRe === "string" && when.prevRe) {
    const re = new RegExp(when.prevRe, "i");
    if (!re.test(ctx.p1)) return false;
  }
  if (typeof when.nextRe === "string" && when.nextRe) {
    const re = new RegExp(when.nextRe, "i");
    if (!re.test(ctx.n1)) return false;
  }

  return true;
}
