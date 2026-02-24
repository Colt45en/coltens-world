import type { NucleusResponse , NucleusQuery } from "@world-engine/nucleus-contracts";
import { buildPlan } from "./plan.js";
import { chooseBestIntent, scoreIntents } from "./scoring.js";

export function route(q: NucleusQuery): { intent: NucleusResponse["intent"]; plan: ReturnType<typeof buildPlan>; scores: ReturnType<typeof scoreIntents> } {
  const scores = scoreIntents(q);
  const intent = chooseBestIntent(scores);
  const plan = buildPlan(intent, q);
  return { intent, plan, scores };
}
