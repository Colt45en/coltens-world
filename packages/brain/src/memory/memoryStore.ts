import fs from "node:fs";
import path from "node:path";
import type { KnowledgeArtifact } from "../thought/thoughtTypes";

export function appendArtifactNdjson(filePath: string, artifact: KnowledgeArtifact) {
    const abs = path.resolve(filePath);
    const line = JSON.stringify(artifact) + "\n";
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.appendFileSync(abs, line, "utf8");
}
