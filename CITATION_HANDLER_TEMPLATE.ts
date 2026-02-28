import { createHash } from "node:crypto";

/**
 * Example Nucleus handlers for citation tool-calls
 *
 * Drop-in template for apps/nucleus/src/routes/citations.ts
 * Demonstrates deterministic contract validation + ledger append
 *
 * Note: This file is a reference implementation showing:
 * - How to import citation contracts from @we/contracts/citation
 * - Canonical JSON + SHA-256 deterministic hashing
 * - 3 tool handlers (style.ingest, sources.validate, render)
 * - Determinism test pattern
 *
 * TODO Integration:
 * 1. Copy handler functions into apps/nucleus/src/routes/citations.ts
 * 2. Wire into Nucleus dispatcher
 * 3. Implement ledger append calls (marked with TODO comments)
 * 4. Add real render logic in handleRender()
 * 5. Use testDeterminism() in your test suite
    CitationSourcesValidateInputSchema,
    CitationSourcesValidateOutputSchema,
    CitationStyleIngestInputSchema,
    CitationStyleIngestOutputSchema,
    ToolCallEnvelopeSchema,
    type CitationRenderOutput,
    type CitationSourcesValidateOutput,
    type CitationStyleIngestInput,
    type CitationStyleIngestOutput
} from "@we/contracts/citation";
import { createHash } from "node:crypto";

/**
 * Canonicalize JSON for deterministic hashing:
 * - Sort keys alphabetically (recursively)
 * - Use \n line endings
 * - UTF-8 encoding (no BOM)
 */
export function canonicalJson(obj: unknown): string {
  const sorted = (val: unknown): unknown => {
    if (val === null || typeof val !== "object") return val;
    if (Array.isArray(val)) return val.map(sorted);
    const keys = Object.keys(val as Record<string, unknown>).sort();
    return Object.fromEntries(keys.map((k) => [k, sorted((val as Record<string, unknown>)[k])]));
  };
  return JSON.stringify(sorted(obj), null, 2).replace(/\r\n/g, "\n");
}

/**
 * Compute SHA-256(canonical JSON)
 */
