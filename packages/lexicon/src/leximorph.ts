/**
 * leximorph.ts
 * TypeScript port of Python leximorph analyzer
 * Same architecture: AnalyzedEntry → AnalyzerRegistry → Storage
 */

// @ts-ignore - better-sqlite3 has no TypeScript definitions
import Database from 'better-sqlite3';

/** ====== Types ====== */

export type Language = 'en' | 'js' | 'ts' | 'html';
export type Kind = 'word' | 'identifier' | 'html' | 'token';
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface AnalyzedEntry {
    entry: string;
    kind: Kind;
    language: Language;
    parts: Record<string, Json>;
    meta: Record<string, Json>;
    created_at_utc: string;
}

export interface Analyzer {
    supports(language: string, kind: string): boolean;
    analyze(text: string, language: string, kind: string): AnalyzedEntry;
}

/** ====== Utilities ====== */

function utcNowIso(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function stableJson(obj: unknown): string {
    // Deterministic JSON stringification with sorted keys
    const sort = (v: any): any => {
        if (Array.isArray(v)) return v.map(sort);
        if (v && typeof v === 'object') {
            const out: Record<string, any> = {};
            for (const k of Object.keys(v).sort()) out[k] = sort(v[k]);
            return out;
        }
        return v;
    };
    return JSON.stringify(sort(obj));
}

function detectIdentifierStyle(s: string): string {
    if (s.includes('-') && !s.includes('_')) return 'kebab-case';
    if (s.includes('_') && !s.includes('-')) {
        if (s.toUpperCase() === s && /[A-Z]/.test(s)) return 'SCREAMING_SNAKE';
        return 'snake_case';
    }
    if (/[A-Z]/.test(s) && /[a-z]/.test(s)) return /^[a-z]/.test(s) ? 'camelCase' : 'PascalCase';
    if (/^[a-z0-9]+$/.test(s)) return 'lower';
    if (/^[A-Z0-9]+$/.test(s)) return 'upper';
    return 'unknown';
}

function splitIdentifier(s: string): string[] {
    if (!s) return [];
    const chunks = s.split(/[_-]+/g).filter(Boolean);
    const parts: string[] = [];
    const tokenRe = /[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|\d+/g;
    for (const chunk of chunks) {
        const m = chunk.match(tokenRe);
        if (m) parts.push(...m);
    }
    return parts;
}

/** ====== SQLite Store ====== */

const SCHEMA_SQL = `
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS analyzed_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry TEXT NOT NULL,
  kind TEXT NOT NULL,
  language TEXT NOT NULL,
  parts_json TEXT NOT NULL,
  meta_json TEXT NOT NULL,
  created_at_utc TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_entry ON analyzed_entries(entry);
CREATE INDEX IF NOT EXISTS idx_entries_kind_lang ON analyzed_entries(kind, language);
`;

export class LexiStore {
    private db: Database.Database;

    constructor(public dbPath: string) {
        this.db = new Database(dbPath);
    }

    init(): void {
        this.db.exec(SCHEMA_SQL);
    }

    close(): void {
        this.db.close();
    }

    insert(e: AnalyzedEntry): number {
        const stmt = this.db.prepare(`
      INSERT INTO analyzed_entries(entry, kind, language, parts_json, meta_json, created_at_utc)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const info = stmt.run(
            e.entry,
            e.kind,
            e.language,
            stableJson(e.parts),
            stableJson(e.meta),
            e.created_at_utc
        );
        return Number(info.lastInsertRowid);
    }

    queryContains(text: string, limit = 50): Array<any> {
        const stmt = this.db.prepare(`
      SELECT id, entry, kind, language, parts_json, meta_json, created_at_utc
      FROM analyzed_entries
      WHERE entry LIKE ?
         OR parts_json LIKE ?
         OR meta_json LIKE ?
      ORDER BY id DESC
      LIMIT ?
    `);
        const rows = stmt.all(`%${text}%`, `%${text}%`, `%${text}%`, limit);
        return rows.map((r: any) => ({
            id: r.id,
            entry: r.entry,
            kind: r.kind,
            language: r.language,
            parts: JSON.parse(r.parts_json),
            meta: JSON.parse(r.meta_json),
            created_at_utc: r.created_at_utc,
        }));
    }
}

/** ====== Registry ====== */

export class AnalyzerRegistry {
    private plugins: Analyzer[] = [];

    register(p: Analyzer): void {
        this.plugins.push(p);
    }

    analyze(text: string, language: string, kind: string): AnalyzedEntry {
        for (const p of this.plugins) {
            if (p.supports(language, kind)) return p.analyze(text, language, kind);
        }
        throw new Error(`No analyzer registered for language=${language} kind=${kind}`);
    }
}

/** ====== English Morph Analyzer ====== */

const COMMON_PREFIXES = [
    'anti', 'auto', 'bi', 'co', 'counter', 'de', 'dis', 'down', 'extra',
    'hyper', 'il', 'im', 'in', 'inter', 'ir', 'micro', 'mis', 'mono',
    'multi', 'non', 'over', 'post', 'pre', 'pro', 're', 'semi', 'sub',
    'super', 'trans', 'tri', 'ultra', 'un', 'under', 'up',
] as const;

const COMMON_SUFFIXES = [
    'ability', 'able', 'ably', 'acy', 'al', 'ally', 'ance', 'ant', 'ary',
    'ation', 'ative', 'ed', 'en', 'ence', 'ent', 'er', 'ers', 'ery',
    'es', 'est', 'ful', 'hood', 'ible', 'ibly', 'ic', 'ical', 'ically',
    'ing', 'ion', 'ish', 'ism', 'ist', 'ity', 'ive', 'ization', 'ize',
    'less', 'ly', 'ment', 'ness', 'or', 'ous', 'ously', 's', 'ship', 'tion',
    'ward', 'wards', 'y',
] as const;

const KNOWN_ROOTS = new Set([
    'believe', 'build', 'write', 'code', 'struct', 'press', 'compute', 'form',
    'act', 'logic', 'narrate', 'view', 'move', 'place', 'learn',
]);

function bestAffixMatch(
    word: string,
    candidates: readonly string[],
    isPrefix: boolean
): string | null {
    const w = word.toLowerCase();
    const matches = candidates.filter((c) =>
        isPrefix ? w.startsWith(c) && c.length < w.length : w.endsWith(c) && c.length < w.length
    );
    if (matches.length === 0) return null;
    return matches.reduce((a, b) => (b.length > a.length ? b : a));
}

export class EnglishMorphAnalyzer implements Analyzer {
    supports(language: string, kind: string): boolean {
        return (language === 'en' || language === 'english') && (kind === 'word' || kind === 'token');
    }

    analyze(text: string): AnalyzedEntry {
        const raw = text.trim();
        const norm = raw.replace(/[^A-Za-z']+/g, '');
        const lower = norm.toLowerCase();

        const prefix = bestAffixMatch(lower, COMMON_PREFIXES, true);
        const suffix = bestAffixMatch(lower, COMMON_SUFFIXES, false);

        let core = lower;
        if (prefix) core = core.slice(prefix.length);
        if (suffix && core.endsWith(suffix)) core = core.slice(0, core.length - suffix.length);

        const scoreRoot = (r: string): number => {
            let s = 0;
            if (r.length >= 3) s += 1;
            if (KNOWN_ROOTS.has(r)) s += 3;
            if (/^[a-z]+$/.test(r)) s += 1;
            return s;
        };

        let best: { p: string | null; r: string; s: string | null; sc: number } = {
            p: prefix,
            r: core,
            s: suffix,
            sc: scoreRoot(core),
        };

        if (prefix) {
            const c2 = lower.slice(prefix.length);
            const sc2 = scoreRoot(c2);
            if (sc2 > best.sc) best = { p: prefix, r: c2, s: null, sc: sc2 };
        }
        if (suffix) {
            const c3 = lower.slice(0, lower.length - suffix.length);
            const sc3 = scoreRoot(c3);
            if (sc3 > best.sc) best = { p: null, r: c3, s: suffix, sc: sc3 };
        }
        {
            const sc4 = scoreRoot(lower);
            if (sc4 > best.sc) best = { p: null, r: lower, s: null, sc: sc4 };
        }

        const parts = {
            prefix: best.p ? `${best.p}-` : null,
            root: best.r || null,
            suffix: best.s ? `-${best.s}` : null,
        };

        const meta = {
            normalized: lower,
            confidence: Math.min(1.0, 0.25 + 0.15 * best.sc),
            notes: ['heuristic_split', 'expand_known_roots_and_affixes_for_higher_accuracy'],
        };

        return {
            entry: raw,
            kind: 'word',
            language: 'en',
            parts,
            meta,
            created_at_utc: utcNowIso(),
        };
    }
}

/** ====== Identifier Analyzer ====== */

export class IdentifierAnalyzer implements Analyzer {
    supports(language: string, kind: string): boolean {
        return (
            ['js', 'ts', 'javascript', 'typescript'].includes(language) &&
            ['identifier', 'word'].includes(kind)
        );
    }

    analyze(text: string, language: string): AnalyzedEntry {
        const raw = text.trim();
        const style = detectIdentifierStyle(raw);
        const tokens = splitIdentifier(raw);
        const lang: Language = language === 'js' || language === 'javascript' ? 'js' : 'ts';

        return {
            entry: raw,
            kind: 'identifier',
            language: lang,
            parts: { tokens },
            meta: { style, token_count: tokens.length },
            created_at_utc: utcNowIso(),
        };
    }
}

/** ====== HTML Analyzer ====== */

const TAG_RE = /<\s*([a-zA-Z][a-zA-Z0-9:-]*)\s*([^>]*)>/s;
const ATTR_RE = /([^\s=]+)\s*=\s*(["'])(.*?)(\2)/gs;

export class HtmlAnalyzer implements Analyzer {
    supports(language: string, kind: string): boolean {
        return language === 'html' && (kind === 'html' || kind === 'tag');
    }

    analyze(text: string): AnalyzedEntry {
        const raw = text.trim();
        const m = raw.match(TAG_RE);
        if (!m) {
            return {
                entry: raw,
                kind: 'html',
                language: 'html',
                parts: { tag: null, attrs: {} },
                meta: { confidence: 0.2, note: 'no_tag_match' },
                created_at_utc: utcNowIso(),
            };
        }

        const tag = m[1] || '';
        const attrsSrc = m[2] || '';
        const attrs: Record<string, string> = {};

        if (attrsSrc) {
            for (const match of attrsSrc.matchAll(ATTR_RE)) {
                const name = match[1];
                const value = match[3] || match[2];
                if (name && value) {
                    attrs[name] = value;
                }
            }
        }

        const classTokens: string[] = [];
        const idTokens: string[] = [];

        if (attrs['class']) {
            for (const c of attrs['class'].trim().split(/\s+/g)) {
                classTokens.push(...splitIdentifier(c));
            }
        }
        if (attrs['id']) {
            idTokens.push(...splitIdentifier(attrs['id'].trim()));
        }

        return {
            entry: raw,
            kind: 'html',
            language: 'html',
            parts: { tag, attrs, classTokens, idTokens },
            meta: { confidence: 0.85, attr_count: Object.keys(attrs).length },
            created_at_utc: utcNowIso(),
        };
    }
}

/** ====== Build Registry ====== */

export function buildRegistry(): AnalyzerRegistry {
    const reg = new AnalyzerRegistry();
    reg.register(new EnglishMorphAnalyzer());
    reg.register(new IdentifierAnalyzer());
    reg.register(new HtmlAnalyzer());
    return reg;
}
