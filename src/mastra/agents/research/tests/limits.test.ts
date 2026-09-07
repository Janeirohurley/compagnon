import { describe, it, expect, afterEach } from "vitest";
import { resolveBudgets } from "../services/limits";
import { ResearchDepth } from "../domain/enums";
import { DEFAULT_LIMITS } from "../domain/types";

const originalEnv: Record<string, string | undefined> = {};

function clearResearchEnv() {
  for (const key of [
    "RESEARCH_MAX_ITERATIONS",
    "RESEARCH_MAX_SEARCHES",
    "RESEARCH_MAX_READS",
    "RESEARCH_MAX_RUNTIME_MS",
  ]) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
}

describe("resolveBudgets", () => {
  afterEach(() => {
    for (const key of Object.keys(originalEnv)) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("returns the per-depth defaults when nothing is set", () => {
    clearResearchEnv();
    expect(resolveBudgets(ResearchDepth.QUICK)).toEqual(DEFAULT_LIMITS.quick);
    expect(resolveBudgets(ResearchDepth.STANDARD)).toEqual(DEFAULT_LIMITS.standard);
    expect(resolveBudgets(ResearchDepth.DEEP)).toEqual(DEFAULT_LIMITS.deep);
  });

  it("lets env variables override the defaults", () => {
    clearResearchEnv();
    process.env.RESEARCH_MAX_ITERATIONS = "7";
    process.env.RESEARCH_MAX_SEARCHES = "20";
    const budgets = resolveBudgets(ResearchDepth.QUICK);
    expect(budgets.maxIterations).toBe(7);
    expect(budgets.maxSearches).toBe(20);
    expect(budgets.maxReads).toBe(DEFAULT_LIMITS.quick.maxReads);
  });

  it("lets explicit runtime overrides win over env and defaults", () => {
    clearResearchEnv();
    process.env.RESEARCH_MAX_ITERATIONS = "7";
    const budgets = resolveBudgets(ResearchDepth.QUICK, { maxIterations: 2 });
    expect(budgets.maxIterations).toBe(2);
  });

  it("ignores non-positive env values", () => {
    clearResearchEnv();
    process.env.RESEARCH_MAX_ITERATIONS = "0";
    expect(resolveBudgets(ResearchDepth.STANDARD).maxIterations).toBe(
      DEFAULT_LIMITS.standard.maxIterations,
    );
  });
});