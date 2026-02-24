#!/usr/bin/env node
import path from "node:path";
import { promoteReviewItem } from "../review/reviewStore";

type Args = {
    id: string;
    approve: boolean;
    reject: boolean;
    reason: string;
    reviewer: string;
    queueFile: string;
    decisionsFile: string;
    memoryFile: string;
    lexiconEntriesDir: string;
    lexiconIndexFile: string;
};

function getArg(name: string, argv: string[]) {
    const idx = argv.indexOf(name);
    if (idx < 0) return null;
    const v = argv[idx + 1];
    if (!v) throw new Error(`Missing value for ${name}`);
    return v;
}

function hasFlag(name: string, argv: string[]) {
    return argv.includes(name);
}

function parseArgs(argv: string[]): Args {
    const id = getArg("--id", argv);
    if (!id) throw new Error("Missing --id");

    const approve = hasFlag("--approve", argv);
    const reject = hasFlag("--reject", argv);
    if (approve === reject) throw new Error("Specify exactly one: --approve or --reject");

    const reason = getArg("--reason", argv) ?? "No reason provided";
    const reviewer = getArg("--reviewer", argv) ?? "system";

    const queueFile = getArg("--queue-file", argv) ?? ".brain/review/review.queue.ndjson";
    const decisionsFile = getArg("--decisions-file", argv) ?? ".brain/review/review.decisions.ndjson";
    const memoryFile = getArg("--memory-file", argv) ?? ".brain/memory/knowledge.ndjson";
    const lexiconEntriesDir = getArg("--lexicon-entries-dir", argv) ?? "docs/lexicon/entries";
    const lexiconIndexFile = getArg("--lexicon-index-file", argv) ?? "docs/lexicon/lexicon.index.json";

    return {
        id,
        approve,
        reject,
        reason,
        reviewer,
        queueFile,
        decisionsFile,
        memoryFile,
        lexiconEntriesDir,
        lexiconIndexFile,
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const decision = args.approve ? "approve" : "reject";

    const res = await promoteReviewItem({
        opts: {
            queueFile: path.resolve(process.cwd(), args.queueFile),
            decisionsFile: path.resolve(process.cwd(), args.decisionsFile),
            memoryFile: path.resolve(process.cwd(), args.memoryFile),
            lexiconEntriesDir: path.resolve(process.cwd(), args.lexiconEntriesDir),
            lexiconIndexFile: path.resolve(process.cwd(), args.lexiconIndexFile),
        },
        id: args.id,
        decision,
        reviewer: args.reviewer,
        reason: args.reason,
    });

    process.stdout.write(JSON.stringify(res.decision, null, 2) + "\n");
}

main().catch((err) => {
    console.error(err?.stack || err?.message || String(err));
    process.exit(1);
});
