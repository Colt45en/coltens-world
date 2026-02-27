import type { ArtifactLatest, ArtifactReadResponse, ArtifactSaveResponse } from "@world-engine/engine/contracts/artifacts";
import type { HashChainedLedger, Json } from "@world-engine/ledger";
import { sha256Hex, stableStringify } from "@world-engine/ledger";
import fs from "node:fs/promises";
import path from "node:path";
import { buildCanonicalSortKey } from "./canon";
import { governMultiParagraph } from "./governor";

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

function safeStamp(iso: string): string {
  // Windows-safe filename: replace colons and dots with dashes
  return iso.replace(/[:.]/g, "-");
}

export interface ArtifactSaveInput {
  docId: string;
  title: string;
  html: string;
  text: string;
  meta?: Json;
}

export class ArtifactStore {
  private rootDir: string;
  private ledger: HashChainedLedger;

  constructor(params: { rootDir: string; ledger: HashChainedLedger }) {
    this.rootDir = params.rootDir;
    this.ledger = params.ledger;
  }

  async save(input: ArtifactSaveInput): Promise<ArtifactSaveResponse> {
    const created_at_utc = new Date().toISOString();

    // Boundary enforcement: deterministic text normalization
    const governed_text = governMultiParagraph(input.text);

    // Canonical indexing key: deterministic sorting
    const { key: sort_key, tie: tie_break } = buildCanonicalSortKey(
      [input.title, governed_text.slice(0, 256)],
      input.docId
    );

    const html_sha256 = sha256Hex(input.html);
    const text_sha256 = sha256Hex(governed_text);

    // Snapshot manifest core (timestamped artifact)
    const manifestCore: Json = {
      doc_id: input.docId,
      title: input.title,
      created_at_utc,
      sort_key,
      tie_break,
      meta: (input.meta ?? null) as Json,
      payload: {
        html_sha256,
        text_sha256,
      },
    };

    const manifest_sha256 = sha256Hex(stableStringify(manifestCore));
    const artifact_id = manifest_sha256;

    const artifactsRoot = path.join(this.rootDir, "artifacts");
    const dir = path.join(artifactsRoot, input.docId, `${safeStamp(created_at_utc)}_${artifact_id}`);
    await ensureDir(dir);

    const manifest: Json = {
      ...manifestCore,
      artifact_id,
      payload: {
        html_sha256,
        text_sha256,
        governed_text_preview: governed_text.slice(0, 512),
      },
    };

    // Write bundle
    await fs.writeFile(path.join(dir, "artifact.json"), stableStringify(manifest) + "\n", "utf8");
    await fs.writeFile(path.join(dir, "content.html"), input.html, "utf8");
    await fs.writeFile(path.join(dir, "content.txt"), governed_text, "utf8");

    // Latest pointer per doc
    const latestPath = path.join(artifactsRoot, input.docId, "latest.json");
    await ensureDir(path.dirname(latestPath));
    await fs.writeFile(
      latestPath,
      stableStringify({
        doc_id: input.docId,
        artifact_id,
        created_at_utc,
        path: dir,
      }) + "\n",
      "utf8"
    );

    // Ledger hook: append event
    const entry = await this.ledger.append({
      type: "artifact.write",
      doc_id: input.docId,
      artifact_id,
      payload: {
        title: input.title,
        sort_key,
        tie_break,
        html_sha256,
        text_sha256,
        artifact_dir: dir,
      },
    });

    return {
      artifact_id,
      doc_id: input.docId,
      created_at_utc,
      sort_key,
      tie_break,
      html_sha256,
      text_sha256,
      manifest_sha256,
      artifact_dir: dir,
      ledger_seq: entry.seq,
      ledger_entry_hash: entry.entry_hash,
    };
  }

  async readLatest(docId: string): Promise<ArtifactLatest | null> {
    const p = path.join(this.rootDir, "artifacts", docId, "latest.json");
    try {
      const txt = await fs.readFile(p, "utf8");
      return JSON.parse(txt) as ArtifactLatest;
    } catch {
      return null;
    }
  }

  async readArtifact(docId: string, artifactId: string): Promise<ArtifactReadResponse | null> {
    const artifactsRoot = path.join(this.rootDir, "artifacts", docId);
    // Naive scan: safe + simple
    const dirs = await fs.readdir(artifactsRoot).catch(() => []);
    const match = dirs.find((d) => d.endsWith(`_${artifactId}`));
    if (!match) return null;

    const dir = path.join(artifactsRoot, match);
    try {
      const manifest = JSON.parse(await fs.readFile(path.join(dir, "artifact.json"), "utf8")) as Json;
      const html = await fs.readFile(path.join(dir, "content.html"), "utf8");
      const text = await fs.readFile(path.join(dir, "content.txt"), "utf8");
      return { manifest, html, text };
    } catch {
      return null;
    }
  }
}
