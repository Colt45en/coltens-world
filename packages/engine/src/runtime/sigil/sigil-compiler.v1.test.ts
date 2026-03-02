import { describe, expect, it } from "vitest";
import type { SigilProgramV1 } from "../../contracts/sigil/sigil.compile.v1";
import { compileSigilProgramV1, renderSigilSvgV1 } from "./sigil-compiler.v1";

const PROGRAM: SigilProgramV1 = {
  kind: "sigil.program",
  v: 1,
  roles: { prefixes: ["re"], roots: ["struct"], suffixes: ["ion"] },
  ops: { link: false, flow: true, fuse: false },
  style: { size: 600, pad: 40, stroke: 5.5, fg: "#0ea5e9" },
  symmetry: 9,
  seed_hex: "a1b2c3d4",
};

describe("sigil.compile.v1 determinism", () => {
  it("same program -> same hashes and svg", () => {
    const a = compileSigilProgramV1(PROGRAM);
    const b = compileSigilProgramV1(PROGRAM);

    expect(a.program_hash).toBe(b.program_hash);
    expect(a.artifact_hash).toBe(b.artifact_hash);

    const svgA = renderSigilSvgV1(a.artifact);
    const svgB = renderSigilSvgV1(b.artifact);
    expect(svgA).toBe(svgB);
  });

  it("program normalization is stable (case/Unicode)", () => {
    const weird: SigilProgramV1 = {
      ...PROGRAM,
      roles: { prefixes: ["RE"], roots: ["StRuCt"], suffixes: ["ION"] },
    };

    const a = compileSigilProgramV1(PROGRAM);
    const b = compileSigilProgramV1(weird);

    expect(a.program_hash).toBe(b.program_hash);
    expect(a.artifact_hash).toBe(b.artifact_hash);
  });
});
