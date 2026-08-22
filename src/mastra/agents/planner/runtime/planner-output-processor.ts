import type { Processor } from "@mastra/core/processors";

import { plannerProposalSchema } from "../domain/proposal-schemas";
import { planningResultSchema } from "../domain/schemas";
import { finalizeExecutionPlan } from "../services/planning-service";

type ProcessOutputResultArgs = Parameters<
  NonNullable<Processor["processOutputResult"]>
>[0];

const INVALID_RESULT = {
  status: "invalid",
  blockers: [
    "Planner output did not match the required schema.",
    "Response was replaced by the deterministic validation layer.",
  ],
  confidence: 1,
} as const;

function extractText(message: {
  content: { parts?: Array<{ type?: string; text?: unknown }> };
}): string {
  const parts = message?.content?.parts ?? [];
  return parts
    .filter((part) => part.type === "text")
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n");
}

function extractJsonBlock(text: string): string | null {
  const trimmed = text.trim();

  const direct = tryParse(trimmed);
  if (direct !== null) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const inner = fenced[1].trim();
    if (tryParse(inner) !== null) return inner;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const slice = trimmed.slice(start, end + 1);
    if (tryParse(slice) !== null) return slice;
  }

  return null;
}

function tryParse(value: string): unknown {
  try {
    JSON.parse(value);
    return value;
  } catch {
    return null;
  }
}

/**
 * Accepts both the draft proposal shape (flat) and the full-result shape
 * described in the instructions (plan nested under `plan`).
 */
export function unwrapNestedPlan(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  const plan = obj.plan;
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return raw;
  const p = plan as Record<string, unknown>;

  return {
    ...p,
    status: obj.status ?? p.status,
    summary: obj.summary ?? p.summary,
    questions: obj.questions ?? p.questions,
    blockers: obj.blockers ?? p.blockers,
    suggestedAgent: obj.suggestedAgent ?? p.suggestedAgent,
    confidence: obj.confidence ?? p.confidence,
  };
}

export class PlannerOutputProcessor implements Processor {
  readonly id = "planner-output-validator";

  async processOutputResult({
    messages,
  }: ProcessOutputResultArgs): Promise<typeof messages> {
    let lastIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "assistant") {
        lastIndex = i;
        break;
      }
    }
    if (lastIndex === -1) return messages;

    const message = messages[lastIndex];
    const text = extractText(message);
    if (!text.trim()) return messages;

    console.error(
      "[PLANNER_TRACE] output-processor: sortie reçue (" + text.length + " chars)"
    );

    let finalResult: unknown = INVALID_RESULT;

    const jsonBlock = extractJsonBlock(text);
    if (jsonBlock) {
      try {
        const parsed = JSON.parse(jsonBlock);
        const candidate = unwrapNestedPlan(parsed);
        const proposal = plannerProposalSchema.safeParse(candidate);

        if (proposal.success) {
          const data = proposal.data;
          console.error(
            `[PLANNER_TRACE] output-processor: proposition valide (status=${data.status})`
          );

          if (data.status === "ready") {
            const planResult = finalizeExecutionPlan(
              {
                objective: data.objective,
                context: data.context,
                constraints: data.constraints,
              },
              data.tasks,
            );

            // Validate the final result against planningResultSchema
            const resultCheck = planningResultSchema.safeParse(planResult);
            if (!resultCheck.success) {
              const issues = resultCheck.error.issues
                .slice(0, 5)
                .map(
                  (issue) =>
                    `${issue.path.join(".") || "(root)"}: ${issue.message}`,
                )
                .join(" | ");
              console.error(
                `[PLANNER_TRACE] output-processor: planningResultSchema validation failed → ${issues}`
              );
            } else {
              console.error(
                `[PLANNER_TRACE] output-processor: planningResultSchema validation passed (status=${planResult.status})`
              );
            }

            finalResult = planResult;
          } else {
            // Validate non-ready status against planningResultSchema
            const resultCheck = planningResultSchema.safeParse(data);
            if (!resultCheck.success) {
              const issues = resultCheck.error.issues
                .slice(0, 5)
                .map(
                  (issue) =>
                    `${issue.path.join(".") || "(root)"}: ${issue.message}`,
                )
                .join(" | ");
              console.error(
                `[PLANNER_TRACE] output-processor: planningResultSchema validation failed (${data.status}) → ${issues}`
              );
            } else {
              console.error(
                `[PLANNER_TRACE] output-processor: planningResultSchema validation passed (status=${data.status})`
              );
            }

            finalResult = data;
          }
        } else {
          const issues = proposal.error.issues
            .slice(0, 5)
            .map(
              (issue) =>
                `${issue.path.join(".") || "(racine)"}: ${issue.message}`,
            )
            .join(" | ");
          console.error(
            `[PLANNER_TRACE] output-processor: ÉCHEC schéma → invalid | ${issues}`
          );
          const preview = JSON.stringify(candidate).slice(0, 400);
          console.error(
            `[PLANNER_TRACE] output-processor: candidat (400c): ${preview}`
          );
          finalResult = {
            status: "invalid",
            blockers: [
              "Planner output did not match the required schema.",
              `Schema issues: ${issues}`,
            ],
            confidence: 1,
          };
        }
      } catch {
        console.error("[PLANNER_TRACE] output-processor: JSON non parseable → invalid");
        finalResult = INVALID_RESULT;
      }
    } else {
      console.error("[PLANNER_TRACE] output-processor: aucun JSON trouvé → invalid");
    }

    const serialized =
      typeof finalResult === "string"
        ? finalResult
        : JSON.stringify(finalResult, null, 2);

    const parts = [...(message.content.parts ?? [])];
    const firstTextIndex = parts.findIndex((part) => part.type === "text");

    if (firstTextIndex === -1) {
      parts.unshift({ type: "text", text: serialized } as never);
    } else {
      const original = parts[firstTextIndex] as Record<string, unknown>;
      parts[firstTextIndex] = {
        ...original,
        type: "text",
        text: serialized,
      };
      for (let i = parts.length - 1; i > firstTextIndex; i--) {
        if (parts[i]?.type === "text") parts.splice(i, 1);
      }
    }

    messages[lastIndex] = {
      ...message,
      content: { ...message.content, parts },
    };

    return messages;
  }
}
