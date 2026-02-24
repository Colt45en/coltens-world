import { LexiconEntryFileSchema } from "@world-engine/engine/contracts/lexicon";
import fs from "node:fs";
import path from "node:path";
import { LexiconIndexSchema } from "../lexicon/lexiconIndex.schema";

function usage(): never {
    console.error(
        [
            "Usage:",
            "  pnpm tsx packages/brain/src/cli/lexicon-index.ts <entriesDir> <outFile>",
            "",
            "Example:",
            "  pnpm tsx packages/brain/src/cli/lexicon-index.ts docs/lexicon/entries docs/lexicon/lexicon.index.json"
        ].join("\n")
    );
    process.exit(2);
}

function listLexiconFiles(dirAbs: string): string[] {
    if (!fs.existsSync(dirAbs)) return [];
    const files = fs.readdirSync(dirAbs).filter((f) => f.endsWith(".lexicon.json"));
    return files.map((f) => path.join(dirAbs, f));
}

function main() {
    const [entriesDir, outFile] = process.argv.slice(2);
    if (!entriesDir || !outFile) usage();

    const absEntries = path.resolve(entriesDir);
    const absOut = path.resolve(outFile);

    const files = listLexiconFiles(absEntries);
    if (files.length === 0) {
        console.error(`No *.lexicon.json files found in: ${absEntries}`);
        process.exit(1);
    }

    const entries = files.map((fp) => {
        const raw = fs.readFileSync(fp, "utf8");
        const json = JSON.parse(raw);
        const parsed = LexiconEntryFileSchema.parse(json);

        // store relative file path for portability
        const relFile = path
            .relative(path.dirname(absOut), fp)
            .split(path.sep)
            .join("/");

        return {
            process_tag: parsed.entry.process_tag,
            term: parsed.entry.term,
            canonical_term: parsed.entry.canonical_term,
            type: parsed.entry.type,
            operator_class: parsed.entry.operator_class,
            file: relFile
        };
    });

    // stable sort
    entries.sort((a, b) => a.process_tag.localeCompare(b.process_tag));

    // detect duplicates
    const seen = new Set<string>();
    for (const e of entries) {
        if (seen.has(e.process_tag)) {
            console.error(`Duplicate process_tag in index build: ${e.process_tag}`);
            process.exit(1);
        }
        seen.add(e.process_tag);
    }

    const indexDoc = LexiconIndexSchema.parse({
        schema: { name: "ai_prompt_lexicon.index", version: "1.0.0" },
        generatedAt: new Date().toISOString(),
        rootDir: path
            .relative(path.dirname(absOut), absEntries)
            .split(path.sep)
            .join("/"),
        entries
    });

    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    fs.writeFileSync(absOut, JSON.stringify(indexDoc, null, 2) + "\n", "utf8");

    console.log(`✅ lexicon index built: ${outFile}`);
    console.log(`   entries: ${entries.length}`);
}

main();
