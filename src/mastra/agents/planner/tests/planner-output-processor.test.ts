import assert from "node:assert/strict";
import test from "node:test";

import { PlannerOutputProcessor } from "../runtime/planner-output-processor";

function makeMessages(text: string) {
  return [
    {
      role: "user",
      content: { format: 2, parts: [{ type: "text", text: "objective" }] },
    },
    {
      role: "assistant",
      content: { format: 2, parts: [{ type: "text", text }] },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any;
}

const VALID_DRAFTS = JSON.stringify({
  status: "ready",
  objective: "Add payment",
  context: "Existing app",
  constraints: ["Do not break auth"],
  tasks: [
    {
      title: "Inspect codebase",
      description: "Inspect existing payment setup.",
      type: "analysis",
      priority: "high",
      resources: [],
      expectedOutputs: ["Findings"],
      acceptanceCriteria: ["Findings documented."],
      risks: [],
    },
  ],
  summary: "Plan to add payment.",
});

const NESTED_PLAN = JSON.stringify({
  status: "ready",
  summary: "Nested full plan.",
  confidence: 0.9,
  plan: {
    id: "plan-1",
    objective: "Add payment",
    constraints: [],
    assumptions: [],
    tasks: [
      {
        id: "T1",
        title: "Inspect codebase",
        description: "Inspect existing payment setup.",
        type: "analysis",
        status: "pending",
        priority: "high",
        complexity: "medium",
        dependencies: [],
        resources: [],
        expectedOutputs: ["Findings"],
        acceptanceCriteria: ["Findings documented."],
        risks: [],
      },
    ],
    dependencies: [],
    executionOrder: [["T1"]],
    risks: [],
    acceptanceCriteria: [],
    metadata: {},
  },
});

async function run(text: string): Promise<Record<string, unknown>> {
  const processor = new PlannerOutputProcessor();
  const messages = await processor.processOutputResult({
    messages: makeMessages(text),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  const last = messages[messages.length - 1];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textPart: any = last.content.parts.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (part: any) => part.type === "text"
  );
  assert.ok(textPart, "text part manquant");
  return JSON.parse(textPart.text);
}

test("validates and finalizes a flat draft proposal", async () => {
  const result = await run(VALID_DRAFTS);
  assert.equal(result.status, "ready");
  const plan = result.plan as { tasks: Array<{ id: string }> };
  assert.ok(plan.tasks.length === 1);
  assert.match(plan.tasks[0].id, /^task-/);
});

test("accepts the nested full-plan format from instructions", async () => {
  const result = await run(NESTED_PLAN);
  assert.equal(result.status, "ready");
  assert.ok(result.plan);
});

test("replaces invalid output with a valid invalid-result", async () => {
  const result = await run("Voici mon plan : d'abord analyser, ensuite coder.");
  assert.equal(result.status, "invalid");
  assert.ok(Array.isArray(result.blockers));
});

test("parses JSON inside markdown fences", async () => {
  const fenced = "```json\n" + VALID_DRAFTS + "\n```";
  const result = await run(fenced);
  assert.equal(result.status, "ready");
});
