/**
 * World Engine Labs Generator Contract
 *
 * Defines canonical request/response schemas for AI lab generation.
 * Used by:
 * - tool_call lane (agent_py.labs.generate, agent_py.labs.list)
 * - FastAPI wrapper (python/labs_api.py)
 * - UI/operator actions
 *
 * Contract is additive: optional fields + defaults for future extensibility.
 */

export type LabId =
  | "la01_regression_from_scratch"
  | "la02_pca_scratch"
  | "opt01_autodiff_mini"
  | "opt02_logistic_from_scratch"
  | "ps01_naive_bayes"
  | "ps02_bootstrap_ci"
  | "geo01_knn_metrics"
  | "info01_softmax_ce";

/**
 * Request to generate one or all labs.
 * All fields optional → enable partial generation + different output modes.
 */
export interface LabsGenerateRequest {
  /** If omitted, generate all labs. */
  lab_id?: LabId;

  /** Output directory (default: "python/labs") */
  output_dir?: string;

  /** Write manifest.json per lab (default: true) */
  write_manifest?: boolean;
}

/**
 * File hash + metadata (audit-ready).
 */
export interface FileHash {
  path: string; // relative path within lab folder
  sha256: string; // 64-char hex (lowercase)
  bytes: number; // file size
}

/**
 * One generated lab with its files + hashes.
 */
export interface GeneratedLab {
  lab_id: LabId;
  dir: string; // absolute path to output
  files: FileHash[];
}

/**
 * Response from lab generation.
 * Always includes catalog path for subsequent discovery.
 */
export interface LabsGenerateResponse {
  ok: boolean;
  generated: GeneratedLab[];
  /** Path to _catalog.json (all available labs + their metadata) */
  catalog_path: string;
}

/**
 * List all available labs (lightweight discovery).
 */
export interface LabsListResponse {
  labs: LabId[];
}

/**
 * JSON Schema for validation (Ajv, zod, or similar).
 * Matches TS definitions exactly for type safety.
 */
export const LabsGenerateRequestSchema = {
  $id: "worldengine.labs.generate.request.schema.json",
  type: "object",
  additionalProperties: false,
  properties: {
    lab_id: {
      type: "string",
      enum: [
        "la01_regression_from_scratch",
        "la02_pca_scratch",
        "opt01_autodiff_mini",
        "opt02_logistic_from_scratch",
        "ps01_naive_bayes",
        "ps02_bootstrap_ci",
        "geo01_knn_metrics",
        "info01_softmax_ce",
      ],
    },
    output_dir: {
      type: "string",
      minLength: 1,
    },
    write_manifest: {
      type: "boolean",
    },
  },
} as const;

export const LabsGenerateResponseSchema = {
  $id: "worldengine.labs.generate.response.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["ok", "generated", "catalog_path"],
  properties: {
    ok: {
      type: "boolean",
    },
    catalog_path: {
      type: "string",
    },
    generated: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["lab_id", "dir", "files"],
        properties: {
          lab_id: {
            type: "string",
            enum: [
              "la01_regression_from_scratch",
              "la02_pca_scratch",
              "opt01_autodiff_mini",
              "opt02_logistic_from_scratch",
              "ps01_naive_bayes",
              "ps02_bootstrap_ci",
              "geo01_knn_metrics",
              "info01_softmax_ce",
            ],
          },
          dir: {
            type: "string",
          },
          files: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["path", "sha256", "bytes"],
              properties: {
                path: {
                  type: "string",
                },
                sha256: {
                  type: "string",
                  minLength: 64,
                  maxLength: 64,
                  pattern: "^[a-f0-9]{64}$",
                },
                bytes: {
                  type: "integer",
                  minimum: 0,
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const LabsListResponseSchema = {
  $id: "worldengine.labs.list.response.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["labs"],
  properties: {
    labs: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "la01_regression_from_scratch",
          "la02_pca_scratch",
          "opt01_autodiff_mini",
          "opt02_logistic_from_scratch",
          "ps01_naive_bayes",
          "ps02_bootstrap_ci",
          "geo01_knn_metrics",
          "info01_softmax_ce",
        ],
      },
    },
  },
} as const;
