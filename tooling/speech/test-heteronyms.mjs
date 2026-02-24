// tooling/speech/test-heteronyms.mjs
import assert from "node:assert/strict";
import { resolveHeteronym } from "./heteronym_resolver.mjs";

const cfg = {
  heteronymRules: {
    read: {
      default: "rēd",
      ordered: [
        { when: { prevHave: true }, pron: "rĕd" },
        { when: { pastMarker: true }, pron: "rĕd" },
      ],
    },
    record: {
      default: "rɪ'kɔrd",
      ordered: [
        { when: { prevDet: true }, pron: "'rĕkərd" },
        { when: { prevTo: true }, pron: "rɪ'kɔrd" },
        { when: { prevModal: true }, pron: "rɪ'kɔrd" },
      ],
    },
  },
};

function ctx(tokens) {
  // contextCores is just the core tokens in order
  return tokens;
}

// record: verb after modal, noun after determiner
{
  const toks = ctx(["I","will","record","the","record"]);
  assert.equal(resolveHeteronym("record", toks, 2, cfg), "rɪ'kɔrd");
  assert.equal(resolveHeteronym("record", toks, 4, cfg), "'rĕkərd");
}

// read: past after have/has/had, past near yesterday
{
  const toks = ctx(["I","have","read","it"]);
  assert.equal(resolveHeteronym("read", toks, 2, cfg), "rĕd");

  const toks2 = ctx(["I","read","it","yesterday"]);
  assert.equal(resolveHeteronym("read", toks2, 1, cfg), "rĕd");

  const toks3 = ctx(["I","read","it","now"]);
  assert.equal(resolveHeteronym("read", toks3, 1, cfg), "rēd"); // default present
}

console.log("[ok] heteronym resolver tests passed");