export function sha256Hash(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * citation.style.ingest
 * Validates style spec, optionally seals it, records hash
 */
export async function handleStyleIngest(input: unknown): Promise<CitationStyleIngestOutput> {
  // 1. Validate input
  const validated = CitationStyleIngestInputSchema.parse(input);
  const { style_spec, seal } = validated;

  // 2. Canonicalize + hash
  const canonicalSpec = canonicalJson(style_spec);
  const styleHash = sha256Hash(canonicalSpec);

  // 3. (TODO) Append ledger event
  // const event = {
  //   event_type: "citation.style.ingested",
  //   style_id: style_spec.style_id,
  //   style_version: style_spec.style_version,
  //   style_hash: styleHash,
  //   sealed: seal,
  //   sealed_at_utc: seal ? new Date().toISOString() : undefined,
  // };
  // ledger.append(event);

  // 4. Return output
  const output: CitationStyleIngestOutput = {
    style_id: style_spec.style_id,
    style_version: style_spec.style_version,
    style_hash: styleHash,
    sealed: seal,
    ...(seal && { sealed_at_utc: new Date().toISOString() }),
  };

  return CitationStyleIngestOutputSchema.parse(output);
}

/**
 * citation.sources.validate
 * Validates each source, checks important fields, normalizes
 */
export async function handleSourcesValidate(
  input: unknown
): Promise<CitationSourcesValidateOutput> {
  // 1. Validate input
  const validated = CitationSourcesValidateInputSchema.parse(input);
  const { style_id, lcid, sources } = validated;

  // 2. Normalize + validate each source
  const issues = [];
  for (const source of sources) {
    const sourceType = source.source_type;
    // TODO: match sourceType against style's source_types rules
    // TODO: check for missing important_fields
  }

  // 3. Canonicalize normalized sources + hash
  const canonicalSources = canonicalJson(sources);
  const sourcesHash = sha256Hash(canonicalSources);

  // 4. (TODO) Append ledger event
  // const event = {
  //   event_type: "citation.sources.validated",
  //   style_id,
  //   lcid,
  //   source_count: sources.length,
  //   issues_count: issues.length,
  //   sources_hash: sourcesHash,
  // };
  // ledger.append(event);

  // 5. Return output
  const output: CitationSourcesValidateOutput = {
    ok: issues.length === 0,
    issues,
    normalized_sources_hash: sourcesHash,
  };

  return CitationSourcesValidateOutputSchema.parse(output);
}

/**
 * citation.render
 * Renders sources as HTML, text, or tokens (with optional trace)
 */
export async function handleRender(input: unknown): Promise<CitationRenderOutput> {
  // 1. Validate input
  const validated = CitationRenderInputSchema.parse(input);
  const { style_id, lcid, mode, format, include_trace, sources } = validated;

  // 2. (TODO) Load style + apply render logic
  // const style = /* fetch from somewhere */;
  // const output = renderCitations(style, lcid, mode, format, sources);
  // const trace = include_trace ? buildTrace(...) : undefined;

  // 3. Compute hashes
  const dummyOutput = "<html>...</html>";
  const outputHash = sha256Hash(dummyOutput);
  const sourcesCanonical = canonicalJson(sources);
  const sourcesHash = sha256Hash(sourcesCanonical);
  const styleHash = sha256Hash("{}"); // TODO: load real style hash

  // 4. (TODO) Append ledger event
  // const event = {
  //   event_type: "citation.rendered",
  //   style_id,
  //   lcid,
  //   mode,
  //   format,
  //   source_count: sources.length,
  //   output_hash: outputHash,
  //   sources_hash: sourcesHash,
  //   style_hash: styleHash,
  // };
  // ledger.append(event);

  // 5. Return output
  const output: CitationRenderOutput = {
    output: dummyOutput,
    output_hash: outputHash,
    style_hash: styleHash,
    sources_hash: sourcesHash,
    warnings: [],
    trace: include_trace
      ? {
          trace_version: "1.0",
          style_id,
          lcid,
          mode,
          steps: [],
          trace_hash: sha256Hash("[]"), // TODO: compute real trace hash
        }
      : undefined,
  };

  return CitationRenderOutputSchema.parse(output);
}

/**
 * Main dispatcher
 */
export async function handleCitationToolCall(envelope: unknown): Promise<unknown> {
  const validated = ToolCallEnvelopeSchema.parse(envelope);

  switch (validated.tool) {
    case "citation.style.ingest":
      return await handleStyleIngest(validated.input);
    case "citation.sources.validate":
      return await handleSourcesValidate(validated.input);
    case "citation.render":
      return await handleRender(validated.input);
    default:
      throw new Error(`Unknown citation tool: ${(validated as Record<string, unknown>).tool}`);
  }
}

/**
 * Determinism test example
 * Run same input twice, verify output + hashes match
 */
export async function testDeterminism() {
  const input: CitationStyleIngestInput = {
    style_spec: {
      style_id: "test-style",
      style_version: "1.0.0",
      default_lcid: 1033,
      origin: {
        xslt_version: "1.0",
        msxsl_node_set_required: false,
        output_method: "html",
        output_encoding: "utf-8",
        word_bibliography_version: "2006.5.07",
        word_xsl_version: "2003",
        style_name_en: "Test Style",
      },
      locales: {},
      source_types: {},
      render_rules: {
        max_author: 99,
        et_al: { threshold: 4, position: 1, and_others_string_key: "and_others_uncap" },
        sort: { key: "sorting_string", tie_breaker: "source_id" },
      },
    },
    seal: false,
  };

  const result1 = await handleStyleIngest(input);
  const result2 = await handleStyleIngest(input);

  console.assert(result1.style_hash === result2.style_hash, "Hashes must match");
  console.assert(JSON.stringify(result1) === JSON.stringify(result2), "Full output must match");
  console.log("✅ Determinism verified");
}
