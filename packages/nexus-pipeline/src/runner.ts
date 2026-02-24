import { analyze, detectDomain } from "./detectors";
import { computeFeatures } from "./heuristics";
import { scoreCandidate, SCORING_PROFILES } from "./scoring";
import type { Candidate, Objective, TemplateDef } from "./types";
import { clamp, fnv1a32, hex8, stableId } from "./utils";

export type RunOptions = {
    input: string;
    domain?: "code" | "prose" | "auto";
    density?: number;          // 0..100
    objective?: Objective;
    templates?: TemplateDef[];
    maxCandidates?: number;
};

export type RunResult = {
    domain: "code" | "prose";
    objective: Objective;
    density: number;
    seedHex: string;
    candidates: Candidate[];
    bestId: string | null;
};

export function runPipeline(opts: RunOptions): RunResult {
    const input = (opts.input ?? "").trim();
    const density = clamp(opts.density ?? 50, 0, 100);
    const objective: Objective = opts.objective ?? "readability";
    const domain = (opts.domain ?? "auto") === "auto" ? detectDomain(input) : (opts.domain as any);

    const seedU32 = fnv1a32(`nexus:${domain}:${density}:${objective}:${input}`);
    const seedHex = `0x${hex8(seedU32)}`;

    const analysis = analyze(input, domain);

    const templates = (opts.templates ?? []).filter(t => t.domain === domain);
    const profileEntry = SCORING_PROFILES[objective];
    const profile = profileEntry || SCORING_PROFILES["readability"]!;

    const candidates: Candidate[] = [];

    for (const tpl of templates) {
        // required motifs gate
        const ok = tpl.requiredMotifs.every(req => analysis.motifs.some(m => m.id === req));
        if (!ok) continue;

        const bindings = tpl.claim(analysis);
        for (const binding of bindings) {
            const ctx = { input, domain, density, objective, seedU32, seedHex };
            const rendered = tpl.render(binding, ctx);
            const base = clamp(tpl.baseScore(binding, ctx), 0, 1);
            const features = computeFeatures(rendered, input, tpl.hintFeatures);
            const score = scoreCandidate(base, features, profile);

            const id = stableId("cand", seedU32, `${tpl.id}:${rendered}`);

            candidates.push({
                id,
                templateId: tpl.id,
                type: domain === "code" ? "Template (Structural)" : "Template (Lexical)",
                value: rendered,
                baseScore: base,
                features,
                score,
                provenance: {
                    orchestrator: domain === "code" ? "StructuralSynthesis" : "LexicalSynthesis",
                    templateId: tpl.id,
                    templateLabel: tpl.label,
                    objective,
                    density,
                    binding,
                    features,
                    transforms: [
                        `Template selected: ${tpl.id}`,
                        `Features computed (readability/modularity/minimal_diff)`,
                        `Objective score: ${objective}`
                    ],
                    seed: seedHex
                }
            });
        }
    }

    // Atomic fallback for code
    if (domain === "code") {
        const raw = analysis.atoms.map(a => a.token).join("");
        const base = clamp(0.58 + ((1 - density / 100) * 0.18), 0, 1);
        const ctx = { input, domain, density, objective, seedU32, seedHex };
        const features = computeFeatures(raw, input, { minimal_diff: 0.9, readability: 0.5, modularity: 0.25 });
        const score = scoreCandidate(base, features, profile);
        candidates.push({
            id: stableId("cand", seedU32, `atomic:${raw}`),
            templateId: "tpl.code.atomic_fallback",
            type: "Atomic (Raw)",
            value: `// Atomic reconstruction (density=${density}%)\n${raw}`,
            baseScore: base,
            features,
            score,
            provenance: {
                orchestrator: "StructuralSynthesis",
                templateId: "tpl.code.atomic_fallback",
                templateLabel: "Atomic fallback",
                objective,
                density,
                binding: { atoms: analysis.atoms },
                features,
                transforms: ["Token concatenation fallback"],
                seed: seedHex
            }
        });
    }

    candidates.sort((a, b) => b.score - a.score);

    const max = opts.maxCandidates ?? 12;
    const sliced = candidates.slice(0, max);
    const bestId = sliced[0]?.id ?? null;

    return { domain, objective, density, seedHex, candidates: sliced, bestId };
}
