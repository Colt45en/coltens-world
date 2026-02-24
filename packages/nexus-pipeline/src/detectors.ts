import type { Analysis, Atom, Domain, Motif } from "./types";
import { clamp, fnv1a32, stableId } from "./utils";

function makeAtom(domain: Domain, token: string, seed: number, i: number): Atom {
    return {
        id: stableId("atom", seed, `${i}:${domain}:${token}`),
        domain,
        token,
        kind: "atom",
        complexity: clamp(token.length / 24, 0.05, 0.35),
    };
}

export function detectDomain(input: string): Domain {
    const s = input.trim();
    const looksHTML = /<\/?[a-zA-Z][\w:-]*[\s\S]*?>/.test(s) && s.includes("<") && s.includes(">");
    if (looksHTML) return "code";
    const looksJS =
        s.includes("=>") ||
        /\b(const|let|var|function|return|class|import|export)\b/.test(s) ||
        /[A-Za-z_$][\w$]*\s*\.\s*(map|filter|reduce|forEach)\s*\(/.test(s) ||
        /[{][\s\S]*[}]/.test(s);
    return looksJS ? "code" : "prose";
}

export function analyze(input: string, domain: Domain): Analysis {
    const seed = fnv1a32(`analysis:${domain}:${input}`);
    const motifs: Motif[] = [];

    if (domain === "code") {
        const tokens = input.split(/(\s+|[;(){}[\],.<>:=+\-*/%!&|?]+)/).filter(t => t && !/^\s+$/.test(t));
        const atoms = tokens.map((t, i) => makeAtom(domain, t, seed, i));

        // map/filter motif
        const re = /([A-Za-z_$][\w$]*)\s*\.map\s*\(\s*([\s\S]*?)\s*\)\s*\.filter\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$/m;
        const m = input.match(re);
        if (m && m[1] && m[2] && m[3]) {
            motifs.push({
                id: "motif.js.map_filter",
                domain,
                token: "[JS map/filter chain]",
                confidence: 0.92,
                complexity: 0.9,
                data: { source: m[1], mapFn: m[2].trim(), filterFn: m[3].trim() },
            });
        }

        // html component motif
        const re2 = /<([a-zA-Z][\w:-]*)[^>]*\sclass\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/m;
        const m2 = input.match(re2);
        if (m2 && m2[1] && m2[2] && m2[3]) {
            const inner = (m2[3] || "").trim();
            motifs.push({
                id: "motif.html.component",
                domain,
                token: "[HTML component]",
                confidence: 0.86,
                complexity: 0.75,
                data: { tag: m2[1], className: m2[2].trim(), content: inner.slice(0, 160) },
            });
        }

        return { domain, atoms, motifs };
    }

    // prose
    const raw = input.split(/\s+/).filter(Boolean);
    const atoms = raw.map((t, i) => makeAtom(domain, t, seed, i));
    return { domain, atoms, motifs };
}
