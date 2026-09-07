import { describe, it, expect } from "vitest";
import { buildPlanningPrompt, clampPlan, MAX_PLAN_STEPS } from "../services/planning";
import { ResearchDepth } from "../domain/enums";
import type { ResearchPlan, ResearchRequest } from "../domain/types";

const request: ResearchRequest = {
  question: "Which vector database should we pick, comparing cost and features?",
  objective: "Choose a database for our app",
  excludedSources: ["reddit.com"],
};

describe("buildPlanningPrompt", () => {
  it("embeds the question, context, depth, and freshness", () => {
    const prompt = buildPlanningPrompt(request, ResearchDepth.DEEP, "current");
    expect(prompt).toContain(request.question);
    expect(prompt).toContain("Choose a database for our app");
    expect(prompt).toContain("RESEARCH DEPTH: deep");
    expect(prompt).toContain("FRESHNESS: current");
    expect(prompt).toContain("Excluded sources: reddit.com");
  });

  it("recommends fewer steps for quick depth", () => {
    const prompt = buildPlanningPrompt(request, ResearchDepth.QUICK, "recent");
    expect(prompt).toContain("Keep 1 steps");
  });
});

describe("clampPlan", () => {
  const plan: ResearchPlan = {
    depth: ResearchDepth.DEEP,
    freshnessRequirement: "recent",
    subQuestions: Array.from({ length: 12 }, (_, i) => `sub question ${i}`),
    steps: Array.from({ length: 10 }, (_, i) => ({
      id: `step${i}`,
      intent: `intent ${i}`,
      queries: Array.from({ length: 5 }, (_, j) => `query ${i}.${j}`),
      tools: ["web_search", "web_fetch", "github", "documentation", "git"],
    })),
  };

  it("caps steps, queries, and sub-questions to safe bounds", () => {
    const clamped = clampPlan(plan, MAX_PLAN_STEPS[ResearchDepth.DEEP]);
    expect(clamped.steps.length).toBe(MAX_PLAN_STEPS[ResearchDepth.DEEP]);
    expect(clamped.subQuestions.length).toBeLessThanOrEqual(8);
    for (const step of clamped.steps) {
      expect(step.queries.length).toBeLessThanOrEqual(3);
      expect(step.tools.length).toBeLessThanOrEqual(4);
    }
  });
});