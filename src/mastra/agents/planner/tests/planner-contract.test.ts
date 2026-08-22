import assert from "node:assert/strict";
import test from "node:test";

function assertPlannerResultShape(result: unknown) {
  assert.ok(result && typeof result === "object");

  const value = result as Record<string, unknown>;

  assert.ok(
    ["ready", "needs_clarification", "blocked", "invalid", "out_of_scope"]
      .includes(String(value.status)),
  );

  if (value.status === "ready") {
    assert.ok(value.plan);
    assert.equal(typeof value.plan, "object");
  }

  if (value.status === "needs_clarification") {
    assert.ok(Array.isArray(value.questions));
    assert.ok(value.questions.length > 0);
  }

  if (value.status === "out_of_scope") {
    assert.equal(typeof value.summary, "string");
  }
}

test("Planner result contract accepts a ready plan", () => {
  const result = {
    status: "ready",
    plan: {
      id: "plan-1",
      objective: "Add OAuth",
      tasks: [],
      dependencies: [],
      executionOrder: [],
      risks: [],
      acceptanceCriteria: [],
      constraints: [],
      assumptions: [],
      summary: "Plan",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    summary: "Plan generated",
  };

  assertPlannerResultShape(result);
});

test("Planner result contract accepts clarification", () => {
  const result = {
    status: "needs_clarification",
    summary: "Objective is ambiguous.",
    questions: [
      {
        id: "q1",
        question: "What OAuth capability is required?",
      },
    ],
  };

  assertPlannerResultShape(result);
});

test("Planner result contract accepts out-of-scope response", () => {
  const result = {
    status: "out_of_scope",
    summary:
      "I am specialized in planning and cannot implement application code.",
    suggestedAgent: "developer",
  };

  assertPlannerResultShape(result);
});
