import fs from "node:fs";
import path from "node:path";
import { KnowledgeArtifactSchema, type KnowledgeArtifact } from "../thought/thoughtTypes";

type Args = {
    file: string;
    since?: string; // YYYY-MM-DD
    until?: string; // YYYY-MM-DD
    top: number;
    json: boolean;
    jsonl: boolean; // streaming NDJSON output
};

function usage(): never {
    console.error(
        [
            "Usage:",
            "  pnpm tsx packages/brain/src/cli/memory-stats.ts --file <ndjson> [--since <YYYY-MM-DD>] [--until <YYYY-MM-DD>] [--top N] [--json|--jsonl]",
            "",
            "Examples:",
            "  pnpm tsx packages/brain/src/cli/memory-stats.ts --file .brain/memory/knowledge.ndjson --json",
            "  pnpm tsx packages/brain/src/cli/memory-stats.ts --file .brain/memory/knowledge.ndjson --since 2026-02-01 --until 2026-02-12 --top 25 --jsonl",
            "  pnpm tsx packages/brain/src/cli/memory-stats.ts --file .brain/memory/knowledge.ndjson --jsonl (stream stats line by line)"
        ].join("\n")
    );
    process.exit(2);
}

function parseArgs(argv: string[]): Args {
    const a: Partial<Args> = { top: 20, json: false, jsonl: false };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        if (k === "--file" && i + 1 < argv.length) {
            a.file = argv[i + 1]!;
            i++;
        } else if (k === "--since" && i + 1 < argv.length) {
            a.since = argv[i + 1]!;
            i++;
        } else if (k === "--until" && i + 1 < argv.length) {
            a.until = argv[i + 1]!;
            i++;
        } else if (k === "--top" && argv[i + 1]) {
            a.top = Number(argv[i + 1]);
            i++;
        } else if (k === "--json") {
            a.json = true;
        } else if (k === "--jsonl") {
            a.jsonl = true;
        }
    }
    if (!a.file) usage();
    if (!Number.isFinite(a.top!) || (a.top as number) <= 0) a.top = 20;
    return a as Args;
}

function dateStartIso(ymd: string): string {
    return new Date(`${ymd}T00:00:00.000Z`).toISOString();
}

function dateEndIso(ymd: string): string {
    const d = new Date(`${ymd}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
}

function inRange(createdAtIso: string, since?: string, until?: string): boolean {
    if (since) {
        const s = dateStartIso(since);
        if (createdAtIso < s) return false;
    }
    if (until) {
        const u = dateEndIso(until);
        if (createdAtIso >= u) return false;
    }
    return true;
}

function ymdFromIso(iso: string): string {
    return iso.slice(0, 10);
}

function normalize(s: string): string {
    return s.toLowerCase();
}

/**
 * Simple concept extraction for stats:
 * - collect words length>=4
 * - remove common stopwords
 * - count frequency
 * This is deterministic and good enough to drive UI graphs.
 */
const STOP = new Set([
    "this", "that", "with", "from", "into", "your", "youre", "have", "will", "then", "than", "also", "just",
    "make", "build", "create", "generate", "convert", "write", "explain", "optimize", "reasoning",
    "what", "when", "where", "which", "would", "should", "could", "about", "under", "over", "most",
    "must", "need", "want", "like", "used", "uses", "using", "each", "every", "more", "less", "some",
    "only", "very", "them", "they", "their", "there", "here", "been", "were", "been", "does", "did"
]);

function extractConceptTokens(a: KnowledgeArtifact): string[] {
    const text = normalize(
        [
            a.userGoal,
            a.responseSummary,
            ...a.facts,
            ...a.assumptions,
            ...a.uncertainties,
            ...a.memory.persist
        ].join(" ")
    );

    const tokens = text
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 4)
        .filter((t) => !STOP.has(t));

    // Unique tokens per artifact so one big paragraph doesn't overcount
    return Array.from(new Set(tokens)).slice(0, 50);
}

function topN(map: Map<string, number>, n: number) {
    return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([key, count]) => ({ key, count }));
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const abs = path.resolve(args.file);

    if (!fs.existsSync(abs)) {
        console.error(`File not found: ${abs}`);
        process.exit(1);
    }

    const raw = fs.readFileSync(abs, "utf8");
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

    let scanned = 0;
    let parsedCount = 0;
    let included = 0;

    const byOperator = new Map<string, number>();
    const byDay = new Map<string, number>();
    const byConcept = new Map<string, number>();

    for (const line of lines) {
        scanned++;
        let art: KnowledgeArtifact | null = null;
        try {
            art = KnowledgeArtifactSchema.parse(JSON.parse(line));
            parsedCount++;
        } catch {
            continue;
        }

        if (!inRange(art.createdAt, args.since, args.until)) continue;
        included++;

        // day
        const day = ymdFromIso(art.createdAt);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);

        // operators
        for (const op of art.operatorsUsed) {
            byOperator.set(op, (byOperator.get(op) ?? 0) + 1);
        }

        // concepts (tokens)
        for (const c of extractConceptTokens(art)) {
            byConcept.set(c, (byConcept.get(c) ?? 0) + 1);
        }
    }

    const out = {
        schema: { name: "brain.memory.stats", version: "1.0.0" },
        file: path.relative(process.cwd(), abs).split(path.sep).join("/"),
        filters: {
            since: args.since ?? null,
            until: args.until ?? null,
            top: args.top
        },
        meta: { scannedLines: scanned, parsedArtifacts: parsedCount, includedArtifacts: included },
        counts: {
            totalArtifacts: included,
            byDay: topN(byDay, 10_000), // keep all days; UI can trim
            topOperators: topN(byOperator, args.top),
            topConcepts: topN(byConcept, args.top)
        }
    };

    if (args.jsonl) {
        // Stream stats as newline-delimited JSON
        // Meta + counts each on separate line for real-time processing
        process.stdout.write(JSON.stringify({ schema: out.schema, meta: out.meta, counts: {} }) + "\n");
        for (const op of out.counts.topOperators) {
            process.stdout.write(JSON.stringify({ type: "operator", ...op }) + "\n");
        }
        for (const concept of out.counts.topConcepts) {
            process.stdout.write(JSON.stringify({ type: "concept", ...concept }) + "\n");
        }
        for (const day of out.counts.byDay) {
            process.stdout.write(JSON.stringify({ type: "day", ...day }) + "\n");
        }
        return;
    }

    if (args.json) {
        process.stdout.write(JSON.stringify(out, null, 2) + "\n");
        return;
    }

    // human output
    console.log(`file: ${out.file}`);
    console.log(`includedArtifacts: ${included}`);
    console.log("\nTop operators:");
    for (const r of out.counts.topOperators) console.log(`  ${r.count}  ${r.key}`);
    console.log("\nTop concepts:");
    for (const r of out.counts.topConcepts) console.log(`  ${r.count}  ${r.key}`);
    console.log("\nBy day:");
    for (const r of out.counts.byDay) console.log(`  ${r.count}  ${r.key}`);
}

main();
