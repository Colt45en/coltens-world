import fs from "node:fs";
import path from "node:path";
import { ChainLinkSchema, MemoryChainSchema, type ChainLink, type MemoryChain } from "../thought/memoryChain.schema";
import { KnowledgeArtifactSchema, type KnowledgeArtifact } from "../thought/thoughtTypes";

type Args = {
    file: string;
    concept: string;
    json: boolean;
    jsonl: boolean;
};

function usage(): never {
    console.error(
        [
            "Usage:",
            "  pnpm tsx packages/brain/src/cli/memory-chain.ts --file <ndjson> --concept <word> [--json|--jsonl]",
            "",
            "Examples:",
            "  pnpm tsx packages/brain/src/cli/memory-chain.ts --file .brain/memory/knowledge.ndjson --concept webgpu",
            "  pnpm tsx packages/brain/src/cli/memory-chain.ts --file .brain/memory/knowledge.ndjson --concept webgpu --json",
            "  pnpm tsx packages/brain/src/cli/memory-chain.ts --file .brain/memory/knowledge.ndjson --concept performance --jsonl"
        ].join("\n")
    );
    process.exit(2);
}

function parseArgs(argv: string[]): Args {
    const a: Partial<Args> = { json: false, jsonl: false };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        const v = argv[i + 1];
        if (k === "--file") { if (v) { a.file = v; i++; } continue; }
        if (k === "--concept") { if (v) { a.concept = v; i++; } continue; }
        if (k === "--json") { a.json = true; continue; }
        if (k === "--jsonl") { a.jsonl = true; continue; }
    }
    if (!a.file || !a.concept) usage();
    return a as Args;
}

function normalize(s: string): string {
    return s.toLowerCase();
}

/**
 * Find where concept appears in artifact.
 * Returns the text snippet where it was mentioned.
 */
function findMention(concept: string, artifact: KnowledgeArtifact): string | null {
    const norm = normalize(concept);
    const texts = [
        artifact.userGoal,
        artifact.decision,
        artifact.responseSummary,
        ...artifact.facts,
        ...artifact.assumptions,
        ...artifact.memory.persist
    ];

    for (const t of texts) {
        if (normalize(t).includes(norm)) {
            return t.slice(0, 100); // snippet
        }
    }
    return null;
}

/**
 * Infer belief before/after from artifact facts and assumptions.
 */
function extractBelief(artifact: KnowledgeArtifact): { before: string[]; after: string[] } {
    // Heuristic: assumptions are "before", facts are "after"
    return {
        before: artifact.assumptions.slice(0, 2),
        after: artifact.facts.slice(0, 2)
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

    const links: ChainLink[] = [];
    let firstMention: string | null = null;
    let lastMention: string | null = null;

    for (const line of lines) {
        let artifact: KnowledgeArtifact | null = null;
        try {
            artifact = KnowledgeArtifactSchema.parse(JSON.parse(line));
        } catch {
            continue;
        }

        const mention = findMention(args.concept, artifact);
        if (!mention) continue;

        if (!firstMention) firstMention = artifact.createdAt;
        lastMention = artifact.createdAt;

        const belief = extractBelief(artifact);
        const link = ChainLinkSchema.parse({
            artifactId: artifact.id,
            createdAt: artifact.createdAt,
            concept: args.concept,
            mention,
            reasoningMode: artifact.selectedReasoningMode,
            decision: artifact.decision.slice(0, 80),
            outcome: artifact.responseSummary.slice(0, 80),
            beliefBefore: belief.before,
            beliefAfter: belief.after,
            confidence: Math.min(0.95, 0.5 + artifact.facts.length * 0.1) // rough heuristic
        });

        links.push(link);
    }

    if (links.length === 0) {
        console.error(`No mentions of "${args.concept}" found.`);
        process.exit(1);
    }

    // Build evolution summary
    const beliefEvolution = [
        `Concept "${args.concept}" mentioned ${links.length} times`,
        `First: ${firstMention}`,
        `Last: ${lastMention}`,
        `Reasoning modes: ${Array.from(new Set(links.map((l) => l.reasoningMode))).join(", ")}`,
        `Confidence increased from ${(links[0]!.confidence * 100).toFixed(0)}% to ${(links[links.length - 1]!.confidence * 100).toFixed(0)}%`
    ];

    const chain: MemoryChain = MemoryChainSchema.parse({
        concept: args.concept,
        firstMention: firstMention!,
        lastMention: lastMention!,
        chainLength: links.length,
        links,
        beliefEvolution
    });

    if (args.jsonl) {
        // Stream chain links
        for (const link of chain.links) {
            process.stdout.write(JSON.stringify(link) + "\n");
        }
        return;
    }

    if (args.json) {
        process.stdout.write(JSON.stringify(chain, null, 2) + "\n");
        return;
    }

    // Human output
    console.log(`\n📊 Memory Chain for "${args.concept}"\n`);
    console.log(`Length: ${chain.chainLength} mentions`);
    console.log(`Timeline: ${chain.firstMention} → ${chain.lastMention}\n`);

    for (const line of chain.beliefEvolution) {
        console.log(`  ${line}`);
    }

    console.log(`\n${"─".repeat(80)}`);
    for (const link of chain.links) {
        console.log(`\n[${chain.links.indexOf(link) + 1}] ${link.createdAt}`);
        console.log(`    Artifact: ${link.artifactId}`);
        console.log(`    Mention: "${link.mention}"`);
        console.log(`    Reasoning: ${link.reasoningMode}`);
        console.log(`    Outcome: ${link.outcome}`);
        console.log(`    Confidence: ${(link.confidence * 100).toFixed(0)}%`);
    }

    console.log(`\n${"─".repeat(80)}`);
    console.log(`✅ Chain complete: ${chain.chainLength} links traced\n`);
}

main();
