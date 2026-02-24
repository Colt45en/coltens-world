import type { Candidate, ScoringProfile } from "./types";
import { clamp } from "./utils";

export const SCORING_PROFILES: Record<string, ScoringProfile> = {
    readability: { objective: "readability", weights: { base: 0.55, readability: 0.30, modularity: 0.10, minimal_diff: 0.05 } },
    modularity: { objective: "modularity", weights: { base: 0.45, modularity: 0.35, readability: 0.15, minimal_diff: 0.05 } },
    minimal_diff: { objective: "minimal_diff", weights: { base: 0.60, minimal_diff: 0.30, readability: 0.07, modularity: 0.03 } },
};

export function scoreCandidate(baseScore: number, features: Candidate["features"], profile: ScoringProfile): number {
    const w = profile.weights;
    return clamp(
        w.base * baseScore +
        w.readability * features.readability +
        w.modularity * features.modularity +
        w.minimal_diff * features.minimal_diff,
        0,
        1
    );
}
