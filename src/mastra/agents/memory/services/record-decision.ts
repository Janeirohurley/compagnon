import { createDecision } from "../repositories/decision-repository";
import type { DecisionInput, Decision } from "../domain/types";

export async function recordDecision(input: DecisionInput): Promise<Decision> {
  const id = crypto.randomUUID();

  return createDecision({
    id,
    project: input.project,
    repository: input.repository,
    title: input.title,
    context: input.context,
    alternatives: input.alternatives,
    decision: input.decision,
    rationale: input.rationale,
    status: "accepted",
  });
}
