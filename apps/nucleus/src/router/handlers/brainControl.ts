/**
 * Brain Control Handler - STUB
 *
 * TODO: Implement when @world-engine/brain is available
 */

import type { UnifiedEngineEnvelope } from "@world-engine/protocol";
import { narrowByTaskType } from "@world-engine/protocol";
import type { UEEHandlerContext, UEEHandlerResponse } from "../uee";

/**
 * Handle brain_control task (stub)
 */
export async function handleBrainControl(
  envelope: UnifiedEngineEnvelope,
  context: UEEHandlerContext
): Promise<UEEHandlerResponse> {
  if (!narrowByTaskType(envelope, "brain_control")) {
    return {
      ok: false,
      taskId: context.taskId,
      taskType: context.taskType,
      errors: ["Expected brain_control task type"],
    };
  }

  return {
    ok: false,
    taskId: context.taskId,
    taskType: context.taskType,
    errors: ["Brain control not yet implemented - waiting for @world-engine/brain"],
  };
}

export default handleBrainControl;
