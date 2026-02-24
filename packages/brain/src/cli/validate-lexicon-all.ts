import { LexiconEntryFileSchema } from "@world-engine/engine/contracts/lexicon";
import fs from "node:fs";
import path from "node:path";

function usage(): never {
    console.error(
        [
            "Usage:",
            "  pnpm tsx packages/brain/src/cli/validate-lexicon-all.ts <entriesDir>",
            "",
            "Example:",
            "  pnpm tsx packages/brain/src/cli/validate-lexicon-all.ts docs/lexicon/entries"
        ].join("\n")
    );
    process.exit(2);
}

function findFiles(dirAbs: string, suffix: string): string[] {
    const out: string[] = [];
    if (!fs.existsSync(dirAbs)) return out;

    const walk = (d: string) => {
        for (const name of fs.readdirSync(d)) {
            const p = path.join(d, name);
            const st = fs.statSync(p);
            if (st.isDirectory()) walk(p);
            else if (st.isFile() && p.endsWith(suffix)) out.push(p);
        }
    };

    walk(dirAbs);
    return out;
}

function main() {
    const [entriesDir] = process.argv.slice(2);
    if (!entriesDir) usage();

    const absDir = path.resolve(entriesDir);
    const files = findFiles(absDir, ".lexicon.json");

    if (files.length === 0) {
        console.error(`No *.lexicon.json files found under: ${absDir}`);
        process.exit(1);
    }

    let failed = 0;
    const tagToFile = new Map<string, string>();

    for (const fp of files) {
        const rel = path.relative(process.cwd(), fp).split(path.sep).join("/");
        try {
            const raw = fs.readFileSync(fp, "utf8");
            const json = JSON.parse(raw);
            const parsed = LexiconEntryFileSchema.parse(json);

            const tag = parsed.entry.process_tag;
            const prev = tagToFile.get(tag);
            if (prev) {
                failed++;
                console.error(`❌ duplicate process_tag: ${tag}`);
                console.error(`   - ${prev}`);
                console.error(`   - ${rel}`);
                continue;
            }
            tagToFile.set(tag, rel);

            console.log(`✅ valid: ${rel}`);
        } catch (err: any) {
            failed++;
            console.error(`❌ invalid: ${rel}`);
            if (err?.issues) {
                for (const issue of err.issues) {
                    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
                }
            } else {
                console.error(`  - ${String(err?.message ?? err)}`);
            }
        }
    }

    if (failed > 0) {
        console.error(`\n❌ validate-all failed: ${failed} file(s) invalid or duplicated.`);
        process.exit(1);
    }

    console.log(`\n✅ validate-all success: ${files.length} entries`);
}

main();
