// server/artifacts.ts
// Artifact bundling with deterministic hashing and canonical sort keys

import { buildCanonicalSortKey, governMultiParagraph } from "@world-engine/world-editor-shared";
import fs from "node:fs/promises";
import path from "node:path";
import type { Json } from "../src/shared/stable.js";
import { sha256Hex, stableStringify } from "../src/shared/stable.js";
import type { HashChainedLedger } from "./ledger.js";

function utcNowIso(): string {
  return new Date().toISOString();
}

function safeStamp(iso: string): string {
  // windows-safe filename: replace colons and dots with dashes
  return iso.replace(/[:.]/g, "-");
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

export interface ArtifactSaveInput {
  docId: string;
  title: string;
  html: string;
  text: string; // plain text snapshot from editor
}

export interface ArtifactSaveOutput {
  artifact_id: string;
  doc_id: string;
  created_at_utc: string;

  sort_key: string;
  tie_break: string;

  html_sha256: string;
  text_sha256: string;
  manifest_sha256: string;

  artifact_dir: string;
  ledger_seq: number;
  ledger_entry_hash: string;
}

export async function saveArtifactBundle(params: {
  rootDir: string; // ".world"
  input: ArtifactSaveInput;
  ledger: HashChainedLedger;
}): Promise<ArtifactSaveOutput> {
  const { rootDir, input, ledger } = params;

  const created_at_utc = utcNowIso();
  const governed_text = governMultiParagraph(input.text);

  // Canonical indexing key: title + first slice of governed text
  const { key: sort_key, tie: tie_break } = buildCanonicalSortKey(
    [input.title, governed_text.slice(0, 256)],
    input.docId
  );

  const html_sha256 = sha256Hex(input.html);
  const text_sha256 = sha256Hex(governed_text);

  // Artifact id is deterministic over the canonical manifest content.
  // If content changes, artifact id changes.
  const manifestCore: Json = {
    doc_id: input.docId,
    title: input.title,
    created_at_utc, // timestamp makes this a snapshot artifact (intentional)
    sort_key,
    tie_break,
    payload: {
      html_sha256,
      text_sha256
    }
  };

  const manifest_sha256 = sha256Hex(stableStringify(manifestCore));
  const artifact_id = manifest_sha256;

  const artifactsRoot = path.join(rootDir, "artifacts");
  const dir = path.join(artifactsRoot, input.docId, `${safeStamp(created_at_utc)}_${artifact_id}`);
  await ensureDir(dir);

  const manifest: Json = {
    ...manifestCore,
    artifact_id,
    payload: {
      html_sha256,
      text_sha256,
      governed_text_preview: governed_text.slice(0, 512)
    }
  };

  await fs.writeFile(path.join(dir, "artifact.json"), stableStringify(manifest) + "\n", "utf8");
  await fs.writeFile(path.join(dir, "content.html"), input.html, "utf8");
  await fs.writeFile(path.join(dir, "content.txt"), governed_text, "utf8");

  // Update "latest.json" pointer per doc
  const latestPath = path.join(artifactsRoot, input.docId, "latest.json");
  await fs.writeFile(
    latestPath,
    stableStringify({
      doc_id: input.docId,
      artifact_id,
      created_at_utc,
      path: dir
    }) + "\n",
    "utf8"
  );

  // Ledger append
  const entry = await ledger.append({
    type: "artifact.write",
    doc_id: input.docId,
    artifact_id,
    payload: {
      title: input.title,
      sort_key,
      tie_break,
      html_sha256,
      text_sha256,
      artifact_dir: dir
    }
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
    ledger_entry_hash: entry.entry_hash
  };
}
