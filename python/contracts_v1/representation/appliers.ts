import type { ApplierRegistry } from "./mutationPipeline.runtime.js";
import type { MutationAction } from "./mutationPipeline.core.js";

export const appliers: ApplierRegistry = {
  lowerLearningRate: (action, ctx) => {
    const factor = typeof action.params.factor === "number" ? action.params.factor : 1;
    // apply: trainer.lr *= factor
    return {
      ok: true,
      info: { lrFactorApplied: factor, batchId: ctx.batchId },
      rollback: {
        type: "lowerLearningRate",
        params: { factor: factor === 0 ? 1 : 1 / factor }, // rollback approx
        urgency: "high",
        reason: "rollback lr adjustment",
      } satisfies MutationAction,
    };
  },

  clipGradients: (action) => {
    const maxNorm = typeof action.params.maxNorm === "number" ? action.params.maxNorm : 1;
    // apply: trainer.gradClip = maxNorm
    return { ok: true, info: { maxNorm } };
  },

  revertUpdate: () => {
    // apply: trainer.revertLastUpdate()
    return { ok: true, info: { reverted: true } };
  },

  addRegularization: (action) => {
    // apply: trainer.reg.l2 = weight
    return { ok: true, info: { reg: action.params } };
  },

  freezeLayer: (action) => {
    // apply: trainer.freeze(layerIndex)
    return { ok: true, info: { frozen: action.params.layerIndex } };
  },

  reinitializeUnit: (action) => {
    // apply: trainer.reinit(unitIndex)
    return { ok: true, info: { unit: action.params.unitIndex } };
  },
};
