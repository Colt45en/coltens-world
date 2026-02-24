import {
  makeTextSignalFromAsciiLetters,
  makeDefaultRhoTable,
  textToIntervalsConverter,
  intervalsToHzConverter,
  runPipeline,
  generateStereoLissajousFromHz,
  type HzSignal,
  type ShapeSignal,
} from "@world-engine/signal-spine-contract";
import {
  shapeResampleArcLength,
  shapeToCurvatureSignal,
  curvatureToIntervals,
  shapeToArcSpeedRhythm,
} from "../index.js";

function main() {
  const text = makeTextSignalFromAsciiLetters("WORLDENGINE", { source: "demo" });
  const rho = makeDefaultRhoTable();

  const hz = runPipeline(text, [
    { kind: "convert", converter: textToIntervalsConverter(rho) },
    { kind: "convert", converter: intervalsToHzConverter(528) },
  ]) as HzSignal;

  const shape = generateStereoLissajousFromHz(hz, {
    duration_seconds: 1.5,
    sample_rate_hz: 180,
    R_L: [1, 2, 3],
    R_R: [1, 2, 4],
    a: [1, 0.3, 0.2],
    b: [1, 0.3, 0.2],
    envelope: (t: number) => Math.min(1, t / 0.2) * Math.min(1, (1.5 - t) / 0.2),
  }) as ShapeSignal;

  const resampled = shapeResampleArcLength(shape, { count: 256, closed: false });
  const curvature = shapeToCurvatureSignal(resampled);

  const intervalsColored = curvatureToIntervals(curvature, {
    bins: [0.2, 0.5, 1.0, 2.0],
    palette: [
      { p: 1, q: 1 },
      { p: 6, q: 5 },
      { p: 5, q: 4 },
      { p: 4, q: 3 },
      { p: 3, q: 2 }
    ],
  });

  const rhythm = shapeToArcSpeedRhythm(resampled, { root_hz: 528, dur_scale: 2.0, dur_min: 0.03, dur_max: 0.25 });

  console.log(
    JSON.stringify(
      {
        ids: {
          text: text.metadata.id,
          hz: hz.metadata.id,
          shape: shape.metadata.id,
          resampled: resampled.metadata.id,
          curvature: curvature.metadata.id,
          intervalsColored: intervalsColored.metadata.id,
          rhythm: rhythm.metadata.id,
        },
        preview: {
          curvature_first_8: curvature.sequence.slice(0, 8),
          interval_first_8: intervalsColored.sequence.slice(0, 8),
          rhythm_first_3: rhythm.sequence.slice(0, 3),
        },
      },
      null,
      2
    )
  );
}

main();
