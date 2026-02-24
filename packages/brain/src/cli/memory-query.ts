import fs from "node:fs";
import path from "node:path";
import { KnowledgeArtifactSchema, type KnowledgeArtifact } from "../thought/thoughtTypes";

type Args = {
    file: string;
    contains?: string;
    operator?: string;
    concept?: string;
    since?: string; // YYYY-MM-DD
    until?: string; // YYYY-MM-DD
    limit: number;
    json: boolean;
    jsonl: boolean; // streaming NDJSON output
};

function usage(): never {
    console.error(
        [
            "Usage:",
            "  pnpm tsx packages/brain/src/cli/memory-query.ts --file <ndjson> [--contains <text>] [--operator <process_tag>] [--concept <text>] [--since <YYYY-MM-DD>] [--until <YYYY-MM-DD>] [--limit N] [--json|--jsonl]",
            "",
            "Examples:",
            "  pnpm tsx packages/brain/src/cli/memory-query.ts --file .brain/memory/knowledge.ndjson --operator prompt.operator.decision",
            "  pnpm tsx packages/brain/src/cli/memory-query.ts --file .brain/memory/knowledge.ndjson --contains \"WebGPU\" --limit 20 --json",
            "  pnpm tsx packages/brain/src/cli/memory-query.ts --file .brain/memory/knowledge.ndjson --contains \"webgpu\" --jsonl (stream results line by line)",
            "  pnpm tsx packages/brain/src/cli/memory-query.ts --file .brain/memory/knowledge.ndjson --since 2026-02-01 --until 2026-02-12"
        ].join("\n")
    );
    process.exit(2);
}

function parseArgs(argv: string[]): Args {
    const a: Partial<Args> = { limit: 50, json: false, jsonl: false };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        const v = argv[i + 1];
        if (k === "--file") { a.file = v; i++; continue; }
        if (k === "--contains") { a.contains = v; i++; continue; }
        if (k === "--operator") { a.operator = v; i++; continue; }
        if (k === "--concept") { a.concept = v; i++; continue; }
        if (k === "--since") { a.since = v; i++; continue; }
        if (k === "--until") { a.until = v; i++; continue; }
        if (k === "--limit") { a.limit = Number(v); i++; continue; }
        if (k === "--json") { a.json = true; continue; }
        if (k === "--jsonl") { a.jsonl = true; continue; }
    }
    if (!a.file) usage();
    if (!Number.isFinite(a.limit!) || (a.limit as number) <= 0) a.limit = 50;
    return a as Args;
}

function normalize(s: string): string {
    return s.toLowerCase();
}

function artifactText(a: KnowledgeArtifact): string {
    const parts: string[] = [
        a.userGoal,
        a.decision,
        a.responseSummary,
        ...a.facts,
        ...a.assumptions,
        ...a.uncertainties,
        ...a.constraints,
        ...a.tradeoffPriority,
        ...a.acceptanceTestsOrMetrics,
        ...a.memory.persist,
        ...a.memory.ephemeral
    ];
    return normalize(parts.join("\n"));
}

function dateStartIso(ymd: string): string {
    // normalize to UTC day start
    return new Date(`${ymd}T00:00:00.000Z`).toISOString();
}

function dateEndIso(ymd: string): string {
    // inclusive end of day -> next day start exclusive
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

type QueryResult = {
    id: string;
    createdAt: string;
    selectedReasoningMode: string;
    operatorsUsed: string[];
    userGoal: string;
    responseSummary: string;
};

function toQueryResult(a: KnowledgeArtifact): QueryResult {
    return {
        id: a.id,
        createdAt: a.createdAt,
        selectedReasoningMode: a.selectedReasoningMode,
        operatorsUsed: a.operatorsUsed,
        userGoal: a.userGoal,
        responseSummary: a.responseSummary
    };
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

    const results: KnowledgeArtifact[] = [];
    let scanned = 0;
    let parsedCount = 0;

    for (const line of lines) {
        scanned++;
        let parsed: KnowledgeArtifact | null = null;
        try {
            parsed = KnowledgeArtifactSchema.parse(JSON.parse(line));
            parsedCount++;
        } catch {
            continue; // ignore bad lines
        }

        if (!inRange(parsed.createdAt, args.since, args.until)) continue;

        if (args.operator && !parsed.operatorsUsed.includes(args.operator)) continue;

        const text = artifactText(parsed);

        if (args.contains && !text.includes(normalize(args.contains))) continue;

        if (args.concept && !text.includes(normalize(args.concept))) continue;

        results.push(parsed);
        if (results.length >= args.limit) break;
    }

    if (args.jsonl) {
        // Stream results as newline-delimited JSON (one result per line)
        for (const r of results) {
            const result = toQueryResult(r);
            process.stdout.write(JSON.stringify(result) + "\n");
        }
        return;
    }

    if (args.json) {
        const out = {
            schema: { name: "brain.memory.query_result", version: "1.0.0" },
            file: path.relative(process.cwd(), abs).split(path.sep).join("/"),
            filters: {
                contains: args.contains ?? null,
                operator: args.operator ?? null,
                concept: args.concept ?? null,
                since: args.since ?? null,
                until: args.until ?? null,
                limit: args.limit
            },
            meta: { scannedLines: scanned, parsedArtifacts: parsedCount, returned: results.length },
            results: results.map(toQueryResult)
        };
        process.stdout.write(JSON.stringify(out, null, 2) + "\n");
        return;
    }

    if (results.length === 0) {
        console.log("No matches.");
        return;
    }

    for (const r of results) {
        console.log("------------------------------------------------------------");
        console.log(`id: ${r.id}`);
        console.log(`createdAt: ${r.createdAt}`);
        console.log(`mode: ${r.selectedReasoningMode}`);
        console.log(`operators: ${r.operatorsUsed.join(", ")}`);
        console.log(`goal: ${r.userGoal}`);
        console.log(`summary: ${r.responseSummary}`);
    }
    console.log("------------------------------------------------------------");
    console.log(`✅ matches: ${results.length}`);
}

main();
