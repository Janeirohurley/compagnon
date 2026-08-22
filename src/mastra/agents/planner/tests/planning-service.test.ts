import assert from "node:assert/strict";
import test from "node:test";

import {
  TaskPriority,
  TaskType,
} from "../domain/enums";

import {
  finalizeExecutionPlan,
} from "../services/planning-service";

import { buildExecutionPlan } from "../services/planning-service";

test("buildExecutionPlan creates a valid execution plan", () => {
  const result = buildExecutionPlan({
    objective: "Add OAuth authentication",
    context: "TypeScript web application",
    constraints: [
      "Do not break existing authentication flows",
      "Add automated tests",
    ],
  });

  assert.equal(result.status, "ready");
  assert.ok(result.plan);

  const plan = result.plan;

  assert.equal(
    plan.objective,
    "Add OAuth authentication",
  );

  assert.equal(plan.tasks.length, 3);

  assert.equal(
    plan.tasks[0]?.type,
    "analysis",
  );

  assert.equal(
    plan.tasks[1]?.type,
    "implementation",
  );

  assert.equal(
    plan.tasks[2]?.type,
    "testing",
  );

  assert.equal(plan.dependencies.length, 2);

  assert.deepEqual(
    plan.executionOrder.map((batch) => batch.length),
    [1, 1, 1],
  );

  assert.equal(plan.acceptanceCriteria.length, 3);

  assert.equal(plan.risks.length, 1);

  assert.equal(plan.constraints.length, 2);
});

test("buildExecutionPlan rejects an empty objective", () => {
  const result = buildExecutionPlan({
    objective: "   ",
  });

  assert.equal(
    result.status,
    "invalid",
  );

  assert.ok(result.blockers);
  assert.ok(
    result.blockers?.some((blocker) =>
      blocker.includes("cannot be empty"),
    ),
  );
});


test("finalizeExecutionPlan validates and finalizes proposed planner tasks", () => {
  const result = finalizeExecutionPlan(
    {
      objective: "Add Google OAuth",
      context: "Existing application with authentication",
      constraints: ["Do not break existing authentication"],
    },
    [
      {
        title: "Inspect authentication",
        description: "Inspect the existing authentication system.",
        type: TaskType.ANALYSIS,
        priority: TaskPriority.HIGH,
        resources: [],
        expectedOutputs: ["Authentication architecture findings"],
        acceptanceCriteria: [
          "Existing authentication architecture is documented.",
        ],
        risks: [],
      },
      {
        title: "Implement Google OAuth",
        description: "Implement Google OAuth without breaking existing auth.",
        type: TaskType.IMPLEMENTATION,
        priority: TaskPriority.HIGH,
        resources: [],
        expectedOutputs: ["Google OAuth implementation"],
        acceptanceCriteria: [
          "Google OAuth works with the existing authentication system.",
        ],
        risks: [],
      },
    ],
  );

  assert.equal(result.status, "ready");
  assert.ok(result.plan);
  assert.equal(result.plan?.tasks.length, 2);
});
