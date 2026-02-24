import crypto from "node:crypto";
import fssync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { NodeHashTools } from "@world-engine/tooling";
import type {
    KnowledgeArtifact,
    LexiconEntry,
    ReviewDecision,
    ReviewQueueItem,
} from "./reviewTypes";
import {
    KnowledgeArtifactSchema,
    LexiconEntrySchema,
    ReviewDecisionSchema,
    ReviewQueueItemSchema,
} from "./reviewTypes";

export type ReviewPromoteOptions = {
    queueFile: string; // .brain/review/review.queue.ndjson
    decisionsFile: string; // .brain/review/review.decisions.ndjson
    memoryFile: string; // .brain/memory/knowledge.ndjson
    lexiconEntriesDir: string; // docs/lexicon/entries
    lexiconIndexFile: string; // docs/lexicon/lexicon.index.json
};

export type PromoteResult = {
    decision: ReviewDecision;
};

async function ensureDir(p: string) {
    await fs.mkdir(p, { recursive: true });
}

async function readNdjson(file: string): Promise<any[]> {
    if (!fssync.existsSync(file)) return [];
    const txt = await fs.readFile(file, "utf8");
    const lines = txt.split("\n").map((l) => l.trim()).filter(Boolean);
    return lines.map((l) => JSON.parse(l));
}

async function writeFileAtomic(file: string, content: string) {
    await ensureDir(path.dirname(file));
    const tmp = `${file}.tmp.${crypto.randomUUID()}`;
    await fs.writeFile(tmp, content, "utf8");
    await fs.rename(tmp, file);
}

async function appendNdjson(file: string, obj: any) {
    await ensureDir(path.dirname(file));
    const line = JSON.stringify(obj) + "\n";
    await fs.appendFile(file, line, "utf8");
}

export async function loadQueue(opts: ReviewPromoteOptions): Promise<ReviewQueueItem[]> {
    const raw = await readNdjson(opts.queueFile);
    return raw.map((r) => ReviewQueueItemSchema.parse(r));
}

export async function loadQueueItemById(opts: ReviewPromoteOptions, id: string): Promise<ReviewQueueItem | null> {
    const items = await loadQueue(opts);
    return items.find((x) => x.id === id) ?? null;
}

export async function promoteReviewItem(params: {
    opts: ReviewPromoteOptions;
    id: string;
    decision: "approve" | "reject";
    reviewer: string;
    reason: string;
}): Promise<PromoteResult> {
    const { opts, id, decision, reviewer, reason } = params;

    const items = await loadQueue(opts);
    const idx = items.findIndex((x) => x.id === id);
    if (idx < 0) throw new Error(`Review item not found: ${id}`);

    const item = items[idx];
    if (!item) throw new Error(`Item at index ${idx} is undefined`);
    if (item.status !== "pending") {
        throw new Error(`Item is not pending (status=${item.status}). Refusing to change history.`);
    }

    // Effects toggles
    let wroteMemory = false;
    let wroteLexiconEntry = false;
    let rebuiltLexiconIndex = false;

    // Apply decision effects (only on approve)
    if (decision === "approve") {
        // Convention: payload may contain either { artifact } or { lexiconEntry }
        const payload: any = item?.payload ?? {};

        if (payload?.artifact) {
            const artifact: KnowledgeArtifact = KnowledgeArtifactSchema.parse(payload.artifact);
            await appendNdjson(opts.memoryFile, { ...artifact, status: "canonical" });
            wroteMemory = true;
        }

        if (payload?.lexiconEntry) {
            const entry: LexiconEntry = LexiconEntrySchema.parse(payload.lexiconEntry);
            await ensureDir(opts.lexiconEntriesDir);
            const outFile = path.join(opts.lexiconEntriesDir, `${entry.id}.lexicon.json`);
            await fs.writeFile(outFile, JSON.stringify(entry, null, 2) + "\n", "utf8");
            wroteLexiconEntry = true;

            // Rebuild lexicon index deterministically from entries dir
            const index = await rebuildLexiconIndex(opts.lexiconEntriesDir);
            await writeFileAtomic(opts.lexiconIndexFile, JSON.stringify(index, null, 2) + "\n");
            rebuiltLexiconIndex = true;
        }
    }

    // Update queue item status
    const updated: ReviewQueueItem = {
        ...(item || {}),
        id: item?.id || id,
        status: decision === "approve" ? "approved" : "rejected",
        kind: item?.kind,
        schemaVersion: item?.schemaVersion ?? "1.0.0",
        reason: reason || item?.reason || "",
        createdAt: item?.createdAt || new Date().toISOString(),
        payload: item?.payload,
    };
    items[idx] = updated;

    // Rewrite queue file atomically
    const queueContent = items.map((x) => JSON.stringify(x)).join("\n") + "\n";
    await writeFileAtomic(opts.queueFile, queueContent);

    // Decision record (append-only)
    const decidedAt = new Date().toISOString();
    const decisionId = `dec_${NodeHashTools.sha256(`${id}:${decidedAt}:${reviewer}:${decision}`, { prefixLen: 12 })}`;

    const decisionRecord: ReviewDecision = ReviewDecisionSchema.parse({
        schemaVersion: "1.0.0",
        decisionId,
        itemId: id,
        decidedAt,
        decision,
        reviewer,
        reason,
        effects: {
            wroteMemory,
            wroteLexiconEntry,
            rebuiltLexiconIndex,
            updatedQueue: true,
        },
    });

    await appendNdjson(opts.decisionsFile, decisionRecord);

    return { decision: decisionRecord };
}

export async function rebuildLexiconIndex(lexiconEntriesDir: string): Promise<{
    schemaVersion: "1.0.0";
    generatedAt: string;
    entries: { id: string; canonicalTerm: string; code_process_tag: string; type: string; file: string }[];
    contentHash: string;
}> {
    await ensureDir(lexiconEntriesDir);
    const files = (await fs.readdir(lexiconEntriesDir)).filter((f) => f.endsWith(".lexicon.json")).sort();

    const entries: { id: string; canonicalTerm: string; code_process_tag: string; type: string; file: string }[] = [];

    for (const f of files) {
        const full = path.join(lexiconEntriesDir, f);
        const raw = JSON.parse(await fs.readFile(full, "utf8"));
        const e = LexiconEntrySchema.parse(raw);

        entries.push({
            id: e.id,
            canonicalTerm: e.canonicalTerm,
            code_process_tag: e.code_process_tag,
            type: e.type,
            file: `docs/lexicon/entries/${f}`,
        });
    }

    const contentHash = NodeHashTools.sha256(JSON.stringify(entries));
    return {
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        entries,
        contentHash,
    };
}
