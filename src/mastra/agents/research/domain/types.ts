import type { z } from "zod";
import {
  researchLimitsSchema,
  researchPassResultSchema,
  researchPlanSchema,
  researchRequestSchema,
  researchResultSchema,
  researchSynthesisSchema,
  sourceSchema,
} from "./schemas";

/**
 * TypeScript types for the Research Agent domain. The Zod schemas in
 * `schemas.ts` are the single source of truth; these types are derived from
 * them so the runtime and the schema validation cannot drift apart.
 */

export type ResearchRequest = z.infer<typeof researchRequestSchema>;

export type Source = z.infer<typeof sourceSchema>;

export type ResearchResult = z.infer<typeof researchResultSchema>;

export type ResearchLimits = z.infer<typeof researchLimitsSchema>;

export type ResearchPlan = z.infer<typeof researchPlanSchema>;

export type ResearchPassResult = z.infer<typeof researchPassResultSchema>;

export type ResearchSynthesis = z.infer<typeof researchSynthesisSchema>;

export type Evidence = NonNullable<ResearchResult["evidence"]>[number];

/** Partial budget overrides for a research run. */
export interface ResearchBudgetOverrides {
  maxIterations: number;
  maxSearches: number;
  maxReads: number;
  maxRuntimeMs: number;
}

/** Internal accumulated research state across passes. */
export interface ResearchState {
  sources: Source[];
  evidence: NonNullable<ResearchResult["evidence"]>;
  findings: NonNullable<ResearchResult["findings"]>;
}

/** Configurable research ceilings (per-depth defaults, env-overridable). */
export interface ResearchBudgets {
  maxIterations: number;
  maxSearches: number;
  maxReads: number;
  maxRuntimeMs: number;
}

/** Default research budgets per depth. */
export const DEFAULT_LIMITS: Record<"quick" | "standard" | "deep", ResearchBudgets> = {
  quick: { maxIterations: 1, maxSearches: 2, maxReads: 3, maxRuntimeMs: 60_000 },
  standard: { maxIterations: 3, maxSearches: 6, maxReads: 8, maxRuntimeMs: 180_000 },
  deep: { maxIterations: 5, maxSearches: 12, maxReads: 16, maxRuntimeMs: 300_000 },
};