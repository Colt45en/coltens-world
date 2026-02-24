/**
 * Brain Training Handler - STUB (waiting for @world-engine/brain)
 *
 * TODO: Implement when @world-engine/brain is available
 */

import type { UnifiedEngineEnvelope } from "@world-engine/protocol";
import type { UEEHandlerContext, UEEHandlerResponse } from "../uee";

/**
 * Handle brain_train UEE task: evolve population (stub)
 */
export async function handleBrainTrain(
  envelope: UnifiedEngineEnvelope,
  context: UEEHandlerContext
): Promise<UEEHandlerResponse> {
  return {
    ok: false,
    taskId: context.taskId,
    taskType: context.taskType,
    errors: ['Brain training not yet implemented - waiting for @world-engine/brain'],
  };
}

export function getTrainingSession(): undefined {
  return undefined;
}

export function listTrainingSessions(): string[] {
  return [];
}

export function cleanupOldSessions(): number {
  return 0;
}

export default handleBrainTrain;
