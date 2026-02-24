import fs from "node:fs";
import path from "node:path";
import { parseLexiconEntryFile } from "./LexiconEntry.schema.js";

function readJson(filePath: string): unknown {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
}

function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("Usage: pnpm tsx validate-lexicon.ts <path-to-json> [...more]");
        process.exit(2);
    }

    let failed = 0;

    for (const p of args) {
        const abs = path.resolve(p);
        try {
            const json = readJson(abs);
            parseLexiconEntryFile(json);
            console.log(`✅ valid: ${p}`);
        } catch (err: any) {
            failed++;
            console.error(`❌ invalid: ${p}`);
            if (err?.issues) {
                for (const issue of err.issues) {
                    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
                }
            } else {
                console.error(`  - ${String(err?.message ?? err)}`);
            }
        }
    }

    process.exit(failed === 0 ? 0 : 1);
}

main();
