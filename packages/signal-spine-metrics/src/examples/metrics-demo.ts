import {
  makeTextSignalFromAsciiLetters,
  makeDefaultRhoTable,
  textToIntervalsConverter,
  intervalsToHzConverter,
  runPipeline,
  type HzSignal,
} from "@world-engine/signal-spine-contract";
import { spectralFromHz, textMetrics } from "../index.js";

function main() {
  const text = makeTextSignalFromAsciiLetters("SATORAREPOTENETOPERAROTAS", { source: "demo" });

  const rho = makeDefaultRhoTable();
  const hz = runPipeline(text, [
    { kind: "convert", converter: textToIntervalsConverter(rho) },
    { kind: "convert", converter: intervalsToHzConverter(528) },
  ]) as HzSignal;

  const tm = textMetrics(text);
  const sm = spectralFromHz(hz);

  console.log(JSON.stringify({ text_id: text.metadata.id, hz_id: hz.metadata.id, text: tm, spectral: sm }, null, 2));
}

main();
