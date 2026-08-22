import assert from "node:assert/strict";
import test from "node:test";

import {
  planTaskSchema,
  planDependencySchema,
  planningResultSchema,
} from "../domain/schemas";

test("rejects string estimatedEffort", () => {
  const result = planTaskSchema.safeParse({
    id: "T1",
    title: "Analyze authentication",
    description: "Inspect the current authentication system.",
    type: "analysis",
    status: "pending",
    priority: "high",
    complexity: "medium",
    dependencies: [],
    resources: [],
    expectedOutputs: ["Authentication analysis"],
    acceptanceCriteria: ["Authentication is documented"],
    suggestedAgent: "developer",
    estimatedEffort: "2-3 hours",
    risks: [],
  });

  assert.equal(result.success, false);
});

test("rejects non-contract dependency field names", () => {
  const result = planDependencySchema.safeParse({
    sourceTaskId: "T1",
    dependentTaskId: "T2",
    type: "required",
    reason: "T2 depends on T1",
  });

  assert.equal(result.success, false);
});

test("rejects plan on out-of-scope result", () => {
  const result = planningResultSchema.safeParse({
    status: "out_of_scope",
    summary:
      "I am specialized in planning and cannot implement application code.",
    suggestedAgent: "developer",
    plan: {},
  });

  assert.equal(result.success, false);
});

test("accepts valid out-of-scope result", () => {
  const result = planningResultSchema.safeParse({
    status: "out_of_scope",
    summary:
      "I am specialized in planning and cannot implement application code.",
    suggestedAgent: "developer",
  });

  assert.equal(result.success, true);
});

test("accepts valid clarification result", () => {
  const result = planningResultSchema.safeParse({
    status: "needs_clarification",
    summary: "The objective is ambiguous.",
    questions: [
      {
        id: "Q1",
        question: "What OAuth capability is required?",
        why: "OAuth is ambiguous.",
        examples: ["Google login", "GitHub login"],
      },
    ],
  });

  assert.equal(result.success, true);
});
