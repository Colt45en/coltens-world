import path from "node:path";
import type { AvatarDNA } from "./avatarDNA.js";
import { canonicalHexColor } from "./avatarDNA.js";

export type ValidationIssue = {
  level: "error" | "warn";
  path: string;
  message: string;
};

export type ValidateOptions = {
  strict?: boolean;
};

function issue(level: ValidationIssue["level"], p: string, message: string): ValidationIssue {
  return { level, path: p, message };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function clampMorph(x: number) {
  return Math.max(-1, Math.min(1, x));
}

function looksLikeHexColor(input: unknown): input is string {
  if (typeof input !== "string") return false;
  const s = input.trim();
  if (!s) return false;
  const t = s.startsWith("#") ? s.slice(1) : s;
  return /^[0-9a-fA-F]{3}$/.test(t) || /^[0-9a-fA-F]{6}$/.test(t);
}

export function isSafeTexturePath(src: unknown): src is string {
  if (typeof src !== "string") return false;
  const s = src.trim().replace(/\\/g, "/");
  if (!s) return false;
  if (s.startsWith("http://") || s.startsWith("https://")) return false;
  const noLead = s.startsWith("/") ? s.slice(1) : s;
  if (!noLead) return false;
  if (path.isAbsolute(noLead)) return false;
  if (noLead.includes("..")) return false;
  return true;
}

export function validateAvatarDNA(
  dna: unknown,
  opts: ValidateOptions = {},
): { ok: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const strict = Boolean(opts.strict);

  if (!isObject(dna)) {
    return { ok: false, issues: [issue("error", "$", "DNA must be an object")] };
  }

  if (!("morphs" in dna) || !isObject(dna.morphs)) {
    issues.push(issue("error", "morphs", "morphs must be an object map of string -> number"));
  } else {
    const morphs = dna.morphs as Record<string, unknown>;
    for (const [k, v] of Object.entries(morphs)) {
      if (!isFiniteNumber(v)) {
        issues.push(issue("error", `morphs.${k}`, "morph value must be a finite number"));
        continue;
      }
      if (v < -1 || v > 1) {
        issues.push(
          issue(
            strict ? "error" : "warn",
            `morphs.${k}`,
            `morph is out of [-1..1] (will clamp to ${clampMorph(v)})`,
          ),
        );
      }
    }
  }

  if (!("materials" in dna) || !isObject(dna.materials)) {
    issues.push(issue("error", "materials", "materials must be an object"));
  } else {
    const m = dna.materials as Record<string, unknown>;
    if (!looksLikeHexColor(m.skinColor)) {
      issues.push(issue("error", "materials.skinColor", "skinColor must be a hex color like #d8b59a or #fff"));
    } else {
      const c = canonicalHexColor(m.skinColor);
      const raw = m.skinColor.trim().toLowerCase();
      if (c === "#000000" && raw !== "#000000" && raw !== "000000") {
        issues.push(issue("error", "materials.skinColor", "skinColor failed canonicalization (invalid hex)"));
      }
    }

    if (!looksLikeHexColor(m.hairColor)) {
      issues.push(issue("error", "materials.hairColor", "hairColor must be a hex color like #2b1d14 or #fff"));
    } else {
      const c = canonicalHexColor(m.hairColor);
      const raw = m.hairColor.trim().toLowerCase();
      if (c === "#000000" && raw !== "#000000" && raw !== "000000") {
        issues.push(issue("error", "materials.hairColor", "hairColor failed canonicalization (invalid hex)"));
      }
    }

    if (!isFiniteNumber(m.roughness)) {
      issues.push(issue("error", "materials.roughness", "roughness must be a finite number"));
    } else if (m.roughness < 0 || m.roughness > 1) {
      issues.push(
        issue(
          strict ? "error" : "warn",
          "materials.roughness",
          `roughness out of [0..1] (will clamp to ${clamp01(m.roughness)})`,
        ),
      );
    }

    if (!isFiniteNumber(m.metalness)) {
      issues.push(issue("error", "materials.metalness", "metalness must be a finite number"));
    } else if (m.metalness < 0 || m.metalness > 1) {
      issues.push(
        issue(
          strict ? "error" : "warn",
          "materials.metalness",
          `metalness out of [0..1] (will clamp to ${clamp01(m.metalness)})`,
        ),
      );
    }
  }

  if ("textures" in dna && dna.textures != null) {
    if (!isObject(dna.textures)) {
      issues.push(issue("error", "textures", "textures must be an object if provided"));
    } else {
      const t = dna.textures as Record<string, unknown>;
      for (const slot of ["skinMap", "clothingMap", "maskMap"] as const) {
        const value = t[slot];
        if (value == null) continue;
        if (!isSafeTexturePath(value)) {
          issues.push(
            issue(
              "error",
              `textures.${slot}`,
              `invalid texture path "${String(value)}" (must be safe relative path, no http(s), no ..)`,
            ),
          );
        }
      }
    }
  }

  if (!("postfx" in dna) || !isObject(dna.postfx)) {
    issues.push(issue("error", "postfx", "postfx must be an object"));
  } else {
    const p = dna.postfx as Record<string, unknown>;
    if (!isFiniteNumber(p.bloom)) issues.push(issue("error", "postfx.bloom", "bloom must be a finite number"));
    else if (p.bloom < 0 || p.bloom > 1) {
      issues.push(issue(strict ? "error" : "warn", "postfx.bloom", `bloom out of [0..1] (will clamp to ${clamp01(p.bloom)})`));
    }

    if (!isFiniteNumber(p.ao)) issues.push(issue("error", "postfx.ao", "ao must be a finite number"));
    else if (p.ao < 0 || p.ao > 1) {
      issues.push(issue(strict ? "error" : "warn", "postfx.ao", `ao out of [0..1] (will clamp to ${clamp01(p.ao)})`));
    }

    if (typeof p.smaa !== "boolean") issues.push(issue("error", "postfx.smaa", "smaa must be boolean"));
  }

  if (!("quality" in dna) || !isObject(dna.quality)) {
    issues.push(issue("error", "quality", "quality must be an object"));
  } else {
    const q = dna.quality as Record<string, unknown>;
    if (typeof q.shadows !== "boolean") issues.push(issue("error", "quality.shadows", "shadows must be boolean"));
    if (q.shadowMapSize !== 1024 && q.shadowMapSize !== 2048) {
      issues.push(issue("error", "quality.shadowMapSize", "shadowMapSize must be 1024 or 2048"));
    }
  }

  const ok = issues.every((i) => i.level !== "error");
  return { ok, issues };
}

export function assertValidAvatarDNA(
  dna: unknown,
  opts: ValidateOptions = {},
): asserts dna is AvatarDNA {
  const res = validateAvatarDNA(dna, opts);
  if (!res.ok) {
    const lines = res.issues.map((i) => `- [${i.level}] ${i.path}: ${i.message}`);
    throw new Error(`AvatarDNA validation failed:\n${lines.join("\n")}`);
  }
}
